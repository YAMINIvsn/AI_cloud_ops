from mcp_servers.cloud_mcp_server import get_resource_summary

def predictive_agent():

    summary = get_resource_summary()
    total_resources = summary.get("total_resources", 0)

    if total_resources > 30:

        return {
            "risk": "HIGH",
            "prediction":
            "Resource count is growing and should be reviewed",
            "action":
            "Audit unused resources and ownership"
        }

    elif total_resources > 15:

        return {
            "risk": "MEDIUM",
            "prediction":
            "Moderate Azure footprint detected",
            "action":
            "Tag resources and review cost centers"
        }

    else:

        return {
            "risk": "LOW",
            "prediction":
            "System healthy",
            "action":
            "No action required"
        } 
