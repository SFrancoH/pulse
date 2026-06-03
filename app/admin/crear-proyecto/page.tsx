"use client";

import { useEffect, useState } from "react";

type Empresa = {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
};

type CrearProyectoResponse = {
  success: boolean;
  message?: string;
  url?: string;
  webhook_url?: string;
  asignar_vendedor_url?: string;
  proyecto_id?: string;
  proyecto_slug?: string;
};

type CodigoEstado = "pendiente" | "generando" | "listo" | "error";

const RANGOS = Array.from({ length: 10 }, (_, index) => ({
  desde: index * 1000,
  hasta: index * 1000 + 999,
}));

function fmtNumero(value: number) {
  return String(value).padStart(4, "0");
}

export default function CrearProyectoAdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("60000");
  const [formularioCompraUrl, setFormularioCompraUrl] = useState("");
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<CrearProyectoResponse | null>(null);
  const [copiado, setCopiado] = useState("");
  const [qrEstado, setQrEstado] = useState<CodigoEstado>("pendiente");
  const [barcodeEstado, setBarcodeEstado] = useState<CodigoEstado>("pendiente");
  const [codigoError, setCodigoError] = useState("");

  useEffect(() => {
    async function cargarEmpresas() {
      try {
        const res = await fetch("/api/empresas", { cache: "no-store" });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.message || "No se pudieron cargar las empresas.");
        }

        setEmpresas(data.empresas || []);
        if (data.empresas?.[0]?.id) {
          setEmpresaId(data.empresas[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setCargandoEmpresas(false);
      }
    }

    cargarEmpresas();
  }, []);

  async function crearProyecto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreando(true);
    setError("");
    setResultado(null);
    setCopiado("");
    setQrEstado("pendiente");
    setBarcodeEstado("pendiente");
    setCodigoError("");

    try {
      const res = await fetch("/api/crear-proyecto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empresa_id: empresaId,
          nombre,
          precio_boleta: Number(precio || 60000),
          formulario_compra_url: formularioCompraUrl,
        }),
      });

      const data = (await res.json()) as CrearProyectoResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudo crear el proyecto.");
      }

      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreando(false);
    }
  }

  async function copiar(valor: string | undefined, tipo: string) {
    if (!valor) return;
    await navigator.clipboard.writeText(valor);
    setCopiado(tipo);
    setTimeout(() => setCopiado(""), 2500);
  }

  return <main />;
}
