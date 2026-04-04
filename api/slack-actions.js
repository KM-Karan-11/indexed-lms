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

const OOO_EMOJI = {
  "Personal Leave": "palm_tree",
  "Sick Leave": "face_with_thermometer",
  "Unpaid Leave": "money_with_wings",
  "Others": "calendar",
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

async function updateFirestore(requestId, decision) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/requests/${requestId}?updateMask.fieldPaths=status&key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { status: { stringValue: decision } } }),
  });
  console.log("Firestore:", res.status);
  return res.ok;
}

async function getSlackUserId(email) {
  if (!email || !SLACK_BOT_TOKEN) return null;
  const res = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
  );
  const d = await res.json();
  console.log("Slack lookup:", email, d.ok, d.user?.id);
  return d.ok ? d.user?.id : null;
}

async function updateSlackMessage(responseUrl, blocks) {
  if (!responseUrl) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace_original: true, blocks }),
  });
}

async function sendDM(userId, text, blocks) {
  if (!userId || !SLACK_BOT_TOKEN) return;
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: userId, text, blocks }),
  });
  const d = await r.json();
  console.log("DM sent:", d.ok, d.error || "");
}

async function setOOO(userId, leaveType, endDate) {
  if (!userId || !SLACK_BOT_TOKEN) return;
  const expiryTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);
  await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({
      user: userId,
      profile: {
        status_text: `OOO – ${leaveType}`,
        status_emoji: `:${OOO_EMOJI[leaveType] || "palm_tree"}:`,
        status_expiration: expiryTs,
      },
    }),
  });
  console.log("OOO set for userId:", userId, "until:", endDate);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Parse Slack payload
  let payload;
  try {
    const raw = await getRawBody(req);
    const params = new URLSearchParams(raw);
    payload = JSON.parse(params.get("payload") || raw);
  } catch (e) {
    console.error("Parse error:", e.message);
    return res.status(200).send("ok");
  }

  if (payload.type !== "block_actions") return res.status(200).send("ok");

  const action = payload.actions?.[0];
  if (!action) return res.status(200).send("ok");

  const decision = action.action_id === "approve_leave" ? "approved" : "rejected";
  const emoji = decision === "approved" ? "✅" : "❌";

  let data;
  try { data = JSON.parse(action.value); } catch { return res.status(200).send("ok"); }

  const { requestId, employeeEmail, employeeName, leaveType, startDate, endDate, managerName } = data;
  const leaveEmoji = LEAVE_EMOJI[leaveType] || "📋";

  console.log(`→ ${decision} | request: ${requestId} | employee: ${employeeName}`);

  // ── Run everything in parallel before responding ──────────────────────

  // 1. Get employee's Slack user ID (needed for DM + OOO)
  const employeeUserId = await getSlackUserId(employeeEmail);

  // 2. Run Firestore update + Slack message update in parallel
  await Promise.all([

    // Update Firestore
    updateFirestore(requestId, decision),

    // Replace Slack message buttons with outcome
    updateSlackMessage(payload.response_url, [
      { type: "header", text: { type: "plain_text", text: `${leaveEmoji} Leave — ${decision.toUpperCase()} ${emoji}` } },
      { type: "section", text: { type: "mrkdwn", text: `*${employeeName}*'s leave has been *${decision}* ${emoji} by <@${payload.user?.id}>.` } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
        { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
      ]},
      { type: "context", elements: [{ type: "mrkdwn", text: `<${APP_URL}|View on Indexed LMS>` }] },
    ]),

    // DM the employee
    employeeUserId ? sendDM(employeeUserId, `${emoji} Your leave has been ${decision}`, [
      { type: "header", text: { type: "plain_text", text: `${emoji} Leave ${decision === "approved" ? "Approved" : "Rejected"}` } },
      { type: "section", text: { type: "mrkdwn", text: decision === "approved"
        ? `Great news *${employeeName}*! Your leave has been *approved* by *${managerName}* 🎉`
        : `Hi *${employeeName}*, your leave was *declined* by *${managerName}*.` }
      },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
        { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
      ]},
      { type: "section", text: { type: "mrkdwn", text: decision === "approved"
        ? `Your Slack status is being set to OOO 🌴\n<${APP_URL}|View on Indexed LMS>`
        : `Please speak to your manager.\n<${APP_URL}|View on Indexed LMS>` }
      },
    ]) : Promise.resolve(),

  ]);

  // 3. Set OOO status if approved (after DM sent)
  if (decision === "approved" && employeeUserId) {
    await setOOO(employeeUserId, leaveType, endDate);
  }

  console.log("✅ All done —", employeeName, decision);

  // 4. Respond to Slack last — everything is already done
  return res.status(200).send("ok");
}
