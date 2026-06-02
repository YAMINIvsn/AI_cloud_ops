import subprocess

from mcp_servers.slack_server import send_slack_alert


def restart_kubernetes_deployment():

    print("\nRestarting Kubernetes deployment...\n")

    command = """
    kubectl rollout restart deployment cloudops-ai
    """

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    print(result.stdout)
    print(result.stderr)

    send_slack_alert(
        "♻️ Kubernetes deployment restarted automatically."
    )

    return result.stdout


def scale_kubernetes():

    print("\nScaling Kubernetes deployment...\n")

    command = """
    kubectl scale deployment cloudops-ai --replicas=4
    """

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    print(result.stdout)
    print(result.stderr)

    send_slack_alert(
        "📈 Kubernetes scaled automatically."
    )

    return result.stdout