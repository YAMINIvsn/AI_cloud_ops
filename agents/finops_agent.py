from mcp_servers.cloud_mcp_server import get_cost_analysis


def finops_agent(query):

    cost = get_cost_analysis()

    return f"""
FinOps Report

Monthly Cost:
{cost['monthly_cost']}

Highest Service Cost:
{cost['highest_service']}

Recommendation:
{cost['recommendation']}
"""