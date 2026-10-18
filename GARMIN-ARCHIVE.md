# Garmin results archive • v0.2.1

The same extension now works on both PushPress and Garmin Connect. PushPress creates planned workouts; the Garmin panel archives completed results after you correct them. The working PushPress export remains available.

## Update the installed extension

1. Extract the updated ZIP.
2. Replace the files in your installed **extension** folder with the new extension files. Keep the folder path the same.
3. Open **edge://extensions** (or **chrome://extensions**) and click **Reload** on this extension. Confirm it shows **0.2.1**.
4. Open one of your completed activities in Garmin Connect and refresh. The extension also supports Garmin's newer /app/activity/ pages.
5. Click **Archive Garmin activity** in the bottom-right corner.

## Finalize and export

1. Record and sync your activity.
2. Edit the exercise names, repetitions and weights in Garmin Connect. Add activity notes and self-evaluation if you want them included. Save all edits.
3. **Refresh the activity page after saving.** This is important: this version passively captures the responses Garmin loads; it does not request a fresh copy itself or read login credentials. Editing and archiving without refreshing could export an earlier capture.
4. Open the archive panel and check the activity ID, date, sets, weights and notes. The panel shows when each response was captured.
5. Optionally add the programming provider, cycle, PushPress workout part ID, and an additional archive note. These fields affect your archive, not Garmin.
6. Check the confirmation that you saved, refreshed, and reviewed the finalized data.
7. Click **Archive finalized activity (JSON)**. Keep the downloaded file in a permanent training-history folder. It is separate from the Garmin-compatible workout JSON used to plan a session.
8. Optionally click **Download sets CSV** for analysis. CSV includes active and rest rows; filter set_type to ACTIVE for lifting sets.

The full JSON contains the corrected records, active-set totals, activity notes and metrics, associated workout ID when supplied, capture timestamps, optional program context, and snapshots of the source workout data. It omits unrelated account/profile data. Effort and feeling are preserved on Garmin's raw scales rather than guessed into per-set RPE.

These endpoints are captured, read-only:

- /gc-api/activity-service/activity/{activityId}
- /gc-api/activity-service/activity/{activityId}/exerciseSets

No authorization headers, cookies, passwords or tokens are accessed or saved. No network requests are initiated. No Garmin activity is changed. The browser page can see/interfere with MAIN-world capture code, as with any page-level capture extension; the tool does not establish a separate authenticated API integration.

## What to expect for the synthetic deadlift example

- Activity 1001001, Strength, January 16, 2026.
- Seven ACTIVE lifting sets and seven REST records.
- 20 corrected reps and approximately 4,020 lb of recorded-load volume.
- The 2-rep set at 235 lb remains included.
- Grip-change notes, average/max HR, training effects, load and self-evaluation are preserved.
- A warning explains that Garmin's summary says 33 reps while the corrected active sets total 20. The archive uses the active-set total, while retaining the reported summary value.
- Weight is read from this endpoint in grams and normalized to kg and lb. Missing (-1) weights remain unset, not zero. The exact normalized values can have tiny rounding differences from nominal whole-pound loads.
- Rest periods are preserved, including any recorded final rest. Rest after the final lifting set may include cleanup, not recovery for another set.

## Create your independent SQLite log (optional)

You can start by keeping JSON archives; the extension alone does not create a database. The included Python importer creates a portable SQLite file with no additional Python packages. Requires Python 3.10 or newer.

From PowerShell in the extracted **pushpress-garmin** package folder:

    py .\archive_tools\archive_to_sqlite.py --db .\training_log.sqlite "$env:USERPROFILE\Downloads\garmin_1001001_archive.json"

If your computer uses `python` instead of `py`, substitute that command. You can pass several archive filenames after the database option. Use quotes around paths with spaces.

Keep the SQLite file and downloaded JSON files in a permanent folder and back them up. Moving/updating/removing the browser extension does not affect these files.

What the importer does:

- Maintains one current activity per Garmin activity ID.
- Replaces that activity's set rows on an updated import, so corrections and removed sets are reflected without duplicates.
- Keeps each distinct imported JSON archive in **snapshots**, including earlier versions.
- If you import an older archive after a newer one, retains it as a snapshot but leaves the current results unchanged. Ordering uses the archive creation timestamp. This cannot detect a fresh archive made from stale browser data; refresh before exporting.
- Refuses conflicting contents with the same archive timestamp.
- Preserves optional programming-provider, cycle and PushPress ID fields. Linking to the prescription is manual in this version; an associated Garmin workout ID is stored when available but does not by itself establish the PushPress link.

Tables: **activities**, **exercise_records**, **snapshots**. The **lifting_sets** view joins current activities to ACTIVE set records. Activity-level metrics remain available in activity_json, and the full archived JSON is retained in archive_json.

Example SQLite query for continuous deadlift history:

    SELECT start_time_local, provider, cycle, active_set_number,
           exercise_name, reps, ROUND(weight_lb, 1) AS weight_lb
    FROM lifting_sets
    WHERE exercise_category = 'DEADLIFT'
    ORDER BY start_time_local, active_set_number;

This preserves exercise history regardless of programming provider. More movement normalization, PR classification, warm-up/working-set tags, and a dashboard can be added later; they are not inferred from a heavy weight alone.

## Troubleshooting

- **Waiting for summary/sets:** refresh the completed activity with the extension enabled. If necessary open the exercise section so Garmin requests the set data.
- You can also select the saved summary and exercise-set response files together using **Load saved summary and exercise-set responses** at the bottom of the panel. Confirm both belong to the same activity.
- The panel deliberately refuses to combine different activity IDs.
- Captures live only in the tab's memory, up to 12 activities. Refresh/close clears them. Context fields also need saving via JSON before leaving. A permanent archive exists only after you download the JSON or import it into SQLite.
- Self-evaluation, notes, workout linkage or metrics may be absent for other activities. Missing values remain null.
- Actual Garmin browser capture still needs a live test on your machine. Local capture, panel and export behavior was tested in simulations with synthetic fixturess; the tool does not claim a new live-account test.

## Developer tests

    node --test tests/*.test.cjs
    py -m unittest discover -s tests -p "test_*.py"

The Node checks use a lightweight DOM simulation, including the real browser's read-only input.list behavior. They are not a substitute for a browser rendering test.

## Version 0.2.1 fix

Garmin entry points now bundle a private copy of the archive helper instead of depending on a global shared between separate scripts. This addresses the undefined sanitize startup error. The tests run the actual bundled files without any preloaded helper. Developers: run `node build.cjs` after editing the Garmin source modules.
