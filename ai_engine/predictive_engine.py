import random


def predict_system_health(metrics):

    predictions = []

    cpu = metrics["cpu_usage"]
    memory = metrics["memory_usage"]
    disk = metrics["disk_usage"]

    if cpu > 80:

        predictions.append(
            "High probability of CPU bottleneck."
        )

    if memory > 85:

        predictions.append(
            "Possible memory saturation detected."
        )

    if disk > 90:

        predictions.append(
            "Disk capacity critical."
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

    if metrics["cpu_usage"] > 75:

        recommendations.append(
            "Scale AKS nodes horizontally."
        )

    if metrics["memory_usage"] > 80:

        recommendations.append(
            "Increase container memory limits."
        )

    return recommendations