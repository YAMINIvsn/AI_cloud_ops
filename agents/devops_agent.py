def devops_agent(query):

    if "deploy" in query:

        return """
Deployment Steps:

1. Build Docker Image
2. Push to ACR
3. Deploy to AKS
4. Verify Pods
"""

    if "kubernetes" in query:

        return """
Kubernetes Cluster Healthy

Pods Running: 3
Deployments: 2
Services: 1
"""

    return "DevOps Assistant Ready"