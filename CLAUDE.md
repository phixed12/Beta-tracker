# Beta Testing Coordination System

## Project overview

Build a web application for coordinating beta testing across 27 product features, 15 testers per feature, drawing from a pool of 100 priority clients. The core constraint is that no client ever receives more than one outreach — all beta invitations must be batched into a single communication, gated by CSM sign-off.

---

## Tech stack decisions needed from user before starting

Before scaffolding, ask the user to confirm:
1. Frontend framework (React/Next.js recommended)
2. Backend/database (Postgres recommended; Prisma as ORM)
3. Auth provider (Okta, Google SSO, or NextAuth)
4. CRM integration target (Salesforce, HubSpot, or none for v1)

---

## Data models

### `BetaFeature`
```
id                  UUID          PK
name                String
owner_pm            UUID          FK → User
owner_pmm           UUID          FK → User
target_tester_count Int           default 15
status              BetaStatus
start_date          Date
closed_at           Timestamp     nullable — written on close
close_reason        CloseReason   nullable
close_notes         String        nullable
ideal_client_criteria String
outreach_deadline   Date
cloned_from         UUID          nullable, FK → BetaFeature
created_at          Timestamp
updated_at          Timestamp
```

### `Client`
```
id                  UUID          PK
name                String
csm_owner           UUID          FK → User
tier                Int           1–100 rank (1 = highest priority)
account_health      HealthStatus
outreach_lock       Boolean       default false
last_outreach_date  Date          nullable
notes               String        nullable
crm_id              String        nullable — external CRM reference
created_at          Timestamp
updated_at          Timestamp
```

### `BetaEnrollment`
```
id                  UUID          PK
client_id           UUID          FK → Client
feature_id          UUID          FK → BetaFeature
assigned_by         UUID          FK → User
is_overflow         Boolean       default false — true if nominated past 15-slot target
csm_approval_status ApprovalStatus
csm_approved_by     UUID          nullable, FK → User
csm_approved_at     Timestamp     nullable
csm_rejection_reason String       nullable
tester_status       TesterStatus
outreach_sent_at    Timestamp     nullable
confirmed_at        Timestamp     nullable
completed_at        Timestamp     nullable
dropped_at          Timestamp     nullable
drop_reason         String        nullable
feedback_submitted  Boolean       default false
created_at          Timestamp
updated_at          Timestamp

UNIQUE constraint: (client_id, feature_id)
```

### `OutreachBatch`
```
id                  UUID          PK
client_id           UUID          FK → Client
batch_status        BatchStatus
sent_at             Timestamp     nullable
sent_by             UUID          nullable, FK → User
created_at          Timestamp
updated_at          Timestamp

-- Computed field (not stored):
all_csms_approved   Boolean       — true when zero enrollments in this batch have csm_approval_status = pending
```

### `OutreachBatchEnrollment` (join table)
```
batch_id            UUID          FK → OutreachBatch
enrollment_id       UUID          FK → BetaEnrollment
PRIMARY KEY (batch_id, enrollment_id)
```

### `User`
```
id                  UUID          PK
name                String
email               String        UNIQUE
role                UserRole
created_at          Timestamp
```

### `AuditLog`
```
id                  UUID          PK
entity_type         String        e.g. "BetaEnrollment", "BetaFeature"
entity_id           UUID
action              String        e.g. "status_change", "csm_approved"
changed_by          UUID          FK → User
prior_state         JSON          nullable
next_state          JSON          nullable
created_at          Timestamp
```

---

## Enumerations

### `BetaStatus`
```
draft           — being set up, not yet recruiting
recruiting      — actively assigning clients
outreach_sent   — at least one batch sent, still filling
full            — 15 confirmed testers reached
in_progress     — beta underway
closing         — winding down; no new nominations; existing testers completing
closed          — complete; closed_at written
```

### `CloseReason`
```
completed       — ran full course
cancelled       — feature deprioritised
merged          — folded into another beta
paused          — suspended; re-open resets to recruiting
```

### `HealthStatus`
```
green           — eligible for outreach
yellow          — CSM discretion required (can nominate with warning)
red             — blocked; system must prevent nomination
```

### `ApprovalStatus`
```
pending
approved
rejected
```

### `TesterStatus`
```
nominated
csm_pending
csm_approved
outreach_sent
confirmed
active
completed
dropped
cancelled      — voided when parent beta closed before tester reached active
```

