from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from dotenv import load_dotenv
import os

load_dotenv()

credential = ClientSecretCredential(
    tenant_id=os.getenv("AZURE_TENANT_ID"),
    client_id=os.getenv("AZURE_CLIENT_ID"),
    client_secret=os.getenv("AZURE_CLIENT_SECRET")
)

client = ResourceManagementClient(
    credential,
    os.getenv("AZURE_SUBSCRIPTION_ID")
)

for resource in client.resources.list():

    if resource.name == "ca-backend-finopsai-dev":

        print("\nRESOURCE ID:\n")
        print(resource.id)