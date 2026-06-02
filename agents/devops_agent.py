from mcp_servers.terraform_server import generate_terraform
from mcp_servers.docker_server import generate_dockerfile
from mcp_servers.kubernetes_server import generate_kubernetes_yaml

def devops_agent(query):

    terraform = generate_terraform(query)

    dockerfile = generate_dockerfile(query)

    kubernetes = generate_kubernetes_yaml(query)

    return {
        "terraform": terraform,
        "dockerfile": dockerfile,
        "kubernetes": kubernetes
    }