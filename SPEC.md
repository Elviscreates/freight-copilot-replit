# Freight Copilot — Specification

## Overview
Freight Copilot is a real-time dispatch operations dashboard for freight brokers. It ingests load tenders via webhook, presents them in a review queue with AI-extracted details, and enables one-click approve/reject with automated communication drafts.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: FastAPI + uvicorn (Python 3.14)
- **Real-time**: Server-Sent Events (SSE)
- **State**: React hooks + TanStack Query
- **Routing**: Wouter
- **Testing**: Vitest + React Testing Library

## Backend API (Port 8000)

### Endpoints
- [x] `GET /health` — Health check, returns `{status: "ok"}`
- [x] `GET /api/pipelines` — List all pending pipelines with count
- [x] `GET /api/pipelines/{pipeline_id}` — Get single pipeline detail
- [x] `POST /api/pipelines/{pipeline_id}/approve` — Approve pipeline, send emails, delete from store, broadcast SSE
- [x] `POST /api/pipelines/{pipeline_id}/reject` — Reject pipeline, delete from store, broadcast SSE
- [x] `GET /api/stream` — SSE endpoint with 15s heartbeat
- [x] `POST /webhook/load-tender` — Ingest new load tender, save to store, broadcast `new_load` SSE

### SSE Event Types
- [x] `connected` — Connection established
- [x] `new_load` — New pipeline available `{type, pipeline_id, summary}`
- [x] `approved` — Pipeline approved `{type, pipeline_id}`
- [x] `rejected` — Pipeline rejected `{type, pipeline_id}`

### CORS
- [x] Allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`
- [x] Credentials: true
- [x] Methods: `*`
- [x] Headers: `*`

## Frontend (Port 3000)

### Core Features
- [x] **Pipeline List** — Real-time queue with search/filter
- [x] **Pipeline Detail** — AI-extracted fields, pricing, carrier matches
- [x] **Communication Drafts** — Shipper email / Carrier SMS tabs with auto-save
- [x] **Approve Action** — Sends shipper email + carrier SMS, removes from queue
- [x] **Reject Action** — Removes from queue
- [x] **SSE Connection Status** — Live/Reconnecting/Disconnected badge in topbar
- [x] **30s Polling Fallback** — If SSE drops, refetch every 30s
- [x] **History Panel** — Approved/rejected loads with timestamps
- [x] **Benchmarks View** — DAT lane comparisons
- [x] **Responsive Layout** — Sidebar rail + topbar + working canvas

### State Management
- [x] `usePipelines` hook — Centralized pipeline state + SSE subscription
- [x] Local draft state per pipeline (shipper/carrier)
- [x] History state for audit trail
- [x] Toast notifications for actions

### API Integration
- [x] `fetchPipelines()` → GET `/api/pipelines`
- [x] `approvePipeline(id, drafts)` → POST `/api/pipelines/{id}/approve`
- [x] `rejectPipeline(id)` → POST `/api/pipelines/{id}/reject`
- [x] `createSSEConnection()` → EventSource `/api/stream`

## Design System (Dark Glassmorphism)

### Colors (HSL)
- [x] Background: `222 14% 10%` (#292c33)
- [x] Card: `222 13% 14%` with `border: 220 11% 20%`
- [x] Primary: `32 92% 54%` (amber/orange)
- [x] Success: `142 76% 36%` (green)
- [x] Destructive: `4 69% 63%` (red)
- [x] Foreground: `210 17% 90%`
- [x] Muted: `216 8% 55%`

### Typography
- [x] Sans: DM Sans (400, 500, 600, 700)
- [x] Mono: Space Mono (400, 700)

### Effects
- [x] Glassmorphism cards: semi-transparent backgrounds + 1px borders
- [x] Live pulse animation on connection indicator
- [x] Shimmer loading skeletons
- [x] Toast slide-in animation
- [x] Hover/tap transforms on interactive elements
- [x] Focus-visible rings (amber)

### Layout
- [x] Fixed topbar (58px) with brand, search, connection status, notifications
- [x] Fixed sidebar rail (78px) with icon navigation
- [x] Main canvas with max-width 1640px
- [x] Responsive breakpoints: 1120px, 920px, 800px, 500px

## Testing
- [x] Render test for AppShell (passes)
- [x] Vitest + jsdom + React Testing Library configured
- [ ] Integration tests for approve/reject flow — *need rewrite for API-connected architecture*
- [ ] E2E tests (Playwright) — *pending*

## Deployment
- [x] Vite build outputs to `dist/public`
- [x] FastAPI serves on `0.0.0.0:8000`
- [x] Vite dev server with HMR on configurable PORT
- [x] Environment variables: PORT, BASE_PATH

## Known Gaps / Future Work
- [ ] `/health` endpoint added ✅
- [ ] Email service integration (currently logs to console)
- [ ] Webhook signature verification
- [ ] Authentication/Authorization
- [ ] Persistent storage (Redis/PostgreSQL)
- [ ] Playwright E2E tests
- [ ] SPEC.md checkboxes tracked here