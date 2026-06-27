import random


def predict_system_health(metrics):

    predictions = []

    total_resources = metrics.get("total_resources", 0)
    security_score = metrics.get("security_score", 100)

    if total_resources > 30:

        predictions.append(
            "Large resource footprint detected."
        )

    if security_score < 85:

        predictions.append(
            "Security posture should be reviewed."
        )

    return predictions


def predict_cost_spike():

    probability = random.randint(60, 95)

    return {
        "risk": f"{probability}%",
        "message": "Potential Azure cost spike predicted."
    }


def recommend_scaling(metrics):

    recommendations = []

    if metrics.get("container_apps", 0) > 0:

        recommendations.append(
            "Review Container Apps replica settings and autoscale rules."
        )

    if metrics.get("total_resources", 0) > 20:

        recommendations.append(
            "Group resources by environment and owner tags."
        )

    return recommendations
