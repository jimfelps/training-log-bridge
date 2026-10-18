# PushPress → Garmin • v0.2.1

**New in v0.2:** Garmin Connect completed-activity archiving. See **GARMIN-ARCHIVE.md** for JSON/CSV exports and the optional SQLite log.

A local browser extension for Chrome and Microsoft Edge. No build tools, AI account, API key, or copied login token required.

## Install (Windows)

1. Extract the downloaded ZIP to a folder you intend to keep, such as Documents\PushPress-Garmin.
2. In Edge open **edge://extensions**. In Chrome open **chrome://extensions**.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the **extension** folder inside the extracted package. This is the folder containing manifest.json. Do not select the ZIP or the outer folder.
5. Open https://train.pushpress.com/home and refresh the page after installation.
6. Open Today's Workout, then select a workout date. A **Workouts → Garmin** button appears at the lower right.

Keep the extracted folder in place. To install an update, replace these files and click Reload on the extension's card, then refresh PushPress.

## First test

1. Click **Workouts → Garmin**.
2. Choose the captured date. Strength and conditioning are selected by default. Announcements, PRVN Reset, accessory work, and weekly challenges are unchecked.
3. Open each wanted section's **Review & edit** panel.
4. Review its instructions, scaling, timing, and warnings. Choose a scaling option and click **Apply scaling** if applicable. You can directly edit the workout instructions and notes, then click **Rebuild steps from edited text**.
5. Select a watch behavior:
   - **Auto**: AMRAPs and build-to-a-max sessions become one timed block. “Every 4:00 × 5” becomes five four-minute blocks, with movements in each block's notes. No button presses between movements inside these blocks, but individual exercise reps/sets are not logged separately.
   - **Movement steps**: attempts to split straightforward movement lines into rep, time, or distance steps. Expect manual lap/set presses. Complex ladders, EMOMs, partner alternation, and fixed-interval remainder rests need manual review/editing. An AMRAP uses 20 surplus cycles; stop at the class time, not after all 20 cycles.
   - **One open block**: instructions in notes; finish with the lap/set button.
6. Edit individual steps as needed. Set repeats, add/remove/reorder steps, choose a Garmin exercise mapping, and optionally set weights **in kilograms**. Leave weight blank if it will be chosen in class. To convert pounds, divide by 2.20462.
7. Check **I reviewed this export**. Click **Download Garmin JSON** for that section. Repeat for the other wanted section(s). Selections do not batch-download; each section has its own export button.
8. On https://connect.garmin.com use the existing **Garmin Workout Importer** extension (https://github.com/estruyf/garmin-workout-browser-extension) to import the downloaded JSON. Its JSON import is needed; the cycling editor/chart may not meaningfully show strength workouts. Avoid using its cycling editor to modify these files.
9. Inspect the saved workout in Garmin Connect, choose **Send to Device**, and sync the Instinct. These exports use the Strength workout type, including timed conditioning blocks, so look under Strength on the watch.

## Monday, January 19 example

Expected selections:
- Included: Strength: Front Squat; Partner AMRAP 7.
- Unchecked: ANNOUNCEMENT; PRVN Reset; Accessory Finisher; Demo Challenge (Weekly Challenge #3).

The partner workout's title says 7 but its body says **6:00 AMRAP**. Auto mode uses six minutes and flags the mismatch. “General Warm Up” is flagged but does not exclude it. The converter never infers another day's WOD from the weekly announcement.

The strength workout is **5 Front Squats at 65–70%, followed by 2/2 Turkish Get-Ups, every 4:00 for five sets**. Auto mode exports five four-minute blocks. Tempo, scaling, and full loading notes remain in the workout description; verify notes on the watch before training.

## If nothing is captured

- Refresh PushPress with the extension enabled, then switch workout dates. It only sees responses received after installation/refresh.
- It listens to fetch and XMLHttpRequest for the exact trainapi.pushpress.com/workout/workoutOfDay/v1 endpoint. If PushPress changes that endpoint or sends requests from a worker, automatic capture may need an update.
- Open **Load saved response / paste JSON** at the bottom of the panel and choose your Copy response text/JSON file. This is also a way to test without another network capture.
- The package includes tests/monday-fixture.json, a synthetic example for testing the file loader.
- There is no need to share or paste an Authorization header.

## Limits of this first version

- Tested in local simulations with synthetic fixtures and the importer's JSON normalizer. Live PushPress browser capture, actual Garmin server acceptance, and Instinct display are not yet verified. Start with one workout.
- This is a deterministic parser with manual editing, not an AI that understands every CrossFit prescription. It preserves unparsed instructions as generic open steps and flags them. Review any complex sequence.
- Scaling is extracted from named text blocks. Some descriptions put alternatives inline or repeat notes; review the resulting text. Male/female alternatives use the first value with a warning; edit to your actual prescription. Recognized per-side get-ups sum both sides.
- Unsupported exercise names remain generic, with the actual movement written in the step notes. You can choose a listed Garmin movement if appropriate. This is not a complete Garmin exercise catalog.
- Auto timed blocks do not produce movement-level rep tracking. Step mode does not enforce an overall time cap or AMRAP stop; use the class clock.
- Step descriptions are limited to 1,000 characters and workout descriptions to 7,000. Keep essential instructions near the top. This exporter uses at most 49 editable steps plus a repeat wrapper.
- Captures and edits exist only in the open tab's memory (up to 12 captured day/program entries). Refresh/close clears them; selecting another date or recapturing a date rebuilds the editor and clears unsaved edits. Download before changing dates.
- No unattended scheduling, automatic Garmin upload, or automatic watch sync yet. Completed Garmin activities can now be archived; see GARMIN-ARCHIVE.md.

## Privacy and permissions

The planned-workout scripts run on train.pushpress.com. Separate archive scripts now run on connect.garmin.com; see GARMIN-ARCHIVE.md. It clones successful workout responses and passes selected workout fields to its review panel. It never reads or stores Authorization headers, cookies, passwords, or login tokens, makes no additional API calls, and sends no data to third-party services. JSON downloads happen only when you click a section's export button. It cannot bypass membership access or retrieve unpublished workouts.

## Developer checks

Node.js 20+ is sufficient. From this package folder:

    node --test tests/*.test.cjs

Source files are plain JavaScript; no compilation or npm installation required. Capture uses Manifest V3 content scripts in MAIN and ISOLATED worlds at document_start. Reference: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts

The Garmin payload shape was checked against the JSON normalizer in https://github.com/estruyf/garmin-workout-browser-extension. Exercise identifiers and category mappings are adapted from https://github.com/n1t3k/garmin-strength-api under its MIT license (see THIRD-PARTY-NOTICES.txt). No affiliation with PushPress or Garmin.

## Version 0.1.1 fix

Fixed the exercise selector rendering error caused by assigning to the read-only HTMLInputElement.list property. The selector now uses the list attribute. The panel regression test reproduces the browser getter behavior.
