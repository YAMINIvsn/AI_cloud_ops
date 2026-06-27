import requests
import os

SLACK_WEBHOOK_URL= os.getenv("SLACK_WEBHOOK_URL")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")




def send_slack_alert(message):

    payload = {
        "text": message
    }

    response = requests.post(
        SLACK_WEBHOOK_URL,
        json=payload
    )

    return response.status_code