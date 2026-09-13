# MTI Alert web UI contract

Visual ownership: [DESIGN.md](DESIGN.md). This branch changes presentation in the existing React/TanStack application.

## Business sources

- Product and audience: `docs/project-plan.md`, `docs/product-principles.md`.
- Permissions, targeting, lifecycle and preview/confirmation: `docs/functional-specification.md`, `docs/security-and-access-model.md`, `docs/openapi.yaml`.
- Devices and rollout: `docs/windows-agent-rollout-stage-1-contract.md`.
- Existing detailed workflow documentation under `docs/` remains authoritative. This theme change introduces no backend lifecycle or permission decisions.

## Canonical UI map

| Capability           | Owner                                             | Contract                                                                                                                                              |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation           | AppSidebar / Topbar / TanStack Link               | Longest matching menu wins; mobile navigation closes after selecting a destination; breadcrumb returns to Control Room.                               |
| Cards and statistics | Card / StatCard / PageHeader                      | Semantic tokens, same metric labels and meanings across screens.                                                                                      |
| Tables               | components/ui/table.tsx                           | Semantic table; horizontal scroll belongs to the table, vertical scroll to the document.                                                              |
| Select/Listbox       | components/ui/select.tsx                          | Authored Radix popup for Devices; preserve keyboard and focus behavior. Legacy native selectors elsewhere are tracked as pre-existing audit findings. |
| Date                 | Existing route date/time inputs                   | Native browser popup remains the compatibility baseline; this theme does not customize calendar behavior or scheduling rules.                         |
| Form                 | Existing route validation plus shared Input/Label | Preserve values, validation and mutation destinations; no new forms introduced.                                                                       |
| Scrollbar            | src/styles.css                                    | Global visible standard and WebKit styles; forced-colors and reduced-motion support.                                                                  |
| Toast                | components/ui/sonner.tsx / app Toaster            | Existing top-right shared feedback.                                                                                                                   |
| CRUD                 | Existing routes and services                      | Preserve publish previews, confirmations, scopes and API mutations.                                                                                   |

## Changed-surface state rules

- Unknown metric values render as a dash while loading or unavailable, never as a fabricated zero. Failed dashboard/device queries expose Retry.
- Recent notifications and device tables distinguish loading, empty and failed states.
- Existing demonstration charts and activity remain explicitly labeled sample data. Wiring new analytics endpoints is separate work.
- The Devices service currently requests the first 200 records. This visual slice preserves that API behavior and labels counts as the current view. Full server pagination remains an existing limitation, not an implied complete device inventory.
- English application copy and existing date formatting remain. No locale change.
- No application authentication bypass, backend writes or real notification dispatch is used for visual QA; browser tests use isolated fixtures.

## Branch review

The warehouse theme is developed on `feat/warehouse-theme`. Merge or push to main requires the user's later acceptance. Verification evidence and outstanding baseline findings live in `docs/warehouse-theme-review.md`.

## Corporate login presentation

The Services-inspired sign-in page uses one corporate credential form connected to the existing auth service. No provider, permissions, session persistence or successful-login destination changes. Required fields focus the first missing value; failed sign-in retains inputs and shows a generic inline message; password visibility is explicit; duplicate requests are guarded. Site photographs are selected manually with pressed-state buttons and no autoplay.
