# MTI Alert

`MTI Alert` is a centralized real-time communication platform for creating, scheduling, delivering, monitoring, and auditing important internal communications across multiple channels.

For the current MVP, the primary channels are:
- `Windows Agent` for desktop delivery
- `WhatsApp` for mobile or field delivery

The platform is designed around one unified communication model for alerts, reminders, operational notices, news, articles, and knowledge updates.

## Current Status
- `Phase 1 - Core Backend Foundation` is completed.
- `Phase 4 - Hardening And Expansion` is now the active implementation phase.
- The repository currently contains an admin application codebase, source-of-truth project documentation, and an early backend scaffold under `backend/`.
- Backend implementation continues in phases through the roadmap under `docs/`.
- Versioned backend migrations now exist under `backend/migrations/` for the Phase 1 foundation schema.
- A desktop-first Docker baseline now exists through `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`, `docker-compose.with-postgres.yml`, `docker/nginx.admin-gateway.conf`, and `.env.docker.example`.

## Source Of Truth
The source of truth for product scope, workflow, architecture, API contract, and data model is under `docs/`.

Start with:
- `docs/implementation-roadmap.md`
- `docs/project-plan.md`
- `docs/product-principles.md`
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`

Supporting references may also exist under `docs/`, such as:
- `docs/architecture-decisions.md`
- `docs/testing-strategy.md`
- `docs/software-acceptance-test.md`
- `docs/deployment-and-environment.md`
- `docs/integration-contracts.md`
- `docs/go-live-checklist.md`
- `docs/reminder-hybrid-ux.md`
- `docs/template-policy-schema.md`

## Repository Structure
```text
.
├── docs/                    # Source-of-truth documents and supporting references
├── backend/                 # Backend scaffold and modular server implementation
├── public/                  # Static assets
├── src/                     # Admin application source code
├── Dockerfile.backend       # Backend production image
├── Dockerfile.frontend      # Frontend SSR production image
├── docker-compose.yml       # Desktop-first stack using an external PostgreSQL and admin gateway
├── docker-compose.with-postgres.yml # Optional PostgreSQL container overlay
├── docker/                  # Docker support files such as the admin reverse-proxy config
├── .env.docker.example      # Docker environment template
├── AGENTS.md                # Working method and guardrails for AI agents
├── README.md                # Repository entry point
├── package.json             # Project package manifest
└── vite.config.ts           # Frontend build configuration
```

## Working Rules
- Read `docs/implementation-roadmap.md` before any non-trivial work.
- Use the source documents listed by the active phase before implementing changes.
- Do not change backend behavior without checking whether `docs/openapi.yaml` must also change.
- Do not silently assume unresolved behavior; record ambiguity in `docs/open-questions-and-challenges.md`.
- Keep mandatory documents synchronized when behavior or scope changes.

## Recommended Reading Order
### For Product Or Architecture Review
1. `docs/project-plan.md`
2. `docs/product-principles.md`
3. `docs/functional-specification.md`
4. `docs/technical-implementation-plan.md`

### For Backend Implementation
1. `docs/implementation-roadmap.md`
2. `docs/functional-specification.md`
3. `docs/technical-implementation-plan.md`
4. `docs/database-schema-specification.md`
5. `docs/openapi.yaml`
6. `docs/backend-module-breakdown.md`
7. `docs/phase-1-execution-plan.md`
8. `docs/testing-strategy.md`

## Backend Migration Commands
- `npm run backend:build`
- `npm run backend:migrate:status`
- `npm run backend:migrate`

For local iteration without a build step:
- `npm run backend:migrate:status:dev`
- `npm run backend:migrate:dev`

## Baseline Import Commands
Use these when preparing Phase 1 organization, employee, and device baseline data.

- `npm run backend:import:baseline:dev -- "<path-to-json>"`
- `npm run backend:import:baseline:dev:rollback -- "<path-to-json>"`
- `npm run backend:import:baseline -- "<path-to-json>"`
- `npm run backend:import:baseline:rollback -- "<path-to-json>"`

Reference files:
- `backend/examples/phase1-baseline.example.json`
- `backend/examples/phase1-baseline.template.json`
- `backend/examples/phase1-baseline.schema.json`
- `docs/integration-contracts.md`
- `docs/phase-1-baseline-mapping-guide.md`

### For AI Agents
1. `AGENTS.md`
2. `docs/implementation-roadmap.md`
3. The active phase source documents

## Docker Baseline
The current desktop-first stack can now be started with Docker for local parity and shared-environment bring-up.

1. Copy `.env.docker.example` to `.env.docker` and replace the placeholder LDAP and PostgreSQL secrets.
2. For an existing PostgreSQL server, build and start the stack:

```bash
docker-compose --env-file .env.docker up --build
```

3. If you want Docker to also start PostgreSQL locally, use the optional overlay:

```bash
docker-compose --env-file .env.docker -f docker-compose.yml -f docker-compose.with-postgres.yml up --build
```

If your machine uses the newer plugin form, `docker compose --env-file .env.docker up --build` is equivalent.

3. Access:
- admin frontend: `http://localhost:8080`
- backend API: `http://localhost:4019`
- PostgreSQL: `localhost:5432`

Implementation notes:
- the backend container runs migrations before starting the HTTP server
- the frontend container builds TanStack Start with `NITRO_PRESET=node-server` so it can run as a normal Node SSR process inside Docker
- the admin browser path now goes through an `nginx` gateway that proxies same-origin `/api/*` requests to the internal backend service, avoiding mixed-content and CORS issues when the public site is served over HTTPS
- Docker now defaults the frontend API base to `DOCKER_VITE_API_URL=/api`, so the browser no longer needs to embed the backend host directly in frontend assets for the containerized publish path
- the first live desktop scope still expects `ENABLED_DELIVERY_CHANNELS=WindowsAgent` and `VITE_ENABLED_DELIVERY_CHANNELS=DesktopAgent`

## MVP Highlights
- Unified communication engine across multiple content types
- Device-centric desktop targeting by site and area
- Push-first Windows Agent delivery model
- WhatsApp as a parallel MVP channel
- Template-driven workflow, channel, and presentation policy
- Strong preview and confirmation instead of approval workflow in MVP
- Delivery, read, and response tracking with auditability

## Notes
- `README.md` is the entry point, not the full specification.
- Detailed behavior, contracts, and constraints remain under `docs/`.
- If `README.md` and `docs/` ever conflict, treat `docs/` as authoritative and synchronize `README.md`.
