import "server-only";
import { sincronizarDisponibilidadesGoogleSheet } from "@/lib/google-sheets-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enviarReservaUnaVez } from "@/lib/reservation-webhook";
export type BoletaConfirmada={boleta_id:string;numero:string;comprobante_url:string|null};
export async function confirmarReservaPulse(input:{empresaId:string;proyectoId:string;numeros:string[];holdToken:string;vendedorUserId?:string|null;canal:"Oficina"|"Creacion Manual"|"Vendedores";usuarioId?:string|null;integrar:boolean}){
 const {data,error}=await supabaseAdmin.rpc("pulse_confirmar_reserva",{
  p_empresa_id:input.empresaId,p_proyecto_id:input.proyectoId,p_numeros:input.numeros,p_hold_token:input.holdToken,
  p_vendedor_user_id:input.vendedorUserId||null,p_canal:input.canal,p_usuario_id:input.usuarioId||null,p_con_integracion:input.integrar
 });
 if(error)throw error;
 const result=data as {expired:boolean;reserva_grupo?:string|null;confirmadas?:BoletaConfirmada[]};
 if(result.expired)return {expired:true,confirmadas:[],confirmadas_detalle:[],liberadas:[]};
 const boletas=result.confirmadas||[];
 if(!input.vendedorUserId){try{await sincronizarDisponibilidadesGoogleSheet(boletas.map(b=>({numero:b.numero,estado:"Debe"})));}catch{}}
 if(input.integrar&&result.reserva_grupo)await enviarReservaUnaVez(input.empresaId,input.proyectoId,result.reserva_grupo);
 return {expired:false,confirmadas:boletas.map(b=>b.numero),confirmadas_detalle:boletas,liberadas:[]};
}
