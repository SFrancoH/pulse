type SheetBoletaPayload = {
  proyecto: string;
  numero: string;
  estado: string;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  vendedor?: string | null;
  valor_pagado?: string | number | null;
};

const LOTE_APPS_SCRIPT = 500;

async function postAppsScript(appsScriptUrl: string, body: unknown) {
  if (!appsScriptUrl) return { success: false, skipped: true };

  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Apps Script error ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { success: true, raw: text };
  }
}

export async function sincronizarBoletasInicialesConSheet(
  appsScriptUrl: string | null | undefined,
  proyectoId: string,
  numeros: string[]
) {
  if (!appsScriptUrl) return;

  for (let inicio = 0; inicio < numeros.length; inicio += LOTE_APPS_SCRIPT) {
    const lote = numeros.slice(inicio, inicio + LOTE_APPS_SCRIPT).map((numero) => ({
      proyecto: proyectoId,
      numero,
      estado: "disponible",
      nombre: "",
      telefono: "",
      email: "",
      vendedor: "",
      valor_pagado: "",
    }));

    await postAppsScript(appsScriptUrl, { items: lote });
  }
}

export async function sincronizarBoletaConSheet(
  appsScriptUrl: string | null | undefined,
  payload: SheetBoletaPayload
) {
  if (!appsScriptUrl) return;

  await postAppsScript(appsScriptUrl, payload);
}
