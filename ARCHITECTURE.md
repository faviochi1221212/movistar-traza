# ARCHITECTURE

```
React (react-export/)
   |
   v
FastAPI (backend/)
   |-- Supabase / PostgreSQL   (verdad operativa y financiera)
   |-- Dify Cloud              (clasifica correos, explica en lenguaje natural)
   |-- ML scikit-learn         (probabilidad de pago)
   |-- Microsoft Graph/Outlook (canal de correo, opcional)
```

**Principio**: Dify entiende. FastAPI decide. Supabase recuerda. React permite operar. El Orquestador coordina.

## Capas del backend (`backend/app/`)

- `api/` — routers FastAPI, uno por dominio (`facturacion`, `cobranzas`, `recaudo`, `bi`, `auditoria`, `configuracion`, `chat`, `outlook`, `cliente360`, `centro_control`). Sin lógica de negocio: parsean el request, llaman a `services/`, serializan la respuesta.
- `services/` — lógica determinística real:
  - `facturacion.py` — validaciones, casos, conformidad, emisión.
  - `cobranzas.py` — cartera, gestiones, promesas, clasificación de correos (vía Dify).
  - `conciliacion.py` — matching bancario, conciliación, aplicación de pago, rebaja.
  - `bi.py` — KPIs agregados, features para ML, oportunidades de recupero.
  - `asistente.py` — catálogo fijo de funciones `consultar_*` para "Preguntar a TRAZA" (nunca SQL libre generado por el LLM).
  - `rules.py` — lectura/escritura de `business_rules`, con defaults documentados solo como fallback.
  - `audit.py` — único punto de escritura a `audit_log` (append-only a nivel aplicación).
- `core/orchestrator.py` — único punto que crea/avanza `agent_tasks` y `trazas_ciclo_ingreso`. No es un LLM ni un microservicio: es una función de FastAPI.
- `integrations/` — `dify.py` (cliente HTTP con 1 reintento y manejo explícito de fallos) y `outlook.py` (adaptador Microsoft Graph, inactivo sin credenciales).
- `ml/predictor.py` — carga el `.pkl` una sola vez (`lru_cache`) y expone `predict_proba`.
- `models/models.py` — SQLAlchemy ORM, adaptado 1:1 al SQL ya aplicado en Supabase (el SQL es la fuente de verdad, no el ORM).

## Reglas de diseño respetadas

- **`APROBADO` en una factura nunca significa pagada.** El pago real se determina exclusivamente por `pagos_b2b` + `conciliaciones` + `aplicaciones_pago` (ver `services/facturacion.py` y `conciliacion.py`).
- **El matching bancario es determinístico**, nunca decidido por un LLM (`conciliacion.calcular_score`): referencia/factura 40%, monto 30%, cliente/RUC 20%, fecha 10%. Umbrales en `business_rules` (`MATCH_AUTOMATICO_SCORE_MIN`, `MATCH_REVISION_MANUAL_SCORE_MIN`).
- **No hay flujo de escalamiento.** Todo lo que no se puede automatizar pasa a "Revisar manualmente".
- **Los umbrales de negocio viven en `business_rules`**, nunca hardcodeados en Python (`services/rules.py` es el único punto de lectura).
- **Dify solo interpreta lenguaje.** Nunca escribe directamente a Supabase ni decide una conciliación o un pago.
