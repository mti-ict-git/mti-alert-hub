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
  surface: "1rem"
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

The user-approved warehouse reference supplies a pale 246px sidebar, solid-blue active navigation, white 72px sticky header, 16px cards and 24px padding. The six Control Room metrics use a responsive 1/2/3-column grid so labels stay readable. Inter remains the declared application font with system fallbacks; no external font request is required. The login viewport uses an original AI-generated oil-painted tropical industrial landscape, covered by a 42% dark overlay in the scoped `.login-backdrop` class. The landscape is decorative and not a factual depiction of an MTI site. Interior gallery photographs remain independent. The Services-inspired login uses a centered white split card (1120px maximum), site photography and manual thumbnails on the left, and the MTI corporate login form on the right. On mobile the photograph becomes a compact banner above the form. The login card has its own restrained `--login-shadow`; the dark login-panel token is only an image-loading fallback. Authentication remains corporate AD; no unsupported SSO providers or password-reset route are presented.

Pages use the existing application shell, a 1.5rem section rhythm, responsive one-to-three-column summaries, and horizontally scrollable semantic tables where comparison matters. Loading, empty, and error states retain stable table geometry. Forms keep natural document scrolling; table overflow remains owned by the table surface.

## Elevation & Depth

Hierarchy comes primarily from tonal surfaces and borders. Cards may use the shared subtle shadow, while dense nested reporting sections prefer borders without added elevation. Dialog and menu overlays use the established shared primitives.

## Shapes

The base control radius remains 0.5rem. Cards use the separate 1rem surface radius; status badges may use a pill shape to distinguish compact metadata from actions. Avoid introducing feature-specific radii.

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


MTI Connect uses two open linked forms as its application mark. Login pairs the horizontal wordmark with the tagline "Terhubung. Terinformasi. Terlindungi." Sidebar and favicon reuse the square mark. Corporate marks remain independent; emergency semantic colors keep their established meanings. This release updates web display branding; deployment identifiers and installed agent software remain stable.
