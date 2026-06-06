type SheetBoletaPayload = {
  proyecto: string;
  numero: string;
  estado?: string;
  canal?: string;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  vendedor?: string | null;
  valor_pagado?: string | number | null;
};

const LOTE_APPS_SCRIPT = 100;
const PAUSA_ENTRE_LOTES_MS = 250;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  let data: { success?: boolean; message?: string; raw?: string };

  try {
    data = JSON.parse(text);
  } catch {
    data = { success: true, raw: text };
  }

  if (data.success === false) {
    throw new Error(data.message || "Apps Script respondió error.");
  }

  return data;
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
      estado: "Disponible",
      canal: "Vacio",
      nombre: "",
      telefono: "",
      email: "",
      vendedor: "",
      valor_pagado: "",
    }));

    await postAppsScript(appsScriptUrl, { items: lote });
    await esperar(PAUSA_ENTRE_LOTES_MS);
  }
}

export async function sincronizarBoletaConSheet(
  appsScriptUrl: string | null | undefined,
  payload: SheetBoletaPayload
) {
  if (!appsScriptUrl) return;

  await postAppsScript(appsScriptUrl, payload);
}

export async function sincronizarLoteBoletasConSheet(
  appsScriptUrl: string | null | undefined,
  items: SheetBoletaPayload[]
) {
  if (!appsScriptUrl || items.length === 0) return;

  for (let inicio = 0; inicio < items.length; inicio += LOTE_APPS_SCRIPT) {
    await postAppsScript(appsScriptUrl, {
      items: items.slice(inicio, inicio + LOTE_APPS_SCRIPT),
    });
    await esperar(PAUSA_ENTRE_LOTES_MS);
  }
}
