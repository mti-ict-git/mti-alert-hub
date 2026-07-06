# MTI Alert — Frontend Build Plan

Enterprise emergency notification dashboard. Frontend only, mock data, structured so a Node/Express backend can slot in later by replacing the service layer.

## Stack note

The project template uses **TanStack Router** (file-based routing in `src/routes/`), not React Router DOM. I'll use TanStack Router — it fulfils the same role and is what this Vite template is wired for. Everything else matches your spec: React + TS + Vite + Tailwind + shadcn/ui + lucide-react + TanStack Query + Recharts.

If you specifically require `react-router-dom`, say so and I'll swap.

## Folder structure

```text
src/
  routes/              # TanStack file-based routes (one per page)
    __root.tsx         # shell (existing)
    login.tsx
    _app.tsx           # authed layout: Sidebar + Topbar + <Outlet/>
    _app.index.tsx     # Dashboard
    _app.notifications.tsx
    _app.notifications.$id.tsx
    _app.notifications.new.tsx
    _app.employees.tsx
    _app.devices.tsx
    _app.whatsapp.tsx
    _app.templates.tsx
    _app.reports.tsx
    _app.settings.tsx
    _app.audit-logs.tsx
  layouts/AppLayout.tsx
  components/
    layout/{Sidebar,Topbar}.tsx
    common/{PriorityBadge,StatusBadge,PageHeader,StatCard,EmptyState,ConfirmDialog}.tsx
    dashboard/{SummaryCards,PriorityChart,AckChart,ChannelChart,RecentActivity}.tsx
    notifications/{NotificationForm,WhatsAppPreview,DesktopPreview,RecipientsTable,DeliveryLogsTable,AckSummary}.tsx
    whatsapp/TemplatePreview.tsx
  services/            # ← swap these for real HTTP calls later
    api-client.ts      # thin fetch wrapper, base URL from env
    auth.service.ts
    notifications.service.ts
    employees.service.ts
    devices.service.ts
    whatsapp.service.ts
    templates.service.ts
    reports.service.ts
    audit.service.ts
    settings.service.ts
  data/                # mock seed data (sites, departments, employees, ...)
  hooks/               # useAuth, useNotifications, useEmployees, ... (TanStack Query)
  types/               # shared TS types (Notification, Employee, Device, ...)
  lib/mock-delay.ts    # simulate latency
```

Every service function is `async` and returns typed data from mock arrays with a small delay. Each file has a `// TODO(backend): replace with fetch('/api/...')` comment at the top.

## Auth (mock)

- `login.tsx`: username/password + "Login with AD Account" button. Any non-empty credentials succeed, stores `{ user }` in localStorage, redirects to `/`.
- `_app.tsx` layout: `beforeLoad` checks mock session, redirects to `/login` if missing.
- Topbar shows current user + logout.

## Design system

Extend `src/styles.css` tokens with enterprise palette: neutral slate base, primary blue, and semantic priority colors — `--info`, `--warning`, `--emergency` (strong red). Add `PriorityBadge` and `StatusBadge` reading these tokens. Dark-mode friendly (both themes defined).

Emergency form state: red left border, red header banner, pulsing indicator, red submit button.

## Pages (behavior highlights)

1. **Login** — branded card, mock auth, redirect.
2. **Dashboard** — 6 StatCards, 3 Recharts (bar/pie/bar), recent activity feed.
3. **Notification Center** — shadcn `Table` with priority/status filters, search, row actions (view, duplicate, cancel-if-scheduled).
4. **Create Notification** — full form with:
   - Emergency priority → red styling + auto-enable all channels
   - WhatsApp channel checked → live WhatsApp template preview
   - Desktop Agent checked → desktop toast preview
   - Target Type cascades Site → Department → Section selects
   - Schedule Now / Later (date-time picker)
   - Confirmation modal before submit → mock create → toast → redirect to detail
5. **Notification Detail** — header + Tabs (Overview / Recipients / Delivery Logs / Acknowledgement). Ack summary cards: Safe / Need Assistance / Not In Area / No Response / Acknowledged.
6. **Employees** — table with filters (Site, Department, Section, Has PC, Field Officer, Status), Add/Edit drawer, Import CSV placeholder button.
7. **Devices** — table with Online/Offline badge, mock heartbeat (interval flips a couple statuses to simulate real-time), "Send Test Notification" action.
8. **WhatsApp Gateway** — status card (Connected/Disconnected), counters, message log table, TemplatePreview component showing the exact 🚨 MTI ALERT template.
9. **Templates** — CRUD table + editor drawer, "Use template" → navigates to `/notifications/new` with prefilled state.
10. **Reports** — filter bar, 3 Recharts, history table, disabled Export PDF/Excel buttons with tooltip "Backend required".
11. **Settings** — Tabs: General, Channels, Desktop Agent, WhatsApp Gateway, Roles & Permissions, Audit Logs link. Desktop Agent tab: download placeholder, version, heartbeat interval, auto-update switch. WhatsApp tab: gateway URL, webhook URL, default template, retry attempts.
12. **Audit Logs** — filterable table (time / user / action / module / description / IP).

## Layout

- Collapsible `Sidebar` (shadcn sidebar component) with the 10 menu items + icons from lucide-react.
- `Topbar`: page title slot, search, notifications bell (mock), user menu (profile / logout).
- Responsive: sidebar collapses to icons on tablet, sheet drawer on mobile.

## Mock data seeds

- 6 sites, 7 departments as specified.
- ~40 employees across sites/departments with realistic mixes of Has PC / Field Officer.
- ~15 devices tied to employees.
- ~20 notifications including the 5 named examples (Fire Alarm @ Acid Plant, Power Shutdown @ Chloride, Network Maintenance, Emergency Drill, Heavy Rain Warning), each with recipients, delivery logs, acknowledgements.
- ~30 WhatsApp messages, ~50 audit log entries, ~8 templates.

## Backend-swap plan (documented in code)

- `src/services/api-client.ts` uses `import.meta.env.VITE_API_URL`; when unset (current), each service imports mock data instead of calling the client. Each service exports the same function signatures the real API will implement, so switching = replacing mock body with `apiClient.get/post(...)`.
- TanStack Query hooks in `src/hooks/` already wrap the services, so components don't change.

## Out of scope (this build)

- Real auth, real WhatsApp/AD integration, real file export, real websockets. All represented visually with mock behavior.

Approve and I'll implement.