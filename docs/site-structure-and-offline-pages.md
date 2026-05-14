# Site Structure And Offline Pages

This site is a static HTML/CSS/JavaScript site served by `jpml-server.js`.
Use `src/config/site-pages.json` as the registry for page availability and primary navigation.

## Page Registry

`src/config/site-pages.json` is the single place to control:

- which pages appear in the shared header
- which dropdown group a page belongs to
- which routes should be blocked when a page is offline

To take a page offline, change its page object from:

```json
"status": "online"
```

to:

```json
"status": "offline"
```

Then restart the local server. Offline pages are removed from the header and blocked by `jpml-server.js` for direct URL requests.

Use `paths` for exact page URLs and `pathPrefixes` for related folders or generated data that should go offline with the page.

Example:

```json
{
  "id": "podcast-utility",
  "label": "All-In Search",
  "href": "/all-in-podcast-search/",
  "status": "offline",
  "paths": ["/all-in-podcast-search/", "/all-in-podcast-search/index.html"],
  "pathPrefixes": ["/all-in-podcast-search/", "/data/all-in-podcast-search/"]
}
```

Use `"nav": false` for pages that should remain online but should not appear in the shared header.

## Website Code

- `index.html`: homepage
- `jpml-dashboard.html`: JPML dashboard entry point
- `contact/index.html`: contact page
- `db-diagram/index.html`: database diagram builder
- `games/`: game pages
- `work-in-progress/`: protected or preview pages
- `all-in-podcast-search/`: static All-In podcast search pages and generated Pagefind output
- `src/partials/header.html`: shared header shell
- `src/js/header.js`: loads the shared header and renders navigation from the page registry
- `src/js/`: page-specific JavaScript
- `src/css/`: page-specific CSS
- `style.css`: global site styles

## Generated Data

Generated files should not be hand-edited.

- `data/all-in-podcast-search/episodes/`: generated episode JSON
- `all-in-podcast-search/pagefind-source/`: generated HTML used by Pagefind
- `all-in-podcast-search/pagefind/`: generated Pagefind index files
- `data/mdl/`: generated JPML monthly snapshots
- `data/pdfs/`: JPML PDF index and PDF files

Rebuild generated All-In podcast data with:

```bash
npm run build:all-in-podcast-search
```

## Raw Podcast Inputs

Raw All-In podcast inputs live under:

`scripts/podcasts/all-in/raw/`

Important subfolders:

- `archive/feed.xml`: local RSS snapshot
- `audio/`: downloaded audio files and audio metadata
- `transcripts/<episode-id>/metadata.json`: transcript override metadata
- `transcripts/<episode-id>/transcript.txt`: timestamped text transcript override
- `transcripts/<episode-id>/transcript.json`: structured transcript override
- `transcripts/_reports/`: ASR or provider run reports

Transcript text should use bracketed timestamp blocks:

```text
[00:00:00]
Transcript text here.

[00:01:24]
More transcript text here.
```

The folder name must match the generated episode id, for example:

`scripts/podcasts/all-in/raw/transcripts/all-in-openais-identity-crisis-datacenter-wars-market-up-on-iran-news-mamdanis-first-tax-swalwell-out/`

After adding or moving raw transcripts, rebuild:

```bash
npm run build:all-in-podcast-search
```

## Current Practical Rule

If a page should be hidden only from navigation, set `"nav": false`.

If a page should be unavailable, set `"status": "offline"` and make sure `paths` plus `pathPrefixes` cover the page, its generated data, and any nested static assets that should not be reachable.
