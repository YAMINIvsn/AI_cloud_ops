from mcp_servers.cloud_mcp_server import get_azure_resources


def operations_agent(query):

    resources = get_azure_resources()

    formatted = ""

    for resource in resources:
        formatted += f"""
Name: {resource['name']}
Type: {resource['type']}
Location: {resource['location']}

"""

    return f"""
Live Azure Resource Report

{formatted}
"""