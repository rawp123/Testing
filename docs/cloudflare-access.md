# Cloudflare Access Setup

This repo now groups the in-progress tools under `/work-in-progress/` so Cloudflare Access can protect them with a small number of path rules.

## Recommended protected paths

- `/work-in-progress/*`
- `/work-in-progress/data/*`

The nuclear verdict tracker inside the work-in-progress section reads from:

- `/work-in-progress/data/nuclear-verdicts-latest.json`

That keeps the page and its JSON snapshot under the same protected prefix.

## Suggested application

Create a self-hosted application in Cloudflare Zero Trust for the site hostname and add an Access policy that requires your chosen login method.

Recommended include rule:

- Emails ending in your domain, or
- One-time PIN for a short allowlist of email addresses

## Notes

- The legacy public paths now redirect to the work-in-progress versions:
  - `/litigation-analytics/`
  - `/nuclear-verdict-tracker/`
  - `/games/silly-word-builder/`
- The JPML dashboard remains outside the protected work-in-progress section.
- Running `npm run scrape:nuclear-verdicts` now refreshes both the public data snapshot and the protected work-in-progress snapshot.
