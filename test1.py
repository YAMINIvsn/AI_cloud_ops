from monitoring.alert_engine import process_alerts

metrics = {

    "cpu_usage": 96,
    "memory_usage": 93,
    "disk_usage": 88
}

print("STARTING AI REMEDIATION TEST...\n")

alerts = process_alerts(metrics)

print("\nALERTS GENERATED:\n")

print(alerts)

print("\nAUTO-REMEDIATION COMPLETED.")