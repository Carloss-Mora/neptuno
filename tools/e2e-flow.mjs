// Prueba con PocketBase real: caudal medido opcional en /api/neptuno/ingest.
import crypto from 'node:crypto';
const B=process.env.PB_URL||'http://127.0.0.1:8090';
const j=async(m,p,b,t,h={})=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:t}:{}),...h},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return {s:r.status,d}};
let fails=0; const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c)fails++;};
const su=(await j('POST','/api/collections/_superusers/auth-with-password',{identity:process.env.PB_ADMIN_EMAIL||'admin@test.local',password:process.env.PB_ADMIN_PASSWORD||'Test12345678!'})).d.token;
const e=`f${Date.now()}@example.test`;
const u=(await j('POST','/api/collections/users/records',{email:e,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'F',verified:true},su)).d;
const t=(await j('POST','/api/collections/users/auth-with-password',{identity:e,password:'Np-lab-12345!'})).d.token;
const crop=(await j('POST','/api/collections/crops/records',{userId:u.id,name:'Caudal',control_mode:'AUTO',humidity_min:65,humidity_max:80,max_irrigation_minutes:60,min_rest_minutes:0,manual_override_minutes:30,flow_lpm:10},t)).d;
const key='k'+crypto.randomBytes(8).toString('hex');
const dev=(await j('POST','/api/collections/devices/records',{userId:u.id,cropId:crop.id,name:'D',key_hash:crypto.createHash('sha256').update(key).digest('hex'),interval_seconds:1,desired_state:'OFF'},su)).d;
const ingest=(b)=>j('POST','/api/neptuno/ingest',{soil_humidity:70,temperature:22,water_level:80,...b},null,{'X-Device-Key':key});
let r=await ingest({flow_lpm:0}); ok(r.s===200,'ingest with flow ok');
const d1=(await j('GET','/api/collections/devices/records/'+dev.id,null,su)).d; ok(d1.last_flow_lpm===0&&d1.last_flow_at,'flow stored on device');
await new Promise(x=>setTimeout(x,1100));
r=await ingest({flow_lpm:600}); ok(r.s===400,'flow 600 rejected ('+r.s+')');
r=await ingest({flow_lpm:'abc'}); ok(r.s===400,'non numeric flow rejected');
r=await ingest({}); ok(r.s===200,'flow remains optional');
r=await j('PATCH','/api/collections/devices/records/'+dev.id,{last_flow_lpm:5},t); ok(r.s===400||r.s===403||r.s===404,'owner cannot forge last_flow_lpm ('+r.s+')');
// dentro de los 2 minutos de gracia no hay alerta aunque el caudal sea 0 con la válvula abierta
await j('POST','/api/collections/irrigation_logs/records',{userId:u.id,cropId:crop.id,status:'ON',source:'MANUAL'},su);
await new Promise(x=>setTimeout(x,1100));
r=await ingest({flow_lpm:0}); const d2=(await j('GET','/api/collections/devices/records/'+dev.id,null,su)).d; ok(r.s===200&&d2.last_alert_code==='','no alert during the 2-minute grace ('+d2.last_alert_code+')');
console.log(fails?'FALLOS: '+fails:'TODO OK'); process.exit(fails?1:0);
