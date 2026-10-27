// Prueba con PocketBase real: alertas por WhatsApp opcionales. Usa un servidor falso que imita la API.
// Arranca PocketBase con: WHATSAPP_PROVIDER=cloud WHATSAPP_TOKEN=x WHATSAPP_PHONE_NUMBER_ID=123 WHATSAPP_API_BASE=http://127.0.0.1:9998
// Uso: PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD. La entrega de la cola corre cada minuto: la prueba espera hasta 2 min.
import http from 'node:http';
const B=process.env.PB_URL||'http://127.0.0.1:8090';
const j=async(m,p,b,t)=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:t}:{})},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return {s:r.status,d}};
let fails=0; const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c)fails++;};
const received=[]; let mode='ok';
const mock=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{received.push({url:req.url,auth:req.headers.authorization,body:raw?JSON.parse(raw):null});res.writeHead(mode==='ok'?200:500,{'Content-Type':'application/json'});res.end(JSON.stringify({messages:[{id:'wamid.x'}]}));});});
await new Promise(r=>mock.listen(9998,'127.0.0.1',r));
const su=(await j('POST','/api/collections/_superusers/auth-with-password',{identity:process.env.PB_ADMIN_EMAIL||'admin@test.local',password:process.env.PB_ADMIN_PASSWORD||'Test12345678!'})).d.token;
const e=`w${Date.now()}@example.test`;
const u=(await j('POST','/api/collections/users/records',{email:e,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'W',verified:true},su)).d;
const t=(await j('POST','/api/collections/users/auth-with-password',{identity:e,password:'Np-lab-12345!'})).d.token;
const crop=(await j('POST','/api/collections/crops/records',{userId:u.id,name:'Zap',control_mode:'MANUAL'},t)).d;

let r=await j('GET','/api/neptuno/whatsapp/status',null,t); ok(r.s===200&&r.d.available===true&&r.d.provider==='cloud','servidor configurado con proveedor cloud');
r=await j('POST','/api/neptuno/whatsapp/test',{},t); ok(r.s===400,'prueba sin número guardado → 400');

const st=(await j('POST','/api/collections/user_settings/records',{userId:u.id,notify_alerts:false,notify_irrigation_events:false,whatsapp_enabled:true,whatsapp_phone:'abc'},t));
ok(st.s===400,'número inválido se rechaza ('+st.s+')');
const good=await j('POST','/api/collections/user_settings/records',{userId:u.id,notify_alerts:false,notify_irrigation_events:false,whatsapp_enabled:true,whatsapp_phone:'300 123 4567'},t);
ok(good.s===200&&good.d.whatsapp_phone==='+573001234567','número normalizado a +573001234567 ('+good.s+')');

r=await j('POST','/api/neptuno/whatsapp/test',{},t); ok(r.s===200,'mensaje de prueba enviado');
let m=received.at(-1); ok(m&&m.url==='/123/messages'&&m.auth==='Bearer x','llamada a la API de WhatsApp con el token');
ok(m&&m.body.to==='573001234567'&&m.body.type==='template'&&m.body.template.components[0].parameters[0].text.includes('prueba'),'cuerpo con plantilla y texto de prueba');
mode='fail'; r=await j('POST','/api/neptuno/whatsapp/test',{},t); ok(r.s===400&&/500/.test(JSON.stringify(r.d)),'error del proveedor se informa claramente'); mode='ok';

// Alerta real por la cola: solo WhatsApp (el correo está apagado y sin servidor de correo).
const before=received.length;
await j('POST','/api/collections/notification_queue/records',{userId:u.id,cropId:crop.id,kind:'alert',subject:'Alerta',message:'El nivel de agua bajó del 20 %.\nRevisa el tanque.'},su);
const deadline=Date.now()+130000; while(received.length===before&&Date.now()<deadline) await new Promise(x=>setTimeout(x,3000));
m=received.at(-1); ok(received.length>before&&m.body.template.components[0].parameters[0].text.startsWith('Neptuno: El nivel de agua'),'la alerta de la cola llegó por WhatsApp');
ok(m&&!/[\n\t]/.test(m.body.template.components[0].parameters[0].text),'el texto no lleva saltos de línea (Meta los rechaza)');

// Quien no activó WhatsApp no recibe nada.
const e2=`w2${Date.now()}@example.test`; const u2=(await j('POST','/api/collections/users/records',{email:e2,password:'Np-lab-12345!',passwordConfirm:'Np-lab-12345!',name:'W2',verified:true},su)).d;
const t2=(await j('POST','/api/collections/users/auth-with-password',{identity:e2,password:'Np-lab-12345!'})).d.token;
const crop2=(await j('POST','/api/collections/crops/records',{userId:u2.id,name:'Sin',control_mode:'MANUAL'},t2)).d;
await j('POST','/api/collections/user_settings/records',{userId:u2.id,notify_alerts:false,whatsapp_enabled:false},t2);
const n=received.length;
await j('POST','/api/collections/notification_queue/records',{userId:u2.id,cropId:crop2.id,kind:'alert',subject:'A',message:'No debe llegar'},su);
await new Promise(x=>setTimeout(x,75000));
ok(received.length===n,'sin activar WhatsApp no se envía nada');
mock.close(); console.log(fails?'FALLOS: '+fails:'TODO OK'); process.exit(fails?1:0);
