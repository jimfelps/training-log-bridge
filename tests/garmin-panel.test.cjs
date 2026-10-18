const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const raw=JSON.parse(fs.readFileSync((process.env.PPG_FIXTURE||require('node:path').join(__dirname,'monday-fixture.json')),'utf8'));
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.classList={toggle(){}};this.style={};this.attributes={};if(tag==='input')Object.defineProperty(this,'list',{get:()=>null});}
 append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}setAttribute(k,v){this.attributes[k]=String(v);if(k!=='list')this[k]=v;}
 attachShadow(){this.shadow=new Element('shadow');return this.shadow;}remove(){}click(){for(const fn of this.listeners.click||[])fn({target:this});}
}
function all(node,tag){return [node,...node.children.flatMap(x=>x instanceof Element?all(x,tag):[])].filter(x=>x.tagName===tag);}

const summary=JSON.parse(fs.readFileSync(path.join(__dirname,'garmin-summary-fixture.json'),'utf8'));
const sets=JSON.parse(fs.readFileSync(path.join(__dirname,'garmin-sets-fixture.json'),'utf8'));
test('Garmin panel waits for both responses then exports finalized archive',()=>{
 const html=new Element('html'),listeners={};
 const ctx={console,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,setTimeout:()=>0,
 location:{origin:'https://connect.garmin.com',pathname:'/modern/activity/1001001'},
 document:{readyState:'complete',documentElement:html,createElement:t=>new Element(t),createTextNode:t=>({textContent:t})},
 addEventListener:(n,f)=>listeners[n]=f,postMessage(){}};ctx.window=ctx;vm.createContext(ctx);
 for(const f of ['garmin-panel.bundle.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),ctx);
 assert.equal(ctx.PPG_ARCHIVE,undefined);
 const root=html.children[0].shadow;
 function receive(kind,payload){ctx.payload=payload;ctx.kind=kind;vm.runInContext("this.evt={source:window,origin:location.origin,data:{source:'ppg-garmin-response-v1',payload:{kind,data:payload}}}",ctx);listeners.message(ctx.evt);}
 receive('summary',summary);assert.equal(all(root,'table').length,0);
 receive('sets',sets);assert.equal(all(root,'table').length,1);
 assert.equal(all(root,'tbody')[0].children.length,7);
 const button=all(root,'button').find(b=>b.textContent==='Archive finalized activity (JSON)');
 button.click();assert(all(root,'div').some(x=>String(x.textContent).includes('check the confirmation')));
 const review=all(root,'input').find(x=>x.type==='checkbox');review.checked=true;review.listeners.change[0]({target:review});
 button.click();assert(all(root,'div').some(x=>String(x.textContent).includes('Archive downloaded')));
});
