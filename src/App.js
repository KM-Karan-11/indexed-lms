import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, getDoc } from "firebase/firestore";

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

const LEAVE_TYPES = ["Personal Leave", "Sick Leave", "Unpaid Leave", "Others"];
const LEAVE_EMOJI = { "Personal Leave": "🌴", "Sick Leave": "🤒", "Unpaid Leave": "💸", "Others": "✨" };

const SEED_USERS = [
  { id: "admin-main", name: "Admin", email: "admin@joinindexed.com", password: "Admin@2024", role: "admin", manager: null, mustChangePassword: false, profile: {} },
];

const C = {
  dark: "#0B0F1A", bg: "#F0F3FF", card: "#FFFFFF", border: "rgba(99,102,241,0.13)",
  indigo: "#6366F1", indigoLight: "#EEF2FF", indigoDark: "#4338CA",
  violet: "#8B5CF6", cyan: "#06B6D4", pink: "#EC4899", emerald: "#10B981", amber: "#F59E0B",
  text: "#0F172A", muted: "#64748B", danger: "#EF4444", dangerLight: "#FEF2F2",
};
const G = {
  indigo: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  cyan: "linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)",
  pink: "linear-gradient(135deg, #EC4899 0%, #F97316 100%)",
  emerald: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
  amber: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  mesh: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 50%)",
};

// ─── Global CSS with full mobile support ─────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
  @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .pc { animation: fadeIn 0.25s ease; }
  input:focus, select:focus, textarea:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); outline: none; }
  button:hover { opacity: 0.88; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 10px; }

  /* ── Mobile bottom nav ── */
  .mobile-nav { display: none; }
  .desktop-sidebar { display: flex; }

  /* ── Stat grid ── */
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .analytics-filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .emergency-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .change-pw-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .leave-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .date-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .main-content { flex: 1; padding: 32px 36px; overflow: auto; }
  .hero-content { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .admin-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }

  @media (max-width: 768px) {
    .desktop-sidebar { display: none !important; }
    .mobile-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: #0B0F1A; border-top: 1px solid rgba(255,255,255,0.08); z-index: 200; padding: 8px 0 max(8px, env(safe-area-inset-bottom)); justify-content: space-around; }
    .mobile-nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 12px; background: none; border: none; cursor: pointer; font-family: inherit; min-width: 48px; }
    .mobile-nav-icon { font-size: 20px; line-height: 1; }
    .mobile-nav-label { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.04em; }
    .mobile-nav-btn.active .mobile-nav-label { color: #6366F1; }
    .mobile-nav-btn.active .mobile-nav-icon { filter: brightness(1.5); }

    .main-content { padding: 16px 16px 90px 16px; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .two-col { grid-template-columns: 1fr; }
    .analytics-filters { grid-template-columns: 1fr 1fr; }
    .profile-fields { grid-template-columns: 1fr; }
    .emergency-fields { grid-template-columns: 1fr; }
    .change-pw-grid { grid-template-columns: 1fr; }
    .leave-type-grid { grid-template-columns: 1fr 1fr; }
    .date-grid { grid-template-columns: 1fr 1fr; }
    .admin-stats { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .hero-content { gap: 12px; }
    .hero-actions { margin-left: 0 !important; width: 100%; }
    .hero-actions button { width: 100%; }
    .login-split { flex-direction: column !important; }
    .login-left { min-height: 280px; padding: 40px 24px !important; }
    .login-right { width: 100% !important; padding: 32px 24px !important; }
    .modal-inner { width: 92vw !important; padding: 24px !important; }
    .holiday-date-grid { grid-template-columns: 1fr !important; }
    .approvals-filter { flex-wrap: wrap; gap: 4px; }
    .approvals-filter button { font-size: 11px; padding: 5px 10px; }
    .card-actions { flex-direction: column; gap: 6px; }
    .card-row { flex-wrap: wrap; }
  }

  @media (max-width: 480px) {
    .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .admin-stats { grid-template-columns: 1fr; }
    .analytics-filters { grid-template-columns: 1fr; }
  }
`;

async function callApi(endpoint, body) {
  try {
    const res = await fetch(`/api/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch { return false; }
}

// ─── Primitives ───────────────────────────────────────────────────────────
const Avatar = ({ user, size = 36 }) => {
  if (user?.profile?.photo) return <img src={user.profile.photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(99,102,241,0.3)" }} />;
  const name = user?.name || "?";
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const grads = [G.indigo, G.cyan, G.pink, G.emerald, G.amber];
  return <div style={{ width: size, height: size, borderRadius: "50%", background: grads[name.charCodeAt(0) % grads.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.35, color: "#fff", flexShrink: 0 }}>{initials}</div>;
};

const StatusChip = ({ status }) => {
  const map = {
    pending: ["#FEF3C7", "#92400E", "⏳ Pending"],
    approved: ["#D1FAE5", "#064E3B", "✅ Approved"],
    rejected: ["#FEE2E2", "#7F1D1D", "❌ Rejected"],
    cancelled: ["#F1F5F9", "#475569", "🚫 Cancelled"],
  };
  const [bg, color, label] = map[status] || map.pending;
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, whiteSpace: "nowrap" }}>{label}</span>;
};

const inputSt = { width: "100%", padding: "11px 15px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: "#F8FAFF", fontSize: 14, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

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
  return <button {...props} style={{ padding: sz[size], borderRadius: 12, fontWeight: 700, fontSize: size === "sm" ? 12 : 14, cursor: "pointer", fontFamily: "inherit", ...vs[variant], ...(props.disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}), ...props.style }}>{children}</button>;
};

const GlassCard = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 24, ...(onClick ? { cursor: "pointer" } : {}), ...style }}>{children}</div>
);

