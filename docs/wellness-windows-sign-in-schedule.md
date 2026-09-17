# Wellness scheduling after Windows sign-in

Phase 4 hardening; supplements wellness-program-revisions.md and wellness-policy-only-delivery-fix.md.

## Contract
- Operators choose Fixed schedule or After Windows sign-in in the wellness editor.
- The first occurrence is one interval after the later of the Windows user logon time and policy activation. Subsequent occurrences are one interval after the last actual trigger.
- Interval is an integer from 1 to 10080 minutes. The same interval controls first delay and repetition.
- Lock/unlock and agent restart preserve the anchor. A new Windows logon session resets it.
- Locked/disconnected sessions do not display reminders. Unlock and sleep/hibernate resume impose a one-minute grace period. At most one overdue occurrence per policy is emitted, then cadence resumes from that actual trigger. There is no backlog replay.
- Elapsed locked/sleep time counts. A session-based day is 24 elapsed hours, not a calendar-time appointment.
- An optional Available from date is an activation boundary, not a fixed first occurrence. Existing expiry and cancellation synchronization apply.
- Snooze supersedes the next interval within the same session and schedule version.
- Cached active policies may run offline after agent restart when a previously registered session is cached. Known expired sessions are blocked. Cancellation while offline becomes effective on the next successful policy sync.
- Agent startup waits one minute before presenting this mode, preserving the persisted trigger anchor.

## Wire and persistence
Existing recurrenceRule carries the application extension FREQ=WINDOWS_SIGNIN;INTERVAL=N (minutes). This is not an RFC RRULE frequency. Only wellness AgentLocalRoutine schedules accept it; staggered distribution is rejected. Existing fixed rules remain unchanged. No database migration or environment variable is required.
The Windows agent reads its own interactive session using WTSQuerySessionInformation/WTSSessionInfoEx. LogonTime survives lock, sleep, and hibernate. Session flags prevent display while locked/disconnected. Resume events and a scheduler-gap fallback begin the grace period.
LastTriggeredOccurrenceUtc is persisted before display and reused after restart; older session/version execution state is ignored. As with existing local reminders, a crash between persistence and rendering may skip one occurrence rather than duplicate it.
Older agents ignore this unsupported frequency. Deploy the updated agent before assigning this mode.

## Verification
Verified locally on 2026-09-16:
- Agent build in SignInVerification configuration: 0 warnings, 0 errors. Initial Release output was locked by the running agent, so verification used a separate output without stopping it.
- Agent regression suite: 67 passed, including activation delay, lock gating, one overdue catch-up, restart/new-logon behavior, snooze, expiry, stale versions, resume grace, missing power event fallback, and an actual SQLite cache/trigger roundtrip across store restart.
- Node schedule tests: 6 passed (backend restrictions and frontend edit roundtrip).
- Transactional PostgreSQL wellness revision integration passed. Added revision to WINDOWS_SIGNIN, rejected stagger, verified schedule version 4 and serialized policy/detail rule. All fixture writes rolled back; no real device was notified.
- Native read-only diagnostic compiled WindowsSessionMonitor and SessionReminderGate and queried the current Windows session: stable past logon time and startup grace verified.
- Backend typecheck, targeted ESLint, frontend production build, and diff whitespace checks passed.
- Frontend-wide typecheck remains at the existing 72 diagnostics; the known WellnessFamily narrowing error in the editor is unchanged. This is not a clean repository-wide typecheck claim.
- Browser QA used scripts/verify-wellness-revision-ui.ts with in-memory APIs. Verified fixed/sign-in switching, hidden stagger controls, one-hour review text, out-of-range inline error and disabled action, preserved edits after a simulated 409, successful retry, and reopened version 4 with sign-in mode retained. Inspected the schedule panel visually at the available 729-pixel viewport.

## Release acceptance still required
- Rebuild/sign/package and install the new agent, and deploy the backend/frontend changes. Older running binaries are unchanged; no package upload or production rollout was performed.
- On one pilot device, publish a 2-minute sign-in schedule. Check lock/unlock, sleep, hibernate, agent restart while offline, and logout/new login. Verify no prompt during lock, grace after resume, one catch-up, and the next full interval.
- Polling runs every 30 seconds, so observed dispatch may trail the one-minute grace or due time by up to 30 seconds.
- Confirm event queue flush after reconnection and cancellation received on next policy sync. Do not infer exact sleep-vs-hibernate classification: both resume paths intentionally share the same behavior.

## Duplicate and publish correction — 2026-09-17

Duplicate uses the latest published schedule, falling back to the draft schedule only when no published schedule exists. The copy remains an inactive draft at schedule version zero. Create/edit and the publish dialog preserve the schedule basis, interval, timezone and validity. Windows sign-in publication forces synchronized distribution with no stagger; the publish dialog rejects non-integer or greater-than-seven-day session intervals. The detail view labels activation as Available from and does not invent a shared next-run timestamp for per-session schedules. Policy counts are labeled Active / total rather than claiming synchronization.

No migration or agent change is required for this correction. Redeploy both backend and frontend. Programs already published as fixed schedules are not silently rewritten: explicitly edit/review/publish the intended schedule. No production program was modified during verification.

Verification: backend typecheck and targeted ESLint passed; frontend production build passed; three schedule unit tests passed. Rollback-only PostgreSQL integration passed, including a conflicting stale draft versus published sign-in schedule, duplicate-of-duplicate, inactive/version-zero reset and policy serialization. No fixture writes were committed and no agent was notified.

Browser verification: `scripts/verify-wellness-publish-ui.ts` passed against an isolated local frontend with all API calls intercepted. The actual publish dialog retained Windows sign-in, displayed Available from, disabled publication above seven days, and submitted WINDOWS_SIGNIN/120 with synchronized distribution and null stagger. Reporting-unavailable responses were intentional fixtures. Existing development hydration warnings were observed. Run with a local frontend at 127.0.0.1:4207 and Playwright available via `PLAYWRIGHT_MODULE` or an installed `playwright` package.
