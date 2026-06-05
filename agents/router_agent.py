from agents.operations_agent import operations_agent
from agents.finops_agent import finops_agent
from agents.security_agent import security_agent
from agents.devops_agent import devops_agent

# ---------------------------------------------------------------------------
# Guardrail keyword list — only these topics are allowed through to agents.
# Anything outside this set gets blocked before any LLM call is made.
# ---------------------------------------------------------------------------
ALLOWED_TOPICS = [
    # infrastructure & cloud
    "azure", "cloud", "resource", "subscription", "tenant",
    # compute & containers
    "cpu", "memory", "disk", "node", "pod", "container", "aks",
    "kubernetes", "docker", "deploy", "deployment", "replica", "scale",
    # cost & billing
    "cost", "bill", "budget", "spend", "pricing", "saving", "estimate",
    # security
    "security", "alert", "threat", "vulnerability", "compliance",
    "score", "warning", "critical",
    # devops & infra-as-code
    "terraform", "pipeline", "ci", "cd", "devops", "release",
    # monitoring & ops
    "metric", "monitor", "log", "trace", "health", "status",
    "uptime", "latency", "throughput", "incident",
    # storage & networking
    "storage", "blob", "network", "firewall", "vnet", "subnet",
    # databases
    "database", "db", "postgres", "mysql", "server",
    # general ops
    "service", "app", "registry", "backup", "restore",
]

OUT_OF_SCOPE_REPLY = (
    "⚠️ I'm a CloudOps AI assistant. I can only answer questions about "
    "Azure infrastructure, Kubernetes, costs, security, and DevOps operations. "
    "Please ask something related to your cloud environment."
)


def is_in_scope(query: str) -> bool:
    """Return True only if the query contains at least one allowed keyword."""
    q = query.lower()
    return any(keyword in q for keyword in ALLOWED_TOPICS)


def router_agent(query: str) -> str:
    # --- Guardrail check FIRST — before any agent or LLM is called ---
    if not is_in_scope(query):
        return OUT_OF_SCOPE_REPLY

    q = query.lower()

    if (
        "deploy" in q
        or "docker" in q
        or "terraform" in q
        or "kubernetes" in q
        or "aks" in q
    ):
        return devops_agent(q)

    elif "cost" in q or "bill" in q or "spend" in q or "budget" in q:
        return finops_agent(q)

    elif "security" in q or "alert" in q or "threat" in q or "compliance" in q:
        return security_agent(q)

    else:
        return operations_agent(q)