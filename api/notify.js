const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://indexed-lms.vercel.app";

async function sendSlack(text, blocks) {
  const body = blocks ? { blocks } : { text };
  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

async function sendEmail(to, subject, html) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: "Indexed LMS <onboarding@resend.dev>", to, subject, html }),
  }).catch(() => {});
}

function emailBase(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#F0F3FF;font-family:Inter,system-ui,sans-serif}table{border-collapse:collapse;width:100%}.wrapper{max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid rgba(99,102,241,0.15)}.header{background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:32px 40px;text-align:center}.logo{font-size:40px;display:block;margin-bottom:8px}.brand{color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.04em}.sub{color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px}.body{padding:36px 40px}.footer{padding:20px 40px;text-align:center;background:#F8FAFF;font-size:12px;color:#94A3B8}h2{font-size:20px;font-weight:800;color:#0F172A;margin:0 0 8px;letter-spacing:-0.03em}p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 16px}.chip{display:inline-block;padding:6px 16px;border-radius:100px;font-size:12px;font-weight:700;margin:4px}.info-box{background:#F0F3FF;border-radius:12px;padding:20px 24px;margin:20px 0}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid rgba(99,102,241,0.1)}.info-label{color:#94A3B8;font-weight:600}.info-val{color:#0F172A;font-weight:700}.btn{display:inline-block;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;margin:8px 4px}</style></head><body><div style="padding:24px"><div class="wrapper"><div class="header"><span class="logo">🌴</span><div class="brand">Indexed LMS</div><div class="sub">Leave Management System by Indexed</div></div><div class="body">${content}</div><div class="footer">Indexed LMS · Leave Management System by Indexed<br>This is an automated notification — please do not reply.</div></div></div></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, request, decision, employeeName, employeeEmail, managerName, managerEmail, days, userName, userEmail, tempPassword } = req.body;

  try {
    if (type === "new_request") {
      // Slack notification to manager
      await sendSlack(null, [
        { type: "header", text: { type: "plain_text", text: `🌴 New Leave Request` } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*Employee:*\n${request.userName}` },
          { type: "mrkdwn", text: `*Type:*\n${request.type}` },
          { type: "mrkdwn", text: `*Dates:*\n${request.startDate} → ${request.endDate}` },
          { type: "mrkdwn", text: `*Duration:*\n${days} day${days !== 1 ? "s" : ""}` },
        ]},
        request.reason ? { type: "section", text: { type: "mrkdwn", text: `*Reason:* ${request.reason}` } } : null,
        { type: "section", text: { type: "mrkdwn", text: `*Manager:* ${managerName || "Unassigned"} — <${APP_URL}|Review on Indexed LMS>` } },
        { type: "divider" },
      ].filter(Boolean));

      // Email to manager if assigned
      if (request.managerEmail) {
        await sendEmail(request.managerEmail, `📋 Leave request from ${request.userName}`,
          emailBase(`<h2>New leave request</h2><p><strong>${request.userName}</strong> has submitted a leave request for your approval.</p><div class="info-box"><div class="info-row"><span class="info-label">Type</span><span class="info-val">${request.type}</span></div><div class="info-row"><span class="info-label">Start Date</span><span class="info-val">${request.startDate}</span></div><div class="info-row"><span class="info-label">End Date</span><span class="info-val">${request.endDate}</span></div><div class="info-row"><span class="info-label">Duration</span><span class="info-val">${days} day${days !== 1 ? "s" : ""}</span></div>${request.reason ? `<div class="info-row"><span class="info-label">Reason</span><span class="info-val">${request.reason}</span></div>` : ""}</div><p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">Review Request →</a></p>`)
        );
      }
    }

    if (type === "decision") {
      const approved = decision === "approved";
      const emoji = approved ? "✅" : "❌";
      const color = approved ? "#10B981" : "#EF4444";

      // Slack notification
      await sendSlack(`${emoji} Leave request *${decision}* for *${employeeName}* by ${managerName}\n• ${request.type} · ${request.startDate} → ${request.endDate}`);

      // Email to employee
      if (employeeEmail) {
        await sendEmail(employeeEmail,
          `${emoji} Your leave request has been ${decision}`,
          emailBase(`<h2 style="color:${color}">${emoji} Leave ${approved ? "Approved!" : "Rejected"}</h2><p>Hi <strong>${employeeName}</strong>,</p><p>Your leave request has been <strong style="color:${color}">${decision}</strong> by <strong>${managerName}</strong>.</p><div class="info-box"><div class="info-row"><span class="info-label">Type</span><span class="info-val">${request.type}</span></div><div class="info-row"><span class="info-label">Start Date</span><span class="info-val">${request.startDate}</span></div><div class="info-row"><span class="info-label">End Date</span><span class="info-val">${request.endDate}</span></div><div class="info-row"><span class="info-label">Status</span><span class="info-val" style="color:${color}">${decision.toUpperCase()}</span></div></div>${approved ? "<p>Enjoy your time off! 🌴</p>" : "<p>If you have any questions, please speak to your manager.</p>"}<p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">View on Indexed LMS</a></p>`)
        );
      }
    }

    if (type === "invite") {
      // Welcome email to new user
      await sendEmail(userEmail,
        `🌴 Welcome to Indexed LMS!`,
        emailBase(`<h2>Welcome to Indexed LMS! 🎉</h2><p>Hi <strong>${userName}</strong>,</p><p>You've been added to <strong>Indexed LMS</strong> — the leave management system for the Indexed team.</p><div class="info-box"><div class="info-row"><span class="info-label">Login URL</span><span class="info-val"><a href="${APP_URL}" style="color:#6366F1">${APP_URL}</a></span></div><div class="info-row"><span class="info-label">Email</span><span class="info-val">${userEmail}</span></div><div class="info-row"><span class="info-label">Temp Password</span><span class="info-val" style="font-family:monospace;background:#F0F3FF;padding:2px 8px;border-radius:6px">${tempPassword}</span></div></div><p>⚡ You'll be asked to set a new password on your first login.</p><p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">Sign in to Indexed LMS →</a></p>`)
      );

      // Slack notification to team channel
      await sendSlack(`👋 *${userName}* has joined Indexed LMS! Welcome to the team 🎉`);
    }

    if (type === "forgot") {
      await sendEmail(userEmail,
        `🔑 Password reset — Indexed LMS`,
        emailBase(`<h2>Password Reset 🔑</h2><p>Hi <strong>${userName}</strong>,</p><p>A password reset was requested for your Indexed LMS account.</p><div class="info-box"><div class="info-row"><span class="info-label">Login URL</span><span class="info-val"><a href="${APP_URL}" style="color:#6366F1">${APP_URL}</a></span></div><div class="info-row"><span class="info-label">Temp Password</span><span class="info-val" style="font-family:monospace;background:#F0F3FF;padding:2px 8px;border-radius:6px">${tempPassword}</span></div></div><p>⚡ You'll be asked to set a new password when you log in.</p><p style="text-align:center"><a href="${APP_URL}" class="btn" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">Sign in →</a></p>`)
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
}
