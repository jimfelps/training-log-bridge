/* Only reads successful workoutOfDay responses. Never reads headers or tokens. */
(() => {
  'use strict';
  const cache = new Map();
  const fields = ['workoutUid','workoutPartUid','title','workoutTitle','parentWorkoutTitle',
    'description','athletesNotes','scoreType','workoutType','sets','defaultReps','divisions','draft'];
  function target(raw) {
    try {
      const u = new URL(raw, location.href);
      return u.origin === 'https://trainapi.pushpress.com' &&
        u.pathname === '/workout/workoutOfDay/v1';
    } catch { return false; }
  }
  function send(payload) {
    window.postMessage({source:'ppg-workout-response-v1',payload}, location.origin);
  }
  function capture(raw, data) {
    if (!Array.isArray(data)) return;
    const u = new URL(raw, location.href);
    const days = data.filter(x => x && Array.isArray(x.partDtos)).map(x => ({
      publishingDate:x.publishingDate, workoutState:x.workoutState,
      classTypeDto:{id:x.classTypeDto?.id,name:x.classTypeDto?.name},
      partDtos:x.partDtos.map(p => Object.fromEntries(fields.filter(k =>
        p[k] !== undefined).map(k => [k,p[k]])))
    }));
    if (!days.length) return;
    const payload = {days,date:u.searchParams.get('date'),program:u.searchParams.get('classTypeId')};
    const key = payload.date+'|'+payload.program;
    cache.delete(key); cache.set(key,payload);
    if (cache.size>12) cache.delete(cache.keys().next().value);
    send(payload);
  }
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await Reflect.apply(originalFetch,this,args);
    const raw = typeof args[0] === 'string' || args[0] instanceof URL ? String(args[0]) : args[0]?.url;
    if (target(raw) && response.ok) {
      try {
        response.clone().text().then(t => {
          if (t.length<2000000) capture(raw,JSON.parse(t));
        }).catch(() => {});
      } catch { /* Leave the page response untouched. */ }
    }
    return response;
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  const requests = new WeakMap();
  XMLHttpRequest.prototype.open = function(method,url,...rest) {
    requests.set(this, target(String(url)) ? String(url) : null);
    return Reflect.apply(originalOpen,this,[method,url,...rest]);
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    if (requests.get(this)) this.addEventListener('load',function() {
      if (this.status<200 || this.status>=300) return;
      try {
        const data = this.responseType === 'json' ? this.response :
          (this.responseText.length<2000000 ? JSON.parse(this.responseText) : null);
        capture(requests.get(this),data);
      } catch { /* Non-JSON responses are ignored. */ }
    },{once:true});
    return Reflect.apply(originalSend,this,args);
  };
  window.addEventListener('message',e => {
    if (e.source===window && e.origin===location.origin && e.data?.source==='ppg-ready-v1') {
      for (const payload of cache.values()) send(payload);
    }
  });
})();
