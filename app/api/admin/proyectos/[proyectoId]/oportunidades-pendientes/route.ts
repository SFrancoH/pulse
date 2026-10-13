import { GET as legacyGET } from "@/lib/legacy-opportunity-pending";
import { requireProjectSalesAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = {params:Promise<{proyectoId:string}>};
const ESPERA_MS=60*60*1000;

export async function GET(req:Request,{params}:Props){
 if (process.env.PULSE_RESERVAS_V2 !== "enabled") return legacyGET(req, {params});
 try{
  const {proyectoId}=await params;
  const {proyecto,session,error}=await requireProjectSalesAccess(proyectoId);
  if(error||!proyecto||!session)return error||Response.json({success:false,message:"No autorizado."},{status:403});
  if(!session.user_id)return Response.json({success:false,message:"No fue posible identificar al usuario."},{status:403});
  const sinAsignar=session.rol==="super_admin"&&new URL(req.url).searchParams.get("sin_asignar")==="1";
  const cutoff=new Date(Date.now()-ESPERA_MS).toISOString();
  let caducadas=supabaseAdmin.from("pulse_alertas_oportunidades")
   .update({estado:"pendiente",motivo:"La creación de la oportunidad no pudo confirmarse."})
   .eq("empresa_id",proyecto.empresa_id).eq("proyecto_id",proyectoId)
   .eq("estado","esperando").lt("created_at",cutoff);
  caducadas=sinAsignar?caducadas.is("responsable_user_id",null):caducadas.eq("responsable_user_id",session.user_id);
  const {error:caducidadError}=await caducadas;
  if(caducidadError)throw caducidadError;
  let query=supabaseAdmin.from("pulse_alertas_oportunidades")
   .select("id,boleta_id,reserva_grupo,motivo,estado,created_at")
   .eq("empresa_id",proyecto.empresa_id).eq("proyecto_id",proyectoId)
   .eq("estado","pendiente").order("created_at",{ascending:true}).limit(500);
  query=sinAsignar?query.is("responsable_user_id",null):query.eq("responsable_user_id",session.user_id);
  const {data:pendientes,error:queryError}=await query;
  if(queryError)throw queryError;
  const ids=(pendientes||[]).map(a=>a.boleta_id);
  if(!ids.length)return Response.json({success:true,cantidad:0,alertas:[]});
  const [boletasRes,proyectoRes,empresaRes]=await Promise.all([
   supabaseAdmin.from("boletas").select("id,numero,nombre_cliente,telefono_cliente,email_cliente,ciudad_cliente,canal,comprobante_url,updated_at,creado_por_user_id")
    .eq("empresa_id",proyecto.empresa_id).eq("proyecto_id",proyectoId).in("id",ids),
   supabaseAdmin.from("proyectos").select("nombre,precio_boleta").eq("empresa_id",proyecto.empresa_id).eq("id",proyectoId).maybeSingle(),
   supabaseAdmin.from("empresas").select("nombre").eq("id",proyecto.empresa_id).maybeSingle()
  ]);
  if(boletasRes.error||proyectoRes.error||empresaRes.error)throw Error("Error al consultar los detalles de las reservas.");
  const mapa=new Map((boletasRes.data||[]).map(b=>[b.id,b]));
  const alertas=(pendientes||[]).map(a=>{
   const b=mapa.get(a.boleta_id);
   return b?{id:a.id,reserva_grupo:a.reserva_grupo,numero:b.numero,nombre_cliente:b.nombre_cliente,
    telefono_cliente:b.telefono_cliente,email_cliente:b.email_cliente,ciudad_cliente:b.ciudad_cliente,
    comprobante_url:b.comprobante_url,canal:b.canal,fecha_reserva:b.updated_at,
    empresa_nombre:empresaRes.data?.nombre||"",proyecto_nombre:proyectoRes.data?.nombre||"",
    valor:Number(proyectoRes.data?.precio_boleta||0),motivo:a.motivo}:null;
  }).filter(Boolean);
  return Response.json({success:true,cantidad:alertas.length,alertas});
 }catch{return Response.json({success:false,message:"No fue posible consultar las alertas."},{status:500});}
}
