---
version: alpha
name: "MTI Connect"
description: "A calm, operational command surface for communication delivery and employee wellness programs."
colors:
  primary: "#2563eb"
  background: "#f6f8fb"
  foreground: "#182433"
  success: "oklch(0.62 0.16 155)"
  warning: "oklch(0.76 0.16 75)"
  destructive: "oklch(0.55 0.24 27)"
  border: "#e5e9ef"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  DEFAULT: "0.5rem"
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  surface: "0.5rem"
spacing:
  control: "0.5rem"
  card: "1.5rem"
  section: "1.5rem"
components:
  button: {}
  card: {}
  table: {}
  input: {}
  dialog: {}
---

# MTI Connect Design System

## Overview

### Creative North Star

The interface should feel like a well-run operations room: quiet surfaces, clear status signals, compact evidence, and no decorative noise competing with urgent information.

### Product context and register

- **Audience and primary job:** MTI administrators and operational staff author communications, monitor delivery, manage Windows Agents, and evaluate OHIH wellness participation.
- **Target market and evidence:** the repository documents an internal MTI deployment with a Windows desktop-first rollout; the interface remains English unless product documentation explicitly adds another locale.
- **Usage scene:** desktop admin use with dense tables, periodic monitoring, and occasional high-urgency actions.
- **Register:** product/admin. Task clarity and evidence density lead.
- **Memorable signature:** operational status color is used as a restrained signal across badges and reporting charts.
- **Restraint:** reports, forms, and device tables remain familiar and scan-friendly; they do not become marketing surfaces.
- **Anti-references:** avoid ornamental dashboards, oversized decorative metrics, glass effects, and color-only status communication.
- **Token ownership/runtime mapping:** the hand-maintained Tailwind v4 theme in `src/styles.css` is canonical. This document mirrors accepted runtime values and explains their intent.

## Colors

The cool blue primary identifies safe actions and active navigation. Green, amber, and red are semantic success, warning, and destructive roles. White cards sit on a lightly cool background with quiet borders. Dark mode remaps the same semantic roles in `src/styles.css`; component code consumes semantic tokens rather than raw colors wherever shared tokens exist.

## Typography

Inter is the application and data font, with system fallbacks for predictable Windows rendering. Semibold weights establish page and section hierarchy. Tables use compact text; identifiers and raw technical payloads may use the monospace stack. Labels use sentence case, while short data eyebrows may use restrained uppercase treatment.

## Layout

The user-approved warehouse reference supplies a pale 240px sidebar, solid-blue active navigation, white 56px sticky header, 8px cards and 24px padding. The six Control Room metrics use a responsive 1/2/3-column grid so labels stay readable. Inter remains the declared application font with system fallbacks; no external font request is required. The login viewport uses an AI-generated oil-painting adaptation of the user-provided IMIP Morowali photograph, rendered on a fixed decorative layer with a 6px Gaussian blur, 42% dark overlay and edge vignette in the scoped `.login-backdrop` class. The landscape preserves the reference composition but is an artistic interpretation, not documentary imagery. Its local asset is `public/images/login/imip-morowali-oil-painting.png`. Interior gallery imagery remains independent: user-selected Plant team, Operations and Industrial plant oil paintings replacing the removed nighttime mine photograph. The Services-inspired login uses a centered white split card (1120px maximum), a full-height oil-painted slideshow on the left, and the MTI corporate login form on the right. On mobile the slideshow becomes a compact banner above the form. It advances every 20 seconds, with wrapping previous/next arrows, white slide indicators and a pause/play control overlaid on the image. Manual changes restart the interval; images slide horizontally over 700ms, with transitions disabled for reduced-motion preferences. The login card has its own layered dramatic `--login-shadow` (broad depth shadow, tighter contact shadow and subtle white edge highlight); the dark login-panel token is only an image-loading fallback. Authentication remains corporate AD; no unsupported SSO providers or password-reset route are presented.

Pages use the existing application shell, a 1.5rem section rhythm, responsive one-to-three-column summaries, and horizontally scrollable semantic tables where comparison matters. Loading, empty, and error states retain stable table geometry. Forms keep natural document scrolling; table overflow remains owned by the table surface.

