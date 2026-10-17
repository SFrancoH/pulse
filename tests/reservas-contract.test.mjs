import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import vm from "node:vm";
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

// Sorteos por proyecto: pruebas reales del parser + contratos de UI y seguridad.
const drawsSource = file("lib/project-draws.ts");
const drawsJs = ts.transpileModule(drawsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { validarSorteos, leerSorteos } = await import(
  "data:text/javascript;base64," + Buffer.from(drawsJs).toString("base64")
);
test("calendario obligatorio: un premio mayor y N anticipados antes de él",()=>{
  assert.deepEqual(validarSorteos({
    premio_mayor:"2026-12-31T20:00",anticipados:["2026-11-20T18:00","2026-10-20T12:00"],
  }), {
    premio_mayor:"2026-12-31T20:00:00-05:00",
    anticipados:["2026-10-20T12:00:00-05:00","2026-11-20T18:00:00-05:00"],
  });
  assert.deepEqual(validarSorteos({premio_mayor:"2027-01-01T18:00",anticipados:[]}).anticipados,[]);
  assert.throws(()=>validarSorteos({premio_mayor:"",anticipados:[]}));
  assert.throws(()=>validarSorteos({premio_mayor:"2026-02-30T20:00",anticipados:[]}));
  assert.throws(()=>validarSorteos({premio_mayor:"2026-12-31T20:00",anticipados:["2027-01-01T10:00"]}));
  assert.throws(()=>validarSorteos({premio_mayor:"2026-12-31T20:00",anticipados:["2026-11-01T12:00","2026-11-01T12:00"]}));
  assert.equal(leerSorteos(null),null);
  assert.equal(leerSorteos({premio_mayor:"2026-12-31T20:00:00-05:00",anticipados:[]}).premio_mayor,"2026-12-31T20:00:00-05:00");
});
test("sorteos visibles entre flyer y consecutivos en los tres canales, sin hardcode del nuevo proyecto",()=>{
 const hero=file("components/ProyectoSalesHero.tsx");
 for(const path of ["app/o/[token]/page.tsx","app/p/[token]/page.tsx","app/admin/proyectos/[proyectoId]/ventas/page.tsx"]){
   const code=file(path);
   assert.match(code,/leerSorteosProyecto/);
   assert.match(code,/sorteos=\{sorteos\}/);
   assert.ok(code.indexOf("<ProyectoSalesHero")<code.indexOf("<ProyectoVentaReserva"));
 }
 assert.match(hero,/anticipados\.map/);
 assert.match(hero,/title=\{`Anticipado \$\{index \+ 1\}`\}/);
 assert.match(hero,/Premio mayor/);
 assert.match(hero,/Fecha por anunciar/);
 assert.match(hero,/timeZone: "America\/Bogota"/);
 const api=file("app/api/crear-proyecto/route.ts");
 assert.match(api,/validarSorteos\(body\.sorteos\)/);
 assert.match(api,/sorteos_config: sorteos/);
 const panel=file("app/admin/page.tsx");
 const create=file("app/admin/crear-proyecto/page.tsx");
 assert.match(panel,/SorteosFields value=\{formSorteos\}/);
 assert.match(create,/SorteosFields value=\{sorteos\}/);
 assert.match(panel,/Configurar premio mayor y anticipados/);
});
test("ganadores se administran por empresa y conservan historiales anteriores",()=>{
 const api=file("app/api/admin/empresas/[empresaId]/ganadores/route.ts");
 const reader=file("lib/previous-winners.ts");
 assert.match(api,/requireCompanyManagerSession/);
 assert.match(api,/canAccessEmpresa/);
 assert.match(api,/\.eq\("empresa_id", empresaId\)/);
 assert.match(api,/numero ~|\^\\d\{4\}\$/);
 assert.match(reader,/from\("ganadores"\)/);
 assert.doesNotMatch(reader,/pulse_ganadores_publicos/);
 assert.match(api,/from\("ganadores"\)/);
 assert.doesNotMatch(api,/pulse_ganadores_publicos/);
 const sql=file("supabase/production/20261015_01_sorteos_y_ganadores_publicos.sql");
 assert.match(sql,/ADD COLUMN IF NOT EXISTS sorteos_config jsonb/);
 assert.doesNotMatch(sql,/CREATE TABLE.*(?:pulse_ganadores_publicos|ganadores)/i);
 assert.doesNotMatch(sql,/ALTER TABLE public.ganadores/i);
 assert.match(reader,/\.eq\("empresa_id", empresaId\)/);
 assert.match(file("app/admin/page.tsx"),/Agregar ganadores/);
 assert.match(file("app/admin/empresas/[empresaId]/ganadores/page.tsx"),/Enlace del flyer/);
});

// Webhook de saldo unificado: pruebas de comportamiento de parsing, montos y Bearer.
const boletaSource = file("lib/ghl-boleta-update-payload.ts");
const boletaJs = ts.transpileModule(boletaSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { extraerActualizacionBoleta, extraerSolicitudNumerosAleatorios, importeTotalCop, validarBearerBoleta } = await import(
  "data:text/javascript;base64," + Buffer.from(boletaJs).toString("base64")
);
test("GHL: ruta de saldo acepta JSON plano, customData, custom_data, mixed y claves prefijadas",()=>{
 const base={
  empresa_id:"empresa-a",proyecto_id:"proyecto-b",numero:"7697",estado:"Abonado",
  valor_pagado:"30.000"
 };
 const variants=[base,{customData:base},{custom_data:{...base,numero:"7697"}},
  {custom_fields:{...base,numero:"7697",estado:"abonada"}},
  {empresa_id:"empresa-a",customData:{proyecto_id:"proyecto-b",numero:7697,estado:"ABONADO",valor_pagado:30000}},
  Object.fromEntries(Object.entries(base).map(([key,v])=>["customData."+key,v])),
 ];
 for(const variant of variants){
  const actual=extraerActualizacionBoleta(variant);
  assert.deepEqual(actual.campos_invalidos,[]);
  assert.deepEqual([actual.empresa_id,actual.proyecto_id,actual.numero,actual.estado,actual.valor_pagado],
    ["empresa-a","proyecto-b","7697","Abonado",30000]);
 }
 assert.equal(extraerActualizacionBoleta({...base,numero:"5"}).numero,"0005");
});
test("GHL: validar importe COP total con agrupadores y sin degradar errores a cero",()=>{
 const buenos=[["30000",30000],[30000,30000],["30.000",30000],["30,000",30000],["30000.00",30000],
 ["30.000,00",30000],["30,000.00",30000],["COP $ 30.000",30000],["0",0]];
 for(const [input,expected] of buenos)assert.equal(importeTotalCop(input),expected,String(input));
 for(const input of ["",null,"abc","$","-20000","30.000.000.000.000.000","12.34.567"])assert.equal(importeTotalCop(input),null,String(input));
});
test("GHL: importes o IDs ausentes y estados ajenos devuelven nombres de campos inválidos",()=>{
 const base={empresa_id:"empresa-a",proyecto_id:"proyecto-b",numero:"7697",estado:"Abonado",valor_pagado:30000};
 assert.deepEqual(extraerActualizacionBoleta({}).campos_invalidos,["empresa_id","proyecto_id","numero","estado","valor_pagado"]);
 assert.deepEqual(extraerActualizacionBoleta({...base,valor_pagado:"no aplica"}).campos_invalidos,["valor_pagado"]);
 assert.deepEqual(extraerActualizacionBoleta({...base,numero:"12345"}).campos_invalidos,["numero"]);
 assert.deepEqual(extraerActualizacionBoleta({...base,estado:"X"}).campos_invalidos,["estado"]);
 assert.deepEqual(extraerActualizacionBoleta({...base,empresa_id:""}).campos_invalidos,["empresa_id"]);
});
test("GHL: Bearer obligatorio; ni ausencia, token errado o corto autorizan escritura",()=>{
 const secret="s".repeat(48);
 assert.equal(validarBearerBoleta(new Request("https://example.com",{headers:{Authorization:"Bearer "+secret}}),secret),true);
 for(const auth of ["","Bearer otro","Basic "+secret,"Bearer "+secret+"x"]){
  assert.equal(validarBearerBoleta(new Request("https://example.com",{headers:{Authorization:auth}}),secret),false);
 }
 assert.equal(validarBearerBoleta(new Request("https://example.com",{headers:{Authorization:"Bearer corto"}}),"corto"),false);
});
test("GHL: endpoint financiero exige empresa, proyecto y número, y URL estable para nuevos proyectos",()=>{
 const route=file("app/api/integraciones/boletas/actualizar/route.ts");
 const create=file("app/api/crear-proyecto/route.ts");
 assert.match(route,/validarBearerBoleta\(req, process\.env\.PULSE_CALLBACK_SECRET/);
 assert.match(route,/extraerActualizacionBoleta\(body\)/);
 assert.match(route,/campos_invalidos: campos\.campos_invalidos/);
 assert.match(route,/\.eq\("empresa_id", empresa_id\)/);
 assert.match(route,/\.eq\("proyecto_id", proyecto_id\)/);
 assert.match(route,/\.eq\("numero", numero\)/);
 assert.match(route,/valor_pagado/);
 assert.doesNotMatch(route,/syncronizar|sincronizarDisponibilidadGoogleSheet/);
 assert.doesNotMatch(route,/received_payload|console\.log/);
 assert.match(create,/\`\$\{BASE_URL\}\/api\/integraciones\/boletas\/actualizar\`/);
});

// Pruebas aisladas de ejecución real de POST. No conectan a Supabase Production.
test("webhook fijo: autorización, validación, correlación tenant y escritura del total",async()=>{
 const secret = "x".repeat(48);
 const llamadas = [];
 const registros = {empresa_id:"empresa-a",proyecto_id:"sorteo-2026",numero:"0005"};
 const supabaseAdmin = {
   from(table){
     assert.equal(table,"boletas");
     const query={filters:[],cambios:null};
     return {
       update(cambios){query.cambios=cambios;return this;},
       eq(key,value){query.filters.push([key,value]);return this;},
       select(){return this;},
       async maybeSingle(){
         llamadas.push(query);
         const coincide = query.filters.every(([key,value])=>registros[key]===value);
         return {data:coincide?{id:"test-boleta",...registros,...query.cambios}:null,error:null};
       },
     };
   },
 };
 const routeCode=ts.transpileModule(file("app/api/integraciones/boletas/actualizar/route.ts"),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 const ctx={
   exports:{},process:{env:{PULSE_CALLBACK_SECRET:secret}},Response,
   require(name){
     if(name==="@/lib/supabase-admin")return {supabaseAdmin};
     if(name==="@/lib/ghl-boleta-update-payload")return {extraerActualizacionBoleta,validarBearerBoleta};
     throw Error("Unexpected dependency "+name);
   },
 };
 vm.runInNewContext(routeCode,ctx,{timeout:3000});
 const post=ctx.exports.POST;
 const endpoint="https://example.com/api/integraciones/boletas/actualizar";
 const datos={empresa_id:"empresa-a",proyecto_id:"sorteo-2026",numero:"0005",estado:"Abonado",valor_pagado:"30.000"};
 async function enviar(data,token=secret){
   const req=new Request(endpoint,{method:"POST",headers:{
     "Content-Type":"application/json",Authorization:token?"Bearer "+token:"",
   },body:JSON.stringify({customData:data})});
   const response=await post(req);
   return {status:response.status,data:await response.json()};
 }
 const unauthorized=await enviar(datos,"");
 assert.equal(unauthorized.status,401);
 assert.equal(llamadas.length,0);
 const malformed=await enviar({...datos,valor_pagado:"equivocado"});
 assert.equal(malformed.status,400);
 assert.deepEqual(malformed.data.campos_invalidos,["valor_pagado"]);
 assert.equal(llamadas.length,0);
 const other=await enviar({...datos,empresa_id:"otra-empresa"});
 assert.equal(other.status,404);
 assert.equal(llamadas.length,1);
 const ok=await enviar(datos);
 assert.equal(ok.status,200);
 assert.equal(ok.data.success,true);
 assert.equal(ok.data.modo_valor,"total_acumulado");
 assert.equal(ok.data.boleta.valor_pagado,30000);
 assert.deepEqual(llamadas.at(-1).filters,[
   ["empresa_id","empresa-a"],["proyecto_id","sorteo-2026"],["numero","0005"],
 ]);
 assert.equal(llamadas.at(-1).cambios.valor_pagado,30000);
 assert.equal(llamadas.at(-1).cambios.estado,"Abonado");
});
test("webhook heredado: mantiene compatibilidad hasta activar el interruptor de cierre",()=>{
 const source=file("app/api/proyectos/[proyectoId]/actualizar-boleta/route.ts");
 assert.match(source,/PULSE_LEGACY_BOLETA_UPDATE_DISABLED/);
 assert.match(source,/status: 410/);
});

test("GHL: liberar admite pago omitido en Disponible y rechaza monto no cero",()=>{
 const base={empresa_id:"empresa-a",proyecto_id:"sorteo-2026",numero:"0005",estado:"Disponible"};
 for(const variant of [base,{customData:base},{custom_data:base},{custom_fields:base}]){
  const actual=extraerActualizacionBoleta(variant);
  assert.deepEqual(actual.campos_invalidos,[]);
  assert.equal(actual.estado,"Disponible");
  assert.equal(actual.valor_pagado,0);
 }
 const conAbono=extraerActualizacionBoleta({...base,valor_pagado:20000});
 assert.deepEqual(conAbono.campos_invalidos,["valor_pagado"]);
 assert.deepEqual(extraerActualizacionBoleta({...base,estado:"Abonado"}).campos_invalidos,["valor_pagado"]);
});
test("GHL: números aleatorios leen IDs y cantidad desde campos mixtos, máximos y errores",()=>{
 const base={empresa_id:"empresa-a",proyecto_id:"sorteo-2026",cantidad:150};
 const casos=[
  base,{customData:base},{custom_data:base},{custom_fields:base},
  {empresa_id:"empresa-a",customData:{proyecto_id:"sorteo-2026",cantidad:150}},
  Object.fromEntries(Object.entries(base).map(([k,v])=>["customData."+k,v])),
 ];
 for(const caso of casos){
  const r=extraerSolicitudNumerosAleatorios(caso);
  assert.deepEqual(r.campos_invalidos,[]);
  assert.deepEqual([r.empresa_id,r.proyecto_id,r.cantidad,r.formato],
   ["empresa-a","sorteo-2026",150,"json"]);
 }
 assert.equal(extraerSolicitudNumerosAleatorios({...base,cantidad:999}).cantidad,150);
 assert.equal(extraerSolicitudNumerosAleatorios({empresa_id:"empresa-a",proyecto_id:"sorteo-2026"}).cantidad,150);
 assert.equal(extraerSolicitudNumerosAleatorios({...base,cantidad:3,formato:"texto"}).formato,"texto");
 assert.deepEqual(extraerSolicitudNumerosAleatorios({}).campos_invalidos,["empresa_id","proyecto_id"]);
 assert.deepEqual(extraerSolicitudNumerosAleatorios({...base,cantidad:0}).campos_invalidos,["cantidad"]);
 assert.deepEqual(extraerSolicitudNumerosAleatorios({...base,cantidad:"-1"}).campos_invalidos,["cantidad"]);
 assert.deepEqual(extraerSolicitudNumerosAleatorios({...base,cantidad:"abc"}).campos_invalidos,["cantidad"]);
 assert.deepEqual(extraerSolicitudNumerosAleatorios({...base,formato:"invalido"}).campos_invalidos,["formato"]);
});
test("GHL: ruta fija consulta máximo 150 números libres de empresa y proyecto exactos",async()=>{
 const secret="r".repeat(40);
 const calls=[];
 const rows=Array.from({length:180},(_,i)=>({
  numero:String(i).padStart(4,"0"),
  empresa_id:"empresa-a",proyecto_id:"proyecto-a",estado:"Disponible",
  nombre_cliente:null,telefono_cliente:null,valor_pagado:0,
  vendedor_nombre:"Oficina",vendedor_user_id:null,
 }));
 rows.push({numero:"9001",empresa_id:"otra",proyecto_id:"proyecto-a",estado:"Disponible",
  nombre_cliente:null,telefono_cliente:null,valor_pagado:0,vendedor_nombre:"Oficina",vendedor_user_id:null});
 rows.push({numero:"9002",empresa_id:"empresa-a",proyecto_id:"otro",estado:"Disponible",
  nombre_cliente:null,telefono_cliente:null,valor_pagado:0,vendedor_nombre:"Oficina",vendedor_user_id:null});
 rows.push({numero:"9003",empresa_id:"empresa-a",proyecto_id:"proyecto-a",estado:"Disponible",
  nombre_cliente:"Comprador",telefono_cliente:null,valor_pagado:0,vendedor_nombre:"Oficina",vendedor_user_id:null});
 rows.push({numero:"9004",empresa_id:"empresa-a",proyecto_id:"proyecto-a",estado:"Disponible",
  nombre_cliente:null,telefono_cliente:null,valor_pagado:0,vendedor_nombre:"Vendedor",vendedor_user_id:"seller"});
 const supabaseAdmin={
  from(table){
   const f=[],query={f,table};
   return {
    select(){return this;},
    eq(key,value){f.push(["eq",key,value]);return this;},
    is(key,value){f.push(["is",key,value]);return this;},
    or(value){f.push(["or",value]);return this;},
    order(){return this;},
    limit(n){query.limit=n;return this;},
    async maybeSingle(){
     calls.push(query);
     return {data: f.some(([op,key,val])=>op==="eq"&&key==="empresa_id"&&val==="empresa-a") &&
             f.some(([op,key,val])=>op==="eq"&&key==="id"&&val==="proyecto-a")?{id:"proyecto-a"}:null,error:null};
    },
    then(resolve,reject){
     calls.push(query);
     const filtered=rows.filter(row=>f.every(([op,key,value])=>{
      if(op==="eq")return row[key]===value;
      if(op==="is")return row[key]===value;
      if(op==="or")return row.nombre_cliente===null && row.telefono_cliente===null && row.valor_pagado===0;
      return false;
     }));
     return Promise.resolve({data:filtered.slice(0,query.limit),error:null}).then(resolve,reject);
    },
   };
  },
 };
 const code=ts.transpileModule(file("app/api/integraciones/boletas/numeros-aleatorios/route.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 const ctx={
  exports:{},process:{env:{PULSE_CALLBACK_SECRET:secret}},Response,URL,Math,
  require(name){
   if(name==="@/lib/supabase-admin")return {supabaseAdmin};
   if(name==="@/lib/boleta-availability")return {BOLETA_LIBRE_FILTER:"and(...)"};
   if(name==="@/lib/ghl-boleta-update-payload")return {extraerSolicitudNumerosAleatorios,validarBearerBoleta};
   throw Error(name);
  },
 };
 vm.runInNewContext(code,ctx,{timeout:3000});
 const post=ctx.exports.POST;
 async function enviar(data,secretHeader=secret){
  const req=new Request("https://example.test/api/integraciones/boletas/numeros-aleatorios",{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:secretHeader?"Bearer "+secretHeader:""},
   body:JSON.stringify({customData:data}),
  });
  const res=await post(req);
  return {status:res.status,body:res.headers.get("content-type")?.startsWith("text/plain")?
   await res.text():await res.json(),headers:res.headers};
 }
 const base={empresa_id:"empresa-a",proyecto_id:"proyecto-a",cantidad:150};
 assert.equal((await enviar(base,"")).status,401);
 assert.equal(calls.length,0);
 const wrong=await enviar({...base,proyecto_id:"otro"});
 assert.equal(wrong.status,404);
 assert.equal(calls.length,1);
 const out=await enviar(base);
 assert.equal(out.status,200);
 assert.equal(out.body.success,true);
 assert.equal(out.body.proyecto_id,"proyecto-a");
 assert.equal(out.body.cantidad_solicitada,150);
 assert.equal(out.body.cantidad_encontrada,150);
 assert.equal(out.body.numeros.length,150);
 assert.equal(new Set(out.body.numeros).size,150);
 assert.ok(out.body.numeros.every(x=>Number(x)<180));
 assert.equal(out.body.grupos.length,3);
 assert.ok(out.body.grupos.every(g=>g.length===50));
 assert.equal(out.body.numeros_texto,out.body.grupos.map(g=>g.join(" - ")).join(" | "));
 assert.equal(out.headers.get("cache-control"),"no-store");
 assert.deepEqual(calls.at(-1).f.filter(([op])=>op==="eq"),[
  ["eq","empresa_id","empresa-a"],["eq","proyecto_id","proyecto-a"],
  ["eq","estado","Disponible"],["eq","vendedor_nombre","Oficina"],
 ]);
 assert.ok(calls.at(-1).f.some(([op,key])=>op==="is"&&key==="vendedor_user_id"));
 const short=await enviar({...base,cantidad:7});
 assert.equal(short.body.numeros.length,7);
 const textResult=await enviar({...base,cantidad:3,formato:"texto"});
 assert.equal(textResult.status,200);
 assert.equal(typeof textResult.body,"string");
 assert.equal(textResult.body.split("|").length,3);
});
test("GHL: liberación fija limpia ocupación, preserva comprobante y protege ventas",async()=>{
 const secret="w".repeat(48);
 const boleta={id:"b1",empresa_id:"empresa-a",proyecto_id:"proyecto-a",numero:"0005",
  estado:"Debe",valor_pagado:0,vendedor_nombre:"Oficina",vendedor_user_id:null,
  nombre_cliente:"Prueba",telefono_cliente:"3000000000",comprobante_url:"https://test/boleta/b1"};
 const queries=[];
 const supabaseAdmin={
  from(table){
   assert.equal(table,"boletas");
   const query={f:[],updateData:null};
   return {
    select(){return this;},
    eq(key,value){query.f.push(["eq",key,value]);return this;},
    in(key,value){query.f.push(["in",key,value]);return this;},
    or(value){query.f.push(["or",value]);return this;},
    is(key,value){query.f.push(["is",key,value]);return this;},
    update(value){query.updateData=value;return this;},
    async maybeSingle(){
     queries.push(query);
     const eqMatch=query.f.filter(([op])=>op==="eq").every(([,key,value])=>boleta[key]===value);
     if(!eqMatch)return {data:null,error:null};
     if(query.updateData){
      if(boleta.valor_pagado>0 || boleta.vendedor_user_id || ["Pagado","Abonado"].includes(boleta.estado))return {data:null,error:null};
      Object.assign(boleta,query.updateData);
     }
     return {data:{...boleta},error:null};
    },
   };
  },
 };
 const code=ts.transpileModule(file("app/api/integraciones/boletas/actualizar/route.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 const ctx={
  exports:{},process:{env:{PULSE_CALLBACK_SECRET:secret}},Response,Date,
  require(name){
   if(name==="@/lib/supabase-admin")return {supabaseAdmin};
   if(name==="@/lib/ghl-boleta-update-payload")return {extraerActualizacionBoleta,validarBearerBoleta};
   throw Error(name);
  },
 };
 vm.runInNewContext(code,ctx,{timeout:3000});
 const post=ctx.exports.POST;
 async function enviar(data,auth=secret){
  const req=new Request("https://test/api/integraciones/boletas/actualizar",{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:auth?"Bearer "+auth:""},
   body:JSON.stringify({custom_data:data}),
  });
  const response=await post(req);
  return {status:response.status,data:await response.json()};
 }
 const base={empresa_id:"empresa-a",proyecto_id:"proyecto-a",numero:"0005",estado:"Disponible"};
 assert.equal((await enviar(base,"")).status,401);
 assert.equal(queries.length,0);
 const out=await enviar(base);
 assert.equal(out.status,200);
 assert.equal(out.data.success,true);
 assert.equal(out.data.boleta.estado,"Disponible");
 assert.equal(boleta.valor_pagado,0);
 assert.equal(boleta.nombre_cliente,null);
 assert.equal(boleta.telefono_cliente,null);
 assert.equal(boleta.email_cliente,null);
 assert.equal(boleta.vendedor_nombre,"Oficina");
 assert.equal(boleta.comprobante_url,"https://test/boleta/b1");
 assert.equal(queries.length,2);
 assert.ok(queries[1].f.some(([op,key])=>op==="in"&&key==="estado"));
 assert.ok(queries[1].f.some(([op,key])=>op==="is"&&key==="vendedor_user_id"));
 const again=await enviar(base);
 assert.equal(again.status,200);
 boleta.estado="Pagado";boleta.valor_pagado=30000;
 const paid=await enviar(base);
 assert.equal(paid.status,409);
 assert.equal(paid.data.code,"BOLETA_CON_ABONOS");
 assert.equal(boleta.valor_pagado,30000);
 boleta.estado="Debe";boleta.valor_pagado=0;boleta.vendedor_user_id="seller";
 const seller=await enviar(base);
 assert.equal(seller.status,409);
 assert.equal(seller.data.code,"BOLETA_ASIGNADA_VENDEDOR");
 const missing=await enviar({...base,proyecto_id:"otro"});
 assert.equal(missing.status,404);
});