const Toast = ({ toast }) => {
  if (!toast) return null;
  return <div style={{ position: "fixed", bottom: 80, right: 16, zIndex: 9999, background: toast.type === "error" ? C.danger : C.dark, color: "#fff", padding: "14px 20px", borderRadius: 16, fontWeight: 700, fontSize: 14, maxWidth: "calc(100vw - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 10, animation: "slideUp 0.3s ease" }}><span>{toast.type === "error" ? "⚠️" : "🎉"}</span>{toast.msg}</div>;
};

const Modal = ({ children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)", padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal-inner" style={{ background: C.card, borderRadius: 24, padding: 36, width: 480, maxWidth: "100%", boxShadow: "0 30px 80px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}>
      {children}
    </div>
  </div>
);

const LeaveDetailModal = ({ r, users, session, onClose, onCancel, onDecide }) => {
  if (!r) return null;
  const emp = users.find(u => u.id === r.userId);
  const mgr = users.find(u => u.id === r.managerId);
  const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
  const today = new Date().toISOString().split("T")[0];
  const canCancel = r.status !== "cancelled" && r.status !== "rejected" && r.endDate >= today;
  const isAdmin = session.role === "admin";
  const isOwner = session.id === r.userId;
  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <span style={{ fontSize: 36 }}>{LEAVE_EMOJI[r.type] || "📋"}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: 0 }}>{r.type}</h3>
          <p style={{ fontSize: 13, color: C.muted, margin: "3px 0 0" }}>{r.startDate} → {r.endDate} · {days}d</p>
        </div>
        <StatusChip status={r.status} />
      </div>
      <div style={{ background: C.bg, borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
        {[["👤 Employee", emp?.name || "—"], ["👔 Manager", mgr?.name || "Unassigned"], ["📅 Start", r.startDate], ["📅 End", r.endDate], ["⏱ Duration", `${days} day${days !== 1 ? "s" : ""}`], ["📋 Status", r.status], ...(r.reason ? [["💬 Reason", r.reason]] : []), ["🕐 Submitted", new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })]].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <span style={{ color: C.muted, fontWeight: 600 }}>{label}</span>
            <span style={{ color: C.text, fontWeight: 700, textAlign: "right", maxWidth: "60%" }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onDecide && r.status === "pending" && (isAdmin || session.id === r.managerId) && (
          <>
            <button onClick={() => { onDecide(r.id, "approved"); onClose(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, background: G.emerald, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minWidth: 100 }}>✅ Approve</button>
            <button onClick={() => { onDecide(r.id, "rejected"); onClose(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}33`, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minWidth: 100 }}>❌ Reject</button>
          </>
        )}
        {canCancel && (isOwner || isAdmin) && (
          <button onClick={() => { onCancel(r.id, r); onClose(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "#F1F5F9", color: "#475569", border: "1.5px solid #CBD5E1", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minWidth: 100 }}>🚫 Cancel</button>
        )}
        <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 12, background: C.bg, color: C.muted, border: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minWidth: 80 }}>Close</button>
      </div>
    </Modal>
  );
};

// ─── Nav config ───────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⚡", roles: ["admin", "manager", "member"] },
  { id: "request", label: "Request", icon: "✈️", roles: ["admin", "manager", "member"] },
  { id: "approvals", label: "Approvals", icon: "📋", roles: ["admin", "manager"] },
  { id: "all_requests", label: "All Requests", icon: "🗂️", roles: ["admin"] },
  { id: "analytics", label: "Analytics", icon: "📊", roles: ["admin"] },
  { id: "holidays", label: "Holidays", icon: "🎉", roles: ["admin", "manager", "member"] },
  { id: "admin", label: "Admin", icon: "⚙️", roles: ["admin"] },
  { id: "profile", label: "Profile", icon: "👤", roles: ["admin", "manager", "member"] },
];

// Mobile nav shows only the most important items
const MOBILE_NAV = [
  { id: "dashboard", label: "Home", icon: "⚡" },
  { id: "request", label: "Request", icon: "✈️" },
  { id: "approvals", label: "Approvals", icon: "📋" },
  { id: "holidays", label: "Holidays", icon: "🎉" },
  { id: "profile", label: "Profile", icon: "👤" },
];

const Sidebar = ({ session, page, nav, logout }) => {
  const items = NAV.filter(i => i.roles.includes(session.role));
  return (
    <div className="desktop-sidebar" style={{ width: 240, minHeight: "100vh", background: C.dark, flexDirection: "column", flexShrink: 0, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.2) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: G.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 20 }}>🌴</span></div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#fff", letterSpacing: "-0.04em" }}>Indexed</div>
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
          return <button key={item.id} onClick={() => nav(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: active ? "rgba(99,102,241,0.2)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: active ? 700 : 500, textAlign: "left", marginBottom: 2, borderLeft: active ? `3px solid ${C.indigo}` : "3px solid transparent" }}><span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>{item.label}</button>;
        })}
      </nav>
      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={logout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>🚪 Sign out</button>
      </div>
    </div>
  );
};

const MobileNav = ({ session, page, nav }) => {
  const visibleItems = MOBILE_NAV.filter(i => {
    const navItem = NAV.find(n => n.id === i.id);
    return navItem?.roles.includes(session.role);
  });
  return (
    <div className="mobile-nav">
      {visibleItems.map(item => (
        <button key={item.id} className={`mobile-nav-btn${page === item.id ? " active" : ""}`} onClick={() => nav(item.id)}>
          <span className="mobile-nav-icon">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

// ─── Mobile header ────────────────────────────────────────────────────────
const MobileHeader = ({ session, nav }) => (
  <div style={{ display: "none" }} className="mobile-header">
    <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: G.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 16 }}>🌴</span></div>
        <span style={{ fontWeight: 900, fontSize: 16, color: C.text, letterSpacing: "-0.04em" }}>Indexed LMS</span>
      </div>
      <button onClick={() => nav("profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <Avatar user={session} size={32} />
      </button>
    </div>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────
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

  useEffect(() => {
    const seed = async () => {
      for (const u of SEED_USERS) {
        const snap = await getDoc(doc(db, "users", u.id));
        if (!snap.exists()) await setDoc(doc(db, "users", u.id), u);
      }
    };
    seed();
  }, []);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "users"), s => { setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const u2 = onSnapshot(collection(db, "requests"), s => setRequests(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(doc(db, "settings", "main"), s => { if (s.exists()) setSettings(s.data()); });
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    if (session && users.length > 0) {
      const fresh = users.find(u => u.id === session.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(session)) {
        setSession(fresh); sessionStorage.setItem("lms_session", JSON.stringify(fresh));
      }
    }
  }, [users]);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const login = () => {
    const user = users.find(u => u.email === loginEmail && u.password === loginPass);
    if (!user) return setLoginError("Wrong email or password 👀");
    setLoginError(""); setSession(user); sessionStorage.setItem("lms_session", JSON.stringify(user));
    setPage(user.mustChangePassword ? "changepass" : "dashboard");
  };

  const forgotPassword = async () => {
    if (!loginEmail) return setLoginError("Enter your email above first 👆");
    const user = users.find(u => u.email === loginEmail);
    if (!user) return setLoginError("No account found with that email.");
    const tempPass = "Reset@" + Math.floor(1000 + Math.random() * 9000);
    await updateDoc(doc(db, "users", user.id), { password: tempPass, mustChangePassword: true });
    await callApi("notify", { type: "forgot", userName: user.name, userEmail: user.email, tempPassword: tempPass });
    setLoginError(""); setLoginPass(""); notify("Reset sent to your Slack & email 📧");
  };

  const logout = () => { setSession(null); sessionStorage.removeItem("lms_session"); setPage("dashboard"); setLoginEmail(""); setLoginPass(""); };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 16, animation: "spin 2s linear infinite" }}>🌴</div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading Indexed LMS…</div></div>
    </div>
  );

  if (!session) return <LoginPage email={loginEmail} setEmail={setLoginEmail} pass={loginPass} setPass={setLoginPass} error={loginError} onLogin={login} onForgot={forgotPassword} />;
  if (page === "changepass") return <ChangePassPage session={session} setSession={setSession} setPage={setPage} notify={notify} />;

  const live = users.find(u => u.id === session.id) || session;
  const shared = { session: live, users, requests, settings, notify, nav: setPage };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
      <style>{GLOBAL_CSS}</style>
      <Toast toast={toast} />
      <Sidebar session={live} page={page} nav={setPage} logout={logout} />
      <main className="main-content" style={{ background: `${G.mesh}, ${C.bg}` }}>
        {/* Mobile top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }} className="mobile-only-flex">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: G.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 14 }}>🌴</span></div>
            <span style={{ fontWeight: 900, fontSize: 15, color: C.text }}>Indexed LMS</span>
          </div>
          <button onClick={() => setPage("profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Avatar user={live} size={30} /></button>
        </div>
        <div className="pc" key={page}>
          {page === "dashboard" && <DashboardPage {...shared} />}
          {page === "request" && <RequestPage {...shared} />}
          {page === "approvals" && <ApprovalsPage {...shared} />}
          {page === "all_requests" && live.role === "admin" && <AllRequestsPage {...shared} />}
          {page === "analytics" && live.role === "admin" && <AnalyticsPage {...shared} />}
          {page === "holidays" && <HolidaysPage {...shared} />}
          {page === "admin" && live.role === "admin" && <AdminPage {...shared} />}
          {page === "profile" && <ProfilePage {...shared} setSession={setSession} logout={logout} />}
        </div>
      </main>
      <MobileNav session={live} page={page} nav={setPage} />
    </div>
  );
}

// Add this to CSS so mobile top bar only shows on mobile
const mobileOnlyStyle = `
  .mobile-only-flex { display: none !important; }
  @media (max-width: 768px) { .mobile-only-flex { display: flex !important; } }
`;

function LoginPage({ email, setEmail, pass, setPass, error, onLogin, onForgot }) {
  return (
    <div style={{ minHeight: "100vh", background: C.dark, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{GLOBAL_CSS + mobileOnlyStyle}</style>
      <div className="login-split" style={{ display: "flex", minHeight: "100vh" }}>
        <div className="login-left" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, background: "radial-gradient(ellipse at 30% 40%, rgba(99,102,241,0.25) 0%, transparent 60%)" }}>
          <div style={{ textAlign: "center", animation: "fadeIn 0.6s ease" }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: G.indigo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 20px 60px rgba(99,102,241,0.5)", animation: "float 4s ease-in-out infinite" }}><span style={{ fontSize: 36 }}>🌴</span></div>
            <h1 style={{ fontSize: 38, fontWeight: 900, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.05em", lineHeight: 1.1 }}>Indexed<br /><span style={{ background: "linear-gradient(135deg,#a5b4fc,#c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LMS</span></h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, margin: "0 0 36px" }}>Leave Management System · by Indexed</p>
            {[["✈️","Request leave instantly"],["📋","Slack approvals"],["💬","OOO auto-set"],["📊","Analytics"]].map(([i,t]) => (
              <div key={t} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, padding: "7px 14px", margin: "3px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}><span>{i}</span>{t}</div>
            ))}
          </div>
        </div>
        <div className="login-right" style={{ width: 420, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <div style={{ width: "100%", animation: "fadeIn 0.5s ease 0.1s both" }}>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Welcome back 👋</p>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 28px", letterSpacing: "-0.04em" }}>Sign in to LMS</h2>
            <Inp label="Work email" icon="📧" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@joinindexed.com" onKeyDown={e => e.key === "Enter" && onLogin()} />
            <Inp label="Password" icon="🔒" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && onLogin()} />
            {error && <div style={{ background: C.dangerLight, border: `1px solid ${C.danger}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>}
            <button onClick={onLogin} style={{ width: "100%", padding: 14, borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 25px rgba(99,102,241,0.4)", marginBottom: 12 }}>Sign in →</button>
            <button onClick={onForgot} style={{ width: "100%", padding: 11, borderRadius: 14, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Forgot password? 🔑</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePassPage({ session, setSession, setPage, notify }) {
  const [cur, setCur] = useState(""), [nxt, setNxt] = useState(""), [conf, setConf] = useState(""), [err, setErr] = useState("");
  const save = async () => {
    if (cur !== session.password) return setErr("Current password is wrong 👀");
    if (nxt.length < 6) return setErr("Min 6 characters!");
    if (nxt !== conf) return setErr("Passwords don't match 😅");
    await updateDoc(doc(db, "users", session.id), { password: nxt, mustChangePassword: false });
    const u = { ...session, password: nxt, mustChangePassword: false };
    setSession(u); sessionStorage.setItem("lms_session", JSON.stringify(u));
    notify("Password updated! 🎉"); setPage("dashboard");
  };
  return (
    <div style={{ minHeight: "100vh", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", padding: 16 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Set your password</h2>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>First time? Let's get you set up.</p>
        <Inp label="Current Password" type="password" value={cur} onChange={e => setCur(e.target.value)} />
        <Inp label="New Password" type="password" value={nxt} onChange={e => setNxt(e.target.value)} />
        <Inp label="Confirm" type="password" value={conf} onChange={e => setConf(e.target.value)} />
        {err && <div style={{ background: C.dangerLight, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.danger, fontWeight: 600, marginBottom: 14 }}>{err}</div>}
        <button onClick={save} style={{ width: "100%", padding: 14, borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Update password 🚀</button>
      </div>
    </div>
  );
}

function DashboardPage({ session, users, requests, notify, nav }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const my = requests.filter(r => r.userId === session.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const counts = { total: my.length, approved: my.filter(r => r.status === "approved").length, pending: my.filter(r => r.status === "pending").length, rejected: my.filter(r => r.status === "rejected").length };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greetEmoji = hour < 12 ? "☀️" : hour < 17 ? "👋" : "🌙";
  const pendingApprovals = (session.role === "manager" || session.role === "admin") ? requests.filter(r => r.managerId === session.id && r.status === "pending") : [];
  const today = new Date().toISOString().split("T")[0];
  const outToday = requests.filter(r => r.status === "approved" && r.startDate <= today && r.endDate >= today);

  const cancelLeave = async (id) => {
    if (!window.confirm("Cancel this leave?")) return;
    await updateDoc(doc(db, "requests", id), { status: "cancelled" });
    notify("Leave cancelled 🚫");
  };

  const decide = async (id, decision) => {
    const r = requests.find(r => r.id === id);
    const emp = users.find(u => u.id === r?.userId);
    await updateDoc(doc(db, "requests", id), { status: decision });
    await callApi("notify", { type: "decision", decision, request: r, employeeName: emp?.name, employeeEmail: emp?.email, managerName: session.name });
    notify(decision === "approved" ? "Approved! 🎉" : "Declined.");
  };

  return (
    <div>
      {selectedRequest && <LeaveDetailModal r={selectedRequest} users={users} session={session} onClose={() => setSelectedRequest(null)} onCancel={cancelLeave} onDecide={decide} />}

      {/* Hero */}
      <div style={{ background: G.indigo, borderRadius: 20, padding: "24px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div className="hero-content">
          <Avatar user={session} size={56} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "0 0 3px", fontWeight: 600 }}>{greeting} {greetEmoji}</p>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.03em" }}>{session.name.split(" ")[0]}</h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>{session.profile?.jobTitle || session.role}{session.profile?.department ? ` · ${session.profile.department}` : ""}</p>
          </div>
          <div className="hero-actions" style={{ marginLeft: "auto" }}>
            <button onClick={() => nav("request")} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "9px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✈️ Request Leave</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[{ label: "Total", val: counts.total, icon: "📊", g: G.indigo }, { label: "Approved", val: counts.approved, icon: "✅", g: G.emerald }, { label: "Pending", val: counts.pending, icon: "⏳", g: G.amber }, { label: "Rejected", val: counts.rejected, icon: "❌", g: G.pink }].map(s => (
          <div key={s.label} onClick={() => nav("all_requests")} style={{ background: C.card, borderRadius: 16, padding: "16px", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden", cursor: "pointer" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.g, borderRadius: "16px 16px 0 0" }} />
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        {/* My requests */}
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>📅 My Requests</h3>
            <button onClick={() => nav("request")} style={{ fontSize: 12, color: C.indigo, fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>+ New</button>
          </div>
          {my.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏖️</div>
              <p style={{ color: C.muted, fontSize: 13, margin: "0 0 12px" }}>No requests yet</p>
              <button onClick={() => nav("request")} style={{ padding: "8px 16px", borderRadius: 10, background: G.indigo, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Request leave ✈️</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {my.slice(0, 4).map(r => {
                const d = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
                const canCancel = r.status !== "cancelled" && r.status !== "rejected" && r.endDate >= today;
                return (
                  <div key={r.id} onClick={() => setSelectedRequest(r)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: C.bg, cursor: "pointer" }}>
                    <span style={{ fontSize: 18 }}>{LEAVE_EMOJI[r.type] || "📋"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.type}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{r.startDate} · {d}d</div>
                    </div>
                    <StatusChip status={r.status} />
                    {canCancel && <button onClick={e => { e.stopPropagation(); cancelLeave(r.id); }} style={{ fontSize: 11, color: "#475569", background: "#F1F5F9", border: "none", borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>🚫</button>}
                  </div>
                );
              })}
              {my.length > 4 && <button onClick={() => nav("all_requests")} style={{ fontSize: 12, color: C.indigo, fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>View all {my.length} →</button>}
            </div>
          )}
        </GlassCard>

        {/* Approvals / Quick actions */}
        <GlassCard>
          {pendingApprovals.length > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>📋 Needs Review</h3>
                <span style={{ background: "#FEE2E2", color: "#7F1D1D", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 100 }}>{pendingApprovals.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {pendingApprovals.slice(0, 4).map(r => {
                  const emp = users.find(u => u.id === r.userId);
                  const d = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
                  return (
                    <div key={r.id} onClick={() => setSelectedRequest(r)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10, background: C.bg, cursor: "pointer" }}>
                      <Avatar user={emp} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{emp?.name?.split(" ")[0]}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{r.type.split(" ")[0]} · {d}d</div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => decide(r.id, "approved")} style={{ padding: "4px 9px", borderRadius: 7, background: G.emerald, color: "#fff", border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✅</button>
                        <button onClick={() => decide(r.id, "rejected")} style={{ padding: "4px 9px", borderRadius: 7, background: C.dangerLight, color: C.danger, border: `1px solid ${C.danger}33`, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>❌</button>
                      </div>
                    </div>
                  );
                })}
                {pendingApprovals.length > 4 && <button onClick={() => nav("approvals")} style={{ fontSize: 12, color: C.indigo, fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>View all {pendingApprovals.length} →</button>}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>🌟 Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[["✈️","Request leave","request",C.indigo],["📊","Analytics","analytics",C.emerald],["🎉","Holidays","holidays",C.violet],["👤","My profile","profile",C.cyan]].filter(([,,id]) => id !== "analytics" || session.role === "admin").map(([icon,text,id,color]) => (
                  <button key={id} onClick={() => nav(id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: C.bg, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{text}</span>
                    <span style={{ marginLeft: "auto", color: C.muted, fontSize: 14 }}>→</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      </div>

      {outToday.length > 0 && (
        <GlassCard>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>🏖️ Out Today</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {outToday.map(r => { const emp = users.find(u => u.id === r.userId); return <div key={r.id} onClick={() => setSelectedRequest(r)} style={{ display: "flex", alignItems: "center", gap: 7, background: C.bg, padding: "7px 12px", borderRadius: 100, cursor: "pointer" }}><Avatar user={emp} size={22} /><span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{emp?.name?.split(" ")[0]}</span><span style={{ fontSize: 11 }}>{LEAVE_EMOJI[r.type]}</span></div>; })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function RequestPage({ session, users, notify }) {
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const manager = users.find(u => u.id === session.manager);
  const days = start && end && new Date(end) >= new Date(start) ? Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1 : 0;

  const submit = async () => {
    if (!start || !end) return notify("Pick your dates! 📅", "error");
    if (new Date(end) < new Date(start)) return notify("End before start 😅", "error");
    setBusy(true);
    const id = Date.now().toString();
    const req = { id, userId: session.id, userEmail: session.email, userName: session.name, type, startDate: start, endDate: end, reason, status: "pending", createdAt: new Date().toISOString(), managerId: session.manager || null, managerEmail: manager?.email || null, managerName: manager?.name || null };
    await setDoc(doc(db, "requests", id), req);
    await callApi("notify", { type: "new_request", request: req, managerName: manager?.name, days });
    notify(`Request sent! ${manager ? `${manager.name} will review it ✉️` : ""}`);
    setStart(""); setEnd(""); setReason(""); setType(LEAVE_TYPES[0]); setBusy(false);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.03em" }}>Request Leave ✈️</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>{manager ? `Goes to ${manager.name} for approval` : "Submit your leave"}</p>
      </div>
      <GlassCard style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Leave Type</p>
        <div className="leave-type-grid">
          {LEAVE_TYPES.map(t => <button key={t} onClick={() => setType(t)} style={{ padding: "12px 14px", borderRadius: 12, border: `2px solid ${type === t ? C.indigo : C.border}`, background: type === t ? C.indigoLight : C.bg, color: type === t ? C.indigoDark : C.muted, fontWeight: type === t ? 800 : 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 18 }}>{LEAVE_EMOJI[t]}</span><span>{t}</span></button>)}
        </div>
      </GlassCard>
      <GlassCard style={{ marginBottom: 14 }}>
        <div className="date-grid">
          <Inp label="Start Date" icon="🗓" type="date" value={start} onChange={e => setStart(e.target.value)} />
          <Inp label="End Date" icon="🗓" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        {days > 0 && <div style={{ background: C.indigoLight, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>📊</span><span style={{ fontSize: 13, fontWeight: 700, color: C.indigoDark }}>{days} day{days !== 1 ? "s" : ""} of leave</span></div>}
      </GlassCard>
      <GlassCard style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>💬 Reason (optional)</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Give your manager some context… 😊" style={{ ...inputSt, resize: "vertical" }} />
      </GlassCard>
      <button onClick={submit} disabled={busy} style={{ width: "100%", padding: 14, borderRadius: 14, background: busy ? "#ccc" : G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: busy ? "none" : "0 8px 25px rgba(99,102,241,0.4)" }}>
        {busy ? "Submitting… 🚀" : `Submit ${LEAVE_EMOJI[type]}`}
      </button>
    </div>
  );
}

function ApprovalsPage({ session, users, requests, notify }) {
  const [filter, setFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const reqs = requests.filter(r => r.managerId === session.id && (filter === "all" || r.status === filter)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const decide = async (id, decision) => {
    const r = requests.find(r => r.id === id);
    const emp = users.find(u => u.id === r?.userId);
    await updateDoc(doc(db, "requests", id), { status: decision });
    await callApi("notify", { type: "decision", decision, request: r, employeeName: emp?.name, employeeEmail: emp?.email, managerName: session.name });
    notify(decision === "approved" ? "Approved! OOO set 🌴" : "Declined.");
  };

  const cancelLeave = async (id) => {
    if (!window.confirm("Cancel this leave?")) return;
    await updateDoc(doc(db, "requests", id), { status: "cancelled" });
    notify("Cancelled 🚫");
  };

  return (
    <div>
      {selectedRequest && <LeaveDetailModal r={selectedRequest} users={users} session={session} onClose={() => setSelectedRequest(null)} onCancel={cancelLeave} onDecide={decide} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div><h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 2px", letterSpacing: "-0.03em" }}>Approvals 📋</h2><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Your team's requests</p></div>
        <div className="approvals-filter" style={{ display: "flex", gap: 6 }}>
          {["all","pending","approved","rejected","cancelled"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 12px", borderRadius: 10, border: `1.5px solid ${filter === f ? C.indigo : C.border}`, background: filter === f ? C.indigoLight : "transparent", color: filter === f ? C.indigoDark : C.muted, fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{f}</button>)}
        </div>
      </div>
      {reqs.length === 0
        ? <GlassCard style={{ textAlign: "center", padding: "48px 24px" }}><div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div><p style={{ fontWeight: 800, fontSize: 15, color: C.text, margin: 0 }}>All clear!</p></GlassCard>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reqs.map(r => {
            const emp = users.find(u => u.id === r.userId);
            const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
            const today = new Date().toISOString().split("T")[0];
            const canCancel = r.status !== "cancelled" && r.status !== "rejected" && r.endDate >= today;
            return (
              <GlassCard key={r.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRequest(r)}>
                <div className="card-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar user={emp} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}><span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{emp?.name}</span><StatusChip status={r.status} /></div>
                    <div style={{ fontSize: 12, color: C.muted }}>{LEAVE_EMOJI[r.type]} {r.type} · {r.startDate} → {r.endDate} · {days}d</div>
                    {r.reason && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: "italic" }}>"{r.reason}"</div>}
                  </div>
                  <div className="card-actions" style={{ display: "flex", gap: 7 }} onClick={e => e.stopPropagation()}>
                    {r.status === "pending" && <>
                      <button onClick={() => decide(r.id, "approved")} style={{ padding: "8px 14px", borderRadius: 9, background: G.emerald, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✅ Approve</button>
                      <button onClick={() => decide(r.id, "rejected")} style={{ padding: "8px 14px", borderRadius: 9, background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}33`, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>❌ Reject</button>
                    </>}
                    {canCancel && <button onClick={() => cancelLeave(r.id)} style={{ padding: "8px 12px", borderRadius: 9, background: "#F1F5F9", color: "#475569", border: "1.5px solid #CBD5E1", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🚫</button>}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      }
    </div>
  );
}

function AllRequestsPage({ session, users, requests, notify }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const reqs = requests.filter(r => (filter === "all" || r.status === filter) && (!search || r.userName?.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const decide = async (id, decision) => {
    const r = requests.find(r => r.id === id);
    const emp = users.find(u => u.id === r?.userId);
    await updateDoc(doc(db, "requests", id), { status: decision });
    await callApi("notify", { type: "decision", decision, request: r, employeeName: emp?.name, employeeEmail: emp?.email, managerName: "Admin" });
    notify(`Request ${decision} ✓`);
  };

  const cancelLeave = async (id, r) => {
    if (!window.confirm("Cancel this leave?")) return;
    await updateDoc(doc(db, "requests", id), { status: "cancelled" });
    const emp = users.find(u => u.id === r?.userId);
    await callApi("notify", { type: "decision", decision: "cancelled", request: r, employeeName: emp?.name, employeeEmail: emp?.email, managerName: "Admin" });
    notify("Cancelled and employee notified 🚫");
  };

  return (
    <div>
      {selectedRequest && <LeaveDetailModal r={selectedRequest} users={users} session={session} onClose={() => setSelectedRequest(null)} onCancel={cancelLeave} onDecide={decide} />}
      <div style={{ marginBottom: 20 }}><h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.03em" }}>All Requests 🗂️</h2><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Click any row to view or cancel</p></div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ ...inputSt, width: 200, marginBottom: 0 }} />
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["all","pending","approved","rejected","cancelled"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${filter === f ? C.indigo : C.border}`, background: filter === f ? C.indigoLight : "transparent", color: filter === f ? C.indigoDark : C.muted, fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{f}</button>)}
        </div>
      </div>
      {reqs.length === 0 ? <GlassCard style={{ textAlign: "center", padding: "40px 24px" }}><div style={{ fontSize: 36, marginBottom: 8 }}>📭</div><p style={{ fontWeight: 700, color: C.text, margin: 0 }}>No requests found</p></GlassCard> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reqs.map(r => {
            const emp = users.find(u => u.id === r.userId);
            const mgr = users.find(u => u.id === r.managerId);
            const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
            const today = new Date().toISOString().split("T")[0];
            const canCancel = r.status !== "cancelled" && r.status !== "rejected" && r.endDate >= today;
            return (
              <GlassCard key={r.id} style={{ padding: "14px 18px", cursor: "pointer" }} onClick={() => setSelectedRequest(r)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Avatar user={emp} size={36} />
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{emp?.name}</span>{mgr && <span style={{ fontSize: 11, color: C.muted }}>→ {mgr.name}</span>}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{LEAVE_EMOJI[r.type]} {r.type} · {r.startDate} → {r.endDate} · {days}d</div>
                  </div>
                  <StatusChip status={r.status} />
                  <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                    {r.status === "pending" && <>
                      <button onClick={() => decide(r.id, "approved")} style={{ padding: "6px 12px", borderRadius: 7, background: G.emerald, color: "#fff", border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✅</button>
                      <button onClick={() => decide(r.id, "rejected")} style={{ padding: "6px 12px", borderRadius: 7, background: C.dangerLight, color: C.danger, border: `1.5px solid ${C.danger}33`, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>❌</button>
                    </>}
                    {canCancel && <button onClick={() => cancelLeave(r.id, r)} style={{ padding: "6px 10px", borderRadius: 7, background: "#F1F5F9", color: "#475569", border: "1.5px solid #CBD5E1", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🚫</button>}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalyticsPage({ users, requests }) {
  const [userFilter, setUserFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const now = new Date();
  const periodStart = { this_week: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), this_month: new Date(now.getFullYear(), now.getMonth(), 1), last_month: new Date(now.getFullYear(), now.getMonth() - 1, 1), this_quarter: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), this_year: new Date(now.getFullYear(), 0, 1) };

  const filtered = requests.filter(r => {
    if (userFilter !== "all" && r.userId !== userFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const rDate = new Date(r.startDate);
    if (period === "custom") { if (dateFrom && rDate < new Date(dateFrom)) return false; if (dateTo && rDate > new Date(dateTo)) return false; }
    else if (periodStart[period] && rDate < periodStart[period]) return false;
    return true;
  }).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  const totalDays = filtered.filter(r => r.status === "approved").reduce((s, r) => s + Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1, 0);
  const perPerson = users.map(u => { const uReqs = filtered.filter(r => r.userId === u.id); const days = uReqs.filter(r => r.status === "approved").reduce((s, r) => s + Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1, 0); return { user: u, requests: uReqs.length, days }; }).filter(p => p.requests > 0).sort((a, b) => b.days - a.days);
  const perType = LEAVE_TYPES.map(t => ({ type: t, count: filtered.filter(r => r.type === t).length, days: filtered.filter(r => r.type === t && r.status === "approved").reduce((s, r) => s + Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1, 0) })).filter(t => t.count > 0);
  const maxDays = Math.max(...perPerson.map(p => p.days), 1);
  const maxTypeDays = Math.max(...perType.map(t => t.days), 1);
  const fakeSession = { role: "admin", id: "admin" };
  const cancelLeave = async (id) => { if (!window.confirm("Cancel this leave?")) return; await updateDoc(doc(db, "requests", id), { status: "cancelled" }); };

  return (
    <div>
      {selectedRequest && <LeaveDetailModal r={selectedRequest} users={users} session={fakeSession} onClose={() => setSelectedRequest(null)} onCancel={cancelLeave} />}
      <div style={{ marginBottom: 20 }}><h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.03em" }}>Analytics 📊</h2><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Filter and analyse leave data</p></div>

      <GlassCard style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>🔍 Filters</p>
        <div className="analytics-filters">
          <Sel label="Member" value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ marginBottom: 0 }}><option value="all">All members</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Sel>
          <Sel label="Type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ marginBottom: 0 }}><option value="all">All types</option>{LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}</Sel>
          <Sel label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ marginBottom: 0 }}><option value="all">All</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></Sel>
          <Sel label="Period" value={period} onChange={e => setPeriod(e.target.value)} style={{ marginBottom: 0 }}><option value="all">All time</option><option value="this_week">This week</option><option value="this_month">This month</option><option value="last_month">Last month</option><option value="this_quarter">This quarter</option><option value="this_year">This year</option><option value="custom">Custom</option></Sel>
        </div>
        {period === "custom" && <div className="date-grid" style={{ marginTop: 10 }}><Inp label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ marginBottom: 0 }} /><Inp label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ marginBottom: 0 }} /></div>}
      </GlassCard>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[{ label: "Requests", val: filtered.length, icon: "📋", g: G.indigo }, { label: "Approved", val: filtered.filter(r => r.status === "approved").length, icon: "✅", g: G.emerald }, { label: "Days Taken", val: totalDays, icon: "📅", g: G.cyan }, { label: "Pending", val: filtered.filter(r => r.status === "pending").length, icon: "⏳", g: G.amber }].map(s => (
          <div key={s.label} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.g, borderRadius: "14px 14px 0 0" }} />
            <div style={{ width: 32, height: 32, borderRadius: 9, background: s.g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <GlassCard>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>👥 Days by Person</h3>
          {perPerson.length === 0 ? <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>No data</p> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{perPerson.map(p => (<div key={p.user.id}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><Avatar user={p.user} size={24} /><span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1 }}>{p.user.name.split(" ")[0]}</span><span style={{ fontSize: 11, color: C.muted }}>{p.days}d</span></div><div style={{ height: 5, background: C.bg, borderRadius: 100 }}><div style={{ height: "100%", width: `${(p.days / maxDays) * 100}%`, background: G.indigo, borderRadius: 100 }} /></div></div>))}</div>}
        </GlassCard>
        <GlassCard>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>🏷️ Days by Type</h3>
          {perType.length === 0 ? <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>No data</p> : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{perType.map((t, i) => (<div key={t.type}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><span style={{ fontSize: 16 }}>{LEAVE_EMOJI[t.type]}</span><span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1 }}>{t.type.split(" ")[0]}</span><span style={{ fontSize: 11, color: C.muted }}>{t.days}d · {t.count}</span></div><div style={{ height: 5, background: C.bg, borderRadius: 100 }}><div style={{ height: "100%", width: `${(t.days / maxTypeDays) * 100}%`, background: [G.indigo, G.emerald, G.amber, G.pink][i % 4], borderRadius: 100 }} /></div></div>))}</div>}
        </GlassCard>
      </div>

      <GlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>📋 Records</h3>
          <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} total</span>
        </div>
        {filtered.length === 0 ? <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No records</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Employee","Type","Start","End","Days","Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(r => {
                  const emp = users.find(u => u.id === r.userId);
                  const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1;
                  return <tr key={r.id} onClick={() => setSelectedRequest(r)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.indigoLight} onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "8px 10px" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar user={emp} size={22} /><span style={{ fontWeight: 600 }}>{emp?.name?.split(" ")[0] || "—"}</span></div></td>
                    <td style={{ padding: "8px 10px", color: C.text }}>{LEAVE_EMOJI[r.type]} {r.type.split(" ")[0]}</td>
                    <td style={{ padding: "8px 10px", color: C.muted }}>{r.startDate}</td>
                    <td style={{ padding: "8px 10px", color: C.muted }}>{r.endDate}</td>
                    <td style={{ padding: "8px 10px" }}><span style={{ background: C.indigoLight, color: C.indigoDark, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>{days}d</span></td>
                    <td style={{ padding: "8px 10px" }}><StatusChip status={r.status} /></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function HolidaysPage({ session, settings, notify }) {
  const isAdmin = session.role === "admin";
  const [holidays, setHolidays] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ date: "", name: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { try { setHolidays(JSON.parse(settings.holidays || "[]")); } catch { setHolidays([]); } }, [settings.holidays]);

  const saveToDb = async (updated) => { setSaving(true); await setDoc(doc(db, "settings", "main"), { holidays: JSON.stringify(updated) }, { merge: true }); setSaving(false); };

  const getDayName = (d) => { if (!d) return ""; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" }); };
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = sorted.reduce((acc, h) => { const m = h.date.substring(0, 7); if (!acc[m]) acc[m] = []; acc[m].push(h); return acc; }, {});
  const today = new Date().toISOString().split("T")[0];
  const nextHoliday = sorted.find(h => h.date >= today);

  const addHoliday = async () => {
    if (!form.date || !form.name.trim()) return notify("Date and name required", "error");
    let updated;
    if (editId && holidays.find(h => h.id === editId)) {
      updated = holidays.map(h => h.id === editId ? { ...h, date: form.date, name: form.name.trim() } : h);
      notify("Holiday updated ✅");
    } else {
      updated = [...holidays, { id: Date.now().toString(), date: form.date, name: form.name.trim() }];
      notify("Holiday added 🎉");
    }
    setHolidays(updated); await saveToDb(updated);
    setForm({ date: "", name: "" }); setAdding(false); setEditId(null);
  };

  const deleteHoliday = async (id) => {
    if (!window.confirm("Remove this holiday?")) return;
    const updated = holidays.filter(h => h.id !== id);
    setHolidays(updated); await saveToDb(updated); notify("Removed");
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div><h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.03em" }}>Holidays 🎉</h2><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{holidays.length} holiday{holidays.length !== 1 ? "s" : ""}{isAdmin ? " · click to edit" : ""}</p></div>
        {isAdmin && <button onClick={() => { setAdding(true); setEditId(null); setForm({ date: "", name: "" }); }} style={{ padding: "9px 18px", borderRadius: 11, background: G.indigo, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Add Holiday</button>}
      </div>

      {adding && isAdmin && (
        <GlassCard style={{ marginBottom: 16, border: `2px solid ${C.indigo}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>{editId ? "✏️ Edit" : "➕ New"} Holiday</h3>
          <div className="holiday-date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.07em", textTransform: "uppercase" }}>📅 Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputSt} />
              {form.date && <p style={{ fontSize: 12, color: C.indigo, fontWeight: 600, marginTop: 5 }}>{getDayName(form.date)}</p>}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 7, letterSpacing: "0.07em", textTransform: "uppercase" }}>🎉 Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Christmas Day" style={inputSt} onKeyDown={e => e.key === "Enter" && addHoliday()} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={addHoliday} disabled={saving} style={{ flex: 1, padding: "11px", borderRadius: 11, background: G.indigo, color: "#fff", border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving…" : editId ? "Update" : "Add Holiday"}</button>
            <button onClick={() => { setAdding(false); setEditId(null); setForm({ date: "", name: "" }); }} style={{ flex: 1, padding: "11px", borderRadius: 11, background: C.bg, color: C.muted, border: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </GlassCard>
      )}

      {nextHoliday && (
        <div style={{ background: G.indigo, borderRadius: 16, padding: "18px 22px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 32 }}>🎊</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Next Holiday</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#fff", margin: "0 0 2px" }}>{nextHoliday.name}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: 0 }}>{getDayName(nextHoliday.date)}, {new Date(nextHoliday.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{Math.ceil((new Date(nextHoliday.date) - new Date(today)) / 86400000)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>days away</div>
          </div>
        </div>
      )}

      {holidays.length === 0 ? (
        <GlassCard style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
          <p style={{ fontWeight: 800, fontSize: 15, color: C.text, margin: "0 0 6px" }}>No holidays yet</p>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{isAdmin ? "Add your first holiday above." : "Ask an admin to add holidays."}</p>
        </GlassCard>
      ) : (
        <GlassCard style={{ padding: 0, overflow: "hidden" }}>
          {Object.entries(byMonth).map(([month, hs]) => (
            <div key={month}>
              <div style={{ padding: "10px 20px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
              </div>
              {hs.map((h, i) => {
                const isPast = h.date < today;
                const isToday = h.date === today;
                return (
                  <div key={h.id} onClick={() => isAdmin && (setForm({ date: h.date, name: h.name }), setEditId(h.id), setAdding(true))} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < hs.length - 1 ? `1px solid ${C.border}` : "none", opacity: isPast ? 0.5 : 1, cursor: isAdmin ? "pointer" : "default", background: isToday ? C.indigoLight : "transparent" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: isToday ? C.indigo : isPast ? "#F1F5F9" : C.indigoLight, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: isToday ? "#fff" : isPast ? C.muted : C.indigoDark, lineHeight: 1 }}>{new Date(h.date + "T00:00:00").getDate()}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? "rgba(255,255,255,0.7)" : isPast ? C.muted : C.indigo, textTransform: "uppercase" }}>{new Date(h.date + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{h.name}</span>
                        {isToday && <span style={{ background: G.indigo, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100 }}>TODAY</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{getDayName(h.date)}</div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setForm({ date: h.date, name: h.name }); setEditId(h.id); setAdding(true); }} style={{ padding: "5px 10px", borderRadius: 7, background: C.indigoLight, color: C.indigoDark, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                        <button onClick={() => deleteHoliday(h.id)} style={{ padding: "5px 10px", borderRadius: 7, background: C.dangerLight, color: C.danger, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

function AdminPage({ users, requests, settings, notify }) {
  const [tab, setTab] = useState("users");
  const [f, setF] = useState({ name: "", email: "", role: "member", manager: "" });
  const [slack, setSlack] = useState(settings.slackWebhook || "");
  const [editing, setEditing] = useState(null);
  const [editF, setEditF] = useState({ role: "member", manager: "" });
  const managers = users.filter(u => u.role === "manager" || u.role === "admin");

  const addUser = async () => {
    if (!f.name || !f.email) return notify("Name + email required 🙏", "error");
    if (users.find(u => u.email === f.email)) return notify("Email already exists 👀", "error");
    const pass = "Welcome@" + Math.floor(1000 + Math.random() * 9000);
    const id = Date.now().toString();
    await setDoc(doc(db, "users", id), { id, name: f.name, email: f.email, password: pass, role: f.role, manager: f.manager || null, mustChangePassword: true, profile: {} });
    await callApi("notify", { type: "invite", userName: f.name, userEmail: f.email, tempPassword: pass });
    notify(`${f.name} added! Invite sent 📧`);
    setF({ name: "", email: "", role: "member", manager: "" });
  };

  const removeUser = async (id) => {
    if (id === "admin-main") return notify("Can't remove the primary admin 🚫", "error");
    await deleteDoc(doc(db, "users", id));
    notify("Member removed.");
  };

  const saveEdit = async () => {
    await updateDoc(doc(db, "users", editing), { role: editF.role, manager: editF.manager || null });
    notify("Updated ✅"); setEditing(null);
  };

  return (
    <div>
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✏️</div>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: "0 0 4px" }}>Edit Member</h3>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 20px" }}>{users.find(u => u.id === editing)?.name}</p>
          <Sel label="Role" value={editF.role} onChange={e => setEditF({ ...editF, role: e.target.value })}><option value="member">Member</option><option value="manager">Manager</option><option value="admin">Admin</option></Sel>
          <Sel label="Manager" value={editF.manager} onChange={e => setEditF({ ...editF, manager: e.target.value })}><option value="">No manager</option>{users.filter(u => u.id !== editing && (u.role === "manager" || u.role === "admin")).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveEdit} style={{ flex: 1, padding: 12, borderRadius: 11, background: G.indigo, color: "#fff", border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
            <button onClick={() => setEditing(null)} style={{ flex: 1, padding: 12, borderRadius: 11, background: C.bg, color: C.muted, border: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </Modal>
      )}

      <div style={{ marginBottom: 20 }}><h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 4px", letterSpacing: "-0.03em" }}>Admin ⚙️</h2><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Manage team and integrations</p></div>

      <div className="admin-stats">
        {[{ label: "Members", val: users.length, icon: "👥", g: G.indigo }, { label: "Requests", val: requests.length, icon: "📊", g: G.cyan }, { label: "Pending", val: requests.filter(r => r.status === "pending").length, icon: "⏳", g: G.amber }].map(s => (
          <div key={s.label} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: s.g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{s.icon}</div>
            <div><div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{s.val}</div><div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
        {[["users","👥","Team"],["add","➕","Add"],["slack","💬","Slack"]].map(([key,icon,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: "9px 16px", borderRadius: 11, border: `2px solid ${tab === key ? C.indigo : C.border}`, background: tab === key ? C.indigoLight : "transparent", color: tab === key ? C.indigoDark : C.muted, fontWeight: tab === key ? 800 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>{icon} {label}</button>
        ))}
      </div>

      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map(u => (
            <GlassCard key={u.id} style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Avatar user={u} size={40} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{u.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 100, background: u.role === "admin" ? G.indigo : u.role === "manager" ? G.emerald : C.bg, color: u.role === "admin" || u.role === "manager" ? "#fff" : C.muted, textTransform: "uppercase" }}>{u.role}</span>
                    {u.mustChangePassword && <span style={{ fontSize: 9, background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 100, fontWeight: 700 }}>⚡ Reset pw</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{u.email}</div>
                  {u.manager && <div style={{ fontSize: 11, color: C.muted }}>→ {users.find(m => m.id === u.manager)?.name}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setEditing(u.id); setEditF({ role: u.role, manager: u.manager || "" }); }} style={{ padding: "6px 12px", borderRadius: 8, background: C.indigoLight, color: C.indigoDark, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
                  {u.id !== "admin-main" && <button onClick={() => removeUser(u.id)} style={{ padding: "6px 12px", borderRadius: 8, background: C.dangerLight, color: C.danger, border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {tab === "add" && (
        <GlassCard style={{ maxWidth: 500 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 18px" }}>➕ New Member</h3>
          <Inp label="Full Name" icon="👤" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Jane Smith" />
          <Inp label="Work Email" icon="📧" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="jane@joinindexed.com" />
          <Sel label="Role" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="member">Member</option><option value="manager">Manager</option><option value="admin">Admin</option></Sel>
          <Sel label="Manager" value={f.manager} onChange={e => setF({ ...f, manager: e.target.value })}><option value="">No manager</option>{managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel>
          <div style={{ background: "#FEF3C7", borderRadius: 11, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400E", fontWeight: 600 }}>📧 Invite sent via Slack DM + email automatically.</div>
          <button onClick={addUser} style={{ width: "100%", padding: 13, borderRadius: 13, background: G.indigo, color: "#fff", border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Add & Send Invite 🚀</button>
        </GlassCard>
      )}

      {tab === "slack" && (
        <GlassCard style={{ maxWidth: 500 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>💬 Slack Integration</h3>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>DMs fire for all events. Approve/reject from Slack.</p>
          <Inp label="Webhook URL" icon="🔗" value={slack} onChange={e => setSlack(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
          <button onClick={async () => { await setDoc(doc(db, "settings", "main"), { slackWebhook: slack }, { merge: true }); notify("Saved! 💬"); }} style={{ width: "100%", padding: 13, borderRadius: 13, background: G.indigo, color: "#fff", border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Save Webhook 💬</button>
          {settings.slackWebhook && <div style={{ marginTop: 14, background: "#D1FAE5", borderRadius: 11, padding: "9px 14px", fontSize: 13, fontWeight: 700, color: "#064E3B", textAlign: "center" }}>✅ Slack connected!</div>}
        </GlassCard>
      )}
    </div>
  );
}

function ProfilePage({ session, requests, setSession, notify, logout }) {
  const saved = session.profile || {};
  const [p, setP] = useState({ photo: saved.photo || "", firstName: session.name.split(" ")[0] || "", lastName: session.name.split(" ").slice(1).join(" ") || "", birthdate: saved.birthdate || "", mobile: saved.mobile || "", city: saved.city || "", country: saved.country || "", jobTitle: saved.jobTitle || "", department: saved.department || "", emergencyName: saved.emergencyName || "", emergencyRelation: saved.emergencyRelation || "", emergencyPhone: saved.emergencyPhone || "", bio: saved.bio || "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState(""), [nxt, setNxt] = useState(""), [conf, setConf] = useState(""), [pwErr, setPwErr] = useState("");
  const fileRef = useRef();
  const myRequests = requests.filter(r => r.userId === session.id);

  const handlePhoto = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = ev => setP(prev => ({ ...prev, photo: ev.target.result })); r.readAsDataURL(file); };

  const save = async () => {
    const fullName = `${p.firstName} ${p.lastName}`.trim() || session.name;
    await updateDoc(doc(db, "users", session.id), { name: fullName, profile: p });
    const u = { ...session, name: fullName, profile: p };
    setSession(u); sessionStorage.setItem("lms_session", JSON.stringify(u));
    notify("Profile saved! 🔥");
  };

  const changePw = async () => {
    if (cur !== session.password) return setPwErr("Current password is wrong 👀");
    if (nxt.length < 6) return setPwErr("Min 6 characters!");
    if (nxt !== conf) return setPwErr("Passwords don't match 😅");
    await updateDoc(doc(db, "users", session.id), { password: nxt });
    const u = { ...session, password: nxt };
    setSession(u); sessionStorage.setItem("lms_session", JSON.stringify(u));
    notify("Password updated! 🔐"); setCur(""); setNxt(""); setConf(""); setPwErr(""); setPwOpen(false);
  };

  const preview = { ...session, name: `${p.firstName} ${p.lastName}`.trim() || session.name, profile: p };

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ background: G.indigo, borderRadius: 20, padding: "28px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, position: "relative", flexWrap: "wrap" }}>
          <div style={{ position: "relative", cursor: "pointer", flexShrink: 0 }} onClick={() => fileRef.current.click()}>
            <Avatar user={preview} size={72} />
            <div style={{ position: "absolute", bottom: 1, right: 1, width: 22, height: 22, borderRadius: "50%", background: C.indigo, border: "2px solid rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>📷</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "0 0 3px" }}>{preview.name}</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 10px" }}>{p.jobTitle || session.role}{p.department ? ` · ${p.department}` : ""}</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {p.city && <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100 }}>📍 {p.city}</span>}
              <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100 }}>📊 {myRequests.filter(r => r.status === "approved").length} leaves</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <button onClick={() => setPwOpen(!pwOpen)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔐 {pwOpen ? "Cancel" : "Change pw"}</button>
            <button onClick={logout} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🚪 Sign out</button>
          </div>
        </div>
      </div>

      {pwOpen && (
        <GlassCard style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>🔐 Change Password</p>
          <div className="change-pw-grid">
            {[["Current", cur, setCur], ["New", nxt, setNxt], ["Confirm", conf, setConf]].map(([l, v, s]) => (
              <div key={l}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</label><input type="password" value={v} onChange={e => s(e.target.value)} style={inputSt} /></div>
            ))}
          </div>
          {pwErr && <div style={{ color: C.danger, fontSize: 12, fontWeight: 600, marginBottom: 8, marginTop: 4 }}>{pwErr}</div>}
          <Btn onClick={changePw} size="sm">Update password 🔐</Btn>
        </GlassCard>
      )}

      <GlassCard style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: "0 0 14px", paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>👤 Personal Information</p>
        <div className="profile-fields">
          {[["firstName","First Name","Jane","text"],["lastName","Last Name","Smith","text"],["birthdate","Date of Birth","","date"],["mobile","Mobile","+44 7700 000000","text"],["city","City","London","text"],["country","Country","United Kingdom","text"]].map(([key,label,ph,type]) => (
            <div key={key}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label><input type={type} value={p[key]} onChange={e => setP(prev => ({ ...prev, [key]: e.target.value }))} placeholder={ph} style={inputSt} /></div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Bio</label><textarea value={p.bio} onChange={e => setP(prev => ({ ...prev, bio: e.target.value }))} rows={2} placeholder="A little about you… 🌟" style={{ ...inputSt, resize: "vertical" }} /></div>
      </GlassCard>

      <GlassCard style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: "0 0 14px", paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>💼 Work Details</p>
        <div className="profile-fields">
          <div><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Job Title</label><input value={p.jobTitle} onChange={e => setP(prev => ({ ...prev, jobTitle: e.target.value }))} placeholder="Product Designer" style={inputSt} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Department</label><input value={p.department} onChange={e => setP(prev => ({ ...prev, department: e.target.value }))} placeholder="Design" style={inputSt} /></div>
        </div>
      </GlassCard>

      <GlassCard style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>🆘 Emergency Contact</p>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Only visible to admins and managers.</p>
        <div className="emergency-fields">
          {[["emergencyName","Name","John Smith"],["emergencyRelation","Relationship","Spouse"],["emergencyPhone","Phone","+44 7700 000001"]].map(([key,label,ph]) => (
            <div key={key}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label><input value={p[key]} onChange={e => setP(prev => ({ ...prev, [key]: e.target.value }))} placeholder={ph} style={inputSt} /></div>
          ))}
        </div>
      </GlassCard>

      <button onClick={save} style={{ width: "100%", padding: "14px", borderRadius: 14, background: G.indigo, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 25px rgba(99,102,241,0.4)" }}>Save Profile 🔥</button>
    </div>
  );
}
