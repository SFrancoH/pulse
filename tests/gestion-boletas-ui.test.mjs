import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("dos tarjetas independientes con los flujos actuales", () => {
  const page = read("app/admin/proyectos/[proyectoId]/reasignar-numero/page.tsx");
  const panel = read("components/TransferirBoletasPanel.tsx");
  assert.match(page, /id="reasignacion-individual-titulo"/);
  assert.match(page, /<TransferirBoletasPanel proyectoId=\{proyectoId\}/);
  assert.match(page, /\/reasignar-numero/);
  assert.match(panel, /id="transferencia-masiva-titulo"/);
  assert.match(panel, /"\/transferir-boletas"/);
  for (const estado of ["Disponible", "No disponible", "Debe", "Abonado", "Pagado"]) {
    assert.ok(panel.includes(estado), "Estado ausente: " + estado);
  }
  for (const campo of ["vendedor_origen_user_id", "vendedor_destino_user_id", "modo,", "cantidad:", "numero:", "estados,"]) {
    assert.ok(panel.includes(campo), "Campo ausente: " + campo);
  }
  for (const modo of ['"todas"', '"cantidad"', '"especifica"']) {
    assert.ok(panel.includes(modo), "Modalidad ausente: " + modo);
  }
});

test("conserva el botón de acceso original sin duplicarlo", () => {
  const dash = read("app/admin/page.tsx");
  const enhancer = read("app/admin/AdminReassignButtonEnhancer.tsx");
  assert.match(enhancer, /link\.textContent = "Liberar \/ reasignar número"/);
  assert.match(enhancer, /\/reasignar-numero/);
  assert.doesNotMatch(dash, /Transferir Boletas/);
});

test("la URL antigua redirige a la vista unificada", () => {
  const legacy = read("app/admin/proyectos/[proyectoId]/transferir-boletas/page.tsx");
  assert.match(legacy, /redirect\(/);
  assert.match(legacy, /\/reasignar-numero/);
});
