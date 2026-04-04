const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = "https://indexed-lms.vercel.app";

const LEAVE_EMOJI = { "Personal Leave": "🌴", "Sick Leave": "🤒", "Unpaid Leave": "💸", "Others": "✨" };

// ─── Slack: general channel ───────────────────────────────────────────────
async function sendSlackChannel(text) {
  if (!SLACK_WEBHOOK) return;
  const r = await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(e => ({ ok: false, error: e.message }));
  console.log("Slack channel:", r.status || r.error);
}

// ─── Slack: get user ID by email ──────────────────────────────────────────
async function getSlackUserId(email) {
  if (!SLACK_BOT_TOKEN || !email) return null;
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );
    const data = await res.json();
    console.log(`Slack lookup [${email}]:`, data.ok, data.user?.id || data.error);
    return data.ok ? data.user?.id : null;
  } catch (e) {
    console.error("Slack lookup error:", e.message);
    return null;
  }
}

// ─── Slack: send DM ───────────────────────────────────────────────────────
async function sendSlackDM(email, text, blocks) {
  if (!SLACK_BOT_TOKEN || !email) return;
  const userId = await getSlackUserId(email);
  if (!userId) { console.log("No Slack userId for:", email); return; }
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: userId, text, ...(blocks ? { blocks } : {}) }),
  });
  const d = await r.json();
  console.log("Slack DM to", email, ":", d.ok, d.error || "");
}

// ─── Slack: set OOO status ────────────────────────────────────────────────
async function setSlackOOO(email, leaveType, endDate) {
  if (!SLACK_BOT_TOKEN || !email) return;
  const userId = await getSlackUserId(email);
  if (!userId) { console.log("OOO skipped — no userId for:", email); return; }

  const emojiMap = {
    "Personal Leave": "palm_tree",
    "Sick Leave": "face_with_thermometer",
    "Unpaid Leave": "money_with_wings",
    "Others": "calendar",
  };
  const expiryTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);
  const profile = {
    status_text: `OOO – ${leaveType}`,
    status_emoji: `:${emojiMap[leaveType] || "palm_tree"}:`,
    status_expiration: expiryTs,
  };
  console.log("Setting OOO for userId:", userId, "profile:", JSON.stringify(profile));

  const r = await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ user: userId, profile }),
  });
  const d = await r.json();
  console.log("OOO result:", d.ok, d.error || "");
  if (!d.ok) console.error("OOO failed — check bot has users.profile:write scope");
}

// ─── Slack: clear OOO status ──────────────────────────────────────────────
async function clearSlackOOO(email) {
  if (!SLACK_BOT_TOKEN || !email) return;
  const userId = await getSlackUserId(email);
  if (!userId) return;
  await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ user: userId, profile: { status_text: "", status_emoji: "", status_expiration: 0 } }),
  });
}

// ─── Email via Resend ─────────────────────────────────────────────────────
// Using Anjan's Resend account with joinindexed.com domain
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) { console.log("No RESEND_API_KEY set"); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Indexed LMS <lms@joinindexed.com>",
      to,
      subject,
      html,
    }),
  });
  const d = await r.json();
  console.log("Email to", to, ":", d.id || d.error || JSON.stringify(d));
  return d;
}

function emailBase(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#F0F3FF;font-family:Inter,system-ui,sans-serif}.wrapper{max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.15)}.header{background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:32px 40px;text-align:center}.logo{font-size:40px;display:block;margin-bottom:8px}.brand{color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.04em}.sub{color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px}.body{padding:36px 40px}.footer{padding:20px 40px;text-align:center;background:#F8FAFF;font-size:12px;color:#94A3B8}h2{font-size:20px;font-weight:800;color:#0F172A;margin:0 0 8px}p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 16px}.info-box{background:#F0F3FF;border-radius:12px;padding:20px 24px;margin:20px 0}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid rgba(99,102,241,0.1)}.info-label{color:#94A3B8;font-weight:600}.info-val{color:#0F172A;font-weight:700}.btn{display:inline-block;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px}</style></head><body><div style="padding:24px"><div class="wrapper"><div class="header"><span class="logo">🌴</span><div class="brand">Indexed LMS</div><div class="sub">Leave Management System by Indexed</div></div><div class="body">${content}</div><div class="footer">© Indexed · <a href="${APP_URL}" style="color:#6366F1">Indexed LMS</a></div></div></div></body></html>`;
}

