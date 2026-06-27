from mcp_servers.cloud_mcp_server import (
    format_inr,
    get_azure_resources,
    get_cloudops_analytics,
    get_cost_analysis,
    get_security_analysis,
)


def combined_agent(query: str) -> str:
    resources = get_azure_resources()
    costs = get_cost_analysis()
    security = get_security_analysis()
    analytics = get_cloudops_analytics()

    top_resources = analytics["spend_by_resource"][:5]
    findings = analytics["security_findings"][:5]
    anomalies = analytics["anomalies"][:5]
    approvals = analytics["terraform_approvals"][:5]

    lines = [
        "Combined CloudOps Summary",
        "",
        "Cost & FinOps",
        f"- Monthly Cost: {format_inr(costs['monthly_cost'])}",
        f"- Projected Cost: {format_inr(costs['projected_cost'])}",
        f"- Top Resource: {costs['top_resource']}",
        f"- Currency: INR",
        f"- Exchange Rate Used: 1 USD = INR {costs.get('usd_to_inr_rate')}",
        "",
        "Spend by Resource",
    ]

    lines.extend(
        f"- {item['name']} ({item['type']}): {format_inr(item['cost'])}/mo in {item['location']}"
        for item in top_resources
    )

    lines.extend([
        "",
        "Security",
        f"- Score: {security['security_score']}%",
        f"- Warnings: {security['warnings']}",
        f"- Critical Alerts: {security['critical_alerts']}",
        f"- Status: {security['status']}",
        "",
        "Security Findings",
    ])
    lines.extend(
        f"- [{item['severity']}] {item['title']}: {item['detail']}"
        for item in findings
    )

    lines.extend([
        "",
        "Resources",
        f"- Total Resources: {len(resources)}",
    ])
    lines.extend(
        f"- {resource['name']} ({resource['type'].split('/')[-1]}) in {resource['location']}"
        for resource in resources[:10]
    )

    lines.extend([
        "",
        "30-Day Forecast",
    ])
    lines.extend(
        f"- {item['day']}: {format_inr(item['forecast'])}"
        for item in analytics["forecast_30d"]
    )

    lines.extend([
        "",
        "Anomaly Detection",
    ])
    lines.extend(
        f"- [{item['severity']}] {item['signal']}: {item['detail']}"
        for item in anomalies
    )

    lines.extend([
        "",
        "Terraform Approvals",
    ])
    lines.extend(
        f"- {item['change']}: {item['status']} ({item['risk']} risk, approver: {item['approver']})"
        for item in approvals
    )

    lines.extend([
        "",
        "Recommended Next Steps",
        "- Add budget alerts for projected spend.",
        "- Review public-facing services and missing tags.",
        "- Approve Terraform changes only after cost and security review.",
    ])

    return "\n".join(lines)
