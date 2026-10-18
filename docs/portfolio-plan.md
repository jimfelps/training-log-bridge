# Portfolio page plan

## Proposed identity

- Project title: **Training Log Bridge**
- Repository slug: **training-log-bridge**
- Proposed URL: **https://training.phelpswithanf.com**
- Short portfolio-card description: **Turning CrossFit programming and corrected watch data into a portable training history.**

The subdomain is a proposed address for a compact case study. No hosting, DNS record or site has been created or published. Choose the hosting destination first, then add the exact DNS records supplied by that host in Squarespace. A subdomain does not require another domain purchase.

## One-page scope

1. Personal introduction, written by Jim: why a recurring training frustration became an automation project.
2. The concrete problem: programming and completed results live in separate systems; manual entry interrupts the workout; historical data is hard to take elsewhere.
3. A short workflow illustration: planned workout → reviewed Garmin workout → completed/corrected activity → independent training archive. Show manual review/import steps honestly.
4. Technical summary: use the concise text in technical-brief.md, or a short excerpt with a link to that file in the repository.
5. One screenshot using synthetic data, plus a link to the [source repository](https://github.com/jimfelps/training-log-bridge).
6. Current status and one next improvement, rather than a large speculative roadmap.

This can follow the portfolio's three-layer approach without requiring three pages: a short overview at the top, the personal project narrative in the middle, and a technical-detail link to the repository.

## Suggested technical proof points

- Translates imperfect workout descriptions into structured watch instructions, with explicit review where parsing is uncertain.
- Joins finalized activity data across responses and keeps corrected sets separate from potentially stale summary totals.
- Preserves raw source values and snapshots while maintaining queryable current records.
- Supports repeated imports and corrections without duplicate activities.
- Uses minimal browser scope and does not collect login credentials.

Avoid claiming fully automatic synchronization, quantified time savings, commercial API access, a finished dashboard, or automatic program-to-result reconciliation. Those are not implemented or measured.

## What remains before publishing

- Jim writes the personal narrative.
- Select static hosting and build the case-study page.
- Use synthetic demonstration data and a synthetic-data screenshot.
- Configure training.phelpswithanf.com with the hosting provider's exact records and verify HTTPS.
- Add the project link/card to the main portfolio.

The public page is a writeup, not a public browser for private training records. Keep personal archives and SQLite databases off the published site.
