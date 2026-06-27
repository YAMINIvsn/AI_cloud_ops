import os
import subprocess
import logging
from azure.identity import ClientSecretCredential, AzureCliCredential, DefaultAzureCredential

logger = logging.getLogger("azure_auth")
logging.basicConfig(level=logging.INFO)

def get_azure_credential():
    """
    Resolves the Azure credential based on the AZURE_AUTH_METHOD environment variable or auto-detection.
    """
    auth_method = os.getenv("AZURE_AUTH_METHOD", "").strip().lower()
    
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    
    if auth_method in ("cli", "azure_cli", "azurecli"):
        logger.info("Azure Auth: Explicitly configured to use Azure CLI Authentication.")
        return AzureCliCredential()
    elif auth_method in ("default", "defaultazure", "default_azure"):
        logger.info("Azure Auth: Explicitly configured to use Default Azure Credential.")
        return DefaultAzureCredential()
    elif auth_method in ("secret", "client_secret", "clientsecret"):
        logger.info("Azure Auth: Explicitly configured to use Client Secret Authentication.")
        if not (tenant_id and client_id and client_secret):
            raise ValueError("AZURE_AUTH_METHOD set to 'secret' but AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET is missing.")
        return ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret
        )
    else:
        # Auto-detection mode
        if tenant_id and client_id and client_secret:
            logger.info("Azure Auth: Auto-detected Client Secret environment variables. Using ClientSecretCredential.")
            return ClientSecretCredential(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret
            )
        else:
            logger.info("Azure Auth: Missing Client Secret environment variables. Falling back to AzureCliCredential.")
            return AzureCliCredential()

def get_subscription_id():
    """
    Retrieves the Azure subscription ID from environment or attempts to auto-detect it using Azure CLI.
    """
    sub_id = os.getenv("AZURE_SUBSCRIPTION_ID")
    if sub_id:
        return sub_id
        
    logger.info("Azure Auth: AZURE_SUBSCRIPTION_ID is not set in environment. Attempting to auto-detect using Azure CLI...")
    try:
        # Run 'az account show --query id -o tsv' to get the current subscription ID
        # Using shell=True for Windows compatibility
        result = subprocess.run(
            ["az", "account", "show", "--query", "id", "-o", "tsv"],
            capture_output=True,
            text=True,
            shell=True,
            check=True
        )
        detected_id = result.stdout.strip()
        if detected_id:
            logger.info(f"Azure Auth: Successfully detected subscription ID from Azure CLI: {detected_id}")
            return detected_id
    except Exception as e:
        logger.warning(f"Azure Auth: Failed to auto-detect subscription ID using Azure CLI: {e}")
        
    return None
