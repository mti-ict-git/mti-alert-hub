# MTI Alert Architecture Decisions

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`
- Owner: `Architecture`

## Purpose
This document records architecture decisions that should remain stable across implementation sessions. It exists to preserve intent, trade-offs, and constraints that are too important to leave only in discussion history.

## How To Use This Document
- Add a new decision when a technical choice changes implementation shape, operational behavior, integration boundaries, or auditability.
- Update an existing decision only when the decision itself changes, not for routine implementation detail.
- Keep the related source documents synchronized when a decision changes:
  - `docs/functional-specification.md`
  - `docs/technical-implementation-plan.md`
  - `docs/database-schema-specification.md`
  - `docs/openapi.yaml`
  - `docs/open-questions-and-challenges.md`

## Decision Format
Each decision should include:
- decision id
- status
- date
- context
- decision
- consequences
- related documents

## Baseline Decisions
### ADR-1. Modular Monolith For MVP
- Status: `Accepted`
- Date: `2026-07-07`
- Context: The MVP must move quickly while keeping enough structure for future scaling and clear AI-assisted implementation boundaries.
- Decision: Build the backend as a modular monolith with explicit module boundaries rather than starting with distributed microservices.
- Consequences:
  - Faster implementation and easier local debugging in early phases.
  - Domain boundaries must still be enforced in code to avoid a tangled monolith.
  - Internal module events and connector boundaries should remain event-friendly to support later extraction if needed.
- Related documents:
  - `docs/technical-implementation-plan.md`
  - `docs/project-plan.md`

### ADR-2. Node.js And TypeScript As Preferred Backend Stack
- Status: `Accepted`
- Date: `2026-07-07`
- Context: The current repository already leans toward TypeScript and needs shared understanding across backend and admin application work.
- Decision: Use `Node.js + TypeScript` as the preferred backend stack for the MVP unless a replacement preserves all documented contracts and behaviors.
- Consequences:
  - Shared language across more of the codebase reduces handoff friction.
  - OpenAPI and domain documents remain authoritative regardless of framework details.
  - Any alternative stack must still preserve documented workflows, statuses, and API contracts.
- Related documents:
  - `docs/technical-implementation-plan.md`
  - `docs/openapi.yaml`

### ADR-3. PostgreSQL As Primary Operational Database
- Status: `Accepted`
- Date: `2026-07-07`
- Context: The system requires reliable relational modeling for communication state, recipient snapshots, delivery tracking, reporting, and audit trails.
- Decision: Use `PostgreSQL` as the primary operational database.
- Consequences:
  - Normalized operational data and historical audit records can live in one consistent store.
  - Schema changes must stay synchronized with `docs/database-schema-specification.md`.
  - Query design should anticipate dashboard and audit workloads, not only transactional CRUD.
- Related documents:
  - `docs/database-schema-specification.md`
  - `docs/technical-implementation-plan.md`

### ADR-4. Windows Agent Delivery Is Push-First
- Status: `Accepted`
- Date: `2026-07-07`
- Context: Critical and operational communications require near-real-time delivery to desktop endpoints.
- Decision: The Windows Agent integration uses a SignalR-style push-first realtime model with reconciliation support for missed messages.
- Consequences:
  - The backend must maintain connection health visibility and heartbeat handling.
  - Reconciliation is still needed for disconnect and stale-agent scenarios.
  - Concrete realtime technology remains open, but the interaction model is fixed.
- Related documents:
  - `docs/technical-implementation-plan.md`
  - `docs/functional-specification.md`
  - `docs/open-questions-and-challenges.md`

### ADR-5. Desktop Targeting Is Device-Centric And Location-Oriented
- Status: `Accepted`
- Date: `2026-07-07`
- Context: Shared desktops and location-owned devices make person-centric desktop routing unreliable for MVP operations.
- Decision: Model Windows Agent delivery around devices and location metadata rather than person ownership.
- Consequences:
  - Device records must carry `site`, `area`, and `location_label` style metadata directly.
  - Delivery evidence for desktop is authoritative at the device level, with user identity captured only as optional audit context when available.
  - Audience resolution for desktop must remain compatible with scope filtering by site and area.
- Related documents:
  - `docs/functional-specification.md`
  - `docs/technical-implementation-plan.md`
  - `docs/database-schema-specification.md`

### ADR-6. LDAP Or Active Directory For Authentication, Local Authorization In MTI Alert
- Status: `Accepted`
- Date: `2026-07-07`
- Context: Enterprise identity should be externally trusted, but MTI Alert still needs local control over scopes and roles.
- Decision: Use LDAP or Active Directory for administrative authentication only, while MTI Alert owns role and scope mapping locally.
- Consequences:
  - Identity verification and authorization remain intentionally separated.
  - Role scope enforcement must be implemented in backend command and query paths, not only in the UI.
  - Exact production integration details remain open until implementation phase.
- Related documents:
  - `docs/functional-specification.md`
  - `docs/technical-implementation-plan.md`
  - `docs/open-questions-and-challenges.md`

### ADR-7. Templates Are Full Policy Objects
- Status: `Accepted`
- Date: `2026-07-07`
- Context: Critical workflows, channel behavior, and presentation rules must remain governed and auditable, not only content-driven.
- Decision: Treat templates as versioned policy objects that may lock workflow, channel, presentation, and targeting rules in addition to content defaults.
- Consequences:
  - The backend must enforce template locks, not only the frontend.
  - Communications must retain policy snapshots for auditability.
  - Template changes can materially affect delivery behavior and therefore require clear traceability.
- Related documents:
  - `docs/functional-specification.md`
  - `docs/technical-implementation-plan.md`
  - `docs/openapi.yaml`

### ADR-8. No Approval Workflow In MVP
- Status: `Accepted`
- Date: `2026-07-07`
- Context: The MVP needs operational speed and low process overhead, while still reducing accidental publication risk.
- Decision: Do not implement a formal approval workflow in MVP. Use strong preview and confirmation before publication instead.
- Consequences:
  - Publish preview becomes a critical control point and must not be treated as optional UI polish.
  - Audit logs should capture preview-to-publish behavior for important communications.
  - If approval is introduced later, related workflow and API documents must be updated explicitly.
- Related documents:
  - `docs/functional-specification.md`
  - `docs/product-principles.md`
  - `docs/openapi.yaml`

## Open Decision Follow-Up
- Convert new major implementation choices into additional ADR entries instead of burying them inside roadmap notes.
- If a baseline ADR changes, update this file first, then synchronize the dependent specifications.
