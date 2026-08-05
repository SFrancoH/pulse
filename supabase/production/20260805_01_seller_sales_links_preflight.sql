-- PULSE seller public links: preflight (READ ONLY)
-- Este script no modifica datos ni estructura.

select
  to_regclass('public.seller_sales_links') as tabla_actual,
  count(*) filter (where vendedor_user_id is not null) as boletas_vinculadas_a_vendedor
from public.boletas;

