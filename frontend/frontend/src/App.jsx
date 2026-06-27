import { useState, useEffect, useRef } from "react";
import AuthPage from "./AuthPage";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));

  if (!token) {
    return <AuthPage onAuthSuccess={(data) => setToken(data.access_token)} />;
  }
  return <Dashboard onLogout={() => { localStorage.removeItem("token"); setToken(null); }} />; // your main app
}
import API from "./services/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

// cpuTrend is now built from live metrics — see state below
const COLORS = ["#00ff88", "#f59e0b", "#ef4444"];
const formatINR = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));
const NAV_ITEMS = [
  { id: "spend",     icon: "INR", label: "Spend by Resource"},
  { id: "forecast",  icon: "30", label: "30 Day Forecast"},
  { id: "anomalies", icon: "!", label: "Anomaly Detection"},
  { id: "overview",  icon: "⬡", label: "Overview"     },
  { id: "resources", icon: "◈", label: "Resources"    },
  { id: "costs",     icon: "◎", label: "Cost & FinOps"},
  { id: "security",  icon: "⬟", label: "Security"     },
  { id: "insights",  icon: "◉", label: "AI Insights"  },
  { id: "favourites",icon: "★", label: "Favourites"   },
  { id: "approvals", icon: "✦", label: "Approvals"    },
  { id: "assistant", icon: "◆", label: "AI Assistant" },
];
const SUGGESTED = [
  { label:"Cost trend", prompt:"Show the latest Azure cost trend and explain the main spend changes." },
  { label:"2 day spend", prompt:"Give me a spend analysis for the last 2 days by resource." },
  { label:"Spend by resource", prompt:"Break down Azure spend by resource and highlight the biggest cost drivers." },
  { label:"Security findings", prompt:"List current security findings by severity with recommended fixes." },
  { label:"30 day forecast", prompt:"Create a 30 day cost forecast and call out budget risk." },
  { label:"Anomaly detection", prompt:"Detect cost, security, and operational anomalies in the environment." },
  { label:"Operations", prompt:"Show current operations health and actions that need attention." },
  { label:"Terraform", prompt:"Review Terraform changes, drift, and pending infrastructure actions." },
  { label:"Approvals", prompt:"Show pending approvals and explain which changes are safe to approve." },
  { label:"Start resource", prompt:"Prepare an approval request to start an Azure resource. Ask me which resource if needed." },
  { label:"Stop resource", prompt:"Prepare an approval request to stop an Azure resource. Ask me which resource if needed." },
  { label:"More options", prompt:"Show more CloudOps chat options for cost, security, operations, Terraform, and resource actions." },
];

const CT = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background:"rgba(0,10,20,0.95)", border:"1px solid rgba(0,255,136,0.3)", borderRadius:8, padding:"8px 14px", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>
    <div style={{ color:"#94a3b8", marginBottom:2 }}>{label}</div>
    <div style={{ color:"#00ff88" }}>{payload[0].name}: <strong>{formatINR(payload[0].value)}</strong></div>
  </div>
) : null;

// ── Session persistence ────────────────────────────────────────
const SK = "cloudops_sessions";
const DEFAULT_MSG = { role:"assistant", content:"◆ CloudOps AI initialized. I have access to your live Azure environment. Ask me about resources, costs, security, or deployments." };

function loadSessions() {
  try { const r = localStorage.getItem(SK); if (r) return JSON.parse(r); } catch {}
  return [{ id: 1, label:"Session 1", messages:[DEFAULT_MSG], createdAt: Date.now() }];
}
function saveSessions(s) {
  try { localStorage.setItem(SK, JSON.stringify(s)); } catch {}
}
// ──────────────────────────────────────────────────────────────

