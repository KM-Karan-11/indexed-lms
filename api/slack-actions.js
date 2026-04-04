const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const FIREBASE_API_KEY = "AIzaSyCWQ_BA24ALVPbRaqSZ1X-Ig7zqzQtf7Zk";
const FIREBASE_PROJECT = "indexed-lms";
const APP_URL = "https://indexed-lms.vercel.app";

const LEAVE_EMOJI = {
  "Personal Leave": "🌴",
  "Sick Leave": "🤒",
  "Unpaid Leave": "💸",
  "Others": "✨",
};

// ─── Tell Vercel NOT to parse the body — we need the raw form data ─────────
export const config = {
  api: {
    bodyParser: false,
  },
};

// ─── Read raw body from request ───────────────────────────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ─── Firestore REST API ───────────────────────────────────────────────────
async function updateRequestStatus(requestId, status) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/requests/${requestId}?updateMask.fieldPaths=status&key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { status: { stringValue: status } } }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Firestore update failed:", err);
    }
    return res.ok;
  } catch (e) {
    console.error("Firestore error:", e);
    return false;
  }
}

// ─── Slack helpers ────────────────────────────────────────────────────────
async function getSlackUserId(email) {
  if (!SLACK_BOT_TOKEN || !email) return null;
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );
    const data = await res.json();
    return data.ok && data.user?.id ? data.user.id : null;
  } catch { return null; }
}

async function sendSlackDM(email, text, blocks) {
  if (!SLACK_BOT_TOKEN || !email) return;
  const userId = await getSlackUserId(email);
  if (!userId) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({ channel: userId, text, ...(blocks ? { blocks } : {}) }),
  }).catch(e => console.error("DM error:", e));
}

async function setSlackOOO(email, leaveType, endDate) {
  if (!SLACK_BOT_TOKEN || !email) return;
  const userId = await getSlackUserId(email);
  if (!userId) return;
  const emojiMap = {
    "Personal Leave": "palm_tree",
    "Sick Leave": "face_with_thermometer",
    "Unpaid Leave": "money_with_wings",
    "Others": "calendar",
  };
  const expiryTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);
  await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      user: userId,
      profile: {
        status_text: `OOO – ${leaveType}`,
        status_emoji: `:${emojiMap[leaveType] || "palm_tree"}:`,
        status_expiration: expiryTs,
      },
    }),
  }).catch(e => console.error("OOO error:", e));
}

// ─── Main handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Read and parse raw body from Slack
  let payload;
  try {
    const rawBody = await getRawBody(req);
    console.log("Raw body received:", rawBody.substring(0, 200));

    // Slack sends: payload=<url-encoded-json>
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");

    if (payloadStr) {
      payload = JSON.parse(payloadStr);
    } else {
      // Fallback: try parsing as raw JSON
      payload = JSON.parse(rawBody);
    }
  } catch (e) {
    console.error("Parse error:", e);
    return res.status(200).end(); // Always 200 to Slack
  }

  console.log("Payload type:", payload?.type, "Actions:", payload?.actions?.length);

  // Must respond 200 to Slack within 3 seconds
  if (payload.type !== "block_actions") {
    return res.status(200).end();
  }

  const action = payload.actions?.[0];
  if (!action) return res.status(200).end();

  const decision = action.action_id === "approve_leave" ? "approved" : "rejected";
  const emoji = decision === "approved" ? "✅" : "❌";

  let data;
  try {
    data = JSON.parse(action.value);
  } catch (e) {
    console.error("Action value parse error:", e);
    return res.status(200).end();
  }

  const { requestId, employeeEmail, employeeName, leaveType, startDate, endDate, managerName } = data;
  const leaveEmoji = LEAVE_EMOJI[leaveType] || "📋";

  // ✅ Respond to Slack immediately (within 3s)
  res.status(200).json({ text: `Processing ${decision}…` });

  // Now do the async work after responding
  try {
    // 1. Update Firestore
    const updated = await updateRequestStatus(requestId, decision);
    console.log("Firestore updated:", updated, requestId, decision);

    // 2. Update the original Slack message (replace buttons with outcome)
    if (payload.response_url) {
      await fetch(payload.response_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace_original: true,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: `${leaveEmoji} Leave Request — ${decision.toUpperCase()}` },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${employeeName}*'s leave has been *${decision}* ${emoji} by <@${payload.user?.id}>.`,
              },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
                { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
              ],
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `<${APP_URL}|View on Indexed LMS>` }],
            },
          ],
        }),
      }).catch(e => console.error("response_url error:", e));
    }

    // 3. DM the employee
    await sendSlackDM(
      employeeEmail,
      `${emoji} Your leave has been ${decision}`,
      [
        { type: "header", text: { type: "plain_text", text: `${emoji} Leave ${decision === "approved" ? "Approved" : "Rejected"}` } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: decision === "approved"
              ? `Great news *${employeeName}*! Your leave has been *approved* by *${managerName}* 🎉`
              : `Hi *${employeeName}*, your leave was *declined* by *${managerName}*.`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
            { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: decision === "approved"
              ? `Your Slack status has been set to OOO 🌴\n<${APP_URL}|View on Indexed LMS>`
              : `Please speak to your manager.\n<${APP_URL}|View on Indexed LMS>`,
          },
        },
      ]
    );

    // 4. Set OOO if approved
    if (decision === "approved" && employeeEmail) {
      await setSlackOOO(employeeEmail, leaveType, endDate);
    }

  } catch (e) {
    console.error("Post-response error:", e);
  }
}
