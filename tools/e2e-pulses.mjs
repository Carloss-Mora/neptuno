// Prueba con PocketBase real: riego por pulsos, usando el Laboratorio (tiempo simulado).
import crypto from 'node:crypto';
const B=process.env.PB_URL||'http://127.0.0.1:8090';
const j=async(m,p,b,t)=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:t}:{})},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return {s:r.status,d}};
let fails=0; const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c)fails++;};
const su=(await j('POST','/api/collections/_superusers/auth-with-password',{identity:process.env.PB_ADMIN_EMAIL||'admin@test.local',password:process.env.PB_ADMIN_PASSWORD||'Test12345678!'})).d.token;
const e=`p${Date.now()}@example.test`;
const u=(await j('POST','/api/collections/users/records',{email:e,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'P',verified:true},su)).d;
const t=(await j('POST','/api/collections/users/auth-with-password',{identity:e,password:'Np-lab-12345!'})).d.token;
const mkCrop=async(extra)=>(await j('POST','/api/collections/crops/records',{userId:u.id,name:'Pulsos',control_mode:'AUTO',humidity_min:65,humidity_max:80,max_irrigation_minutes:60,min_rest_minutes:0,manual_override_minutes:30,alert_water_min:20,...extra},t)).d;
const run=async(crop,steps)=>{
  const sim=(await j('POST','/api/neptuno/simulations',{cropId:crop.id},t)).d.simulation;
  const cmd=(command,extra={})=>j('POST',`/api/neptuno/simulations/${sim.id}/command`,{command,...extra},t);
  await cmd('set_step_minutes',{value:5}); await cmd('set_humidity',{value:50}); await cmd('set_water',{value:90});
  const seq=[]; for(let i=0;i<steps;i++){const r=await cmd('step'); const s=r.d.simulation; seq.push(`${s.last_state}:${s.last_reason}`);} return {seq,sim};
};
// Con pulsos 10/20
const c1=await mkCrop({pulse_on_minutes:10,pulse_off_minutes:20}); ok(c1.pulse_on_minutes===10&&c1.pulse_off_minutes===20,'pulse fields saved');
const {seq}=await run(c1,60);
console.log(seq.join(' | '));
const first=seq.findIndex(x=>x==='ON:humidity_low'); const pause=seq.findIndex(x=>x==='OFF:pulse_pause'); const resume=seq.findIndex(x=>x==='ON:pulse_resume');
ok(first===0,'primer pulso empieza por humedad baja');
ok(pause>first,'hace una pausa entre pulsos');
ok(resume>pause,'reanuda otro pulso tras la pausa');
const endIdx=seq.findIndex(x=>x==='OFF:humidity_recovered'||x==='OFF:maximum_runtime'); const onSteps=seq.slice(0,endIdx+1).filter(x=>x.startsWith('ON')).length; ok(onSteps*5<=60,'tiempo regado del primer ciclo respeta el máximo (60 min): '+onSteps*5+' min');
ok(seq.some(x=>x==='OFF:humidity_recovered'||x==='OFF:maximum_runtime'),'el ciclo termina por humedad o por máximo');
const longestRun=seq.join(',').split(/OFF[^,]*/).map(s=>s.split(',').filter(x=>x.startsWith('ON')).length).reduce((a,b)=>Math.max(a,b),0);
ok(longestRun*5<=15,'ningún pulso dura mucho más de 10 min (máx '+longestRun*5+')');
// Sin pulsos: riego continuo
const c2=await mkCrop({}); const r2=await run(c2,12); ok(!r2.seq.some(x=>x.includes('pulse')),'sin pulsos no hay pausas');
const logs=(await j('GET',`/api/collections/irrigation_logs/records?perPage=200&filter=${encodeURIComponent(`cropId="${c1.id}"`)}`,null,su)).d.items;
ok(logs.some(l=>l.source==='PULSE'&&l.status==='OFF')&&logs.some(l=>l.source==='PULSE'&&l.status==='ON'),'los registros de pausa y reanudación usan la fuente PULSE');
console.log(fails?'FALLOS: '+fails:'TODO OK'); process.exit(fails?1:0);
