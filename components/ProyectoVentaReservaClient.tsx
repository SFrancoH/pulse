"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_SELECCION = 10;
const PAGE_SIZE = 1000;

type Boleta = { id: string; numero: string };
type PasoModal = "datos" | "confirmacion" | "ghl" | "expirada";

type Props = {
  empresaNombre: string;
  proyectoNombre: string;
  precioBoleta: number;
  formularioCompraUrl: string | null;
  boletas: Boleta[];
  proyectoId?: string;
  boletasEndpoint?: string;
  reservationEndpoint?: string;
  formTrackingParams?: Record<string, string>;
  officeWhatsappUrl?: string;
};

type BoletasResponse = {
  success: boolean;
  message?: string;
  boletas?: Boleta[];
  search_status?: "allowed" | "office" | "not_found";
  page?: number;
  total?: number;
};

type ReservaResponse = {
  success: boolean;
  message?: string;
  code?: string;
  holdToken?: string;
  expiresAt?: string;
  reservadas?: string[];
  noDisponibles?: string[];
  confirmadas?: string[];
  liberadas?: string[];
};

function formatearCOP(valor: number) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

function normalizarNumero(value: string) {
  const limpio = value.replace(/\D/g, "");
  return limpio ? limpio.padStart(4, "0").slice(-4) : "";
}

