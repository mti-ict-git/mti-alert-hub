# Services theme adoption checklist

Phase: **4 — Hardening and Expansion**. Approved 2026-09-13.
Reference: authenticated Services review on 2026-09-13. Preserve MTI Connect identity, routes, permissions, status semantics, and the approved login slideshow.

## Work order

- [x] Record reference palette, typography, navigation, cards, tables, filters and forms.
- [x] S1 — Sidebar: pale surface, compact rows, outline icons, blue active state, sentence-case groups; verify expanded/collapsed, mobile drawer, keyboard and nested-route selection.
- [x] S2 — Header: compact page title/breadcrumb and account actions; preserve existing account behavior.
- [x] S3 — Summary cards and status tabs: consistent icon containers, counts, spacing and semantic colors.
- [x] S4 — Tables and filters: consistent toolbar, search, date/status filters, badges, pagination and readable density.
- [x] S5 — Forms and dialogs: consistent sections, labels, spacing, validation and action placement.
- [x] S6 — Cross-screen verification: Dashboard, Notifications, Employees, Devices, Wellness, Reports and Settings; responsive, dark theme, keyboard, loading/empty/error states.

## Canonical owners and scope

Colors: `src/styles.css` (runtime canonical, mirrored by `DESIGN.md`). Navigation and active-route matching: `AppSidebar`. Collapse, tooltip and mobile drawer: shared `ui/sidebar` and Radix Sheet. Header: `Topbar`. Reuse these owners rather than copying Services implementation or introducing a second UI framework.

S1–S6 are the authorized sequential scope of this adoption. Retain readable controls rather than copying the reference's 10px inputs and crowded filters. Remote Gate Pass, Site Entry and Pack Meals were not fully verified because of timeouts.

## Verification

S1 verified locally on 2026-09-13 using the real AppSidebar and shared SidebarProvider in a temporary isolated browser harness (removed afterward): desktop labels 13px, rows 36px, radius 4px; collapsed rail 48px; exactly one aria-current on /notifications/new; mobile 390px drawer closes after navigation and Escape. TanStack Link uses exact active matching to prevent its automatic parent aria-current competing with the longest-match menu selection.

Production build passed (`NITRO_PRESET=node-server npm run build`, /tmp/mti-sidebar-build.log). Targeted ESLint passed with the existing shared-sidebar fast-refresh export warning. Full frontend typecheck remains blocked by errors outside the sidebar (including src/data/devices.ts and src/data/employees.ts); see /tmp/mti-sidebar-typecheck.log. Strict design audit reports 31 existing findings (17 unresolved, 14 violations); see /tmp/mti-sidebar-audit.json. These broader checks are not claimed as passed. Authenticated integration across all screens and dark-theme visual review remain in S6. No remote business records were modified.

## S2–S6 implementation and behavior

- S2: 56px header, responsive breadcrumb, account pill, bounded account menu; existing sign-out callbacks preserved.
- S3: 8px card surfaces, compact tinted metric icons, underline tabs and view counts, soft semantic status pills. Emergency emphasis remains intact.
- S4: shared clearable SearchInput on Employees, Notifications, Wellness and Audit Logs; shared 13px tables; loaded-result pagination on Employees, Notifications, Wellness and both Device tabs. Existing fetch limits are unchanged and visible counts explicitly say loaded results. Filters and page size reset page 1. Notification checkbox selection and bulk actions apply only to the displayed page; partial selection is indeterminate. No mutation contracts changed.
- S5: shared card-backed input/select/textarea controls, focus rings, viewport-bounded dialogs with separated header/footer, named controls in Settings and Device forms. Existing validation and submit handlers remain. Login layout, artwork and slideshow are preserved; its input corner radius is explicit.
- S6: local verification uses actual route components and shared shell with synthetic read-only API fixtures on an isolated origin. API writes are blocked by the harness; no credentials, live records or real approval/submission are involved. This proves local UI behavior, not production API/deployment readiness.

### Verification evidence (2026-09-13)

Browser review covered Dashboard, Notifications, Employees, Devices, Wellness, Reports and Settings. All seven fit a 390px viewport without page-level horizontal overflow; data tables retain internal overflow. Header computed height is 56px. Desktop account menu opens and closes with Escape. Notification tabs respond to keyboard arrows. A 31-row employee fixture moves from 1–25 to 26–31, search resets the page, clearing search returns to page 1, and page-size selection works. Notification select-all checks 25 visible rows; the following six rows remain unselected. Empty, loading and error states were exercised on Employees/Notifications, including Retry. Device approval dialog was opened and dismissed without approval; mobile dialog fits 358 × 812px inside a 390 × 844px viewport and its dropdown works. All seven routes also rendered in dark mode without page-level horizontal overflow. The authored select popup and trigger both measured 112px after transition. Wellness and Reports error states rendered the simulated connection error.

