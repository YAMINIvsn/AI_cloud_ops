from agents.llm import ask_llm
from mcp_servers.cloud_mcp_server import (
    format_inr,
    get_cost_analysis,
    get_security_analysis,
)

SYSTEM_PROMPT = """
You are a Senior Azure CloudOps Engineer performing root cause analysis.
You are given live metrics, cost data, and security posture from an Azure environment.
Provide a structured analysis with:
1. Root Cause Analysis
2. Identified Risks
3. Recommendations
4. Priority Level (Low / Medium / High)
Be concise, factual, and actionable. Only use the data provided.
"""


def rootcause_agent() -> str:
    costs    = get_cost_analysis()
    security = get_security_analysis()

    context = f"""
Cost Data:
- Monthly Cost: {format_inr(costs['monthly_cost'])}
- Projected Cost: {format_inr(costs['projected_cost'])}
- Top Resource: {costs['top_resource']}
- Currency: INR
- Exchange Rate Used: 1 USD = INR {costs.get('usd_to_inr_rate')}

Security:
- Score: {security['security_score']}
- Warnings: {security['warnings']}
- Critical Alerts: {security['critical_alerts']}
"""

    return ask_llm(SYSTEM_PROMPT, context)