function Dashboard({ onLogout }) {
  const [activeNav,     setActiveNav]     = useState("overview");
  const [question,      setQuestion]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [summary,       setSummary]       = useState({});
  const [azureResources,setAzureResources]= useState([]);
  const [costs,         setCosts]         = useState({});
  const [metrics,       setMetrics]       = useState({});
  const [analytics,     setAnalytics]     = useState({});
  const [security,      setSecurity]      = useState({});
  const [insights,      setInsights]      = useState([]);
  const [prediction,    setPrediction]    = useState([]);
  const [analysis,      setAnalysis]      = useState("");
  const [budgetAlerts,  setBudgetAlerts]  = useState({});
  const [approvalCards, setApprovalCards] = useState({});  // keyed by resource name
  const [pendingApprovals, setPendingApprovals] = useState([]); // approval inbox
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [darkMode,      setDarkMode]      = useState(true);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [favourites,    setFavourites]    = useState(() => { try { return JSON.parse(localStorage.getItem("cloudops_favs")||"[]"); } catch { return []; } });
  const [drilldown,     setDrilldown]     = useState(null); // resource name for cost drill-down panel
  const [exportLoading, setExportLoading] = useState(false);
  const [cpuHistory,    setCpuHistory]    = useState([]);
  const cpuHistoryRef = useRef([]);
  const [dataLoading,   setDataLoading]   = useState(true);
  const [sessions,      setSessions]      = useState(loadSessions);
  const [activeSession, setActiveSession] = useState(() => loadSessions()[0].id);
  const chatEndRef = useRef(null);

  const [terminalOpen,    setTerminalOpen]    = useState(false);
  const [terminalHistory, setTerminalHistory] = useState([
    { type: "system", text: "CloudOps CLI Terminal initialized. Type 'help' for available commands." }
  ]);
  const [terminalInput,   setTerminalInput]   = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalHistory, terminalOpen]);

  const handleTerminalSubmit = async (e) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;

    setTerminalHistory(prev => [...prev, { type: "input", text: cmd }]);
    setTerminalInput("");

    if (cmd.toLowerCase() === "clear") {
      setTerminalHistory([]);
      return;
    }

    setTerminalLoading(true);
    try {
      const res = await API.post("/azure/cli-run", { command: cmd });
      setTerminalHistory(prev => [
        ...prev,
        { type: res.data.success ? "output" : "error", text: res.data.output }
      ]);
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || "Failed to execute command";
      setTerminalHistory(prev => [
        ...prev,
        { type: "error", text: `Error: ${errMsg}` }
      ]);
    } finally {
      setTerminalLoading(false);
    }
  };

  const toggleFavourite = (name) => {
    setFavourites(prev => {
      const next = prev.includes(name) ? prev.filter(n=>n!==name) : [...prev, name];
      try { localStorage.setItem("cloudops_favs", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ── Derived session state ──────────────────────────────────────
  const currentSession = sessions.find(s => s.id === activeSession) ?? sessions[0];
  const messages = currentSession?.messages ?? [DEFAULT_MSG];

  const patchMessages = (updater) => {
    setSessions(prev => {
      const next = prev.map(s =>
        s.id === activeSession
          ? { ...s, messages: typeof updater === "function" ? updater(s.messages) : updater }
          : s
      );
      saveSessions(next);
      return next;
    });
  };

  const newSession = () => {
    const id = Date.now();
    setSessions(prev => {
      const next = [...prev, { id, label:`Session ${prev.length+1}`, messages:[DEFAULT_MSG], createdAt:id }];
      saveSessions(next);
      return next;
    });
    setActiveSession(id);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      const safe = next.length ? next : [{ id:Date.now(), label:"Session 1", messages:[DEFAULT_MSG], createdAt:Date.now() }];
      saveSessions(safe);
      if (id === activeSession) setActiveSession(safe[0].id);
      return safe;
    });
  };
  // ──────────────────────────────────────────────────────────────

  // ── Fetchers ──────────────────────────────────────────────────
  const fetchAzureResources = async () => { try { const r = await API.get("/azure/resources"); setAzureResources(r.data.resources ?? []); } catch {} };
  const fetchMetrics        = async () => {
    try {
      const r = await API.get("/azure/metrics");
      setMetrics(r.data);
      // Build a rolling 10-point CPU history from live data
      const now = new Date();
      const label = `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
      cpuHistoryRef.current = [...cpuHistoryRef.current.slice(-9), { time: label, cpu: r.data.cpu_usage || 0 }];
      setCpuHistory([...cpuHistoryRef.current]);
    } catch {}
  };
  const fetchSummary        = async () => { try { const r = await API.get("/azure/summary");   setSummary(r.data);                       } catch {} };
  const fetchCosts          = async () => { try { const r = await API.get("/azure/costs");     setCosts(r.data);                         } catch {} };
  const fetchSecurity       = async () => { try { const r = await API.get("/azure/security");  setSecurity(r.data);                      } catch {} };
  const fetchAnalytics      = async () => { try { const r = await API.get("/azure/analytics"); setAnalytics(r.data);                     } catch {} };
  const fetchInsights       = async () => { try { const r = await API.get("/azure/insights");  setInsights(r.data.insights ?? []);        } catch {} };
  const fetchRootCause      = async () => { try { const r = await API.get("/azure/rootcause"); setAnalysis(r.data.analysis ?? "");        } catch {} };
  const fetchBudgetAlerts   = async () => { try { const r = await API.get("/azure/budget-alerts"); setBudgetAlerts(r.data); } catch {} };
  const fetchPrediction     = async () => {
    try {
      const r = await API.get("/azure/predict"), d = r.data;
      setPrediction(Array.isArray(d) ? d : Array.isArray(d?.prediction) ? d.prediction : []);
    } catch { setPrediction([]); }
  };

  // Fast initial load: only lightweight REST calls, no model call.
  useEffect(() => {
    Promise.all([
      fetchAzureResources(), fetchMetrics(), fetchSummary(),
      fetchCosts(), fetchSecurity(), fetchAnalytics(), fetchBudgetAlerts(),
    ]).finally(() => setDataLoading(false));

    // insights + prediction are quick — load 500ms after paint
    setTimeout(() => { fetchInsights(); fetchPrediction(); }, 500);

    const iv = setInterval(fetchMetrics, 5000);
    return () => clearInterval(iv);
  }, []);

  // Lazy: root cause analysis can take a while, so only load it when AI Insights opens.
  const [rootCauseLoading, setRootCauseLoading] = useState(false);
  const rootCauseFetched = useRef(false);
  useEffect(() => {
    if (activeNav === "insights" && !rootCauseFetched.current) {
      rootCauseFetched.current = true;
      setRootCauseLoading(true);
      fetchRootCause().finally(() => setRootCauseLoading(false));
    }
  }, [activeNav]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  // ──────────────────────────────────────────────────────────────

  const askAI = async () => {
    if (!question.trim() || loading) return;
    const q = question;
    patchMessages(p => [...p, { role:"user", content:q }]);
    setQuestion("");
    setLoading(true);
    try {
      const r = await API.post("/chat", { question: q });
      const resp = r.data.response ?? "No response.";
      // Detect pending approval responses and create approval cards
      if (resp.includes("Pending approval") || resp.includes("Approval Created")) {
        const lines = resp.split("\n");
        const actionLine = lines.find(l => l.includes("Action:"));
        const resourceLine = lines.find(l => l.includes("Resource:"));
        if (actionLine && resourceLine) {
          const action = actionLine.split(":")[1]?.trim().toLowerCase();
          const resource = resourceLine.split(":")[1]?.trim();
          const cardKey = resource + "_" + Date.now();
          setApprovalCards(prev => ({ ...prev, [cardKey]: { action, resource, status: "pending" } }));
          setPendingApprovals(prev => [...prev.filter(a => !(a.resource===resource && a.status==="pending")), { id: cardKey, action, resource, status: "pending", requestedAt: new Date().toLocaleTimeString() }]);
        }
      }
      patchMessages(p => [...p, { role:"assistant", content: resp, isApproval: resp.includes("Pending approval") }]);
    } catch (err) {
      patchMessages(p => [...p, { role:"assistant", content:`❌ Backend error: ${err?.message || "Connection failed."}` }]);
    } finally {
      fetchAzureResources();
      fetchCosts();
      fetchAnalytics();
      setLoading(false);
    }
  };

  const exportReport = async (type) => {
    setExportLoading(true);
    try {
      if (type === "csv") {
        const rows = [
          ["Resource","Type","Location","Status","Cost/mo (INR)"],
          ...spendByResource.map(r=>[r.name,r.type,r.location,r.status,r.cost]),
        ];
        const csv = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], {type:"text/csv"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download="cloudops-spend.csv"; a.click();
      } else if (type === "json") {
        const data = { exported: new Date().toISOString(), monthly_cost: costs.monthly_cost, projected_cost: costs.projected_cost, resources: spendByResource, security: security, forecast: forecast30 };
        const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download="cloudops-report.json"; a.click();
      }
    } finally { setExportLoading(false); }
  };

  // ── Derived chart data ─────────────────────────────────────────
  const costData     = [{ name: "This Month", cost: costs.monthly_cost||0 },{ name:"Projected", cost: costs.projected_cost||0 }];
  const spendByService = analytics.spend_by_service ?? costs.spend_by_service ?? [];
  const securityData = [{ name:"Healthy", value: security.security_score||0 },{ name:"Warnings", value: security.warnings||0 },{ name:"Critical", value: security.critical_alerts||0 }];
  const secScore= security.security_score||0;
  const spendByResource = analytics.spend_by_resource ?? costs.spend_by_resource ?? [];
  const costTrend = analytics.cost_trend ?? costs.cost_trend ?? [];
  const forecast30 = analytics.forecast_30d ?? costs.forecast_30d ?? [];
  const securityFindings = analytics.security_findings ?? security.findings ?? [];
  const anomalies = analytics.anomalies ?? [];
  const operations = analytics.operations ?? [];
  const approvals = analytics.terraform_approvals ?? [];
  const statusColor = (v, w=60, c=80) => v>=c ? "#ef4444" : v>=w ? "#f59e0b" : "#00ff88";
  const searchResults = searchQuery.trim().length < 2 ? [] : [
    ...spendByResource.filter(r=>r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(r=>({type:"resource",label:r.name,sub:`${r.type} · ${formatINR(r.cost)}/mo`,nav:"spend"})),
    ...securityFindings.filter(f=>f.title?.toLowerCase().includes(searchQuery.toLowerCase())).map(f=>({type:"security",label:f.title,sub:`${f.severity} severity`,nav:"security"})),
    ...(anomalies||[]).filter(a=>a.signal?.toLowerCase().includes(searchQuery.toLowerCase())).map(a=>({type:"anomaly",label:a.signal,sub:a.detail,nav:"anomalies"})),
  ].slice(0,8);
  // ──────────────────────────────────────────────────────────────

  // ── Shared card style ─────────────────────────────────────────
  const card = (extra={}) => ({
    background:"rgba(255,255,255,0.02)",
    border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:12, padding:22, ...extra
  });
  const label12 = { fontSize:12, color:"#94a3b8", letterSpacing:"0.08em", marginBottom:14 };
  // ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display:"flex", height:"100vh", background: darkMode?"#020817":"#f0f4f8", color: darkMode?"#e2e8f0":"#1e293b", fontFamily:"'JetBrains Mono','Fira Code',monospace", overflow:"hidden", position:"relative" }}>

      {/* ── SEARCH OVERLAY ───────────────────────────────────── */}
      {searchOpen && (
        <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(2,8,23,0.82)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80 }}
          onClick={e=>{ if(e.target===e.currentTarget) setSearchOpen(false); }}>
          <div style={{ width:560,background:"#0d1829",border:"1px solid rgba(0,255,136,0.25)",borderRadius:14,overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,0.7)" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize:18,color:"#475569" }}>⌕</span>
              <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Escape") { setSearchOpen(false); setSearchQuery(""); } }}
                placeholder="Search resources, costs, security findings..."
                style={{ flex:1,background:"none",border:"none",outline:"none",color:"#e2e8f0",fontSize:13,fontFamily:"inherit" }} />
              <button onClick={()=>{setSearchOpen(false);setSearchQuery("");}} style={{ background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:16,fontFamily:"inherit" }}>✕</button>
            </div>
            {searchQuery.trim().length >= 2 && (
              <div style={{ maxHeight:380,overflowY:"auto" }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding:"24px 18px",fontSize:12,color:"#475569",textAlign:"center" }}>No results for "{searchQuery}"</div>
                ) : searchResults.map((r,i)=>(
                  <button key={i} onClick={()=>{ setActiveNav(r.nav); setSearchOpen(false); setSearchQuery(""); if(r.type==="resource") setDrilldown(r.label); }}
                    style={{ width:"100%",textAlign:"left",padding:"12px 18px",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",fontFamily:"inherit",
                      display:"flex",alignItems:"center",gap:12 }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(0,255,136,0.06)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{ fontSize:10,padding:"3px 8px",borderRadius:4,background:r.type==="resource"?"rgba(245,158,11,0.12)":r.type==="security"?"rgba(239,68,68,0.12)":"rgba(14,165,233,0.12)",color:r.type==="resource"?"#f59e0b":r.type==="security"?"#ef4444":"#0ea5e9",fontWeight:700,letterSpacing:"0.06em" }}>{r.type.toUpperCase()}</span>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.label}</div>
                      <div style={{ fontSize:10,color:"#475569",marginTop:2 }}>{r.sub}</div>
                    </div>
                    <span style={{ fontSize:10,color:"#334155" }}>↗</span>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim().length < 2 && (
              <div style={{ padding:"18px",display:"flex",gap:8,flexWrap:"wrap" }}>
                {["resources","costs","security","anomalies"].map(nav=>(
                  <button key={nav} onClick={()=>{ setActiveNav(nav); setSearchOpen(false); setSearchQuery(""); }}
                    style={{ padding:"6px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,color:"#64748b",fontSize:11,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize" }}>
                    {nav}
                  </button>
                ))}
                <div style={{ width:"100%",fontSize:10,color:"#334155",marginTop:4 }}>Type at least 2 characters to search</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COST DRILL-DOWN PANEL ────────────────────────────── */}
      {drilldown && (()=>{
        const resource = spendByResource.find(r=>r.name===drilldown) || { name:drilldown, cost:0, type:"—", location:"—", status:"—" };
        const dailyCost = resource.cost > 0 ? resource.cost / 30 : 0;
        const drillData = Array.from({length:30},(_,i)=>{
          const d = new Date(); d.setDate(d.getDate()-29+i);
          const dayLabel = `${d.getMonth()+1}/${d.getDate()}`;
          const variance = 0.85 + Math.random()*0.3;
          return { day:dayLabel, cost: Math.round(dailyCost*variance*100)/100 };
        });
        return (
          <div style={{ position:"fixed",inset:0,zIndex:150,display:"flex",justifyContent:"flex-end" }}
            onClick={e=>{ if(e.target===e.currentTarget) setDrilldown(null); }}>
            <div style={{ width:480,height:"100%",background:"#0a1628",borderLeft:"1px solid rgba(0,255,136,0.2)",display:"flex",flexDirection:"column",boxShadow:"-20px 0 60px rgba(0,0,0,0.6)" }}>
              <div style={{ padding:"20px 24px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
                <div>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:4 }}>COST DRILL-DOWN</div>
                  <div style={{ fontSize:15,fontWeight:700,color:"#f1f5f9",wordBreak:"break-all" }}>{resource.name}</div>
                  <div style={{ fontSize:11,color:"#64748b",marginTop:3 }}>{resource.type} · {resource.location}</div>
                </div>
                <button onClick={()=>setDrilldown(null)} style={{ background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,color:"#475569",cursor:"pointer",padding:"6px 12px",fontFamily:"inherit",fontSize:12 }}>✕ Close</button>
              </div>
              <div style={{ padding:"20px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                {[
                  {label:"Monthly Cost", value:formatINR(resource.cost), color:"#00ff88"},
                  {label:"Daily Avg",    value:formatINR(dailyCost),       color:"#f59e0b"},
                  {label:"Status",       value:resource.status||"—",      color:resource.status==="Running"?"#22c55e":(resource.status||"").toLowerCase().includes("deallocated")?"#ef4444":resource.status==="Stopped"?"#f97316":resource.status==="Provisioned"?"#6366f1":"#f59e0b"},
                  {label:"Favourited",   value:favourites.includes(resource.name)?"★ Yes":"☆ No", color:"#a78bfa"},
                ].map(s=>(
                  <div key={s.label} style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"12px 14px" }}>
                    <div style={{ fontSize:9,color:"#475569",letterSpacing:"0.1em",marginBottom:6 }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize:16,fontWeight:700,color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"20px 24px",flex:1,overflowY:"auto",minHeight:0 }}>
                <div style={{ fontSize:11,color:"#94a3b8",letterSpacing:"0.08em",marginBottom:14 }}>30-DAY DAILY COST BREAKDOWN</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={drillData} margin={{top:10,right:10,left:0,bottom:0}}>
                    <defs><linearGradient id="drillFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="day" stroke="#1e293b" tick={{fill:"#475569",fontSize:9}} interval={6} />
                    <YAxis stroke="#1e293b" tick={{fill:"#475569",fontSize:10}} tickFormatter={v=>"₹"+Math.round(v)} />
                    <Tooltip content={<CT />} />
                    <Area type="monotone" dataKey="cost" stroke="#00ff88" strokeWidth={2} fill="url(#drillFill)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ marginTop:20 }}>
                  <div style={{ fontSize:11,color:"#94a3b8",letterSpacing:"0.08em",marginBottom:10 }}>DAILY BREAKDOWN</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:0,maxHeight:240,overflowY:"auto" }}>
                    {drillData.slice().reverse().map((d,i)=>(
                      <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:11 }}>
                        <span style={{ color:"#475569" }}>{d.day}</span>
                        <span style={{ color:"#00ff88",fontWeight:600 }}>{formatINR(d.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop:18,display:"flex",gap:8 }}>
                  <button onClick={()=>toggleFavourite(resource.name)} style={{ flex:1,padding:"10px",background:favourites.includes(resource.name)?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${favourites.includes(resource.name)?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:8,color:favourites.includes(resource.name)?"#f59e0b":"#64748b",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600 }}>
                    {favourites.includes(resource.name)?"★ Unfavourite":"☆ Favourite"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CLI TERMINAL DRAWER ──────────────────────────────── */}
      {terminalOpen && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: sidebarOpen ? 240 : 64,
          right: 0,
          height: 380,
          background: "rgba(2, 8, 23, 0.96)",
          backdropFilter: "blur(16px)",
          borderTop: "2px solid rgba(0, 255, 136, 0.4)",
          zIndex: 140,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.8)",
          transition: "left 0.25s ease"
        }}>
          {/* Header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 18px",
            background: "rgba(0, 0, 0, 0.4)",
            borderBottom: "1px solid rgba(0, 255, 136, 0.15)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#00ff88", fontSize: 13, fontWeight: "bold" }}>&gt;_ CLOUDOPS INTEGRATED AZURE CLI</span>
              <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(0, 255, 136, 0.1)", border: "1px solid rgba(0, 255, 136, 0.3)", borderRadius: 4, color: "#00ff88", fontWeight: "bold" }}>CONNECTED</span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {/* Shortcut buttons */}
              {["help", "az account show", "az group list"].map((cmd) => (
                <button
                  key={cmd}
                  onClick={async () => {
                    setTerminalHistory(prev => [...prev, { type: "input", text: cmd }]);
                    setTerminalLoading(true);
                    try {
                      const res = await API.post("/azure/cli-run", { command: cmd });
                      setTerminalHistory(prev => [...prev, { type: res.data.success ? "output" : "error", text: res.data.output }]);
                    } catch (err) {
                      setTerminalHistory(prev => [...prev, { type: "error", text: `Error: ${err.message}` }]);
                    } finally {
                      setTerminalLoading(false);
                    }
                  }}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#94a3b8",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  {cmd}
                </button>
              ))}
              <button
                onClick={() => setTerminalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: "bold"
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Terminal Logs / History Output */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 12,
            lineHeight: "1.5"
          }}>
            {terminalHistory.map((item, idx) => {
              if (item.type === "input") {
                return (
                  <div key={idx} style={{ color: "#38bdf8" }}>
                    <span style={{ color: "#a78bfa" }}>yamini@cloudops</span>:<span style={{ color: "#00ff88" }}>~</span>$ <span style={{ color: "#f1f5f9", fontWeight: "bold" }}>{item.text}</span>
                  </div>
                );
              }
              if (item.type === "system") {
                return (
                  <div key={idx} style={{ color: "#64748b", fontStyle: "italic" }}>
                    [System] {item.text}
                  </div>
                );
              }
              if (item.type === "error") {
                return (
                  <div key={idx} style={{ color: "#f87171", background: "rgba(239,68,68,0.05)", padding: "8px 12px", borderRadius: 6, borderLeft: "3px solid #ef4444", whiteSpace: "pre-wrap" }}>
                    {item.text}
                  </div>
                );
              }
              return (
                <div key={idx} style={{ color: "#34d399", background: "rgba(16,185,129,0.03)", padding: "8px 12px", borderRadius: 6, borderLeft: "3px solid #10b981", whiteSpace: "pre-wrap" }}>
                  {item.text}
                </div>
              );
            })}
            {terminalLoading && (
              <div style={{ color: "#00ff88", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="terminal-cursor" style={{ display: "inline-block", width: 8, height: 15, background: "#00ff88" }}></span>
                <span>Executing CLI request on server...</span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleTerminalSubmit}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 18px",
              background: "#010409",
              borderTop: "1px solid rgba(0, 255, 136, 0.15)"
            }}
          >
            <span style={{ color: "#a78bfa", fontSize: 12, marginRight: 8 }}>yamini@cloudops</span>
            <span style={{ color: "#64748b", fontSize: 12, marginRight: 8 }}>:~$</span>
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              placeholder="Enter Azure CLI command (e.g. az group list)..."
              disabled={terminalLoading}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#f1f5f9",
                fontFamily: "inherit",
                fontSize: 12
              }}
              autoFocus
            />
            <span style={{ fontSize: 9, color: "#334155" }}>Press Enter to Execute</span>
          </form>
        </div>
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside style={{ width: sidebarOpen ? 240 : 64, background:"linear-gradient(180deg,#020c1b,#020817)", borderRight:"1px solid rgba(0,255,136,0.12)", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", flexShrink:0 }}>

        {/* Logo */}
        <div style={{ padding:"18px 14px", borderBottom:"1px solid rgba(0,255,136,0.1)", display:"flex", alignItems:"center", gap:10, minHeight:64 }}>
          <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:"linear-gradient(135deg,#00ff88,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#020817" }}>C</div>
          {sidebarOpen && <div><div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", letterSpacing:"0.06em" }}>CLOUDOPS</div><div style={{ fontSize:9, color:"#00ff88", letterSpacing:"0.18em" }}>AI PLATFORM</div></div>}
        </div>

        {/* Nav */}
        <nav style={{ padding:"10px 8px" }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", marginBottom:2,
              background: activeNav===item.id ? "linear-gradient(90deg,rgba(0,255,136,0.14),rgba(0,255,136,0.03))" : "transparent",
              border:"none", borderLeft: activeNav===item.id ? "2px solid #00ff88" : "2px solid transparent",
              borderRadius:"0 6px 6px 0", cursor:"pointer", color: activeNav===item.id ? "#00ff88" : "#64748b",
              fontSize:12, fontFamily:"inherit", whiteSpace:"nowrap", overflow:"hidden",
            }}>
              <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontWeight: activeNav===item.id ? 600 : 400 }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Sessions (only when open) */}
        {sidebarOpen && (
          <div style={{ padding:"0 8px", flex:1, overflowY:"auto" }}>
            <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.12em", padding:"8px 4px 6px" }}>SESSIONS</div>
            {sessions.map(s => (
              <div key={s.id} onClick={() => setActiveSession(s.id)} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"7px 10px", borderRadius:6, marginBottom:2, cursor:"pointer",
                background: s.id===activeSession ? "rgba(0,255,136,0.08)" : "transparent",
                border: s.id===activeSession ? "1px solid rgba(0,255,136,0.18)" : "1px solid transparent",
              }}>
                <span style={{ fontSize:11, color: s.id===activeSession ? "#00ff88" : "#475569", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{s.label}</span>
                <button onClick={(e) => deleteSession(s.id, e)} style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:13, padding:"0 0 0 6px", lineHeight:1 }}>×</button>
              </div>
            ))}
            <button onClick={newSession} style={{ width:"100%", marginTop:6, padding:"7px 10px", background:"rgba(0,255,136,0.05)", border:"1px dashed rgba(0,255,136,0.2)", borderRadius:6, color:"#00ff88", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
              + New Session
            </button>
          </div>
        )}

        {/* Model badge */}
        {sidebarOpen && (
          <div style={{ margin:"8px 10px", padding:"10px 12px", background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.12)", borderRadius:8 }}>
            <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", marginBottom:4 }}>ACTIVE MODEL</div>
            <div style={{ fontSize:12, color:"#f1f5f9", fontWeight:600 }}>Azure OpenAI</div>
            <div style={{ fontSize:10, color:"#00ff88", marginTop:4, display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#00ff88", display:"inline-block", boxShadow:"0 0 5px #00ff88" }} /> Online
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(o => !o)} style={{ margin:"0 8px 10px", padding:"7px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, color:"#334155", cursor:"pointer", fontFamily:"inherit", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {sidebarOpen ? "◀ Collapse" : "▶"}
        </button>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

        {/* Header */}
        <header style={{ background:"rgba(2,8,23,0.85)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(0,255,136,0.1)", padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", letterSpacing:"0.02em" }}>{NAV_ITEMS.find(n=>n.id===activeNav)?.label}</span>
            {dataLoading && <span style={{ fontSize:10, color:"#f59e0b", letterSpacing:"0.1em" }}>● SYNCING</span>}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {[{l:"Azure",c:"#00ff88"},{l:"MCP",c:"#0ea5e9"},{l:"OpenAI",c:"#a78bfa"}].map(b=>(
              <div key={b.l} style={{ padding:"3px 11px", borderRadius:20, border:`1px solid ${b.c}44`, background:`${b.c}11`, color:b.c, fontSize:10, letterSpacing:"0.08em", fontWeight:600 }}>● {b.l}</div>
            ))}
            {/* Command Line Terminal */}
            <button
              onClick={() => setTerminalOpen(o => !o)}
              title="Open Azure CLI Terminal"
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: terminalOpen ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.04)",
                border: terminalOpen ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7,
                cursor: "pointer",
                color: terminalOpen ? "#00ff88" : "#94a3b8",
                fontSize: 13,
                fontFamily: "monospace",
                fontWeight: "bold",
                boxShadow: terminalOpen ? "0 0 8px rgba(0,255,136,0.2)" : "none",
                transition: "all 0.2s ease"
              }}
            >
              &gt;_
            </button>
            {/* Search */}
            <button onClick={()=>setSearchOpen(o=>!o)} title="Search" style={{ width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,cursor:"pointer",color:"#94a3b8",fontSize:15 }}>⌕</button>
            {/* Dark/Light toggle */}
            <button onClick={()=>setDarkMode(d=>!d)} title={darkMode?"Switch to light mode":"Switch to dark mode"} style={{ width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,cursor:"pointer",fontSize:15 }}>
              {darkMode ? "☀" : "🌙"}
            </button>
            {/* Logout */}
            <button onClick={onLogout} title="Log out" style={{ padding:"0 12px", height:32, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:7, cursor:"pointer", color:"#ef4444", fontSize:11, fontFamily:"inherit", fontWeight:600 }}>
              🚪 Log out
            </button>
          </div>
        </header>

        {/* ── Content: all pages except assistant scroll normally ── */}
        {activeNav !== "assistant" && (
          <main style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:18 }}>

            {/* OVERVIEW */}
            {activeNav === "overview" && <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
                {[
                  { label:"CPU Usage",     value:`${metrics.cpu_usage||0}%`,   color:statusColor(metrics.cpu_usage||0),  sub:"Live · Container Apps" },
                  { label:"Memory Usage",  value:`${metrics.memory_usage||0}%`,color:statusColor(metrics.memory_usage||0), sub:"Live reading" },
                  { label:"Active Alerts", value:metrics.active_alerts||0,     color:(metrics.active_alerts||0)>0?"#ef4444":"#00ff88", sub:"Requires attention" },
                  { label:"Monthly Cost",  value:formatINR(costs.monthly_cost), color:"#00ff88", sub:"Estimated spend" },
                ].map(k=>(
                  <div key={k.label} style={{ ...card(), position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${k.color},transparent)` }} />
                    <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.1em", marginBottom:8 }}>{k.label.toUpperCase()}</div>
                    <div style={{ fontSize:34, fontWeight:700, color:k.color, lineHeight:1, marginBottom:5 }}>{k.value}</div>
                    <div style={{ fontSize:10, color:"#334155" }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10 }}>
                {[
                  {label:"Total",      value:summary.total_resources||0,      color:"#0ea5e9"},
                  {label:"Storage",    value:summary.storage_accounts||0,     color:"#6366f1"},
                  {label:"Registries", value:summary.container_registries||0, color:"#00ff88"},
                  {label:"Web Apps",   value:summary.web_apps||0,             color:"#a78bfa"},
                  {label:"Containers", value:summary.container_apps||0,       color:"#f59e0b"},
                  {label:"Databases",  value:summary.databases||0,            color:"#ef4444"},
                ].map(s=>(
                  <div key={s.label} style={{ ...card({padding:"12px 14px"}), textAlign:"center" }}>
                    <div style={{ fontSize:24, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:9, color:"#475569", letterSpacing:"0.1em", marginTop:4 }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={label12}>COST OVERVIEW</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={costData}>
                      <XAxis dataKey="name" stroke="#334155" tick={{fill:"#64748b",fontSize:11,fontFamily:"JetBrains Mono"}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <Tooltip content={<CT />} />
                      <Bar dataKey="cost" fill="#00ff88" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={label12}>SECURITY POSTURE</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={securityData} dataKey="value" outerRadius={80} innerRadius={40}>
                        {securityData.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip content={<CT />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={label12}>RESOURCE TREND</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={cpuHistory.length ? cpuHistory : [{time:"--",cpu:0}]} margin={{top:10,right:10,left:0,bottom:0}}>
                      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="time" stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <Tooltip content={<CT />} />
                      <Area type="monotone" dataKey="cpu" name="resources" stroke="#00ff88" strokeWidth={2} fill="url(#cg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={label12}>OPERATIONS READINESS</div>
                  {(operations.length ? operations : [{name:"Backend",status:"Loading",action:"Syncing Azure environment"}]).map((item,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"10px 0", borderBottom:i===operations.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:4 }}>{item.name}</div>
                        <div style={{ fontSize:10, color:"#64748b", lineHeight:1.5 }}>{item.action}</div>
                      </div>
                      <div style={{ fontSize:10, color:item.status==="Ready"||item.status==="Healthy"?"#00ff88":"#f59e0b", alignSelf:"start" }}>{item.status}</div>
                    </div>
                  ))}
                </div>
                <div style={card()}>
                  <div style={label12}>TERRAFORM APPROVALS</div>
                  {(approvals.length ? approvals : [{change:"Container App deployment",status:"Syncing",risk:"Low",approver:"CloudOps Lead"}]).map((item,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"10px 0", borderBottom:i===approvals.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:4 }}>{item.change}</div>
                        <div style={{ fontSize:10, color:"#64748b" }}>{item.risk} risk - {item.approver}</div>
                      </div>
                      <div style={{ fontSize:10, color:item.status==="Blocked"?"#ef4444":"#00ff88", alignSelf:"start" }}>{item.status}</div>
                    </div>
                  ))}
                </div>
              </div>

              {prediction.length>0 && (
                <div style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.18)", borderRadius:12, padding:"16px 20px" }}>
                  <div style={{ fontSize:11, color:"#f59e0b", letterSpacing:"0.1em", marginBottom:10 }}>⚡ PREDICTIVE INSIGHTS</div>
                  {prediction.map((p,i)=><div key={i} style={{ fontSize:12, color:"#fbbf24", marginBottom:6 }}>▸ {p}</div>)}
                </div>
              )}
            </>}

            {/* RESOURCES */}
            {activeNav==="resources" && <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:11, color:"#64748b" }}>{azureResources.length} resources in subscription</div>
                <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                  {[
                    {label:"Running",              dot:"#22c55e"},
                    {label:"Stopped (Deallocated)", dot:"#ef4444"},
                    {label:"Stopped",               dot:"#f97316"},
                    {label:"Provisioned",           dot:"#6366f1"},
                    {label:"Starting/Stopping",     dot:"#f59e0b"},
                  ].map(s=>(
                    <div key={s.label} style={{ display:"flex",alignItems:"center",gap:5,fontSize:9,color:"#475569" }}>
                      <span style={{ width:6,height:6,borderRadius:"50%",background:s.dot,display:"inline-block",flexShrink:0 }} />{s.label}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {azureResources.map((r,i)=>{
                  const statusLow = (r.status||"").toLowerCase();
                  const statusColor =
                    statusLow === "running"              ? "#22c55e" :
                    statusLow.includes("deallocated")    ? "#ef4444" :
                    statusLow === "stopped"              ? "#f97316" :
                    statusLow === "provisioned"          ? "#6366f1" :
                    statusLow === "starting"             ? "#f59e0b" :
                    statusLow === "stopping"             ? "#f59e0b" :
                    statusLow === "deallocating"         ? "#f59e0b" :
                    statusLow === "unknown"              ? "#64748b" : "#94a3b8";
                  const statusBg   = statusColor + "15";
                  const statusBdr  = statusColor + "40";
                  const isVM = r.type?.toLowerCase().includes("virtualmachines");
                  return (
                    <div key={i} style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"14px 16px", transition:"border-color 0.15s, box-shadow 0.15s", cursor:"default" }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,0.14)"; e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,0.25)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow="none"; }}
                    >
                      {/* Header row */}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:8 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0", wordBreak:"break-all", lineHeight:1.4 }}>{r.name}</div>
                        {/* Live status dot + label */}
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, background:statusBg, border:`1px solid ${statusBdr}`, borderRadius:20, padding:"3px 9px" }}>
                          <span style={{ width:5, height:5, borderRadius:"50%", background:statusColor, display:"inline-block", boxShadow: statusLow==="running" ? `0 0 5px ${statusColor}88` : "none" }} />
                          <span style={{ fontSize:9, color:statusColor, fontWeight:700, letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{r.status || "Unknown"}</span>
                        </div>
                      </div>
                      {/* Type chip */}
                      <div style={{ display:"inline-block", fontSize:9, color:"#7dd3fc", background:"rgba(125,211,252,0.08)", border:"1px solid rgba(125,211,252,0.18)", borderRadius:4, padding:"2px 8px", marginBottom:8, letterSpacing:"0.05em" }}>
                        {r.type?.split("/").pop()}
                        {isVM && <span style={{ marginLeft:5, opacity:0.6 }}>· VM</span>}
                      </div>
                      {/* Location */}
                      <div style={{ fontSize:10, color:"#475569", marginBottom:8 }}>📍 {r.location}</div>
                      {/* Resource group */}
                      {r.resource_group && <div style={{ fontSize:9, color:"#334155", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>RG: {r.resource_group}</div>}
                      {/* Approval badge */}
                      {r.approval_status && (
                        <div style={{ marginTop:8 }}>
                          <span style={{ fontSize:9, color:"#f59e0b", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:4, padding:"2px 8px" }}>⏳ {r.approval_status}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>}

            {activeNav==="spend" && <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:14, flex:1 }}>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>TOTAL MONTHLY SPEND</div>
                  <div style={{ fontSize:28,fontWeight:700,color:"#00ff88" }}>{formatINR(costs.monthly_cost)}</div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>PROJECTED (30D)</div>
                  <div style={{ fontSize:28,fontWeight:700,color:"#f59e0b" }}>{formatINR(costs.projected_cost)}</div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>RESOURCES TRACKED</div>
                  <div style={{ fontSize:28,fontWeight:700,color:"#0ea5e9" }}>{spendByResource.length}</div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>TOP RESOURCE</div>
                  <div style={{ fontSize:16,fontWeight:700,color:"#f59e0b",wordBreak:"break-all" }}>{costs.top_resource||"Azure"}</div>
                </div>
              </div>
                {/* Export buttons */}
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  {[{key:"csv",label:"⬇ CSV"},{key:"json",label:"⬇ JSON"}].map(b=>(
                    <button key={b.key} onClick={()=>exportReport(b.key)} disabled={exportLoading}
                      style={{ padding:"8px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"#94a3b8",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600,letterSpacing:"0.06em",whiteSpace:"nowrap" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,255,136,0.35)";e.currentTarget.style.color="#00ff88";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";e.currentTarget.style.color="#94a3b8";}}
                    >{b.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                    <div style={label12}>SPEND BY RESOURCE (ALL)</div>
                    <div style={{ fontSize:9,color:"#475569" }}>Click bar to drill down →</div>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={spendByResource.map(r=>({...r,shortName:r.name.length>14?r.name.slice(0,14)+"…":r.name}))} margin={{top:20,right:10,left:0,bottom:40}}
                      onClick={(data)=>{ if(data?.activePayload?.[0]) setDrilldown(data.activePayload[0].payload.name); }}>
                      <XAxis dataKey="shortName" stroke="#334155" tick={{fill:"#64748b",fontSize:9}} angle={-35} textAnchor="end" interval={0} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:10}} tickFormatter={v=>"₹"+Math.round(v)} />
                      <Tooltip content={<CT />} />
                      <Bar dataKey="cost" fill="#f59e0b" radius={[4,4,0,0]} cursor="pointer">
                        <LabelList dataKey="cost" position="top" formatter={v=>"₹"+Math.round(v)} style={{fill:"#f59e0b",fontSize:8}} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={label12}>SPEND BY SERVICE TYPE</div>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={spendByService.slice(0,8)} dataKey="cost" nameKey="service" outerRadius={110} innerRadius={50} paddingAngle={3}>
                        {spendByService.slice(0,8).map((_,i)=><Cell key={i} fill={["#00ff88","#f59e0b","#0ea5e9","#a78bfa","#ef4444","#6366f1","#10b981","#f97316"][i%8]} />)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[formatINR(v),n]} contentStyle={{background:"rgba(0,10,20,0.95)",border:"1px solid rgba(0,255,136,0.3)",borderRadius:8,fontSize:12,fontFamily:"JetBrains Mono"}} />
                      <Legend formatter={v=>v} wrapperStyle={{fontSize:10,color:"#64748b"}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={card()}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                  <div style={label12}>RESOURCE COST TABLE</div>
                  <div style={{ fontSize:9,color:"#475569" }}>★ = favourite · Click name to drill down</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 120px 90px 90px 110px", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.1)", marginBottom:4 }}>
                  <div />
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.08em" }}>RESOURCE</div>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.08em" }}>TYPE</div>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.08em" }}>LOCATION</div>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.08em" }}>STATUS</div>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.08em",textAlign:"right" }}>COST/MO</div>
                </div>
                {(spendByResource.length ? spendByResource : [{name:"No Azure resource data",type:"-",location:"-",status:"-",cost:0}]).map((item,i)=>(
                  <div key={item.name+i} style={{ display:"grid", gridTemplateColumns:"28px 1fr 120px 90px 90px 110px", gap:12, padding:"10px 0", borderBottom:i===spendByResource.length-1?"none":"1px solid rgba(255,255,255,0.05)", alignItems:"center" }}>
                    <button onClick={()=>toggleFavourite(item.name)} title={favourites.includes(item.name)?"Remove favourite":"Add favourite"}
                      style={{ background:"none",border:"none",cursor:"pointer",fontSize:14,color:favourites.includes(item.name)?"#f59e0b":"#334155",padding:0,lineHeight:1,transition:"color 0.15s" }}>★</button>
                    <div style={{ fontSize:12, color:"#f1f5f9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer", textDecoration:"underline", textDecorationColor:"rgba(0,255,136,0.3)" }}
                      onClick={()=>setDrilldown(item.name)}>{item.name}</div>
                    <div style={{ fontSize:10, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.type}</div>
                    <div style={{ fontSize:10, color:"#475569" }}>{item.location}</div>
                    <div style={{ fontSize:10, color:item.status==="Running"?"#22c55e":item.status?.toLowerCase().includes("deallocated")?"#ef4444":item.status==="Stopped"?"#f97316":item.status==="Provisioned"?"#6366f1":"#f59e0b" }}>{item.status}</div>
                    <div style={{ fontSize:12, color:"#00ff88", textAlign:"right", fontWeight:600 }}>{formatINR(item.cost)}</div>
                  </div>
                ))}
              </div>
            </>}

            {activeNav==="forecast" && <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>CURRENT MONTHLY ESTIMATE</div>
                  <div style={{ fontSize:30,fontWeight:700,color:"#00ff88" }}>{formatINR(costs.monthly_cost)}</div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>30 DAY PROJECTION</div>
                  <div style={{ fontSize:30,fontWeight:700,color:"#f59e0b" }}>{formatINR(costs.projected_cost)}</div>
                </div>
              </div>
              <div style={card()}>
                <div style={label12}>30 DAY COST FORECAST</div>
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={forecast30}>
                    <defs><linearGradient id="forecastPageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="day" stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                    <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                    <Tooltip content={<CT />} />
                    <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} fill="url(#forecastPageFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>}

            {activeNav==="anomalies" && <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>ANOMALIES</div>
                  <div style={{ fontSize:30,fontWeight:700,color:anomalies.length?"#f59e0b":"#00ff88" }}>{anomalies.length}</div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>STATUS</div>
                  <div style={{ fontSize:24,fontWeight:700,color:anomalies.length?"#f59e0b":"#00ff88" }}>{anomalies.length ? "Review" : "Normal"}</div>
                </div>
              </div>
              <div style={card()}>
                <div style={label12}>ANOMALY DETECTION</div>
                {(anomalies.length ? anomalies : [{severity:"Low",signal:"No anomaly detected",detail:"Current estimated data is within expected range."}]).map((item,i)=>(
                  <div key={i} style={{ padding:"14px 0", borderBottom:i===anomalies.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginBottom:5 }}>
                      <span style={{ fontSize:13, color:"#f1f5f9" }}>{item.signal}</span>
                      <span style={{ fontSize:10, color:item.severity==="High"?"#ef4444":item.severity==="Medium"?"#f59e0b":"#00ff88" }}>{item.severity}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#64748b", lineHeight:1.6 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </>}

            {/* COSTS */}
            {activeNav==="costs" && <>
              <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginBottom:2 }}>
                {[{key:"csv",label:"⬇ Export CSV"},{key:"json",label:"⬇ Export JSON"}].map(b=>(
                  <button key={b.key} onClick={()=>exportReport(b.key)} disabled={exportLoading}
                    style={{ padding:"7px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"#94a3b8",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600,letterSpacing:"0.06em" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,255,136,0.35)";e.currentTarget.style.color="#00ff88";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";e.currentTarget.style.color="#94a3b8";}}
                  >{b.label}</button>
                ))}
              </div>
              {budgetAlerts.alerts?.map((alert,i)=>(
                <div key={i} style={{ background: alert.level==="Critical"?"rgba(239,68,68,0.08)":alert.level==="Warning"?"rgba(245,158,11,0.08)":"rgba(0,255,136,0.06)", border:`1px solid ${alert.level==="Critical"?"rgba(239,68,68,0.35)":alert.level==="Warning"?"rgba(245,158,11,0.35)":"rgba(0,255,136,0.25)"}`, borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16 }}>
                  <div>
                    <span style={{ fontSize:11, fontWeight:700, color:alert.level==="Critical"?"#ef4444":alert.level==="Warning"?"#f59e0b":"#00ff88", marginRight:10 }}>● {alert.level.toUpperCase()}</span>
                    <span style={{ fontSize:12, color:"#cbd5e1" }}>{alert.message}</span>
                  </div>
                  <span style={{ fontSize:11, color:"#64748b", whiteSpace:"nowrap" }}>{alert.action}</span>
                </div>
              ))}
              {budgetAlerts.budget_limit && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                  {[
                    {label:"Budget Limit",   value:formatINR(budgetAlerts.budget_limit),   color:"#0ea5e9"},
                    {label:"Used",           value:`${budgetAlerts.percent_used||0}%`,      color: budgetAlerts.percent_used>90?"#ef4444":budgetAlerts.percent_used>75?"#f59e0b":"#00ff88"},
                    {label:"Projected Use",  value:`${budgetAlerts.projected_percent||0}%`, color: budgetAlerts.projected_percent>100?"#ef4444":"#f59e0b"},
                  ].map(b=>(
                    <div key={b.label} style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"14px 18px" }}>
                      <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:8 }}>{b.label.toUpperCase()}</div>
                      <div style={{ fontSize:24,fontWeight:700,color:b.color }}>{b.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                {[
                  {label:"Monthly Cost",   value:formatINR(costs.monthly_cost),   color:"#00ff88"},
                  {label:"Projected Cost", value:formatINR(costs.projected_cost), color:"#f59e0b"},
                  {label:"Top Resource",   value:costs.top_resource||"—",        color:"#0ea5e9"},
                ].map(c=>(
                  <div key={c.label} style={{ ...card(), position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${c.color},transparent)` }} />
                    <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:10 }}>{c.label.toUpperCase()}</div>
                    <div style={{ fontSize:30,fontWeight:700,color:c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={card()}>
                <div style={label12}>COST BREAKDOWN</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={costData}>
                    <XAxis dataKey="name" stroke="#334155" tick={{fill:"#64748b",fontSize:12,fontFamily:"JetBrains Mono"}} />
                    <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:12}} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="cost" fill="#00ff88" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={label12}>COST TREND</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={costTrend}>
                      <defs><linearGradient id="costTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="month" stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <Tooltip content={<CT />} />
                      <Area type="monotone" dataKey="cost" stroke="#0ea5e9" strokeWidth={2} fill="url(#costTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={label12}>SPEND BY RESOURCE</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={spendByResource.slice(0,6)}>
                      <XAxis dataKey="name" stroke="#334155" tick={{fill:"#64748b",fontSize:10}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <Tooltip content={<CT />} />
                      <Bar dataKey="cost" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {costTrend.length > 0 && (
                <div style={card()}>
                  <div style={label12}>DAILY COST TREND (THIS MONTH)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={costTrend} margin={{top:10,right:10,left:0,bottom:0}}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#334155" tick={{fill:"#64748b",fontSize:9}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:10}} tickFormatter={v=>"₹"+Math.round(v)} />
                      <Tooltip content={<CT />} />
                      <Area type="monotone" dataKey="cost" stroke="#00ff88" strokeWidth={2} fill="url(#costGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {forecast30.length > 0 && (
                <div style={card()}>
                  <div style={label12}>30-DAY FORECAST (WEIGHTED REGRESSION)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={forecast30} margin={{top:16,right:10,left:0,bottom:0}}>
                      <XAxis dataKey="day" stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:10}} tickFormatter={v=>"₹"+Math.round(v)} />
                      <Tooltip content={<CT />} />
                      <Bar dataKey="forecast" fill="#a78bfa" radius={[4,4,0,0]}>
                        <LabelList dataKey="forecast" position="top" formatter={v=>"₹"+Math.round(v)} style={{fill:"#a78bfa",fontSize:9}} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {costs.recommendation && (
                <div style={{ background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.18)", borderRadius:10, padding:"14px 18px", fontSize:12, color:"#00ff88" }}>
                  💡 {costs.recommendation}
                </div>
              )}
            </>}

            {/* SECURITY */}
            {activeNav==="favourites" && <>
              {favourites.length === 0 ? (
                <div style={{ ...card(), textAlign:"center", padding:"48px 24px" }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>★</div>
                  <div style={{ fontSize:14, color:"#475569" }}>No favourites yet.</div>
                  <div style={{ fontSize:12, color:"#334155", marginTop:6 }}>Click the ★ next to any resource in Spend by Resource to pin it here.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:11, color:"#475569", marginBottom:4 }}>{favourites.length} pinned resource{favourites.length!==1?"s":""}</div>
                  {spendByResource.filter(r=>favourites.includes(r.name)).map((item,i)=>(
                    <div key={item.name} style={{ ...card(), display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color: darkMode?"#f1f5f9":"#1e293b", marginBottom:4, cursor:"pointer" }} onClick={()=>{setDrilldown(item.name); setActiveNav("spend");}}>{item.name}</div>
                        <div style={{ fontSize:11, color:"#64748b" }}>{item.type} · {item.location}</div>
                      </div>
                      <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:14, fontWeight:700, color:"#00ff88" }}>{formatINR(item.cost)}/mo</div>
                          <div style={{ fontSize:10, color:item.status==="Running"?"#22c55e":item.status?.toLowerCase().includes("deallocated")?"#ef4444":item.status==="Stopped"?"#f97316":item.status==="Provisioned"?"#6366f1":"#f59e0b" }}>{item.status}</div>
                        </div>
                        <button onClick={()=>toggleFavourite(item.name)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:18, color:"#f59e0b" }}>★</button>
                      </div>
                    </div>
                  ))}
                  {spendByResource.filter(r=>favourites.includes(r.name)).length === 0 && (
                    <div style={{ ...card(), color:"#475569", fontSize:12 }}>Your pinned resources haven't loaded yet. Go to Spend by Resource to see them.</div>
                  )}
                </>
              )}
            </>}
            {activeNav==="approvals" && <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:11, color:"#475569" }}>{pendingApprovals.filter(a=>a.status==="pending").length} pending · {pendingApprovals.filter(a=>a.status==="approved").length} approved · {pendingApprovals.filter(a=>a.status==="rejected").length} rejected</div>
                <button onClick={()=>setPendingApprovals(prev=>prev.filter(a=>a.status==="pending"))} style={{ fontSize:10, color:"#475569", background:"transparent", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" }}>Clear history</button>
              </div>
              {pendingApprovals.length === 0 && (
                <div style={{ ...card(), textAlign:"center", padding:"48px 24px" }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>✦</div>
                  <div style={{ fontSize:14, color:"#475569" }}>No approval requests yet.</div>
                  <div style={{ fontSize:12, color:"#334155", marginTop:6 }}>Type "stop &lt;resource-name&gt;" or "start &lt;resource-name&gt;" in the AI Assistant to create one.</div>
                </div>
              )}
              {pendingApprovals.map((approval) => (
                <div key={approval.id} style={{ ...card(), borderColor: approval.status==="pending" ? "rgba(245,158,11,0.35)" : approval.status==="approved" ? "rgba(0,255,136,0.25)" : "rgba(239,68,68,0.25)", background: approval.status==="pending" ? "rgba(245,158,11,0.05)" : approval.status==="approved" ? "rgba(0,255,136,0.04)" : "rgba(239,68,68,0.04)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", color: approval.status==="pending"?"#f59e0b":approval.status==="approved"?"#00ff88":"#ef4444", background: approval.status==="pending"?"rgba(245,158,11,0.1)":approval.status==="approved"?"rgba(0,255,136,0.08)":"rgba(239,68,68,0.08)", padding:"3px 10px", borderRadius:999 }}>
                          {approval.status==="pending" ? "⏳ PENDING" : approval.status==="approved" ? "✓ APPROVED" : "✗ REJECTED"}
                        </span>
                        <span style={{ fontSize:10, color:"#334155" }}>{approval.requestedAt}</span>
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#f1f5f9" }}>{approval.action?.toUpperCase()} Request</div>
                      <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>Resource: <span style={{ color:"#0ea5e9" }}>{approval.resource}</span></div>
                    </div>
                    {approval.status==="pending" && (
                      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        <button onClick={async()=>{
                          try {
                            const res = await API.post("/azure/approve-action", { question: approval.resource });
                            setPendingApprovals(prev => prev.map(a => a.id===approval.id ? {...a, status:"approved"} : a));
                            setApprovalCards(prev => { const u={...prev}; if(u[approval.id]) u[approval.id]={...u[approval.id],status:"approved"}; return u; });
                            fetchAzureResources(); fetchAnalytics();
                          } catch {}
                        }} style={{ padding:"8px 20px", background:"linear-gradient(135deg,#00ff88,#0ea5e9)", border:"none", borderRadius:7, color:"#020817", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                          ✓ Approve
                        </button>
                        <button onClick={async()=>{
                          try {
                            const res = await API.post("/azure/reject-action", { question: approval.resource });
                            setPendingApprovals(prev => prev.map(a => a.id===approval.id ? {...a, status:"rejected"} : a));
                            setApprovalCards(prev => { const u={...prev}; if(u[approval.id]) u[approval.id]={...u[approval.id],status:"rejected"}; return u; });
                          } catch {}
                        }} style={{ padding:"8px 20px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.35)", borderRadius:7, color:"#ef4444", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                    {[
                      { label:"ACTION", value: approval.action?.toUpperCase() },
                      { label:"RESOURCE", value: approval.resource },
                      { label:"REQUESTED", value: approval.requestedAt },
                    ].map(f=>(
                      <div key={f.label} style={{ background:"rgba(255,255,255,0.02)", borderRadius:6, padding:"8px 12px" }}>
                        <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em", marginBottom:4 }}>{f.label}</div>
                        <div style={{ fontSize:11, color:"#94a3b8", wordBreak:"break-all" }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>}
            {activeNav==="security" && <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
                {[
                  {label:"Security Score", value:`${secScore}%`,             color:statusColor(100-secScore,20,40)},
                  {label:"Warnings",       value:security.warnings||0,        color:"#f59e0b"},
                  {label:"Critical",       value:security.critical_alerts||0, color:"#ef4444"},
                  {label:"Status",         value:security.status||"—",        color:"#00ff88"},
                ].map(s=>(
                  <div key={s.label} style={{ ...card(), position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.color},transparent)` }} />
                    <div style={{ fontSize:10,color:"#475569",letterSpacing:"0.1em",marginBottom:8 }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize:26,fontWeight:700,color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={label12}>SECURITY DISTRIBUTION</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={securityData} dataKey="value" outerRadius={90} innerRadius={46}>
                        {securityData.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip content={<CT />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={label12}>LEGEND</div>
                  {securityData.map((s,i)=>(
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:18 }}>
                      <div style={{ width:9,height:9,borderRadius:"50%",background:COLORS[i],boxShadow:`0 0 7px ${COLORS[i]}` }} />
                      <div style={{ flex:1,fontSize:12,color:"#94a3b8" }}>{s.name}</div>
                      <div style={{ fontSize:20,fontWeight:700,color:COLORS[i] }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={card()}>
                <div style={label12}>SECURITY FINDINGS</div>
                {(securityFindings.length ? securityFindings : [{severity:"Low",title:"No findings loaded",detail:"Security findings will appear after Azure sync."}]).map((item,i)=>(
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"90px 1fr", gap:12, padding:"11px 0", borderBottom:i===securityFindings.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize:10, color:item.severity==="High"?"#ef4444":item.severity==="Medium"?"#f59e0b":"#00ff88" }}>{item.severity}</div>
                    <div>
                      <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:4 }}>{item.title}</div>
                      <div style={{ fontSize:10, color:"#64748b", lineHeight:1.6 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>}

            {/* AI INSIGHTS */}
            {activeNav==="insights" && <>
              <div style={card()}>
                <div style={label12}>◈ ROOT CAUSE ANALYSIS</div>
                {rootCauseLoading ? (
                  <div style={{ fontSize:12, color:"#475569", display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ animation:"pulse 1.4s infinite" }}>◆ ◆ ◆</span>
                    <span>Azure OpenAI is analyzing your environment...</span>
                  </div>
                ) : (
                  <pre style={{ whiteSpace:"pre-wrap",fontSize:12,color:"#cbd5e1",lineHeight:1.75,margin:0,fontFamily:"inherit" }}>
                    {analysis || "No analysis available yet."}
                  </pre>
                )}
              </div>
              <div style={card()}>
                <div style={label12}>◉ OPERATIONAL INSIGHTS</div>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {insights.map((item,i)=>(
                    <div key={i} style={{ background:"rgba(0,255,136,0.04)",border:"1px solid rgba(0,255,136,0.1)",borderRadius:8,padding:"11px 14px",fontSize:12,color:"#94a3b8",display:"flex",alignItems:"center",gap:10 }}>
                      <span style={{ color:"#00ff88" }}>◆</span> {item}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.14)",borderRadius:12,padding:22 }}>
                <div style={{ fontSize:11,color:"#f59e0b",letterSpacing:"0.1em",marginBottom:12 }}>⚡ PREDICTIVE FORECAST</div>
                {prediction.map((p,i)=>(
                  <div key={i} style={{ fontSize:12,color:"#fbbf24",marginBottom:8,display:"flex",gap:8 }}><span>▸</span>{p}</div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={label12}>30 DAY COST FORECAST</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={forecast30}>
                      <defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="day" stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <YAxis stroke="#334155" tick={{fill:"#64748b",fontSize:11}} />
                      <Tooltip content={<CT />} />
                      <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} fill="url(#forecastFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={card()}>
                  <div style={label12}>ANOMALY DETECTION</div>
                  {(anomalies.length ? anomalies : [{severity:"Low",signal:"No anomaly detected",detail:"Current estimated data is within expected range."}]).map((item,i)=>(
                    <div key={i} style={{ padding:"11px 0", borderBottom:i===anomalies.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"#f1f5f9" }}>{item.signal}</span>
                        <span style={{ fontSize:10, color:item.severity==="High"?"#ef4444":item.severity==="Medium"?"#f59e0b":"#00ff88" }}>{item.severity}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#64748b", lineHeight:1.6 }}>{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={card()}>
                  <div style={label12}>OPERATIONS</div>
                  {operations.map((item,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"10px 0", borderBottom:i===operations.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:4 }}>{item.name}</div>
                        <div style={{ fontSize:10, color:"#64748b", lineHeight:1.5 }}>{item.action}</div>
                      </div>
                      <div style={{ fontSize:10, color:item.status==="Ready"||item.status==="Healthy"?"#00ff88":"#f59e0b" }}>{item.status}</div>
                    </div>
                  ))}
                </div>
                <div style={card()}>
                  <div style={label12}>TERRAFORM APPROVALS</div>
                  {approvals.map((item,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"10px 0", borderBottom:i===approvals.length-1?"none":"1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:4 }}>{item.change}</div>
                        <div style={{ fontSize:10, color:"#64748b" }}>{item.risk} risk - {item.approver}</div>
                      </div>
                      <div style={{ fontSize:10, color:item.status==="Blocked"?"#ef4444":"#00ff88" }}>{item.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>}

          </main>
        )}

        {/* ── ASSISTANT: fixed layout, no outer scroll ────────── */}
        {activeNav === "assistant" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:20, gap:12 }}>

            <div style={{ flexShrink:0, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:8 }}>
                <div style={{ fontSize:10, color:"#64748b", letterSpacing:"0.1em" }}>QUICK ACTIONS</div>
                <div style={{ fontSize:10, color:"#334155" }}>Cost, security, forecast, operations, Terraform</div>
              </div>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                {SUGGESTED.map(s=>(
                  <button key={s.label} onClick={()=>setQuestion(s.prompt)} style={{ padding:"6px 10px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:7, color:"#94a3b8", fontSize:10, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s", whiteSpace:"nowrap" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,255,136,0.35)";e.currentTarget.style.color="#00ff88";e.currentTarget.style.background="rgba(0,255,136,0.06)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.09)";e.currentTarget.style.color="#94a3b8";e.currentTarget.style.background="rgba(255,255,255,0.03)";}}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            {/* Messages — scrollable region */}
            <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, minHeight:0 }}>
              {messages.map((msg,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", alignItems:"flex-start" }}>
                  {msg.role==="assistant" && (
                    <div style={{ width:28,height:28,borderRadius:6,flexShrink:0,background:"linear-gradient(135deg,#00ff88,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#020817",marginRight:9,marginTop:2 }}>C</div>
                  )}
                  <div style={{ maxWidth:"72%", display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{
                      padding:"11px 15px",
                      borderRadius: msg.role==="user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      background: msg.role==="user" ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "rgba(255,255,255,0.04)",
                      border: msg.role==="user" ? "none" : "1px solid rgba(255,255,255,0.08)",
                      fontSize:12, lineHeight:1.7, color:msg.role==="user"?"#fff":"#cbd5e1", whiteSpace:"pre-wrap",
                    }}>
                      {typeof msg.content==="object" ? JSON.stringify(msg.content,null,2) : msg.content}
                    </div>
                    {msg.isApproval && (() => {
                      const card = Object.entries(approvalCards).find(([,v]) => v.status === "pending" && msg.content.includes(v.resource));
                      if (!card) return null;
                      const [cardKey, cardData] = card;
                      return (
                        <div style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.35)", borderRadius:10, padding:"14px 16px" }}>
                          <div style={{ fontSize:10, color:"#f59e0b", letterSpacing:"0.1em", marginBottom:10 }}>⚠ APPROVAL REQUIRED</div>
                          <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:4 }}>Action: <span style={{color:"#f59e0b",fontWeight:700}}>{cardData.action?.toUpperCase()}</span></div>
                          <div style={{ fontSize:12, color:"#f1f5f9", marginBottom:12 }}>Resource: <span style={{color:"#0ea5e9"}}>{cardData.resource}</span></div>
                          <div style={{ display:"flex", gap:8 }}>
                            <button onClick={async()=>{
                              try {
                                const res = await API.post("/azure/approve-action", { question: cardData.resource });
                                setApprovalCards(prev => ({ ...prev, [cardKey]: { ...cardData, status:"approved" } }));
                                setPendingApprovals(prev => prev.map(a => a.id===cardKey ? {...a, status:"approved"} : a));
                                patchMessages(p => [...p, { role:"assistant", content: res.data.message }]);
                                fetchAzureResources(); fetchAnalytics();
                              } catch { patchMessages(p => [...p, { role:"assistant", content:"❌ Approval failed. Try again." }]); }
                            }} style={{ padding:"8px 18px", background:"linear-gradient(135deg,#00ff88,#0ea5e9)", border:"none", borderRadius:7, color:"#020817", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                              ✓ APPROVE
                            </button>
                            <button onClick={async()=>{
                              try {
                                const res = await API.post("/azure/reject-action", { question: cardData.resource });
                                setApprovalCards(prev => ({ ...prev, [cardKey]: { ...cardData, status:"rejected" } }));
                                setPendingApprovals(prev => prev.map(a => a.id===cardKey ? {...a, status:"rejected"} : a));
                                patchMessages(p => [...p, { role:"assistant", content: res.data.message }]);
                              } catch { patchMessages(p => [...p, { role:"assistant", content:"❌ Rejection failed. Try again." }]); }
                            }} style={{ padding:"8px 18px", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.35)", borderRadius:7, color:"#ef4444", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                              ✗ REJECT
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display:"flex",alignItems:"center",gap:9 }}>
                  <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#00ff88,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#020817" }}>C</div>
                  <div style={{ padding:"11px 15px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px 12px 12px 2px",fontSize:13,color:"#475569" }}>
                    <span style={{ animation:"pulse 1.4s infinite" }}>◆ ◆ ◆</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar — always visible at bottom */}
            <div style={{ display:"flex",gap:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"4px 4px 4px 14px",alignItems:"center",flexShrink:0 }}>
              <input
                value={question}
                onChange={e=>setQuestion(e.target.value)}
                onKeyDown={e=>e.key==="Enter" && askAI()}
                placeholder="Ask about Azure, Kubernetes, costs, security..."
                style={{ flex:1,background:"none",border:"none",outline:"none",color:"#e2e8f0",fontSize:12,fontFamily:"inherit",padding:"10px 0" }}
              />
              <button onClick={askAI} disabled={loading} style={{ padding:"9px 18px",background:loading?"rgba(0,255,136,0.15)":"linear-gradient(135deg,#00ff88,#0ea5e9)",border:"none",borderRadius:8,color:"#020817",fontWeight:700,fontSize:11,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"0.06em",flexShrink:0 }}>
                {loading ? "···" : "SEND →"}
              </button>
            </div>
          </div>
        )}

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.18); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}