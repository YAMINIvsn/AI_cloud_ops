from mcp.server.fastmcp import FastMCP

from mcp_servers.azure_auth import get_azure_credential, get_subscription_id
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.monitor import MonitorManagementClient
# azure-mgmt-compute and azure-mgmt-web loaded lazily to avoid import errors
from azure.mgmt.costmanagement import CostManagementClient
from azure.mgmt.costmanagement.models import (
    QueryDefinition, QueryTimePeriod, QueryDataset,
    QueryAggregation, QueryGrouping, TimeframeType,
)
from datetime import datetime, timedelta
from collections import Counter
from dotenv import load_dotenv

import os
import traceback

load_dotenv()

mcp = FastMCP("CloudOpsMCP")

RESOURCE_ACTIONS = {}
_RESOURCE_CACHE = []  # patched immediately on approve/reject so UI stays consistent
_COST_CACHE = {}        # cached cost analysis, refreshed every 10 min
_COST_CACHE_TS = 0      # timestamp of last cost fetch
COST_CACHE_TTL = 600    # 10 minutes

credential = get_azure_credential()
subscription_id = get_subscription_id()

if not subscription_id:
    raise ValueError(
        "Azure Subscription ID could not be resolved. "
        "Please set AZURE_SUBSCRIPTION_ID in your .env file or run 'az login' to authenticate via Azure CLI."
    )

SCOPE = f"/subscriptions/{subscription_id}"

resource_client    = ResourceManagementClient(credential, subscription_id)
monitor_client     = MonitorManagementClient(credential, subscription_id)
cost_client        = CostManagementClient(credential)
# compute_client and web_client instantiated lazily inside _execute_azure_action

USD_TO_INR_RATE = float(os.getenv("AZURE_USD_TO_INR_RATE", "83.5"))


def to_inr(amount, currency: str = "USD"):
    value = float(amount or 0)
    if currency.upper() == "INR":
        return round(value, 2)
    return round(value * USD_TO_INR_RATE, 2)


