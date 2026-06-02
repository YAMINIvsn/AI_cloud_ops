import { useState, useEffect } from "react";
import API from "./services/api";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const costData = [
  { name: "AKS", cost: 4200 },
  { name: "Storage", cost: 1800 },
  { name: "Network", cost: 900 },
  { name: "Monitor", cost: 700 },
];

const securityData = [
  { name: "Healthy", value: 78 },
  { name: "Warnings", value: 15 },
  { name: "Critical", value: 7 },
];

const cpuTrend = [
  { time: "1m", cpu: 35 },
  { time: "2m", cpu: 48 },
  { time: "3m", cpu: 42 },
  { time: "4m", cpu: 67 },
  { time: "5m", cpu: 58 },
];

const COLORS = ["#22c55e", "#facc15", "#ef4444"];

function App() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "🚀 CloudOps AI initialized successfully.",
    },
  ]);

const [azureResources, setAzureResources] = useState([]);
const [metrics, setMetrics] = useState({});

  useEffect(() => {
  fetchAzureResources();
  fetchMetrics();
  fetchSummary();

  const interval = setInterval(() => {
    fetchMetrics();
  }, 5000);

  return () => clearInterval(interval);
}, []);

    

  const fetchAzureResources = async () => {
    try {
      const res = await API.get("/azure/resources");
      setAzureResources(res.data.resources);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await API.get("/azure/metrics");
      setMetrics(res.data);
    } catch (error) {
      console.log(error);
    }
  };
  const fetchSummary = async () => {
  try {
    const res = await API.get("/azure/summary");
    setSummary(res.data);
  } catch (error) {
    console.log(error);
  }
};

  const askAI = async () => {
    if (!question.trim()) return;

    const userMessage = {
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);

    setQuestion("");
    setLoading(true);

    try {
      const res = await API.post("/chat", {
        question,
      });

      const aiMessage = {
        role: "assistant",
        content: res.data.response,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.log(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Backend connection failed.",
        },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex overflow-hidden">

      {/* SIDEBAR */}
      <div className="w-72 bg-black/30 backdrop-blur-xl border-r border-slate-800 p-6 flex flex-col">

        <div>
          <h1 className="text-4xl font-bold tracking-wide">
            CloudOps AI
          </h1>

          <p className="text-slate-400 mt-2 text-sm">
            Autonomous AI Cloud Platform
          </p>
        </div>

        <button className="mt-8 bg-blue-600 hover:bg-blue-700 transition-all p-4 rounded-2xl font-semibold shadow-lg">
          + New Session
        </button>

        <div className="mt-8 space-y-4">

          <div className="bg-slate-900/70 hover:bg-slate-800 transition p-4 rounded-2xl cursor-pointer border border-slate-800">
            🚀 AKS Monitoring
          </div>

          <div className="bg-slate-900/70 hover:bg-slate-800 transition p-4 rounded-2xl cursor-pointer border border-slate-800">
            💰 Cost Optimization
          </div>

          <div className="bg-slate-900/70 hover:bg-slate-800 transition p-4 rounded-2xl cursor-pointer border border-slate-800">
            🔒 Security Analysis
          </div>

          <div className="bg-slate-900/70 hover:bg-slate-800 transition p-4 rounded-2xl cursor-pointer border border-slate-800">
            🤖 AI Remediation
          </div>

        </div>

        <div className="mt-auto">

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="text-slate-400 text-sm">
              Active Model
            </div>

            <div className="text-xl font-bold mt-2">
              Ollama Phi3
            </div>

            <div className="mt-3 text-green-400 text-sm">
              ● Online
            </div>
          </div>

        </div>

      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="bg-black/20 backdrop-blur-xl border-b border-slate-800 px-8 py-5 flex justify-between items-center">

          <div>
            <h1 className="text-3xl font-bold">
              Enterprise AI Operations Platform
            </h1>

            <p className="text-slate-400 mt-1">
              Azure • Kubernetes • Terraform • AI Agents
            </p>
          </div>

          <div className="flex gap-4">

            <div className="bg-green-500/20 border border-green-500 px-4 py-2 rounded-xl">
              Azure Connected
            </div>

            <div className="bg-blue-500/20 border border-blue-500 px-4 py-2 rounded-xl">
              MCP Active
            </div>

          </div>

        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* TOP METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">
              <div className="text-slate-400">
                CPU Usage
              </div>

              <div className="text-4xl font-bold mt-3 text-blue-400">
                {metrics.cpu_usage || 0}%
              </div>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">
              <div className="text-slate-400">
                Memory Usage
              </div>

              <div className="text-4xl font-bold mt-3 text-green-400">
                {metrics.memory_usage || 0}%
              </div>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">
              <div className="text-slate-400">
                Active Alerts
              </div>

              <div className="text-4xl font-bold mt-3 text-red-400">
                {metrics.active_alerts || 0}
              </div>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">
              <div className="text-slate-400">
                Running Nodes
              </div>

              <div className="text-4xl font-bold mt-3 text-yellow-400">
                {metrics.running_nodes || 0}
              </div>
            </div>

          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">

  <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
    <div className="text-slate-400">Resources</div>
    <div className="text-3xl font-bold text-cyan-400">
      {summary.total_resources || 0}
    </div>
  </div>

  <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
    <div className="text-slate-400">Storage</div>
    <div className="text-3xl font-bold text-blue-400">
      {summary.storage_accounts || 0}
    </div>
  </div>

  <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
    <div className="text-slate-400">Registries</div>
    <div className="text-3xl font-bold text-green-400">
      {summary.container_registries || 0}
    </div>
  </div>

  <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
    <div className="text-slate-400">Web Apps</div>
    <div className="text-3xl font-bold text-purple-400">
      {summary.web_apps || 0}
    </div>
  </div>

  <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
    <div className="text-slate-400">Container Apps</div>
    <div className="text-3xl font-bold text-yellow-400">
      {summary.container_apps || 0}
    </div>
  </div>

  <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
    <div className="text-slate-400">Databases</div>
    <div className="text-3xl font-bold text-red-400">
      {summary.databases || 0}
    </div>
  </div>

</div>

          {/* CHARTS */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* COST */}
            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">

              <h2 className="text-2xl font-bold mb-6">
                Cloud Cost Analysis
              </h2>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costData}>
                  <XAxis dataKey="name" stroke="#fff" />
                  <YAxis stroke="#fff" />
                  <Tooltip />
                  <Bar dataKey="cost" fill="#3b82f6" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>

            </div>

            {/* SECURITY */}
            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">

              <h2 className="text-2xl font-bold mb-6">
                Security Overview
              </h2>

              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={securityData}
                    dataKey="value"
                    outerRadius={100}
                    label
                  >
                    {securityData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

            </div>

            {/* CPU TREND */}
            <div className="bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-800">

              <h2 className="text-2xl font-bold mb-6">
                Live CPU Trend
              </h2>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cpuTrend}>
                  <XAxis dataKey="time" stroke="#fff" />
                  <YAxis stroke="#fff" />
                  <Tooltip />
                  <Line type="monotone" dataKey="cpu" stroke="#22c55e" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>

            </div>

          </div>

          {/* AZURE RESOURCES */}
          <div className="bg-slate-900/70 backdrop-blur-xl p-8 rounded-3xl border border-slate-800">

            <h2 className="text-3xl font-bold mb-8">
              Live Azure Resources
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

              {azureResources.map((resource, index) => (

                <div
                  key={index}
                  className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all"
                >

                  <div className="text-xl font-bold break-words">
                    {resource.name}
                  </div>

                  <div className="text-slate-400 mt-3">
                    {resource.type.split("/").pop()}
                  </div>

                  <div className="mt-3 text-blue-400">
                    {resource.location}
                  </div>

                </div>

              ))}

            </div>

          </div>

          {/* CHAT */}
          <div className="bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-800 p-8">

            <h2 className="text-3xl font-bold mb-8">
              AI Operations Assistant
            </h2>

            <div className="space-y-6">

              {messages.map((msg, index) => (

                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  <div
                    className={`max-w-4xl p-5 rounded-3xl whitespace-pre-wrap shadow-lg ${
                      msg.role === "user"
                        ? "bg-blue-600"
                        : "bg-slate-800"
                    }`}
                  >
                    {typeof msg.content === "object"
                      ? JSON.stringify(msg.content, null, 2)
                      : msg.content}
                  </div>

                </div>

              ))}

              {loading && (
                <div className="bg-slate-800 w-48 p-5 rounded-3xl">
                  AI Thinking...
                </div>
              )}

            </div>

            {/* INPUT */}
            <div className="mt-10 flex gap-4">

              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about Azure, Kubernetes, Terraform..."
                className="flex-1 bg-slate-950 border border-slate-800 text-white p-5 rounded-2xl outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    askAI();
                  }
                }}
              />

              <button
                onClick={askAI}
                className="bg-blue-600 hover:bg-blue-700 transition-all px-10 rounded-2xl font-bold"
              >
                Send
              </button>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default App;