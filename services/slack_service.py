import httpx
import os

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

async def send_alert(title: str, message: str, level: str = "warning"):
    colors = {"info": "#378ADD", "warning": "#EF9F27", "critical": "#E24B4A"}
    payload = {
        "attachments": [{
            "color": colors.get(level, "#888"),
            "blocks": [
                {"type": "section", "text": {"type": "mrkdwn", "text": f"*{title}*\n{message}"}},
                {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Severity: `{level.upper()}`"}]}
            ]
        }]
    }
    async with httpx.AsyncClient() as client:
        await client.post(SLACK_WEBHOOK_URL, json=payload)