## Elevation & Depth

Hierarchy comes primarily from tonal surfaces and borders. Cards may use the shared subtle shadow, while dense nested reporting sections prefer borders without added elevation. Dialog and menu overlays use the established shared primitives.

## Shapes

The base control radius remains 0.5rem. Cards use the separate 0.5rem surface radius; status badges may use a pill shape to distinguish compact metadata from actions. Avoid introducing feature-specific radii.

## Components

### Warehouse theme token mapping

Runtime CSS remains canonical (Model B). `--primary`, `--background`, `--foreground`, and `--border` feed Tailwind semantic utilities. `--surface-radius` maps to `rounded-surface` on Card; `--surface-shadow` maps to `shadow-card`. Sidebar active buttons consume `--sidebar-primary` and its foreground; hover uses the separate accent pair. Login consumes `--login-panel`, `--login-foreground`, and `--login-border`. Dark mode retains semantic remapping. Emergency/warning/success values are preserved. This is an intentional visual evolution from the dark sidebar and 12px cards.

### Foundational visual states

Interactive components use the shared Tailwind/Radix primitives for hover, visible focus, active, disabled, and busy states. Errors remain inline and actionable. Loading and empty states reserve meaningful space and do not move surrounding controls.

### Buttons and actions

Use one primary action per decision area. Outline and ghost treatments carry navigation and utilities; destructive intent remains separated. Button labels name the real operation, and busy states preserve dimensions.

### Navigation and data display

Use existing application navigation, tabs, cards, status badges, Recharts conventions, and semantic tables. Every chart has a tabular or textual data alternative. Tables scroll horizontally on narrow screens rather than silently dropping outcome columns.

### Forms and overlays

Use shared inputs, Radix Select, dialogs, menus, and Sonner feedback. Validation and failure recovery stay inline when correction is required. Platform-owned date inputs are accepted for internal reporting filters.

### Iconography

Lucide is the canonical icon family. Icons use the existing small outline treatment and retain text labels for important actions.

### Motion

Motion communicates loading or state transition only. Respect `prefers-reduced-motion`; remove nonessential pulsing and spinning when reduced motion is requested.

### Content and data visualization

Copy is direct and operational. Wellness reporting distinguishes displayed, engaged, completed, deferred, dismissed, timed out, and ambiguous outcomes explicitly. Charts reuse semantic success/warning/destructive tokens and never replace the underlying table.

## Do's and Don'ts

- **Do:** keep evidence, outcome definitions, and recovery actions visible near the affected report.
- **Do:** reuse shared primitives and semantic tokens across list and detail reporting surfaces.
- **Don't:** hide ambiguous wellness outcomes inside confirmed completion.
- **Don't:** trade table readability or accessibility for decorative dashboard styling.

### Login brand assets

Corporate header order: Merdeka Tsingshan Indonesia, Merdeka Copper Gold, Merdeka Battery Materials. Preserve original corporate artwork and proportions. MTI uses the original vector paths from the official 2023 sustainability report. The separate MTI Connect application mark uses graphite #303D49 and copper #B24F26; these brand colors do not override semantic emergency status colors. Local SVG and transparent PNG sources are in public/images/brand/mti-connect-logo.

MTI Connect uses two people with hands meeting in a central clasp as its application mark. Upright bodies and descending arms suggest an M. The full MTI identity is spelled out in the wordmark. Login pairs the horizontal wordmark with the tagline "Terhubung. Terinformasi. Terlindungi." Sidebar and favicon reuse the square mark. Corporate marks remain independent; emergency semantic colors keep their established meanings. This release updates web display branding; deployment identifiers and installed agent software remain stable.

### Services sidebar adoption — 2026-09-13

