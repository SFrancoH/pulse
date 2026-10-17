# Core — plataforma

Servicios transversales: autenticación, autorización, empresas y usuarios. Esta carpeta es una frontera futura: el código actual permanece en `lib/` y `app/` hasta que se apruebe una migración específica.

- No importar lógica de `src/modules/*` desde `core`.
- Todo cambio en contratos compartidos requiere evaluación de impacto y autorización.
- No mover rutas públicas ni modificar esquema en esta fase.