function normalizarContiene(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function normalizarTelefono(value: string) {
  const limpio = value.replace(/\D/g, "");
  if (!limpio) return "";
  if (limpio.length === 10) return `+57${limpio}`;
  if (limpio.startsWith("57") && limpio.length === 12) return `+${limpio}`;
  return `+${limpio}`;
}

function mezclarBoletas(lista: Boleta[]) {
  const copia = [...lista];
  for (let index = copia.length - 1; index > 0; index--) {
    const aleatorio = Math.floor(Math.random() * (index + 1));
    [copia[index], copia[aleatorio]] = [copia[aleatorio], copia[index]];
  }
  return copia;
}

export default function ProyectoVentaReservaClient({
  empresaNombre,
  proyectoNombre,
  precioBoleta,
  formularioCompraUrl,
  boletas: iniciales,
  proyectoId,
  boletasEndpoint,
  reservationEndpoint,
  formTrackingParams,
  officeWhatsappUrl,
}: Props) {
  const endpoint = boletasEndpoint || (proyectoId ? `/api/proyectos/${proyectoId}/boletas-disponibles` : "");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaContiene, setBusquedaContiene] = useState("");
  const [boletasPagina, setBoletasPagina] = useState<Boleta[]>(() => mezclarBoletas(iniciales));
  const [totalDisponibles, setTotalDisponibles] = useState(iniciales.length);
  const [resultados, setResultados] = useState<Boleta[] | null>(null);
  const [tipoResultado, setTipoResultado] = useState<"exacto" | "contiene" | "suerte" | null>(null);
  const [pagina, setPagina] = useState(0);
  const [cargandoPagina, setCargandoPagina] = useState(false);
  const [toast, setToast] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pasoModal, setPasoModal] = useState<PasoModal>("datos");
  const [avisoOficina, setAvisoOficina] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [holdToken, setHoldToken] = useState("");
  const [reservadasTemporales, setReservadasTemporales] = useState<string[]>([]);
  const [noDisponibles, setNoDisponibles] = useState<string[]>([]);
  const [segundos, setSegundos] = useState(60);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      if (!endpoint) return;
      try {
        const res = await fetch(`${endpoint}?page=0`, { cache: "no-store" });
        const data = (await res.json()) as BoletasResponse;
        if (activo && data.success) {
          setBoletasPagina(mezclarBoletas(data.boletas || []));
          setTotalDisponibles(Number(data.total ?? data.boletas?.length ?? 0));
        }
      } catch {
        // Conserva los datos iniciales.
      }
    }
    cargar();
    return () => { activo = false; };
  }, [endpoint]);

  useEffect(() => {
    if (!modalAbierto || pasoModal !== "confirmacion" || !holdToken || reservadasTemporales.length === 0) return;
    const timer = window.setInterval(() => {
      setSegundos((actual) => Math.max(0, actual - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [modalAbierto, pasoModal, holdToken, reservadasTemporales.length]);

  useEffect(() => {
    if (pasoModal !== "confirmacion" || segundos !== 0 || !holdToken) return;
    void cancelarRetencion(true);
  }, [segundos, pasoModal, holdToken]);

  function mostrarToast(mensaje: string) {
    setToast(mensaje);
    window.setTimeout(() => setToast(""), 3500);
  }

  const totalPaginas = Math.max(1, Math.ceil(totalDisponibles / PAGE_SIZE));
  const enModoBusqueda = resultados !== null;
  const boletasVisibles = resultados ?? boletasPagina;
  const numerosFormulario = pasoModal === "ghl" ? reservadasTemporales : seleccionados;
  const totalPagarFormulario = numerosFormulario.length * precioBoleta;

  const textoResultado = useMemo(() => {
    if (tipoResultado === "suerte" && resultados?.[0]) return `Tu número de la suerte es ${resultados[0].numero}`;
    if (tipoResultado === "contiene") return `${resultados?.length || 0} resultados que contienen ${normalizarContiene(busquedaContiene)}`;
    if (tipoResultado === "exacto") return "Resultado de búsqueda";
    const inicio = totalDisponibles === 0 ? 0 : pagina * PAGE_SIZE + 1;
    const fin = Math.min(pagina * PAGE_SIZE + boletasPagina.length, totalDisponibles);
    return `${inicio.toLocaleString("es-CO")} a ${fin.toLocaleString("es-CO")} de ${totalDisponibles.toLocaleString("es-CO")} números disponibles`;
  }, [boletasPagina.length, busquedaContiene, pagina, resultados, tipoResultado, totalDisponibles]);

  const formularioUrl = useMemo(() => {
    if (!formularioCompraUrl || pasoModal !== "ghl") return "";
    const params = new URLSearchParams();
    numerosFormulario.forEach((numero, index) => params.set(`consecutivo_${index + 1}`, numero));
    for (let index = numerosFormulario.length; index < MAX_SELECCION; index++) params.set(`consecutivo_${index + 1}`, "");
    Object.entries(formTrackingParams || {}).forEach(([key, value]) => params.set(key, value));
    params.set("first_name", firstName.trim());
    params.set("phone", normalizarTelefono(phone));
    params.set("city", city.trim());
    params.set("nombre_proyecto", proyectoNombre);
    params.set("valor_a_pagar", String(totalPagarFormulario));
    const separador = formularioCompraUrl.includes("?") ? "&" : "?";
    return `${formularioCompraUrl}${separador}${params.toString()}`;
  }, [city, firstName, formTrackingParams, formularioCompraUrl, numerosFormulario, pasoModal, phone, proyectoNombre, totalPagarFormulario]);

  async function refrescarDisponibles() {
    if (!endpoint) return;
    try {
      const res = await fetch(`${endpoint}?page=0`, { cache: "no-store" });
      const data = (await res.json()) as BoletasResponse;
      if (data.success) {
        setBoletasPagina(mezclarBoletas(data.boletas || []));
        setTotalDisponibles(Number(data.total ?? data.boletas?.length ?? 0));
        setPagina(0);
        setResultados(null);
        setTipoResultado(null);
        setSeleccionados([]);
      }
    } catch {
      // La siguiente interacción vuelve a consultar.
    }
  }

  async function cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina < 0 || nuevaPagina >= totalPaginas || enModoBusqueda || cargandoPagina || !endpoint) return;
    try {
      setCargandoPagina(true);
      const response = await fetch(`${endpoint}?page=${nuevaPagina}`, { cache: "no-store" });
      const data = (await response.json()) as BoletasResponse;
      if (!data.success) throw new Error(data.message || "No se pudieron cargar los números.");
      setBoletasPagina(mezclarBoletas(data.boletas || []));
      setTotalDisponibles(Number(data.total ?? totalDisponibles));
      setPagina(nuevaPagina);
      setAvisoOficina(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      mostrarToast(error instanceof Error ? error.message : "Error cargando números.");
    } finally {
      setCargandoPagina(false);
    }
  }

  async function buscarNumero() {
    const numero = normalizarNumero(busqueda);
    if (!numero) return volverALista();
    setTipoResultado("exacto");
    setBusquedaContiene("");
    setAvisoOficina(false);
    try {
      setCargandoPagina(true);
      const response = await fetch(`${endpoint}?numero=${encodeURIComponent(numero)}`, { cache: "no-store" });
      const data = (await response.json()) as BoletasResponse;
      if (!data.success) throw new Error(data.message || "No se pudo consultar el número.");
      const encontradas = data.boletas || [];
      setResultados(encontradas);
      setAvisoOficina(data.search_status === "office");
      if (!encontradas.length) mostrarToast(`El número ${numero} no está disponible en este enlace.`);
    } catch (error) {
      setResultados([]);
      mostrarToast(error instanceof Error ? error.message : "Error consultando el número.");
    } finally {
      setCargandoPagina(false);
    }
  }

  async function buscarNumeroQueContenga() {
    const contiene = normalizarContiene(busquedaContiene);
    if (!contiene) return mostrarToast("Escribe uno o más dígitos para buscar coincidencias.");
    setTipoResultado("contiene");
    setBusqueda("");
    setAvisoOficina(false);
    try {
      setCargandoPagina(true);
      const response = await fetch(`${endpoint}?contiene=${encodeURIComponent(contiene)}`, { cache: "no-store" });
      const data = (await response.json()) as BoletasResponse;
      if (!data.success) throw new Error(data.message || "No se pudieron consultar las coincidencias.");
      setResultados(data.boletas || []);
      if (!data.boletas?.length) mostrarToast(`No hay números disponibles que contengan ${contiene}.`);
    } catch (error) {
      setResultados([]);
      mostrarToast(error instanceof Error ? error.message : "Error consultando coincidencias.");
    } finally {
      setCargandoPagina(false);
    }
  }

  function probarSuerte() {
    if (!boletasPagina.length) return mostrarToast("No hay números disponibles para probar suerte.");
    const indice = Math.floor(Math.random() * boletasPagina.length);
    setResultados([boletasPagina[indice]]);
    setTipoResultado("suerte");
    setBusqueda("");
    setBusquedaContiene("");
  }

  function volverALista() {
    setResultados(null);
    setTipoResultado(null);
    setBusqueda("");
    setBusquedaContiene("");
    setAvisoOficina(false);
  }

  function toggleNumero(numero: string) {
    setSeleccionados((actuales) => {
      if (actuales.includes(numero)) return actuales.filter((item) => item !== numero);
      if (actuales.length >= MAX_SELECCION) {
        mostrarToast(`Solo puedes seleccionar máximo ${MAX_SELECCION} números.`);
        return actuales;
      }
      return [...actuales, numero];
    });
  }

  function abrirReserva() {
    if (!seleccionados.length) return mostrarToast("Selecciona al menos un número.");
    if (!formularioCompraUrl) return mostrarToast("Este proyecto no tiene formulario de compra configurado.");
    if (!reservationEndpoint) return mostrarToast("No está configurado el servicio de reserva.");
    setPasoModal("datos");
    setReservadasTemporales([]);
    setNoDisponibles([]);
    setHoldToken("");
    setSegundos(60);
    setModalAbierto(true);
  }

  async function crearRetencion(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim() || !city.trim()) return mostrarToast("Completa nombre, teléfono y ciudad.");
    try {
      setProcesando(true);
      const res = await fetch(reservationEndpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hold", numeros: seleccionados, first_name: firstName.trim(), phone: normalizarTelefono(phone), city: city.trim() }),
      });
      const data = (await res.json()) as ReservaResponse;
      if (!res.ok || !data.success) throw new Error(data.message || "No se pudo comprobar la disponibilidad.");
      setReservadasTemporales(data.reservadas || []);
      setNoDisponibles(data.noDisponibles || []);
      setHoldToken(data.holdToken || "");
      setSegundos(60);
      setPasoModal("confirmacion");
    } catch (error) {
      mostrarToast(error instanceof Error ? error.message : "Error reservando temporalmente.");
    } finally {
      setProcesando(false);
    }
  }

  async function cancelarRetencion(expirada = false) {
    if (!reservationEndpoint || !holdToken || !reservadasTemporales.length) {
      setModalAbierto(false);
      return;
    }
    try {
      setProcesando(true);
      await fetch(reservationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", numeros: reservadasTemporales, hold_token: holdToken }),
      });
    } finally {
      setProcesando(false);
      setHoldToken("");
      setReservadasTemporales([]);
      await refrescarDisponibles();
      if (expirada) {
        setPasoModal("expirada");
        setModalAbierto(true);
      } else {
        setModalAbierto(false);
      }
    }
  }

  async function confirmarRetencion() {
    if (!reservationEndpoint || !holdToken || !reservadasTemporales.length) return;
    try {
      setProcesando(true);
      const res = await fetch(reservationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", numeros: reservadasTemporales, hold_token: holdToken }),
      });
      const data = (await res.json()) as ReservaResponse;
      if (data.code === "RESERVA_EXPIRADA" || !data.success) {
        setPasoModal("expirada");
        setHoldToken("");
        setReservadasTemporales([]);
        await refrescarDisponibles();
        return;
      }
      const confirmadas = data.confirmadas || [];
      if (!confirmadas.length) throw new Error("No fue posible confirmar los números reservados.");
      setReservadasTemporales(confirmadas);
      setSeleccionados(confirmadas);
      setHoldToken("");
      setPasoModal("ghl");
    } catch (error) {
      mostrarToast(error instanceof Error ? error.message : "No se pudo confirmar la reserva.");
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarModal() {
    if (procesando) return;
    if (pasoModal === "confirmacion" && holdToken) {
      await cancelarRetencion(false);
      return;
    }
    setModalAbierto(false);
  }

  return (
    <main id="pulse-venta-root" className="overflow-x-hidden bg-[#F2EDE4] pb-36 text-[#1A1A1A]">
      <div className="sticky top-0 z-50 border-b border-[#E0D9CE] bg-white px-5 py-3 max-[932px]:px-3">
        <div className="mx-auto flex max-w-[1100px] items-center justify-center gap-3 max-[932px]:flex-col">
          <div className="rounded-md bg-[#E8620A] px-6 py-2 text-[22px] font-semibold text-white max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-center max-[932px]:text-[28px]">{formatearCOP(precioBoleta)}</div>
          <div className="grid w-full max-w-3xl grid-cols-1 gap-2">
            <div className="flex w-full gap-2 max-[932px]:flex-col">
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void buscarNumero(); } }} placeholder="Buscar número exacto... Ej: 5555" className="w-full rounded-md border border-[#E0D9CE] bg-[#F2EDE4] px-4 py-2.5 outline-none focus:border-[#E8620A] max-[932px]:rounded-xl max-[932px]:py-4 max-[932px]:text-lg" />
              <button type="button" onClick={() => void buscarNumero()} disabled={cargandoPagina} className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white disabled:opacity-50">Buscar</button>
            </div>
            <div className="flex w-full gap-2 max-[932px]:flex-col">
              <input value={busquedaContiene} onChange={(e) => setBusquedaContiene(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void buscarNumeroQueContenga(); } }} placeholder="Buscar número que contenga... Ej: 26" className="w-full rounded-md border border-[#E0D9CE] bg-white px-4 py-2.5 outline-none focus:border-[#E8620A] max-[932px]:rounded-xl max-[932px]:py-4 max-[932px]:text-lg" />
              <button type="button" onClick={() => void buscarNumeroQueContenga()} disabled={cargandoPagina} className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white disabled:opacity-50">Buscar coincidencias</button>
            </div>
            <button type="button" onClick={probarSuerte} disabled={cargandoPagina || !boletasPagina.length} className="rounded-xl border border-[#E8620A] bg-white px-5 py-3 font-semibold text-[#E8620A] shadow-sm disabled:opacity-50 max-[932px]:py-4 max-[932px]:text-lg">{cargandoPagina ? "Cargando números..." : "Probar suerte"}</button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1100px] px-5 pb-3 pt-6 max-[932px]:px-3">
        <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">{empresaNombre}</p>
        <h1 className="mt-2 text-[32px] font-bold max-[932px]:text-[34px]">{proyectoNombre}</h1>
        <p className="mt-2 text-sm text-[#9A9187]">{textoResultado}</p>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 max-[932px]:px-3">
        {boletasVisibles.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 max-[932px]:grid-cols-2 max-[932px]:gap-3">
            {boletasVisibles.map((boleta) => {
              const seleccionado = seleccionados.includes(boleta.numero);
              return <button key={boleta.id} type="button" onClick={() => toggleNumero(boleta.numero)} className={["select-none rounded-[10px] border bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-[#E8620A] max-[932px]:rounded-[18px] max-[932px]:py-6", seleccionado ? "border-[#E8620A] bg-[#E8620A]" : "border-[#E0D9CE]"].join(" ")}><div className={["text-[26px] font-semibold max-[932px]:text-[42px]", seleccionado ? "text-white" : "text-[#1A1A1A]"].join(" ")}>{boleta.numero}</div><div className={["mt-1 text-[10px] tracking-[2px] max-[932px]:mt-2 max-[932px]:text-[13px]", seleccionado ? "text-white/80" : "text-[#9A9187]"].join(" ")}>{seleccionado ? "SELECCIONADO" : "LIBRE"}</div></button>;
            })}
          </div>
        ) : <div className="rounded-2xl border border-[#E0D9CE] bg-white p-10 text-center text-[#9A9187]">No se encontró ese número o no está disponible.</div>}

        {avisoOficina && officeWhatsappUrl && <div className="mt-5 rounded-2xl border border-[#E8620A] bg-white p-5 text-center"><p className="font-semibold">Este número está disponible, pero no está habilitado en este enlace de venta.</p><p className="mt-2 text-sm text-[#6F665C]">Si deseas reservarlo, comunícate directamente con la oficina de Javier Toyotas.</p><a href={officeWhatsappUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl bg-[#25D366] px-5 py-3 font-semibold text-white">Hablar por WhatsApp con la oficina</a></div>}
      </section>

      <section className="mx-auto mt-6 flex max-w-[1100px] flex-wrap gap-2 px-5 pb-8 max-[932px]:flex-col max-[932px]:px-3">
        <button type="button" disabled={pagina === 0 || cargandoPagina || enModoBusqueda} onClick={() => void cambiarPagina(pagina - 1)} className="rounded-2xl border border-[#1A1A1A] bg-white px-5 py-4 text-lg font-semibold disabled:opacity-40">Ver números anteriores</button>
        <button type="button" disabled={pagina >= totalPaginas - 1 || cargandoPagina || enModoBusqueda} onClick={() => void cambiarPagina(pagina + 1)} className="rounded-2xl bg-[#E8620A] px-5 py-4 text-lg font-semibold text-white disabled:opacity-40">Ver más números</button>
        {enModoBusqueda && <button type="button" onClick={volverALista} className="rounded-2xl border border-[#E8620A] bg-white px-5 py-4 text-lg font-semibold text-[#E8620A]">Volver a lista de números</button>}
      </section>

      <div className="fixed bottom-12 left-1/2 z-[300] w-[calc(100%-24px)] max-w-[520px] -translate-x-1/2 max-[932px]:bottom-14">
        <button type="button" onClick={abrirReserva} className={["block w-full rounded-[22px] bg-[#E8620A] px-6 py-5 text-center text-[22px] font-semibold text-white shadow-[0_10px_25px_rgba(232,98,10,0.35)] transition duration-200 max-[932px]:rounded-[24px] max-[932px]:py-5 max-[932px]:text-[24px]", seleccionados.length ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"].join(" ")}>Reservar {seleccionados.length} {seleccionados.length === 1 ? "boleta" : "boletas"}</button>
      </div>

      {modalAbierto && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 max-[932px]:items-end max-[932px]:p-0">
        <div className="relative max-h-[90vh] w-full max-w-[520px] overflow-hidden rounded-2xl bg-white max-[932px]:max-h-[94dvh] max-[932px]:max-w-none max-[932px]:rounded-t-3xl max-[932px]:rounded-b-none">
          <div className="flex h-[60px] items-center justify-between bg-[#1A1A1A] px-5 text-lg font-semibold text-white"><span>{pasoModal === "ghl" ? "Finalizar reserva" : "Confirmar reserva"}</span><button type="button" onClick={() => void cerrarModal()} disabled={procesando} className="text-3xl leading-none text-white disabled:opacity-40">×</button></div>

          {pasoModal === "datos" && <form onSubmit={crearRetencion} className="space-y-5 p-6">
            <div><h2 className="text-2xl font-bold">Tus datos</h2><p className="mt-2 text-sm text-[#6F665C]">Primero validaremos y apartaremos tus números durante 1 minuto.</p></div>
            <label className="block text-sm font-semibold">Nombre<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#D8CFC3] px-4 py-3 text-base" placeholder="Nombre" /></label>
            <label className="block text-sm font-semibold">Teléfono<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-2 w-full rounded-xl border border-[#D8CFC3] px-4 py-3 text-base" placeholder="Ej: 3162426712" /></label>
            <label className="block text-sm font-semibold">Ciudad<input value={city} onChange={(e) => setCity(e.target.value)} className="mt-2 w-full rounded-xl border border-[#D8CFC3] px-4 py-3 text-base" placeholder="Ciudad" /></label>
            <button type="submit" disabled={procesando} className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-bold text-white disabled:opacity-50">{procesando ? "Validando..." : "Continuar"}</button>
          </form>}

          {pasoModal === "confirmacion" && <div className="space-y-5 p-6">
            <div><h2 className="text-3xl font-bold">Confirma tu reserva</h2><p className="mt-3 text-[#6F665C]">Podemos reservar el:</p>{reservadasTemporales.length ? <p className="mt-2 text-2xl font-bold">{reservadasTemporales.join(" · ")}</p> : <p className="mt-2 font-bold text-red-700">Ninguno de los números seleccionados continúa disponible.</p>}</div>
            {noDisponibles.length > 0 && <div className="rounded-2xl bg-red-50 p-4 text-red-800">El <strong>😞 {noDisponibles.join(" · ")}</strong> {noDisponibles.length === 1 ? "lo acaba" : "los acaba"} de reservar otro usuario en este momento.</div>}
            {reservadasTemporales.length > 0 && <><p className="text-lg">¿Deseas continuar con los números disponibles?</p><div className="rounded-2xl border border-[#E0D9CE] bg-[#F7F4EF] p-4 text-center"><p className="text-sm uppercase tracking-[2px] text-[#7A7066]">Tiempo restante</p><p className="mt-1 text-3xl font-bold">00:{String(segundos).padStart(2, "0")}</p></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => void cancelarRetencion(false)} disabled={procesando} className="rounded-2xl border border-[#1A1A1A] px-5 py-4 font-bold disabled:opacity-50">Cancelar</button><button type="button" onClick={() => void confirmarRetencion()} disabled={procesando} className="rounded-2xl bg-[#E8620A] px-5 py-4 font-bold text-white disabled:opacity-50">{procesando ? "Confirmando..." : "Continuar"}</button></div></>}
            {!reservadasTemporales.length && <button type="button" onClick={() => { setModalAbierto(false); void refrescarDisponibles(); }} className="w-full rounded-2xl bg-[#1A1A1A] px-5 py-4 font-bold text-white">Seleccionar otros números</button>}
          </div>}

          {pasoModal === "expirada" && <div className="space-y-5 p-6 text-center"><div className="text-5xl">⌛</div><h2 className="text-3xl font-bold">El tiempo de reserva terminó</h2><p className="text-[#6F665C]">Los números apartados fueron liberados nuevamente. Selecciona los que quieras e inténtalo otra vez.</p><button type="button" onClick={() => setModalAbierto(false)} className="w-full rounded-2xl bg-[#E8620A] px-5 py-4 font-bold text-white">Volver a seleccionar</button></div>}

          {pasoModal === "ghl" && <div className="h-[calc(90vh-60px)] max-h-[620px]"><iframe src={formularioUrl} className="h-full w-full border-0" title="Formulario de compra" /></div>}
        </div>
      </div>}

      {toast && <div className="fixed left-1/2 top-4 z-[999] max-w-[90vw] -translate-x-1/2 rounded-[10px] bg-[#CC3333] px-6 py-3 text-center text-sm text-white">{toast}</div>}
    </main>
  );
}
