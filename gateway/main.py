import os
import subprocess
import shlex
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from agents.rootcause_agent import rootcause_agent
from agents.router_agent import router_agent, guardrail_check
from agents.predictive_agent import predictive_agent
from mcp_servers.cloud_mcp_server import (
    get_ai_insights,
    get_cost_analysis,
    get_cloudops_analytics,
    get_live_metrics,
    get_azure_resources,
    get_resource_summary,
    get_security_analysis,
)



app = FastAPI()



# ✅ Prometheus metrics — auto-instruments all endpoints
# Exposes /metrics for Prometheus to scrape
Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


LAST_BUDGET_ALERT_LEVEL = None


class Query(BaseModel):
    question: str


class CliRequest(BaseModel):
    command: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


# In-memory user database
USERS_DB = {
    "admin@company.com": {
        "first_name": "Admin",
        "last_name": "User",
        "email": "admin@company.com",
        "password": "password123"
    }
}


@app.post("/auth/register")
def register(user: RegisterRequest):
    if user.email in USERS_DB:
        raise HTTPException(status_code=400, detail="User already exists")
    USERS_DB[user.email] = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "password": user.password
    }
    return {"access_token": f"mock-token-{user.email}", "token_type": "bearer"}


@app.post("/auth/login")
def login(credentials: LoginRequest):
    user = USERS_DB.get(credentials.email)
    if not user or user["password"] != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": f"mock-token-{credentials.email}", "token_type": "bearer"}


@app.get("/")
def home():
    return {"message": "CloudOps AI Backend Running"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "cloudops-ai-backend"}


@app.post("/chat")
def chat(query: Query):
    try:
        block = guardrail_check(query.question)
        if block:
            return {"response": block}
        response = router_agent(query.question)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat agent error: {str(e)}")


