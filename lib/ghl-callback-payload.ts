/**
 * CONTRATO PERMANENTE DE WEBHOOKS GHL:
 * aceptar JSON plano y Custom Data anidados sin relajar la validación de identidad.
 * Antes de modificarlo, ejecutar los casos de regresión en tests/reservas-contract.test.mjs.
 */
type Objeto = Record<string, unknown>;

function objeto(valor: unknown): Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Objeto
    : {};
}

function campo(body: Objeto, clave: string): string {
  const fuentes = [
    objeto(body.customData),
    objeto(body.custom_data),
    objeto(body.custom_fields),
    body,
  ];
  for (const fuente of fuentes) {
    const valor = fuente[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  }
  // Compatibilidad con payloads que envían nombres con prefijo literal.
  for (const prefijo of ["customData", "custom_data", "custom_fields"]) {
    const valor = body[`${prefijo}.${clave}`];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  }
  return "";
}

export function extraerConfirmacionGhl(valor: unknown) {
  const body = objeto(valor);
  const empresa = campo(body, "empresa_id");
  const proyecto = campo(body, "proyecto_id");
  const grupo = campo(body, "reserva_grupo");
  const numero = campo(body, "numero") || campo(body, "consecutivo_1");
  const estado = campo(body, "estado").toLowerCase();

  const camposInvalidos = [
    ...(!empresa ? ["empresa_id"] : []),
    ...(!proyecto ? ["proyecto_id"] : []),
    ...(!grupo ? ["reserva_grupo"] : []),
    ...(!/^\d{4}$/.test(numero) ? ["numero"] : []),
    ...(!["creada", "fallida"].includes(estado) ? ["estado"] : []),
  ];

  return { empresa, proyecto, grupo, numero, estado, camposInvalidos };
}
