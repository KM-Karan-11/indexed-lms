const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const APP_URL = "https://indexed-lms.vercel.app";

const FIREBASE_API_KEY = "AIzaSyCWQ_BA24ALVPbRaqSZ1X-Ig7zqzQtf7Zk";
const FIREBASE_PROJECT = "indexed-lms";

const LEAVE_EMOJI = {
  "Personal Leave": "🌴",
  "Sick Leave": "🤒",
  "Unpaid Leave": "💸",
  "Others": "✨",
};

export const config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ─── Firestore REST — no auth needed (test mode rules allow all) ──────────
async function updateRequestStatus(requestId, status) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/requests/${requestId}?updateMask.fieldPaths=status&key=${FIREBASE_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { status: { stringValue: status } } }),
    });
    const text = await res.text();
    console.log("Firestore response:", res.status, text.substring(0, 100));
    return res.ok;
  } catch (e) {
    console.error("Firestore fetch error:", e.message);
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
    return data.ok ? data.user?.id : null;
  } catch { return null; }
}

async function sendSlackDM(email, text, blocks) {
  if (!SLACK_BOT_TOKEN || !email) return;
  const userId = await getSlackUserId(email);
  if (!userId) return;
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: userId, text, ...(blocks ? { blocks } : {}) }),
  });
  const d = await r.json();
  if (!d.ok) console.error("DM error:", d.error);
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({
      user: userId,
      profile: {
        status_text: `OOO – ${leaveType}`,
        status_emoji: `:${emojiMap[leaveType] || "palm_tree"}:`,
        status_expiration: expiryTs,
      },
    }),
  }).catch(() => {});
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let payload;
  try {
    const raw = await getRawBody(req);
    const params = new URLSearchParams(raw);
    payload = JSON.parse(params.get("payload") || raw);
  } catch (e) {
    console.error("Parse error:", e.message);
    return res.status(200).end();
  }

  if (payload.type !== "block_actions") return res.status(200).end();

  const action = payload.actions?.[0];
  if (!action) return res.status(200).end();

  const decision = action.action_id === "approve_leave" ? "approved" : "rejected";
  const emoji = decision === "approved" ? "✅" : "❌";

  let data;
  try { data = JSON.parse(action.value); } catch { return res.status(200).end(); }

  const { requestId, employeeEmail, employeeName, leaveType, startDate, endDate, managerName } = data;
  const leaveEmoji = LEAVE_EMOJI[leaveType] || "📋";

  console.log(`Action: ${decision} | Request: ${requestId} | Employee: ${employeeName}`);

  // Respond to Slack immediately (must be within 3s)
  res.status(200).json({ text: `${emoji} ${decision}…` });

  // Do everything after responding
  try {
    // 1. Update Firestore
    const ok = await updateRequestStatus(requestId, decision);
    console.log("Firestore update:", ok ? "SUCCESS" : "FAILED");

    // 2. Update original Slack message — replace buttons with result
    if (payload.response_url) {
      await fetch(payload.response_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace_original: true,
          blocks: [
            { type: "header", text: { type: "plain_text", text: `${leaveEmoji} Leave — ${decision.toUpperCase()} ${emoji}` } },
            { type: "section", text: { type: "mrkdwn", text: `*${employeeName}*'s leave has been *${decision}* by <@${payload.user?.id}>.` } },
            { type: "section", fields: [
              { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
              { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
            ]},
            { type: "context", elements: [{ type: "mrkdwn", text: `<${APP_URL}|View on Indexed LMS>` }] },
          ],
        }),
      }).catch(e => console.error("response_url error:", e.message));
    }

    // 3. DM the employee
    await sendSlackDM(employeeEmail, `${emoji} Your leave has been ${decision}`, [
      { type: "header", text: { type: "plain_text", text: `${emoji} Leave ${decision === "approved" ? "Approved" : "Rejected"}` } },
      { type: "section", text: { type: "mrkdwn", text: decision === "approved" ? `Great news *${employeeName}*! Your leave has been *approved* by *${managerName}* 🎉` : `Hi *${employeeName}*, your leave was *declined* by *${managerName}*.` } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
        { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
      ]},
      { type: "section", text: { type: "mrkdwn", text: decision === "approved" ? `Slack OOO status set 🌴\n<${APP_URL}|View on LMS>` : `Speak to your manager.\n<${APP_URL}|View on LMS>` } },
    ]);

    // 4. OOO if approved
    if (decision === "approved") await setSlackOOO(employeeEmail, leaveType, endDate);

    console.log("Done:", employeeName, decision);
  } catch (e) {
    console.error("Error after response:", e.message);
  }
}
