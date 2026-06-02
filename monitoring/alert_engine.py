from sklearn import metrics

from mcp_servers.slack_server import send_slack_alert
from ai_engine.predictive_engine import (
    predict_system_health,
    recommend_scaling
)

from ai_engine.remediation_engine import (
    restart_kubernetes_deployment,
    scale_kubernetes
)
def check_cloud_health(metrics):

    alerts = []

    if metrics["cpu_usage"] > 80:

        alerts.append(
            f"🚨 HIGH CPU USAGE: {metrics['cpu_usage']}%"
        )

    if metrics["memory_usage"] > 85:

        alerts.append(
            f"🚨 HIGH MEMORY USAGE: {metrics['memory_usage']}%"
        )

    if metrics["disk_usage"] > 90:

        alerts.append(
            f"🚨 HIGH DISK USAGE: {metrics['disk_usage']}%"
        )

    return alerts

def process_alerts(metrics):

    alerts = check_cloud_health(metrics)

    for alert in alerts:

        send_slack_alert(alert)

    predictions = predict_system_health(metrics)

    recommendations = recommend_scaling(metrics)

    for prediction in predictions:

        send_slack_alert(
            f"AI Prediction: {prediction}"
        )

    for recommendation in recommendations:

        send_slack_alert(
            f"AI Recommendation: {recommendation}"
        )

    if metrics["cpu_usage"] > 90:

        scale_kubernetes()

    if metrics["memory_usage"] > 90:

        restart_kubernetes_deployment()

    return alerts