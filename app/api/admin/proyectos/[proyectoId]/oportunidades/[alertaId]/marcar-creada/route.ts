import { requireProjectSalesAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props={params:Promise<{proyectoId:string;alertaId:string}>};
export async function POST(req:Request,{params}:Props){
 try{
  const {proyectoId,alertaId}=await params;
  const {proyecto,session,error}=await requireProjectSalesAccess(proyectoId);
  if(error||!proyecto||!session?.user_id)return error||Response.json({success:false,message:"Acceso denegado."},{status:403});
  const origin=req.headers.get("origin");
  if(origin&&origin!==new URL(req.url).origin)return Response.json({success:false,message:"Origen no autorizado."},{status:403});
  if(!/^[0-9a-fA-F-]{36}$/.test(alertaId))return Response.json({success:false,message:"Alerta inválida."},{status:400});
  const {data,error:rpcError}=await supabaseAdmin.rpc("pulse_marcar_alerta_manual",{
   p_alerta_id:alertaId,p_empresa_id:proyecto.empresa_id,p_proyecto_id:proyectoId,p_usuario_id:session.user_id
  });
  if(rpcError)throw rpcError;
  if(!data)return Response.json({success:false,message:"La alerta no está pendiente o no te pertenece."},{status:403});
  return Response.json({success:true,message:"Oportunidad marcada como creada."});
 }catch{return Response.json({success:false,message:"No fue posible confirmar la creación manual."},{status:500});}
}
