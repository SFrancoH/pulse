import { requireSuperAdmin } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardarIntegracion } from "@/lib/reservation-webhook";
type Props={params:Promise<{empresaId:string}>};

async function validarEmpresa(empresaId:string){
 const {data,error}=await supabaseAdmin.from("empresas").select("id,nombre").eq("id",empresaId).maybeSingle();
 if(error)throw error;return data;
}
export async function GET(_req:Request,{params}:Props){
 const auth=await requireSuperAdmin();if(auth.error)return auth.error;
 try{
  const {empresaId}=await params,empresa=await validarEmpresa(empresaId);
  if(!empresa)return Response.json({success:false,message:"Empresa no encontrada."},{status:404});
  const [conf,admins,unassigned]=await Promise.all([
   supabaseAdmin.from("empresas").select("webhook_reservas_url_cifrada,responsable_reservas_publicas_user_id").eq("id",empresaId).maybeSingle(),
   supabaseAdmin.from("admin_users").select("id,nombre,email").eq("empresa_id",empresaId).eq("role","empresa_admin").eq("estado","activo").order("email"),
   supabaseAdmin.from("pulse_alertas_oportunidades").select("id",{count:"exact",head:true}).eq("empresa_id",empresaId).is("responsable_user_id",null).in("estado",["esperando","pendiente"])
  ]);
  if(conf.error||admins.error||unassigned.error)throw Error("Error al consultar configuración.");
  return Response.json({success:true,empresa_nombre:empresa.nombre,configurada:Boolean(conf.data?.webhook_reservas_url_cifrada),responsable_publico_user_id:conf.data?.responsable_reservas_publicas_user_id||null,administradores:admins.data||[],sin_responsable:unassigned.count||0});
 }catch{return Response.json({success:false,message:"Error al consultar la integración."},{status:500});}
}
export async function PUT(req:Request,{params}:Props){
 const auth=await requireSuperAdmin();if(auth.error)return auth.error;
 if(req.headers.get("origin")&&req.headers.get("origin")!==new URL(req.url).origin)return Response.json({success:false,message:"Origen no autorizado."},{status:403});
 try{
  const {empresaId}=await params,empresa=await validarEmpresa(empresaId);
  if(!empresa)return Response.json({success:false,message:"Empresa no encontrada."},{status:404});
  const body=await req.json() as {webhook_url?:unknown;responsable_publico_user_id?:unknown};
  const url=String(body.webhook_url||"").trim();
  const responsable=body.responsable_publico_user_id===null?"":String(body.responsable_publico_user_id||"").trim();
  if(responsable){
   const {data:u,error}=await supabaseAdmin.from("admin_users").select("id").eq("id",responsable).eq("empresa_id",empresaId).eq("role","empresa_admin").eq("estado","activo").maybeSingle();
   if(error||!u)return Response.json({success:false,message:"Selecciona un administrador principal activo de esta empresa."},{status:400});
  }
  if(!url && body.responsable_publico_user_id===undefined)return Response.json({success:false,message:"No se recibieron cambios."},{status:400});
  await guardarIntegracion(empresaId,url,body.responsable_publico_user_id===undefined?undefined:responsable||null);
  // Al designar un responsable, recuperar incidencias públicas previas sin destinatario.
  if(responsable){
   const {error:assignError}=await supabaseAdmin.from("pulse_alertas_oportunidades")
    .update({responsable_user_id:responsable})
    .eq("empresa_id",empresaId).is("responsable_user_id",null)
    .in("estado",["esperando","pendiente"]);
   if(assignError)throw assignError;
  }
  return Response.json({success:true,message:"Configuración guardada correctamente."});
 }catch{return Response.json({success:false,message:"No fue posible guardar la configuración. Revisa la URL y las claves privadas."},{status:400});}
}
