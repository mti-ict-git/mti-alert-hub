# MTI Alert

`MTI Alert` is a centralized real-time communication platform for creating, scheduling, delivering, monitoring, and auditing important internal communications across multiple channels.

For the current MVP, the primary channels are:
- `Windows Agent` for desktop delivery
- `WhatsApp` for mobile or field delivery

The platform is designed around one unified communication model for alerts, reminders, operational notices, news, articles, and knowledge updates.

## Current Status
- Documentation baseline is the active implementation phase.
- The repository currently contains an admin application codebase plus source-of-truth project documentation.
- Backend implementation is planned in phases through the roadmap under `docs/`.

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
- `docs/deployment-and-environment.md`
- `docs/template-policy-schema.md`

## Repository Structure
```text
.
├── docs/                    # Source-of-truth documents and supporting references
├── public/                  # Static assets
├── src/                     # Admin application source code
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
6. `docs/testing-strategy.md`

### For AI Agents
1. `AGENTS.md`
2. `docs/implementation-roadmap.md`
3. The active phase source documents

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
