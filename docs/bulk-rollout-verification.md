# Devices bulk rollout verification

13 September 2026 — Phase 4.

- Reuses approved-device filters/pagination, Checkbox, Table, Dialog, Select and existing devicesService preview/apply endpoints. No backend or API contract change.
- Two unit tests passed: immutable/deduplicated target snapshot, sequential execution, partial failure with continuation, no automatic retry, progress, and empty selection.
- Targeted ESLint passed. Frontend typecheck still fails in pre-existing unrelated files; no diagnostics in the changed Devices route or rollout helper/test.
- Production build passed after final changes.
- Authenticated browser: zero selection disables bulk action; selecting two hostnames opens the shared review; no package means Preview/Apply disabled; package dropdown empty state checked. Filter with zero results clears selection and disables select-all. Keyboard Escape closes dialog. At 390px viewport the dialog measured 358px wide with equal scroll/client widths (356px), without horizontal overflow. Restored viewport.
- This environment returned no local MSI packages. Live successful preview/apply and physical installation were not executed. Failure/partial processing is covered by the simulated request unit test, not claimed as live agent proof.
- Strict premium audit still reports existing project-wide unresolved/violation backlog (34 findings); it is not a clean audit. No new finding specific to the rollout changes was identified. The run is preserved at /tmp/mti-bulk-rollout-audit.json; existing checked-in baseline was preserved.
- Rollout creation is not installation confirmation. Lost responses are unconfirmed, not safe automatic retry. The operator must check history before a new attempt.
