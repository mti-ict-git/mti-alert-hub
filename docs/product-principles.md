# MTI Alert Product Principles

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`

## Purpose
This document defines the product principles that guide design, implementation, and operational decisions for `MTI Alert`.

## Principles
### 1. Critical Communication First
The platform must prioritize the reliable delivery of urgent and operationally important communications over non-critical convenience features.

Implications:
- Emergency and high-priority workflows take precedence in design and performance decisions.
- Delivery visibility matters as much as send capability.
- The system must clearly distinguish critical messages from informational content.

### 2. One Communication Core, Many Content Types
The platform should use one unified communication engine for reminders, alerts, operational notices, news, articles, and knowledge updates, while preserving type-specific behavior through metadata and workflow rules.

Implications:
- Avoid building separate engines for each content category.
- Use content type, priority, and workflow configuration to shape behavior.
- Keep the shared model strong enough to support future channels.

### 3. Targeting Must Be Explicit
Every communication must be sent to a deliberately defined audience, not broadcast by assumption.

Implications:
- Audience selection must support site, department, section, role, group, and individual targeting.
- Audience preview should exist before publishing or sending.
- Permission rules must restrict who can target which audience.

### 4. Response Is Part Of The Message
For important messages, receiving the message is not enough. The platform must treat acknowledgment and response as a first-class part of the workflow.

Implications:
- Support configurable response workflows, not only simple read receipt.
- Track who responded, how they responded, and when they responded.
- Escalation logic should be possible when expected responses are missing.

### 5. Channel-Aware, Content-Centered
Content should be authored once and adapted per channel without fragmenting business intent.

Implications:
- Windows Agent and WhatsApp use one message source with channel-specific rendering.
- Channel delivery status must roll up into a single communication-level view.
- Future channels such as email and digital signage should fit the same orchestration model.

### 6. Operational Clarity Over Feature Density
The system should favor clarity, traceability, and low ambiguity over over-engineered feature breadth.

Implications:
- Keep the MVP focused on core communication workflows.
- Avoid speculative modules with unclear operational value.
- Design screens and APIs so another implementation team or AI agent can follow them with minimal interpretation.

### 7. Auditability By Default
Administrative actions, content changes, delivery outcomes, and recipient responses must be traceable.

Implications:
- Store audit logs for content lifecycle and administrative actions.
- Keep immutable event records for major state changes.
- Ensure reporting can be explained from stored source events.

### 8. Role Scope Must Be Enforceable
The platform must support both central governance and local operational autonomy through hybrid RBAC.

Implications:
- Central admins can operate globally.
- Local operators are limited to explicit organizational scopes.
- Views, actions, and reports must respect authorization scope.

### 9. Build For Real-Time Awareness
The product should support timely situational awareness, not only after-the-fact reporting.

Implications:
- Dashboards should show live or near-real-time delivery and response state.
- The backend design should allow event streaming or polling without redesigning the domain model.
- Device heartbeat and channel health should be visible operational signals.

### 10. Documentation Must Be Executable
The specification must be detailed enough that a human team or AI coding agent can implement the system with minimal guesswork.

Implications:
- Workflows, statuses, permissions, and API contracts must be explicit.
- Open questions must be recorded rather than silently assumed.
- Backend behavior changes must stay synchronized with the OpenAPI contract.