Final checks: production build passed (`/tmp/mti-services-build.log`); targeted ESLint had no errors; DESIGN.md lint had no errors (five existing token-reference warnings). Full frontend typecheck remains blocked by pre-existing errors, including fixture/model drift and notification detail types (`/tmp/mti-services-typecheck.log`). Strict UI audit still reports 31 findings (18 unresolved, 13 violations; `/tmp/mti-services-audit.json`), so whole-project contract compliance is not claimed. Local UI acceptance for S2–S6 is complete; authenticated backend workflows, production deployment, and broader pre-existing type/audit cleanup remain separate work. The temporary harness is removed after verification.

## UI polish and consistency — P1–P4 (2026-09-13)

- [x] P1: Notification Center gains shared Comfortable/Compact density, Columns menu, sticky header/identity, filter chips/reset and readable title width.
- [x] P2: Adopt the shared workspace on Employees, both Device tabs, Wellness and both Reports tables. Add independent approved/pending Device searches. Keep loaded-result semantics and page-scoped notification selection.
- [x] P3: Harmonize page hierarchy, add semantic status icons, improve empty-search recovery, prioritize operational dashboard counts and visibly label illustrative panels.
- [x] P4: Complete local interaction, desktop/mobile and dark-mode checks; record whole-project check limitations below.

Verification used actual route components and the shared shell with synthetic read-only fixtures on a separate local origin; API mutations were disabled. The temporary harness was removed. No live business records were changed.

- Density changed measured notification row height from 82.5px to 62px before the final title-width refinement, persisted across route navigation and reload, and remained shared between tables.
- Columns hid both matching header/body cells; identity, status, priority and actions remained protected. Empty/loading/error colspan messages stayed visible while a column was hidden.
- Employee header stayed aligned with its scroll region after 751px vertical scrolling. Device Status and Hostname remained pinned after 40px horizontal scrolling, with a 112px leading-column offset.
- Notification selection did not leak to the following six-row page. Employee search removal retained the Site filter; Reset cleared remaining filters. Removing a parent Site chip also cleared its Area dependency. Search for literal “all” correctly retained a removable search chip.
- Approved Device search returned the matching record; pending search displayed a clear empty message, including with hidden columns. Native keyboard date change created a From chip in Reports; Reset cleared the date.
- Dashboard attention strip showed fixture overdue/failed totals and its navigation link; response/delivery/activity examples carried explicit illustrative labels.
- Dashboard, Notifications, Employees, Devices, Wellness and Reports fit a 390px viewport without page overflow; wide tables scrolled internally. All six rendered in dark mode without page overflow. Browser console reported no errors during the final visual review. Populated Wellness outcomes were not simulated in this slice; its existing reporting semantics are unchanged.

Final checks: production build and targeted ESLint passed (`/tmp/mti-polish-build.log`, `/tmp/mti-polish-lint.log`). DESIGN.md lint reports zero errors and five existing token-reference warnings (`/tmp/mti-polish-design-lint.log`). Full frontend typecheck still fails on the baseline issues; normalized diagnostic comparison found no new errors (`/tmp/mti-polish-types-final.log` versus `/tmp/mti-services-typecheck.log`). Strict static audit reports 33 findings (18 unresolved, 15 violations), compared with 31 previously. The two additional actionless-button detections are the Radix Columns trigger and the dashboard Button-asChild Link: browser checks verified the menu opens and the link points to Notification Center. These detector findings remain recorded rather than claiming a clean whole-project audit. Existing broader type/audit cleanup and authenticated production acceptance remain outside this polish slice.

### Sidebar artwork follow-up — 2026-09-13

- [x] Retrieve the original Services sidebar background and integrate it as a local decorative asset.
- [x] Verify loaded image on the running local Wellness page, desktop collapse (image display:none), and 390 × 844 mobile drawer (image width 287px, bottom aligned at 844px, pointer-events:none). Restore viewport and sidebar state after checking.
- [x] Targeted AppSidebar ESLint and production build passed (`/tmp/mti-sidebar-art-lint.log`, `/tmp/mti-sidebar-art-build.log`).

Source: Services `/assets/v2/img/branding/sidebar-background.png`, 212 × 223 transparent PNG, unchanged. AppSidebar scales it to the panel width. No remote business records or authentication configuration changed.

### Wellness density refinement — 2026-09-13

