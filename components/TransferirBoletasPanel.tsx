"use client";

import { useEffect, useState } from "react";

type Props = { proyectoId: string };
type Estado = "Disponible" | "No disponible" | "Debe" | "Abonado" | "Pagado";
type Vendedor = { id: string; nombre: string | null; email: string; estado: string | null };
type Respuesta = {
  success: boolean;
  message?: string;
  vendedores?: Vendedor[];
  total?: number;
  por_estado?: Record<Estado, number>;
  transferidas?: number;
  numeros?: string[];
  destino?: string;
  sincronizacion_externa?: string;
};
const ESTADOS: Estado[] = ["Disponible", "No disponible", "Debe", "Abonado", "Pagado"];
const VACIO: Record<Estado, number> = {
  Disponible: 0, "No disponible": 0, Debe: 0, Abonado: 0, Pagado: 0,
};

async function respuestaJson(response: Response): Promise<Respuesta> {
  const data = (await response.json()) as Respuesta;
  if (!response.ok || !data.success) throw new Error(data.message || "No se pudo completar la operación.");
  return data;
}

export default function TransferirBoletasPanel({ proyectoId }: Props) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("oficina");
  const [modo, setModo] = useState<"todas" | "cantidad" | "especifica">("todas");
  const [cantidad, setCantidad] = useState("50");
  const [numero, setNumero] = useState("");
  const [estados, setEstados] = useState<Estado[]>(["Disponible"]);
  const [total, setTotal] = useState(0);
  const [porEstado, setPorEstado] = useState<Record<Estado, number>>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [consultando, setConsultando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pasoDestino, setPasoDestino] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Respuesta | null>(null);
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    let vigente = true;
    fetch("/api/proyectos/" + encodeURIComponent(proyectoId) + "/transferir-boletas", { cache: "no-store" })
      .then(respuestaJson)
      .then((data) => { if (vigente) setVendedores(data.vendedores || []); })
      .catch((err: unknown) => { if (vigente) setError(err instanceof Error ? err.message : "Error de consulta."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [proyectoId]);

  useEffect(() => {
    let vigente = true;
    if (!origen) {
      return;
    }
    setConsultando(true);
    fetch("/api/proyectos/" + encodeURIComponent(proyectoId) +
      "/transferir-boletas?origen=" + encodeURIComponent(origen), { cache: "no-store" })
      .then(respuestaJson)
      .then((data) => {
        if (!vigente) return;
        setTotal(data.total || 0);
        setPorEstado(data.por_estado || VACIO);
      })
      .catch((err: unknown) => { if (vigente) setError(err instanceof Error ? err.message : "Error de consulta."); })
      .finally(() => { if (vigente) setConsultando(false); });
    return () => { vigente = false; };
  }, [origen, proyectoId, actualizacion]);

  const disponiblesFiltro = estados.reduce((sum, estado) => sum + porEstado[estado], 0);
  const cantidadPedida = Number(cantidad);
  const numeroValido = /^\d{1,4}$/.test(numero.trim());
  const puedeContinuar = Boolean(origen && !consultando && !cargando &&
    estados.length > 0 && disponiblesFiltro > 0 &&
    (modo === "todas" || (modo === "cantidad" &&
      Number.isInteger(cantidadPedida) && cantidadPedida > 0 &&
      cantidadPedida <= disponiblesFiltro) || (modo === "especifica" && numeroValido)));
  const nombreOrigen = vendedores.find((v) => v.id === origen);
  const destinatarios = vendedores.filter((v) => v.estado === "activo" && v.id !== origen);

  function cambiarOrigen(value: string) {
    setOrigen(value);
    setDestino("oficina");
    setTotal(0);
    setPorEstado(VACIO);
    setConsultando(Boolean(value));
    setPasoDestino(false);
    setResultado(null);
    setError("");
  }

  function cambiarFiltros() {
    setPasoDestino(false);
    setResultado(null);
    setError("");
  }

  function alternarEstado(estado: Estado) {
    setEstados((prev) => prev.includes(estado)
      ? prev.filter((x) => x !== estado) : [...prev, estado]);
    cambiarFiltros();
  }

  async function confirmar() {
    if (!puedeContinuar || !pasoDestino || enviando) return;
    setError("");
    setResultado(null);
    setEnviando(true);
    try {
      const response = await fetch("/api/proyectos/" + encodeURIComponent(proyectoId) +
        "/transferir-boletas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendedor_origen_user_id: origen,
          vendedor_destino_user_id: destino === "oficina" ? null : destino,
          modo,
          cantidad: modo === "cantidad" ? cantidadPedida : undefined,
          numero: modo === "especifica" ? numero.trim() : undefined,
          estados,
        }),
      });
      const data = await respuestaJson(response);
      setResultado(data);
      setActualizacion((prev) => prev + 1);
      setPasoDestino(false);
      // Actualizar los conteos después de completar la operación.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo transferir.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="space-y-6 rounded-3xl border border-[#E0D9CE] bg-white p-6 shadow-sm" aria-labelledby="transferencia-masiva-titulo">
      <div>
        <h2 id="transferencia-masiva-titulo" className="text-2xl font-bold">Transferir Boletas</h2>
        <p className="mt-2 text-sm text-[#6F665C]">Mueve boletas de un vendedor a otro, o devuélvelas a Oficina, dentro de este proyecto.</p>
      </div>
      <div className="space-y-6 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-5">
          <div>
            <label htmlFor="origen" className="block font-semibold">1. Vendedor de origen</label>
            <select id="origen" value={origen} disabled={cargando || enviando}
              onChange={(e) => cambiarOrigen(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none">
              <option value="">Seleccionar vendedor</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre || v.email}{v.estado !== "activo" ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </div>

          {origen && (
            <div className="rounded-2xl border border-[#E0D9CE] p-4" aria-live="polite">
              <p className="font-semibold">Boletas asignadas: {consultando ? "Consultando..." : total.toLocaleString("es-CO")}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ESTADOS.map((estado) => (
                  <div key={estado} className="rounded-xl bg-[#F9F6F1] p-3">
                    <p className="text-sm text-[#6F665C]">{estado}</p>
                    <p className="text-xl font-bold">{porEstado[estado].toLocaleString("es-CO")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold">2. ¿Qué boletas deseas transferir?</p>
            <div className="mt-2 space-y-2">
              {([
                ["todas", "Todas las boletas (según estados seleccionados)"],
                ["cantidad", "Rango de boletas (por cantidad: 10, 30, 50…)"],
                ["especifica", "Boleta específica"],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="modo" checked={modo === value} disabled={enviando}
                    onChange={() => { setModo(value); cambiarFiltros(); }} />{label}
                </label>
              ))}
            </div>
            {modo === "cantidad" && (
              <div className="mt-3">
                <label htmlFor="cantidad" className="block text-sm font-medium">Cantidad de boletas a transferir</label>
                <input id="cantidad" type="number" min={1} max={10000} step={1} value={cantidad}
                  onChange={(e) => { setCantidad(e.target.value); cambiarFiltros(); }}
                  className="mt-1 w-full rounded-xl border border-[#E0D9CE] p-3" />
                <p className="mt-1 text-sm text-[#6F665C]">Se tomarán los números menores disponibles dentro de los estados seleccionados, en orden ascendente.</p>
              </div>
            )}
            {modo === "especifica" && (
              <div className="mt-3">
                <label htmlFor="numero" className="block text-sm font-medium">Número de boleta</label>
                <input id="numero" inputMode="numeric" maxLength={4} placeholder="Ej. 0042" value={numero}
                  onChange={(e) => { setNumero(e.target.value); cambiarFiltros(); }}
                  className="mt-1 w-full rounded-xl border border-[#E0D9CE] p-3" />
              </div>
            )}
          </div>

          <fieldset>
            <legend className="font-semibold">3. Estados de las boletas a transferir</legend>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ESTADOS.map((estado) => (
                <label key={estado} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E0D9CE] p-3">
                  <input type="checkbox" checked={estados.includes(estado)} disabled={enviando}
                    onChange={() => alternarEstado(estado)} />
                  <span>{estado}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm">Boletas del vendedor que coinciden con estos estados: <strong>{disponiblesFiltro.toLocaleString("es-CO")}</strong></p>
          </fieldset>

          {!pasoDestino && (
            <button type="button" disabled={!puedeContinuar}
              onClick={() => { setPasoDestino(true); setError(""); setResultado(null); }}
              className="w-full rounded-2xl bg-[#1A1A1A] px-5 py-4 font-semibold text-white disabled:opacity-40">
              Transferir — elegir destinatario
            </button>
          )}

          {pasoDestino && (
            <div className="space-y-4 rounded-2xl border-2 border-[#E8620A] p-5">
              <div>
                <label htmlFor="destino" className="block font-semibold">4. ¿A quién se transferirán las boletas?</label>
                <select id="destino" value={destino} onChange={(e) => setDestino(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none">
                  <option value="oficina">Oficina</option>
                  {destinatarios.map((v) => (
                    <option key={v.id} value={v.id}>{v.nombre || v.email}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm">Origen: <strong>{nombreOrigen?.nombre || nombreOrigen?.email}</strong>.
                Cantidad: <strong>{modo === "todas" ? disponiblesFiltro : modo === "cantidad" ? cantidadPedida : 1}</strong>.
                Destino: <strong>{destino === "oficina" ? "Oficina" : destinatarios.find((v) => v.id === destino)?.nombre || "Vendedor"}</strong>.</p>
              <p className="rounded-xl bg-[#F9F6F1] p-3 text-sm">
                Se conserva el estado y la información de cada boleta, incluidos clientes y pagos.
                En Oficina solo quedan disponibles para venta las boletas en estado Disponible.
                Las boletas reservadas, abonadas o pagadas no se liberan para una nueva venta.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPasoDestino(false)} disabled={enviando}
                  className="flex-1 rounded-xl border border-[#1A1A1A] p-3 font-semibold">Volver</button>
                <button type="button" onClick={() => void confirmar()} disabled={!puedeContinuar || enviando}
                  className="flex-1 rounded-xl bg-[#E8620A] p-3 font-semibold text-white disabled:opacity-40">
                  {enviando ? "Transfiriendo..." : "Confirmar transferencia"}
                </button>
              </div>
            </div>
          )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {resultado && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p className="font-bold">Transferencia completada: {resultado.transferidas} boletas a {resultado.destino}.</p>
          <p className="mt-2 text-sm">Estados, reservas y pagos conservados. El vendedor anterior ya no tiene estas boletas asignadas.</p>
          <p className="mt-2 break-words text-xs">Números: {resultado.numeros?.join(", ")}</p>
          <p className="mt-2 text-xs">{resultado.sincronizacion_externa}</p>
        </div>}
    </section>
  );
}
