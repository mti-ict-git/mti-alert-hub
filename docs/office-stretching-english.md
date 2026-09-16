# Office Stretching English Copy

## Office Stretching English copy — 2026-09-16

Office Stretching B1/B2 preview text, catalog titles/instructions, six step descriptions,
routine navigation/countdown labels, and stretching completion/follow-up copy now use English.
The B2 overview bitmap was edited with ImageGen and visually checked: Neck, Shoulders,
Upper Back, Lower Back, Wrists, and Stand & Move. B1 artwork has no embedded captions.
Theme, layout, action keys, timing, step order, and event callbacks are unchanged.

Release requirements: rebuild/package the Windows Agent for embedded controls/artwork and preview copy;
redeploy the frontend for newly authored templates. Existing stored programs are not automatically translated:
edit their saved titles, instructions, actions and step text, then publish a new revision.
Do not claim that merely restarting an old agent or republishing unchanged saved content translates it.

Verification: Release build passed without warnings/errors. The initial test build encountered stale WPF
generated-source files; a serial rebuild succeeded and all 54 agent regression tests passed.
Targeted frontend lint passed. English asset reviewed visually and targeted source scan found no remaining
known Indonesian strings in the changed Office Stretching paths. Live installed-agent visual acceptance remains pending.

Frontend production build also passed (Vite client and SSR). No deployment or MSI publication was performed.
