-- PULSE seller public links: schema aditivo
-- Ejecutar después de 20260805_01_seller_sales_links_preflight.sql.
-- No modifica boletas, proyectos, usuarios ni asignaciones existentes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.seller_sales_links (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  proyecto_id text not null,
  vendedor_user_id uuid not null,
  token text not null,
  estado text not null default 'activo',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint seller_sales_links_token_key unique (token),
  constraint seller_sales_links_empresa_proyecto_vendedor_key unique (empresa_id, proyecto_id, vendedor_user_id),
  constraint seller_sales_links_estado_check check (estado in ('activo', 'revocado')),
  constraint seller_sales_links_vendedor_user_id_fkey
    foreign key (vendedor_user_id)
    references public.admin_users(id)
    on delete restrict
);

commit;

