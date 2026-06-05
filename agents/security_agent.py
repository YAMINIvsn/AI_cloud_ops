# ✅ Fixed: get_security_posture does not exist — correct function is get_security_analysis
from mcp_servers.cloud_mcp_server import get_security_analysis


def security_agent(query):
    security = get_security_analysis()

    return f"""
Security Score: {security['security_score']}%

Warnings: {security['warnings']}
Critical Alerts: {security['critical_alerts']}

Status:
{security['status']}
"""
# ✅ Fixed: security['recommendation'] does not exist in get_security_analysis
#    the correct key is security['status']