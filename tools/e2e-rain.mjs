// Prueba con PocketBase real: "no empezar a regar si se espera lluvia" (modo automático).
// Uso: PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD. No consulta Open-Meteo: escribe el pronóstico a mano.
import crypto from 'node:crypto';
const B=process.env.PB_URL||'http://127.0.0.1:8090';
const j=async(m,p,b,t,h={})=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:t}:{}),...h},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return {s:r.status,d}};
let fails=0; const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c)fails++;};
const su=(await j('POST','/api/collections/_superusers/auth-with-password',{identity:process.env.PB_ADMIN_EMAIL||'admin@test.local',password:process.env.PB_ADMIN_PASSWORD||'Test12345678!'})).d.token;
const e=`r${Date.now()}@example.test`;
const u=(await j('POST','/api/collections/users/records',{email:e,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'R',verified:true},su)).d;
const t=(await j('POST','/api/collections/users/auth-with-password',{identity:e,password:'Np-lab-12345!'})).d.token;
const crop=(await j('POST','/api/collections/crops/records',{userId:u.id,name:'Lluvia',control_mode:'AUTO',humidity_min:65,humidity_max:80,max_irrigation_minutes:60,min_rest_minutes:0,manual_override_minutes:30,alert_water_min:20,latitude:4.45,longitude:-73.8,rain_skip:true,rain_threshold_mm:2},t)).d;
ok(crop.id&&crop.rain_skip===true&&crop.latitude===4.45,'crop saved with location and rain_skip');
const key='k'+crypto.randomBytes(8).toString('hex');
await j('POST','/api/collections/devices/records',{userId:u.id,cropId:crop.id,name:'D',key_hash:crypto.createHash('sha256').update(key).digest('hex'),interval_seconds:1,desired_state:'OFF'},su);
const ingest=(h)=>j('POST','/api/neptuno/ingest',{soil_humidity:h,temperature:22,water_level:80},null,{'X-Device-Key':key});
const lastLog=async()=>((await j('GET',`/api/collections/irrigation_logs/records?perPage=1&sort=-created&filter=${encodeURIComponent(`cropId="${crop.id}"`)}`,null,su)).d.items[0]||null);
// Un apagado manual activa 30 min de control manual en modo AUTO; la prueba lo limpia para medir solo la lluvia.
const stop=async()=>{await j('POST','/api/collections/irrigation_logs/records',{userId:u.id,cropId:crop.id,status:'OFF',source:'MANUAL'},su);await j('PATCH','/api/collections/crops/records/'+crop.id,{manual_override_until:''},su);};
const setForecast=(mm,ageMs=0)=>j('PATCH','/api/collections/crops/records/'+crop.id,{rain_forecast_mm:mm,rain_forecast_at:new Date(Date.now()-ageMs).toISOString().replace('T',' ')},su);
// 1) Sin pronóstico: seco → riega
await setForecast(0); let r=await ingest(60); ok(r.s===200,'ingest ok'); let l=await lastLog(); ok(l&&l.status==='ON'&&l.source==='THRESHOLD','sin lluvia prevista, humedad baja → enciende');
await stop();
await new Promise(x=>setTimeout(x,1100));
// 2) Lluvia prevista, ligeramente seco → no enciende
await setForecast(4); const before=(await lastLog()).id; await ingest(60); l=await lastLog(); ok(l.id===before,'lluvia prevista (4 mm) y humedad apenas baja → NO enciende');
// 3) Muy seco → riega igual
await new Promise(x=>setTimeout(x,1100)); await ingest(40); l=await lastLog(); ok(l.status==='ON','muy seco → riega aunque se espere lluvia');
await stop();
// 4) Pronóstico viejo → se ignora
await setForecast(4,3*3600000); await new Promise(x=>setTimeout(x,1100)); await ingest(60); l=await lastLog(); ok(l.status==='ON','pronóstico de hace 3 h se ignora → enciende');
// 5) Pronóstico bajo el umbral → riega
await stop();
await setForecast(1); await new Promise(x=>setTimeout(x,1100)); await ingest(60); l=await lastLog(); ok(l.status==='ON','1 mm < 2 mm → enciende');
// 6) Endpoint de pronóstico exige dueño
const other=`o${Date.now()}@example.test`; await j('POST','/api/collections/users/records',{email:other,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'O',verified:true},su);
const ot=(await j('POST','/api/collections/users/auth-with-password',{identity:other,password:'Np-lab-12345!'})).d.token;
r=await j('POST',`/api/neptuno/crops/${crop.id}/rain-forecast`,{},ot); ok(r.s===403||r.s===404,'otro usuario no puede pedir el pronóstico ('+r.s+')');
r=await j('POST',`/api/neptuno/crops/${crop.id}/rain-forecast`,{}); ok(r.s===401||r.s===403,'sin sesión se rechaza ('+r.s+')');
r=await j('POST',`/api/neptuno/crops/${crop.id}/rain-forecast`,{},t); console.log('INFO endpoint propio (sin internet puede fallar):',r.s,JSON.stringify(r.d).slice(0,120));
console.log(fails?'FALLOS: '+fails:'TODO OK'); process.exit(fails?1:0);
