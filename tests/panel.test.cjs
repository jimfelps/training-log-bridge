const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const raw=JSON.parse(fs.readFileSync((process.env.PPG_FIXTURE||require('node:path').join(__dirname,'monday-fixture.json')),'utf8'));
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.classList={toggle(){}};this.style={};this.attributes={};if(tag==='input')Object.defineProperty(this,'list',{get:()=>null});}
 append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}setAttribute(k,v){this.attributes[k]=String(v);if(k!=='list')this[k]=v;}
 attachShadow(){this.shadow=new Element('shadow');return this.shadow;}remove(){}click(){for(const fn of this.listeners.click||[])fn({target:this});}
}
function all(node,tag){return [node,...node.children.flatMap(x=>x instanceof Element?all(x,tag):[])].filter(x=>x.tagName===tag);}
test('panel mounts, renders captured sections and exports a reviewed workout',()=>{
 const html=new Element('html'),listeners={},downloads=[];
 const ctx={console,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,setTimeout:()=>0,
  location:{origin:'https://train.pushpress.com'},document:{readyState:'complete',documentElement:html,createElement:t=>new Element(t),createTextNode:t=>({textContent:t})},
  addEventListener:(name,fn)=>listeners[name]=fn,postMessage(){}};
 ctx.window=ctx;vm.createContext(ctx);
 for(const f of ['catalog.js','converter.js','panel.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),ctx);
 assert.equal(html.children.length,1);const root=html.children[0].shadow;
 ctx.payload=raw;
 vm.runInContext("this.testEvent={source:window,origin:location.origin,data:{source:'ppg-workout-response-v1',payload:{days:payload}}}",ctx);
 listeners.message(ctx.testEvent);
 assert.equal(all(root,'section').length,6);
 assert(all(root,'input').some(x=>x.attributes.list==='ppg-exercises'));
 assert.equal(all(root,'section').filter(s=>!s.className.includes('skipped')).length,2);
 const card=all(root,'section')[1];
 const review=all(card,'input').filter(x=>x.type==='checkbox')[1];
 review.checked=true;review.listeners.change[0]({target:review});
 const exportButton=all(card,'button').find(b=>b.textContent==='Download Garmin JSON');
 exportButton.click();assert(all(root,'div').some(x=>String(x.textContent).includes('Downloaded Strength: Front Squat')));
});
