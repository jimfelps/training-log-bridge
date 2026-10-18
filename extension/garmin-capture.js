/* Passive capture on connect.garmin.com: no tokens, headers, or additional API calls. */
(() => {
  'use strict';
  const A=globalThis.PPG_ARCHIVE,cache=new Map();
  function target(raw){
    try{
      const u=new URL(raw,location.href);
      if(u.origin!==location.origin||u.origin!=='https://connect.garmin.com')return null;
      const m=u.pathname.match(/^\/gc-api\/activity-service\/activity\/(\d+)(\/exerciseSets)?\/?$/);
      return m?{id:m[1],kind:m[2]?'sets':'summary'}:null;
    }catch{return null;}
  }
  function send(payload){window.postMessage({source:'ppg-garmin-response-v1',payload},location.origin);}
  function receive(t,data){
    try{
      const value=A.sanitize(t.kind,data);if(value.activityId!==t.id)return;
      const payload={kind:t.kind,activityId:t.id,data:value,receivedAt:new Date().toISOString()};
      const key=t.id+'|'+t.kind;cache.delete(key);cache.set(key,payload);
      while(cache.size>24)cache.delete(cache.keys().next().value);
      send(payload);
    }catch{/* Unrelated shapes and errors never interrupt Garmin. */}
  }
  const originalFetch=window.fetch;
  window.fetch=async function(...args){
    const response=await Reflect.apply(originalFetch,this,args);
    const raw=typeof args[0]==='string'||args[0] instanceof URL?String(args[0]):args[0]?.url;
    const t=target(raw);
    if(t&&response.ok){try{response.clone().text().then(s=>{if(s.length<5000000)receive(t,JSON.parse(s));}).catch(()=>{});}catch{}}
    return response;
  };
  const originalOpen=XMLHttpRequest.prototype.open,originalSend=XMLHttpRequest.prototype.send,requests=new WeakMap();
  XMLHttpRequest.prototype.open=function(method,url,...rest){requests.set(this,target(String(url)));return Reflect.apply(originalOpen,this,[method,url,...rest]);};
  XMLHttpRequest.prototype.send=function(...args){
    const t=requests.get(this);
    if(t)this.addEventListener('load',function(){
      if(this.status<200||this.status>=300)return;
      try{const d=this.responseType==='json'?this.response:(this.responseText.length<5000000?JSON.parse(this.responseText):null);receive(t,d);}catch{}
    },{once:true});
    return Reflect.apply(originalSend,this,args);
  };
  window.addEventListener('message',e=>{
    if(e.source===window&&e.origin===location.origin&&e.data?.source==='ppg-garmin-ready-v1')for(const p of cache.values())send(p);
  });
})();
