import "server-only";

import { randomUUID } from "crypto";
import { sincronizarDisponibilidadesGoogleSheet } from "@/lib/google-sheets-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const TEMPORARY_RESERVATION_MS = 60_000;
export const TEMPORARY_RESERVATION_CHANNEL = "Reserva temporal";

type ReservationScope = {
  empresaId: string;
  proyectoId: string;
  vendedorUserId?: string | null;
};

type ClientData = {
  firstName: string;
  phone: string;
};

type HoldResult = {
  holdToken: string;
  expiresAt: string;
  reservadas: string[];
  noDisponibles: string[];
};

function normalizarNumero(value: unknown) {
  const limpio = String(value || "").replace(/\D/g, "");
  return limpio ? limpio.padStart(4, "0").slice(-4) : "";
}

function numerosUnicos(values: unknown[]) {
  return Array.from(new Set(values.map(normalizarNumero).filter(Boolean))).slice(0, 10);
}

function canalAlLiberar(vendedorUserId: string | null | undefined) {
  return vendedorUserId ? "Vendedores" : "Oficina";
}

async function sincronizarOficina(scope: ReservationScope, numeros: string[], estado: string) {
  if (scope.vendedorUserId || !numeros.length) return;
  await sincronizarDisponibilidadesGoogleSheet(numeros.map((numero) => ({ numero, estado })));
}

export async function liberarReservasTemporalesExpiradas(scope: ReservationScope) {
  const cutoff = new Date(Date.now() - TEMPORARY_RESERVATION_MS).toISOString();
  const liberadas: string[] = [];

  let query = supabaseAdmin
    .from("boletas")
    .select("id,numero,updated_at,vendedor_user_id")
    .eq("empresa_id", scope.empresaId)
    .eq("proyecto_id", scope.proyectoId)
    .eq("estado", "No disponible")
    .eq("canal", TEMPORARY_RESERVATION_CHANNEL)
    .lt("updated_at", cutoff)
    .limit(100);

  if (scope.vendedorUserId) query = query.eq("vendedor_user_id", scope.vendedorUserId);
  else query = query.eq("vendedor_nombre", "Oficina").is("vendedor_user_id", null);

  const { data, error } = await query;
  if (error) throw error;

  for (const item of data || []) {
    const { data: released, error: releaseError } = await supabaseAdmin
      .from("boletas")
      .update({
        estado: "Disponible",
        canal: canalAlLiberar(item.vendedor_user_id),
        nombre_cliente: null,
        telefono_cliente: null,
        email_cliente: null,
        valor_pagado: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("estado", "No disponible")
      .eq("canal", TEMPORARY_RESERVATION_CHANNEL)
      .eq("updated_at", item.updated_at)
      .select("numero")
      .maybeSingle();

    if (releaseError) throw releaseError;
    if (released?.numero) liberadas.push(released.numero);
  }

  await sincronizarOficina(scope, liberadas, "Disponible");
  return liberadas;
}

export async function retenerBoletasTemporales(
  scope: ReservationScope,
  numerosInput: unknown[],
  client: ClientData
): Promise<HoldResult> {
  await liberarReservasTemporalesExpiradas(scope);

  const numeros = numerosUnicos(numerosInput);
  const holdToken = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TEMPORARY_RESERVATION_MS).toISOString();
  const reservadas: string[] = [];
  const noDisponibles: string[] = [];

  for (const numero of numeros) {
    let query = supabaseAdmin
      .from("boletas")
      .update({
        estado: "No disponible",
        canal: TEMPORARY_RESERVATION_CHANNEL,
        nombre_cliente: client.firstName || null,
        telefono_cliente: client.phone || null,
        updated_at: holdToken,
      })
      .eq("empresa_id", scope.empresaId)
      .eq("proyecto_id", scope.proyectoId)
      .eq("numero", numero)
      .eq("estado", "Disponible");

    if (scope.vendedorUserId) query = query.eq("vendedor_user_id", scope.vendedorUserId);
    else query = query.eq("vendedor_nombre", "Oficina").is("vendedor_user_id", null);

    const { data, error } = await query.select("numero").maybeSingle();
    if (error) throw error;

    if (data?.numero) reservadas.push(data.numero);
    else noDisponibles.push(numero);
  }

  await sincronizarOficina(scope, reservadas, "No disponible");
  return { holdToken, expiresAt, reservadas, noDisponibles };
}

export async function cancelarReservaTemporal(
  scope: ReservationScope,
  numerosInput: unknown[],
  holdToken: string
) {
  const numeros = numerosUnicos(numerosInput);
  const liberadas: string[] = [];

  for (const numero of numeros) {
    let query = supabaseAdmin
      .from("boletas")
      .update({
        estado: "Disponible",
        canal: canalAlLiberar(scope.vendedorUserId),
        nombre_cliente: null,
        telefono_cliente: null,
        email_cliente: null,
        valor_pagado: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", scope.empresaId)
      .eq("proyecto_id", scope.proyectoId)
      .eq("numero", numero)
      .eq("estado", "No disponible")
      .eq("canal", TEMPORARY_RESERVATION_CHANNEL)
      .eq("updated_at", holdToken);

    if (scope.vendedorUserId) query = query.eq("vendedor_user_id", scope.vendedorUserId);
    else query = query.eq("vendedor_nombre", "Oficina").is("vendedor_user_id", null);

    const { data, error } = await query.select("numero").maybeSingle();
    if (error) throw error;
    if (data?.numero) liberadas.push(data.numero);
  }

  await sincronizarOficina(scope, liberadas, "Disponible");
  return liberadas;
}

export async function confirmarReservaTemporal(
  scope: ReservationScope,
  numerosInput: unknown[],
  holdToken: string,
  finalCanal: string
) {
  const holdDate = new Date(holdToken);
  const vencida = Number.isNaN(holdDate.getTime()) || Date.now() - holdDate.getTime() >= TEMPORARY_RESERVATION_MS;

  if (vencida) {
    const liberadas = await cancelarReservaTemporal(scope, numerosInput, holdToken);
    return { expired: true, confirmadas: [], liberadas };
  }

  const numeros = numerosUnicos(numerosInput);
  const confirmadas: string[] = [];
  const ahora = new Date().toISOString();
  const reservaGrupo = randomUUID();

  for (const numero of numeros) {
    let query = supabaseAdmin
      .from("boletas")
      .update({
        estado: "Debe",
        canal: finalCanal,
        oportunidad_creada: false,
        reserva_grupo: reservaGrupo,
        updated_at: ahora,
      })
      .eq("empresa_id", scope.empresaId)
      .eq("proyecto_id", scope.proyectoId)
      .eq("numero", numero)
      .eq("estado", "No disponible")
      .eq("canal", TEMPORARY_RESERVATION_CHANNEL)
      .eq("updated_at", holdToken);

    if (scope.vendedorUserId) query = query.eq("vendedor_user_id", scope.vendedorUserId);
    else query = query.eq("vendedor_nombre", "Oficina").is("vendedor_user_id", null);

    const { data, error } = await query.select("numero").maybeSingle();
    if (error) throw error;
    if (data?.numero) confirmadas.push(data.numero);
  }

  await sincronizarOficina(scope, confirmadas, "Debe");
  return { expired: false, confirmadas, liberadas: [] as string[] };
}
