# MTI Alert Project Plan

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`
- Owner: `Product / Architecture`

## Project Summary
`MTI Alert` is a centralized real-time communication platform for delivering important information, operational warnings, and emergency notifications to company employees through multiple channels. In the initial phase, the system acts as the central server responsible for content creation, audience targeting, delivery orchestration, delivery monitoring, and acknowledgment collection.

The initial delivery focus is:
- `Windows Agent` on employee laptops and office workstations as the primary receiver channel.
- `WhatsApp` for field personnel or users without desktop agent access.
- Future expansion to `Email` and `Digital Signage`.

## Vision
Become the company-wide communication coordination hub that supports worker safety, operational continuity, and fast incident response through measurable and auditable communication workflows.

## Business Goals
- Ensure important messages reach the right people based on site, department, section, role, or individual recipient.
- Support routine, operational, and emergency communication within one consistent platform.
- Provide real-time visibility into delivery, read, and response status for management.
- Support measurable incident-response workflows through configurable acknowledgments and actions.
- Establish a reusable multi-channel communication engine without rebuilding the platform for each channel.

## Primary Users
- `Central Admin`: manages global settings, access, channels, templates, and organization-wide monitoring.
- `Local Operator`: sends communications within the site or department scope granted by permissions.
- `Management Viewer`: monitors dashboards, delivery status, and reports.
- `End Recipient`: receives messages through Windows Agent or WhatsApp and may be required to respond.

## Core Product Scope
The initial product is positioned as a `server-side platform` with the following core capabilities:
- A unified content engine for notifications, reminders, warnings, internal news, articles, knowledge items, and bulletins.
- Audience targeting based on organizational structure and operational context.
- Multi-channel delivery orchestration for Windows Agent and WhatsApp.
- Real-time monitoring for send, delivery, read, acknowledgment, and escalation state across all tracked content types.
- Configurable response workflows controlled by templates and policies.
- Audit trail, reporting, and access administration.

## Representative Use Cases
- A recurring OHIH reminder every two hours asking employees to take a short break.
- An emergency gas leak warning that requires urgent distribution and structured response.
- Daily operational announcements or latest company updates.
- Internal news, short articles, knowledge base updates, or field findings.

## MVP Scope
### Included
- `Windows Agent` channel
- `WhatsApp` channel
- Unified content engine
- Full delivery and read tracking for all MVP content types
- Audience segmentation
- One-time and recurring scheduling
- Template-driven response workflow
- SignalR-style push-first agent delivery model
- User-preference-based channel strategy
- Hybrid RBAC between central admins and local operators
- Hybrid organization data source strategy
- Monitoring dashboard, baseline reporting, and audit log

### Excluded From MVP
- Production-ready email delivery
- Production-ready digital signage delivery
- Production-ready Active Directory integration
- Production-ready SSO
- Public external mobile app
- AI-generated content

## Success Criteria
- Admin users can create and schedule content for the correct audience.
- A single content source can deliver to both Windows Agent and WhatsApp.
- The system exposes at least these statuses: `Queued`, `Sent`, `Delivered`, `Read`, `Responded`, `Failed`.
- Critical messages support configurable response workflows and immediate modal presentation on Windows Agent.
- Local operators can only send within their authorized scope.
- Management can identify who has not received, not read, or still requires assistance.
- Communication templates can control response behavior while employee channel preference influences default delivery strategy.

## Delivery Strategy
### Phase 0
- Establish documentation as the source of truth.
- Define the domain model, API contract, workflows, and implementation roadmap.

### Phase 1
- Build the core backend for authentication, content, audience targeting, campaign orchestration, and delivery tracking.

### Phase 2
- Integrate the backend with Windows Agent and WhatsApp connectors.

### Phase 3
- Add reporting, escalation, and operational hardening.

## Key Constraints
- The system must be understandable and reproducible by AI coding agents from these documents.
- The backend must act as the real central server, not merely a mock service layer.
- API contracts and workflows must be explicit so the C# receiver application and admin frontend can be developed in parallel.
- Every backend change must be reflected in `docs/openapi.yaml`.

## Dependencies
- A dedicated C# Windows Agent specification as the desktop receiver.
- WhatsApp gateway or provider integration.
- A clear organizational hierarchy: site, department, section, role, employee.
- A defined enterprise authentication approach for the implementation phase.
- A synchronization strategy for externally sourced organization data plus limited MTI-side overrides.

## Risks
- The unified content engine may expand uncontrollably if content types are not tightly bounded.
- Per-message custom workflows can increase UI, backend, and analytics complexity.
- Real-time cross-channel orchestration may create status inconsistency and reconciliation challenges.
- Push-first Windows Agent delivery introduces connection management and presence complexity.
- Without strict contracts, AI-assisted implementation for the backend and receiver may drift from business intent.
