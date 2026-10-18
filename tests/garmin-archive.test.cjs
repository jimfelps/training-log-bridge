const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../extension/garmin-archive.js');const A=global.PPG_ARCHIVE;
const summary=JSON.parse(fs.readFileSync(path.join(__dirname,'garmin-summary-fixture.json'),'utf8'));
const sets=JSON.parse(fs.readFileSync(path.join(__dirname,'garmin-sets-fixture.json'),'utf8'));
test('archive uses corrected active sets and preserves stale summary totals',()=>{
 const a=A.archive(summary,sets);assert.equal(a.activity_id,'1001001');assert.equal(a.totals.active_sets,7);assert.equal(a.totals.rest_records,7);assert.equal(a.totals.reps,20);assert.equal(a.totals.garmin_summary_reps,33);
 assert.equal(Math.round(a.totals.loaded_volume_lb),4020);assert(a.warnings.some(w=>/33 reps/.test(w)));assert.equal(a.activity.perceived_effort_raw,90);assert.match(a.activity.description,/grip failure/);
});
test('grams, missing sentinel, rest pairing, and partial sets survive',()=>{
 const a=A.archive(summary,sets);assert.equal(a.records[0].weight_kg,61.235);assert.equal(a.records[0].rest_after_seconds,114.93);
 assert.equal(a.records[1].weight_raw_grams,-1);assert.equal(a.records[1].weight_kg,null);
 assert.equal(a.records[8].reps,2);assert.equal(Math.round(a.records[8].weight_lb),235);
});
test('mismatched IDs rejected; workout ID and context preserved',()=>{
 assert.throws(()=>A.archive(summary,{...sets,activityId:123}),/different/);
 const s=structuredClone(summary);s.metadataDTO.associatedWorkoutId=456;
 const a=A.archive(s,sets,{provider:'PRVN',cycle:'Ares'});assert.equal(a.activity.associated_workout_id,'456');assert.equal(a.context.programming_provider,'PRVN');
});
test('summary snapshot excludes unrelated profile data',()=>{
 const s={...summary,userProfileId:99};s.metadataDTO={...s.metadataDTO,userInfoDto:{fullname:'SHOULD_NOT_COPY'}};
 assert(!JSON.stringify(A.sanitize('summary',s)).includes('SHOULD_NOT_COPY'));
});
test('CSV preserves all records and neutralizes spreadsheet formulas',()=>{
 const a=A.archive(summary,sets);a.records[0].exercise_name='=TEST()';const csv=A.csv(a);assert(csv.includes("'=TEST()"));assert.equal(csv.trim().split('\r\n').length,15);
});
test('missing active weight does not become a zero-load set',()=>{
 const modified=structuredClone(sets);modified.exerciseSets[0].weight=-1;
 const a=A.archive(summary,modified);assert.equal(a.totals.sets_with_weight_and_reps,6);assert(a.warnings.some(w=>/unset/.test(w)));
});
