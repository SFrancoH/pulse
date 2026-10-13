"use client";

import { useCallback, useEffect, useState } from "react";

type Alerta={
 id:string;reserva_grupo:string;numero:string;nombre_cliente:string|null;
 telefono_cliente:string|null;email_cliente:string|null;ciudad_cliente:string|null;
 comprobante_url:string|null;canal:string|null;fecha_reserva:string;
 empresa_nombre:string;proyecto_nombre:string;valor:number;motivo:string|null;
};
type Respuesta={success:boolean;message?:string;cantidad?:number;alertas?:Alerta[]};
type Props={proyectoId:string;proyectoNombre:string};

export default function OpportunityErrorRecovery({proyectoId}:Props){
 const [alertas,setAlertas]=useState<Alerta[]>([]);
 const [seleccionada,setSeleccionada]=useState<string|null>(null);
 const [procesando,setProcesando]=useState(false);
 const [error,setError]=useState("");
 const [mensaje,setMensaje]=useState("");
 const consultar=useCallback(async()=>{
  try{
   const res=await fetch("/api/admin/proyectos/"+encodeURIComponent(proyectoId)+"/oportunidades-pendientes",{cache:"no-store"});
   const data=await res.json() as Respuesta;
   if(res.ok&&data.success)setAlertas(data.alertas||[]);
  }catch{ /* La siguiente consulta recupera la lista. */ }
 },[proyectoId]);

 useEffect(()=>{
  void consultar();
  const interval=window.setInterval(()=>void consultar(),30000);
  return ()=>window.clearInterval(interval);
 },[consultar]);

 const actual=alertas.find(a=>a.id===seleccionada)||null;
 async function copiar(value:string){
  try{await navigator.clipboard.writeText(value);setMensaje("Datos copiados.");setError("");}
  catch{setError("No fue posible copiar los datos.");}
 }
 function textoDatos(a:Alerta){
  return [
   "Nombre: "+(a.nombre_cliente||"No registrado"),
   "Teléfono: "+(a.telefono_cliente||"No registrado"),
   "Correo: "+(a.email_cliente||"No registrado"),
   "Ciudad: "+(a.ciudad_cliente||"No registrada"),
   "Empresa: "+a.empresa_nombre,
   "Proyecto: "+a.proyecto_nombre,
   "Número reservado: "+a.numero,
   "Valor de la boleta: "+Number(a.valor||0).toLocaleString("es-CO")+" COP",
   "Origen: "+(a.canal||"No registrado"),
   "Fecha de reserva: "+new Date(a.fecha_reserva).toLocaleString("es-CO"),
   "Referencia: "+a.reserva_grupo,
   "Boleta virtual: "+(a.comprobante_url||"No disponible")
  ].join("\n");
 }
 async function marcarCreada(){
  if(!actual||procesando)return;
  setProcesando(true);setError("");
  try{
   const res=await fetch("/api/admin/proyectos/"+encodeURIComponent(proyectoId)+"/oportunidades/"+encodeURIComponent(actual.id)+"/marcar-creada",{
    method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
   });
   const body=await res.json() as {success:boolean;message?:string};
   if(!res.ok||!body.success)throw Error(body.message||"No fue posible cerrar la alerta.");
   setAlertas(v=>v.filter(a=>a.id!==actual.id));setSeleccionada(null);setMensaje("Oportunidad marcada como creada.");
   await consultar();
  }catch(e){setError(e instanceof Error?e.message:"Error de conexión.");}
  finally{setProcesando(false);}
 }
 if(!alertas.length&&!actual)return null;
 return <div className="relative z-[1200]">
  {alertas.length>0&&!actual&&<button type="button" onClick={()=>{setSeleccionada(alertas[0].id);setError("");setMensaje("");}} className="fixed right-4 top-14 z-[1200] rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-2xl">
   ⚠ {alertas.length===1?"1 oportunidad pendiente":alertas.length+" oportunidades pendientes"}
  </button>}
  {actual&&<div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/80 p-3">
   <div className="flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-3xl bg-white text-[#1A1A1A] shadow-2xl">
    <div className="flex items-start justify-between gap-3 border-b border-[#E5DED5] p-5">
     <div><h2 className="text-xl font-bold text-red-700">Oportunidad pendiente de creación</h2>
      <p className="mt-2 text-sm">La reserva se registró correctamente en la web, pero no se ha creado la oportunidad.</p>
      <p className="mt-2 text-xs text-[#6F665C]">{alertas.length} {alertas.length===1?"alerta pendiente":"alertas pendientes"}</p>
     </div>
     <button type="button" onClick={()=>setSeleccionada(null)} className="rounded-full border px-3 py-2 font-semibold">Cerrar</button>
    </div>
    <div className="min-h-0 space-y-4 overflow-y-auto p-5">
     {alertas.length>1&&<div className="flex flex-wrap gap-2">{alertas.map(a=><button key={a.id} type="button" onClick={()=>{setSeleccionada(a.id);setError("");}} className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(a.id===actual.id?"bg-[#1A1A1A] text-white":"bg-white text-[#1A1A1A]")}>Boleta {a.numero}</button>)}</div>}
     <div className="grid gap-3 rounded-2xl border border-[#E5DED5] p-4 sm:grid-cols-2">
      {[
       ["Cliente",actual.nombre_cliente],["Teléfono",actual.telefono_cliente],
       ["Ciudad",actual.ciudad_cliente],["Correo",actual.email_cliente],
       ["Empresa",actual.empresa_nombre],["Proyecto",actual.proyecto_nombre],
       ["Número reservado",actual.numero],["Valor",Number(actual.valor||0).toLocaleString("es-CO")+" COP"],
       ["Origen",actual.canal],["Fecha",new Date(actual.fecha_reserva).toLocaleString("es-CO")],
       ["Referencia",actual.reserva_grupo]
      ].map(([label,value])=><div key={label} className="min-w-0"><p className="text-xs text-[#7A7066]">{label}</p><p className="break-all text-sm font-semibold">{value||"No registrado"}</p></div>)}
     </div>
     {actual.comprobante_url&&<div className="grid gap-2 sm:grid-cols-2">
      <a href={actual.comprobante_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#1A1A1A] px-4 py-3 text-center text-sm font-semibold">Ver boleta</a>
      <button type="button" onClick={()=>void copiar(actual.comprobante_url||"")} className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-semibold text-white">Copiar boleta virtual</button>
     </div>}
     <div className="rounded-xl bg-[#F5F2ED] p-4 text-sm">
      <h3 className="font-bold">Acción requerida</h3>
      <p className="mt-2">Busca al usuario En contactos y crea la oportunidad de forma manual, recuerda que es una oportunidad por numero reservado.</p>
      <ol className="mt-3 list-inside list-decimal space-y-1">
       <li>Ve a Contactos y busca al usuario por su teléfono.</li>
       <li>Verifica si ya existe una oportunidad para esta boleta.</li>
       <li>Si no existe, crea la oportunidad de forma manual.</li>
       <li>Regresa a PULSE y pulsa «Marcar como creada».</li>
      </ol>
     </div>
     {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     {mensaje&&<p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{mensaje}</p>}
     <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={()=>void copiar(textoDatos(actual))} className="rounded-xl border border-[#1A1A1A] px-4 py-3 font-bold">Copiar todos los datos</button>
      <button type="button" disabled={procesando} onClick={()=>void marcarCreada()} className="rounded-xl bg-[#E8620A] px-4 py-3 font-bold text-white disabled:opacity-50">{procesando?"Guardando...":"Marcar como creada"}</button>
     </div>
    </div>
   </div>
  </div>}
 </div>;
}
