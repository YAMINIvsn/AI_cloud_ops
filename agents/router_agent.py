from agents.operations_agent import operations_agent
from agents.finops_agent import finops_agent
from agents.security_agent import security_agent
from agents.devops_agent import devops_agent
from agents.combined_agent import combined_agent
from agents.llm import ask_llm

# ---------------------------------------------------------------------------
# GUARDRAIL — Prompt injection blocklist only
# Topic routing is now handled by the LLM classifier, not keywords.
# ---------------------------------------------------------------------------
INJECTION_PATTERNS = [
    "ignore previous", "ignore all", "forget instructions",
    "forget your instructions", "you are now", "pretend you are",
    "jailbreak", "dan mode", "override", "disregard",
    "do anything now", "bypass",
]

INJECTION_REPLY = (
    "🚫 That request cannot be processed. "
    "Please ask a genuine question about your cloud infrastructure."
)

OUT_OF_SCOPE_REPLY = (
    "⚠️ I'm a CloudOps AI assistant. I can only answer questions about "
    "Azure infrastructure, Kubernetes, costs, security, and DevOps operations. "
    "Please ask something related to your cloud environment."
)

CLASSIFIER_PROMPT = """
You are a router for a CloudOps AI assistant. Classify the user query into exactly one of these categories:

- finops       → cost, billing, spend, budget, savings, forecast, pricing, INR
- security     → security score, alerts, threats, compliance, vulnerabilities, findings
- devops       → deploy, docker, kubernetes, AKS, terraform, pipeline, CI/CD
- operations   → resources, metrics, CPU, memory, nodes, status, start, stop, restart
- combined     → query spans multiple topics (cost + security, operations + forecast, etc.)
- out_of_scope → completely unrelated to cloud infrastructure

Reply with ONLY the single category word, nothing else.
"""


def is_injection(query: str) -> bool:
    q = query.lower()
    return any(pattern in q for pattern in INJECTION_PATTERNS)


def guardrail_check(query: str) -> str | None:
    if is_injection(query):
        return INJECTION_REPLY
    return None


def classify_intent(query: str) -> str:
    """Use the LLM to classify the query intent — much more flexible than keywords."""
    try:
        result = ask_llm(CLASSIFIER_PROMPT, query, model=None)
        category = result.strip().lower().split()[0]
        valid = {"finops", "security", "devops", "operations", "combined", "out_of_scope"}
        return category if category in valid else "operations"
    except Exception:
        return "operations"


def router_agent(query: str) -> str:
    # Guardrail: injection check only
    block = guardrail_check(query)
    if block:
        return block

    # LLM-based intent classification
    intent = classify_intent(query)

    if intent == "out_of_scope":
        return OUT_OF_SCOPE_REPLY
    elif intent == "finops":
        return finops_agent(query)
    elif intent == "security":
        return security_agent(query)
    elif intent == "devops":
        return devops_agent(query)
    elif intent == "combined":
        return combined_agent(query)
    else:
        return operations_agent(query)