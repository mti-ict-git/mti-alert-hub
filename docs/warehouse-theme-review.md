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

## Live login connectivity correction � 2026-09-12

The live browser on 127.0.0.1:4198 sent preflight requests to port 4019, but the backend returned Access-Control-Allow-Origin http://localhost:3000. The browser consequently never sent POST /auth/login. This was a connectivity setup error, not evidence of an invalid AD password. Earlier fixture tests intercepted CORS headers and did not detect this real-backend mismatch.

Vite now proxies /api to DEV_API_TARGET (default http://127.0.0.1:4019) and strips only the /api prefix. The local frontend was restarted with VITE_API_URL=/api; the existing backend stayed running. `npm run dev:full` now defaults the frontend process to /api while honoring an explicit VITE_API_URL process override. Production gateway/API/auth policies are unchanged.

Real browser verification: /api/health returned 200/ok; the actual frontend apiClient sent an empty login payload to same-origin /api/auth/login and received backend validation 422. The validation rejects missing fields before LDAP, so no actual credentials or account attempts were required. This confirms the prior CORS barrier is removed; the user must retry their own credentials to verify their account login. No successful real-user login is claimed.

Follow-up verification: production build and targeted config/script lint passed; all 8 isolated login regression checks passed after updating the fixture interceptor to cover both direct and same-origin API paths.


## Login corporate and application logos - 2026-09-12

Replaced Gold Resources with Merdeka Tsingshan Indonesia as requested. Corporate row uses the complete official MTI vector artwork extracted from the Merdeka 2023 sustainability report, followed by the Services MCG and MBM assets. Added a separate original geometric MTI Alert application logo with copper and graphite colors. Asset provenance and downloadable SVG/transparent PNG logo package are under public/images/brand.

Verification: targeted login ESLint passed; all 8 isolated login browser checks passed with zero uncaught exceptions and synthetic intercepted authentication requests. Desktop and 390px mobile screenshots reviewed. No authentication behavior changed.

Production build passed for the logo integration; git diff --check passed.


## MTI Connect rebrand - 2026-09-12

User selected MTI Connect. Replaced the application logo with two open linked forms, graphite #303D49 and copper #B24F26. Added the approved Indonesian tagline to login, reused the square mark in the sidebar and favicon, and renamed web metadata, navigation, reports and notification previews. Corporate MTI/MCG/MBM logos remain separate. Deployment identifiers, backend contracts and installed Windows agent branding are outside this web identity change. SVG and transparent PNG exports plus ZIP are in public/images/brand/mti-connect-logo.

Verification: production build and targeted ESLint passed. Eight isolated login checks and authenticated dashboard branding check passed with zero uncaught exceptions; desktop, 390px mobile and dashboard screenshots reviewed. An initial cold-load gallery check did not observe the selected state. The test now waits for module network activity to settle before interaction and waits for the selected attribute; the complete rerun passed. Strict UI audit still reports existing unrelated ownership/control findings, as documented in prior review; no whole-product audit clearance is claimed. Evidence: .tmp/live-theme/connect-build.txt, connect-lint.txt, connect-audit.json, connect-dashboard.png, login-results.json.


## MTI Connect handshake logo revision - 2026-09-12

User requested a clearer handshake symbol. Replaced the abstract paired arcs with two people whose arms meet at a central clasp; the body/arm silhouette suggests M. Regenerated both SVGs, transparent PNGs and ZIP in the existing mti-connect-logo paths, automatically updating login/sidebar/favicon. Corporate marks and application behavior are unchanged.

Verification: canonical SVG PNG preview inspected; live logo decoded successfully at /login; 1440px desktop and 390px mobile captured, mobile visually reviewed with no horizontal overflow. Evidence: .tmp/live-theme/handshake-desktop.png and handshake-mobile.png. This asset-only revision does not rerun the previously passing application build/authentication suite.


## IMIP Morowali painted background — 2026-09-13

Replaced the login-only CSS background reference with `public/images/login/imip-morowali-oil-painting.png`, a built-in ImageGen oil-painting adaptation of the photograph explicitly selected by the user. Source URL and exact generation prompt are in the adjacent asset README. DESIGN.md now describes the reference-based artwork. The existing 42% overlay, centered cover crop, gallery, corporate marks and authentication behavior remain unchanged.

Verification: original photograph and generated artwork visually inspected; real browser at localhost:8080/login confirmed the new computed background URL and visible painting at the normal desktop viewport and 390x844 mobile viewport, without horizontal overflow. Viewport override reset after verification. Asset endpoint returned HTTP 200; Prettier check for src/styles.css and git diff --check passed. Strict project audit reports 31 existing broad findings (17 unresolved, 14 violations), outside this background-only change; output at /tmp/mti-login-art/premium-audit.json. No application-wide compliance claim, authenticated login test, build or database migration was made for this CSS URL/asset-only change.


## Remove nighttime site photograph — 2026-09-13

Removed the user-identified nighttime mine photograph (`public/images/login/site.jpg`) and its gallery entry and asset listing. The login gallery now offers Camp facilities and Operations. Verified in the live browser that only these two photo choices remain; targeted login ESLint and git diff --check passed. Source/resource search found no remaining runtime reference to the removed image.


## Industrial plant painted gallery replacement — 2026-09-13

Added `industrial-plant-oil-painting.png`, generated with built-in ImageGen from the user-selected brita.id photograph, as the third login gallery item in place of the deleted nighttime photograph. Source and exact prompt are recorded in the asset README. DESIGN.md reflects the gallery composition. Verified in the live browser: three thumbnail choices, Industrial plant selection updates the main image and pressed state, and the painting renders correctly inside the existing card. Targeted login ESLint and git diff --check passed. No authentication requests or database migrations were performed.


## Operations oil-painting resource — 2026-09-13

Converted the user-selected Operations photograph into an oil painting using built-in ImageGen and changed the gallery resource to `operations-oil-painting.png`. Original photograph retained as source reference; label, order, gallery behavior and outer background remain unchanged. Source/provenance and exact prompt are recorded in the asset README; DESIGN.md reflects the updated gallery. Live browser confirmed Operations selection, pressed state and correctly rendered painting. Targeted login ESLint and git diff --check passed. No login requests or database changes were made.


## Plant team replaces Camp facilities — 2026-09-13

Deleted camp.jpg and replaced the first gallery entry with plant-team-oil-painting.png, a built-in ImageGen adaptation of the user-selected Bisnis photograph. Updated accessible label to Plant team and set its main-image horizontal crop focus to 70% to retain the two workers. Source and exact prompt recorded in the asset README; DESIGN.md now reflects three oil-painted gallery resources. Live browser confirmed three choices, selected Plant team state and visible painting with both workers. Targeted login ESLint and git diff --check passed. No authentication or database action performed.


## Full-height login slideshow — 2026-09-13

Removed the thumbnail strip and extended the image to the full desktop panel height. Added wrapping previous/next arrows, white position indicators and pause/play, using native accessible buttons. Slides advance on a cleaned-up 20-second timeout; changing slides resets the interval. Mobile retains a bounded banner and natural form scrolling. Image errors retain navigation to another slide. Authentication is unchanged.

Verification: targeted login ESLint and formatting passed. Live browser verified first-to-last previous wrapping, last-to-first next wrapping, dot selection, pause/play, full-height desktop rendering and automatic first-to-second transition after a 21-second observation interval. Narrow viewport overflow check passed; viewport override restored. Initial locator wait missed its target; repeated timer check from a reset first slide confirmed the actual automatic transition.

Production build with `NITRO_PRESET=node-server npm run build` and final `git diff --check` passed. Build log: `/tmp/mti-login-art/slideshow-build.log`.


## Login depth and blurred backdrop — 2026-09-13

User requested glass/Gaussian depth and stronger window-edge shadows. Moved the outer painting to an isolated fixed pseudo-element with 14px blur and 24px overscan, retaining the dark image overlay. Added a separate edge vignette. The existing login-only shadow token now provides broad depth, contact shadow and a thin white rim; card content stays sharp and opaque for readability. No layout or authentication changes.

Verification: Prettier and git diff --check passed. Live computed styles confirmed blur(14px), the intended layered shadows, and no horizontal overflow. Normal browser screenshot verified sharp form/gallery against the blurred outer background. A viewport-override screenshot was clipped by the browser capture; override was reset and the normal screenshot inspected.


## Lighter blur and sliding transition — 2026-09-13

Reduced outer blur from 14px to 6px on user feedback. Replaced image swapping with a mounted horizontal image track and 700ms ease-in-out transform transition, shared by manual and automatic selection. Reduced-motion preferences disable the transition; inactive slides are hidden from assistive technology. Image failures are tracked per resource. The existing 20-second schedule remains unchanged. Verified live browser next-image selection and computed 6px blur, translateX(-100%) and 0.7s transition. Targeted ESLint, formatting and git diff --check passed.


## Sidebar artwork replacement - 2026-09-14

Replaced the prior Services corporate decoration with the user-supplied green/turquoise artwork. Original pixels are preserved; AppSidebar applies 6.5% opacity, multiply blending and a downward CSS mask, approximating the previous alpha range 0-16/255. Placement and collapsed hiding remain unchanged.

Verification: successful real login using the explicitly authorized env account on local frontend 4199, sidebar screenshots before/after captured and visually reviewed, followed by sign-out. No credentials or session tokens were saved in evidence. Targeted AppSidebar ESLint passed. Source asset and CSS-only change; authentication behavior unchanged. Evidence: .tmp/live-theme/sidebar-before.png and sidebar-after.png. Existing server 4198 also remains available; a separate frontend was started on 4199 for verification.
