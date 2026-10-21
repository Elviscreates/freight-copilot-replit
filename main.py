import json
import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

from services.pipeline_store import store
from services.ai_negotiator import AINegotiatorService, CarrierBidRequest, NegotiationResponse


# JWT Authentication Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

def create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    return jwt.encode(
        {"sub": username, "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )

def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )
        if payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def verify_token_from_query(token: str = Query(...)):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )
        if payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


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
DASHBOARD_PASS = os.getenv("DASHBOARD_PASS", "admin123")
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


@app.post("/auth/login")
async def auth_login(request: Request):
    body = await request.json()
    expected_user = os.environ.get("AUTH_USERNAME", "admin")
    expected_pass = os.environ.get("AUTH_PASSWORD", "admin123")
    if body.get("username") != expected_user or body.get("password") != expected_pass:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    return {
        "token": create_token(expected_user),
        "expires_in": JWT_EXPIRY_HOURS * 3600
    }


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
async def list_pipelines(_: dict = Depends(verify_token)) -> Dict[str, Any]:
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
async def get_pipeline(pipeline_id: str, _: dict = Depends(verify_token)) -> Dict[str, Any]:
    pipeline = store.get(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if isinstance(pipeline, str):
        pipeline = safe_dict(pipeline)
    return pipeline


@app.post("/api/pipelines/{pipeline_id}/approve")
async def approve_pipeline(pipeline_id: str, payload: ApprovePayload, _: dict = Depends(verify_token)) -> Dict[str, Any]:
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
async def reject_pipeline(pipeline_id: str, _: dict = Depends(verify_token)) -> Dict[str, Any]:
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
async def renegotiate_pipeline(pipeline_id: str, payload: RenegotiatePayload, _: dict = Depends(verify_token)) -> Dict[str, Any]:
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
async def stream_events(request: Request, _: dict = Depends(verify_token_from_query)) -> StreamingResponse:
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
        "pipeline": pipeline,
        "summary": {
            "origin": pipeline.get("origin", ""),
            "destination": pipeline.get("destination", ""),
            "origin_state": pipeline.get("originState", ""),
            "destination_state": pipeline.get("destinationState", ""),
            "equipment": pipeline.get("equipment", ""),
            "rate": pipeline.get("rate", 0),
            "benchmark": pipeline.get("benchmark", 0),
            "margin": pipeline.get("margin", 0),
            "confidence": pipeline.get("confidence", 0),
            "weight": pipeline.get("weight", ""),
            "miles": pipeline.get("miles", 0),
            "commodity": pipeline.get("commodity", ""),
            "shipper": pipeline.get("shipper", ""),
            "pickup": pipeline.get("pickup", ""),
            "delivery": pipeline.get("delivery", ""),
            "received": pipeline.get("received", ""),
            "review_summary": pipeline.get("review_summary", {}),
            "drafts": pipeline.get("drafts", {}),
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


@app.post("/api/copilot/negotiate")
async def negotiate_rate(request: CarrierBidRequest, _: dict = Depends(verify_token)) -> NegotiationResponse:
    """AI Copilot endpoint for carrier rate negotiation.
    
    Evaluates a carrier's bid against DAT market benchmarks and returns
    a structured recommendation: ACCEPT, COUNTER, or REJECT with rationale.
    """
    result = AINegotiatorService.evaluate(request)
    
    # Log the negotiation for audit trail
    print(f"[COPILOT] Negotiation for {request.carrier_name} on {request.lane_origin}→{request.lane_destination}: "
          f"Bid=${request.bid_rate:,.2f}, Median=${result.market_median:,.2f}, Decision={result.decision}")
    
    return result


@app.post("/api/loads/seed")
async def seed_demo_loads() -> Dict[str, Any]:
    """Seed 5 demo inbound loads into the pipeline queue for testing."""
    from datetime import datetime, timezone, timedelta
    
    demo_loads = [
        {
            "pipeline_id": "FC-3001",
            "review_package": {
                "load_id": "FC-3001",
                "origin": "Atlanta, GA",
                "destination": "Chicago, IL",
                "origin_state": "GA",
                "destination_state": "IL",
                "equipment": "Dry Van",
                "rate": 3200,
                "dat_benchmark": {"median_rate": 3050},
                "margin": 4.9,
                "confidence": 94,
                "weight": "42800",
                "miles": 716,
                "commodity": "Packaged foods",
                "shipper": "Pine & Rail Foods",
                "pickup": "2024-05-21T08:00:00",
                "delivery": "2024-05-22T14:00:00",
                "received": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
                "review_summary": {
                    "shipper_email": "shipper@pinerail.com",
                    "carrier_contacts": [{"email": "dispatch@blueridgelog.com", "name": "Blue Ridge Logistics"}]
                },
                "matched_carriers": [
                    {"name": "Blue Ridge Logistics", "score": 96, "equipment": "Dry Van", "phone": "+1-555-0101", "email": "dispatch@blueridgelog.com", "mc_number": "MC-123456"},
                    {"name": "Northline Carriers", "score": 91, "equipment": "Dry Van", "phone": "+1-555-0102", "email": "ops@northlinecar.com", "mc_number": "MC-234567"},
                ],
                "drafts": {
                    "shipper_email": {"body": "Hi Pine & Rail team, Freight Copilot has matched a carrier for your Atlanta to Chicago shipment..."},
                    "carrier_outreach": {"body": "Load Assignment: FC-3001\nLane: Atlanta, GA → Chicago, IL\nEquipment: Dry Van\nRate: $3,200"}
                },
                "email_body": "Hi Pine & Rail team, Freight Copilot has matched a carrier for your Atlanta to Chicago shipment...",
                "email_subject": "Load FC-3001 - Atlanta, GA to Chicago, IL",
                "carrier_body": "Load Assignment: FC-3001\nLane: Atlanta, GA → Chicago, IL\nEquipment: Dry Van\nRate: $3,200",
                "distance": 716,
            }
        },
        {
            "pipeline_id": "FC-3002",
            "review_package": {
                "load_id": "FC-3002",
                "origin": "Dallas, TX",
                "destination": "Phoenix, AZ",
                "origin_state": "TX",
                "destination_state": "AZ",
                "equipment": "Reefer",
                "rate": 3800,
                "dat_benchmark": {"median_rate": 3500},
                "margin": 8.6,
                "confidence": 91,
                "weight": "38500",
                "miles": 885,
                "commodity": "Fresh produce",
                "shipper": "Texas Fresh Co.",
                "pickup": "2024-05-21T13:00:00",
                "delivery": "2024-05-23T09:00:00",
                "received": (datetime.now(timezone.utc) - timedelta(minutes=12)).isoformat(),
                "review_summary": {
                    "shipper_email": "shipper@texasfresh.com",
                    "carrier_contacts": [{"email": "dispatch@desertline.com", "name": "Desert Linehaul"}]
                },
                "matched_carriers": [
                    {"name": "Desert Linehaul", "score": 92, "equipment": "Reefer", "phone": "+1-555-0103", "email": "dispatch@desertline.com", "mc_number": "MC-345678"},
                    {"name": "Sunbelt Refrigerated", "score": 88, "equipment": "Reefer", "phone": "+1-555-0104", "email": "ops@sunbeltreefer.com", "mc_number": "MC-456789"},
                ],
                "drafts": {
                    "shipper_email": {"body": "Hi Texas Fresh team, Freight Copilot has matched a reefer carrier for your Dallas to Phoenix shipment..."},
                    "carrier_outreach": {"body": "Load Assignment: FC-3002\nLane: Dallas, TX → Phoenix, AZ\nEquipment: Reefer\nRate: $3,800"}
                },
                "email_body": "Hi Texas Fresh team, Freight Copilot has matched a reefer carrier for your Dallas to Phoenix shipment...",
                "email_subject": "Load FC-3002 - Dallas, TX to Phoenix, AZ",
                "carrier_body": "Load Assignment: FC-3002\nLane: Dallas, TX → Phoenix, AZ\nEquipment: Reefer\nRate: $3,800",
                "distance": 885,
            }
        },
        {
            "pipeline_id": "FC-3003",
            "review_package": {
                "load_id": "FC-3003",
                "origin": "Los Angeles, CA",
                "destination": "Denver, CO",
                "origin_state": "CA",
                "destination_state": "CO",
                "equipment": "Flatbed",
                "rate": 4200,
                "dat_benchmark": {"median_rate": 3950},
                "margin": 6.3,
                "confidence": 89,
                "weight": "45000",
                "miles": 830,
                "commodity": "Steel coils",
                "shipper": "West Coast Metals",
                "pickup": "2024-05-22T07:00:00",
                "delivery": "2024-05-23T16:00:00",
                "received": (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat(),
                "review_summary": {
                    "shipper_email": "shipper@westcoastmetals.com",
                    "carrier_contacts": [{"email": "dispatch@mountainfreight.com", "name": "Mountain Freight"}]
                },
                "matched_carriers": [
                    {"name": "Mountain Freight", "score": 94, "equipment": "Flatbed", "phone": "+1-555-0105", "email": "dispatch@mountainfreight.com", "mc_number": "MC-567890"},
                    {"name": "Rocky Mountain Haulers", "score": 87, "equipment": "Flatbed", "phone": "+1-555-0106", "email": "ops@rockymountain.com", "mc_number": "MC-678901"},
                ],
                "drafts": {
                    "shipper_email": {"body": "Hi West Coast Metals team, Freight Copilot has matched a flatbed carrier for your LA to Denver steel shipment..."},
                    "carrier_outreach": {"body": "Load Assignment: FC-3003\nLane: Los Angeles, CA → Denver, CO\nEquipment: Flatbed\nRate: $4,200"}
                },
                "email_body": "Hi West Coast Metals team, Freight Copilot has matched a flatbed carrier for your LA to Denver steel shipment...",
                "email_subject": "Load FC-3003 - Los Angeles, CA to Denver, CO",
                "carrier_body": "Load Assignment: FC-3003\nLane: Los Angeles, CA → Denver, CO\nEquipment: Flatbed\nRate: $4,200",
                "distance": 830,
            }
        },
        {
            "pipeline_id": "FC-3004",
            "review_package": {
                "load_id": "FC-3004",
                "origin": "Charlotte, NC",
                "destination": "Memphis, TN",
                "origin_state": "NC",
                "destination_state": "TN",
                "equipment": "Dry Van",
                "rate": 1850,
                "dat_benchmark": {"median_rate": 1750},
                "margin": 5.7,
                "confidence": 93,
                "weight": "39200",
                "miles": 560,
                "commodity": "Textiles",
                "shipper": "Carolina Textiles",
                "pickup": "2024-05-22T09:00:00",
                "delivery": "2024-05-22T20:00:00",
                "received": (datetime.now(timezone.utc) - timedelta(minutes=35)).isoformat(),
                "review_summary": {
                    "shipper_email": "shipper@carolinatextiles.com",
                    "carrier_contacts": [{"email": "dispatch@southernlogistics.com", "name": "Southern Logistics"}]
                },
                "matched_carriers": [
                    {"name": "Southern Logistics", "score": 95, "equipment": "Dry Van", "phone": "+1-555-0107", "email": "dispatch@southernlogistics.com", "mc_number": "MC-789012"},
                    {"name": "Delta Carriers", "score": 89, "equipment": "Dry Van", "phone": "+1-555-0108", "email": "ops@deltacarriers.com", "mc_number": "MC-890123"},
                ],
                "drafts": {
                    "shipper_email": {"body": "Hi Carolina Textiles team, Freight Copilot has matched a carrier for your Charlotte to Memphis textile shipment..."},
                    "carrier_outreach": {"body": "Load Assignment: FC-3004\nLane: Charlotte, NC → Memphis, TN\nEquipment: Dry Van\nRate: $1,850"}
                },
                "email_body": "Hi Carolina Textiles team, Freight Copilot has matched a carrier for your Charlotte to Memphis textile shipment...",
                "email_subject": "Load FC-3004 - Charlotte, NC to Memphis, TN",
                "carrier_body": "Load Assignment: FC-3004\nLane: Charlotte, NC → Memphis, TN\nEquipment: Dry Van\nRate: $1,850",
                "distance": 560,
            }
        },
        {
            "pipeline_id": "FC-3005",
            "review_package": {
                "load_id": "FC-3005",
                "origin": "Seattle, WA",
                "destination": "Salt Lake City, UT",
                "origin_state": "WA",
                "destination_state": "UT",
                "equipment": "Reefer",
                "rate": 4100,
                "dat_benchmark": {"median_rate": 3800},
                "margin": 7.9,
                "confidence": 90,
                "weight": "41000",
                "miles": 835,
                "commodity": "Frozen seafood",
                "shipper": "Pacific Seafood Co.",
                "pickup": "2024-05-22T06:00:00",
                "delivery": "2024-05-24T12:00:00",
                "received": (datetime.now(timezone.utc) - timedelta(minutes=48)).isoformat(),
                "review_summary": {
                    "shipper_email": "shipper@pacificseafood.com",
                    "carrier_contacts": [{"email": "dispatch@northwestreefer.com", "name": "Northwest Refrigerated"}]
                },
                "matched_carriers": [
                    {"name": "Northwest Refrigerated", "score": 93, "equipment": "Reefer", "phone": "+1-555-0109", "email": "dispatch@northwestreefer.com", "mc_number": "MC-901234"},
                    {"name": "Cascade Cold Chain", "score": 86, "equipment": "Reefer", "phone": "+1-555-0110", "email": "ops@cascadecold.com", "mc_number": "MC-012345"},
                ],
                "drafts": {
                    "shipper_email": {"body": "Hi Pacific Seafood team, Freight Copilot has matched a reefer carrier for your Seattle to Salt Lake City frozen seafood shipment..."},
                    "carrier_outreach": {"body": "Load Assignment: FC-3005\nLane: Seattle, WA → Salt Lake City, UT\nEquipment: Reefer\nRate: $4,100"}
                },
                "email_body": "Hi Pacific Seafood team, Freight Copilot has matched a reefer carrier for your Seattle to Salt Lake City frozen seafood shipment...",
                "email_subject": "Load FC-3005 - Seattle, WA to Salt Lake City, UT",
                "carrier_body": "Load Assignment: FC-3005\nLane: Seattle, WA → Salt Lake City, UT\nEquipment: Reefer\nRate: $4,100",
                "distance": 835,
            }
        },
    ]
    
    created = []
    for load in demo_loads:
        pipeline = create_pipeline_record(load["pipeline_id"], load["review_package"])
        store.save(load["pipeline_id"], pipeline)
        created.append(load["pipeline_id"])
        
        # Broadcast new_load SSE event for real-time UI update
        await notify_clients({
            "type": "new_load",
            "pipeline_id": load["pipeline_id"],
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
    
    print(f"[SEED] Created {len(created)} demo loads: {created}")
    return {"status": "seeded", "count": len(created), "pipeline_ids": created}


@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)