import crypto from 'node:crypto';
const B=process.env.PB_URL||'http://127.0.0.1:8090';
const j=async(m,p,b,t,h={})=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:t}:{}),...h},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return {s:r.status,d}};
let fails=0; const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c)fails++;};
const su=(await j('POST','/api/collections/_superusers/auth-with-password',{identity:process.env.PB_ADMIN_EMAIL||'admin@test.local',password:process.env.PB_ADMIN_PASSWORD||'Test12345678!'})).d.token;
const mk=async(n)=>{const e=`s${n}${Date.now()}@example.test`;const u=(await j('POST','/api/collections/users/records',{email:e,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'U'+n,verified:true},su)).d;const a=(await j('POST','/api/collections/users/auth-with-password',{identity:e,password:'Np-lab-12345!'})).d;return {u,t:a.token}};
const A=await mk('a'),Bq=await mk('b');
const crop=(await j('POST','/api/collections/crops/records',{userId:A.u.id,name:'Lote',control_mode:'AUTO',humidity_min:30,humidity_max:60,max_irrigation_minutes:60,min_rest_minutes:0,manual_override_minutes:30,alert_water_min:20,layout_rows:2,layout_cols:2},A.t)).d;
ok(crop.id,'crop created with layout');
const base={userId:A.u.id,cropId:crop.id,kind:'soil_humidity',grid_row:0,grid_col:0};
let r=await j('POST','/api/collections/sensors/records',{...base,name:'Humedad norte'},A.t); ok(r.s===200,'owner creates sensor'); const s1=r.d;
r=await j('POST','/api/collections/sensors/records',{...base,name:'x',last_value:50},A.t); ok(r.s===400||r.s===403,'cannot forge last_value ('+r.s+')');
r=await j('POST','/api/collections/sensors/records',{...base,userId:Bq.u.id,name:'x'},Bq.t); ok(r.s===400||r.s===403,'other user cannot attach to my crop ('+r.s+')');
r=await j('POST','/api/collections/sensors/records',{...base,name:'fuera',grid_row:3},A.t); ok(r.s===400,'out of layout rejected ('+r.s+')');
const s2=(await j('POST','/api/collections/sensors/records',{...base,name:'Temp',kind:'temperature',grid_col:1},A.t)).d;
const s3=(await j('POST','/api/collections/sensors/records',{...base,name:'Agua',kind:'water_level',grid_row:1},A.t)).d;
const s4=(await j('POST','/api/collections/sensors/records',{...base,name:'Humedad sur',grid_row:1,grid_col:1},A.t)).d;
r=await j('PATCH','/api/collections/sensors/records/'+s1.id,{last_value:99},A.t); ok(r.s===400||r.s===404||r.s===403,'cannot patch last_value ('+r.s+')');
r=await j('PATCH','/api/collections/sensors/records/'+s1.id,{name:'Humedad norte 2',grid_col:1},A.t); ok(r.s===200,'can rename/move');
r=await j('GET','/api/collections/sensors/records',null,Bq.t); ok(r.d.items.length===0,'other user sees none');
// device + ingest
const key='k'+crypto.randomBytes(8).toString('hex');
await j('POST','/api/collections/devices/records',{userId:A.u.id,cropId:crop.id,name:'Disp',key_hash:crypto.createHash('sha256').update(key).digest('hex'),interval_seconds:1,desired_state:'OFF'},su);
r=await j('POST','/api/neptuno/ingest',{soil_humidity:41,temperature:22,water_level:77,sensor_readings:{[s4.id]:35}},null,{'X-Device-Key':key}); ok(r.s===200,'ingest ok ('+r.s+')');
const list=(await j('GET','/api/collections/sensors/records?perPage=50',null,A.t)).d.items; const g=(id)=>list.find(x=>x.id===id);
ok(g(s1.id).last_value===41&&g(s1.id).last_reading_at,'humidity sensor got general value');
ok(g(s4.id).last_value===35,'per-sensor value used for sensor 4');
ok(g(s2.id).last_value===22&&g(s3.id).last_value===77,'temp and water updated');
await new Promise(r=>setTimeout(r,1200));
r=await j('POST','/api/neptuno/ingest',{soil_humidity:42,temperature:22.5,water_level:77},null,{'X-Device-Key':key}); ok(r.s===200,'second real reading (decimals)');
await new Promise(r=>setTimeout(r,1200));
r=await j('POST','/api/neptuno/ingest',{soil_humidity:50,temperature:22,water_level:77,demo:true},null,{'X-Device-Key':key});
const l2=(await j('GET','/api/collections/sensors/records?perPage=50',null,A.t)).d.items; ok(l2.find(x=>x.id===s1.id).last_value===42,'demo ingest does not touch sensors');
r=await j('POST','/api/collections/sensors/records',{...base,name:'extra5',grid_row:1,grid_col:0},A.t); ok(r.s===200,'5th sensor ok (position reuse allowed)');
for(let i=6;i<=12;i++) await j('POST','/api/collections/sensors/records',{...base,name:'e'+i},A.t);
r=await j('POST','/api/collections/sensors/records',{...base,name:'e13'},A.t); ok(r.s===400,'13th sensor rejected ('+r.s+')');
r=await j('GET','/api/neptuno/me/export',null,A.t); ok(r.s===200&&r.d.crops.length===1&&r.d.sensors.length>=4&&!JSON.stringify(r.d).includes('key_hash'),'export ok, no key_hash');
r=await j('GET','/api/neptuno/me/export',null,Bq.t); ok(r.s===200&&r.d.crops.length===0,'export only own data');
r=await j('GET','/api/neptuno/me/export'); ok(r.s===401||r.s===403,'export needs auth ('+r.s+')');
// reportes por hora
r=await j('GET',`/api/neptuno/reports/readings?cropId=${crop.id}&from=${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}&to=${encodeURIComponent(new Date(Date.now()+3600000).toISOString())}`,null,A.t);
ok(r.s===200&&r.d.hours.length>=1&&Math.abs(r.d.hours[0].humidity-41.5)<0.01&&Math.abs(r.d.hours[0].temperature-22.25)<0.01&&r.d.hours[0].samples===2,'hourly report aggregates real readings, skips demo ('+r.s+' '+JSON.stringify(r.d).slice(0,160)+')');
r=await j('GET',`/api/neptuno/reports/readings?cropId=${crop.id}&from=2024-01-01&to=2026-12-31T00:00:00Z`,null,A.t); ok(r.s===400,'period over 400 days rejected ('+r.s+')');
r=await j('GET',`/api/neptuno/reports/readings?cropId=${crop.id}&from=2026-10-01&to=2026-10-30`,null,Bq.t); ok(r.s===403||r.s===404,'other user cannot read my crop report ('+r.s+')');
// settings extended
r=await j('POST','/api/collections/user_settings/records',{userId:A.u.id,timezone:'America/Bogota',unit_volume:'gal',unit_temp:'F',default_flow_lpm:12,retention_days:60},A.t); ok(r.s===200&&r.d.unit_volume==='gal','extended settings saved ('+r.s+')');
console.log(fails?'FALLOS: '+fails:'TODO OK'); 
// Eliminar la propia cuenta borra todo en cascada
{
  const S2=await mk('c');
  const c2=(await j('POST','/api/collections/crops/records',{userId:S2.u.id,name:'Borrar',control_mode:'MANUAL',manual_override_minutes:30},S2.t)).d;
  await j('POST','/api/collections/sensors/records',{userId:S2.u.id,cropId:c2.id,name:'s',kind:'temperature',grid_row:0,grid_col:0},S2.t);
  await j('POST','/api/collections/user_settings/records',{userId:S2.u.id,unit_volume:'gal'},S2.t);
  const del=await j('DELETE','/api/collections/users/records/'+S2.u.id,null,S2.t);
  ok(del.s===204,'user can delete own account ('+del.s+')');
  const left=(await j('GET',`/api/collections/sensors/records?filter=${encodeURIComponent(`userId="${S2.u.id}"`)}`,null,su)).d.items.length
    +(await j('GET',`/api/collections/crops/records?filter=${encodeURIComponent(`userId="${S2.u.id}"`)}`,null,su)).d.items.length
    +(await j('GET',`/api/collections/user_settings/records?filter=${encodeURIComponent(`userId="${S2.u.id}"`)}`,null,su)).d.items.length;
  ok(left===0,'cascade removed crops, sensors and settings');
  const other=await j('DELETE','/api/collections/users/records/'+A.u.id,null,Bq.t); ok(other.s===403||other.s===404,'cannot delete another account ('+other.s+')');
}
console.log(fails?'FALLOS (final): '+fails:'TODO OK (final)');
