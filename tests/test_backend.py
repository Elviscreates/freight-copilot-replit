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
        assert response.json()["status"] == "approved"

        # Verify deleted
        response = await client.get("/api/pipelines/TEST-002")
        assert response.status_code == 404