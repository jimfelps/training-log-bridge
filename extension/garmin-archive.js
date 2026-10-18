(() => {
  'use strict';
  const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
  const id=x=>{const s=String(x??'');if(!/^\d{1,16}$/.test(s))throw Error('Invalid Garmin activity ID.');return s;};
  const copy=x=>JSON.parse(JSON.stringify(x));
  function sanitize(kind,data){
    if(!isObj(data))throw Error('Expected a Garmin activity JSON object.');
    const activityId=id(data.activityId);
    if(kind==='sets'){
      if(!Array.isArray(data.exerciseSets)||data.exerciseSets.length>10000)throw Error('Missing or excessive exerciseSets.');
      return {activityId,exerciseSets:copy(data.exerciseSets)};
    }
    if(kind!=='summary'||!isObj(data.summaryDTO))throw Error('Missing summaryDTO.');
    // Preserve activity data without profile images, account identifiers or sensors.
    const out={activityId};
    for(const key of ['activityUUID','activityName','description','activityTypeDTO','eventTypeDTO','timeZoneUnitDTO','summaryDTO'])
      if(data[key]!==undefined)out[key]=copy(data[key]);
    out.metadataDTO={};
    for(const key of ['lastUpdateDate','uploadedDate','associatedWorkoutId','manufacturer','manualActivity','hasChartData','hasHrTimeInZones'])
      if(data.metadataDTO?.[key]!==undefined)out.metadataDTO[key]=copy(data.metadataDTO[key]);
    return out;
  }
  function archive(summaryInput,setsInput,context={}){
    const summary=sanitize('summary',summaryInput),sets=sanitize('sets',setsInput);
    if(summary.activityId!==sets.activityId)throw Error('Summary and exercise sets belong to different activities.');
    const warnings=[],rows=[];let active=0;
    for(const [index,s] of sets.exerciseSets.entries()){
      if(!isObj(s))throw Error('Invalid exercise-set record.');
      const type=typeof s.setType==='string'?s.setType:'UNKNOWN';
      const reps=num(s.repetitionCount),weight=num(s.weight),kg=weight!==null&&weight>=0?weight/1000:null;
      const exercises=Array.isArray(s.exercises)?s.exercises:[];
      if(type==='ACTIVE')active++;
      const r={source_record_index:index,set_type:type,active_set_number:type==='ACTIVE'?active:null,
        exercises:copy(exercises),exercise_category:exercises[0]?.category??null,exercise_name:exercises[0]?.name??null,
        reps,weight_raw_grams:weight,weight_kg:kg,weight_lb:kg===null?null:kg/0.45359237,
        duration_seconds:num(s.duration),start_time_raw:s.startTime??null,
        workout_step_index:s.wktStepIndex??null,rest_after_seconds:null};
      if(type==='ACTIVE'){
        let rest=0,hasRest=false;
        for(let next=index+1;next<sets.exerciseSets.length&&sets.exerciseSets[next]?.setType==='REST';next++){
          const d=num(sets.exerciseSets[next].duration);if(d!==null){rest+=d;hasRest=true;}
        }
        r.rest_after_seconds=hasRest?rest:null;
        if(!r.exercise_name)warnings.push('Active set '+active+' has no identified exercise.');
        if(exercises.length>1)warnings.push('Active set '+active+' has multiple exercise candidates; first displayed, all preserved.');
        if(reps===null||reps<0||!Number.isInteger(reps))warnings.push('Active set '+active+' has missing or unusual repetitions.');
      }
      rows.push(r);
    }
    const lifting=rows.filter(r=>r.set_type==='ACTIVE');
    const totalReps=lifting.reduce((t,r)=>t+(r.reps!==null&&r.reps>=0?r.reps:0),0);
    const loaded=lifting.filter(r=>r.weight_kg!==null&&r.reps!==null&&r.reps>=0);
    const volume=loaded.reduce((t,r)=>t+r.reps*r.weight_kg,0),s=summary.summaryDTO;
    if(num(s.totalExerciseReps)!==null&&s.totalExerciseReps!==totalReps)
      warnings.push('Garmin summary reports '+s.totalExerciseReps+' reps; corrected active sets contain '+totalReps+'. Active-set results are used.');
    if(num(s.activeSets)!==null&&s.activeSets!==lifting.length)
      warnings.push('Garmin active-set count differs from the detailed records.');
    if(lifting.some(r=>r.weight_kg===null))warnings.push('Some active weights are unset. Volume includes only sets with recorded non-negative weights and reps; missing is not treated as zero.');
    const last=summary.metadataDTO.lastUpdateDate??null;
    return {schema_version:1,source:'garmin_connect',activity_id:summary.activityId,
      archived_at:new Date().toISOString(),finalized_by_user:true,
      capture:{summary_received_at:context.summaryReceivedAt??null,sets_received_at:context.setsReceivedAt??null,garmin_last_update_raw:last},
      activity:{name:summary.activityName??null,description:summary.description??null,
        type:summary.activityTypeDTO?.typeKey??null,start_time_local_raw:s.startTimeLocal??null,start_time_gmt_raw:s.startTimeGMT??null,
        time_zone:summary.timeZoneUnitDTO??null,duration_seconds:num(s.duration),elapsed_seconds:num(s.elapsedDuration),
        average_hr:num(s.averageHR),max_hr:num(s.maxHR),calories:num(s.calories),
        aerobic_training_effect:num(s.trainingEffect),anaerobic_training_effect:num(s.anaerobicTrainingEffect),training_load:num(s.activityTrainingLoad),
        perceived_effort_raw:num(s.directWorkoutRpe),feeling_raw:num(s.directWorkoutFeel),
        associated_workout_id:summary.metadataDTO.associatedWorkoutId==null?null:String(summary.metadataDTO.associatedWorkoutId)},
      context:{programming_provider:String(context.provider??''),cycle:String(context.cycle??''),
        pushpress_workout_id:String(context.pushpressWorkoutId??''),archive_note:String(context.note??'')},
      totals:{active_sets:lifting.length,rest_records:rows.filter(r=>r.set_type==='REST').length,reps:totalReps,
        loaded_volume_kg:volume,loaded_volume_lb:volume/0.45359237,sets_with_weight_and_reps:loaded.length,
        garmin_summary_reps:num(s.totalExerciseReps),garmin_summary_total_sets:num(s.totalSets)},
      warnings,records:rows,source_snapshots:{summary,exercise_sets:sets}};
  }
  function csv(a){
    const headers=['activity_id','date_local','record_index','set_type','active_set_number','exercise_category','exercise_name','reps','weight_kg','weight_lb','duration_seconds','rest_after_seconds','start_time_raw'];
    const safe=x=>{
      if(x===null||x===undefined)return '';
      let s=String(x);if(/^[=+\-@\t\r]/.test(s)&&typeof x!=='number')s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    return [headers.join(','),...a.records.map(r=>[a.activity_id,a.activity.start_time_local_raw?.slice(0,10),r.source_record_index,r.set_type,r.active_set_number,r.exercise_category,r.exercise_name,r.reps,r.weight_kg,r.weight_lb,r.duration_seconds,r.rest_after_seconds,r.start_time_raw].map(safe).join(','))].join('\r\n')+'\r\n';
  }
  globalThis.PPG_ARCHIVE={sanitize,archive,csv};
})();