@app.get("/azure/resources")
def azure_resources():
    try:
        return {"resources": get_azure_resources()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resources: {str(e)}")


@app.get("/azure/metrics")
def azure_metrics():
    try:
        return get_live_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {str(e)}")


@app.get("/azure/summary")
def azure_summary():
    try:
        return get_resource_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {str(e)}")


@app.get("/azure/costs")
def azure_costs():
    try:
        return get_cost_analysis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch costs: {str(e)}")


@app.get("/azure/security")
def azure_security():
    try:
        return get_security_analysis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch security data: {str(e)}")


@app.get("/azure/analytics")
def azure_analytics():
    try:
        return get_cloudops_analytics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics: {str(e)}")


@app.get("/azure/insights")
def insights():
    try:
        result = get_ai_insights()
        if isinstance(result, list):
            return {"insights": result}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch insights: {str(e)}")


@app.get("/azure/predict")
def predict():
    try:
        result = predictive_agent()
        if isinstance(result, list):
            return {"prediction": result}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Predictive agent error: {str(e)}")


@app.get("/azure/rootcause")
def rootcause():
    try:
        return {"analysis": rootcause_agent()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Root cause agent error: {str(e)}")


@app.get("/azure/budget-alerts")
def budget_alerts(background_tasks: BackgroundTasks):
    """Return budget alert status based on current and projected spend."""
    try:
        from mcp_servers.cloud_mcp_server import format_inr
        costs = get_cost_analysis()
        monthly = costs.get("monthly_cost", 0)
        projected = costs.get("projected_cost", 0)

        # Configurable thresholds (can be moved to .env)
        BUDGET_LIMIT = float(os.getenv("MONTHLY_BUDGET_INR", 15000))
        WARN_PCT = 0.75

        alerts = []

        pct_used = (monthly / BUDGET_LIMIT * 100) if BUDGET_LIMIT else 0
        proj_pct = (projected / BUDGET_LIMIT * 100) if BUDGET_LIMIT else 0

        current_level = "OK"
        alert_msg = ""

        if projected > BUDGET_LIMIT:
            current_level = "CRITICAL"
            alert_msg = f"Projected spend {format_inr(projected)} exceeds monthly budget of {format_inr(BUDGET_LIMIT)}."
            alerts.append({
                "level": "Critical",
                "message": alert_msg,
                "action": "Review and stop unused resources immediately."
            })
        elif monthly > BUDGET_LIMIT * WARN_PCT:
            current_level = "WARNING"
            alert_msg = f"Current spend {format_inr(monthly)} is above {int(WARN_PCT*100)}% of budget ({format_inr(BUDGET_LIMIT)})."
            alerts.append({
                "level": "Warning",
                "message": alert_msg,
                "action": "Monitor spend closely. Consider rightsizing."
            })
        else:
            alerts.append({
                "level": "OK",
                "message": f"Spend {format_inr(monthly)} is within budget ({format_inr(BUDGET_LIMIT)}).",
                "action": "No action required."
            })

        # Notify Slack if the alert level changes to WARNING or CRITICAL
        global LAST_BUDGET_ALERT_LEVEL
        if current_level != LAST_BUDGET_ALERT_LEVEL:
            if current_level in ("WARNING", "CRITICAL"):
                from services.slack_service import send_alert
                background_tasks.add_task(
                    send_alert,
                    title=f"🚨 Budget Alert: {current_level}",
                    message=f"{alert_msg}\nAction: Please review and optimize resource usage.",
                    level=current_level.lower()
                )
            LAST_BUDGET_ALERT_LEVEL = current_level

        return {
            "budget_limit": BUDGET_LIMIT,
            "monthly_spend": monthly,
            "projected_spend": projected,
            "percent_used": round(pct_used, 1),
            "projected_percent": round(proj_pct, 1),
            "alerts": alerts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Budget alert error: {str(e)}")


@app.get("/azure/tagging-recommendations")
def tagging_recommendations():
    """Return resources missing tags with recommendations."""
    try:
        resources = get_azure_resources()
        untagged = [r for r in resources if not r.get("tags")]
        partially_tagged = [
            r for r in resources
            if r.get("tags") and not all(k in r["tags"] for k in ("environment", "owner"))
        ]

        recommendations = []
        for r in untagged[:20]:
            recommendations.append({
                "resource": r["name"],
                "type": r["type"].split("/")[-1],
                "location": r["location"],
                "issue": "No tags",
                "fix": f'az resource tag --ids "{r["id"]}" --tags environment=dev owner=team costcenter=cloudops'
            })
        for r in partially_tagged[:10]:
            missing = [k for k in ("environment", "owner") if k not in (r.get("tags") or {})]
            recommendations.append({
                "resource": r["name"],
                "type": r["type"].split("/")[-1],
                "location": r["location"],
                "issue": f"Missing tags: {', '.join(missing)}",
                "fix": f'az resource tag --ids "{r["id"]}" --tags {" ".join(f"{k}=<value>" for k in missing)}'
            })

        return {
            "total_resources": len(resources),
            "untagged_count": len(untagged),
            "partially_tagged_count": len(partially_tagged),
            "compliance_pct": round((len(resources) - len(untagged) - len(partially_tagged)) / max(len(resources),1) * 100, 1),
            "recommendations": recommendations,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tagging recommendations error: {str(e)}")

@app.post("/azure/approve-action")
def approve_action(query: Query, background_tasks: BackgroundTasks):
    """Approve a pending resource action and execute it on Azure."""
    try:
        from mcp_servers.cloud_mcp_server import (
            RESOURCE_ACTIONS, get_azure_resources, _find_resource, _execute_azure_action, _RESOURCE_CACHE
        )
        resources = get_azure_resources()
        resource, _ = _find_resource(resources, query.question)
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        key = resource["id"].lower()
        action_state = RESOURCE_ACTIONS.get(key)
        if not action_state:
            raise HTTPException(status_code=404, detail="No pending action for this resource")
        action = action_state["action"]

        # ── Actually execute on Azure ──────────────────────────────
        result = _execute_azure_action(resource, action)

        # ── Update in-memory status so UI reflects immediately ─────
        status_map = {"start": "Running", "stop": "Stopped", "restart": "Running", "scale": "Running"}
        new_status = status_map.get(action, "Running")
        RESOURCE_ACTIONS[key] = {
            **action_state,
            "approval_status": "Approved",
            "resource_status": new_status,
        }
        # Patch cached resource list so next /azure/resources call is accurate
        if _RESOURCE_CACHE:
            for r in _RESOURCE_CACHE:
                if r["id"].lower() == key:
                    r["status"] = new_status
                    break

        status_icon = "✅" if result["success"] else "⚠️"

        # Notify Slack
        from services.slack_service import send_alert
        slack_msg = f"Action *{action.upper()}* has been executed for resource *{resource['name']}*."
        if not result["success"]:
            slack_msg += f"\nError detail: {result.get('message', 'Unknown error')}"
        background_tasks.add_task(
            send_alert,
            title=f"🟢 Resource Action Approved: {action.upper()}",
            message=slack_msg,
            level="info" if result["success"] else "warning"
        )

        return {
            "status": "approved",
            "resource": resource["name"],
            "action": action,
            "azure_success": result["success"],
            "message": f"{status_icon} {result['message']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/azure/reject-action")
def reject_action(query: Query, background_tasks: BackgroundTasks):
    """Reject a pending resource action."""
    try:
        from mcp_servers.cloud_mcp_server import RESOURCE_ACTIONS, get_azure_resources, _find_resource
        resources = get_azure_resources()
        resource, _ = _find_resource(resources, query.question)
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        key = resource["id"].lower()
        action_state = RESOURCE_ACTIONS.pop(key, None)
        if not action_state:
            raise HTTPException(status_code=404, detail="No pending action for this resource")

        action = action_state["action"]

        # Notify Slack
        from services.slack_service import send_alert
        background_tasks.add_task(
            send_alert,
            title=f"🔴 Resource Action Rejected: {action.upper()}",
            message=f"Action *{action.upper()}* was rejected for resource *{resource['name']}*. No changes made.",
            level="warning"
        )

        return {
            "status": "rejected",
            "resource": resource["name"],
            "action": action,
            "message": f"❌ {action.title()} rejected for {resource['name']}. No changes made."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/azure/cli-run")
def cli_run(request: CliRequest):
    """Safely executes an Azure CLI command on the local system."""
    cmd = request.command.strip()
    if not cmd:
        return {"output": "No command provided.", "success": False}
        
    tokens = shlex.split(cmd)
    if not tokens:
        return {"output": "Invalid command format.", "success": False}
        
    main_cmd = tokens[0].lower()
    
    if main_cmd == "help":
        help_text = (
            "Available Commands:\n"
            "  az login                   - Log in to Azure CLI\n"
            "  az account show            - Show currently logged-in account\n"
            "  az account list            - List all available subscriptions\n"
            "  az group list              - List resource groups in current subscription\n"
            "  az resource list           - List resources in current subscription\n"
            "  clear                      - Clear terminal screen\n"
        )
        return {"output": help_text, "success": True}
        
    if main_cmd != "az":
        return {
            "output": f"Security restriction: Only 'az' commands or 'help' are permitted. You entered: {cmd}",
            "success": False
        }
        
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            shell=True,
            timeout=30
        )
        
        output = result.stdout
        error_output = result.stderr
        
        combined_output = ""
        if output:
            combined_output += output
        if error_output:
            combined_output += f"\n[stderr]\n{error_output}"
            
        return {
            "output": combined_output.strip() or "(no output returned)",
            "success": (result.returncode == 0)
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "Command execution timed out (limit: 30 seconds).",
            "success": False
        }
    except Exception as e:
        return {
            "output": f"Error executing command: {str(e)}",
            "success": False
        }
