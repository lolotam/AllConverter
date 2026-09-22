# Working on AllConverter

## The production site is `allconverter.tech`

`https://allconverter.tech` is the live site. `www.allconverter.tech` resolves to the same
application and is redirected to the bare host by `CANONICAL_HOST`, so a session is never
split between the two.

**`convertx.walidmohamed.com` is retired.** It was replaced on 2026-09-20 and no longer
routes anywhere — it answers with Traefik's own `404 page not found`, which looks exactly
like an outage and is not one. Do not probe it, and do not reintroduce it into docs or
scripts when citing evidence about production.

The repository was renamed from `ConvertX` to `AllConverter`; the remote is
`github.com/lolotam/AllConverter`. Some internal names still read `convertx` — the Dokploy
project and application, and the `convertx-data` volume that holds the SQLite database.
Those are deliberate: renaming the volume would detach the database.

## Deployment

Dokploy builds the `Dockerfile` straight from `main` — there is no image published to a
registry, and GitHub Actions do not deploy. `autoDeploy` is on with a `push` trigger, so a
merge to `main` is meant to redeploy on its own. A build takes roughly four to five minutes
because `cleanCache` is set.

When a merge lands and the site still serves the old build, check whether a deployment was
actually created before assuming the build failed: the GitHub App webhook has stopped
firing before, and the fix is on the GitHub side, not in the application.

To tell builds apart from outside, fetch `/generated.css` and look for a token only the new
build has. The admin dashboard is behind authentication, so a change confined to it cannot
be confirmed from the public landing page.

## Gates

`bun run lint` runs five checks — `tsc`, `knip`, `eslint`, `prettier` and `xss-scan` — and
all five must exit 0. `bun test` must be green.

Two things about the test suite that are easy to get wrong:

- Every test file runs in **one process sharing one database**. `process.env.DB_PATH ??=`
  means the first file to import from `src/` decides the path for all of them, so a bare
  `DELETE FROM jobs` in one file will wipe another file's fixtures. Scope every write to
  rows that file owns.
- `src/helpers/env.ts` snapshots `process.env` at first import. A local `.env` can mask a
  failure that CI then hits, so reproduce environment-dependent failures with the file
  temporarily moved aside rather than trusting a local pass.

## Markup

`@kitajs/html` does **not** escape by default: an expression renders raw unless the element
carries `safe`. `lint:xss` catches most of it, but it treats an expression as safe when its
text begins with `safe`, so a variable named `safeThing` is waved through whether or not it
really is.

Tailwind finds classes by scanning source text, so a class assembled at runtime
(`` `bg-${hue}` ``) is never generated and the style silently does not appear. Write the
full class name out; `better-tailwindcss/no-concatenated-classes` enforces this.
