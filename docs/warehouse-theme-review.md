# Warehouse theme branch review

Date: 2026-09-12. Phase: 4 — Hardening and Expansion.
Branch: `feat/warehouse-theme`. Base: `cc7bc61eef7bf3b319abeba00e4fefcdd1f63d59` (main and origin/main at branch creation).

## Scope and implementation

The user approved implementing the previously reviewed warehouse theme on a separate branch, with main promotion deferred until visual acceptance.

- Shared palette: pale sidebar, blue active navigation, cool page background, white 72px topbar, 16px surface radius and restrained shadow. Control radius stays 8px.
- Shared Card, StatCard, PageHeader and Table carry the visual system to sibling screens. The explicit review slice is Control Room and Devices; login receives separate dark panel tokens.
- Longest matching sidebar destination prevents two active menus on Create Notification. Mobile navigation closes the drawer. The former inert header search is replaced by breadcrumbs, and the bell now links to Notification Center.
- Control Room retains all six metric meanings. Sample acknowledgment/channel/activity data is labeled. Unknown initial totals display a dash and failures offer Retry. Charts render without animation to keep values and reduced-motion behavior stable.
- Devices preserves service calls and approval/rollout workflows. Summary counts explicitly describe the current view. Loading, empty and failed table states are visible, with Retry. Wide columns scroll inside the table while forms retain document/modal scrolling.
- No backend, API contract, auth/session rules, Windows Agent payloads, production data or published history changed.

## Verification

| Check                                                    | Result                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build (`npm run build`)                       | Passed, including the final table/chart refinements.                                                                                                                    |
| Targeted ESLint on changed TS/TSX                        | 0 errors; 1 existing Fast Refresh warning in shared sidebar.                                                                                                            |
| Reporting regression (`npm run test:wellness-reporting`) | 12 passed, 0 failed.                                                                                                                                                    |
| TypeScript (`tsc --noEmit`)                              | Repository baseline fails. Compiler comparison against HEAD source: 71 diagnostics before and after, no newly introduced diagnostics.                                   |
| DESIGN.md lint                                           | 0 errors, 5 orphan-token warnings from the document's empty component maps. Runtime ownership is mapped in DESIGN.md.                                                   |
| Browser regression                                       | 9 checks passed in isolated headless Chrome; 0 uncaught exceptions and 0 mutation requests.                                                                             |
| Repository-wide ESLint                                   | Fails with 20,594 errors / 17 warnings, largely formatting and existing temporary artifacts included by the broad configuration. No full-repository auto-fix performed. |
| Strict premium UI audit                                  | 33 findings before, 31 after. Remains failing; see scope notes below.                                                                                                   |

Browser coverage: desktop (1440px), mobile (390px), single active navigation, Create Notification navigation, internal table overflow, pending tab, rollout dialog and authored select open/keyboard/Escape behavior, mobile drawer close, dashboard loading/error/retry/empty states, Devices error/retry/empty states, keyboard account menu, login appearance, and dark/reduced-motion visual inspection. Screenshots were inspected and used to correct mobile column wrapping and chart animation.

Browser responses were synthetic fixtures in a fresh browser context. This verifies frontend rendering and interaction; it is not a live LDAP, backend integration, notification dispatch or device-rollout acceptance test.

## Reproduce browser review

Start the frontend against a deliberately isolated API address, then run `scripts/verify-warehouse-theme.cjs`. The harness intercepts API requests in its own browser context and aborts unrelated external resources. It never adds an authentication bypass to application code.

```powershell
$env:VITE_API_URL = 'http://127.0.0.1:4199/api'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4198
# In another terminal, with Playwright available:
node scripts/verify-warehouse-theme.cjs
```

If Playwright is supplied by a shared runtime, set `PLAYWRIGHT_MODULE` to its module directory. No Playwright dependency or lockfile change was required for this review. Optional `THEME_QA_URL` and `THEME_QA_OUTPUT` override the preview address and artifact directory.

