"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Admin={id:string;nombre:string|null;email:string};
type Config={success:boolean;message?:string;empresa_nombre?:string;configurada?:boolean;responsable_publico_user_id?:string|null;administradores?:Admin[]};

export default function IntegracionEmpresaPage(){
 const {empresaId}=useParams<{empresaId:string}>();
 const [config,setConfig]=useState<Config|null>(null);
 const [url,setUrl]=useState("");
 const [responsable,setResponsable]=useState("");
 const [guardando,setGuardando]=useState(false);
 const [error,setError]=useState("");
 const [mensaje,setMensaje]=useState("");
 async function cargar(){
  try{
   const res=await fetch("/api/admin/empresas/"+encodeURIComponent(empresaId)+"/integracion",{cache:"no-store"});
   const data=await res.json() as Config;
   if(!res.ok||!data.success)throw Error(data.message||"No fue posible consultar la empresa.");
   setConfig(data);setResponsable(data.responsable_publico_user_id||"");
  }catch(e){setError(e instanceof Error?e.message:"Error al consultar.");}
 }
 useEffect(()=>{void cargar();},[empresaId]);
 async function guardar(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setGuardando(true);setError("");setMensaje("");
  try{
   const res=await fetch("/api/admin/empresas/"+encodeURIComponent(empresaId)+"/integracion",{
    method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({webhook_url:url.trim(),responsable_publico_user_id:responsable||null})
   });
   const data=await res.json() as Config;
   if(!res.ok||!data.success)throw Error(data.message||"No fue posible guardar.");
   setUrl("");setMensaje("Configuración guardada.");await cargar();
  }catch(e){setError(e instanceof Error?e.message:"Error al guardar.");}
  finally{setGuardando(false);}
 }
 return <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#1A1A1A]">
  <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
   <header className="bg-[#1A1A1A] p-6 text-white"><p className="text-sm text-white/70">Configuración privada</p><h1 className="mt-2 text-2xl font-bold">Integración de reservas</h1><p className="mt-1">{config?.empresa_nombre||""}</p></header>
   <form onSubmit={guardar} className="space-y-5 p-6">
    <p className="text-sm">Estado: <strong>{config?.configurada?"Configurada":"Pendiente de configurar"}</strong></p>
    <div><label className="block text-sm font-semibold">URL privada de recepción de reservas</label>
     <input type="password" autoComplete="off" value={url} onChange={e=>setUrl(e.target.value)} placeholder={config?.configurada?"Dejar vacío para conservar la URL actual":"https://..."} className="mt-2 w-full rounded-xl border px-4 py-3" />
     <p className="mt-2 text-xs text-[#6F665C]">Esta dirección se almacena cifrada y no se vuelve a mostrar. Cada reserva de Oficina realiza un único envío, sin reintentos.</p>
    </div>
    <div><label className="block text-sm font-semibold">Responsable de reservas públicas</label>
     <select value={responsable} onChange={e=>setResponsable(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3">
      <option value="">Sin responsable asignado</option>
      {(config?.administradores||[]).map(u=><option key={u.id} value={u.id}>{u.nombre||u.email} ({u.email})</option>)}
     </select>
     <p className="mt-2 text-xs text-[#6F665C]">Las alertas de visitantes de la página pública se asignarán únicamente a esta persona.</p>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {mensaje&&<p className="rounded-xl bg-green-50 p-3 text-green-700">{mensaje}</p>}
    <button disabled={guardando||!config} className="w-full rounded-xl bg-[#E8620A] px-5 py-4 font-bold text-white disabled:opacity-40">{guardando?"Guardando...":"Guardar configuración"}</button>
    <Link href="/admin" className="block text-center text-sm font-semibold">Regresar a proyectos</Link>
   </form>
  </section>
 </main>;
}
