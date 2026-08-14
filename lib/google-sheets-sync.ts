const DEFAULT_GOOGLE_SHEETS_SYNC_URL =
  "https://script.google.com/macros/s/AKfycbwTx5BhpcFs88kineicjAfGu7qgrWILO7X4EIdrVXKJb0sQjnee6MZ5DJ0gp1XCfwLKkw/exec";

type SyncResult = {
  success: boolean;
  skipped?: boolean;
  updated?: boolean;
  message?: string;
  error?: string;
};

function estadoParaGoogleSheet(estado: unknown) {
  return String(estado || "").trim().toLowerCase() === "disponible"
    ? "Disponible"
    : "No disponible";
}

export async function sincronizarDisponibilidadGoogleSheet(
  numero: string,
  estado: unknown
): Promise<SyncResult> {
  const syncUrl =
    process.env.GOOGLE_SHEETS_SYNC_URL?.trim() || DEFAULT_GOOGLE_SHEETS_SYNC_URL;
  const secret = process.env.SYNC_SECRET?.trim();

  if (!secret) {
    console.warn("[Google Sheets Sync] SYNC_SECRET no está configurado.");
    return {
      success: false,
      skipped: true,
      error: "secret_no_configurado",
    };
  }

  try {
    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        numero,
        estado: estadoParaGoogleSheet(estado),
      }),
      cache: "no-store",
    });

    const raw = await response.text();
    let data: SyncResult;

    try {
      data = JSON.parse(raw) as SyncResult;
    } catch {
      data = {
        success: response.ok,
        message: raw,
      };
    }

    if (!response.ok || data.success === false) {
      console.error("[Google Sheets Sync] Apps Script respondió error.", {
        numero,
        estado: estadoParaGoogleSheet(estado),
        status: response.status,
        response: data,
      });
    }

    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[Google Sheets Sync] No se pudo sincronizar.", {
      numero,
      estado: estadoParaGoogleSheet(estado),
      message,
    });

    return {
      success: false,
      error: "sync_error",
      message,
    };
  }
}

export async function sincronizarDisponibilidadesGoogleSheet(
  items: Array<{ numero: string; estado: unknown }>
) {
  const resultados: SyncResult[] = [];

  for (const item of items) {
    resultados.push(
      await sincronizarDisponibilidadGoogleSheet(item.numero, item.estado)
    );
  }

  return resultados;
}
