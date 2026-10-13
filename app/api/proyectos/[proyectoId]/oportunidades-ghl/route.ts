// Endpoint legado no autenticado, deshabilitado por seguridad.
// Nuevo contrato: POST /api/integraciones/oportunidades/confirmar
// con Bearer y coincidencia de empresa + proyecto + reserva + número.
export async function POST(){
 return Response.json({success:false,message:"Esta integración fue reemplazada. Actualiza la configuración del proceso."},{status:410});
}
