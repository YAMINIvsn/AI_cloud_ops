from ai_engine.predictive_engine import (
    predict_system_health,
    predict_cost_spike,
    recommend_scaling
)

metrics = {

    "cpu_usage": 88,
    "memory_usage": 84,
    "disk_usage": 92
}

health = predict_system_health(metrics)

cost = predict_cost_spike()

scaling = recommend_scaling(metrics)

print("\nHEALTH PREDICTIONS")
print(health)

print("\nCOST PREDICTION")
print(cost)

print("\nSCALING RECOMMENDATIONS")
print(scaling)