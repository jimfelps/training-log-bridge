# Training Log Bridge

A personal automation project that connects CrossFit programming, a Garmin watch, and an independent training-history archive.

A browser extension translates PushPress programming into Garmin-compatible workout JSON. After training, a separate panel captures finalized Garmin Connect results—including corrected sets, notes and activity metrics—and exports a portable archive. A Python importer maintains the current results and historical snapshots in SQLite.

**Current release: 0.2.1.** Workout creation/import/watch sync and completed-activity capture/export have been tested in the owner's workflow. This is a personal tool using undocumented web interfaces, not an official PushPress or Garmin integration.

## Workflow

1. Open a workout in PushPress; select the desired sections and scaling.
2. Review the generated steps and download the Garmin workout JSON.
3. Use the separate [Garmin Workout Importer](https://github.com/estruyf/garmin-workout-browser-extension) to import it into Garmin Connect, then send it to the watch.
4. Record the activity, sync it, and finalize sets, reps, weights and notes in Garmin Connect.
5. Refresh the activity and use **Archive Garmin activity** to download the finalized archive JSON.
6. Import that file into the same SQLite database after each session.

Garmin **workout JSON** is a prescription sent to the watch. The **archive JSON** is the completed result used by the database importer. They are different file formats.

## Install the extension

Open `edge://extensions` or `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository's `extension` folder. Refresh PushPress or Garmin Connect after installing or reloading.

The checked-in browser bundles are ready to use. No npm install is required.

## Import a completed activity (PowerShell)

From the repository root, with Python 3.10 or newer installed:

```powershell
py .\archive_tools\archive_to_sqlite.py --db .\training_log.sqlite "$env:USERPROFILE\Downloads\garmin_ACTIVITY_ID_archive.json"
```

Replace `ACTIVITY_ID` with the ID in your downloaded filename. The database path must point to the same database each time. This command uses Python's standard library; it requires no packages or virtual environment. A repeat import updates the activity's current rows without duplicating them and retains distinct archive snapshots.

For example set analysis:

```sql
SELECT start_time_local, exercise_name, reps,
       ROUND(weight_lb, 1) AS weight_lb
FROM lifting_sets
WHERE exercise_category = 'DEADLIFT'
ORDER BY start_time_local, active_set_number;
```

## Project map

| Path | Purpose |
| --- | --- |
| `extension/` | PushPress conversion and Garmin archive panels/capture |
| `archive_tools/archive_to_sqlite.py` | Validates and imports finalized archives |
| `build.cjs` | Builds Garmin entry points with private helpers |
| `tests/` | Node and Python tests; synthetic fixtures only |
| `docs/technical-brief.md` | Concise portfolio technical description |
| `docs/portfolio-plan.md` | Proposed public page and subdomain |
| `START-HERE.md` | Detailed planned-workout instructions |
| `GARMIN-ARCHIVE.md` | Finalized-results workflow and database details |

## Development

Node.js 20+ and Python 3.10+:

```powershell
node build.cjs
node --test tests/*.test.cjs
py -m unittest discover -s tests -p "test_*.py"
```

After changing the Garmin source modules, rebuild and reload the extension. Garmin's page-context capture and isolated review UI each contain a private helper copy; they do not depend on a global shared across scripts.

CI rebuilds the bundles, checks for drift, and runs both test suites. Unit tests and DOM simulations do not replace testing in an actual browser or on the watch.

## Data and design boundaries

- Runs only on the PushPress Train and Garmin Connect websites.
- Passively reads matching workout/activity responses; it does not collect credentials or initiate API calls.
- Saves files only after user review and an export click. Captured browser data is otherwise held in tab memory.
- Uses corrected ACTIVE set records for reps and loaded volume. REST records and Garmin's original summary totals remain available separately.
- Preserves missing values, raw weight values, original exercise identifiers and self-evaluation scales.
- Links summary and exercise-set responses by Garmin activity ID; mismatched IDs are rejected.
- Supports optional program/cycle context. Automatic prescription-to-result matching is future work.
- Keeps personal activity exports, databases, local environment files and download folders out of version control.

All committed example workouts and activity fixtures are synthetic. The public portfolio page should use these examples, not the owner's private activity history or full paid programming.

## Limitations

CrossFit instructions are not uniformly structured. Straightforward prescriptions are translated with deterministic rules; complex ladders, partner alternation, and unusual scaling require review or manual edits. Unknown movements remain generic instructions. Timed blocks do not log each movement separately. The official API and any standard FIT export should not be assumed to expose post-sync edits.

Refresh Garmin after saving edits and before archiving: this version captures the latest page responses rather than fetching data on demand. SQLite ordering uses archive timestamps, so an old browser capture re-exported later could otherwise appear newer.

Future work: easier imports, broader workout parsing, movement-level strength tracking, a history viewer, and confirmed linking between prescriptions and results. No unattended sync, dashboard, or direct Garmin upload is implemented.

## License and attribution

MIT; see `LICENSE`. Exercise catalog mappings are adapted from [n1t3k/garmin-strength-api](https://github.com/n1t3k/garmin-strength-api); its notice is retained in `THIRD-PARTY-NOTICES.txt`. Garmin Workout Importer is a separate project and is not bundled here. Product names identify the systems involved; this project is not affiliated with them.