The authenticated Services reference guides sidebar density: 240px desktop width, #f8fafc surface, #182433 text, #e2e8f0 border, 36px desktop menu rows (44px on mobile), 4px menu radius, 13px labels and 11px sentence-case group labels. Lucide icons retain a 1.5px outline. Runtime ownership stays in src/styles.css for colors, SidebarProvider for width and AppSidebar for navigation layout. Preserve MTI Connect branding, existing routes, longest-match active selection, collapsed tooltips and the mobile Sheet. This intentionally replaces the previous 246px sidebar and uppercase section labels; the remaining shell and content now follow the same Services adoption checklist.

### Services shared components — 2026-09-13

The header is 56px high with a compact account pill and a responsive breadcrumb. Cards consume `--surface-radius: 0.5rem`; StatCard uses a 48px tinted icon container and 24px metric text without a decorative watermark. Tabs use a wrapping underline layout, keyboard behavior stays owned by Radix. Tables use 13px body text, 12px headers, subtle header fill and internal horizontal scrolling. Shared inputs, selects and textareas use white/card surfaces and 4px corners; login explicitly retains its 6px input corners. Dialogs use a 50% backdrop, card surface, separated header/footer and bounded viewport scrolling. Success/info/warning status pills mix their existing semantic colors with foreground for readable labels; emergency remains high emphasis. Dark mode consumes the existing semantic overrides.

`SearchInput` owns clearable local search presentation. `useListPagination` and `ListPagination` own paging of the existing loaded result sets on Employees, Notifications, Wellness and Devices. Page sizes are 10/25/50/100, default 25; filters and size changes reset to page 1, shrinking results clamp the page. Counts explicitly say “loaded results,” because the server services retain their existing fetch limits. Notification selection and bulk-action scope follow the visible page, with exact counts and indeterminate selection. Filters/paging remain transient in this adoption slice to preserve the existing route contracts and avoid putting directory search text into URLs. Server-wide paging and shareable filter URLs require a separate API/route-contract migration, not a visual-theme change.

Implementation and verification ledger: `docs/services-theme-checklist.md`. Existing settings persistence and sample dashboard metrics are not upgraded by the visual adoption.

### UI polish and operational tables — 2026-09-13

Opt-in table workspaces on Notifications, Employees, Devices, Wellness and Reports share Comfortable (14px body / 16px vertical cell padding) and Compact (13px / 8px) density. The browser remembers density across these screens; column visibility is local to the mounted table. Identity, selection, status, priority and action columns remain visible. Column controls include Show all columns. Scroll regions are keyboard focusable, cap at 65vh/44rem, and keep headers visible. Desktop identity columns remain pinned; small screens scroll all columns together. Notification/program titles retain a 240px minimum width. Existing tables outside this opt-in keep their presentation.

FilterChips owns active-filter summaries, single removal, reset and matching loaded-result counts. Search text equal to “all” is still an active search. Devices now expose separate local searches for approved and pending lists. Status pills pair semantic color with a decorative icon and explicit text. Page titles share responsive 20/24px hierarchy. Dashboard places overdue/failed attention and pending work first; sample response, delivery and activity panels are explicitly marked illustrative. No source-of-truth or metric semantics change.

### Services sidebar artwork — 2026-09-13

Use the original transparent Services `sidebar-background.png`, stored at `public/images/sidebar/services-sidebar-background.png`, as bottom-aligned decoration. AppSidebar owns an isolated positioning wrapper so the artwork stays behind navigation without intercepting pointer events. Match sidebar width, preserve image proportions, and hide it in the collapsed icon rail. Mobile drawer uses the same asset. Do not fetch Services at runtime. Source provenance is in the asset directory README.

### Wellness operator list simplification — 2026-09-13

Wellness now deliberately uses a five-column operator table: Program, Schedule, Status, Completion, Actions. It is an exception to the optional dense table workspace: no Columns/density toolbar or nested vertical scroll. Retain horizontal scrolling on narrow screens (760px table minimum). Program type/theme occupy one muted subtitle; technical layout, target IDs, policy signals and monitoring breakdown stay on the existing detail page. Reuse wellness-authoring recurrence formatting. Three top metrics replace the previous five cards. Filters are disclosed on demand, with active chips always available. View stays visible; secondary actions live in a dropdown and Deactivate requires confirmation. This supersedes the earlier Wellness table-workspace adoption.