def format_inr(amount):
    value = round(float(amount or 0), 2)
    whole, dot, decimal = f"{value:.2f}".partition(".")
    if len(whole) > 3:
        last_three = whole[-3:]
        rest = whole[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        whole = ",".join(groups + [last_three])
    return f"₹{whole}{dot}{decimal}"


# ── Real Azure Cost Management API call ──────────────────────────────────────
def _fetch_real_costs_by_resource() -> list[dict]:
    """
    Calls Azure Cost Management API to get actual billed cost
    per resource for the current calendar month in USD → INR.
    Returns a list sorted by cost descending.
    """
    try:
        now = datetime.utcnow()
        # Current month start → today
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end   = now

        query = QueryDefinition(
            type="ActualCost",
            timeframe=TimeframeType.MONTH_TO_DATE,
            dataset=QueryDataset(
                granularity="None",
                aggregation={
                    "totalCost": QueryAggregation(name="PreTaxCost", function="Sum")
                },
                grouping=[
                    QueryGrouping(type="Dimension", name="ResourceId"),
                    QueryGrouping(type="Dimension", name="ResourceType"),
                    QueryGrouping(type="Dimension", name="ResourceLocation"),
                ],
            ),
        )

        result = cost_client.query.usage(scope=SCOPE, parameters=query)

        rows = result.rows or []
        col_names = [c.name.lower() for c in (result.columns or [])]

        def _col(row, *candidates):
            for name in candidates:
                if name in col_names:
                    idx = col_names.index(name)
                    if idx < len(row):
                        return row[idx]
            return None

        spend = []
        for row in rows:
            cost_raw      = float(_col(row, "pretaxcost", "cost") or row[0] or 0)
            currency      = str(_col(row, "currency") or "INR")
            resource_id   = str(_col(row, "resourceid") or "")
            # Extract readable name from resource ID (last segment)
            resource_name = resource_id.split("/")[-1] if resource_id else "Unknown"
            resource_type = str(_col(row, "resourcetype") or "").split("/")[-1]
            location      = str(_col(row, "resourcelocation") or "global")

            cost_inr = to_inr(cost_raw, currency)
            if cost_inr > 0:
                spend.append({
                    "name":     resource_name,
                    "type":     resource_type,
                    "location": location,
                    "cost":     cost_inr,
                    "status":   RESOURCE_ACTIONS.get(resource_name.lower(), {}).get("resource_status", "Running"),
                })

        return sorted(spend, key=lambda x: x["cost"], reverse=True)

    except Exception as e:
        print(f"[Cost API Error] {e}")
        traceback.print_exc()
        return []


def _fetch_monthly_total_usd() -> float:
    """Fetch total spend for current month from Cost Management."""
    try:
        now   = datetime.utcnow()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end   = now

        query = QueryDefinition(
            type="ActualCost",
            timeframe=TimeframeType.CUSTOM,
            time_period=QueryTimePeriod(from_property=start, to=end),
            dataset=QueryDataset(
                granularity="None",
                aggregation={"totalCost": QueryAggregation(name="Cost", function="Sum")},
            ),
        )
        result = cost_client.query.usage(scope=SCOPE, parameters=query)
        rows = result.rows or []
        if not rows:
            return 0.0
        # Use column metadata to find the cost column index
        col_names = [c.name.lower() for c in (result.columns or [])]
        cost_idx = next(
            (col_names.index(n) for n in ("cost", "pretaxcost") if n in col_names),
            0,
        )
        curr_idx = next(
            (col_names.index(n) for n in ("currency",) if n in col_names),
            None,
        )
        total_raw = sum(float(row[cost_idx] or 0) for row in rows)
        currency = str(rows[0][curr_idx]) if (curr_idx is not None and rows) else "USD"
        return to_inr(total_raw, currency)
    except Exception as e:
        print(f"[Monthly Total Error] {e}")
        return 0.0


def _fetch_daily_cost_trend() -> list[dict]:
    """Fetch last 30 days of daily cost from Cost Management."""
    try:
        end   = datetime.utcnow()
        start = end - timedelta(days=29)

        query = QueryDefinition(
            type="ActualCost",
            timeframe=TimeframeType.CUSTOM,
            time_period=QueryTimePeriod(from_property=start, to=end),
            dataset=QueryDataset(
                granularity="Daily",
                aggregation={"totalCost": QueryAggregation(name="Cost", function="Sum")},
            ),
        )
        result = cost_client.query.usage(scope=SCOPE, parameters=query)
        rows   = result.rows or []

        col_names = [c.name.lower() for c in (result.columns or [])]
        cost_idx = next(
            (col_names.index(n) for n in ("cost", "pretaxcost") if n in col_names),
            0,
        )
        date_idx = next(
            (col_names.index(n) for n in ("usagedate", "date", "billingperiodstartdate") if n in col_names),
            1,
        )

        trend = []
        for row in rows:
            cost_raw = float(row[cost_idx] or 0)
            curr_idx2 = next(
                (col_names.index(n) for n in ("currency",) if n in col_names),
                None,
            )
            row_currency = str(row[curr_idx2]) if (curr_idx2 is not None and curr_idx2 < len(row)) else "USD"
            cost_inr_day = to_inr(cost_raw, row_currency)
            # Azure returns dates as int 20240601 or float 20240601.0 — normalise to string
            raw_date = str(int(float(row[date_idx])))
            try:
                date = datetime.strptime(raw_date, "%Y%m%d").strftime("%b %d")
            except Exception:
                date = raw_date
            trend.append({"month": date, "cost": cost_inr_day})

        return trend[-6:] if len(trend) >= 6 else trend  # last 6 points for chart

    except Exception as e:
        print(f"[Daily Trend Error] {e}")
        return []
# ─────────────────────────────────────────────────────────────────────────────


def _get_vm_power_state(resource_group: str, vm_name: str) -> str:
    """
    Calls Azure Compute instance_view to get the real power state of a VM.
    Returns a clean label: 'Running', 'Stopped (Deallocated)', 'Starting', etc.
    Falls back to 'Unknown' on any error.
    """
    try:
        import urllib.request as _ur, json as _json
        token = credential.get_token("https://management.azure.com/.default").token
        url = (
            f"https://management.azure.com/subscriptions/{subscription_id}"
            f"/resourceGroups/{resource_group}/providers/Microsoft.Compute"
            f"/virtualMachines/{vm_name}/instanceView?api-version=2023-07-01"
        )
        req = _ur.Request(url, headers={"Authorization": f"Bearer {token}"})
        with _ur.urlopen(req, timeout=10) as resp:
            data = _json.loads(resp.read())
        for s in data.get("statuses", []):
            code = s.get("code", "")
            if code.startswith("PowerState/"):
                state = code.split("/")[1]
                label_map = {
                    "running":      "Running",
                    "deallocated":  "Stopped (Deallocated)",
                    "stopped":      "Stopped",
                    "starting":     "Starting",
                    "stopping":     "Stopping",
                    "deallocating": "Deallocating",
                }
                return label_map.get(state.lower(), state.capitalize())
        return "Unknown"
    except Exception as e:
        print(f"[VM PowerState] {vm_name}: {e}")
        return "Unknown"


@mcp.tool()
def get_azure_resources():
    """Get all Azure resources from subscription, with real power state for VMs."""
    global _RESOURCE_CACHE
    from concurrent.futures import ThreadPoolExecutor

    raw_resources = []
    try:
        for resource in resource_client.resources.list():
            raw_resources.append(resource)
    except Exception as e:
        print("Azure Resource Error:", e)

    vm_resources = [r for r in raw_resources if "virtualmachines" in r.type.lower()]
    vm_states: dict = {}

    def _fetch_vm_state(vm):
        rg = vm.id.split("/")[4] if vm.id else ""
        return vm.id, _get_vm_power_state(rg, vm.name)

    if vm_resources:
        with ThreadPoolExecutor(max_workers=min(8, len(vm_resources))) as ex:
            for vm_id, state in ex.map(_fetch_vm_state, vm_resources):
                vm_states[vm_id] = state

    resources = []
    for resource in raw_resources:
        action_state = RESOURCE_ACTIONS.get(resource.id.lower(), {})

        if action_state.get("resource_status"):
            status = action_state["resource_status"]
        elif resource.id in vm_states:
            status = vm_states[resource.id]
        else:
            rtype_lower = resource.type.lower()
            if any(t in rtype_lower for t in (
                "storageaccounts", "registries", "keyvaults",
                "networkinterfaces", "disks", "virtualnetworks",
                "publicipaddresses", "networksecuritygroups"
            )):
                status = "Provisioned"
            else:
                status = "Running"

        resources.append({
            "name":            resource.name,
            "type":            resource.type,
            "location":        resource.location,
            "id":              resource.id,
            "resource_group":  resource.id.split("/")[4] if resource.id else "",
            "tags":            resource.tags or {},
            "status":          status,
            "pending_action":  action_state.get("action"),
            "approval_status": action_state.get("approval_status"),
        })

    _RESOURCE_CACHE = resources
    return resources


@mcp.tool()
def _weighted_linear_regression(daily_costs: list) -> tuple:
    """
    Weighted linear regression on daily costs.
    Recent days get exponentially higher weight so the forecast
    reacts to recent spend changes rather than averaging the whole month.
    Returns (slope, intercept) for y = slope*x + intercept.
    """
    n = len(daily_costs)
    if n < 2:
        avg = daily_costs[0] if daily_costs else 0
        return 0, avg
    # Weights: w_i = e^(i/n) — last day weighs ~e more than first
    import math
    xs = list(range(1, n + 1))
    ws = [math.exp(i / n) for i in xs]
    sw   = sum(ws)
    swx  = sum(w * x for w, x in zip(ws, xs))
    swy  = sum(w * y for w, y in zip(ws, daily_costs))
    swxx = sum(w * x * x for w, x, in zip(ws, xs))
    swxy = sum(w * x * y for w, x, y in zip(ws, xs, daily_costs))
    denom = sw * swxx - swx ** 2
    if abs(denom) < 1e-9:
        return 0, swy / sw
    slope     = (sw * swxy - swx * swy) / denom
    intercept = (swy - slope * swx) / sw
    return slope, intercept


def get_cost_analysis():
    """
    Fetch REAL costs from Azure Cost Management API with 10-min cache.
    Uses weighted linear regression for projected cost forecast.
    """
    import calendar, time
    global _COST_CACHE, _COST_CACHE_TS

    # ── Return cache if fresh ──────────────────────────────────────
    if _COST_CACHE and (time.time() - _COST_CACHE_TS) < COST_CACHE_TTL:
        return _COST_CACHE

    # ── Fetch from Azure (runs in parallel using threads) ─────────
    from concurrent.futures import ThreadPoolExecutor, as_completed
    results = {}
    def _fetch(key, fn):
        results[key] = fn()

    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {
            ex.submit(_fetch, "resources", _fetch_real_costs_by_resource): "resources",
            ex.submit(_fetch, "total",     _fetch_monthly_total_usd):      "total",
            ex.submit(_fetch, "trend",     _fetch_daily_cost_trend):       "trend",
        }
        for f in as_completed(futs):
            f.result()  # propagate exceptions

    spend_by_resource = results.get("resources", [])
    monthly_total_inr = results.get("total", 0)
    daily_trend       = results.get("trend", [])

    now           = datetime.utcnow()
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    days_elapsed  = max(now.day, 3)

    # ── Weighted regression projection ────────────────────────────
    daily_costs = [d["cost"] for d in daily_trend] if daily_trend else []
    if len(daily_costs) >= 3:
        slope, intercept = _weighted_linear_regression(daily_costs)
        # Project forward: predict cost on day N of the month
        projected_inr = round(max(
            sum(max(slope * x + intercept, 0) for x in range(1, days_in_month + 1)),
            monthly_total_inr  # projection can't be less than what's already spent
        ), 2)
        # 30-day forecast using regression line
        forecast_30d = []
        cumulative = 0
        for d in [7, 14, 21, 30]:
            cumulative = round(sum(max(slope * x + intercept, 0) for x in range(1, d + 1)), 2)
            forecast_30d.append({"day": f"Day {d}", "forecast": cumulative})
    else:
        # Fallback: simple daily average
        daily_avg = monthly_total_inr / days_elapsed
        projected_inr = round(daily_avg * days_in_month, 2)
        forecast_30d = [{"day": f"Day {d}", "forecast": round(daily_avg * d, 2)} for d in [7, 14, 21, 30]]

    # ── Spend by service ──────────────────────────────────────────
    service_map = {}
    for item in spend_by_resource:
        svc = item["type"]
        service_map[svc] = service_map.get(svc, 0) + item["cost"]
    spend_by_service = sorted(
        [{"service": k, "cost": round(v, 2)} for k, v in service_map.items()],
        key=lambda x: x["cost"], reverse=True
    )

    top_resource = spend_by_resource[0]["name"] if spend_by_resource else "Azure"
    top_service  = spend_by_service[0]["service"] if spend_by_service else "Azure"

    data = {
        "monthly_cost":      monthly_total_inr,
        "projected_cost":    projected_inr,
        "currency":          "INR",
        "usd_to_inr_rate":   "N/A (billed directly in INR)",
        "billing_currency":  "INR",
        "top_resource":      top_resource,
        "top_service":       top_service,
        "spend_by_resource": spend_by_resource,
        "spend_by_service":  spend_by_service,
        "cost_trend":        daily_trend,
        "forecast_30d":      forecast_30d,
        "recommendation":    _cost_recommendation(spend_by_resource, projected_inr, monthly_total_inr),
    }

    # ── Store cache ───────────────────────────────────────────────
    _COST_CACHE    = data
    _COST_CACHE_TS = time.time()
    return data



import statistics


def detect_cost_anomalies(cost_trend):

    if not cost_trend or len(cost_trend) < 7:
        return []

    values = [float(x["cost"]) for x in cost_trend]

    mean = statistics.mean(values)
    std = statistics.stdev(values)

    if std == 0:
        return []

    anomalies = []

    for point in cost_trend:

        z_score = (point["cost"] - mean) / std

        if abs(z_score) >= 3:

            anomalies.append({
                "severity": "High" if abs(z_score) > 4 else "Medium",
                "signal": "Cost Anomaly",
                "date": point["month"],
                "value": point["cost"],
                "z_score": round(z_score, 2),
                "detail": f"Abnormal spend detected on {point['month']}"
            })

    return anomalies

from statistics import mean, stdev

def detect_resource_cost_anomalies(resources):
    """
    resources = spend_by_resource
    """

    if len(resources) < 3:
        return []

    costs = [r["cost"] for r in resources]

    avg = mean(costs)
    sd = stdev(costs)

    anomalies = []

    if sd == 0:
        return anomalies

    for resource in resources:

        z = (resource["cost"] - avg) / sd

        if z > 2:

            anomalies.append({
                "type": "Resource Cost Spike",
                "resource": resource["name"],
                "cost": resource["cost"],
                "severity": "High",
                "message": f"{resource['name']} is consuming significantly more than other resources."
            })

    return anomalies

def detect_cpu_anomalies(cpu_history):
    """
    cpu_history:
    [
        {"time":"10:00","value":40},
        {"time":"10:05","value":42}
    ]
    """

    if len(cpu_history) < 5:
        return []

    values = [x["value"] for x in cpu_history]

    avg = mean(values)
    sd = stdev(values)

    anomalies = []

    for point in cpu_history:

        if sd == 0:
            continue

        z = (point["value"] - avg) / sd

        if z > 2:

            anomalies.append({
                "type": "CPU Spike",
                "time": point["time"],
                "value": point["value"],
                "severity": "Medium",
                "message": f"CPU spike detected at {point['time']}"
            })

    return anomalies

def detect_memory_anomalies(memory_history):

    values = [x["value"] for x in memory_history]

    if len(values) < 5:
        return []

    avg = mean(values)
    sd = stdev(values)

    anomalies = []

    for point in memory_history:

        if sd == 0:
            continue

        z = (point["value"] - avg) / sd

        if z > 2:
            anomalies.append({
                "type": "Memory Spike",
                "time": point["time"],
                "value": point["value"],
                "severity": "Medium",
                "message": f"Memory spike detected at {point['time']}"
            })

    return anomalies


def _cost_recommendation(spend_by_resource, projected, actual):
    if not spend_by_resource:
        return "Enable Cost Management on your subscription to see recommendations."
    top = spend_by_resource[0]
    if projected > actual * 1.2:
        return f"Projected spend is 20%+ above current. Review {top['name']} which is your highest cost resource."
    return f"Costs look stable. Top resource is {top['name']} at {format_inr(top['cost'])}/mo."


# ── Metrics cache (5 min TTL) ──────────────────────────────────────
_METRICS_CACHE    = {}
_METRICS_CACHE_TS = 0
METRICS_CACHE_TTL = 300  # 5 minutes


def _fetch_metric(resource_id: str, metric_name: str, hours: int = 1) -> list:
    """Fetch a single metric timeseries from Azure Monitor. Returns list of {time, value}."""
    end_time   = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    try:
        result = monitor_client.metrics.list(
            resource_id,
            timespan=f"{start_time.isoformat()}Z/{end_time.isoformat()}Z",
            interval="PT5M",
            metricnames=metric_name,
            aggregation="Average",
        )
        points = []
        for metric in result.value:
            for ts in metric.timeseries:
                for pt in ts.data:
                    if pt.average is not None:
                        points.append({
                            "time":  pt.time_stamp.strftime("%H:%M"),
                            "value": round(pt.average, 2),
                        })
        return points
    except Exception as e:
        print(f"[Metrics] {metric_name} error: {e}")
        return []


@mcp.tool()
def get_live_metrics():
    """Return live CPU and Memory metrics for all container apps from Azure Monitor."""
    import time as _time
    global _METRICS_CACHE, _METRICS_CACHE_TS

    # Return cache if fresh
    if _METRICS_CACHE and (_time.time() - _METRICS_CACHE_TS) < METRICS_CACHE_TTL:
        return _METRICS_CACHE

    # Find all container apps across the subscription
    container_apps = []
    try:
        for r in resource_client.resources.list(
            filter="resourceType eq 'Microsoft.App/containerApps'"
        ):
            rg = r.id.split("/")[4]
            container_apps.append({
                "name": r.name,
                "rg":   rg,
                "id":   f"/subscriptions/{subscription_id}/resourceGroups/{rg}/providers/Microsoft.App/containerApps/{r.name}",
            })
    except Exception as e:
        print(f"[Metrics] Resource list error: {e}")

    # Fetch CPU + Memory for each app in parallel
    from concurrent.futures import ThreadPoolExecutor
    app_metrics = []

    def _fetch_app(app):
        cpu_pts = _fetch_metric(app["id"], "CpuPercentage",    hours=1)
        mem_pts = _fetch_metric(app["id"], "MemoryPercentage", hours=1)
        latest_cpu = cpu_pts[-1]["value"] if cpu_pts else 0
        latest_mem = mem_pts[-1]["value"] if mem_pts else 0
        return {
            "name":        app["name"],
            "resource_group": app["rg"],
            "cpu_current": latest_cpu,
            "mem_current": latest_mem,
            "cpu_history": cpu_pts[-12:],  # last 1h at 5min intervals
            "mem_history": mem_pts[-12:],
            "cpu_avg":     round(sum(p["value"] for p in cpu_pts) / max(len(cpu_pts), 1), 2),
            "mem_avg":     round(sum(p["value"] for p in mem_pts) / max(len(mem_pts), 1), 2),
            "status":      "Healthy" if latest_cpu < 80 and latest_mem < 85 else "Warning",
        }

    with ThreadPoolExecutor(max_workers=4) as ex:
        app_metrics = list(ex.map(_fetch_app, container_apps))

    # Aggregate totals
    cpu_usage = round(sum(a["cpu_current"] for a in app_metrics) / max(len(app_metrics), 1), 2)
    mem_usage = round(sum(a["mem_current"] for a in app_metrics) / max(len(app_metrics), 1), 2)

    # Build combined CPU history for chart (use first app or average)
    combined_cpu = app_metrics[0]["cpu_history"] if app_metrics else []
    combined_mem = app_metrics[0]["mem_history"] if app_metrics else []

    result = {
        "cpu_usage":          cpu_usage,
        "memory_usage":       mem_usage,
        "disk_usage":         0,
        "active_alerts":      sum(1 for a in app_metrics if a["status"] == "Warning"),
        "aks_health":         "Healthy" if all(a["status"] == "Healthy" for a in app_metrics) else "Warning",
        "running_nodes":      len(container_apps),
        "container_apps":     app_metrics,
        "cpu_history":        combined_cpu,
        "mem_history":        combined_mem,
        "monitoring_status":  "Live" if app_metrics else "No container apps found",
        "last_updated":       datetime.utcnow().strftime("%H:%M:%S UTC"),
    }

    _METRICS_CACHE    = result
    _METRICS_CACHE_TS = _time.time()
    return result


@mcp.tool()
def get_resource_summary():
    """Return a breakdown of resource types in the subscription."""
    resources = get_azure_resources()
    resource_types = Counter(r["type"].split("/")[-1] for r in resources)
    return {
        "total_resources":       len(resources),
        "storage_accounts":      resource_types.get("storageAccounts", 0),
        "container_registries":  resource_types.get("registries", 0),
        "web_apps":              resource_types.get("sites", 0),
        "container_apps":        resource_types.get("containerApps", 0),
        "databases":             resource_types.get("flexibleServers", 0),
    }


@mcp.tool()
def get_security_analysis():
    """
    Security posture analysis based on actual Azure resources.
    No hardcoded security score.
    """

    resources = get_azure_resources()
    findings = []

    high = 0
    medium = 0
    low = 0

    for resource in resources:

        rtype = resource.get("type", "").lower()
        tags = resource.get("tags", {})
        status = resource.get("status", "")

        # Missing tags
        if not tags:
            findings.append({
                "severity": "Low",
                "title": "Missing Tags",
                "resource": resource["name"],
                "detail": "Resource does not contain governance tags."
            })
            low += 1

        # Stopped VM
        if "virtualmachines" in rtype:
            if "stopped" in status.lower():
                findings.append({
                    "severity": "Medium",
                    "title": "Inactive VM",
                    "resource": resource["name"],
                    "detail": "Virtual machine is stopped and should be reviewed."
                })
                medium += 1

        # Public IP
        if "publicipaddresses" in rtype:
            findings.append({
                "severity": "Medium",
                "title": "Public Endpoint",
                "resource": resource["name"],
                "detail": "Public IP detected. Verify exposure requirements."
            })
            medium += 1

        # Storage account review
        if "storageaccounts" in rtype:
            findings.append({
                "severity": "Low",
                "title": "Storage Review",
                "resource": resource["name"],
                "detail": "Verify encryption and network access restrictions."
            })
            low += 1

    security_score = max(
        100 - (high * 10) - (medium * 5) - (low * 2),
        0
    )

    return {
        "security_score": security_score,
        "critical_alerts": high,
        "warnings": medium + low,
        "high_findings": high,
        "medium_findings": medium,
        "low_findings": low,
        "status": "Healthy" if high == 0 else "Action Required",
        "findings": findings
    }


@mcp.tool()
def get_cloudops_analytics():
    """Return combined dashboard analytics."""
    resources = get_azure_resources()
    costs     = get_cost_analysis()
    security  = get_security_analysis()
    summary   = get_resource_summary()
    cost_anomalies = detect_cost_anomalies(
    costs["cost_trend"]
)
    cost_anomalies = detect_cost_anomalies(costs["cost_trend"])

    resource_anomalies = detect_resource_cost_anomalies(costs["spend_by_resource"])

    all_anomalies = (cost_anomalies +resource_anomalies)[:5]  # limit to top 5 anomalies
    
    container_apps  = [r for r in resources if r["type"].split("/")[-1] == "containerApps"]
    untagged_count  = len([r for r in resources if not r.get("tags")])

    anomalies = detect_cost_anomalies(costs.get("cost_trend", []))

    if untagged_count:
        anomalies.append({
            "severity": "Low",
            "signal": "Governance drift",
            "detail": f"{untagged_count} resources are missing tags."
        })

    operations = [
        {"name": "Backend Container App",  "status": "Ready" if container_apps else "Needs deployment", "action": "Verify revisions, ingress, and scaling rules."},
        {"name": "Cost Controls",          "status": "Review",            "action": "Create budget alerts and tag cost owners."},
        {"name": "Security Review",        "status": security["status"],  "action": "Resolve medium findings before release."},
    ]

    terraform_approvals = [
        {"change": "Container App deployment", "risk": "Medium", "status": "Ready for review" if container_apps else "Blocked", "approver": "CloudOps Lead"},
        {"change": "Budget alert policy",      "risk": "Low",    "status": "Recommended",   "approver": "FinOps Owner"},
        {"change": "Security tagging policy",  "risk": "Low",    "status": "Recommended",   "approver": "Security Owner"},
    ]

    for resource in resources:
        action = RESOURCE_ACTIONS.get(resource["id"].lower())
        if action:
            terraform_approvals.insert(0, {
                "change":   f"{action['action'].title()} {resource['name']}",
                "risk":     "Medium" if action["action"] in {"stop", "scale"} else "Low",
                "status":   action["approval_status"],
                "approver": "CloudOps Approval",
            })

    return {
        "summary":            summary,
        "cost_trend":         costs["cost_trend"],
        "spend_by_resource":  costs["spend_by_resource"],
        "spend_by_service":   costs["spend_by_service"],
        "security_findings":  security["findings"],
        "forecast_30d":       costs["forecast_30d"],
        "anomalies":          anomalies,
        "operations":         operations,
        "terraform_approvals": terraform_approvals,
    }


@mcp.tool()
def get_ai_insights():
    """Return AI-generated operational insights."""
    return [
        "Fetching real Azure billing data via Cost Management API",
        f"Exchange rate applied: 1 USD = ₹{USD_TO_INR_RATE}",
        "Security score computed from live resource inventory",
        "Container App CPU metrics pulled from Azure Monitor",
    ]


# ── Resource action helpers ───────────────────────────────────────────────────
def _resource_type_name(resource):
    return resource["type"].split("/")[-1]


def _find_resource(resources, query):
    q = query.lower()
    matches = [r for r in resources if r["name"].lower() in q or r["id"].lower() in q]
    if len(matches) == 1:
        return matches[0], []
    if len(matches) > 1:
        return None, matches
    tokens = [t for t in q.replace(",", " ").split() if len(t) >= 3]
    fuzzy  = [r for r in resources if any(t in r["name"].lower() for t in tokens)]
    if len(fuzzy) == 1:
        return fuzzy[0], []
    return None, fuzzy[:8]


def _execute_azure_action(resource: dict, action: str) -> dict:
    """Call Azure REST API to start/stop/restart resources. Uses lazy SDK imports."""
    import urllib.request as _ur, json as _json
    rtype  = resource["type"].lower()
    name   = resource["name"]
    rg     = resource.get("resource_group") or resource["id"].split("/")[4]
    sub    = subscription_id
    token  = credential.get_token("https://management.azure.com/.default").token
    hdrs   = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _rest(method, url, body=None):
        data = _json.dumps(body).encode() if body else None
        req  = _ur.Request(url, data=data, headers=hdrs, method=method)
        try:
            with _ur.urlopen(req, timeout=30) as r:
                return r.status, _json.loads(r.read() or b"{}")
        except Exception as ex:
            return 0, {"error": str(ex)}

    try:
        base = "https://management.azure.com"

        # ── Virtual Machines ──────────────────────────────────────
        if "virtualmachines" in rtype:
            action_map = {
                "stop":    f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{name}/deallocate?api-version=2023-07-01",
                "start":   f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{name}/start?api-version=2023-07-01",
                "restart": f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{name}/restart?api-version=2023-07-01",
            }
            if action not in action_map:
                return {"success": False, "message": f"Action '{action}' not supported for VMs."}
            status, _ = _rest("POST", action_map[action])
            ok = status in (200, 202)
            return {"success": ok, "message": f"VM '{name}' {action} {'sent to Azure (async)' if ok else 'failed'}."}

        # ── Web Apps / App Service ────────────────────────────────
        elif "sites" in rtype:
            action_map = {
                "stop":    f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{name}/stop?api-version=2022-09-01",
                "start":   f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{name}/start?api-version=2022-09-01",
                "restart": f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{name}/restart?api-version=2022-09-01",
            }
            if action not in action_map:
                return {"success": False, "message": f"Action '{action}' not supported for Web Apps."}
            status, _ = _rest("POST", action_map[action])
            ok = status in (200, 202)
            return {"success": ok, "message": f"Web App '{name}' {action} {'applied' if ok else 'failed'}."}

        # ── Container Apps ────────────────────────────────────────
        elif "containerapps" in rtype:
            get_url = f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.App/containerApps/{name}?api-version=2023-05-01"
            status, app_def = _rest("GET", get_url)
            if status != 200:
                return {"success": False, "message": f"Could not fetch Container App definition: {app_def}"}
            props = app_def.setdefault("properties", {})
            cfg   = props.setdefault("configuration", {})
            if action == "stop":
                cfg["activeRevisionsMode"] = "Single"
                # Scale to 0 replicas
                tmpl = props.setdefault("template", {})
                for sc in tmpl.get("scale", {}).get("rules", []):
                    sc["custom"] = {}
                props["template"]["scale"] = {"minReplicas": 0, "maxReplicas": 0}
            elif action == "start":
                props["template"]["scale"] = {"minReplicas": 1, "maxReplicas": 3}
            status2, _ = _rest("PATCH", get_url, app_def)
            ok = status2 in (200, 202)
            return {"success": ok, "message": f"Container App '{name}' {action} {'applied (scale to 0)' if ok else 'failed'}."}

        # ── MySQL Flexible Server ─────────────────────────────────
        elif "flexibleservers" in rtype:
            action_map = {
                "stop":  f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.DBforMySQL/flexibleServers/{name}/stop?api-version=2023-06-01-preview",
                "start": f"{base}/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.DBforMySQL/flexibleServers/{name}/start?api-version=2023-06-01-preview",
            }
            if action not in action_map:
                return {"success": False, "message": f"Action '{action}' not supported for MySQL."}
            status, _ = _rest("POST", action_map[action])
            ok = status in (200, 202)
            return {"success": ok, "message": f"MySQL server '{name}' {action} {'sent to Azure' if ok else 'failed'}."}

        else:
            return {"success": False, "message": f"'{rtype.split('/')[-1]}' does not support start/stop via API. Use Azure Portal."}

    except Exception as e:
        return {"success": False, "message": f"Azure API error: {str(e)}"}


@mcp.tool()
def request_resource_action(query):
    """Create an approval-style request for start, stop, restart, scale, or status actions."""
    resources = get_azure_resources()
    q         = query.lower()
    action    = next((a for a in ["restart", "start", "stop", "scale", "status"] if a in q), None)

    if not action:
        return {"handled": False, "message": "Tell me whether you want to start, stop, restart, scale, or check status for a resource."}

    resource, candidates = _find_resource(resources, query)
    if not resource:
        if candidates:
            names = "\n".join(f"- {r['name']} ({_resource_type_name(r)})" for r in candidates)
            return {"handled": True, "message": f"Multiple resources found. Specify one:\n{names}"}
        return {"handled": True, "message": "Resource not found. Open Resources from the side menu and copy the exact name."}

    if action == "status":
        return {"handled": True, "message": (
            f"Resource Status\n- Name: {resource['name']}\n"
            f"- Type: {_resource_type_name(resource)}\n"
            f"- Location: {resource['location']}\n"
            f"- Status: {resource.get('status', 'Running')}"
        )}

    resource_key = resource["id"].lower()
    approved     = "approve" in q or "approved" in q
    status_map   = {
        "start":   "Running"          if approved else "Start requested",
        "stop":    "Stopped"          if approved else "Stop requested",
        "restart": "Running"          if approved else "Restart requested",
        "scale":   "Running"          if approved else "Scale requested",
    }

    RESOURCE_ACTIONS[resource_key] = {
        "action":          action,
        "approval_status": "Approved" if approved else "Pending approval",
        "resource_status": status_map[action],
        "requested_at":    datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }

    return {"handled": True, "message": (
        f"Approval Created\n- Action: {action.title()}\n"
        f"- Resource: {resource['name']}\n"
        f"- Status: {'Approved' if approved else 'Pending approval'}"
    )}


def _build_security_findings(resources, warnings):
    findings = []
    untagged     = [r for r in resources if not r.get("tags")]
    public_facing= [r for r in resources if _resource_type_name(r) in {"sites", "containerApps", "searchServices"}]
    if untagged:
        findings.append({"severity": "Medium", "title": "Resources missing governance tags", "detail": f"{len(untagged)} resources have no owner/environment tags."})
    if public_facing:
        findings.append({"severity": "Medium", "title": "Review public-facing services", "detail": f"{len(public_facing)} app/search resources need ingress review."})
    if not findings:
        findings.append({"severity": "Low", "title": "No critical posture issues", "detail": "Continue periodic review of identity, networking, and cost controls."})
    return findings[:5]


if __name__ == "__main__":
    mcp.run()