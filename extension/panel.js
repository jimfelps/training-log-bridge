(() => {
  'use strict';
  const P=globalThis.PPG;
  const captured=new Map();
  let active='',state=[],host,root,main,select,status;
  const el=(tag,props={},...children)=>{
    const node=document.createElement(tag);
    for(const [key,value] of Object.entries(props)) {
      if(key.startsWith('on'))node.addEventListener(key.slice(2),value);
      else if(key==='text')node.textContent=value;
      // HTMLInputElement.list is a getter; its association is set by attribute.
      else if(key==='list')node.setAttribute(key,value);
      else if(key in node)node[key]=value;
      else node.setAttribute(key,value);
    }
    for(const child of children)if(child!==null&&child!==undefined)node.append(typeof child==='string'?document.createTextNode(child):child);
    return node;
  };
  const button=(label,fn,cls='')=>el('button',{text:label,onclick:fn,className:cls,type:'button'});
  function message(s,error=false){status.textContent=s;status.className=error?'status error':'status';}
  function download(obj,name) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'}));
    const a=el('a',{href:url,download:name});root.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function ingest(raw) {
    const days=P.normalize(raw);
    for(const day of days) {
      const key=day.date+' | '+day.program;
      captured.delete(key);captured.set(key,day);
      if(captured.size>12)captured.delete(captured.keys().next().value);
      active=key;
    }
    if(root) {
      updateSelect();loadDay();
      message('Captured '+days.length+' day(s). Review selection, instructions, and export.');
    }
  }
  function updateSelect(){
    select.replaceChildren(...[...captured.keys()].map(k=>el('option',{value:k,text:k})));
    select.value=active;
  }
  function loadDay(){
    const day=captured.get(active);
    state=(day?.parts||[]).map(p=>({part:{...p},original:{...p},...P.selection(p),mode:'auto',plan:P.draft(p),reviewed:false}));
    render();
  }
  function render(){
    main.replaceChildren();
    if(!state.length){main.append(el('div',{className:'empty'},el('h2',{text:'Open a workout to get started'}),el('p',{text:'Refresh PushPress after installing, then open Today’s Workout or change dates. Workouts appear here as the page loads them.'}),el('p',{text:'You can also load a saved raw response below. No login tokens or API keys are needed.'})));return;}
    for(const entry of state)main.append(card(entry));
  }
  function field(label,input){return el('label',{className:'field'},el('span',{text:label}),input);}
  function card(s){
    const c=el('section',{className:'card'+(s.include?'':' skipped')});
    const include=el('input',{type:'checkbox',checked:s.include,onchange:e=>{s.include=e.target.checked;s.reviewed=false;c.classList.toggle('skipped',!s.include);}});
    c.append(el('label',{className:'title'},include,el('strong',{text:s.part.title})),el('p',{className:'hint',text:s.reason}));
    let sourceDirty=false;
    const details=el('details',{open:s.include});c.append(details);
    details.append(el('summary',{text:'Review & edit'}));
    const title=el('input',{value:s.part.title,oninput:e=>{s.part.title=e.target.value;s.reviewed=false;}});
    const structure=el('input',{value:s.part.structure});
    const body=el('textarea',{value:s.part.body,rows:7});
    const notes=el('textarea',{value:s.part.notes,rows:4});
    const scaling=el('select',{},...['As written','Level 1','Level 2','Masters 55+','Competitor','Hotel Gym / Travel'].map(x=>el('option',{text:x,value:x})));
    const scaleButton=button('Apply scaling',()=>{
      try{const result=P.scaling(s.original,scaling.value);body.value=result.body;structure.value=result.structure;rebuild();}
      catch(e){message(e.message,true);}
    });
    const mode=el('select',{value:s.mode},el('option',{value:'auto',text:'Auto: timed blocks where available'}),el('option',{value:'steps',text:'Movement steps (manual advance)'}),el('option',{value:'block',text:'One open block with notes'}));mode.value=s.mode;
    details.append(field('Workout name',title),field('Structure / interval',structure),el('div',{className:'scale'},field('Scaling',scaling),scaleButton),field('Workout instructions',body),el('details',{},el('summary',{text:'Coaching / loading notes'}),notes),field('Watch behavior',mode));
    const editor=el('div');
    const reviewed=el('input',{type:'checkbox',checked:s.reviewed,onchange:e=>{s.reviewed=e.target.checked;}});
    function resetReview(){s.reviewed=false;reviewed.checked=false;}
    title.addEventListener('input',resetReview);
    function rebuild(){
      s.part.title=title.value;s.part.structure=structure.value;s.part.body=body.value;s.part.notes=notes.value;s.mode=mode.value;
      s.plan=P.draft(s.part,s.mode);sourceDirty=false;resetReview();drawEditor();
    }
    for(const input of [structure,body,notes])input.addEventListener('input',()=>{sourceDirty=true;resetReview();exportButton.disabled=true;exportButton.title='Rebuild steps after changing source instructions.';});
    mode.addEventListener('change',rebuild);
    details.append(button('Rebuild steps from edited text',rebuild),editor);
    const exportButton=button('Download Garmin JSON',()=>{
      try {
        if(!s.include)throw Error('Select this section before exporting.');
        if(!s.reviewed)throw Error('Review the steps and check “I reviewed this export” first.');
        const day=captured.get(active);
        const out=P.exportWorkout(s.part,day.date,s.plan.rows,Number(s.plan.repeat));
        download(out,(day.date+'_'+s.part.title).replace(/[^a-z0-9_-]+/gi,'_').slice(0,110)+'.json');
        message('Downloaded '+s.part.title+'. Import this file using Garmin Workout Importer, then send it to your watch.');
      }catch(e){message(e.message,true);}
    },'primary');
    details.append(el('label',{className:'review'},reviewed,'I reviewed this export, including timing and generic movements.'),exportButton);
    function drawEditor(){
      exportButton.disabled=sourceDirty;exportButton.title=sourceDirty?'Rebuild steps after changing source instructions.':'';
      editor.replaceChildren(el('p',{className:'hint',text:s.plan.explanation}));
      if(s.plan.warnings.length)editor.append(el('ul',{className:'warnings'},...s.plan.warnings.map(w=>el('li',{text:w}))));
      const repeat=el('input',{type:'number',min:1,max:99,step:1,value:s.plan.repeat,oninput:e=>{s.plan.repeat=Number(e.target.value);resetReview();}});
      editor.append(field('Repeat entire sequence',repeat));
      s.plan.rows.forEach((r,i)=>{
        const row=el('div',{className:'step'});
        const note=el('textarea',{value:r.note,rows:2,oninput:e=>{r.note=e.target.value;resetReview();}});
        const condition=el('select',{},...Object.entries({reps:'Repetitions',time:'Time (seconds)',distance:'Distance (meters)',lap:'Open / lap button',rest:'Rest (seconds)'}).map(([value,text])=>el('option',{value,text})));condition.value=r.condition;
        const value=el('input',{type:'number',min:0,step:'any',value:r.value??'',disabled:r.condition==='lap',oninput:e=>{r.value=e.target.value;resetReview();}});
        condition.addEventListener('change',e=>{r.condition=e.target.value;value.disabled=r.condition==='lap';resetReview();});
        const exercise=el('input',{value:r.exercise,list:'ppg-exercises',placeholder:'Generic step — movement in notes',oninput:e=>{r.exercise=e.target.value.trim();resetReview();}});
        const weight=el('input',{type:'number',min:0,step:'any',value:r.weight??'',placeholder:'Unset',oninput:e=>{r.weight=e.target.value;resetReview();}});
        const actions=el('div',{className:'actions'},el('strong',{text:'Step '+(i+1)}),button('↑',()=>{if(i){[s.plan.rows[i-1],s.plan.rows[i]]=[r,s.plan.rows[i-1]];resetReview();drawEditor();}}),button('↓',()=>{if(i<s.plan.rows.length-1){[s.plan.rows[i+1],s.plan.rows[i]]=[r,s.plan.rows[i+1]];resetReview();drawEditor();}}),button('Remove',()=>{s.plan.rows.splice(i,1);resetReview();drawEditor();}));
        row.append(actions,field('Movement / instructions shown in step notes',note),el('div',{className:'grid'},field('Finish step by',condition),field('Value',value)),field('Garmin exercise (optional; choose from list)',exercise),field('Weight in kg (optional)',weight));editor.append(row);
      });
      editor.append(button('+ Add step',()=>{s.plan.rows.push({note:'',condition:'lap',value:null,exercise:'',weight:null});resetReview();drawEditor();}));
    }
    drawEditor();return c;
  }
  function mount(){
    if(host)return;
    host=el('div',{id:'ppg-export-root'});host.style.cssText='position:fixed;z-index:2147483646;bottom:20px;right:20px;';
    root=host.attachShadow({mode:'closed'});
    root.append(el('style',{text:`
      :host{all:initial;font-family:system-ui,sans-serif;font-size:14px;color:#16243a}
      *{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer;border:1px solid #c3cbd8;border-radius:8px;background:#fff;padding:8px 12px;color:#16243a}button:hover{background:#edf3fb}button:disabled{opacity:.5;cursor:not-allowed}
      .launcher,.primary{background:#143b70;color:white;border:0}.launcher:hover,.primary:hover{background:#225393}.launcher{box-shadow:0 4px 20px #0003;padding:12px 18px}
      .panel{position:fixed;right:20px;top:20px;bottom:20px;width:min(620px,calc(100vw - 32px));background:#f3f6fa;box-shadow:0 12px 60px #0005;border-radius:14px;border:1px solid #cbd5e1;display:flex;flex-direction:column;overflow:hidden}.panel[hidden]{display:none}
      header{background:#143b70;color:#fff;padding:18px;display:flex;justify-content:space-between;align-items:center}h1{font-size:18px;margin:0}header small{display:block;color:#d7e5fa;margin-top:5px}header button{padding:5px 10px}
      .toolbar{padding:12px 18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.toolbar select{flex:1;min-width:170px}.status{padding:10px 18px;background:#e6eefb;line-height:1.5}.error{background:#ffe7e2;color:#8d2719}.content{overflow:auto;padding:16px;flex:1;min-height:0}
      .card{border:1px solid #cbd5e1;border-radius:12px;background:white;margin-bottom:14px;padding:16px}.skipped{background:#f9fafb}.title{display:flex;gap:10px;align-items:center;font-size:16px}.hint{font-size:13px;line-height:1.5;color:#50637c}.field{display:block;margin:12px 0}.field>span{display:block;font-size:12px;font-weight:650;margin-bottom:5px}input:not([type=checkbox]),select,textarea{width:100%;border:1px solid #b8c5d7;padding:8px;border-radius:6px;background:white;color:#16243a}textarea{resize:vertical;line-height:1.45}input[type=checkbox]{width:17px;height:17px;accent-color:#143b70}summary{cursor:pointer;font-weight:600;padding:8px 0}.scale{display:flex;gap:10px;align-items:center}.scale>.field{flex:1}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.step{border:1px solid #d7e0ec;border-left:3px solid #3a6cad;border-radius:8px;padding:12px;margin:10px 0}.actions{display:flex;gap:6px;align-items:center}.actions strong{flex:1}.actions button{padding:3px 8px}.warnings{background:#fff3d6;padding:14px 14px 14px 32px;border-radius:8px;font-size:13px;line-height:1.5}.warnings li+li{margin-top:6px}.review{display:flex;gap:8px;align-items:flex-start;margin:16px 0;font-size:13px}.empty{padding:18px;line-height:1.6}footer{padding:10px 18px;font-size:12px;color:#53657b;border-top:1px solid #d8e1ec}footer details textarea{margin:8px 0}.file{font-size:12px} .import-row{display:flex;gap:8px;margin-top:8px}
    `}));
    const panel=el('div',{className:'panel',hidden:true});
    const launcher=button('Workouts → Garmin',()=>{panel.hidden=!panel.hidden;},'launcher');
    select=el('select',{'aria-label':'Captured workout date',onchange:e=>{active=e.target.value;loadDay();message('Reviewing '+active);}});
    status=el('div',{className:'status',text:'Waiting for a workout response. Refresh PushPress, then open a workout date.'});
    main=el('div',{className:'content'});
    const file=el('input',{type:'file',accept:'.json,.txt,application/json',className:'file',onchange:async e=>{
      try{const f=e.target.files[0];if(!f)return;if(f.size>2000000)throw Error('Choose a response file smaller than 2 MB.');ingest(JSON.parse(await f.text()));panel.hidden=false;}
      catch(err){message(err.message,true);}finally{e.target.value='';}
    }});
    const paste=el('textarea',{rows:3,placeholder:'Paste the raw workout response JSON only.'});
    const footer=el('footer',{},'Local only • No tokens collected • Nothing sent to Garmin automatically',el('details',{},el('summary',{text:'Load saved response / paste JSON'}),file,paste,el('div',{className:'import-row'},button('Load pasted JSON',()=>{try{if(paste.value.length>2000000)throw Error('Response is too large.');ingest(JSON.parse(paste.value));paste.value='';}catch(e){message(e.message,true);}}))));
    panel.append(el('header',{},el('div',{},el('h1',{text:'PushPress → Garmin'}),el('small',{text:'Review your session. Export when ready.'})),button('Close',()=>{panel.hidden=true;})),el('div',{className:'toolbar'},select,button('Clear',()=>{captured.clear();active='';state=[];updateSelect();render();message('Cleared captured workouts. Change dates to capture again.');})),status,main,footer);
    root.append(launcher,panel,el('datalist',{id:'ppg-exercises'},...Object.keys(globalThis.PPG_CATALOG).sort().map(x=>el('option',{value:x}))));
    document.documentElement.append(host);updateSelect();loadDay();
  }
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.source!=='ppg-workout-response-v1')return;
    try{ingest(e.data.payload.days);}catch(err){if(status)message(err.message,true);}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.postMessage({source:'ppg-ready-v1'},location.origin);
})();
