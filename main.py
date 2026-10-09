import json
import asyncio
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

# Auth configuration
DASHBOARD_USER = os.getenv("DASHBOARD_USER", "admin")
DASHBOARD_PASS = os.getenv("DASHBOARD_PASS", "copilot2026!")
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str = ""
    email: str = ""
    password: str


async def verify_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify Bearer token authentication."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication")
    # Simple token validation - in production use JWT
    if not credentials.credentials or credentials.credentials != "copilot_session_token_2026":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return credentials.credentials


@app.post("/api/login")
async def login(req: LoginRequest):
    user_input = (req.username or req.email or "").strip().lower()
    valid_users = ["admin", "anuforofranklin19@gmail.com", os.getenv("DASHBOARD_USER", "admin").lower()]
    valid_pass = os.getenv("DASHBOARD_PASS", "copilot2026!")

    if user_input in valid_users and req.password == valid_pass:
        return {
            "access_token": "copilot_session_token_2026",
            "token_type": "bearer",
            "user": {"email": user_input, "role": "admin"}
        }
    
    raise HTTPException(status_code=401, detail="Invalid username or password")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
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


class RenegotiatePayload(BaseModel):
    counter_rate: Optional[float] = None
    notes: Optional[str] = None


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send email and return True on success, False on failure."""
    try:
        print(f"[EMAIL] To: {to}, Subject: {subject}")
        print(f"[EMAIL] Body: {body}")
        # Simulate email sending - replace with actual email service
        await asyncio.sleep(0.1)
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email to {to}: {e}")
        return False


@app.get("/api/pipelines")
async def list_pipelines(token: str = Depends(verify_auth)) -> Dict[str, Any]:
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
async def get_pipeline(pipeline_id: str, token: str = Depends(verify_auth)) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)
    return pipeline


@app.post("/api/pipelines/{pipeline_id}/approve")
async def approve_pipeline(pipeline_id: str, payload: ApprovePayload, token: str = Depends(verify_auth)) -> Dict[str, Any]:
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

    # Send emails FIRST - transactional approach
    shipper_subject = payload.email_subject or f"Load {pipeline_id} Approved & Dispatched"
    shipper_body = payload.email_body or f"Load {pipeline_id} has been approved and dispatched."
    
    carrier_subject = f"Rate Confirmation: Load {pipeline_id}"
    carrier_body = payload.carrier_body or f"Load {pipeline_id} rate confirmed."

    print(f"[DISPATCH] Sending shipper notification email...")
    shipper_sent = await send_email(shipper_email, shipper_subject, shipper_body)
    
    print(f"[DISPATCH] Sending carrier rate confirmation email...")
    carrier_sent = await send_email(carrier_email, carrier_subject, carrier_body)
    
    # ONLY delete/archive if BOTH emails succeed
    if not shipper_sent or not carrier_sent:
        print(f"[DISPATCH ERROR] Failed to send emails - shipper: {shipper_sent}, carrier: {carrier_sent}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Email delivery failed - shipper: {'sent' if shipper_sent else 'failed'}, carrier: {'sent' if carrier_sent else 'failed'}. Pipeline retained for retry."
        )

    # Both emails succeeded - now update pipeline status
    pipeline["status"] = "approved"
    pipeline["approved_at"] = datetime.now(timezone.utc).isoformat()
    pipeline["updated_at"] = datetime.now(timezone.utc).isoformat()
    store.save(pipeline_id, pipeline)

    print(f"[DISPATCH] Pipeline {pipeline_id} approved successfully.")
    print(f"[DISPATCH] Sent email to shipper: {shipper_email}")
    print(f"[DISPATCH] Sent email to carrier: {carrier_email}")
    
    # Broadcast FULL updated pipeline via SSE for real-time sync across all clients
    await notify_clients({"type": "approved", "pipeline_id": pipeline_id, "pipeline": pipeline})

    return {
        "status": "approved",
        "pipeline_id": pipeline_id
    }


@app.post("/api/pipelines/{pipeline_id}/reject")
async def reject_pipeline(pipeline_id: str, token: str = Depends(verify_auth)) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        print(f"[WARN] Pipeline {pipeline_id} not found for reject - nothing to delete")
        return {"status": "rejected", "pipeline_id": pipeline_id, "note": "Pipeline was not found"}

    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)

    # Store pipeline data before deletion for SSE broadcast
    rejected_pipeline = dict(pipeline)
    rejected_pipeline["status"] = "rejected"
    rejected_pipeline["rejected_at"] = datetime.now(timezone.utc).isoformat()
    
    store.delete(pipeline_id)
    # Broadcast FULL rejected pipeline via SSE for real-time sync
    await notify_clients({"type": "rejected", "pipeline_id": pipeline_id, "pipeline": rejected_pipeline})

    return {"status": "rejected", "pipeline_id": pipeline_id}


@app.post("/api/pipelines/{pipeline_id}/renegotiate")
async def renegotiate_pipeline(pipeline_id: str, payload: RenegotiatePayload, token: str = Depends(verify_auth)) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        print(f"[WARN] Pipeline {pipeline_id} not found for renegotiate - creating minimal record")
        pipeline = create_pipeline_record(pipeline_id, {"origin": "Unknown", "destination": "Unknown", "equipment": "Unknown", "weight": 0})
        store.save(pipeline_id, pipeline)

    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)

    # Calculate counter-offer rate: 10% lower than current rate, or DAT median if lower
    current_rate = pipeline.get("rate", 2850)
    benchmark = pipeline.get("benchmark", 2450)
    counter_rate = payload.counter_rate or min(current_rate * 0.9, benchmark)
    counter_rate = round(counter_rate)

    # Update pipeline status to "In Negotiation"
    pipeline["status"] = "in_negotiation"
    pipeline["renegotiated_at"] = datetime.now(timezone.utc).isoformat()
    pipeline["counter_rate"] = counter_rate
    pipeline["renegotiation_notes"] = payload.notes or ""
    pipeline["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Generate counter-offer email draft
    origin = pipeline.get("origin", "")
    destination = pipeline.get("destination", "")
    origin_state = pipeline.get("originState", "")
    destination_state = pipeline.get("destinationState", "")
    shipper = pipeline.get("shipper", "Shipper")
    equipment = pipeline.get("equipment", "Dry Van")
    pickup = pipeline.get("pickup", origin)

    counter_subject = f"Counter Offer: Load {pipeline_id} - {origin}, {origin_state} to {destination}, {destination_state}"
    counter_body = (
        f"Hi {shipper} team,\n\n"
        f"Thank you for the opportunity on load {pipeline_id}.\n"
        f"After reviewing the lane from {origin}, {origin_state} to {destination}, {destination_state}, "
        f"we'd like to propose a counter-offer of ${counter_rate:,} for the {equipment} shipment.\n\n"
        f"This rate reflects current DAT lane median benchmarks (${benchmark:,}) "
        f"and accounts for the {equipment} capacity in this corridor.\n\n"
        f"Pickup remains scheduled for {pickup}.\n\n"
        f"Please let us know if this works for your team.\n\n"
        f"Best regards,\nDispatch Operations"
    )

    # Store the draft
    drafts = safe_dict(pipeline.get("drafts") or {})
    drafts["shipper_email"] = {"subject": counter_subject, "body": counter_body}
    pipeline["drafts"] = drafts

    store.save(pipeline_id, pipeline)

    print(f"[RENEGOTIATE] Pipeline {pipeline_id} moved to In Negotiation with counter-offer ${counter_rate:,}")

    # Broadcast FULL updated pipeline via SSE for real-time sync
    await notify_clients({
        "type": "renegotiated",
        "pipeline_id": pipeline_id,
        "counter_rate": counter_rate,
        "draft": {"subject": counter_subject, "body": counter_body},
        "pipeline": pipeline
    })

    return {
        "status": "in_negotiation",
        "pipeline_id": pipeline_id,
        "counter_rate": counter_rate,
        "draft": {"subject": counter_subject, "body": counter_body}
    }


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


def extract_city_state(location: str) -> tuple[str, str]:
    if not location:
        return "", ""
    parts = [p.strip() for p in location.split(",")]
    if len(parts) >= 2:
        city = parts[0]
        state = parts[-1].upper()
        # Validate state is 2 letters
        if len(state) == 2 and state.isalpha():
            return city, state
    return location, ""


def create_pipeline_record(pipeline_id: str, review_package: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    
    origin_raw = review_package.get("origin", "")
    destination_raw = review_package.get("destination", "")
    origin_city, origin_state = extract_city_state(origin_raw)
    destination_city, destination_state = extract_city_state(destination_raw)
    
    rate = review_package.get("rate", 0)
    weight = review_package.get("weight", 0)
    miles = review_package.get("distance", review_package.get("miles", 0))
    equipment = review_package.get("equipment", "Dry Van")
    commodity = review_package.get("commodity", "General Freight")
    shipper = review_package.get("shipper", "Acme Shipping")
    
    pickup = review_package.get("pickup", origin_raw)
    delivery = review_package.get("delivery", destination_raw)
    received = review_package.get("received", now)
    
    benchmark = review_package.get("dat_benchmark", {}).get("median_rate", review_package.get("benchmark", 2450))
    margin = review_package.get("margin", 0)
    confidence = review_package.get("ai_confidence", review_package.get("confidence", 94))
    
    matched_carriers = review_package.get("matched_carriers", review_package.get("matches", []))
    # Generate default carriers if none provided
    if not matched_carriers:
        matched_carriers = [
            {"name": "Blue Ridge Logistics", "score": 96, "equipment": equipment, "phone": "+1-555-0101", "email": "dispatch@blueridgelog.com", "mc_number": "MC-123456"},
            {"name": "Northline Carriers", "score": 91, "equipment": equipment, "phone": "+1-555-0102", "email": "ops@northlinecar.com", "mc_number": "MC-234567"},
            {"name": "Copper State Freight", "score": 87, "equipment": equipment, "phone": "+1-555-0103", "email": "dispatch@copperstatefr.com", "mc_number": "MC-345678"},
        ]
    dat_benchmark = review_package.get("dat_benchmark", {"median_rate": benchmark})
    ai_confidence = review_package.get("ai_confidence", confidence)
    
    return {
        "id": pipeline_id,
        "pipeline_id": pipeline_id,
        "origin": origin_city or origin_raw,
        "destination": destination_city or destination_raw,
        "originState": origin_state,
        "destinationState": destination_state,
        "equipment": equipment,
        "rate": rate or 2850,
        "benchmark": benchmark,
        "margin": margin,
        "confidence": confidence,
        "weight": str(weight or 42000),
        "miles": miles or 1200,
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