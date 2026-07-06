# MTI Alert Template Policy Schema

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`

## Purpose
This supporting document defines the practical shape of a communication template policy for `MTI Alert`. It complements:
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`

This document exists to reduce ambiguity for backend implementation, admin UI implementation, and AI-assisted code generation.

## Design Intent
In MVP, a template is not only a content preset. It is a `full policy object` that controls:
- content defaults
- workflow policy
- channel policy
- presentation policy
- targeting constraints
- operator override boundaries

## Template Structure
### Identity
- `templateId`
- `templateKey`
- `version`
- `name`
- `status`

### Classification
- `communicationType`
- `defaultPriority`
- `category`

### Content Defaults
- `defaultTitle`
- `defaultBody`
- `defaultPayload`

### Workflow Policy
- `requiresResponse`
- `workflowId`
- `responseImpliesAck`
- `escalationMode`
- `escalationTimeoutMinutes`

### Channel Policy
- `mandatoryChannels`
- `optionalChannels`
- `defaultDeliveryStrategy`
- `dualPathRule`

### Presentation Policy
- `windowsAgentPresentation`
- `criticalBehaviorMode`
- `realertPolicy`

### Targeting Policy
- `allowedTargetTypes`
- `desktopTargetMode`
- `scopeConstraintMode`

### Override Policy
- `lockedFields`
- `editableFields`

## Canonical Schema
```json
{
  "templateId": "tpl_critical_gas_leak_v3",
  "templateKey": "critical_gas_leak",
  "version": 3,
  "name": "Critical Gas Leak Alert",
  "status": "Active",
  "communicationType": "Alert",
  "defaultPriority": "Critical",
  "category": "OHSE",
  "defaultTitle": "Gas Leak Warning",
  "defaultBody": "Potential gas leak detected. Follow safety instructions immediately.",
  "defaultPayload": null,
  "workflowPolicy": {
    "requiresResponse": true,
    "workflowId": "wf_critical_safety_response",
    "responseImpliesAck": true,
    "escalationMode": "RecipientOnly",
    "escalationTimeoutMinutes": 2
  },
  "channelPolicy": {
    "mandatoryChannels": ["WindowsAgent"],
    "optionalChannels": ["WhatsApp"],
    "defaultDeliveryStrategy": "TemplatePolicy",
    "dualPathRule": {
      "enabled": true,
      "mode": "DesktopFirstShortDelayWhatsApp",
      "delaySeconds": 30
    }
  },
  "presentationPolicy": {
    "windowsAgentPresentation": "Modal",
    "criticalBehaviorMode": "ModalThenStronger",
    "realertPolicy": {
      "enabled": true,
      "maxRealerts": 2,
      "intervalSeconds": 60
    }
  },
  "targetingPolicy": {
    "allowedTargetTypes": ["Site", "Area", "Device"],
    "desktopTargetMode": "DeviceByLocation",
    "scopeConstraintMode": "SiteAndArea"
  },
  "overridePolicy": {
    "lockedFields": [
      "workflowId",
      "mandatoryChannels",
      "optionalChannels",
      "defaultDeliveryStrategy",
      "dualPathRule",
      "windowsAgentPresentation",
      "criticalBehaviorMode"
    ],
    "editableFields": [
      "title",
      "body",
      "targets",
      "schedule"
    ]
  }
}
```

## Policy Semantics
### Workflow Policy
- `requiresResponse`: whether the communication must collect a workflow response
- `workflowId`: reference to the response workflow definition
- `responseImpliesAck`: if `true`, a submitted response also satisfies acknowledgment
- `escalationMode`: for MVP, expected to be `RecipientOnly`
- `escalationTimeoutMinutes`: threshold before recipient-only follow-up behavior may trigger

### Channel Policy
- `mandatoryChannels`: channels that cannot be removed by the operator
- `optionalChannels`: channels allowed by the template but not required on every send
- `defaultDeliveryStrategy`: baseline routing strategy, such as `TemplatePolicy` or `UserPreference`
- `dualPathRule`: special logic used primarily by critical templates

### Presentation Policy
- `windowsAgentPresentation`: baseline agent rendering mode such as `Toast`, `Modal`, or `Fullscreen`
- `criticalBehaviorMode`: higher-level policy controlling behavior escalation
- `realertPolicy`: recipient-only follow-up behavior on the same device

### Targeting Policy
- `allowedTargetTypes`: allowable target inputs for communications created from this template
- `desktopTargetMode`: for MVP, often `DeviceByLocation`
- `scopeConstraintMode`: how authorization scope should constrain targeting resolution

### Override Policy
- `lockedFields`: fields the operator cannot change
- `editableFields`: fields the operator may change in MVP

Backend enforcement is mandatory. The API must reject attempts to override locked fields even if a client UI fails to prevent the edit.

## Recommended Critical Template Pack
All critical templates should start from the following defaults unless a documented exception exists:
- `defaultPriority = Critical`
- `requiresResponse = true`
- `responseImpliesAck = true`
- `windowsAgentPresentation = Modal`
- `criticalBehaviorMode = ModalThenStronger`
- `mandatoryChannels = [WindowsAgent]`
- `optionalChannels = [WhatsApp]`
- `dualPathRule.enabled = true`
- `dualPathRule.mode = DesktopFirstShortDelayWhatsApp`
- `escalationMode = RecipientOnly`
- bounded retry policy enforced during execution

## Operator Override Model
### Editable In MVP
- `title`
- `body`
- `targets`
- `schedule`

### Locked In MVP
- `workflow`
- `mandatory channel rules`
- `optional channel rules`
- `delivery strategy policy`
- `dual-path behavior`
- `Windows Agent presentation policy`
- `critical behavior policy`

### Enforcement
- UI should disable or hide locked controls.
- API must reject incompatible changes with explicit validation messages.
- Publish preview must reflect final effective policy after all allowed overrides are applied.

## Versioning Rules
- A template version is immutable once activated and used for published communications.
- Editing a policy-relevant field creates a new version.
- Communications must store a `templateVersion` snapshot.
- Delivery execution may also store a materialized policy snapshot when execution behavior depends on that policy.

## Example Validation Rules
- A communication created from a template with locked `mandatoryChannels` must include all required channels.
- A communication created from a template with locked `windowsAgentPresentation = Modal` cannot downgrade to `Toast`.
- A template allowing only `Site`, `Area`, and `Device` targets cannot be used with a pure employee-only desktop targeting mode.
- A template with `requiresResponse = true` cannot publish without a valid `workflowId`.

## Mapping To OpenAPI
The following OpenAPI schemas should remain aligned with this document:
- `CommunicationTemplate`
- `CreateCommunicationRequest`
- `UpdateCommunicationRequest`
- `CommunicationDetail`
- `WorkflowDefinition`
- `ChannelPlanItem`

## Notes
- This document is a supporting schema reference and does not replace `docs/openapi.yaml`.
- Any policy behavior change must update both this document and `docs/openapi.yaml`.
