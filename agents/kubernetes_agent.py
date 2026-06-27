from agents.llm import ask_llm
from mcp_servers.cloud_mcp_server import get_azure_resources, get_resource_summary

SYSTEM_PROMPT = """
You are a Senior Kubernetes and Azure AKS Engineer.
Answer questions about AKS clusters, pods, deployments, services, and kubectl commands.
Be concise and production-focused. Give step-by-step kubectl commands where relevant.
"""

def kubernetes_agent(query: str) -> str:
    q = query.lower()
    resources = get_azure_resources()
    summary = get_resource_summary()

    # Find AKS clusters in the subscription
    aks_clusters = [r for r in resources if "managedclusters" in r["type"].lower()]
    container_apps = [r for r in resources if "containerapps" in r["type"].lower()]

    if any(word in q for word in ["status", "cluster", "list", "show", "health"]):
        lines = ["Kubernetes / AKS Status", ""]

        if aks_clusters:
            lines.append(f"AKS Clusters ({len(aks_clusters)} found):")
            for c in aks_clusters:
                lines.append(f"  - {c['name']} in {c['location']} | {c.get('status','Running')}")
        else:
            lines.append("AKS Clusters: None found in subscription.")

        lines.extend([
            "",
            f"Container Apps: {len(container_apps)} running",
        ])
        for app in container_apps:
            lines.append(f"  - {app['name']} in {app['location']} | {app.get('status','Running')}")

        lines.extend([
            "",
            "To connect kubectl to your AKS cluster:",
            "  az aks get-credentials --resource-group <rg> --name <cluster-name>",
            "  kubectl get pods --all-namespaces",
            "  kubectl get nodes",
        ])
        return "\n".join(lines)

    context = f"""
AKS Clusters found: {len(aks_clusters)}
Cluster names: {[c['name'] for c in aks_clusters]}
Container Apps: {len(container_apps)}
Total subscription resources: {summary.get('total_resources', 0)}
"""
    return ask_llm(SYSTEM_PROMPT, f"Context:\n{context}\n\nQuestion: {query}")