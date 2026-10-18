const test=require('node:test'),assert=require('node:assert/strict');
require('../extension/catalog.js');require('../extension/converter.js');
const P=global.PPG;
const fs=require('node:fs');
const raw=JSON.parse(fs.readFileSync((process.env.PPG_FIXTURE||require('node:path').join(__dirname,'monday-fixture.json')),'utf8'));
const day=P.normalize(raw)[0];
test('synthetic PushPress response: date, include WOD, exclude optional work',()=>{
 assert.equal(day.date,'2026-01-19');
 assert.deepEqual(day.parts.filter(p=>P.selection(p).include).map(p=>p.title),['Strength: Front Squat','Partner AMRAP 7']);
});
test('strength fixed interval preserves 4-minute timing and both movements',()=>{
 const part=day.parts[1],d=P.draft(part);
 assert.equal(d.repeat,5);assert.equal(d.rows.length,1);assert.equal(d.rows[0].value,240);
 assert.match(d.rows[0].note,/Turkish Get-Ups/);
 const w=P.exportWorkout(part,day.date,d.rows,d.repeat);
 assert.equal(w.workoutSegments[0].workoutSteps[0].numberOfIterations,5);
 assert.equal(w.workoutSegments[0].workoutSteps[0].workoutSteps[0].endConditionValue,240);
});
test('AMRAP title conflict: written six-minute duration wins',()=>{
 const d=P.draft(day.parts[2]);assert.equal(d.rows[0].value,360);
 assert(d.warnings.some(w=>/differ/.test(w)));assert.match(d.rows[0].note,/20 Single-Unders/);
});
test('scaling finds multiline Level 1 and refuses absent levels',()=>{
 const p={...day.parts[1],body:'Base',notes:'Level 1:\n5 Goblet Squats\nLevel 2:\n5 Front Squats'};
 assert.equal(P.scaling(p,'Level 1').body,'5 Goblet Squats');
 assert.throws(()=>P.scaling(p,'Competitor'),/No Competitor/);
});
test('Nancy: five rounds, meters, overhead squat reps, caps are explicit',()=>{
 const p={title:'Nancy',structure:'5 Rounds For Time',body:'400 meter Run\n15 Overhead Squats (95/65 lb)\n\nTime Cap: 20:00',notes:''};
 const d=P.draft(p);assert.equal(d.repeat,5);assert.equal(d.rows[0].condition,'distance');assert.equal(d.rows[0].value,400);
 assert.equal(d.rows[1].exercise,'OVERHEAD_SQUAT');assert.equal(d.rows[1].value,15);assert.equal(d.rows[1].weight,null);
 assert(d.warnings.some(w=>/time cap/.test(w)));
 const out=P.exportWorkout(p,'2026-01-19',d.rows,d.repeat);
 assert.deepEqual(out.workoutSegments[0].workoutSteps[0].workoutSteps.map(s=>s.stepOrder),[2,3]);
});
test('per-side and ambiguous alternative repetitions handled differently',()=>{
 const d=P.draft({title:'Test',structure:'',body:'2/2 Turkish Get-Ups\n5/3 Push-Ups',notes:''},'steps');
 assert.equal(d.rows[0].value,4);assert.equal(d.rows[1].value,5);assert(d.warnings.some(w=>/Alternative/.test(w)));
});
test('reject invalid reps, mapping, repeat, and weights',()=>{
 const p=day.parts[1];
 const r={note:'test',condition:'reps',value:2,exercise:'',weight:null};
 assert.throws(()=>P.exportWorkout(p,day.date,[{...r,value:2.5}]),/whole/);
 assert.throws(()=>P.exportWorkout(p,day.date,[{...r,exercise:'MADE_UP'}]),/listed/);
 assert.throws(()=>P.exportWorkout(p,day.date,[r],0),/Repeat/);
 assert.throws(()=>P.exportWorkout(p,day.date,[{...r,weight:10}]),/exercise/);
 assert.throws(()=>P.exportWorkout(p,day.date,[{...r,value:Infinity}]),/positive/);
});
test('catalog mappings have correct section even with Selected headings',()=>{
 assert.equal(global.PPG_CATALOG.PLANK,'PLANK');assert.equal(global.PPG_CATALOG.BARBELL_BICEPS_CURL,'CURL');
});
test('malformed raw input fails clearly',()=>{assert.throws(()=>P.normalize({foo:'bar'}),/partDtos/);});

test('inline bullet scaling and explicit open-block mode',()=>{
 const p=day.parts[1];const scaled=P.scaling(p,'Level 1');assert.match(scaled.body,/Goblet Squats/);
 const d=P.draft(day.parts[2],'block');assert.equal(d.rows[0].condition,'lap');
});
