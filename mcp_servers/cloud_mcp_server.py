from mcp.server.fastmcp import FastMCP

from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.monitor import MonitorManagementClient
from datetime import datetime, timedelta
from dotenv import load_dotenv

import os
import random

# Load .env
load_dotenv()

# MCP Server
mcp = FastMCP("CloudOpsMCP")

# Azure Authentication
credential = ClientSecretCredential(
    tenant_id=os.getenv("AZURE_TENANT_ID"),
    client_id=os.getenv("AZURE_CLIENT_ID"),
    client_secret=os.getenv("AZURE_CLIENT_SECRET")
)

subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")

# Azure Resource Client
resource_client = ResourceManagementClient(
    credential,
    subscription_id
)

# Azure Monitor Client
monitor_client = MonitorManagementClient(
    credential,
    subscription_id
)


@mcp.tool()
def get_azure_resources():
    """
    Get all Azure resources from subscription
    """

    resources = []

    try:

        for resource in resource_client.resources.list():

            resources.append({
                "name": resource.name,
                "type": resource.type,
                "location": resource.location
            })

    except Exception as e:

        print("Azure Resource Error:", e)

    return resources


@mcp.tool()
def get_cost_analysis():

    return {
        "monthly_cost": "$4200",
        "highest_service": "AKS",
        "recommendation": "Enable cluster autoscaling"
    }


@mcp.tool()
def check_security_alerts():

    return {
        "critical_alerts": 2,
        "status": "Action Required"
    }


def get_live_metrics():

    resource_id = (
        "/subscriptions/d91323a4-7619-4450-8e88-c17d3cd3df5e"
        "/resourceGroups/yamini_cloudops-ai-rg"
        "/providers/Microsoft.App/containerApps/ca-backend-finopsai-dev"
    )

    try:

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)

        metrics = monitor_client.metrics.list(
            resource_id,
            timespan=f"{start_time}/{end_time}",
            interval="PT5M",
            metricnames="CpuPercentage",
            aggregation="Average"
        )

        cpu_usage = 0

        for metric in metrics.value:
            for ts in metric.timeseries:
                for point in ts.data:
                    if point.average is not None:
                        cpu_usage = round(point.average, 2)

        return {
            "cpu_usage": cpu_usage,
            "memory_usage": 0,
            "disk_usage": 0,
            "active_alerts": 0,
            "aks_health": "Healthy",
            "running_nodes": 1
        }

    except Exception as e:

        import traceback

        print("\n========================")
        print("AZURE MONITOR ERROR")
        print("========================")
        traceback.print_exc()

        return {
        "cpu_usage": 0,
        "memory_usage": 0,
        "disk_usage": 0,
        "active_alerts": 0,
        "aks_health": "Unknown",
        "running_nodes": 0
    }
from collections import Counter

@mcp.tool()
def get_resource_summary():

    resources = get_azure_resources()

    total_resources = len(resources)

    resource_types = Counter(
        r["type"].split("/")[-1]
        for r in resources
    )

    return {
        "total_resources": total_resources,
        "storage_accounts": resource_types.get("storageAccounts", 0),
        "container_registries": resource_types.get("registries", 0),
        "web_apps": resource_types.get("sites", 0),
        "container_apps": resource_types.get("containerApps", 0),
        "databases": resource_types.get("flexibleServers", 0)
    }

if __name__ == "__main__":
    mcp.run()