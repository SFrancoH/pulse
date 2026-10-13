import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export function validarWebhookUrl(value: string) {
 const u=new URL(value);
 if(u.protocol!=="https:"||u.hostname!=="services.leadconnectorhq.com"||u.port||u.search||u.hash||u.username||u.password||!/^\/hooks\/[A-Za-z0-9_-]+\/webhook-trigger\/[A-Za-z0-9-]+$/.test(u.pathname)) throw Error("URL de integración inválida.");
 return u.toString();
}
function clave(){const b=Buffer.from(process.env.PULSE_WEBHOOK_ENCRYPTION_KEY||"","base64");if(b.length!==32)throw Error("Falta clave privada de integración.");return b;}
export function cifrarWebhook(url:string){const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",clave(),iv),data=Buffer.concat([c.update(validarWebhookUrl(url),"utf8"),c.final()]);return [iv.toString("base64url"),c.getAuthTag().toString("base64url"),data.toString("base64url")].join(".");}
function descifrar(valor:string){const [a,b,c]=valor.split(".");if(!a||!b||!c)throw Error("Integración no disponible.");const d=createDecipheriv("aes-256-gcm",clave(),Buffer.from(a,"base64url"));d.setAuthTag(Buffer.from(b,"base64url"));return validarWebhookUrl(Buffer.concat([d.update(Buffer.from(c,"base64url")),d.final()]).toString("utf8"));}
export async function guardarIntegracion(empresaId:string,url:string,responsable?:string|null){
 const cambios:Record<string,unknown>={updated_at:new Date().toISOString()};
 if(url)cambios.webhook_reservas_url_cifrada=cifrarWebhook(url);
 if(responsable!==undefined)cambios.responsable_reservas_publicas_user_id=responsable;
 const {data,error}=await supabaseAdmin.from("empresas").update(cambios).eq("id",empresaId).select("id").maybeSingle();
 if(error||!data)throw error||new Error("Empresa no encontrada.");
}
async function fallo(empresa:string,proyecto:string,grupo:string,estado:"fallido"|"incierto",motivo:string){
 await supabaseAdmin.from("pulse_eventos_reserva").update({estado,motivo,respuesta_at:new Date().toISOString()}).eq("empresa_id",empresa).eq("proyecto_id",proyecto).eq("reserva_grupo",grupo).eq("estado","enviando");
 await supabaseAdmin.from("pulse_alertas_oportunidades").update({estado:"pendiente",motivo}).eq("empresa_id",empresa).eq("proyecto_id",proyecto).eq("reserva_grupo",grupo).eq("estado","esperando");
}
export async function enviarReservaUnaVez(empresa:string,proyecto:string,grupo:string){
 const {data:evento,error}=await supabaseAdmin.from("pulse_eventos_reserva").update({estado:"enviando",intento_iniciado_at:new Date().toISOString()}).eq("empresa_id",empresa).eq("proyecto_id",proyecto).eq("reserva_grupo",grupo).eq("estado","pendiente").select("id").maybeSingle();
 if(error||!evento)return;
 try{
  const [conf,lista,proy]=await Promise.all([
   supabaseAdmin.from("empresas").select("webhook_reservas_url_cifrada").eq("id",empresa).maybeSingle(),
   supabaseAdmin.from("boletas").select("id,numero,comprobante_url,nombre_cliente,telefono_cliente,ciudad_cliente,email_cliente,creado_por_user_id,canal").eq("empresa_id",empresa).eq("proyecto_id",proyecto).eq("reserva_grupo",grupo).order("numero",{ascending:true}),
   supabaseAdmin.from("proyectos").select("nombre,precio_boleta").eq("empresa_id",empresa).eq("id",proyecto).maybeSingle()
  ]);
  if(conf.error||lista.error||proy.error||!conf.data?.webhook_reservas_url_cifrada||!lista.data?.length||!proy.data) {await fallo(empresa,proyecto,grupo,"fallido","Integración no configurada o datos incompletos.");return;}
  const rows=lista.data;
  if(rows.length>10||rows.some(b=>!b.comprobante_url)){await fallo(empresa,proyecto,grupo,"fallido","Falta el enlace virtual de alguna boleta.");return;}
  const payload:Record<string,string|number|null>={
   evento:"reserva_confirmada",evento_id:evento.id,reserva_grupo:grupo,empresa_id:empresa,proyecto_id:proyecto,
   nombre_proyecto:proy.data.nombre||"",first_name:rows[0].nombre_cliente||"",phone:rows[0].telefono_cliente||"",
   city:rows[0].ciudad_cliente||"",email:rows[0].email_cliente||"",canal:rows[0].canal||"",
   responsable_user_id:rows[0].creado_por_user_id||null,cantidad_boletas:rows.length,
   valor_a_pagar:rows.length*Number(proy.data.precio_boleta||0)
  };
  rows.forEach((b,i)=>{payload["consecutivo_"+(i+1)]=b.numero;payload["comprobante_url_"+(i+1)]=b.comprobante_url||"";});
  const res=await fetch(descifrar(conf.data.webhook_reservas_url_cifrada),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!res.ok){await fallo(empresa,proyecto,grupo,"fallido","No se confirmó la recepción del envío.");return;}
  await supabaseAdmin.from("pulse_eventos_reserva").update({estado:"recibido",respuesta_at:new Date().toISOString()}).eq("id",evento.id).eq("estado","enviando");
 }catch{await fallo(empresa,proyecto,grupo,"incierto","La recepción no pudo verificarse. Comprueba si la oportunidad ya existe.");}
}
