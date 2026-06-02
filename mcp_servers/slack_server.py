import requests

import os

SLACK_WEBHOOK= os.getenv("SLACK_WEBHOOK_URL")

def send_slack_alert(message):

    payload = {
        "text": message
    }

    response = requests.post(
        SLACK_WEBHOOK,
        json=payload
    )

    if response.status_code == 200:

        return "Slack alert sent successfully."

    else:

        return f"Failed to send alert: {response.text}"