Local evidence under ignored `.tmp/warehouse-theme/`: `browser-results.json`, `typecheck-comparison.json`, `premium-audit.json`, `build.txt`, `full-lint.txt`, and screenshots for desktop/mobile Control Room and Devices, rollout select, dark dashboard and login. These files can be regenerated; synthetic fixture data is not operational data.

## Baseline findings and acceptance boundary

The strict auditor still flags existing native date/select ownership and textarea rules outside the visual slice, plus apparent actionless buttons. In the changed shell/dashboard, flagged Button-asChild links and the Radix account trigger have real navigation/menu behavior; the browser test covers navigation and keyboard account opening. Their presence is not evidence of an inert control. This report does not claim a clean whole-product accessibility or UI-contract audit. When the development server stopped, its log also showed hydration warnings for injected `data-tsd-source` attributes in the unchanged `__root.tsx` shell. The warnings concern development source-tag metadata; no uncaught browser exception occurred. Production build passed, but production-runtime hydration was not separately exercised.

The Devices service still requests at most the first 200 approved/pending records; full server pagination is pre-existing follow-up work. Existing sample dashboard analytics remain labeled pending real endpoint integration. Comprehensive form/permission/backend acceptance remains with the existing project workflows.

## Review and rollback

Implementation is saved on the feature branch. Main and origin/main must remain at the base until the user approves the appearance. To return the checkout to the previous theme after committing any further work, use `git switch main`; the feature commit remains available. After acceptance, merge the reviewed feature branch through the team's normal workflow and push main. If later reverting a published merge, use a new revert commit rather than rewriting published history.

## Services-inspired login follow-up � 2026-09-12

User accepted the dashboard theme, requested live testing, then requested the Services login visual treatment. The local live frontend remains at port 4198 and uses the configured backend on port 4019.

Replaced the full-width dark login split with a centered 1120px white card, left-hand site photography and manual thumbnails, and a right-hand corporate credential form. Mobile stacks a compact photo banner above the form. Uses locally stored photos from the user-selected Services reference; asset provenance is in `public/images/login/README.md`. Runtime token `--login-shadow` maps through Tailwind `shadow-login`; other surfaces keep their existing card shadow.

There is one working AD login action. Removed the redundant button that previously submitted the same credentials under a second label. Required-field focus, inline generic failure, password visibility and duplicate-submit protection now belong to the form. Authentication service, session storage and backend permissions are unchanged. Successful navigation remains Control Room.

Verification: production build passed; targeted login ESLint passed; 8 isolated Chrome checks passed (desktop, manual gallery, missing-field focus/no request, password masking, duplicate-submit guard, failure with retained inputs, 390px mobile without horizontal overflow, successful login redirect). All login test requests were intercepted with synthetic fixtures; no test credentials went to the live backend. Screenshots were visually reviewed. Repeat with `scripts/verify-login-theme.cjs`, with Playwright supplied through `PLAYWRIGHT_MODULE` if necessary. Local evidence: `.tmp/live-theme/login-results.json`, `services-login-desktop.png`, `services-login-mobile.png`, `login-build.txt`. The prior repository-wide lint/TypeScript/audit caveats remain; this is not a new whole-product certification.

## Oil-painted outer background � 2026-09-12

Generated an original fictional tropical industrial landscape with the built-in image generation tool, following the user request for an oil-painting style. Saved the original output as `public/images/login/oil-landscape-background.png`; exact prompt and provenance are in the adjacent README. The login-only CSS background uses cover/center and a 42% dark overlay behind the white card. Interior photos, authentication and all dashboard surfaces are unchanged. Production build and targeted login lint passed. Desktop (1440px) and mobile (390px) browser checks confirmed the asset is applied and no horizontal document overflow occurs; screenshots in `.tmp/live-theme/oil-login-desktop.png` and `oil-login-mobile.png`.
