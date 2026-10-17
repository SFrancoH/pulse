import { timingSafeEqual } from "node:crypto";

// Contrato GHL: acepta datos en JSON plano, customData, custom_data,
// custom_fields, claves prefijadas y mezcla de estructuras.
// Nunca interpretar un valor monetario inválido como cero.
type Payload = Record<string, unknown>;
function objeto(v: unknown): Payload {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Payload : {};
}
function campo(p: Payload, keys: string[]): string {
  const fuentes = [objeto(p.customData), objeto(p.custom_data), objeto(p.custom_fields), p];
  for (const key of keys) {
    for (const fuente of fuentes) {
      const v = fuente[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    for (const prefijo of ["customData", "custom_data", "custom_fields"]) {
      const v = p[`${prefijo}.${key}`];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return "";
}
const ESTADOS: Record<string,string> = {
  "disponible": "Disponible", "no disponible": "No disponible", "nodisponible": "No disponible",
  "debe": "Debe", "abonado": "Abonado", "abonada": "Abonado",
  "pagado": "Pagado", "pagada": "Pagado",
};

// Valor total acumulado, NO incremento. COP permite $30.000, 30,000 y 30000.00.
export function importeTotalCop(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) && valor >= 0 ? valor : null;
  if (typeof valor !== "string" || !valor.trim()) return null;
  const raw = valor.trim().replace(/^COP\s*/i, "").replace(/^\$\s*/, "").replace(/\s/g, "");
  let canonical: string;
  if (/^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(raw)) {
    const ultimo = raw.match(/[.,](\d{1,2})$/);
    const sinDecimales = ultimo ? raw.slice(0, -(ultimo[0].length)) : raw;
    canonical = sinDecimales.replace(/[.,]/g, "") + (ultimo ? "." + ultimo[1] : "");
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(raw)) {
    canonical = raw.replace(",", ".");
  } else {
    return null;
  }
  const n = Number(canonical);
  return Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : null;
}

export function validarBearerBoleta(req: Request, secret: string): boolean {
  const raw = req.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(raw.trim());
  const expected = Buffer.from(secret || "", "utf8");
  const actual = Buffer.from(match?.[1] || "", "utf8");
  return expected.length >= 32 && expected.length === actual.length &&
    timingSafeEqual(expected, actual);
}

export function extraerActualizacionBoleta(body: unknown) {
  const p = objeto(body);
  const empresa_id = campo(p, ["empresa_id", "empresaId"]);
  const proyecto_id = campo(p, ["proyecto_id", "proyectoId"]);
  const rawNumero = campo(p, ["numero", "consecutivo", "consecutivo_1", "boleta"]);
  const numero = /^\d{1,4}$/.test(rawNumero) ? rawNumero.padStart(4, "0") : "";
  const estado = ESTADOS[campo(p, ["estado", "status", "etapa"]).toLowerCase()] || "";
  const valorRaw = campo(p, ["valor_pagado", "valor", "amount"]);
  // Liberar no es registrar un pago: no requiere importe, pero sí impide liberar
  // con un importe distinto de cero. Los pagos normales exigen total explícito.
  const valor_pagado = estado === "Disponible" && !valorRaw ? 0 : importeTotalCop(valorRaw);
  const campos_invalidos = [
    ...(!empresa_id ? ["empresa_id"] : []),
    ...(!proyecto_id ? ["proyecto_id"] : []),
    ...(!numero ? ["numero"] : []),
    ...(!estado ? ["estado"] : []),
    ...(valor_pagado === null || (estado === "Disponible" && valor_pagado !== 0) ? ["valor_pagado"] : []),
  ];
  return {
    empresa_id, proyecto_id, numero, estado, valor_pagado, campos_invalidos,
    nombre_cliente: campo(p, ["nombre_cliente", "nombre", "name", "contact_name", "first_name"]),
    telefono_cliente: campo(p, ["telefono_cliente", "telefono", "phone", "contact_phone"]),
    email_cliente: campo(p, ["email_cliente", "email", "contact_email"]),
    canal: campo(p, ["canal", "channel", "origen"]),
    metodo_pago: campo(p, ["metodo_pago", "metodo", "payment_method"]),
    comprobante_url: campo(p, ["comprobante_url", "comprobante", "receipt_url"]),
  };
}


/** Solicitud GHL de numeros disponibles para un proyecto, compatible con CUSTOM DATA. */
export function extraerSolicitudNumerosAleatorios(body: unknown) {
  const p = objeto(body);
  const empresa_id = campo(p, ["empresa_id", "empresaId"]);
  const proyecto_id = campo(p, ["proyecto_id", "proyectoId"]);
  const cantidadRaw = campo(p, ["cantidad"]);
  const cantidad = cantidadRaw ? Number(cantidadRaw) : 150;
  const formatoRaw = campo(p, ["formato"]).toLowerCase();
  const formato = !formatoRaw || formatoRaw === "json" ? "json" :
    formatoRaw === "texto" || formatoRaw === "text" ? "texto" : "";
  const campos_invalidos = [
    ...(!empresa_id ? ["empresa_id"] : []),
    ...(!proyecto_id ? ["proyecto_id"] : []),
    ...(!Number.isInteger(cantidad) || cantidad < 1 ? ["cantidad"] : []),
    ...(!formato ? ["formato"] : []),
  ];
  return {
    empresa_id,
    proyecto_id,
    cantidad: Number.isInteger(cantidad) ? Math.min(cantidad, 150) : 150,
    formato,
    campos_invalidos,
  };
}
