from mcp_servers.cloud_mcp_server import format_inr, get_azure_resources, request_resource_action
from agents.llm import ask_llm


SYSTEM_PROMPT = """
You are a Senior Azure CloudOps Engineer.
You are given live infrastructure metrics and resource data.
Answer the user's question using ONLY this data.
Be concise, factual, and actionable.
Do not make up data not present in the context.
"""


def operations_agent(query: str) -> str:
    resources = get_azure_resources()
    q = query.lower()

    if any(word in q for word in ["start", "stop", "restart", "scale", "status"]):
        result = request_resource_action(query)
        if result.get("handled"):
            return result["message"]

    if "list" in q or "show" in q or "resource" in q or "inventory" in q:
        if not resources:
            return "No Azure resources were found for this subscription."

        lines = [
            "Azure Resources",
            f"Total: {len(resources)}",
            "",
        ]

        for resource in resources[:25]:
            resource_type = resource["type"].split("/")[-1]
            status = resource.get("status", "Running")
            cost = resource.get("estimated_monthly_cost", 0)
            lines.append(
                f"- {resource['name']} ({resource_type}) in {resource['location']} | {status} | {format_inr(cost)}/mo"
            )

        if len(resources) > 25:
            lines.append(f"\nShowing first 25 of {len(resources)} resources.")

        return "\n".join(lines)

    context = f"""
Total Resources: {len(resources)}
Resource List (first 10):
{chr(10).join(f"- {r['name']} ({r['type'].split('/')[-1]}) in {r['location']}" for r in resources[:10])}
"""

    return ask_llm(SYSTEM_PROMPT, f"Context:\n{context}\n\nQuestion: {query}")
