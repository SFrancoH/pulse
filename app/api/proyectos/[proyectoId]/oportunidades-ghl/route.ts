import { POST as legacyPOST } from "@/lib/legacy-oportunidades-ghl";

// Endpoint legado no autenticado, deshabilitado por seguridad.
// Nuevo contrato: POST /api/integraciones/oportunidades/confirmar
// con Bearer y coincidencia de empresa + proyecto + reserva + número.
export async function POST(req: Request, context: {params:Promise<{proyectoId:string}>}){
 if(process.env.PULSE_RESERVAS_V2 !== "enabled") return legacyPOST(req,context);
 return Response.json({success:false,message:"Esta integración fue reemplazada. Actualiza la configuración del proceso."},{status:410});
}
