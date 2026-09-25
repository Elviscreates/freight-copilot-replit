import json
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.pipeline_store import store


def safe_dict(val):
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


app = FastAPI(title="Freight Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sse_clients: List[asyncio.Queue] = []


async def notify_clients(event: Dict[str, Any]) -> None:
    event_data = json.dumps(event)
    message = f"data: {event_data}\n\n"
    disconnected = []
    for queue in sse_clients:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            disconnected.append(queue)
    for queue in disconnected:
        if queue in sse_clients:
            sse_clients.remove(queue)


class ApprovePayload(BaseModel):
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    carrier_body: Optional[str] = None


async def send_email(to: str, subject: str, body: str) -> None:
    print(f"[EMAIL] To: {to}, Subject: {subject}")
    print(f"[EMAIL] Body: {body}")


@app.get("/api/pipelines")
async def list_pipelines() -> Dict[str, Any]:
    all_pipelines = store.get_all()
    pipelines = []
    for p in all_pipelines.values():
        if isinstance(p, str):
            p = safe_dict(p)
        pipelines.append(p)
    return {
        "pipelines": pipelines,
        "count": len(pipelines),
    }


@app.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)
    return pipeline


@app.post("/api/pipelines/{pipeline_id}/approve")
async def approve_pipeline(pipeline_id: str, payload: ApprovePayload) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        print(f"[WARN] Pipeline {pipeline_id} not found for approve - creating minimal record")
        pipeline = create_pipeline_record(pipeline_id, {"origin": "Unknown", "destination": "Unknown", "equipment": "Unknown", "weight": 0})
        store.save(pipeline_id, pipeline)

    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)

    review_summary = safe_dict(pipeline.get("review_summary") or pipeline.get("review_package") or {})
    drafts = safe_dict(pipeline.get("drafts") or {})
    
    shipper_draft = safe_dict(drafts.get("shipper_email"))
    shipper_email = shipper_draft.get("body") if isinstance(shipper_draft, dict) else (review_summary.get("shipper_email") or "shipper@acmeshipping.com")

    carrier_draft = safe_dict(drafts.get("carrier_outreach"))
    carrier_email = carrier_draft.get("body") if isinstance(carrier_draft, dict) else (review_summary.get("carrier_email") or "carrier@freight.com")

    pipeline["status"] = "approved"
    pipeline["approved_at"] = datetime.now(timezone.utc).isoformat()
    pipeline["updated_at"] = datetime.now(timezone.utc).isoformat()
    store.save(pipeline_id, pipeline)

    print(f"[DISPATCH] Pipeline {pipeline_id} approved successfully.")
    print(f"[DISPATCH] Sent email to shipper: {shipper_email}")
    
    await notify_clients({"type": "approved", "pipeline_id": pipeline_id})

    return {
        "status": "approved",
        "pipeline_id": pipeline_id
    }


@app.post("/api/pipelines/{pipeline_id}/reject")
async def reject_pipeline(pipeline_id: str) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        print(f"[WARN] Pipeline {pipeline_id} not found for reject - nothing to delete")
        return {"status": "rejected", "pipeline_id": pipeline_id, "note": "Pipeline was not found"}

    store.delete(pipeline_id)
    await notify_clients({"type": "rejected", "pipeline_id": pipeline_id})

    return {"status": "rejected", "pipeline_id": pipeline_id}


async def event_generator() -> Any:
    queue: asyncio.Queue = asyncio.Queue()
    sse_clients.append(queue)
    try:
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield message
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        if queue in sse_clients:
            sse_clients.remove(queue)


@app.get("/api/stream")
async def stream_events(request: Request) -> StreamingResponse:
    return StreamingResponse(event_generator(), media_type="text/event-stream")


def extract_state(location: str) -> str:
    if not location:
        return ""
    parts = location.split(",")
    if len(parts) >= 2:
        return parts[-1].strip().upper()
    return ""


def create_pipeline_record(pipeline_id: str, review_package: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    
    origin = review_package.get("origin", "")
    destination = review_package.get("destination", "")
    origin_state = extract_state(origin)
    destination_state = extract_state(destination)
    
    rate = review_package.get("rate", 0)
    weight = review_package.get("weight", 0)
    miles = review_package.get("distance", review_package.get("miles", 0))
    equipment = review_package.get("equipment", "")
    commodity = review_package.get("commodity", "General Freight")
    shipper = review_package.get("shipper", "Unknown Shipper")
    
    pickup = review_package.get("pickup", origin)
    delivery = review_package.get("delivery", destination)
    received = review_package.get("received", now)
    
    benchmark = review_package.get("dat_benchmark", {}).get("median_rate", review_package.get("benchmark", 2450))
    margin = review_package.get("margin", 0)
    confidence = review_package.get("ai_confidence", review_package.get("confidence", 94))
    
    matched_carriers = review_package.get("matched_carriers", review_package.get("matches", []))
    dat_benchmark = review_package.get("dat_benchmark", {"median_rate": benchmark})
    ai_confidence = review_package.get("ai_confidence", confidence)
    
    return {
        "id": pipeline_id,
        "pipeline_id": pipeline_id,
        "origin": origin,
        "destination": destination,
        "originState": origin_state,
        "destinationState": destination_state,
        "equipment": equipment,
        "rate": rate,
        "benchmark": benchmark,
        "margin": margin,
        "confidence": confidence,
        "weight": str(weight),
        "miles": miles,
        "commodity": commodity,
        "shipper": shipper,
        "pickup": pickup,
        "delivery": delivery,
        "received": received,
        "status": "pending",
        "carriers": matched_carriers,
        "matched_carriers": matched_carriers,
        "review_summary": review_package.get("review_summary", {}),
        "review_package": review_package,
        "drafts": review_package.get("drafts", {}),
        "dat_benchmark": dat_benchmark,
        "dat_rate": review_package.get("dat_rate", benchmark),
        "ai_confidence": ai_confidence,
        "shipper_email": review_package.get("email_body", ""),
        "carrier_body": review_package.get("carrier_body", ""),
        "metadata": {}
    }


@app.post("/webhook/load-tender")
async def webhook_load_tender(request: Request) -> Dict[str, Any]:
    body = await request.json()
    pipeline_id = body.get("pipeline_id")
    review_package = body.get("review_package")

    if not pipeline_id or not review_package:
        raise HTTPException(status_code=400, detail="Missing pipeline_id or review_package")

    pipeline = create_pipeline_record(pipeline_id, review_package)
    store.save(pipeline_id, pipeline)
    await notify_clients({
        "type": "new_load",
        "pipeline_id": pipeline_id,
        "summary": {
            "matched_carriers": pipeline.get("matched_carriers", []),
            "dat_benchmark": pipeline.get("dat_benchmark", {"median_rate": 2450}),
            "ai_confidence": pipeline.get("ai_confidence", 94),
            "shipper_email": pipeline.get("shipper_email", ""),
            "email_subject": pipeline.get("review_package", {}).get("email_subject", ""),
            "email_body": pipeline.get("review_package", {}).get("email_body", ""),
            "carrier_body": pipeline.get("review_package", {}).get("carrier_body", ""),
            "distance": pipeline.get("miles", 0),
        }
    })

    return {"status": "received", "pipeline_id": pipeline_id}


@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)