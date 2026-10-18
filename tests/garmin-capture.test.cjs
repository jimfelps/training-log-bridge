const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const sets=JSON.parse(fs.readFileSync(path.join(__dirname,'garmin-sets-fixture.json'),'utf8'));
const summary=JSON.parse(fs.readFileSync(path.join(__dirname,'garmin-summary-fixture.json'),'utf8'));
function harness(){
 const messages=[],handlers={};class XHR{open(method,url){this.url=url;}send(){this.status=200;this.responseType='json';this.response=sets;this.load.call(this);}addEventListener(n,f){this[n]=f;}}
 const ctx={URL,Map,WeakMap,Date,XMLHttpRequest:XHR,location:{origin:'https://connect.garmin.com',href:'https://connect.garmin.com/modern/activity/1001001'},
 fetch:async raw=>({ok:true,clone:()=>({text:async()=>JSON.stringify(String(raw).includes('exerciseSets')?sets:summary)})}),
 postMessage:p=>messages.push(p),addEventListener:(n,f)=>handlers[n]=f};ctx.window=ctx;ctx.__handlers=handlers;vm.createContext(ctx);
 for(const f of ['garmin-capture.bundle.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),ctx);
 assert.equal(ctx.PPG_ARCHIVE,undefined);
 return {ctx,messages};
}
test('captures exact summary and set endpoints and replays both',async()=>{
 const {ctx,messages}=harness(),base='https://connect.garmin.com/gc-api/activity-service/activity/1001001';
 await ctx.fetch(base);await ctx.fetch(base+'/exerciseSets');await new Promise(r=>setImmediate(r));
 assert.deepEqual(messages.map(m=>m.payload.kind),['summary','sets']);assert.equal(messages[0].payload.data.activityId,'1001001');
 vm.runInContext("__handlers.message({source:window,origin:location.origin,data:{source:'ppg-garmin-ready-v1'}})",ctx);assert.equal(messages.length,4);
});
test('ignores workouts, unrelated hosts, details and mismatched response IDs',async()=>{
 const {ctx,messages}=harness();for(const u of ['https://connect.garmin.com/gc-api/workout-service/workout/123','https://attacker.test/gc-api/activity-service/activity/1001001','https://connect.garmin.com/gc-api/activity-service/activity/1001001/details','https://connect.garmin.com/gc-api/activity-service/activity/123'])await ctx.fetch(u);
 await new Promise(r=>setImmediate(r));assert.equal(messages.length,0);
});
test('captures XHR set response without collecting authorization',()=>{
 const {ctx,messages}=harness(),x=new ctx.XMLHttpRequest();x.open('GET','https://connect.garmin.com/gc-api/activity-service/activity/1001001/exerciseSets');x.send();assert.equal(messages.length,1);assert.equal(messages[0].payload.kind,'sets');
});
