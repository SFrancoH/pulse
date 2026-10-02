// PostgREST: all three conditions must hold, even when estado is Disponible.
// Empty strings are accepted for legacy records; any other value blocks the ticket.
export const BOLETA_LIBRE_FILTER =
  'and(or(nombre_cliente.is.null,nombre_cliente.eq.""),or(telefono_cliente.is.null,telefono_cliente.eq.""),or(valor_pagado.is.null,valor_pagado.eq.0))';
