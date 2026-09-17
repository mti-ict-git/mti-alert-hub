# Wellness scheduling diagnostic — 2026-09-17

Phase 4: read-only production and installed-agent investigation. Pilot scope: MTI-NB-373 only. No program publication, recipient changes, deployment, or database writes were performed by this investigation.

## Findings

The original Office Stretching published schedule used HOURLY/2 with a 30-minute stagger; the original first window was 08:48–09:16 UTC+8. The draft JSON differed from the published schedule and must not be used to diagnose executing policies. Initially 14 policies were active, 12 had a last synchronization timestamp, and no reminder events existed. The detail card labels active/total counts as active/synchronized; this does not establish successful client receipt or display.

During observation, production contained a replacement version 2 including MTI-NB-373. This investigation did not create that revision. The installed 1.0.17 agent cached active policy a55c13df-c6d3-418a-8205-243dad192451 with validFrom 12:57:45.279 UTC+8. The local scheduler triggered it at 12:58:14.780 and recorded Displayed at 12:58:15.877. PostgreSQL independently contained Triggered, Displayed, and Started events for this policy. This verifies current pilot scheduling, rendering acknowledgement, and reporting; it does not prove why original recipients missed earlier occurrences.

Server reported_at was approximately 46 seconds earlier than client occurred_at, indicating clock skew between the observed timestamps. Synchronize clocks before using these fields for latency analysis. This observation alone does not establish the original failure cause.

## Remaining diagnostic boundary

The fixed-schedule evaluator accepts occurrences only within its one-minute lookback and skips older occurrences. An unavailable agent at the due time can therefore miss a fixed occurrence without backlog replay. No original-recipient runtime logs were available to establish whether this happened. Do not present that possible cause as confirmed.

The current pilot path works. Original 08:48 root cause remains unconfirmed. UI synchronization labeling requires a separate correction. No wellness appearance was changed.
