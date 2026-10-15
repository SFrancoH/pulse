import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
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
 assert.match(code,/,"incierto",/);
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
 assert.match(api,/from\("empresas"\)/);
 assert.doesNotMatch(api,/webhook_url_cifrada:conf\.data/);
});

test("la base de datos ofrece ver y copiar URL auténtica por boleta antes de actualizar",()=>{
 const api=file("app/api/admin/proyectos/[proyectoId]/boletas/route.ts");
 const ui=file("app/admin/proyectos/[proyectoId]/base-datos/page.tsx");
 assert.match(api,/select\("id,numero,estado,[^"]*comprobante_url"\)/);
 assert.match(ui,/comprobante_url: string \| null/);
 assert.match(ui,/Omit<Boleta, "id" \| "numero" \| "comprobante_url">/);
 assert.match(ui,/enlaceDeBoleta\(b\.comprobante_url\)/);
 assert.match(ui,/navigator\.clipboard\.writeText\(enlace\)/);
 assert.match(ui,/target="_blank"/);
 assert.match(ui,/rel="noopener noreferrer"/);
 assert.match(ui,/disabled=\{!enlace\}/);
 assert.ok(ui.indexOf("Ver boleta",ui.indexOf('const enlace = enlaceDeBoleta(b.comprobante_url)')) < ui.indexOf("Copiar boleta",ui.indexOf('const enlace = enlaceDeBoleta(b.comprobante_url)')));
 assert.ok(ui.indexOf("Copiar boleta",ui.indexOf('const enlace = enlaceDeBoleta(b.comprobante_url)')) < ui.indexOf("Actualizar",ui.indexOf('const enlace = enlaceDeBoleta(b.comprobante_url)')));
 assert.doesNotMatch(ui,/PUBLIC_BOLETA_BASE_URL/);
});

// Pruebas ejecutables del contrato de recepción GHL; no solo regex sobre el código.
const ghLCodigo = file("lib/ghl-callback-payload.ts");
const ghLJs = ts.transpileModule(ghLCodigo, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { extraerConfirmacionGhl } = await import(
  "data:text/javascript;base64," + Buffer.from(ghLJs).toString("base64")
);
const identificadores = {
  empresa_id: "empresa-ejemplo",
  proyecto_id: "proyecto-ejemplo",
  reserva_grupo: "22222222-2222-4222-8222-222222222222",
};
test("contrato GHL: JSON plano y Custom Data producen la misma confirmación",()=>{
  const raiz={...identificadores,numero:"0045",estado:"creada"};
  const casos=[
    raiz,
    {customData:{...identificadores,numero:"0045",estado:"Creada"}},
    {custom_data:{...identificadores,consecutivo_1:"0045",estado:"CREADA"}},
    {custom_fields:{...identificadores,numero:"0045",estado:"creada"}},
    {empresa_id:identificadores.empresa_id,customData:{
      proyecto_id:identificadores.proyecto_id,
      reserva_grupo:identificadores.reserva_grupo,
      consecutivo_1:"0045",estado:"Creada"
    }},
    Object.fromEntries(Object.entries(raiz).map(([clave,valor])=>["customData."+clave,valor])),
  ];
  const esperado={empresa:identificadores.empresa_id,proyecto:identificadores.proyecto_id,grupo:identificadores.reserva_grupo,numero:"0045",estado:"creada",camposInvalidos:[]};
  for(const body of casos)assert.deepEqual(extraerConfirmacionGhl(body),esperado);
});
test("contrato GHL: no aceptar números alterados, campos ausentes ni estados desconocidos",()=>{
  const base={...identificadores,numero:"0045",estado:"fallida"};
  assert.deepEqual(extraerConfirmacionGhl({customData:base}).camposInvalidos,[]);
  assert.deepEqual(extraerConfirmacionGhl(null).camposInvalidos,["empresa_id","proyecto_id","reserva_grupo","numero","estado"]);
  assert.deepEqual(extraerConfirmacionGhl({customData:{...base,numero:"45"}}).camposInvalidos,["numero"]);
  assert.deepEqual(extraerConfirmacionGhl({...base,numero:45}).camposInvalidos,["numero"]);
  assert.deepEqual(extraerConfirmacionGhl({...base,estado:"pagada"}).camposInvalidos,["estado"]);
  assert.deepEqual(extraerConfirmacionGhl({...base,reserva_grupo:" "}).camposInvalidos,["reserva_grupo"]);
});
test("contrato GHL: la ruta mantiene autenticación, filtros y diagnóstico sin exponer datos",()=>{
 const callback=file("app/api/integraciones/oportunidades/confirmar/route.ts");
 assert.match(callback,/extraerConfirmacionGhl\(await req\.json\(\)\)/);
 assert.match(callback,/campos_invalidos: camposInvalidos/);
 assert.match(callback,/timingSafeEqual/);
 assert.match(callback,/if \(!autorizado\(req\)\)/);
 assert.match(callback,/\.eq\("reserva_grupo", grupo\)/);
 assert.match(callback,/\.in\("canal", \["Oficina", "Creacion Manual"\]\)/);
 assert.doesNotMatch(callback,/console\.log/);
});
