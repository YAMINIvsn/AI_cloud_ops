import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AuthPage({ onAuthSuccess }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body =
        tab === "login"
          ? { email: form.email, password: form.password }
          : {
              first_name: form.firstName,
              last_name: form.lastName,
              email: form.email,
              password: form.password,
            };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");

      localStorage.setItem("token", data.access_token);
      onAuthSuccess?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div>
            <div style={styles.brand}>
              <div style={styles.brandIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#85B7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
                </svg>
              </div>
              <span style={styles.brandName}>CloudOps</span>
            </div>
            <p style={styles.tagline}>Unified cloud infrastructure management across Azure, GCP, and AWS.</p>
            <div style={styles.features}>
              {[
                ["Multi-cloud monitoring", "M3 7h18M3 12h18M3 17h18"],
                ["Cost analytics", "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
                ["Kubernetes & Docker", "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"],
                ["Smart alerting", "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"],
              ].map(([label, path]) => (
                <div key={label} style={styles.feature}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#85B7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={path} />
                  </svg>
                  <span style={styles.featureText}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={styles.copy}>© 2026 CloudOps</p>
        </div>

        {/* Main */}
        <div style={styles.main}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {["login", "signup"].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              >
                {t === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <>
              <h1 style={styles.heading}>Welcome back</h1>
              <p style={styles.sub}>Sign in to your CloudOps workspace</p>
              <Field label="Email">
                <input style={styles.input} type="email" placeholder="you@company.com" value={form.email} onChange={update("email")} />
              </Field>
              <Field label="Password">
                <input style={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={update("password")} />
              </Field>
              <p style={styles.forgot} onClick={() => {}}>Forgot password?</p>
            </>
          ) : (
            <>
              <h1 style={styles.heading}>Create your account</h1>
              <p style={styles.sub}>Start managing your cloud infrastructure</p>
              <div style={styles.row}>
                <Field label="First name">
                  <input style={styles.input} type="text" placeholder="Ada" value={form.firstName} onChange={update("firstName")} />
                </Field>
                <Field label="Last name">
                  <input style={styles.input} type="text" placeholder="Lovelace" value={form.lastName} onChange={update("lastName")} />
                </Field>
              </div>
              <Field label="Work email">
                <input style={styles.input} type="email" placeholder="ada@company.com" value={form.email} onChange={update("email")} />
              </Field>
              <Field label="Password">
                <input style={styles.input} type="password" placeholder="Min. 8 characters" value={form.password} onChange={update("password")} />
              </Field>
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
            {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
          </button>

          <Divider />

          <button style={styles.oauthBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "1rem 0", color: "#888", fontSize: 12 }}>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(0,0,0,0.1)" }} />
      or
      <div style={{ flex: 1, height: "0.5px", background: "rgba(0,0,0,0.1)" }} />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f4f8",
    padding: "2rem",
  },
  card: {
    display: "flex",
    width: "100%",
    maxWidth: 820,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 32px rgba(0,0,0,0.1)",
    background: "#fff",
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: "#0C447C",
    padding: "2rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" },
  brandIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: "rgba(255,255,255,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  brandName: { color: "#fff", fontSize: 15, fontWeight: 500 },
  tagline: { color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.7, marginBottom: "1.5rem" },
  features: { display: "flex", flexDirection: "column", gap: 12 },
  feature: { display: "flex", alignItems: "center", gap: 8 },
  featureText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  copy: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
  main: { flex: 1, padding: "2.5rem 2.5rem", display: "flex", flexDirection: "column", justifyContent: "center" },
  tabs: {
    display: "flex",
    border: "0.5px solid #e0e0e0",
    borderRadius: 8,
    width: "fit-content",
    overflow: "hidden",
    marginBottom: "2rem",
  },
  tab: {
    padding: "7px 20px", fontSize: 13, cursor: "pointer",
    background: "transparent", border: "none", color: "#666",
  },
  tabActive: { background: "#f5f5f5", color: "#111", fontWeight: 500 },
  heading: { fontSize: 20, fontWeight: 500, color: "#111", marginBottom: 4 },
  sub: { fontSize: 13, color: "#666", marginBottom: "1.5rem" },
  label: { display: "block", fontSize: 11, fontWeight: 500, color: "#666", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" },
  input: {
    width: "100%", padding: "8px 12px",
    border: "0.5px solid #ccc", borderRadius: 8,
    fontSize: 14, outline: "none",
    background: "#fff", color: "#111",
    boxSizing: "border-box",
  },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  forgot: { fontSize: 12, color: "#185FA5", cursor: "pointer", textAlign: "right", marginTop: -8, marginBottom: "1rem" },
  error: { fontSize: 13, color: "#A32D2D", background: "#FCEBEB", padding: "8px 12px", borderRadius: 8, marginBottom: "0.5rem" },
  btn: {
    width: "100%", padding: 10,
    background: "#185FA5", color: "#fff",
    border: "none", borderRadius: 8,
    fontSize: 14, fontWeight: 500, cursor: "pointer",
    marginTop: "0.25rem",
  },
  oauthBtn: {
    width: "100%", padding: 9,
    border: "0.5px solid #ccc", borderRadius: 8,
    background: "#fff", color: "#111",
    fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxSizing: "border-box",
  },
};