from agents.llm import ask_llm
from mcp_servers.cloud_mcp_server import get_cloudops_analytics
from mcp_servers.terraform_server import generate_terraform


SYSTEM_PROMPT = """
You are a Senior DevOps Engineer specializing in Azure, Kubernetes, Docker, and Terraform.
Answer questions about deployments, pipelines, AKS clusters, and infrastructure as code.
Give step-by-step instructions where appropriate.
Be concise and production-focused.
"""


def devops_agent(query: str) -> str:
    q = query.lower()

    if "terraform" in q and any(word in q for word in ["approval", "approvals", "review", "pending"]):
        analytics = get_cloudops_analytics()
        approvals = analytics.get("terraform_approvals", [])
        lines = ["Terraform Approvals", ""]
        for item in approvals:
            lines.append(
                f"- {item['change']}: {item['status']} "
                f"({item['risk']} risk, approver: {item['approver']})"
            )
        lines.append("")
        lines.append("Chat actions: start resource <name>, stop resource <name>, restart resource <name>, approve stop resource <name>, cancel stop resource <name>.")
        return "\n".join(lines)

    if "terraform" in q and any(word in q for word in ["generate", "create", "template", "code"]):
        return generate_terraform(query)

    return ask_llm(SYSTEM_PROMPT, query)

