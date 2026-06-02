from mcp_servers.cloud_mcp_server import check_security_alerts


def security_agent(query):

    alerts = check_security_alerts()

    return f"""
Security Report

Critical Alerts:
{alerts['critical_alerts']}

Status:
{alerts['status']}
"""