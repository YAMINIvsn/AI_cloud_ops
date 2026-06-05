from mcp_servers.cloud_mcp_server import (
    get_cost_analysis
)

def finops_agent(query):

    costs = get_cost_analysis()

    if "recommendation" in query:

        return costs["recommendation"]

    return f"""
Monthly Cost: ${costs['monthly_cost']}
Projected Cost: ${costs['projected_cost']}
Top Service: {costs['top_service']}

Recommendation:
{costs['recommendation']}
"""