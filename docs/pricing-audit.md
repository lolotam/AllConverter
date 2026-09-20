# Pricing audit — what the plans promise vs what the code does

> **Status 2026-09-20: the copy below has been rewritten** (see "What the plans say now").
> The table of old claims is kept because it is the reason the wording changed.
> One thing is still outstanding: retention is a single global setting, so no plan can
> sell a longer window than another until phase 2 of the implementation plan is done.

Checked against `src/db/db.ts` (tier seed data), `src/services/quota.ts`,
`src/helpers/queue.ts` and `src/index.tsx` on 2026-09-20.

## Free — "$0 / forever"

| Claim                           | Enforced? | Notes                                                             |
| ------------------------------- | --------- | ----------------------------------------------------------------- |
| Up to 100 MB max file size      | Yes       | `max_file_size_mb = 100`, checked on upload creation              |
| 10 conversions per day          | Yes       | `daily_conversions = 10`; guests get `GUEST_FREE_CONVERSIONS` (1) |
| Standard cloud processing speed | Yes       | priority 0 in the queue                                           |
| 2-hour file retention           | **No**    | retention is one global setting for everybody                     |
| No account required             | Yes       | one conversion, then the sign-up gate                             |

## Pro — "$9.99 / month"

| Claim                            | Enforced?       | Notes                                                                                 |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| Up to 2 GB max file size         | Yes             | `max_file_size_mb = 2048`, and resumable uploads make it reachable through Cloudflare |
| Unlimited conversions            | Yes             | `daily_conversions = 999999`                                                          |
| Priority Turbo Queue (5x faster) | Partly          | priority is real; **"5x faster" is not a measured number** and should go              |
| Batch upload up to 50 files      | Yes             | `batch_limit = 50`                                                                    |
| 24-hour file storage             | **No**          | same global retention as free                                                         |
| 100% Ad-free experience          | Yes (vacuously) | there are no ads on any tier                                                          |

## Business & API — "$29.99 / month"

| Claim                           | Enforced? | Notes                                             |
| ------------------------------- | --------- | ------------------------------------------------- |
| 50,000 API credits / month      | **No**    | there is no API at all                            |
| Dedicated conversion workers    | **No**    | one shared queue                                  |
| Webhooks & Cloudflare R2 export | **No**    | not built; R2 was dropped by decision             |
| 99.9% Uptime SLA                | **No**    | no monitoring, no status page, no credits process |
| 24/7 Priority support           | **No**    | no support channel exists                         |

**This plan currently cannot be sold.** Every line of it is unbacked.

---

## Proposed replacement copy

Free and Pro need two changes: make retention per-tier real (phase 2 of the plan), and
drop the unmeasured "5x".

**Pro**

- Up to 2 GB max file size
- Unlimited conversions
- Priority queue — your files convert first
- Batch upload up to 50 files
- 24-hour file storage
- No ads, ever

**Business** — either hide it behind "Contact us" until the API exists, or sell only what
runs today:

- Up to 5 GB max file size
- Batch upload up to 100 files
- Highest queue priority
- 7-day file storage
- Email support, one business day
- API access — _join the waiting list_

The waiting-list line is honest, costs nothing, and tells you whether the API is worth
building before you build it.

---

## What the plans say now

Rewritten in the seed data, and migrated for databases that already held the old text —
but only where the wording was untouched, so anything edited in the admin dashboard is
left alone.

**Free** — Up to 100 MB max file size · 10 conversions per day · Standard processing
queue · Files kept for 24 hours · No account required

**Pro** — Up to 2 GB max file size · Unlimited conversions · Priority queue, your files
convert first · Batch upload up to 50 files · Files kept for 24 hours · No ads, ever

**Business** — Up to 5 GB max file size · Batch upload up to 100 files · Priority queue,
your files convert first · Files kept for 24 hours · Email support · API access, join the
waiting list. The button now reads "Join the waiting list" instead of "Get API Access".

Every line is checked against the code by `tests/db/tierCopy.test.ts`, which fails if a
plan ever again promises API credits, webhooks, an SLA, 24/7 support, dedicated workers,
"5x faster" or a two-hour retention window.

### Two judgement calls worth knowing

- **Retention is the same on every plan** (24 hours, from `AUTO_DELETE_EVERY_N_HOURS`),
  so all three now say so. It stops being a false claim, but it also stops being a reason
  to pay until per-tier retention exists.
- **Business and Pro run at the same queue priority**, because the queue only knows
  "priority" and "standard". Business therefore makes the same queue promise as Pro
  rather than claiming to be above it. Give the queue a third level if Business should
  genuinely come first.
- **"Email support" is a promise only a person can keep.** It is the one line the code
  cannot enforce; remove it in the admin Tiers tab if you would rather not commit to it.
