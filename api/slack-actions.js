const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const APP_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://indexed-lms.vercel.app";
const LEAVE_EMOJI = { "Personal Leave": "🌴", "Sick Leave": "🤒", "Unpaid Leave": "💸", "Others": "✨" };

// Firebase Admin
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

let db;
try {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: "indexed-lms",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  db = getFirestore();
} catch (e) { console.error(e); }

async function getSlackUserId(email) {
  if (!SLACK_BOT_TOKEN || !email) return null;
  try {
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
    const data = await res.json();
    return data.ok ? data.user?.id : null;
  } catch { return null; }
}

async function sendSlackDM(email, text, blocks) {
  if (!SLACK_BOT_TOKEN) return;
  const userId = await getSlackUserId(email);
  if (!userId) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: userId, text, ...(blocks ? { blocks } : {}) }),
  }).catch(() => {});
}

async function setSlackOOO(email, leaveType, endDate) {
  if (!SLACK_BOT_TOKEN) return;
  const userId = await getSlackUserId(email);
  if (!userId) return;
  const emojiMap = { "Personal Leave": "palm_tree", "Sick Leave": "face_with_thermometer", "Unpaid Leave": "money_with_wings", "Others": "calendar" };
  const expiryTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);
  await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ user: userId, profile: { status_text: `OOO – ${leaveType}`, status_emoji: `:${emojiMap[leaveType] || "palm_tree"}:`, status_expiration: expiryTs } }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Slack sends payload as form-encoded
  const raw = req.body;
  let payload;
  try {
    const bodyStr = typeof raw === "string" ? raw : new URLSearchParams(raw).get("payload") || JSON.stringify(raw);
    const payloadStr = bodyStr.startsWith("{") ? bodyStr : new URLSearchParams(bodyStr).get("payload");
    payload = JSON.parse(payloadStr);
  } catch (e) {
    try { payload = typeof raw === "object" ? raw : JSON.parse(raw); } catch { return res.status(400).end(); }
  }

  if (payload.type !== "block_actions") return res.status(200).end();

  const action = payload.actions?.[0];
  if (!action) return res.status(200).end();

  const actionId = action.action_id; // "approve_leave" or "reject_leave"
  const decision = actionId === "approve_leave" ? "approved" : "rejected";
  const managerSlackUser = payload.user?.name || "Manager";

  let data;
  try { data = JSON.parse(action.value); } catch { return res.status(200).end(); }

  const { requestId, employeeEmail, employeeName, leaveType, startDate, endDate, managerName } = data;

  // Acknowledge immediately (Slack requires < 3s response)
  res.status(200).json({
    response_action: "update",
    view: null,
  });

  // Update Firestore
  try {
    if (db) {
      await db.collection("requests").doc(requestId).update({ status: decision });
    }
  } catch (e) { console.error("Firestore update error:", e); }

  const emoji = decision === "approved" ? "✅" : "❌";
  const leaveEmoji = LEAVE_EMOJI[leaveType] || "📋";

  // Update the original Slack message to show decision
  if (payload.response_url) {
    await fetch(payload.response_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: true,
        blocks: [
          { type: "header", text: { type: "plain_text", text: `${leaveEmoji} Leave Request — ${decision.toUpperCase()}` } },
          { type: "section", text: { type: "mrkdwn", text: `*${employeeName}*'s leave request has been *${decision}* ${emoji} by <@${payload.user?.id}>.` } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
            { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
          ]},
          { type: "context", elements: [{ type: "mrkdwn", text: `<${APP_URL}|View on Indexed LMS>` }] },
        ],
      }),
    }).catch(() => {});
  }

  // DM the employee about the decision
  await sendSlackDM(employeeEmail,
    `${emoji} Your leave has been ${decision} by ${managerName || managerSlackUser}`,
    [
      { type: "header", text: { type: "plain_text", text: `${emoji} Leave ${decision === "approved" ? "Approved" : "Rejected"}` } },
      { type: "section", text: { type: "mrkdwn", text: decision === "approved" ? `Great news *${employeeName}*! Your leave has been *approved* 🎉` : `Hi *${employeeName}*, your leave request was *declined*.` } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
        { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
      ]},
      { type: "section", text: { type: "mrkdwn", text: decision === "approved" ? `Your Slack status has been set to OOO 🌴\n<${APP_URL}|View on Indexed LMS>` : `Please speak to your manager if you have questions.\n<${APP_URL}|View on Indexed LMS>` } },
    ]
  );

  // Set OOO status if approved
  if (decision === "approved" && employeeEmail) {
    await setSlackOOO(employeeEmail, leaveType, endDate);
  }
}
