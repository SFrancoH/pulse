import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type WebhookProject = { id: string; empresa_id: string };
type AuthorizationResult =
  | { proyecto: WebhookProject; error: null }
  | { proyecto: null; error: Response };

const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function reject(status: number, message: string): AuthorizationResult {
  return {
    proyecto: null,
    error: Response.json({ success: false, message }, {
      status,
      headers: { "Cache-Control": "no-store" },
    }),
  };
}

function readProjectKeys(): Record<string, string> {
  const raw = process.env.PULSE_PROJECT_WEBHOOK_KEYS;
  if (!raw?.trim()) return {};

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid project webhook credential configuration.");
  }

  const entries = Object.entries(value);
  const uniqueKeys = new Set<string>();
  for (const [projectId, key] of entries) {
    if (!projectId.trim() || typeof key !== "string" || !KEY_PATTERN.test(key)) {
      throw new Error("Invalid project webhook credential configuration.");
    }
    if (uniqueKeys.has(key)) {
      throw new Error("A webhook credential must belong to a single project.");
    }
    uniqueKeys.add(key);
  }
  return value as Record<string, string>;
}

/** Authenticate before reading the payload or querying tickets.
 * A bearer credential belongs to one project configured on the server.
 * The public sales token, a project ID and empresa_id are not credentials.
 */
export async function requireProjectWebhookAccess(
  req: Request,
  proyectoId: string,
): Promise<AuthorizationResult> {
  const authorization = req.headers.get("authorization");

  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/i.exec(authorization);
    if (!match) return reject(401, "No autorizado.");

    let keys: Record<string, string>;
    try {
      keys = readProjectKeys();
    } catch {
      // Never log credential values or the raw configuration.
      console.error("[Project webhook] Invalid credential configuration.");
      return reject(503, "La integración no está configurada correctamente.");
    }

    const expected = Object.hasOwn(keys, proyectoId) ? keys[proyectoId] : undefined;
    if (!expected) return reject(401, "No autorizado.");

    const providedHash = createHash("sha256").update(match[1]).digest();
    const expectedHash = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(providedHash, expectedHash)) return reject(401, "No autorizado.");

    const { data, error } = await supabaseAdmin
      .from("proyectos")
      .select("id,empresa_id")
      .eq("id", proyectoId)
      .eq("estado", "activo")
      .maybeSingle();

    if (error) return reject(503, "No se pudo verificar la autorización.");
    if (!data?.empresa_id) return reject(404, "Proyecto no encontrado.");
    return { proyecto: { id: data.id, empresa_id: data.empresa_id }, error: null };
  }

  // Cookie-authenticated callers must be managers, with the current role and
  // company verified by the existing session resolver and project guard.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return reject(403, "Origen no autorizado.");
  }
  const auth = await requireProjectManagerAccess(proyectoId);
  if (auth.error) return { proyecto: null, error: auth.error };
  if (!auth.proyecto) return reject(403, "Acceso denegado.");

  return {
    proyecto: { id: auth.proyecto.id, empresa_id: auth.proyecto.empresa_id },
    error: null,
  };
}