- [x] Reduce operator table to five columns and three summary cards; move secondary row actions into a menu and disclose additional filters on demand.
- [x] Preserve detailed information in the existing Wellness detail route; use the canonical recurrence formatter and unchanged completion semantics.
- [x] Verify on the running local Wellness page: six programs, initial rows 72.5px at 1357px viewport, no page overflow; Filters expands/collapses, actions menu exposes Edit/Duplicate/Deactivate, no-result search and Reset recover correctly. Mobile page stays 390px with a 760px internally scrolling table. No business mutation was executed.
- [x] Targeted lint and production build passed; whole-project typecheck remains on its pre-existing diagnostics. Logs: /tmp/mti-wellness-simple-lint.log, /tmp/mti-wellness-simple-build.log, /tmp/mti-wellness-simple-types.log.

This intentionally supersedes P2's Wellness column/density workspace: the simplified default contains all five essential columns and lets the page scroll naturally.

### Wellness detail simplification — 2026-09-13

- [x] Replace five dense metric cards with three numeric summaries; simplify header and separate status labels from actions.
- [x] Add concise Overview and move the complete former overview into Configuration; retain warnings on the default tab and preserve existing activity/recipient/log tabs.
- [x] Verify running local detail at 1357 × 983: concise overview displays in one viewport without horizontal overflow. Configuration still exposes Execution Contract. Both Overview and Configuration fit 390px without page overflow.
- [x] Verify More program actions opens the existing Deactivate confirmation; dismiss without executing mutation. Restore Overview and viewport after review.
- [x] Targeted lint and production build passed; normalized full-typecheck comparison found no new diagnostics. Evidence: /tmp/mti-wellness-detail-lint.log, /tmp/mti-wellness-detail-build.log, /tmp/mti-wellness-detail-types.log. Existing project-wide type errors remain.

### Create Wellness development-cache recovery — 2026-09-13

Browser reproduced `Failed to fetch dynamically imported module` for the Create Wellness route. Following its development import graph found a 404 for `/node_modules/.vite/deps/@radix-ui_react-scroll-area.js`. The isolated preview server had shared the default dependency-cache directory with the app. App Vite now uses `node_modules/.vite-mti-app`; `VITE_FORCE_OPTIMIZE=1` provides an explicit cache-regeneration option. A forced restart was needed to rotate stale import hashes after moving caches (otherwise cached React imports mixed old/new locations).

Verification: all 139 discovered absolute imports in the Create route graph returned successfully, including the missing scroll-area module under the new cache path/hash. Vite config lint and production build passed. The full local dev stack was restarted; the previous authentication session expired and browser reached the working login screen. Authenticated create-form interaction must be repeated after login; no program was created. Browser cache override used during diagnosis was restored.

### Hostname-first Devices and bulk approval — 2026-09-13

- [x] Move Hostname before Device ID in approved Devices and preserve the pinned readable identity. Add pinned selection + Hostname in pending requests.
- [x] Add page-scoped selection, exact count, common settings/hostname review, explicit site choice for bulk, progress, individual outcomes and failed-only retry via existing approval endpoint.
- [x] Unit tests: sequential operation, deduplication, target snapshot, progress, partial failure, retry exclusion and empty/unknown failures (3 tests).
- [x] Isolated browser fixtures: select-all picks 25; next page has zero selection; returning does not restore hidden selection. Two-request batch produced one success/one simulated conflict; retry approved only the failed request. Confirmation remained open with individual outcomes. Mobile dialog measured 358 × 734 inside 390 × 844, without page overflow.
- [x] Targeted lint and production build passed; full typecheck comparison shows no new diagnostics. Evidence: /tmp/mti-bulk-tests.log, /tmp/mti-bulk-lint.log, /tmp/mti-bulk-types.log, /tmp/mti-bulk-build.log.

All batch writes in browser verification were simulated on a separate local origin using an independent Vite cache. No real enrollment was approved/rejected. Temporary fixture files/server were removed. Backend/API contracts were reviewed and remain unchanged; bulk execution is a client orchestration of individually validated and audited approvals.

### Approved Device filters — 2026-09-13

- [x] Add status, site, dependent area, ownership and version filters with chips/reset and pagination reset.
- [x] Live local read-only verification: Online produced 13 matching loaded devices; combining version 1.0.9 produced zero results with active chips; Reset recovered all results. Filtering Offline from page 2 reset to 1–25 of 29. Mobile width remained 390px without page overflow. Restore filters and viewport afterward.
- [x] Targeted lint/build passed; no new full-typecheck diagnostics versus the existing baseline. Logs: /tmp/mti-device-filter-types.log and /tmp/mti-device-filter-build.log. No business data was modified.
