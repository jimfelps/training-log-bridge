# Training Log Bridge — technical brief

Training Log Bridge connects planned CrossFit programming to watch-guided workouts and a portable record of completed training. It uses a Manifest V3 browser extension, JavaScript transformation rules, and a Python/SQLite archive.

On PushPress Train, page-context scripts observe successful workout responses from fetch and XMLHttpRequest. Selected workout fields are passed to an isolated review panel without collecting authentication headers or tokens. The user selects workout sections and scaling, edits ambiguous instructions, and exports Garmin-compatible JSON for a separate importer. Timed blocks and movement steps offer different tradeoffs between workout guidance and button presses.

On Garmin Connect, the extension captures the activity summary and exercise-set responses after the user saves corrections and refreshes the activity. It joins them by activity ID and retains sets, rest periods, notes, self-evaluation, training metrics and any supplied workout link. A reviewed export produces a combined JSON archive; CSV supports set-level analysis.

The transformation handles differences between recorded and corrected data. Reps and loaded volume are calculated from ACTIVE set records, while REST records and Garmin's reported summary totals are preserved separately. Missing weights remain missing; the captured weight scale is normalized from grams to kilograms and pounds. Source snapshots and raw values support later checks and reprocessing.

A standard-library Python importer writes the archive to SQLite. Each Garmin activity has one current record and ordered set rows; revised imports replace those rows transactionally. Distinct archives remain in a snapshot table, and older archives do not overwrite newer current results. A view exposes lifting history across optional programming-provider and cycle labels.

The workflow has been validated through workout conversion, Garmin import, watch sync, activity export and database import. Automated checks cover capture filtering, parsing, unit conversion, UI behavior, mismatched IDs, duplicate imports and revised records. Public examples use synthetic data. Current limits include undocumented interfaces, user-reviewed complex prescriptions, manual refresh/export/import, and no automatic link between the original prescription and completed activity.
