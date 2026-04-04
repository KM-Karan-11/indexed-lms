const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
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

// ─── Firestore ────────────────────────────────────────────────────────────
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

// ─── Slack: get user ID by email ──────────────────────────────────────────
async function getSlackUserId(email) {
  if (!email || !SLACK_BOT_TOKEN) return null;
  const res = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
  );
  const d = await res.json();
  console.log("Slack lookup:", email, d.ok, d.user?.id || d.error);
  return d.ok ? d.user?.id : null;
}

// ─── Slack: update original message ──────────────────────────────────────
async function updateSlackMessage(responseUrl, blocks) {
  if (!responseUrl) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace_original: true, blocks }),
  });
}

// ─── Slack: send DM to user ───────────────────────────────────────────────
async function sendDM(userId, text, blocks) {
  if (!userId || !SLACK_BOT_TOKEN) return;
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: userId, text, blocks }),
  });
  const d = await r.json();
  console.log("DM:", d.ok, d.error || "");
}

// ─── Slack: post to general channel ──────────────────────────────────────
async function sendChannelMessage(text) {
  if (!SLACK_WEBHOOK) return;
  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  console.log("Channel message sent");
}

// ─── Slack: set OOO status ────────────────────────────────────────────────
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
  console.log("OOO set:", userId, endDate);
}

// ─── Email ────────────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Indexed LMS <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  const d = await r.json();
  console.log("Email:", d.id || d.error);
}

function emailHtml(employeeName, decision, leaveType, startDate, endDate) {
  const approved = decision === "approved";
  const color = approved ? "#10B981" : "#EF4444";
  const emoji = approved ? "✅" : "❌";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#F0F3FF;font-family:Inter,system-ui,sans-serif}.wrapper{max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.15)}.header{background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:32px 40px;text-align:center}.logo{font-size:40px;display:block;margin-bottom:8px}.brand{color:#fff;font-size:22px;font-weight:900}.sub{color:rgba(255,255,255,0.6);font-size:13px}.body{padding:36px 40px}.footer{padding:20px 40px;text-align:center;background:#F8FAFF;font-size:12px;color:#94A3B8}h2{font-size:20px;font-weight:800;color:${color};margin:0 0 8px}p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 16px}.info-box{background:#F0F3FF;border-radius:12px;padding:20px 24px;margin:20px 0}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid rgba(99,102,241,0.1)}.info-label{color:#94A3B8;font-weight:600}.info-val{color:#0F172A;font-weight:700}.btn{display:inline-block;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px}</style></head><body><div style="padding:24px"><div class="wrapper"><div class="header"><span class="logo">🌴</span><div class="brand">Indexed LMS</div><div class="sub">Leave Management System by Indexed</div></div><div class="body"><h2>${emoji} Leave ${approved ? "Approved!" : "Rejected"}</h2><p>Hi <strong>${employeeName}</strong>,</p><p>Your leave request has been <strong style="color:${color}">${decision}</strong>.</p><div class="info-box"><div class="info-row"><span class="info-label">Type</span><span class="info-val">${leaveType}</span></div><div class="info-row"><span class="info-label">Start</span><span class="info-val">${startDate}</span></div><div class="info-row"><span class="info-label">End</span><span class="info-val">${endDate}</span></div><div class="info-row"><span class="info-label">Status</span><span class="info-val" style="color:${color}">${decision.toUpperCase()}</span></div></div>${approved ? "<p>Your Slack status has been set to OOO automatically 🌴</p>" : "<p>Please speak to your manager if you have any questions.</p>"}<p style="text-align:center"><a href=\"" + APP_URL + "\" class=\"btn\" style=\"background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff\">View on Indexed LMS</a></p></div><div class=\"footer\">Indexed LMS · by Indexed</div></div></div></body></html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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

  console.log(`→ ${decision} | ${requestId} | ${employeeName} | ${employeeEmail}`);

  // Get employee Slack ID first (needed for DM + OOO)
  const employeeUserId = await getSlackUserId(employeeEmail);

  // Run all tasks in parallel
  await Promise.all([

    // 1. Update Firestore
    updateFirestore(requestId, decision),

    // 2. Replace Slack message buttons with outcome
    updateSlackMessage(payload.response_url, [
      { type: "header", text: { type: "plain_text", text: `${leaveEmoji} Leave — ${decision.toUpperCase()} ${emoji}` } },
      { type: "section", text: { type: "mrkdwn", text: `*${employeeName}*'s leave has been *${decision}* ${emoji} by <@${payload.user?.id}>.` } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
        { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
      ]},
      { type: "context", elements: [{ type: "mrkdwn", text: `<${APP_URL}|View on Indexed LMS>` }] },
    ]),

    // 3. DM the employee
    employeeUserId ? sendDM(employeeUserId, `${emoji} Your leave has been ${decision}`, [
      { type: "header", text: { type: "plain_text", text: `${emoji} Leave ${decision === "approved" ? "Approved" : "Rejected"}` } },
      { type: "section", text: { type: "mrkdwn", text: decision === "approved"
        ? `Great news *${employeeName}*! Your leave has been *approved* by *${managerName}* 🎉`
        : `Hi *${employeeName}*, your leave was *declined* by *${managerName}*.`
      }},
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Type:*\n${leaveType}` },
        { type: "mrkdwn", text: `*Dates:*\n${startDate} → ${endDate}` },
      ]},
      { type: "section", text: { type: "mrkdwn", text: decision === "approved"
        ? `Your Slack status is being set to OOO 🌴\n<${APP_URL}|View on Indexed LMS>`
        : `Please speak to your manager.\n<${APP_URL}|View on Indexed LMS>`
      }},
    ]) : Promise.resolve(),

    // 4. Post to general Slack channel
    sendChannelMessage(
      `${emoji} *${employeeName}*'s leave has been *${decision}* by ${managerName}${decision === "approved" ? ` · OOO set until ${endDate} 🌴` : ""}`
    ),

    // 5. Send email to employee
    sendEmail(
      employeeEmail,
      `${emoji} Your leave has been ${decision} — Indexed LMS`,
      emailHtml(employeeName, decision, leaveType, startDate, endDate)
    ),

  ]);

  // Set OOO status after parallel tasks (needs userId)
  if (decision === "approved" && employeeUserId) {
    await setOOO(employeeUserId, leaveType, endDate);
  }

  console.log("✅ All done —", employeeName, decision);

  return res.status(200).send("ok");
}
