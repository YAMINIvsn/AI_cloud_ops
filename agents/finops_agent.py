from mcp_servers.cloud_mcp_server import (
    format_inr,
    get_cost_analysis,
)

NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "week": 7,
    "weekly": 7,
    "month": 30,
    "monthly": 30,
}


def _extract_days(query: str) -> int | None:
    import re

    q = query.lower()
    match = re.search(r"\b(?:last|past|for|next)?\s*(\d{1,3})\s*[- ]?(?:day|days|d)\b", q)
    if match:
        return max(1, min(int(match.group(1)), 365))

    for word, days in NUMBER_WORDS.items():
        if f"{word} day" in q or f"{word} days" in q or f"last {word}" in q or f"past {word}" in q:
            return days

    if "today" in q:
        return 1
    if "yesterday" in q:
        return 1
    return None


def _format_window_spend(costs: dict, days: int) -> str:
    import calendar
    from datetime import datetime
    now = datetime.utcnow()
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    monthly_cost = costs["monthly_cost"]
    daily_run_rate = monthly_cost / days_in_month if monthly_cost else 0
    window_cost = round(daily_run_rate * days, 2)
    projected_window_cost = round(window_cost * 1.2, 2)
    resources = costs.get("spend_by_resource", [])

    lines = [
        f"Spend Analysis for {days} Day{'s' if days != 1 else ''}",
        f"- Estimated spend: {format_inr(window_cost)}",
        f"- Daily run rate: {format_inr(daily_run_rate)}",
        f"- Projected spend with 20% buffer: {format_inr(projected_window_cost)}",
        f"- Current monthly run rate: {format_inr(monthly_cost)}",
        f"- Top Resource: {costs['top_resource']}",
        "",
        "Top Resource Contributions",
    ]

    if not resources:
        lines.append("- No Azure resource cost data is available.")
    else:
        for item in resources[:5]:
            resource_window_cost = round((item["cost"] / 30) * days, 2)
            lines.append(
                f"- {item['name']} ({item['type']}): {format_inr(resource_window_cost)} "
                f"over {days} day{'s' if days != 1 else ''}"
            )

    lines.extend([
        "",
        "Note: This is an estimate based on current resource monthly run rate, not a finalized Azure invoice.",
        "How to check: Azure Portal > Cost Management + Billing > Cost analysis > choose subscription > set date range > group by Resource.",
        f"Recommendation: {costs['recommendation']}",
    ])
    return "\n".join(lines)


def finops_agent(query):

    costs = get_cost_analysis()
    days = _extract_days(query)

    if days:
        return _format_window_spend(costs, days)

    if "recommendation" in query or "suggest" in query:

        return costs["recommendation"]

    return f"""
Cost & FinOps Breakdown
- Monthly Cost: {format_inr(costs['monthly_cost'])}
- Projected Cost: {format_inr(costs['projected_cost'])}
- Top Resource: {costs['top_resource']}
- Currency: INR
- Exchange Rate Used: 1 USD = INR {costs.get('usd_to_inr_rate')}

Recommendation:
{costs['recommendation']}

How to check:
Azure Portal > Cost Management + Billing > Cost analysis > choose subscription > set date range > group by Resource.
"""