// ─── Slack approval blocks with buttons ──────────────────────────────────
function buildApprovalBlocks(request, days, managerName) {
  const emoji = LEAVE_EMOJI[request.type] || "📋";
  const actionValue = JSON.stringify({
    requestId: request.id,
    employeeEmail: request.userEmail,
    employeeName: request.userName,
    leaveType: request.type,
    startDate: request.startDate,
    endDate: request.endDate,
    managerName: managerName || "Manager",
  });
  return [
    { type: "header", text: { type: "plain_text", text: `${emoji} New Leave Request` } },
    { type: "section", text: { type: "mrkdwn", text: `*${request.userName}* has requested leave and needs your approval.` } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*Type:*\n${request.type}` },
      { type: "mrkdwn", text: `*Duration:*\n${days} day${days !== 1 ? "s" : ""}` },
      { type: "mrkdwn", text: `*From:*\n${request.startDate}` },
      { type: "mrkdwn", text: `*To:*\n${request.endDate}` },
    ]},
    ...(request.reason ? [{ type: "section", text: { type: "mrkdwn", text: `*Reason:* ${request.reason}` } }] : []),
    { type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "✅ Approve" }, style: "primary", action_id: "approve_leave", value: actionValue },
      { type: "button", text: { type: "plain_text", text: "❌ Reject" }, style: "danger", action_id: "reject_leave", value: actionValue },
    ]},
    { type: "context", elements: [{ type: "mrkdwn", text: `Or <${APP_URL}|review on Indexed LMS>` }] },
  ];
}

// ─── Main handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, request, decision, employeeName, employeeEmail, managerName, days, userName, userEmail, tempPassword } = req.body;
  console.log("notify called:", type, employeeEmail || userEmail || request?.userEmail);

  try {

    // ── New leave request ─────────────────────────────────────────────────
    if (type === "new_request") {
      const emoji = LEAVE_EMOJI[request.type] || "📋";
      const blocks = buildApprovalBlocks(request, days, managerName);

      await Promise.all([
        sendSlackDM(request.managerEmail, `${emoji} ${request.userName} has requested leave`, blocks),
        request.managerEmail ? sendEmail(
          request.managerEmail,
          `${emoji} Leave request from ${request.userName}`,
          emailBase(`<h2>New leave request</h2><p><strong>${request.userName}</strong> has submitted a leave request for your approval.</p><div class="info-box"><div class="info-row"><span class="info-label">Type</span><span class="info-val">${request.type}</span></div><div class="info-row"><span class="info-label">Start</span><span class="info-val">${request.startDate}</span></div><div class="info-row"><span class="info-label">End</span><span class="info-val">${request.endDate}</span></div><div class="info-row"><span class="info-label">Duration</span><span class="info-val">${days} day${days !== 1 ? "s" : ""}</span></div>${request.reason ? `<div class="info-row"><span class="info-label">Reason</span><span class="info-val">${request.reason}</span></div>` : ""}</div><p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">Review on LMS →</a></p>`)
        ) : Promise.resolve(),
        sendSlackChannel(`${emoji} *${request.userName}* submitted a leave request · Manager: ${request.managerName || "Unassigned"}`),
      ]);
    }

    // ── Decision ──────────────────────────────────────────────────────────
    if (type === "decision") {
      const approved = decision === "approved";
      const emoji = approved ? "✅" : "❌";
      const color = approved ? "#10B981" : "#EF4444";

      await Promise.all([
        sendSlackDM(employeeEmail, `${emoji} Your leave has been ${decision} by ${managerName}`, [
          { type: "header", text: { type: "plain_text", text: `${emoji} Leave ${approved ? "Approved" : "Rejected"}` } },
          { type: "section", text: { type: "mrkdwn", text: approved
            ? `Great news *${employeeName}*! Your leave has been *approved* by *${managerName}* 🎉`
            : `Hi *${employeeName}*, your leave was *declined* by *${managerName}*.` }
          },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Type:*\n${request.type}` },
            { type: "mrkdwn", text: `*Dates:*\n${request.startDate} → ${request.endDate}` },
          ]},
          { type: "section", text: { type: "mrkdwn", text: approved
            ? `Your Slack status has been set to OOO 🌴\n<${APP_URL}|View on Indexed LMS>`
            : `Please speak to your manager.\n<${APP_URL}|View on Indexed LMS>` }
          },
        ]),
        employeeEmail ? sendEmail(
          employeeEmail,
          `${emoji} Your leave has been ${decision} — Indexed LMS`,
          emailBase(`<h2 style="color:${color}">${emoji} Leave ${approved ? "Approved!" : "Rejected"}</h2><p>Hi <strong>${employeeName}</strong>,</p><p>Your leave has been <strong style="color:${color}">${decision}</strong> by <strong>${managerName}</strong>.</p><div class="info-box"><div class="info-row"><span class="info-label">Type</span><span class="info-val">${request.type}</span></div><div class="info-row"><span class="info-label">Dates</span><span class="info-val">${request.startDate} → ${request.endDate}</span></div><div class="info-row"><span class="info-label">Status</span><span class="info-val" style="color:${color}">${decision.toUpperCase()}</span></div></div>${approved ? "<p>Your Slack status has been automatically set to OOO 🌴</p>" : "<p>Please speak to your manager if you have questions.</p>"}<p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">View on Indexed LMS</a></p>`)
        ) : Promise.resolve(),
        sendSlackChannel(`${emoji} *${employeeName}*'s leave *${decision}* by ${managerName}${approved ? ` · OOO set until ${request.endDate} 🌴` : ""}`),
      ]);

      // OOO after parallel (needs userId from lookup)
      if (approved && employeeEmail) await setSlackOOO(employeeEmail, request.type, request.endDate);
      if (!approved && employeeEmail) await clearSlackOOO(employeeEmail);
    }

    // ── Invite ────────────────────────────────────────────────────────────
    if (type === "invite") {
      await Promise.all([
        sendSlackDM(userEmail, `🌴 Welcome to Indexed LMS, ${userName}!`, [
          { type: "header", text: { type: "plain_text", text: "🌴 Welcome to Indexed LMS!" } },
          { type: "section", text: { type: "mrkdwn", text: `Hey *${userName}*! You've been added to Indexed LMS — the leave management system for the Indexed team 🎉` } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Your email:*\n${userEmail}` },
            { type: "mrkdwn", text: `*Temp password:*\n\`${tempPassword}\`` },
          ]},
          { type: "section", text: { type: "mrkdwn", text: `⚡ You'll be asked to set a new password on first login.\n\n<${APP_URL}|👉 Sign in to Indexed LMS>` } },
        ]),
        sendEmail(
          userEmail,
          `🌴 Welcome to Indexed LMS!`,
          emailBase(`<h2>Welcome to Indexed LMS! 🎉</h2><p>Hi <strong>${userName}</strong>,</p><p>You've been added to <strong>Indexed LMS</strong> — the leave management system for the Indexed team.</p><div class="info-box"><div class="info-row"><span class="info-label">Login URL</span><span class="info-val"><a href="${APP_URL}" style="color:#6366F1">${APP_URL}</a></span></div><div class="info-row"><span class="info-label">Email</span><span class="info-val">${userEmail}</span></div><div class="info-row"><span class="info-label">Temp Password</span><span class="info-val" style="font-family:monospace;background:#F0F3FF;padding:2px 8px;border-radius:6px">${tempPassword}</span></div></div><p>⚡ You'll be asked to set a new password on your first login.</p><p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">Sign in to Indexed LMS →</a></p>`)
        ),
        sendSlackChannel(`👋 *${userName}* has joined Indexed LMS! Welcome to the team 🎉`),
      ]);
    }

    // ── Forgot password ───────────────────────────────────────────────────
    if (type === "forgot") {
      await Promise.all([
        sendSlackDM(userEmail, `🔑 Your Indexed LMS password has been reset`, [
          { type: "header", text: { type: "plain_text", text: "🔑 Password Reset" } },
          { type: "section", text: { type: "mrkdwn", text: `Hi *${userName}*! A password reset was requested for your Indexed LMS account.` } },
          { type: "section", fields: [{ type: "mrkdwn", text: `*Temp password:*\n\`${tempPassword}\`` }] },
          { type: "section", text: { type: "mrkdwn", text: `⚡ You'll be asked to set a new password on login.\n\n<${APP_URL}|👉 Sign in to Indexed LMS>` } },
        ]),
        sendEmail(
          userEmail,
          `🔑 Password reset — Indexed LMS`,
          emailBase(`<h2>Password Reset 🔑</h2><p>Hi <strong>${userName}</strong>,</p><p>A password reset was requested for your Indexed LMS account.</p><div class="info-box"><div class="info-row"><span class="info-label">Temp Password</span><span class="info-val" style="font-family:monospace;background:#F0F3FF;padding:2px 8px;border-radius:6px">${tempPassword}</span></div></div><p>⚡ You'll be asked to set a new password when you log in.</p><p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">Sign in →</a></p>`)
        ),
      ]);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("notify error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
