import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const file=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("los tres canales comparten confirmación segura con rutas distintas",()=>{
 const admin=file("app/api/admin/proyectos/[proyectoId]/reserva-temporal/route.ts");
 const office=file("app/api/public/project-sales/[token]/reserva-temporal/route.ts");
 const seller=file("app/api/public/sales-links/[token]/reserva-temporal/route.ts");
 assert.match(admin,/confirmarReservaPulse/);
 assert.match(admin,/integrar:true/);
 assert.match(admin,/usuarioId:session!/);
 assert.match(office,/confirmarReservaPulse/);
 assert.match(office,/integrar:true/);
 assert.match(seller,/confirmarReservaPulse/);
 assert.match(seller,/integrar:false/);
});
test("la experiencia de venta no carga formularios y ofrece comprobantes por número",()=>{
 const component=file("components/ProyectoVentaReservaClient.tsx");
 assert.doesNotMatch(component,/<iframe/);
 assert.doesNotMatch(component,/formularioCompraUrl/);
 assert.match(component,/confirmadas_detalle/);
 assert.match(component,/comprobante_url/);
 assert.match(component,/Ver boleta/);
 assert.match(component,/Copiar boleta virtual/);
});
test("el envío privado es único y recuperable de forma manual, nunca por reintento",()=>{
 const code=file("lib/reservation-webhook.ts");
 assert.match(code,/\.eq\("estado","pendiente"\)/);
 assert.match(code,/estado:"enviando"/);
 assert.equal((code.match(/\bfetch\(/g)||[]).length,1);
 assert.match(code,/estado:"incierto"/);
 assert.match(code,/comprobante_url_/);
 assert.match(code,/consecutivo_/);
 assert.doesNotMatch(code,/NEXT_PUBLIC_/);
});
test("las alertas pertenecen a una persona y se resuelven individualmente",()=>{
 const read=file("app/api/admin/proyectos/[proyectoId]/oportunidades-pendientes/route.ts");
 const close=file("app/api/admin/proyectos/[proyectoId]/oportunidades/[alertaId]/marcar-creada/route.ts");
 const schema=file("supabase/production/20261013_01_reservas_webhook_alertas.sql");
 assert.match(read,/responsable_user_id/);
 assert.match(read,/session\.user_id/);
 assert.match(close,/pulse_marcar_alerta_manual/);
 assert.match(schema,/UNIQUE \(boleta_id, reserva_grupo\)/);
 assert.match(schema,/pulse_confirmar_reserva/);
 assert.match(schema,/pulse_eliminar_proyecto_con_reservas/);
});
test("la configuración privada nunca devuelve el secreto al navegador",()=>{
 const ui=file("app/admin/empresas/[empresaId]/integracion/page.tsx");
 const api=file("app/api/admin/empresas/[empresaId]/integracion/route.ts");
 assert.match(ui,/type="password"/);
 assert.match(api,/configurada:Boolean/);
 assert.doesNotMatch(api,/webhook_url_cifrada:conf\.data/);
});