### `BatchStatus`
```
pending         — collecting approvals; not yet ready to send
ready           — all CSMs approved; awaiting coordinator send
sent            — outreach dispatched
```

### `UserRole`
```
pm
pmm
csm
coordinator
admin
```

---

## Business logic — enforce these as service-layer rules, not just UI guards

### Nomination rules
- Clients with `account_health = red` CANNOT be nominated. Return a 400 with a clear error.
- Clients with `account_health = yellow` CAN be nominated but the API response must include a `warning` field that the UI must display before confirming.
- If a client already has 3+ enrollments with `tester_status` in `[nominated, csm_pending, csm_approved, outreach_sent]` within the same outreach window (configurable, default 14 days), the API must return a conflict warning. The caller may override by passing `force: true`.
- Duplicate nominations (same client + feature) must be rejected with a 409.
- No new nominations accepted when `BetaFeature.status` is `closing` or `closed`.

### CSM approval rules
- Only the `csm_owner` of a client may approve or reject that client's nominations.
- Rejection requires a non-empty `csm_rejection_reason`.
- Rejection of one enrollment does NOT affect sibling enrollments for the same client.

### Outreach batch rules
- The system automatically groups all `csm_approved` enrollments by client into a batch record. This grouping runs as a background job every 15 minutes, or can be triggered manually by a coordinator.
- A batch is held for a configurable window (default 48 hours from the first approval in the batch) to allow remaining approvals to collect before send.
- A coordinator may force-send a batch before the window closes.
- Once a batch has `batch_status = sent`, no additional enrollments may be added to it. New approvals for the same client create a new batch.
- On batch send, write `outreach_sent_at` to all included enrollments and update `Client.last_outreach_date`.
- Enforce a per-client cooldown of 30 days between batch sends. Coordinator can override.

### Closing a beta
- When a feature is closed, all enrollments with `tester_status` in `[nominated, csm_pending, csm_approved, outreach_sent]` are set to `cancelled`. Write to audit log.
- Enrollments with `tester_status = active` remain active; feature moves to `closing`. When all active enrollments resolve, auto-advance to `closed` and write `closed_at`.
- A coordinator may force-close immediately, which sets all active enrollments to `dropped`.
- Notify (in-app + email) all CSMs and PMs with affected cancelled enrollments.

### Overflow slots
- If a feature already has 15+ confirmed enrollments and a PM nominates another, set `is_overflow = true` on the new enrollment. Process normally. Label overflow enrollments distinctly in all views and reports.

---

## API routes

### Beta features
```
GET    /api/features                    — list all, filterable by status/owner
POST   /api/features                    — create new beta feature
GET    /api/features/:id                — get detail including enrollment counts
PUT    /api/features/:id                — update
POST   /api/features/:id/close          — close with reason; triggers cascade
POST   /api/features/:id/clone          — clone as template → new draft
```

### Clients
```
GET    /api/clients                     — list, filterable by tier/health/csm
GET    /api/clients/:id                 — detail including participation history
GET    /api/clients/:id/betas           — all enrollments for this client
```

### Enrollments
```
GET    /api/enrollments                 — list, filterable by feature/client/status
POST   /api/enrollments                 — nominate a client to a beta
DELETE /api/enrollments/:id             — remove nomination (pre-outreach only)
POST   /api/enrollments/:id/approve     — CSM approves (auth: csm_owner only)
POST   /api/enrollments/:id/reject      — CSM rejects with reason
PUT    /api/enrollments/:id/status      — update tester_status (coordinator/PM)
```

### Outreach batches
```
GET    /api/batches                     — list all batches with status
GET    /api/batches/:id                 — batch detail with enrollment list
POST   /api/batches/trigger             — manually trigger batch grouping job
POST   /api/batches/:id/send            — mark batch as sent (coordinator only)
```

### Reports
```
GET    /api/reports/overview            — dashboard summary: counts by status, avg duration, avg time-to-fill
GET    /api/reports/features            — per-feature: duration, fill rate, completion rate, outreach conversion
GET    /api/reports/clients             — per-client: betas nominated/completed/dropped, completion rate
GET    /api/reports/csm-responsiveness  — avg approval time per CSM (coordinator/admin only)
GET    /api/reports/at-risk             — features under-filled within 5 days of start; stale approvals (48h+)
```

