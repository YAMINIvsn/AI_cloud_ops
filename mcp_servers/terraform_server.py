def generate_terraform(query):

    return """
resource "azurerm_resource_group" "main" {
  name     = "ai-resource-group"
  location = "Korea Central"
}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "ai-aks-cluster"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "aiaks"

  default_node_pool {
    name       = "default"
    node_count = 2
    vm_size    = "Standard_DS2_v2"
  }

  identity {
    type = "SystemAssigned"
  }
}
"""