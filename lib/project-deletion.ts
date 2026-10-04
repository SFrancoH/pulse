export const CONFIRMACION_ELIMINAR = "ELIMINAR";

export function solicitudMismoOrigen(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