All report endpoints accept `?from=` and `?to=` date range params. All list endpoints support `?page=` and `?limit=` for pagination.

---

## Computed report metrics — implement as database queries or views

| Metric | Formula |
|---|---|
| Beta duration | `closed_at − start_date` in calendar days |
| Time to fill | Date of 15th `confirmed_at` enrollment − `start_date` |
| Tester completion rate | `COUNT(completed) / (COUNT(completed) + COUNT(dropped))` per feature |
| Outreach conversion rate | `COUNT(confirmed) / COUNT(outreach_sent)` per feature |
| Client completion rate | `COUNT(completed enrollments) / COUNT(total enrollments)` per client |
| CSM avg approval time | `AVG(csm_approved_at − created_at)` per CSM, enrollments where `csm_approval_status = approved` |
| Avg time to fill (global) | Mean of time-to-fill across all closed betas with ≥15 confirmed |

---

## Views / pages

### `/features` — betas by feature
- Card or table for each beta
- Columns: name, owner, status badge, slot fill (e.g. 9/15 with progress bar), CSM approvals pending, outreach sent, confirmed, elapsed days
- Closed betas show: duration (days), completion rate
- Actions: create new, clone, close

### `/features/:id` — feature detail
- Enrollment list with tester_status, CSM approval status, overflow flag
- Add testers panel: searchable client list with health indicator and existing beta load
- Conflict and health warnings shown inline before confirmation

### `/clients` — betas by client
- Row per client: name, tier, health, CSM, active betas (count + chips), outreach batch status
- Expandable: participation history panel — timeline of all past betas, completion rate, last outreach date

### `/approvals` — CSM approval queue
- Filtered to logged-in CSM's clients by default
- Columns: client, feature, feature owner, ideal criteria, account health, nominated date
- Bulk approve/reject; individual approve/reject with rejection reason modal
- Badge count in nav for pending approvals

### `/batches` — outreach batch tracker
- Per-client batches: status, features included, approvals complete/pending, batch age, sent date
- Coordinator actions: force-send, override cooldown
- Highlight batches where a CSM has been pending 48h+

### `/dashboard` — progress overview
- Summary stat cards: total features, total confirmed testers, total outreach sent, avg completion rate
- Toggle between active and closed betas
- At-risk section: under-filled features, stalled approvals, owners with zero nominations

### `/reports` — analytics
- Beta duration chart (bar or scatter of all closed betas)
- Time-to-fill trend
- Client participation leaderboard (most completed betas)
- Outreach conversion funnel
- CSM responsiveness table (coordinator/admin only)
- All charts exportable to CSV

---

## Role-based access control

| Action | PM/PMM | CSM | Coordinator | Admin |
|---|---|---|---|---|
| Create/edit own beta | ✓ | — | ✓ | ✓ |
| View all betas | read | read | ✓ | ✓ |
| Nominate clients | ✓ | — | ✓ | ✓ |
| Close beta | own only | — | ✓ | ✓ |
| Approve/reject nominations | — | own clients | ✓ | ✓ |
| Send outreach batch | — | — | ✓ | ✓ |
| Override cooldown | — | — | ✓ | ✓ |
| View CSM responsiveness report | — | — | ✓ | ✓ |
| Manage users | — | — | — | ✓ |

---

## Notifications

- CSMs receive: in-app notification (real-time) + daily email digest of pending nominations for their clients
- PMs/PMMs receive: notification when CSM approves or rejects their nominations; notification when a batch is sent for their feature's clients
- Coordinators receive: alert when a batch has been in `pending` state >48h; at-risk report digest daily
- All role notifications are configurable per-user (on/off per notification type)

---

## Non-functional requirements

- All state mutations write to `AuditLog` (entity type, entity id, action, changed_by, prior state JSON, next state JSON, timestamp)
- All list endpoints paginated
- CSV export available from every list view and all report endpoints
- Mobile-responsive UI — CSMs primarily use on mobile for approvals
- Batch grouping job must be idempotent (safe to run multiple times without creating duplicate batches)
- Cooldown enforcement and conflict warnings enforced server-side, not just in UI

---

## Out of scope for v1

- Automated email sending (system tracks `sent` status only; actual email composed externally)
- In-app messaging with testers
- Feedback collection (link out to existing survey tool)
- Client-facing / tester portal
- CRM sync (import client list manually for v1; CRM webhook is v2)
