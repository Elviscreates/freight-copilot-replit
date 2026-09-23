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
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)

    review_summary = safe_dict(pipeline.get("review_summary") or pipeline.get("review_package") or {})
    drafts = safe_dict(review_summary.get("drafts") or pipeline.get("drafts") or {})
    
    shipper_draft = safe_dict(drafts.get("shipper_email"))
    shipper_email = shipper_draft.get("body") if isinstance(shipper_draft, dict) else (review_summary.get("shipper_email") or "shipper@acmeshipping.com")

    carrier_draft = safe_dict(drafts.get("carrier_outreach"))
    carrier_email = carrier_draft.get("body") if isinstance(carrier_draft, dict) else (review_summary.get("carrier_email") or "carrier@freight.com")

    # Update pipeline status in-memory
    pipeline["status"] = "APPROVED"
    pipeline["approved_at"] = datetime.now(timezone.utc).isoformat()
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
        raise HTTPException(status_code=404, detail="Pipeline not found")

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


@app.post("/webhook/load-tender")
async def webhook_load_tender(request: Request) -> Dict[str, Any]:
    body = await request.json()
    pipeline_id = body.get("pipeline_id")
    review_package = body.get("review_package")

    if not pipeline_id or not review_package:
        raise HTTPException(status_code=400, detail="Missing pipeline_id or review_package")

    store.save(pipeline_id, review_package)
    await notify_clients({
        "type": "new_load",
        "pipeline_id": pipeline_id,
        "summary": review_package.get("review_summary", {})
    })

    return {"status": "received", "pipeline_id": pipeline_id}


@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)