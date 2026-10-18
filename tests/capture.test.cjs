const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../extension/capture.js'),'utf8');
const raw=JSON.parse(fs.readFileSync((process.env.PPG_FIXTURE||require('node:path').join(__dirname,'monday-fixture.json')),'utf8'));
function harness(){
 const messages=[],handlers={};
 class XHR{open(method,url){this.url=url;}send(){this.status=200;this.responseType='json';this.response=raw;this.load.call(this);}addEventListener(name,fn){this[name]=fn;}}
 const ctx={URL,Map,WeakMap,XMLHttpRequest:XHR,location:{href:'https://train.pushpress.com/home',origin:'https://train.pushpress.com'},
 fetch:async()=>({ok:true,clone:()=>({text:async()=>JSON.stringify(raw)})}),postMessage:m=>messages.push(m),addEventListener:(n,f)=>handlers[n]=f};
 ctx.window=ctx;ctx.__handlers=handlers;vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,messages,handlers};
}
test('fetch capture copies workout response and leaves response usable',async()=>{
 const {ctx,messages}=harness();
 const result=await ctx.fetch('https://trainapi.pushpress.com/workout/workoutOfDay/v1?date=10/19/2026&classTypeId=138682');
 await new Promise(r=>setImmediate(r));assert(result.ok);assert.equal(messages.length,1);
 assert.equal(messages[0].payload.days[0].partDtos.length,6);assert.equal(messages[0].payload.program,'138682');
 assert(!JSON.stringify(messages).includes('coachesNotes'));
});
test('XHR capture and cache replay work without reading headers',()=>{
 const {ctx,messages}=harness();const xhr=new ctx.XMLHttpRequest();
 xhr.open('GET','https://trainapi.pushpress.com/workout/workoutOfDay/v1?date=10/19/2026');xhr.send();assert.equal(messages.length,1);
 vm.runInContext("__handlers.message({source:window,origin:location.origin,data:{source:'ppg-ready-v1'}})",ctx);
 assert.equal(messages.length,2);
});
test('unrelated URLs and lookalike hosts are ignored',async()=>{
 const {ctx,messages}=harness();
 await ctx.fetch('https://trainapi.pushpress.com.attacker.test/workout/workoutOfDay/v1');
 await ctx.fetch('https://trainapi.pushpress.com/login');
 await new Promise(r=>setImmediate(r));assert.equal(messages.length,0);
});
test('credentials and extra response fields are never copied to messages',async()=>{
 const {ctx,messages}=harness();
 await ctx.fetch('https://trainapi.pushpress.com/workout/workoutOfDay/v1',{headers:{Authorization:'Bearer TEST_ONLY_SECRET'}});
 await new Promise(r=>setImmediate(r));assert(!JSON.stringify(messages).includes('TEST_ONLY_SECRET'));
});
