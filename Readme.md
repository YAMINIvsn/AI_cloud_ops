# CloudOps AI Platform

A Generative AI-powered cloud operations platform that enables natural-language interaction with live Microsoft Azure infrastructure. The system combines an AI chat assistant, real-time cost analytics, anomaly detection, and a human-in-the-loop approval workflow for executing infrastructure changes safely.

## Overview

CloudOps AI Platform lets users query and manage their Azure environment using plain English instead of navigating the Azure Portal. The AI assistant interprets user intent, retrieves live data through a tool-calling backend, and can trigger infrastructure actions (start, stop, restart, scale) through a structured approval process before anything is executed against Azure.

## Key Features

- **AI Chat Assistant** — Natural-language interface for querying costs, security findings, resource status, and operational health, with guardrails to keep responses scoped to relevant, safe operations.
- **Intelligent Automation** — Maps user intent to specific resources and actions, then routes the request through a human approval step before calling the Azure REST API.
- **Tool-Calling Backend (MCP)** — Built with FastMCP (Model Context Protocol), exposing Azure operations as structured tools the AI model can reliably call.
- **Live Resource Inventory** — Real-time resource listing with accurate VM power-state detection (Running, Stopped, Deallocated, etc.) via Azure Compute and Resource Management APIs.
- **Cost Analytics & Forecasting** — Fetches actual billed costs from Azure Cost Management, with a weighted linear regression model that forecasts 30-day spend, weighting recent days more heavily for responsiveness to usage changes.
- **Dynamic Anomaly Detection** — Flags cost spikes, day-over-day spend surges, single-resource cost concentration, governance drift (untagged resources), stopped-but-billing resources, high CPU/memory usage, and stale approvals — all derived from live data rather than hardcoded rules.
- **Security Posture Analysis** — Computes a security score and surfaces findings such as missing tags and unreviewed public-facing services.
- **Live Metrics Monitoring** — Pulls CPU and memory metrics for container apps from Azure Monitor on a rolling basis.
- **Approval Workflow** — All AI-suggested or user-requested infrastructure changes require explicit approval before execution, with a dedicated approvals inbox.
- **Interactive Dashboard** — React-based frontend with cost charts, security visualizations, resource cards, drill-down views, session-based chat history, and exportable reports (CSV/JSON).

## Tech Stack

**Backend**
- Python, FastMCP (Model Context Protocol server)
- Azure SDKs: Resource Management, Cost Management, Monitor, Compute, Web
- ThreadPoolExecutor for parallel data fetching
- REST API calls to Azure Management endpoints for resource actions

**Frontend**
- React (functional components, hooks)
- Recharts for data visualization
- Local session persistence

## Architecture

```
User (natural language) 
   → AI Chat Assistant 
   → FastMCP Tool Layer 
   → Azure APIs (Resource Mgmt / Cost Mgmt / Monitor)
   → Structured response back to UI
   
Action Request 
   → Approval Workflow (Pending → Approved/Rejected) 
   → Azure REST API execution
```

## Core Modules

| Module | Description |
|---|---|
| `get_azure_resources()` | Retrieves live resource inventory with real VM power states |
| `get_cost_analysis()` | Fetches actual costs, computes forecasts via weighted regression |
| `get_live_metrics()` | Pulls CPU/memory metrics for container apps |
| `get_security_analysis()` | Computes security score and findings |
| `_detect_anomalies()` | Dynamic anomaly detection across cost, resource, and metric data |
| `request_resource_action()` | Creates an approval request for a resource action |
| `_execute_azure_action()` | Executes approved start/stop/restart/scale actions via Azure REST API |

## What This Project Demonstrates

- Building tool-augmented AI assistants using the Model Context Protocol
- Designing guardrails and approval workflows for safe AI-driven automation
- Integrating LLM-based assistants with real-world cloud APIs and live data
- Time-series forecasting and anomaly detection on operational data
- Full-stack development connecting a Python backend to a React frontend
- Practical experience with Azure Resource Management, Cost Management, and Monitor APIs

## License

Internal/educational project. Not licensed for production use without further security review.