### Wellness detail hierarchy — 2026-09-13

Wellness detail opens with a short program-type/theme subtitle, separate status labels and three numeric metrics (Audience, Policies, Outcome). Long technical enum values are not headline metrics. Overview shows Program content and Schedule & audience; Configuration retains the complete former snapshot, copy, execution contract and audience preview. Audience warnings remain visible on Overview. Activity, recipients and delivery logs stay in their existing tabs. Back navigation is a text link; Deactivate is in More program actions and retains its confirmation dialog. Outcome calculations and fallback behavior are unchanged.

### Device identity and batch approval — 2026-09-13

Hostname is the primary device identity, before Device ID in the approved table. Preserve its pinned position; technical ID uses muted monospace text and may be hidden with Columns. Pending approval uses pinned selection + Hostname, followed by Status and identifier. Selection is limited to the displayed page and resets when search, page, page size or visible request IDs change.

Approve selected opens a hostname/identifier review with one shared Site, Area, Location Label and Ownership setting. Bulk approval requires an explicit Site choice. Confirmation freezes a target/settings snapshot, disables controls/closing during submission, and reports results per hostname. Successful rows are excluded from retry. Partial completion is explicit, not represented as an all-or-nothing transaction.

Approved Devices filter toolbar uses the shared Select and SearchInput controls in a responsive 1/2/3-column grid, plus FilterChips. Status, Site, Area, Ownership and Agent version combine with search; dependent Area resets on Site changes. Counts distinguish loaded totals from matching results.

### Bulk device rollout — 2026-09-13

Approved-device selection uses the existing Checkbox/Table and page-scoped selection pattern. Selection and Hostname are pinned, followed by Status. Rollout selected reuses the individual rollout dialog with a frozen hostname list and shared package settings. Preview must succeed for all targets and match the current settings before Apply is enabled. During processing, editing and closing are disabled. Per-device results distinguish request creation from completed installation. No automatic retry occurs for ambiguous responses.

Login slideshow arrows fade in on photo-panel hover or keyboard focus for fine-pointer devices. Touch devices retain visible arrows; reduced motion disables the fade. Dots, pause control and slideshow timing remain unchanged.

Approved Devices uses search plus a Filters disclosure (active count) instead of an always-open filter grid. Active filter chips remain visible while collapsed. Shared TableWorkspace accepts optional summary/actions slots; Devices puts selection summary and rollout beside density/column controls. Remove the redundant approved-card heading. Toolbar actions wrap on narrow screens.

### Organization master ownership — 13 September 2026

Organization precedes Employees and Devices in Management. Reuse PageHeader, Tabs, SearchInput, Select, Table, ListPagination and Dialog. Sites & Areas and Departments & Sections separate location from structure; child navigation preserves parent context. Tables show usage, source and status; forms preserve unsaved edits on cancellation. Source-owned entries are read-only. No deletion or reassignment flow in this slice.

### Device placement follow-up

Use the existing Sheet for single/bulk placement review and Dialog for discard confirmation. Reuse Select, Label, Input and Button. Change placement sits beside rollout/density actions; Edit placement is available per row. Defaults preserve existing values and review makes clearing Area explicit. Section is hidden in Organization; Department is the read-only AD login snapshot in device placement. This supersedes the earlier Departments & Sections menu direction.

### Direction update — Sites & Areas in Settings

The user requested removal of the remaining Departments menu and relocation of master locations to Settings. The canonical UI is now Settings → Sites & Areas, with Sites and Areas subtabs only. Organization no longer appears in Management. The old /organization URL redirects to /settings?tab=locations. Department/Section storage and backend contracts are retained for compatibility; they have no management tab here. Sites/Areas use their own Save changes action in the entry editor, not the general Settings save button. This supersedes the earlier standalone Organization menu direction.


Sidebar decorative artwork now uses the user-supplied merdeka-battery-sidebar.png, with 6.5% opacity, multiply blending and a downward fade owned by AppSidebar. Preserve source proportions and collapsed-rail hiding.
