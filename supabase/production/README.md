# Despliegue seguro: acceso de vendedores

Estos scripts están diseñados para una base de datos activa. Ninguno incluye
`UPDATE`, `DELETE`, `TRUNCATE`, `DROP` ni backfills sobre registros existentes.

## Orden obligatorio

1. Ejecutar `20260804_01_seller_access_preflight.sql`.
2. Confirmar que las consultas de huérfanos y cruces de empresa regresan cero filas.
3. Ejecutar `20260804_02_seller_access_schema.sql` en una ventana de menor tráfico.
4. Abrir `20260804_03_seller_access_indexes.sql` y ejecutar cada sentencia
   `CREATE INDEX CONCURRENTLY` por separado. En Supabase SQL Editor no se debe
   ejecutar el archivo completo como un único lote porque puede envolverlo en una
   transacción y devolver el error `25001`.
5. Desplegar el código de la aplicación.
6. Ejecutar `20260804_04_seller_access_validate.sql` después de confirmar el funcionamiento.

## Garantías de compatibilidad

- Las columnas nuevas de `asignaciones_vendedores` aceptan `NULL`; los registros
  históricos permanecen intactos.
- El nuevo `DEFAULT` de `boletas.estado` solo afecta inserts futuros.
- Las llaves foráneas se crean inicialmente como `NOT VALID`: no reescriben ni
  corrigen datos históricos automáticamente.
- Los índices usan `CREATE INDEX CONCURRENTLY` para mantener disponibles las
  escrituras normales durante su construcción.
- Las sesiones antiguas sin `user_id` continúan funcionando: el servidor resuelve
  temporalmente el usuario por email hasta que la cookie expire.

## Condiciones para detener el despliegue

No continuar con el esquema o el código si el preflight muestra:

- `vendedor_user_id` sin usuario correspondiente;
- vendedores relacionados con una empresa distinta a la boleta;
- boletas asociadas a proyectos inexistentes;
- estados diferentes de `Disponible`, `No disponible`, `Debe`, `Abonado` o `Pagado`.

Ante un error de bloqueo (`lock_timeout`), no aumentar el tiempo automáticamente.
Reintentar en una ventana de menor actividad.

## Reversión segura

Si la aplicación presenta un problema, revertir primero el despliegue de código.
Las columnas, índices y constraints nuevos pueden permanecer porque son compatibles
con el código anterior. No eliminar columnas ni constraints mientras el sistema esté
activo sin una revisión adicional.
