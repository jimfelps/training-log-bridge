(() => {
  'use strict';
  const SPORT = {sportTypeId:5,sportTypeKey:'strength_training',displayOrder:5};
  const str = x => typeof x==='string' ? x : '';
  const text = s => str(s).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
  function normalize(data) {
    const days=Array.isArray(data)?data:[data];
    if (!days.length || days.length>60) throw Error('Expected a PushPress workout response containing 1–60 days.');
    return days.map(day => {
      if (!day || !Array.isArray(day.partDtos) || day.partDtos.length>60) throw Error('Missing partDtos: choose Copy response on the workoutOfDay request.');
      return {date:str(day.publishingDate).slice(0,10)||'Undated',program:text(day.classTypeDto?.name)||'CrossFit',
        parts:day.partDtos.filter(p => p && p.draft!==true).map((p,i) => ({
          id:str(p.workoutPartUid)||str(p.workoutUid)||String(i),title:text(p.title)||'Untitled section',
          structure:text(p.parentWorkoutTitle)||text(p.workoutTitle),body:text(p.description),notes:text(p.athletesNotes),
          type:str(p.workoutType),score:str(p.scoreType)
        }))};
    });
  }
  function selection(part) {
    const title=part.title.toLowerCase(), structure=part.structure.toLowerCase();
    if (/\bannouncement\b|prvn\s*reset|\baccessor(?:y|ies)\b/.test(title) || /weekly\s*challenge/.test(title+' '+structure))
      return {include:false,reason:'Optional / announcement section'};
    if (/warm[ -]?up/.test(title+' '+structure)) return {include:true,reason:'Warm-up label: included for review; may be the main WOD'};
    return {include:true,reason:'Strength / workout section'};
  }
  const aliases={
    'front squat':'BARBELL_FRONT_SQUAT','front squats':'BARBELL_FRONT_SQUAT',
    'back squat':'BARBELL_BACK_SQUAT','back squats':'BARBELL_BACK_SQUAT',
    'bench press':'BARBELL_BENCH_PRESS','overhead squats':'OVERHEAD_SQUAT',
    'push ups':'PUSH_UP','push up':'PUSH_UP','pull ups':'PULL_UP','pull up':'PULL_UP',
    'banded pull ups':'BANDED_PULL_UPS','banded pull up':'BANDED_PULL_UPS',
    'sit ups':'SIT_UP','sit up':'SIT_UP','reverse lunges':'REVERSE_LUNGE'
  };
  function mapping(label) {
    const key=label.toLowerCase().replace(/[-–]/g,' ').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
    const name=aliases[key];
    return name && globalThis.PPG_CATALOG?.[name] ? name : '';
  }
  function scaling(part, level) {
    if (level==='As written') return {body:part.body,structure:part.structure};
    const combined=part.body+'\n'+part.notes;
    const headings=/^\s*(?:-\s*)?(Level [12]|Masters 55\+|Competitor|Hotel Gym \/ Travel)\s*:/gmi;
    const blocks=[...combined.matchAll(headings)];
    const found=blocks.find(m => m[1].toLowerCase()===level.toLowerCase());
    if (!found) throw Error('No '+level+' block was found. Edit the workout text manually.');
    const idx=blocks.indexOf(found),end=blocks[idx+1]?.index??combined.length;
    let body=combined.slice(found.index+found[0].length,end).trim();
    // Stop at later unrelated notes instead of treating them as exercises.
    body=body.split(/\n\s*(?:Points of Performance|Loading Notes|Modifications|Workout Strategy)\s*:/i)[0].trim();
    return {body,structure:part.structure};
  }
  function seconds(s) {
    const m=String(s).match(/^(\d{1,3}):(\d{2})$/);
    return m && +m[2]<60 ? +m[1]*60 + +m[2] : null;
  }
  function row(note,condition='lap',value=null,exercise='') {
    return {note,condition,value,exercise,weight:null};
  }
  function draft(part,mode='auto') {
    const warnings=[];
    const all=[part.structure,part.body].join('\n');
    if (/warm[ -]?up/i.test(part.structure+' '+part.title)) warnings.push('Warm-up label: verify that this is a section you want to record.');
    const titled=part.title.match(/AMRAP\s+(\d+)\b/i), written=part.body.match(/(\d+:\d{2})\s*AMRAP/i);
    if (titled && written && +titled[1]*60!==seconds(written[1])) warnings.push('Title and written AMRAP durations differ. Written instructions take precedence.');
    const every=all.match(/Every\s+(\d+:\d{2})\s*[x×]\s*(\d+)\s*(?:Sets|Rounds)?/i);
    const amrap=all.match(/(\d+:\d{2})\s*AMRAP/i)||all.match(/AMRAP\s+(\d+:\d{2})/i);
    const build=all.match(/Take\s+(\d+:\d{2})\s+to/i);
    const lines=part.body.split('\n').map(s=>s.trim()).filter(Boolean);
    const mainLines=[];
    for (const line of lines) {
      if (/^(?:Modifications|Loading Notes|Points of Performance|Intent|Target|Flow|Score|Time Cap)\s*:/i.test(line)) break;
      mainLines.push(line);
    }
    const flow=lines.filter(l=>/^Flow\s*:/i.test(l));
    const note=[...mainLines,...flow].join('\n')||part.body;
    if (mode==='auto' && every && seconds(every[1]) && +every[2]>0 && +every[2]<=50) {
      warnings.push('Each interval is one timed block with movements in its notes. Reps and individual movements are not tracked separately.');
      return {rows:[row(note,'time',seconds(every[1]))],repeat:+every[2],warnings,explanation:'Fixed intervals: complete the movements, then rest until the next interval.'};
    }
    if (mode==='auto' && (amrap||build)) {
      const duration=seconds((amrap||build)[1]);
      if (duration) {
        warnings.push('Single timed block: all movements are in notes; no movement-by-movement prompts or rep logging.');
        return {rows:[row(note,'time',duration)],repeat:1,warnings,explanation:'Timed block — avoids pressing a button after every movement.'};
      }
    }
    if (mode==='block') return {rows:[row(note)],repeat:1,warnings:['Open block: press the lap/set button to finish.'],explanation:'Open block with workout instructions in notes.'};
    let repeat=1;
    const rounds=all.match(/\b(\d+)\s+(?:Rounds?\s+(?:For Time|for time)|Sets?\b)/i);
    if (rounds) repeat=+rounds[1];
    if (amrap && mode==='steps') {
      repeat=20;
      warnings.push('AMRAP steps use 20 surplus cycles. Stop manually at the written time; this is not a prescription to finish 20 rounds.');
    }
    if (every) warnings.push('Step mode cannot automatically rest for the remainder of a fixed interval. Use auto mode or manage interval timing with the class clock.');
    if (/Time Cap/i.test(part.body)) warnings.push('Use the class clock for the time cap; it is not an automatic stop in this step-based export.');
    if (/\b(?:EMOM|E\d+MOM|ladder|increase|decrease|then|after completing|alternat.*movements|partner)\b/i.test(all+'\n'+part.notes))
      warnings.push('Partner work or changing sequence detected. Review the steps and repeat count; complex sequences require manual edits.');
    const rows=[];
    for (const line of mainLines) {
      if (/^(?:\+|\d+:\d{2}\s*AMRAP|AMRAP\b|\d+\s*(?:Rounds|Sets)\b|For Time|Barbell:)/i.test(line)) continue;
      let m=line.match(/^(\d+(?:\/\d+)?)\s*(meter|meters|m|ft)\s+(.+)$/i);
      if (m) {
        const options=m[1].split('/');
        if(options.length>1) warnings.push('Distance alternatives in "'+line+'": first value used; review.');
        rows.push(row(line,'distance',+options[0]*(m[2].toLowerCase()==='ft'?0.3048:1))); continue;
      }
      m=line.match(/^(\d+:\d{2})\s+(.+)$/);
      if (m && seconds(m[1])) { rows.push(row(line,'time',seconds(m[1]),mapping(m[2]))); continue; }
      m=line.match(/^(\d+)(?:\/(\d+))?\s+(.+)$/);
      if (m) {
        let count=+m[1];
        if (m[2]) {
          if (/Turkish|Get.Up|\/leg|per side|each side/i.test(line)) count+=+m[2];
          else warnings.push('Alternative or per-side reps in "'+line+'": first value used; edit if needed.');
        }
        if (/calorie|\bcal\b/i.test(m[3])) rows.push(row(line));
        else rows.push(row(line,'reps',count,mapping(m[3])));
      } else { rows.push(row(line)); warnings.push('Unparsed line retained as an open step: '+line); }
    }
    if (!rows.length) rows.push(row(note));
    if(rows.some(r=>!r.exercise)) warnings.push('Some movements have no verified Garmin mapping. They export as generic steps with the movement name in notes.');
    if(/\d+\s*\/\s*\d+\s*(?:lb|kg)|@|%/.test(all)) warnings.push('Loads are not filled automatically. Set kilograms in the step editor or leave unset; percentages and prescribed loads remain in notes.');
    return {rows,repeat,warnings,explanation:'Movement steps — manually advance with the lap/set button as needed.'};
  }
  function exportWorkout(part,date,rows,repeat=1) {
    if (!part.title.trim()) throw Error('Enter a workout name.');
    if (!Array.isArray(rows)||!rows.length||rows.length>49) throw Error('Use 1–49 workout steps.');
    if (!Number.isInteger(repeat)||repeat<1||repeat>99) throw Error('Repeat count must be a whole number from 1 to 99.');
    let order=1;
    const steps=rows.map(r=>{
      if(!['reps','time','distance','lap','rest'].includes(r.condition))throw Error('Unknown step condition.');
      if(r.condition!=='lap' && (!(Number(r.value)>0)||!Number.isFinite(Number(r.value)))) throw Error('Each timed, rest, distance, or rep step needs a positive value.');
      if(r.condition==='reps'&&!Number.isInteger(Number(r.value))) throw Error('Repetitions must be whole numbers.');
      const category=r.exercise?globalThis.PPG_CATALOG?.[r.exercise]:null;
      if(r.exercise&&!category) throw Error('Choose a listed Garmin exercise or leave the mapping empty.');
      const [id,key]=({reps:[10,'reps'],time:[2,'time'],distance:[3,'distance'],lap:[1,'lap.button'],rest:[2,'time']})[r.condition];
      const step={type:'ExecutableStepDTO',stepId:null,stepOrder:order++,stepType:{stepTypeId:r.condition==='rest'?5:3,stepTypeKey:r.condition==='rest'?'rest':'interval'},
        endCondition:{conditionTypeId:id,conditionTypeKey:key},endConditionValue:r.condition==='lap'?null:Number(r.value),
        targetType:{workoutTargetTypeId:1,workoutTargetTypeKey:'no.target'},description:str(r.note).slice(0,1000),category:category||null,exerciseName:r.exercise||null,weightValue:null,weightUnit:null};
      if(r.weight!==null && r.weight!=='' && r.weight!==undefined) {
        if(!r.exercise)throw Error('Select a Garmin exercise before setting a weight.');
        if(!(Number(r.weight)>=0)||!Number.isFinite(Number(r.weight)))throw Error('Weight must be a non-negative number in kilograms.');
        step.weightValue=Number(r.weight);step.weightUnit={unitId:8,unitKey:'kilogram',factor:1000};
      }
      return step;
    });
    let final=steps;
    if(repeat>1){steps.forEach(s=>s.stepOrder++);final=[{type:'RepeatGroupDTO',stepId:null,stepOrder:1,stepType:{stepTypeId:6,stepTypeKey:'repeat'},
      endCondition:{conditionTypeId:7,conditionTypeKey:'iterations'},endConditionValue:repeat,numberOfIterations:repeat,skipLastRestStep:false,smartRepeat:false,workoutSteps:steps}];}
    return {workoutName:(date+' '+part.title).slice(0,100),sportType:SPORT,description:[part.structure,part.body,part.notes].filter(Boolean).join('\n\n').slice(0,7000),
      workoutSegments:[{segmentOrder:1,sportType:SPORT,workoutSteps:final}]};
  }
  globalThis.PPG={normalize,selection,scaling,draft,exportWorkout,seconds};
})();
