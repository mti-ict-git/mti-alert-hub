---
version: alpha
name: "MTI Alert Hub"
description: "A calm, operational command surface for communication delivery and employee wellness programs."
colors:
  primary: "oklch(0.42 0.15 255)"
  background: "oklch(0.985 0.005 240)"
  foreground: "oklch(0.18 0.03 250)"
  success: "oklch(0.62 0.16 155)"
  warning: "oklch(0.76 0.16 75)"
  destructive: "oklch(0.55 0.24 27)"
  border: "oklch(0.9 0.01 250)"
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

# MTI Alert Hub Design System

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

Pages use the existing application shell, a 1.5rem section rhythm, responsive one-to-three-column summaries, and horizontally scrollable semantic tables where comparison matters. Loading, empty, and error states retain stable table geometry. Forms keep natural document scrolling; table overflow remains owned by the table surface.

## Elevation & Depth

Hierarchy comes primarily from tonal surfaces and borders. Cards may use the shared subtle shadow, while dense nested reporting sections prefer borders without added elevation. Dialog and menu overlays use the established shared primitives.

## Shapes

The base radius is 0.5rem. Controls and cards use the shared rounded scale; status badges may use a pill shape to distinguish compact metadata from actions. Avoid introducing feature-specific radii.

## Components

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
