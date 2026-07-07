# MTI Alert Phase 1 Baseline Mapping Guide

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`
- Audience: `Backend Engineers`, `Integration Engineers`, `Operations`

## Purpose
This guide explains how to map real HR and device inventory exports into the Phase 1 baseline import contract.

Use this guide together with:
- `docs/integration-contracts.md`
- `backend/examples/phase1-baseline.template.json`
- `backend/examples/phase1-baseline.schema.json`

## Recommended Source Split
Use two conceptual source feeds:
- HR or org export for `sites`, `areas`, `departments`, `sections`, `employees`
- Device inventory export for `devices`

If your raw source is a single spreadsheet, split it logically into those sections before generating the final baseline JSON.

## Target Output
The final import file must match:
- `backend/examples/phase1-baseline.schema.json`

The easiest starting point is:
- `backend/examples/phase1-baseline.template.json`

## Mapping Rules
### sites
Map one row per operational site.

Suggested source columns:
- `site_code` -> `code`
- `site_name` -> `name`
- `status` -> `status`
- source record id -> `externalReference`
- source system name -> `sourceSystem`

### areas
Map one row per operational area used for targeting.

Suggested source columns:
- `site_code` -> `siteCode`
- `area_code` -> `code`
- `area_name` -> `name`
- `status` -> `status`

If your source has no separate area master yet:
- use a temporary area strategy only if the business accepts it
- do not invent multiple fake areas without operational meaning

### departments
Suggested source columns:
- `site_code` -> `siteCode`
- `department_code` -> `code`
- `department_name` -> `name`

If departments are global in the source export:
- duplicate them per site in the baseline import only when the database model requires site linkage

### sections
Suggested source columns:
- `site_code` -> `siteCode`
- `department_name` -> `departmentName`
- `section_code` -> `code`
- `section_name` -> `name`

### employees
Suggested source columns:
- `employee_number` -> `employeeNumber`
- `full_name` -> `fullName`
- `email` -> `email`
- `mobile_phone` -> `phoneNumber`
- `site_code` -> `siteCode`
- `area_name` -> `areaName`
- `department_name` -> `departmentName`
- `section_name` -> `sectionName`
- `job_title` -> `jobRole`
- `employment_status` -> `employmentStatus`

Derived fields:
- `hasWindowsAgent`
  - `true` if the employee is assigned a managed Windows device or explicitly marked as desktop-capable
  - otherwise `false`
- `hasWhatsApp`
  - `true` if a valid mobile number is available for WhatsApp delivery
  - otherwise `false`
- `preferredPrimaryChannel`
  - use `WindowsAgent` for desktop-first users
  - use `WhatsApp` for field users or users without managed PC
- `preferredSecondaryChannel`
  - commonly `WhatsApp` or `Email`

### devices
Suggested source columns:
- `hostname` -> `hostname`
- `asset_tag` or managed endpoint id -> `deviceIdentifier`
- `employee_number` -> `primaryEmployeeNumber`
- `site_code` -> `siteCode`
- `area_name` -> `areaName`
- `location_label` -> `locationLabel`
- `ownership_mode` -> `ownershipMode`
- `agent_version` -> `agentVersion`
- `os_version` -> `osVersion`
- health status -> `status`

## Value Guidance
### employmentStatus
Recommended baseline values:
- `Active`
- `Inactive`

### ownershipMode
Allowed values:
- `LocationOwned`
- `EmployeeAssigned`
- `Mixed`

### device status
Allowed values:
- `Online`
- `Offline`
- `Stale`

## Minimal Good Baseline
For a meaningful first audience preview, ensure at least:
- every employee has `employeeNumber`, `fullName`, `siteCode`, `departmentName`
- employees targeted for WhatsApp have `phoneNumber` and `hasWhatsApp = true`
- employees targeted for Windows Agent have `hasWindowsAgent = true`
- every managed device has `hostname` and `siteCode`
- where possible, managed devices also include `primaryEmployeeNumber`

## Fallback Strategy
If source data is incomplete:
- import `sites`, `departments`, `sections`, and `employees` first
- import `devices` later when inventory is clean enough
- avoid guessing `primaryEmployeeNumber` if you cannot trust the relationship

## Mock Bootstrap Option
If you need a non-production bootstrap file from the current frontend seed data, generate it with:

- `npm run backend:generate:baseline-from-mock:dev`

Optional output path:

- `npm run backend:generate:baseline-from-mock:dev -- "<path-to-output-json>"`

This generator is useful for:
- local UI verification
- audience preview demos
- backend smoke tests

This generator is not a substitute for real HR or inventory exports.

Important limitation:
- the current mock generator expands departments and sections across all mock sites so the output is valid for backend import, but it is not a business-authoritative organization structure

## Recommended Import Workflow
1. Fill `backend/examples/phase1-baseline.template.json` with real exported data
2. Validate it against `backend/examples/phase1-baseline.schema.json`
3. Run rollback import first
4. Review counts and failures
5. Run real import
6. Challenge audience preview with representative site, area, employee, and device targets

## Known Caveats
- The current backend model links `departments` to `sites`, so globally shared departments may need per-site expansion in the baseline file.
- `Group` targeting is still out of scope for the baseline contract.
- `deviceRecipients` preview semantics may still need refinement after real data is loaded.
