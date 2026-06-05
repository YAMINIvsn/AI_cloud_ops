from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents.rootcause_agent import rootcause_agent
from agents.router_agent import router_agent
from agents.predictive_agent import predictive_agent
from mcp_servers.cloud_mcp_server import (
    get_ai_insights,
    get_cost_analysis,
    get_live_metrics,
    get_azure_resources,
    get_resource_summary,
    get_security_analysis,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Query(BaseModel):
    question: str


@app.get("/")
def home():
    return {"message": "CloudOps AI Backend Running"}


@app.post("/chat")
def chat(query: Query):
    try:
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


# ✅ get_ai_insights() now returns a plain list — wrap it here consistently
@app.get("/azure/insights")
def insights():
    try:
        result = get_ai_insights()
        if isinstance(result, list):
            return {"insights": result}
        return result  # already {"insights": [...]} shaped
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch insights: {str(e)}")


# ✅ predictive_agent() may return a list — wrap it here
@app.get("/azure/predict")
def predict():
    try:
        result = predictive_agent()
        if isinstance(result, list):
            return {"prediction": result}
        return result  # already {"prediction": [...]} shaped
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Predictive agent error: {str(e)}")


@app.get("/azure/rootcause")
def rootcause():
    try:
        return {"analysis": rootcause_agent()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Root cause agent error: {str(e)}")