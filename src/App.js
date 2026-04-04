import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, getDoc } from "firebase/firestore";

// ─── Firebase ──────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCWQ_BA24ALVPbRaqSZ1X-Ig7zqzQtf7Zk",
  authDomain: "indexed-lms.firebaseapp.com",
  projectId: "indexed-lms",
  storageBucket: "indexed-lms.firebasestorage.app",
  messagingSenderId: "726933562822",
  appId: "1:726933562822:web:0207aeb57ad7852ad6bec7"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ─── Constants ─────────────────────────────────────────────────────────────
const LEAVE_TYPES = ["Personal Leave", "Sick Leave", "Unpaid Leave", "Others"];
const LEAVE_EMOJI = { "Personal Leave": "🌴", "Sick Leave": "🤒", "Unpaid Leave": "💸", "Others": "✨" };
const SLACK_WEBHOOK = "";

const SEED_USERS = [
  { id: "admin-main", name: "Admin", email: "admin@indexed.com", password: "Admin@2024", role: "admin", manager: null, mustChangePassword: false, profile: {} },
];

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  dark: "#0B0F1A", darkCard: "#131929", darkBorder: "rgba(255,255,255,0.07)",
  bg: "#F0F3FF", card: "#FFFFFF", border: "rgba(99,102,241,0.13)",
  indigo: "#6366F1", indigoLight: "#EEF2FF", indigoDark: "#4338CA",
  violet: "#8B5CF6", cyan: "#06B6D4", pink: "#EC4899", emerald: "#10B981", amber: "#F59E0B",
  text: "#0F172A", muted: "#64748B", white: "#FFFFFF",
  danger: "#EF4444", dangerLight: "#FEF2F2",
};
const G = {
  indigo: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  cyan: "linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)",
  pink: "linear-gradient(135deg, #EC4899 0%, #F97316 100%)",
  emerald: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
  amber: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  mesh: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(6,182,212,0.1) 0%, transparent 50%)",
};

// ─── API helpers ────────────────────────────────────────────────────────────
async function callApi(endpoint, body) {
  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch { return false; }
}

