from mcp_servers.cloud_mcp_server import (
    get_live_metrics
)

def predictive_agent():

    metrics = get_live_metrics()

    cpu = metrics["cpu_usage"]

    if cpu > 80:

        return {
            "risk": "HIGH",
            "prediction":
            "CPU likely to exceed threshold in next 30 mins",
            "action":
            "Scale container replicas"
        }

    elif cpu > 60:

        return {
            "risk": "MEDIUM",
            "prediction":
            "Moderate resource pressure detected",
            "action":
            "Monitor workload"
        }

    else:

        return {
            "risk": "LOW",
            "prediction":
            "System healthy",
            "action":
            "No action required"
        } 