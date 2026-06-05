import ollama

# ✅ Fixed: removed trailing comma after last import (harmless but clean)
from mcp_servers.cloud_mcp_server import (
    get_live_metrics,
    get_cost_analysis,
    get_security_analysis,
)


def rootcause_agent():
    metrics = get_live_metrics()
    costs = get_cost_analysis()
    security = get_security_analysis()

    prompt = f"""
You are a Senior CloudOps Engineer.

Analyze the following Azure environment.

Metrics:
CPU Usage: {metrics['cpu_usage']}%
Memory Usage: {metrics['memory_usage']}%
Disk Usage: {metrics['disk_usage']}%
Active Alerts: {metrics['active_alerts']}

Cost Data:
Monthly Cost: {costs['monthly_cost']}
Projected Cost: {costs['projected_cost']}
Top Service: {costs['top_service']}

Security:
Score: {security['security_score']}
Warnings: {security['warnings']}
Critical Alerts: {security['critical_alerts']}

Provide:

1. Root Cause Analysis
2. Risks
3. Recommendations
4. Priority Level

Keep response concise.
"""

    response = ollama.chat(
        model="phi3",
        messages=[{"role": "user", "content": prompt}],
    )

    return response["message"]["content"]