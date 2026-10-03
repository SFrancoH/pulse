-- Fixture de las cuatro tablas: DDL aportado por el usuario el 2026-10-03.
-- Sólo para PostgreSQL LOCAL con datos ficticios; NO ejecutar en producción.
-- admin_users debe crearse antes en el test (id uuid) para resolver los FK.

create table public.boletas (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  proyecto_id text not null,
  numero text not null,
  estado text not null default 'Disponible'::text,
  nombre_cliente text null,
  telefono_cliente text null,
  email_cliente text null,
  valor_pagado numeric null default 0,
  comprobante_url text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  vendedor_nombre text null default 'Oficina'::text,
  canal text null,
  vendedor_user_id uuid null,
  oportunidad_creada boolean not null default true,
  reserva_grupo uuid null,
  oportunidad_error_at timestamp with time zone null,
  ciudad_cliente text null,
  constraint boletas_pkey primary key (id),
  constraint boletas_numero_unico_por_proyecto unique (proyecto_id, numero),
  constraint boletas_unicas_por_proyecto unique (empresa_id, proyecto_id, numero),
  constraint boletas_vendedor_user_id_fkey foreign key (vendedor_user_id) references admin_users(id) on delete set null not valid,
  constraint boletas_estado_check check (estado = any(array['Disponible'::text, 'No disponible'::text, 'Debe'::text, 'Abonado'::text, 'Pagado'::text]))
);
create index if not exists idx_boletas_empresa_proyecto_estado_numero on public.boletas using btree (empresa_id, proyecto_id, estado, numero);
create index if not exists idx_boletas_proyecto_estado on public.boletas using btree (proyecto_id, estado);
create unique index if not exists boletas_proyecto_numero_unique on public.boletas using btree (proyecto_id, numero);
create index if not exists idx_boletas_vendedor_proyecto_numero on public.boletas using btree (vendedor_user_id, proyecto_id, numero);

create table public.asignaciones_vendedores (
  id uuid not null default gen_random_uuid(),
  empresa_id text null,
  proyecto_id text null,
  vendedor_nombre text null,
  numero_desde text null,
  numero_hasta text null,
  cantidad integer null default 0,
  boleta_inicial_id uuid null,
  created_at timestamp with time zone null default now(),
  vendedor_user_id uuid null,
  asignado_por_user_id uuid null,
  constraint asignaciones_vendedores_pkey primary key (id),
  constraint asignaciones_asignado_por_user_id_fkey foreign key (asignado_por_user_id) references admin_users(id) on delete set null not valid,
  constraint asignaciones_vendedor_user_id_fkey foreign key (vendedor_user_id) references admin_users(id) on delete set null not valid
);
create index if not exists idx_asignaciones_vendedor_proyecto on public.asignaciones_vendedores using btree (vendedor_user_id, proyecto_id);
create index if not exists idx_asignaciones_proyecto_created_at on public.asignaciones_vendedores using btree (proyecto_id, created_at);

create table public.proyectos (
  id text not null,
  empresa_id text null,
  nombre text null,
  slug text null,
  precio_boleta numeric null default 60000,
  titulo_landing text null,
  descripcion_landing text null,
  imagen_principal_url text null,
  formulario_compra_url text null,
  estado text null default 'activo'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  flyer_url text null,
  sales_token text not null default (replace(gen_random_uuid()::text, '-'::text, '') || substring(replace(gen_random_uuid()::text, '-'::text, '') from 1 for 16)),
  constraint proyectos_pkey primary key (id),
  constraint proyectos_empresa_slug_unique unique (empresa_id, slug),
  constraint proyectos_estado_check check (estado = any(array['activo'::text, 'inactivo'::text, 'finalizado'::text]))
);
create index if not exists idx_proyectos_empresa_slug on public.proyectos using btree (empresa_id, slug);
create unique index if not exists proyectos_sales_token_key on public.proyectos using btree (sales_token);

create table public.seller_sales_links (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  proyecto_id text not null,
  vendedor_user_id uuid not null,
  token text not null,
  estado text not null default 'activo'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint seller_sales_links_pkey primary key (id),
  constraint seller_sales_links_empresa_proyecto_vendedor_key unique (empresa_id, proyecto_id, vendedor_user_id),
  constraint seller_sales_links_token_key unique (token),
  constraint seller_sales_links_vendedor_user_id_fkey foreign key (vendedor_user_id) references admin_users(id) on delete restrict,
  constraint seller_sales_links_estado_check check (estado = any(array['activo'::text, 'revocado'::text]))
);
