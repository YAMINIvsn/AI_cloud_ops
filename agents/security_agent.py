from mcp_servers.cloud_mcp_server import get_security_analysis, get_azure_resources
from agents.llm import ask_llm


SYSTEM_PROMPT = """
You are a Cloud Security Engineer specializing in Azure security posture.
You are given live security data for the user's Azure environment.
Answer the user's question using ONLY this data.
Be direct about risks. Suggest concrete remediation steps.
Do not speculate beyond what the data shows.
"""


def security_agent(query: str) -> str:
    security = get_security_analysis()
    resources = get_azure_resources()
    q = query.lower()

    if (
        "show" in q
        or "analyze" in q
        or "posture" in q
        or "score" in q
        or "security" in q
    ):
        return f"""
Security Posture
- Security Score: {security['security_score']}%
- Warnings: {security['warnings']}
- Critical Alerts: {security['critical_alerts']}
- Overall Status: {security['status']}
- Resources Scanned: {len(resources)}

Recommendation:
Review warning items first, confirm public endpoints are intentional, and add owner/environment tags to every resource.
"""

    context = f"""
Security Posture:
- Security Score: {security['security_score']}%
- Warnings: {security['warnings']}
- Critical Alerts: {security['critical_alerts']}
- Overall Status: {security['status']}

Total Resources Scanned: {len(resources)}
"""

    return ask_llm(SYSTEM_PROMPT, f"Context:\n{context}\n\nQuestion: {query}")
