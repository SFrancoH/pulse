import "server-only";

export type WebhookPayload = Record<string, unknown>;

export class InvalidWebhookPayload extends Error {}

export function payloadText(payload: WebhookPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function flatten(value: unknown, prefix = "", output: WebhookPayload = Object.create(null)) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [key, item] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      flatten(item, nextKey, output);
    } else {
      output[nextKey] = item;
      output[key] = item;
    }
  }
  return output;
}

export async function readWebhookPayload(req: Request): Promise<WebhookPayload> {
  const raw = await req.text();
  if (!raw.trim()) return Object.create(null) as WebhookPayload;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json") || /^[\s]*[\[{]/.test(raw)) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new InvalidWebhookPayload("El cuerpo JSON no es válido.");
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new InvalidWebhookPayload("El cuerpo debe ser un objeto.");
    }
    return flatten(value);
  }

  const payload: WebhookPayload = Object.create(null);
  for (const [key, value] of new URLSearchParams(raw)) payload[key] = value;
  return payload;
}

export function webhookTicketNumber(value: string) {
  if (!/^\d{1,4}$/.test(value)) {
    throw new InvalidWebhookPayload("El número debe contener entre 1 y 4 dígitos.");
  }
  return value.padStart(4, "0");
}

export function webhookTicketState(value: string) {
  const states: Record<string, string> = {
    disponible: "Disponible",
    "no disponible": "No disponible",
    nodisponible: "No disponible",
    debe: "Debe",
    abonado: "Abonado",
    abonada: "Abonado",
    pagado: "Pagado",
    pagada: "Pagado",
  };
  // Preserve the legacy default for reservations without an explicit state.
  if (!value) return "No disponible";
  const key = value.trim().toLowerCase();
  if (!Object.hasOwn(states, key)) throw new InvalidWebhookPayload("El estado no es válido.");
  return states[key];
}

export function webhookPayment(value: string): number | undefined {
  if (!value) return undefined;
  // Accept unformatted numeric amounts and common COP currency/grouping forms.
  let normalized = value.trim().replace(/^(?:COP\s*|\$\s*)/i, "");
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(normalized)) {
    normalized = normalized.replaceAll(",", "");
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized)) {
    normalized = normalized.replaceAll(".", "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new InvalidWebhookPayload("El valor pagado no es válido.");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) {
    throw new InvalidWebhookPayload("El valor pagado no es válido.");
  }
  return amount;
}
