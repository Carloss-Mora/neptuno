// Prueba con PocketBase real: zonas de riego (una válvula por zona).
import crypto from 'node:crypto';
const B=process.env.PB_URL||'http://127.0.0.1:8090';
const j=async(m,p,b,t,h={})=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:t}:{}),...h},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return {s:r.status,d}};
let fails=0; const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c)fails++;};
const su=(await j('POST','/api/collections/_superusers/auth-with-password',{identity:process.env.PB_ADMIN_EMAIL||'admin@test.local',password:process.env.PB_ADMIN_PASSWORD||'Test12345678!'})).d.token;
const mk=async(n)=>{const e=`z${n}${Date.now()}@example.test`;const u=(await j('POST','/api/collections/users/records',{email:e,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'Z'+n,verified:true},su)).d;const a=(await j('POST','/api/collections/users/auth-with-password',{identity:e,password:'Np-lab-12345!'})).d;return {u,t:a.token}};
const A=await mk('a'),Bq=await mk('b');
const crop=(await j('POST','/api/collections/crops/records',{userId:A.u.id,name:'Zonas',control_mode:'AUTO',humidity_min:65,humidity_max:80,max_irrigation_minutes:60,min_rest_minutes:0,manual_override_minutes:30,alert_water_min:20,layout_rows:2,layout_cols:2},A.t)).d;
const zbase={userId:A.u.id,cropId:crop.id};
let r=await j('POST','/api/collections/zones/records',{...zbase,name:'Norte',valve_channel:1,flow_lpm:6},A.t); ok(r.s===200,'owner creates zone 1 ('+r.s+')'); const z1=r.d;
r=await j('POST','/api/collections/zones/records',{...zbase,name:'Sur',valve_channel:2,flow_lpm:4},A.t); ok(r.s===200,'owner creates zone 2'); const z2=r.d;
r=await j('POST','/api/collections/zones/records',{...zbase,name:'Dup',valve_channel:2},A.t); ok(r.s===400,'duplicate valve channel rejected ('+r.s+')');
r=await j('POST','/api/collections/zones/records',{...zbase,userId:Bq.u.id,name:'Ajena',valve_channel:3},Bq.t); ok(r.s===400||r.s===403,'other user cannot add zone to my crop ('+r.s+')');
r=await j('POST','/api/collections/zones/records',{...zbase,name:'x',valve_channel:9},A.t); ok(r.s===400,'channel 9 rejected');
r=await j('GET','/api/collections/zones/records',null,Bq.t); ok(r.d.items.length===0,'other user sees no zones');
for(let c=3;c<=8;c++) await j('POST','/api/collections/zones/records',{...zbase,name:'z'+c,valve_channel:c},A.t);
r=await j('POST','/api/collections/zones/records',{...zbase,name:'nueve',valve_channel:1},A.t); ok(r.s===400,'9th zone rejected');
for(let c=3;c<=8;c++){const l=(await j('GET','/api/collections/zones/records?filter='+encodeURIComponent(`cropId="${crop.id}" && valve_channel=${c}`),null,A.t)).d.items[0]; await j('DELETE','/api/collections/zones/records/'+l.id,null,A.t);}
// sensores por zona
const base={userId:A.u.id,cropId:crop.id,kind:'soil_humidity'};
const s1=(await j('POST','/api/collections/sensors/records',{...base,name:'H norte',grid_row:0,grid_col:0,zoneId:z1.id},A.t)).d;
const s2=(await j('POST','/api/collections/sensors/records',{...base,name:'H sur',grid_row:1,grid_col:1,zoneId:z2.id},A.t)).d;
ok(s1.zoneId===z1.id&&s2.zoneId===z2.id,'sensors assigned to zones');
const other=(await j('POST','/api/collections/crops/records',{userId:A.u.id,name:'Otro',control_mode:'MANUAL',manual_override_minutes:30},A.t)).d;
r=await j('POST','/api/collections/sensors/records',{userId:A.u.id,cropId:other.id,kind:'soil_humidity',name:'x',grid_row:0,grid_col:0,zoneId:z1.id},A.t); ok(r.s===400,'sensor cannot use a zone of another crop ('+r.s+')');
// dispositivo + ingest
const key='k'+crypto.randomBytes(8).toString('hex');
await j('POST','/api/collections/devices/records',{userId:A.u.id,cropId:crop.id,name:'Disp',key_hash:crypto.createHash('sha256').update(key).digest('hex'),interval_seconds:1,desired_state:'OFF'},su);
const ingest=(b)=>j('POST','/api/neptuno/ingest',{temperature:22,water_level:80,...b},null,{'X-Device-Key':key});
r=await ingest({soil_humidity:70,sensor_readings:{[s1.id]:50,[s2.id]:72}});
ok(r.s===200&&r.d.zones.length===2,'ingest returns both zones ('+JSON.stringify(r.d)+')');
const st=(ch)=>r.d.zones.find(z=>z.channel===ch).state;
ok(st(1)==='ON'&&st(2)==='OFF'&&r.d.irrigation==='ON','only the dry zone (1) irrigates; crop is ON');
await new Promise(x=>setTimeout(x,1100));
r=await ingest({soil_humidity:70,sensor_readings:{[s1.id]:50,[s2.id]:60}});
ok(st(1)==='ON'&&st(2)==='ON','both zones irrigate when both are dry');
await new Promise(x=>setTimeout(x,1100));
r=await ingest({soil_humidity:70,sensor_readings:{[s1.id]:85,[s2.id]:60}});
ok(st(1)==='OFF'&&st(2)==='ON'&&r.d.irrigation==='ON','zone 1 stops at max humidity, zone 2 keeps going');
await new Promise(x=>setTimeout(x,1100));
r=await ingest({soil_humidity:70,sensor_readings:{[s1.id]:85,[s2.id]:85}});
ok(st(1)==='OFF'&&st(2)==='OFF'&&r.d.irrigation==='OFF','all zones OFF → crop OFF');
const cropLogs=(await j('GET','/api/collections/irrigation_logs/records?perPage=50&sort=created&filter='+encodeURIComponent(`cropId="${crop.id}" && zoneId=""`),null,su)).d.items;
ok(cropLogs.map(l=>l.status).join(',')==='ON,OFF','crop-level log mirrors "any zone on": '+cropLogs.map(l=>l.status).join(','));
const z1Logs=(await j('GET','/api/collections/irrigation_logs/records?perPage=50&sort=created&filter='+encodeURIComponent(`zoneId="${z1.id}"`),null,su)).d.items;
ok(z1Logs.map(l=>l.status).join(',')==='ON,OFF','zone 1 has its own ON/OFF logs');
// manual por zona
r=await j('POST',`/api/neptuno/zones/${z2.id}/irrigation`,{status:'ON'},A.t); ok(r.s===201,'manual ON for zone 2 ('+r.s+')');
r=await j('POST',`/api/neptuno/zones/${z2.id}/irrigation`,{status:'ON'},Bq.t); ok(r.s===403||r.s===404,'other user cannot drive my zone ('+r.s+')');
const cl=(await j('GET','/api/collections/irrigation_logs/records?perPage=1&sort=-created&filter='+encodeURIComponent(`cropId="${crop.id}" && zoneId=""`),null,su)).d.items[0]; ok(cl.status==='ON','crop-level ON after manual zone');
r=await j('POST',`/api/neptuno/zones/${z2.id}/irrigation`,{status:'OFF'},A.t);
const cl2=(await j('GET','/api/collections/irrigation_logs/records?perPage=1&sort=-created&filter='+encodeURIComponent(`cropId="${crop.id}" && zoneId=""`),null,su)).d.items[0]; ok(cl2.status==='OFF','crop-level OFF after manual stop');
// manual del cultivo completo abre todas las zonas
r=await j('POST','/api/neptuno/irrigation/manual',{cropId:crop.id,status:'ON'},A.t); ok(r.s===201,'crop manual ON');
await j('PATCH','/api/collections/crops/records/'+crop.id,{manual_override_until:''},su);
const z=(await j('GET','/api/collections/zones/records',null,A.t)).d.items; 
let on=0; for(const zz of z){const l=(await j('GET','/api/collections/irrigation_logs/records?perPage=1&sort=-created&filter='+encodeURIComponent(`zoneId="${zz.id}"`),null,su)).d.items[0]; if(l&&l.status==='ON')on++;} ok(on===2,'crop manual ON opens every zone ('+on+')');
// eliminar una zona borra sus registros, no los del cultivo
r=await j('DELETE','/api/collections/zones/records/'+z1.id,null,A.t); ok(r.s===204,'zone deleted');
const left=(await j('GET','/api/collections/irrigation_logs/records?perPage=50&filter='+encodeURIComponent(`zoneId="${z1.id}"`),null,su)).d.items.length; ok(left===0,'zone logs removed with the zone');
const s1b=(await j('GET','/api/collections/sensors/records/'+s1.id,null,A.t)).d; ok(!s1b.zoneId,'sensor keeps existing, zone cleared');
r=await j('GET','/api/neptuno/me/export',null,A.t); ok(r.s===200&&Array.isArray(r.d.zones),'export includes zones');
console.log(fails?'FALLOS: '+fails:'TODO OK'); process.exit(fails?1:0);
