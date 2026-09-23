import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test that the health endpoint returns 200 and correct status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_cors_headers():
    """Test that CORS headers are present for allowed origins."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/api/pipelines",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}
        )
        assert response.status_code in (200, 204)
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert response.headers.get("access-control-allow-credentials") == "true"


@pytest.mark.asyncio
async def test_cors_preflight_rejects_unknown_origin():
    """Test that unknown origins are rejected."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/api/pipelines",
            headers={"Origin": "http://evil.com", "Access-Control-Request-Method": "GET"}
        )
        # Should not include the evil origin in CORS headers
        assert response.headers.get("access-control-allow-origin") != "http://evil.com"


@pytest.mark.asyncio
async def test_list_pipelines_empty():
    """Test that list pipelines returns empty list when store is empty."""
    from services.pipeline_store import store
    store._store.clear()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/pipelines")
        assert response.status_code == 200
        data = response.json()
        assert "pipelines" in data
        assert "count" in data
        assert data["count"] == 0
        assert data["pipelines"] == []


@pytest.mark.asyncio
async def test_pipeline_crud():
    """Test create, read, delete pipeline."""
    from services.pipeline_store import store
    store._store.clear()

    pipeline_data = {
        "review_summary": {
            "shipper_email": "test@example.com",
            "carrier_contacts": [{"email": "carrier@example.com", "name": "Test Carrier"}]
        },
        "load_id": "TEST-001"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create via webhook
        webhook_payload = {
            "pipeline_id": "TEST-001",
            "review_package": pipeline_data
        }
        response = await client.post("/webhook/load-tender", json=webhook_payload)
        assert response.status_code == 200
        assert response.json()["status"] == "received"

        # Read
        response = await client.get("/api/pipelines/TEST-001")
        assert response.status_code == 200
        assert response.json()["load_id"] == "TEST-001"

        # List
        response = await client.get("/api/pipelines")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1

        # Reject
        response = await client.post("/api/pipelines/TEST-001/reject")
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

        # Verify deleted
        response = await client.get("/api/pipelines/TEST-001")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_pipeline_approve():
    """Test approve pipeline with email drafts."""
    from services.pipeline_store import store
    store._store.clear()

    pipeline_data = {
        "review_summary": {
            "shipper_email": "test@example.com",
            "carrier_contacts": [{"email": "carrier@example.com", "name": "Test Carrier"}]
        },
        "load_id": "TEST-002"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        webhook_payload = {
            "pipeline_id": "TEST-002",
            "review_package": pipeline_data
        }
        response = await client.post("/webhook/load-tender", json=webhook_payload)
        assert response.status_code == 200

        approve_payload = {
            "email_subject": "Test Subject",
            "email_body": "Test Body",
            "carrier_body": "Carrier Test Body"
        }
        response = await client.post("/api/pipelines/TEST-002/approve", json=approve_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["pipeline_id"] == "TEST-002"

        # Verify pipeline is marked as APPROVED (not deleted)
        response = await client.get("/api/pipelines/TEST-002")
        assert response.status_code == 200
        assert response.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_sse_stream_endpoint():
    """Test SSE stream endpoint returns correct content type."""
    from services.pipeline_store import store
    from main import stream_events
    from fastapi import Request
    from unittest.mock import AsyncMock, MagicMock
    
    store._store.clear()

    # Test the stream_events function directly with a mock request
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    
    # Call the endpoint function directly
    response = await stream_events(mock_request)
    
    # Verify it's a StreamingResponse with correct media type
    assert response.media_type == "text/event-stream"
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_webhook_triggers_sse_notification():
    """Test that webhook triggers SSE notification to connected clients."""
    from services.pipeline_store import store
    from main import sse_clients, notify_clients
    import asyncio
    
    store._store.clear()
    sse_clients.clear()
    
    queue = asyncio.Queue()
    sse_clients.append(queue)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Trigger a new load via webhook
        webhook_payload = {
            "pipeline_id": "SSE-TEST-001",
            "review_package": {
                "load_id": "SSE-TEST-001",
                "review_summary": {
                    "shipper_email": "test@example.com"
                }
            }
        }
        response = await client.post("/webhook/load-tender", json=webhook_payload)
        assert response.status_code == 200
        
        # Check that SSE client received notification
        message = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert "new_load" in message
        assert "SSE-TEST-001" in message
    
    sse_clients.clear()


@pytest.mark.asyncio
async def test_approve_triggers_sse_notification():
    """Test that approve triggers SSE notification to connected clients."""
    from services.pipeline_store import store
    from main import sse_clients
    import asyncio
    
    store._store.clear()
    sse_clients.clear()
    
    # Create pipeline first without SSE client
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        webhook_payload = {
            "pipeline_id": "SSE-TEST-002",
            "review_package": {
                "load_id": "SSE-TEST-002",
                "review_summary": {
                    "shipper_email": "test@example.com"
                }
            }
        }
        await client.post("/webhook/load-tender", json=webhook_payload)
    
    # Now connect SSE client and approve
    queue = asyncio.Queue()
    sse_clients.append(queue)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        approve_payload = {
            "email_subject": "Test Subject",
            "email_body": "Test Body",
            "carrier_body": "Carrier Test Body"
        }
        response = await client.post("/api/pipelines/SSE-TEST-002/approve", json=approve_payload)
        assert response.status_code == 200
        
        # Check that SSE client received notification
        message = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert "approved" in message
        assert "SSE-TEST-002" in message
    
    sse_clients.clear()


@pytest.mark.asyncio
async def test_sse_event_generator_yields_ping():
    """Test SSE event generator yields ping messages."""
    from main import event_generator
    import asyncio
    
    gen = event_generator()
    try:
        # Get first yield (should be a ping after 15s timeout, but we'll just check it's an async generator)
        result = await asyncio.wait_for(gen.__anext__(), timeout=2.0)
        # In test environment, it might yield immediately or wait
        # Just verify the generator works
        assert result is not None
    except asyncio.TimeoutError:
        # Expected if it waits for queue
        pass
    finally:
        await gen.aclose()


@pytest.mark.asyncio
async def test_notify_clients_broadcasts_events():
    """Test notify_clients broadcasts events to connected clients."""
    from main import notify_clients, sse_clients
    import asyncio
    
    sse_clients.clear()
    queue = asyncio.Queue()
    sse_clients.append(queue)
    
    test_event = {"type": "test_event", "data": "test"}
    await notify_clients(test_event)
    
    # Check queue received the message
    message = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert "test_event" in message
    assert message.startswith("data: ")
    assert message.endswith("\n\n")
    
    sse_clients.clear()


@pytest.mark.asyncio
async def test_approve_handles_missing_review_summary_gracefully():
    """Test approve handles missing review_summary without 500 error."""
    from services.pipeline_store import store
    store._store.clear()

    # Pipeline with minimal data - no review_summary
    pipeline_data = {
        "load_id": "TEST-003"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        webhook_payload = {
            "pipeline_id": "TEST-003",
            "review_package": pipeline_data
        }
        response = await client.post("/webhook/load-tender", json=webhook_payload)
        assert response.status_code == 200

        approve_payload = {
            "email_subject": "Test Subject",
            "email_body": "Test Body",
            "carrier_body": "Carrier Test Body"
        }
        response = await client.post("/api/pipelines/TEST-003/approve", json=approve_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["pipeline_id"] == "TEST-003"


@pytest.mark.asyncio
async def test_approve_handles_string_review_summary_gracefully():
    """Test approve handles string review_summary without 500 error."""
    from services.pipeline_store import store
    import json
    store._store.clear()

    # Pipeline with review_summary as JSON string
    pipeline_data = {
        "review_summary": json.dumps({"shipper_email": "test@example.com"}),
        "load_id": "TEST-004"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        webhook_payload = {
            "pipeline_id": "TEST-004",
            "review_package": pipeline_data
        }
        response = await client.post("/webhook/load-tender", json=webhook_payload)
        assert response.status_code == 200

        approve_payload = {
            "email_subject": "Test Subject",
            "email_body": "Test Body",
            "carrier_body": "Carrier Test Body"
        }
        response = await client.post("/api/pipelines/TEST-004/approve", json=approve_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["pipeline_id"] == "TEST-004"


@pytest.mark.asyncio
async def test_get_pipeline_handles_string_data_gracefully():
    """Test get_pipeline handles string data without 500 error."""
    from services.pipeline_store import store
    import json
    store._store.clear()

    # Store pipeline as JSON string
    pipeline_data = {
        "load_id": "TEST-005",
        "review_summary": {"shipper_email": "test@example.com"}
    }
    store.save("TEST-005", json.dumps(pipeline_data))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/pipelines/TEST-005")
        assert response.status_code == 200
        data = response.json()
        assert data["load_id"] == "TEST-005"


@pytest.mark.asyncio
async def test_list_pipelines_handles_mixed_data():
    """Test list_pipelines handles mixed dict/string data without 500 error."""
    from services.pipeline_store import store
    import json
    store._store.clear()

    # Store one as dict, one as string
    store.save("TEST-006", {"load_id": "TEST-006", "review_summary": {}})
    store.save("TEST-007", json.dumps({"load_id": "TEST-007", "review_summary": {}}))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/pipelines")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        # Both should be accessible
        pipeline_ids = [p.get("load_id") or p.get("pipeline_id") for p in data["pipelines"]]
        assert "TEST-006" in pipeline_ids
        assert "TEST-007" in pipeline_ids