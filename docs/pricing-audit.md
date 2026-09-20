# Pricing audit — what the plans promise vs what the code does

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
