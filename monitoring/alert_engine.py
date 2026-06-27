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

    if metrics.get("total_resources", 0) > 30:

        alerts.append(
            f"Large Azure footprint: {metrics.get('total_resources', 0)} resources"
        )

    if metrics.get("security_score", 100) < 85:

        alerts.append(
            f"Security score needs review: {metrics.get('security_score', 0)}%"
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

    if metrics.get("container_apps", 0) > 0:

        scale_kubernetes()

    if metrics.get("security_score", 100) < 70:

        restart_kubernetes_deployment()

    return alerts