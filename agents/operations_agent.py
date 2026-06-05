from mcp_servers.cloud_mcp_server import (
    get_live_metrics,
    get_azure_resources
)

def operations_agent(query):

    metrics = get_live_metrics()
    resources = get_azure_resources()

    if "resource" in query:

        return {
            "total_resources": len(resources),
            "resources": resources[:10]
        }

    if "cpu" in query:

        return f"""
CPU Usage: {metrics['cpu_usage']}%
Memory Usage: {metrics['memory_usage']}%
Running Nodes: {metrics['running_nodes']}
"""from mcp_servers.cloud_mcp_server import get_live_metrics, get_azure_resources
from agents.llm import ask_llm


SYSTEM_PROMPT = """
You are a Senior Azure CloudOps Engineer.
You are given live infrastructure metrics and resource data.
Answer the user's question using ONLY this data.
Be concise, factual, and actionable.
Do not make up data not present in the context.
"""


def operations_agent(query: str) -> str:
    metrics = get_live_metrics()
    resources = get_azure_resources()

    context = f"""
Live Metrics:
- CPU Usage: {metrics['cpu_usage']}%
- Memory Usage: {metrics['memory_usage']}%
- Disk Usage: {metrics['disk_usage']}%
- Active Alerts: {metrics['active_alerts']}
- AKS Health: {metrics['aks_health']}
- Running Nodes: {metrics['running_nodes']}

Total Resources: {len(resources)}
Resource List (first 10):
{chr(10).join(f"- {r['name']} ({r['type'].split('/')[-1]}) in {r['location']}" for r in resources[:10])}
"""

    return ask_llm(SYSTEM_PROMPT, f"Context:\n{context}\n\nQuestion: {query}")

    return {
        "metrics": metrics,
        "resource_count": len(resources)
    }