// ─── Shared UI components ───────────────────────────────────────────────────
const Avatar = ({ user, size = 36 }) => {
  if (user?.profile?.photo) return <img src={user.profile.photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(99,102,241,0.3)" }} />;
  const name = user?.name || "?";
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const grads = [G.indigo, G.cyan, G.pink, G.emerald, G.amber];
  const g = grads[name.charCodeAt(0) % grads.length];
  return <div style={{ width: size, height: size, borderRadius: "50%", background: g, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.35, color: "#fff", flexShrink: 0, letterSpacing: "-0.02em" }}>{initials}</div>;
};

const StatusChip = ({ status }) => {
  const map = { pending: ["#FEF3C7", "#92400E", "⏳ Pending"], approved: ["#D1FAE5", "#064E3B", "✅ Approved"], rejected: ["#FEE2E2", "#7F1D1D", "❌ Rejected"] };
  const [bg, color, label] = map[status] || map.pending;
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 100, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{label}</span>;
};

const inputSt = { width: "100%", padding: "11px 15px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: "#F8FAFF", fontSize: 14, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border 0.2s" };

const Inp = ({ label, icon, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.07em", textTransform: "uppercase" }}>{icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}</label>}
    <input {...props} style={{ ...inputSt, ...props.style }} />
  </div>
);

const Sel = ({ label, icon, children, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.07em", textTransform: "uppercase" }}>{icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}</label>}
    <select {...props} style={{ ...inputSt, ...props.style }}>{children}</select>
  </div>
);

const Btn = ({ children, variant = "primary", size = "md", ...props }) => {
  const vs = {
    primary: { background: G.indigo, color: "#fff", border: "none", boxShadow: "0 4px 15px rgba(99,102,241,0.35)" },
    ghost: { background: "transparent", color: C.indigo, border: `1.5px solid ${C.indigo}` },
    danger: { background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}44` },
    subtle: { background: C.indigoLight, color: C.indigoDark, border: "none" },
  };
  const sz = { sm: "7px 14px", md: "11px 22px", lg: "14px 32px" };
  return <button {...props} style={{ padding: sz[size], borderRadius: 12, fontWeight: 700, fontSize: size === "sm" ? 12 : 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", ...vs[variant], ...(props.disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}), ...props.style }}>{children}</button>;
};

const GlassCard = ({ children, style }) => (
  <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 24, ...style }}>{children}</div>
);

const Toast = ({ toast }) => {
  if (!toast) return null;
  return <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, background: toast.type === "error" ? C.danger : C.dark, color: "#fff", padding: "14px 22px", borderRadius: 16, fontWeight: 700, fontSize: 14, maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 10, animation: "slideUp 0.3s ease" }}><span style={{ fontSize: 18 }}>{toast.type === "error" ? "⚠️" : "🎉"}</span>{toast.msg}</div>;
};

// ─── Nav ────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⚡", roles: ["admin", "manager", "member"] },
  { id: "request", label: "Request Leave", icon: "✈️", roles: ["admin", "manager", "member"] },
  { id: "approvals", label: "Approvals", icon: "📋", roles: ["admin", "manager"] },
  { id: "all_requests", label: "All Requests", icon: "🗂️", roles: ["admin"] },
  { id: "admin", label: "Admin", icon: "⚙️", roles: ["admin"] },
  { id: "profile", label: "My Profile", icon: "👤", roles: ["admin", "manager", "member"] },
];

const Sidebar = ({ session, page, nav, logout }) => {
  const items = NAV.filter(i => i.roles.includes(session.role));
  return (
    <div style={{ width: 240, minHeight: "100vh", background: C.dark, display: "flex", flexDirection: "column", flexShrink: 0, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.2) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.15) 0%, transparent 50%)", pointerEvents: "none" }} />
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: G.indigo, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(99,102,241,0.4)" }}>
            <span style={{ fontSize: 20 }}>🌴</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.1 }}>Indexed</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>LMS</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar user={session} size={38} />
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.name.split(" ")[0]}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "capitalize" }}>{session.profile?.jobTitle || session.role}</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "12px" }}>
        {items.map(item => {
          const active = page === item.id;
          return <button key={item.id} onClick={() => nav(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: active ? "rgba(99,102,241,0.2)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: active ? 700 : 500, textAlign: "left", marginBottom: 2, transition: "all 0.15s", borderLeft: active ? `3px solid ${C.indigo}` : "3px solid transparent" }}><span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>{item.label}</button>;
        })}
      </nav>
      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={logout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>🚪 Sign out</button>
      </div>
    </div>
  );
};

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(() => { try { return JSON.parse(sessionStorage.getItem("lms_session") || "null"); } catch { return null; } });
  const [page, setPage] = useState("dashboard");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState(null);

  // Seed initial users if Firestore is empty
  useEffect(() => {
    const seedUsers = async () => {
      for (const u of SEED_USERS) {
        const ref = doc(db, "users", u.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) await setDoc(ref, u);
      }
    };
    seedUsers();
  }, []);

  // Real-time listeners
  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(collection(db, "requests"), snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(doc(db, "settings", "main"), snap => {
      if (snap.exists()) setSettings(snap.data());
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Keep session in sync with live user data
  useEffect(() => {
    if (session && users.length > 0) {
      const fresh = users.find(u => u.id === session.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(session)) {
        setSession(fresh);
        sessionStorage.setItem("lms_session", JSON.stringify(fresh));
      }
    }
  }, [users]);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const login = () => {
    const user = users.find(u => u.email === loginEmail && u.password === loginPass);
    if (!user) return setLoginError("Wrong email or password 👀");
    setLoginError("");
    setSession(user);
    sessionStorage.setItem("lms_session", JSON.stringify(user));
    setPage(user.mustChangePassword ? "changepass" : "dashboard");
  };

  const logout = () => { setSession(null); sessionStorage.removeItem("lms_session"); setPage("dashboard"); setLoginEmail(""); setLoginPass(""); };
  const nav = (p) => setPage(p);

  if (loading) return <div style={{ minHeight: "100vh", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 16, animation: "spin 2s linear infinite" }}>🌴</div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading Indexed LMS…</div></div><style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style></div>;

  if (!session) return <LoginPage email={loginEmail} setEmail={setLoginEmail} pass={loginPass} setPass={setLoginPass} error={loginError} onLogin={login} />;
  if (page === "changepass") return <ChangePassPage session={session} setSession={setSession} setPage={setPage} notify={notify} />;

  const liveSession = users.find(u => u.id === session.id) || session;
  const slackWebhook = settings.slackWebhook || SLACK_WEBHOOK;

  const sharedProps = { session: liveSession, users, requests, settings, slackWebhook, notify, nav };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box}@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.page-content{animation:fadeIn 0.25s ease}input:focus,select:focus,textarea:focus{border-color:${C.indigo}!important;box-shadow:0 0 0 3px rgba(99,102,241,0.12)}button:hover{opacity:0.88}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:10px}`}</style>
      <Toast toast={toast} />
      <Sidebar session={liveSession} page={page} nav={nav} logout={logout} />
      <main style={{ flex: 1, padding: "32px 36px", overflow: "auto", background: `${G.mesh}, ${C.bg}` }}>
        <div className="page-content" key={page}>
          {page === "dashboard" && <DashboardPage {...sharedProps} />}
          {page === "request" && <RequestPage {...sharedProps} />}
          {page === "approvals" && <ApprovalsPage {...sharedProps} />}
          {page === "all_requests" && liveSession.role === "admin" && <AllRequestsPage {...sharedProps} />}
          {page === "admin" && liveSession.role === "admin" && <AdminPage {...sharedProps} />}
          {page === "profile" && <ProfilePage {...sharedProps} setSession={setSession} />}
        </div>
      </main>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({ email, setEmail, pass, setPass, error, onLogin }) {
  return (
    <div style={{ minHeight: "100vh", background: C.dark, display: "flex", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}input:focus{border-color:${C.indigo}!important;box-shadow:0 0 0 3px rgba(99,102,241,0.15);outline:none}`}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, background: "radial-gradient(ellipse at 30% 40%, rgba(99,102,241,0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(139,92,246,0.2) 0%, transparent 50%)" }}>
        <div style={{ textAlign: "center", animation: "fadeIn 0.6s ease" }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: G.indigo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 20px 60px rgba(99,102,241,0.5)", animation: "float 4s ease-in-out infinite" }}><span style={{ fontSize: 40 }}>🌴</span></div>
          <h1 style={{ fontSize: 42, fontWeight: 900, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.05em", lineHeight: 1.1 }}>Indexed<br /><span style={{ background: "linear-gradient(135deg, #a5b4fc, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LMS</span></h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, margin: "0 0 48px", lineHeight: 1.6 }}>Leave Management System<br />by Indexed</p>
          {[["✈️", "Request leave in seconds"], ["📋", "Real-time approvals"], ["💬", "Slack notifications"], ["📧", "Email alerts"]].map(([icon, text]) => (
            <div key={text} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, padding: "8px 16px", margin: "4px", fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}><span>{icon}</span>{text}</div>
          ))}
        </div>
      </div>
      <div style={{ width: 440, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: "100%", animation: "fadeIn 0.5s ease 0.1s both" }}>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Welcome back 👋</p>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 32px", letterSpacing: "-0.04em" }}>Sign in to LMS</h2>
          <Inp label="Work email" icon="📧" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@indexed.com" onKeyDown={e => e.key === "Enter" && onLogin()} />
          <Inp label="Password" icon="🔒" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && onLogin()} />
          {error && <div style={{ background: C.dangerLight, border: `1px solid ${C.danger}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>}
          <button onClick={onLogin} style={{ width: "100%", padding: "14px", borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 25px rgba(99,102,241,0.4)", letterSpacing: "-0.02em" }}>Sign in →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Change Password ──────────────────────────────────────────────────────────
function ChangePassPage({ session, setSession, setPage, notify }) {
  const [cur, setCur] = useState(""), [nxt, setNxt] = useState(""), [conf, setConf] = useState(""), [err, setErr] = useState("");
  const save = async () => {
    if (cur !== session.password) return setErr("Current password is wrong 👀");
    if (nxt.length < 6) return setErr("Min 6 characters please!");
    if (nxt !== conf) return setErr("Passwords don't match 😅");
    await updateDoc(doc(db, "users", session.id), { password: nxt, mustChangePassword: false });
    const updated = { ...session, password: nxt, mustChangePassword: false };
    setSession(updated);
    sessionStorage.setItem("lms_session", JSON.stringify(updated));
    notify("Password updated! You're all set 🎉");
    setPage("dashboard");
  };
  return (
    <div style={{ minHeight: "100vh", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');input:focus{border-color:${C.indigo}!important;outline:none}`}</style>
      <div style={{ width: 420, background: "#fff", borderRadius: 24, padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: "0 0 8px", letterSpacing: "-0.04em" }}>Set your password</h2>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>First time? Let's get you set up.</p>
        <Inp label="Current Password" type="password" value={cur} onChange={e => setCur(e.target.value)} />
        <Inp label="New Password" type="password" value={nxt} onChange={e => setNxt(e.target.value)} />
        <Inp label="Confirm New Password" type="password" value={conf} onChange={e => setConf(e.target.value)} />
        {err && <div style={{ background: C.dangerLight, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.danger, fontWeight: 600, marginBottom: 14 }}>{err}</div>}
        <button onClick={save} style={{ width: "100%", padding: 14, borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 25px rgba(99,102,241,0.4)" }}>Update password 🚀</button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardPage({ session, users, requests, nav }) {
  const myReqs = requests.filter(r => r.userId === session.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const counts = { total: myReqs.length, approved: myReqs.filter(r => r.status === "approved").length, pending: myReqs.filter(r => r.status === "pending").length, rejected: myReqs.filter(r => r.status === "rejected").length };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greetEmoji = hour < 12 ? "☀️" : hour < 17 ? "👋" : "🌙";
  const pendingApprovals = (session.role === "manager" || session.role === "admin") ? requests.filter(r => r.managerId === session.id && r.status === "pending") : [];

  return (
    <div>
      <div style={{ background: G.indigo, borderRadius: 24, padding: "32px 36px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative", flexWrap: "wrap" }}>
          <Avatar user={session} size={64} />
          <div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 4px", fontWeight: 600 }}>{greeting} {greetEmoji}</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.04em" }}>{session.name.split(" ")[0]}</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>{session.profile?.jobTitle || session.role}{session.profile?.department ? ` · ${session.profile.department}` : ""}</p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => nav("request")} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✈️ Request Leave</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[{ label: "Total Requests", val: counts.total, icon: "📊", g: G.indigo, sub: "all time" }, { label: "Approved", val: counts.approved, icon: "✅", g: G.emerald, sub: "successful" }, { label: "Pending", val: counts.pending, icon: "⏳", g: G.amber, sub: "awaiting" }, { label: "Rejected", val: counts.rejected, icon: "❌", g: G.pink, sub: "declined" }].map(s => (
          <div key={s.label} style={{ background: C.card, borderRadius: 18, padding: 20, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.g, borderRadius: "18px 18px 0 0" }} />
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 12 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontWeight: 500 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>📅 Recent Requests</h3>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{myReqs.length} total</span>
          </div>
          {myReqs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}><div style={{ fontSize: 36, marginBottom: 10 }}>🏖️</div><p style={{ color: C.muted, fontSize: 14, margin: 0, fontWeight: 600 }}>No requests yet</p><p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>Time to plan a vacay?</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myReqs.slice(0, 4).map(r => {
                const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
                return <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: C.bg }}><span style={{ fontSize: 22 }}>{LEAVE_EMOJI[r.type] || "📋"}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.type}</div><div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{r.startDate} · {days}d</div></div><StatusChip status={r.status} /></div>;
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          {pendingApprovals.length > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>📋 Needs Your Review</h3>
                <span style={{ background: "#FEE2E2", color: "#7F1D1D", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 100 }}>{pendingApprovals.length} pending</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingApprovals.slice(0, 4).map(r => {
                  const emp = users.find(u => u.id === r.userId);
                  const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
                  return <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: C.bg }}><Avatar user={emp} size={30} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{emp?.name?.split(" ")[0]}</div><div style={{ fontSize: 11, color: C.muted }}>{r.type} · {days}d</div></div><StatusChip status={r.status} /></div>;
                })}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 18px" }}>🌟 Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["✈️", "Take some time off", "request", C.indigo], ["👤", "Update your profile", "profile", C.violet]].map(([icon, text, id, color]) => (
                  <button key={id} onClick={() => nav(id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: C.bg, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{text}</span>
                    <span style={{ marginLeft: "auto", color: C.muted }}>→</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Request Leave ────────────────────────────────────────────────────────────
function RequestPage({ session, users, slackWebhook, notify }) {
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const manager = users.find(u => u.id === session.manager);
  const days = start && end && new Date(end) >= new Date(start) ? Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1 : 0;

  const submit = async () => {
    if (!start || !end) return notify("Pick your dates first! 📅", "error");
    if (new Date(end) < new Date(start)) return notify("End date can't be before start 😅", "error");
    setBusy(true);
    const id = Date.now().toString();
    const req = { id, userId: session.id, userEmail: session.email, userName: session.name, type, startDate: start, endDate: end, reason, status: "pending", createdAt: new Date().toISOString(), managerId: session.manager || null, managerEmail: manager?.email || null, managerName: manager?.name || null };
    await setDoc(doc(db, "requests", id), req);

    // Slack notification + email
    await callApi("notify", { type: "new_request", request: req, managerName: manager?.name, days });
    notify(`Request sent! ${manager ? `${manager.name} will review it ✉️` : "Awaiting assignment."}`);
    setStart(""); setEnd(""); setReason(""); setType(LEAVE_TYPES[0]);
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.04em" }}>Request Leave ✈️</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: 0, fontWeight: 500 }}>{manager ? `Goes to ${manager.name} for approval` : "Submit your leave"}</p>
      </div>
      <GlassCard style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Leave Type</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {LEAVE_TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${type === t ? C.indigo : C.border}`, background: type === t ? C.indigoLight : C.bg, color: type === t ? C.indigoDark : C.muted, fontWeight: type === t ? 800 : 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
              <span style={{ fontSize: 20 }}>{LEAVE_EMOJI[t]}</span><span>{t}</span>
            </button>
          ))}
        </div>
      </GlassCard>
      <GlassCard style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Inp label="Start Date" icon="🗓" type="date" value={start} onChange={e => setStart(e.target.value)} />
          <Inp label="End Date" icon="🗓" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        {days > 0 && <div style={{ background: C.indigoLight, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 20 }}>📊</span><span style={{ fontSize: 14, fontWeight: 700, color: C.indigoDark }}>{days} day{days !== 1 ? "s" : ""} of leave</span></div>}
      </GlassCard>
      <GlassCard style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>💬 Reason (optional)</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Give your manager some context… or not, no pressure 😊" style={{ ...inputSt, resize: "vertical" }} />
      </GlassCard>
      <button onClick={submit} disabled={busy} style={{ width: "100%", padding: "15px", borderRadius: 16, background: busy ? "#ccc" : G.indigo, color: "#fff", border: "none", fontSize: 16, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: busy ? "none" : "0 8px 25px rgba(99,102,241,0.4)" }}>
        {busy ? "Submitting… 🚀" : `Submit Request ${LEAVE_EMOJI[type]}`}
      </button>
    </div>
  );
}

// ─── Approvals ────────────────────────────────────────────────────────────────
function ApprovalsPage({ session, users, requests, notify }) {
  const [filter, setFilter] = useState("all");
  const reqs = requests.filter(r => r.managerId === session.id && (filter === "all" || r.status === filter)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const decide = async (id, decision) => {
    const r = requests.find(r => r.id === id);
    const emp = users.find(u => u.id === r?.userId);
    await updateDoc(doc(db, "requests", id), { status: decision });
    await callApi("notify", { type: "decision", decision, request: r, employeeName: emp?.name, employeeEmail: emp?.email, managerName: session.name });
    notify(decision === "approved" ? `Approved! ${emp?.name?.split(" ")[0]} will be notified 🎉` : `Declined. ${emp?.name?.split(" ")[0]} has been notified.`);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div><h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.04em" }}>Approvals 📋</h2><p style={{ color: C.muted, fontSize: 14, margin: 0, fontWeight: 500 }}>Your team's leave requests</p></div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 14px", borderRadius: 10, border: `1.5px solid ${filter === f ? C.indigo : C.border}`, background: filter === f ? C.indigoLight : "transparent", color: filter === f ? C.indigoDark : C.muted, fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{f}</button>
          ))}
        </div>
      </div>
      {reqs.length === 0 ? (
        <GlassCard style={{ textAlign: "center", padding: "60px 24px" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div><p style={{ fontWeight: 800, fontSize: 16, color: C.text, margin: "0 0 6px" }}>All clear!</p><p style={{ color: C.muted, fontSize: 14, margin: 0 }}>No requests to review.</p></GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reqs.map(r => {
            const emp = users.find(u => u.id === r.userId);
            const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
            return (
              <GlassCard key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <Avatar user={emp} size={46} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{emp?.name}</span><StatusChip status={r.status} /></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{LEAVE_EMOJI[r.type]} {r.type}</span>
                    <span style={{ color: C.border }}>·</span>
                    <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{r.startDate} → {r.endDate}</span>
                    <span style={{ background: C.indigoLight, color: C.indigoDark, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 100 }}>{days}d</span>
                  </div>
                  {r.reason && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontStyle: "italic" }}>"{r.reason}"</div>}
                </div>
                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => decide(r.id, "approved")} style={{ padding: "9px 18px", borderRadius: 10, background: G.emerald, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✅ Approve</button>
                    <button onClick={() => decide(r.id, "rejected")} style={{ padding: "9px 18px", borderRadius: 10, background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}33`, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>❌ Reject</button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── All Requests ─────────────────────────────────────────────────────────────
function AllRequestsPage({ users, requests, notify }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const reqs = requests.filter(r => (filter === "all" || r.status === filter) && (!search || r.userName?.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const decide = async (id, decision) => {
    const r = requests.find(r => r.id === id);
    const emp = users.find(u => u.id === r?.userId);
    await updateDoc(doc(db, "requests", id), { status: decision });
    await callApi("notify", { type: "decision", decision, request: r, employeeName: emp?.name, employeeEmail: emp?.email, managerName: "Admin" });
    notify(`Request ${decision} ✓`);
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}><h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.04em" }}>All Requests 🗂️</h2><p style={{ color: C.muted, fontSize: 14, margin: 0, fontWeight: 500 }}>Full team leave overview</p></div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name or type…" style={{ ...inputSt, width: 260, marginBottom: 0 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${filter === f ? C.indigo : C.border}`, background: filter === f ? C.indigoLight : "transparent", color: filter === f ? C.indigoDark : C.muted, fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{f}</button>
          ))}
        </div>
      </div>
      {reqs.length === 0 ? <GlassCard style={{ textAlign: "center", padding: "50px 24px" }}><div style={{ fontSize: 40, marginBottom: 10 }}>📭</div><p style={{ fontWeight: 700, color: C.text, margin: 0 }}>No requests found</p></GlassCard> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reqs.map(r => {
            const emp = users.find(u => u.id === r.userId);
            const mgr = users.find(u => u.id === r.managerId);
            const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
            return (
              <GlassCard key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 20px" }}>
                <Avatar user={emp} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{emp?.name}</span>{mgr && <span style={{ fontSize: 11, color: C.muted }}>→ {mgr.name}</span>}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontWeight: 500 }}>{LEAVE_EMOJI[r.type]} {r.type} · {r.startDate} → {r.endDate} · {days}d</div>
                </div>
                <StatusChip status={r.status} />
                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => decide(r.id, "approved")} style={{ padding: "7px 14px", borderRadius: 8, background: G.emerald, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✅</button>
                    <button onClick={() => decide(r.id, "rejected")} style={{ padding: "7px 14px", borderRadius: 8, background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}33`, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>❌</button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────
function AdminPage({ users, requests, settings, notify }) {
  const [tab, setTab] = useState("users");
  const [f, setF] = useState({ name: "", email: "", role: "member", manager: "" });
  const [slack, setSlack] = useState(settings.slackWebhook || SLACK_WEBHOOK);
  const managers = users.filter(u => u.role === "manager" || u.role === "admin");

  const addUser = async () => {
    if (!f.name || !f.email) return notify("Name + email required 🙏", "error");
    if (users.find(u => u.email === f.email)) return notify("Email already exists 👀", "error");
    const pass = "Welcome@" + Math.floor(1000 + Math.random() * 9000);
    const id = Date.now().toString();
    const newUser = { id, name: f.name, email: f.email, password: pass, role: f.role, manager: f.manager || null, mustChangePassword: true, profile: {} };
    await setDoc(doc(db, "users", id), newUser);
    await callApi("notify", { type: "invite", userName: f.name, userEmail: f.email, tempPassword: pass });
    notify(`${f.name} added! Invite email sent 📧`);
    setF({ name: "", email: "", role: "member", manager: "" });
  };

  const removeUser = async (id) => {
    if (id === "admin-main") return notify("Can't remove the primary admin 🚫", "error");
    await deleteDoc(doc(db, "users", id));
    notify("Member removed.");
  };

  const saveSlack = async () => {
    await setDoc(doc(db, "settings", "main"), { slackWebhook: slack }, { merge: true });
    notify("Slack webhook saved! 💬");
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}><h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.04em" }}>Admin ⚙️</h2><p style={{ color: C.muted, fontSize: 14, margin: 0, fontWeight: 500 }}>Manage your team and integrations</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[{ label: "Team Members", val: users.length, icon: "👥", g: G.indigo }, { label: "Total Requests", val: requests.length, icon: "📊", g: G.cyan }, { label: "Pending", val: requests.filter(r => r.status === "pending").length, icon: "⏳", g: G.amber }].map(s => (
          <div key={s.label} style={{ background: C.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: s.g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</div>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: "-0.04em" }}>{s.val}</div><div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{s.label}</div></div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["users", "👥", "Team"], ["add", "➕", "Add Member"], ["slack", "💬", "Slack"]].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: "10px 20px", borderRadius: 12, border: `2px solid ${tab === key ? C.indigo : C.border}`, background: tab === key ? C.indigoLight : "transparent", color: tab === key ? C.indigoDark : C.muted, fontWeight: tab === key ? 800 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</button>
        ))}
      </div>

      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map(u => (
            <GlassCard key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
              <Avatar user={u} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{u.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 100, background: u.role === "admin" ? G.indigo : u.role === "manager" ? G.emerald : C.bg, color: u.role === "admin" || u.role === "manager" ? "#fff" : C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{u.role}</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{u.email}{u.profile?.department ? ` · ${u.profile.department}` : ""}</div>
                {u.manager && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Reports to {users.find(m => m.id === u.manager)?.name}</div>}
              </div>
              {u.mustChangePassword && <span style={{ fontSize: 11, background: "#FEF3C7", color: "#92400E", padding: "3px 10px", borderRadius: 100, fontWeight: 700 }}>⚡ Must reset pw</span>}
              {u.id !== "admin-main" && <button onClick={() => removeUser(u.id)} style={{ padding: "7px 14px", borderRadius: 10, background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}22`, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
            </GlassCard>
          ))}
        </div>
      )}

      {tab === "add" && (
        <GlassCard style={{ maxWidth: 500 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 20px" }}>➕ New Team Member</h3>
          <Inp label="Full Name" icon="👤" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Jane Smith" />
          <Inp label="Work Email" icon="📧" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="jane@indexed.com" />
          <Sel label="Role" icon="🎯" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
            <option value="member">Member</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Sel>
          <Sel label="Assign Manager" icon="👔" value={f.manager} onChange={e => setF({ ...f, manager: e.target.value })}>
            <option value="">No manager</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Sel>
          <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B33", borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#92400E", fontWeight: 600 }}>📧 An invite email with login details will be sent automatically.</div>
          <button onClick={addUser} style={{ width: "100%", padding: 14, borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 25px rgba(99,102,241,0.35)" }}>Add Member & Send Invite 🚀</button>
        </GlassCard>
      )}

      {tab === "slack" && (
        <GlassCard style={{ maxWidth: 540 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>💬 Slack Integration</h3>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Notifications fire automatically for new requests, approvals and rejections.</p>
          <Inp label="Webhook URL" icon="🔗" value={slack} onChange={e => setSlack(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
          <button onClick={saveSlack} style={{ width: "100%", padding: 14, borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Save Webhook 💬</button>
          {settings.slackWebhook && <div style={{ marginTop: 16, background: "#D1FAE5", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#064E3B", textAlign: "center" }}>✅ Slack is connected!</div>}
        </GlassCard>
      )}
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function ProfilePage({ session, users, requests, setSession, notify }) {
  const saved = session.profile || {};
  const [p, setP] = useState({ photo: saved.photo || "", firstName: session.name.split(" ")[0] || "", lastName: session.name.split(" ").slice(1).join(" ") || "", birthdate: saved.birthdate || "", mobile: saved.mobile || "", city: saved.city || "", country: saved.country || "", jobTitle: saved.jobTitle || "", department: saved.department || "", emergencyName: saved.emergencyName || "", emergencyRelation: saved.emergencyRelation || "", emergencyPhone: saved.emergencyPhone || "", bio: saved.bio || "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState(""), [nxt, setNxt] = useState(""), [conf, setConf] = useState(""), [pwErr, setPwErr] = useState("");
  const fileRef = useRef();
  const myRequests = requests.filter(r => r.userId === session.id);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setP(prev => ({ ...prev, photo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const fullName = `${p.firstName} ${p.lastName}`.trim() || session.name;
    await updateDoc(doc(db, "users", session.id), { name: fullName, profile: p });
    const updated = { ...session, name: fullName, profile: p };
    setSession(updated);
    sessionStorage.setItem("lms_session", JSON.stringify(updated));
    notify("Profile saved! Looking fresh 🔥");
  };

  const changePw = async () => {
    if (cur !== session.password) return setPwErr("Current password is wrong 👀");
    if (nxt.length < 6) return setPwErr("Min 6 characters!");
    if (nxt !== conf) return setPwErr("Passwords don't match 😅");
    await updateDoc(doc(db, "users", session.id), { password: nxt });
    const updated = { ...session, password: nxt };
    setSession(updated);
    sessionStorage.setItem("lms_session", JSON.stringify(updated));
    notify("Password updated! 🔐"); setCur(""); setNxt(""); setConf(""); setPwErr(""); setPwOpen(false);
  };

  const previewUser = { ...session, name: `${p.firstName} ${p.lastName}`.trim() || session.name, profile: p };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ background: G.indigo, borderRadius: 24, padding: "36px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, position: "relative", flexWrap: "wrap" }}>
          <div style={{ position: "relative", cursor: "pointer", flexShrink: 0 }} onClick={() => fileRef.current.click()}>
            <Avatar user={previewUser} size={86} />
            <div style={{ position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: "50%", background: C.indigo, border: "3px solid rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>📷</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.04em" }}>{previewUser.name}</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "0 0 12px" }}>{p.jobTitle || session.role}{p.department ? ` · ${p.department}` : ""}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.city && <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100 }}>📍 {p.city}{p.country ? `, ${p.country}` : ""}</span>}
              {p.mobile && <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100 }}>📱 {p.mobile}</span>}
              <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100 }}>📊 {myRequests.filter(r => r.status === "approved").length} leaves taken</span>
            </div>
          </div>
          <button onClick={() => setPwOpen(!pwOpen)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔐 {pwOpen ? "Cancel" : "Change password"}</button>
        </div>
      </div>

      {pwOpen && (
        <GlassCard style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>🔐 Change Password</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["Current", cur, setCur], ["New", nxt, setNxt], ["Confirm", conf, setConf]].map(([lbl, val, set]) => (
              <div key={lbl}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{lbl}</label><input type="password" value={val} onChange={e => set(e.target.value)} style={inputSt} /></div>
            ))}
          </div>
          {pwErr && <div style={{ color: C.danger, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{pwErr}</div>}
          <Btn onClick={changePw} size="sm">Update password 🔐</Btn>
        </GlassCard>
      )}

      <GlassCard style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px", paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>👤 Personal Information</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[["firstName", "First Name", "Jane", "text"], ["lastName", "Last Name", "Smith", "text"], ["birthdate", "Date of Birth", "", "date"], ["mobile", "Mobile", "+44 7700 000000", "text"], ["city", "City", "London", "text"], ["country", "Country", "United Kingdom", "text"]].map(([key, label, ph, type]) => (
            <div key={key}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label><input type={type} value={p[key]} onChange={e => setP(prev => ({ ...prev, [key]: e.target.value }))} placeholder={ph} style={inputSt} /></div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Bio</label><textarea value={p.bio} onChange={e => setP(prev => ({ ...prev, bio: e.target.value }))} rows={2} placeholder="A little about you… 🌟" style={{ ...inputSt, resize: "vertical" }} /></div>
      </GlassCard>

      <GlassCard style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px", paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>💼 Work Details</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Job Title</label><input value={p.jobTitle} onChange={e => setP(prev => ({ ...prev, jobTitle: e.target.value }))} placeholder="Product Designer" style={inputSt} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Department</label><input value={p.department} onChange={e => setP(prev => ({ ...prev, department: e.target.value }))} placeholder="Design" style={inputSt} /></div>
        </div>
      </GlassCard>

      <GlassCard style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>🆘 Emergency Contact</p>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Only visible to admins and managers.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[["emergencyName", "Name", "John Smith"], ["emergencyRelation", "Relationship", "Spouse"], ["emergencyPhone", "Phone", "+44 7700 000001"]].map(([key, label, ph]) => (
            <div key={key}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label><input value={p[key]} onChange={e => setP(prev => ({ ...prev, [key]: e.target.value }))} placeholder={ph} style={inputSt} /></div>
          ))}
        </div>
      </GlassCard>

      <button onClick={save} style={{ padding: "14px 36px", borderRadius: 16, background: G.indigo, color: "#fff", border: "none", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 25px rgba(99,102,241,0.4)" }}>Save Profile 🔥</button>
    </div>
  );
}
