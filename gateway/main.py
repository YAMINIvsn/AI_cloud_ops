from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.router_agent import router_agent

from mcp_servers.cloud_mcp_server import (
    get_live_metrics,
    get_azure_resources,
    get_resource_summary
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
    return {
        "message": "CloudOps AI Backend Running"
    }


@app.post("/chat")
def chat(query: Query):

    response = router_agent(query.question)

    return {
        "response": response
    }


@app.get("/azure/resources")
def azure_resources():

    return {
        "resources": get_azure_resources()
    }


@app.get("/azure/metrics")
def azure_metrics():

    return get_live_metrics()

@app.get("/azure/summary")
def azure_summary():

    return get_resource_summary()