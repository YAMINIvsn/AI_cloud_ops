from azure.identity import DefaultAzureCredential
from azure.mgmt.resourcegraph import ResourceGraphClient
from azure.mgmt.resourcegraph.models import QueryRequest

credential = DefaultAzureCredential()

subscription_id = "YOUR_SUBSCRIPTION_ID"

client = ResourceGraphClient(credential)

def get_resources():

    query = QueryRequest(
        subscriptions=[subscription_id],
        query="""
        Resources
        | project name, type, location
        """
    )

    response = client.resources(query)

    return response.data