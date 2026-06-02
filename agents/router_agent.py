from agents.operations_agent import operations_agent
from agents.finops_agent import finops_agent
from agents.security_agent import security_agent
from agents.devops_agent import devops_agent

def router_agent(query):

    query = query.lower()

    if (
        "deploy" in query
        or "docker" in query
        or "terraform" in query
        or "kubernetes" in query
        or "aks" in query
    ):

        return devops_agent(query)

    elif "cost" in query or "bill" in query:

        return finops_agent(query)

    elif "security" in query:

        return security_agent(query)

    else:

        return operations_agent(query)