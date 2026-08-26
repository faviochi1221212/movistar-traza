# IMPLEMENTATION_PLAN — TRAZA

Plan real de construcción del MVP (AI Telecom Challenge 2026, Desafío 03 SON-IA), ejecutado por vertical funcional según la sección 39 del Prompt Maestro.

## Fuentes de verdad usadas

- Schema: `TRAZA_FINAL_SCHEMA.sql` (aplicado tal cual a un proyecto Supabase real).
- Frontend visual: `TRAZA UI mockups (1)/react-export` (copiado a `react-export/`).
- Datos: `C:\Users\LENOVO\Desktop\data\csv` (más reciente que `TRAZA_FINAL_V7\DATA`).
- ML: `C:\Users\LENOVO\Desktop\data\machine\*.pkl` (Pipeline StandardScaler + LogisticRegression, cargado con `joblib`).

## Decisiones de arranque (consultadas con el usuario)

1. **Base de datos**: se reusó un proyecto Supabase ya existente de otra iteración del hackathon (`movistar traza/`), haciendo `DROP` de sus 15 tablas del schema viejo y aplicando `TRAZA_FINAL_SCHEMA.sql` completo. El ID del proyecto Supabase vive solo en `backend/.env` (no versionado).
2. **Backend**: escrito desde cero, alineado al schema nuevo. El backend viejo (`movistar traza/traza/backend`) se usó solo como referencia de patrones (no se copió código), porque su modelo de datos (`billing_cases` genérico) era incompatible con las tablas específicas del schema nuevo (`casos_facturacion`, `conformidades`, `matches_bancarios`, `business_rules`, etc.).

## Fases ejecutadas

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Backend base (FastAPI + SQLAlchemy + Supabase), modelos ORM 1:1 con el schema, `rules.py`, `audit.py`, `orchestrator.py` | Hecho |
| 2 | `scripts/seed.py`: ETL de los CSV oficiales al schema nuevo + motor real de validaciones/casos sobre los datos cargados | Hecho |
| 3 | Facturación (backend + React): validaciones, casos, conformidad, emisión | Hecho |
| 4 | Cobranzas (backend + React): cartera, Bandeja IA (Dify), gestiones, promesas | Hecho |
| 5 | Recaudo/Conciliación (backend + React): matching determinístico, conciliación manual/automática, aplicación de pago, rebaja | Hecho |
| 6 | BI/ML (backend + React): KPIs agregados, integración real del `.pkl`, oportunidades de recupero | Hecho |
| 7 | Dify (clasificador + asistente): integrado; ver bloqueo en DEMO_GUIDE/README sobre configuración del modelo en Dify Cloud | Hecho (con degradación controlada) |
| 8 | Outlook | Interfaz lista (`OutlookProvider`, Microsoft Graph); sin credenciales `MS_*` reales, deshabilitado explícitamente en `/` y en `/api/outlook/sync` |
| 9 | Auditoría, Configuración, Centro de Control, Cliente 360 (pantallas nuevas, no existían en los mockups) | Hecho |
| 10 | Tests smoke (`pytest`), `npm run build`, verificación E2E manual vía API | Hecho |
| 11 | Documentación (este set de `.md`) | Hecho |

## Verificación E2E realizada (sin editar la base manualmente)

Se ejecutó en vivo, contra Supabase real, vía llamadas a la API:
Factura acíclica → conformidad `PENDIENTE` → respuesta con texto de aprobación → conformidad `APROBADO` → factura emitida → movimiento bancario evaluado (`evaluar_match`) → match confirmado manualmente → conciliación `CONCILIADO` → aplicación de pago → rebaja `PROCESADA` → saldo recalculado vía `v_facturas_saldo` → BI refleja el cambio → `audit_log` reconstruye la traza completa por `trace_id`.

## Pendiente / mejoras posibles si hay más tiempo

- Conectar el buscador del Header a Cliente 360.
- Vincular `trace_id` desde el inicio del ciclo de facturación (hoy la traza nace en la emisión o en la conciliación, no en la primera validación).
- Ampliar `docs/` con capturas de pantalla para el jurado.
