# AGENTS

TRAZA no modela "un agente por función". Hay tres capacidades especializadas más un orquestador, todas dentro del mismo backend FastAPI (`agent_tasks.agente` acepta `ORQUESTADOR`, `FACTURACION`, `COBRANZAS`, `BI`).

## Agente de Facturación (`services/facturacion.py`)

- `clasificar_tipo_factura`, `validar_factura` (cliente activo, moneda, monto, periodo, consistencia aritmética), `detectar_servicio_no_facturado`.
- `crear_solicitud_conformidad`, `enviar_recordatorio`, `procesar_respuesta_conformidad`, `marcar_sin_respuesta_vencidas` (umbrales desde `business_rules`: `CONFORMIDAD_RECORDATORIO_HORAS`, `CONFORMIDAD_SIN_RESPUESTA_HORAS`).
- `emitir_factura` (solo si cíclica, o acíclica con conformidad `APROBADO`).

## Agente de Cobranzas (incluye Recaudo — `services/cobranzas.py` + `services/conciliacion.py`)

- Cobranzas: `obtener_cartera`, `registrar_gestion`, `registrar_promesa_pago`, `detectar_promesas_incumplidas`, `clasificar_email` (vía Dify), `corregir_clasificacion`.
- Recaudo: `evaluar_match` (score determinístico), `conciliar_match`, `rechazar_match`, `aplicar_pago_factura`, `generar_rebaja`, `conciliar_automaticos_pendientes`.

## Agente de BI (`services/bi.py`)

- `calcular_stats_clientes` (features reales para ML), `recalcular_riesgo` (ejecuta el `.pkl`), `oportunidades_recupero` (saldo + aging + riesgo + incumplimientos), `resumen_general`.

## Orquestador (`core/orchestrator.py`)

No es un LLM ni un microservicio. Responsable de:

1. Recibir un evento (ej. una emisión, una conciliación).
2. `get_or_create_traza` — busca o crea la `traza_ciclo_ingreso` de esa factura/cliente.
3. `crear_tarea` — registra un `agent_task` en `DETECTED`.
4. `avanzar_tarea` — mueve el estado (`ASSIGNED → IN_PROGRESS → WAITING_HUMAN → EXECUTED → VERIFIED`, o `FAILED`/`CANCELLED`).
5. Cada paso queda en `audit_log`.

Hoy el orquestador se invoca explícitamente al emitir una factura y al conciliar un pago (donde nace o se reutiliza la traza de esa factura); es el punto de extensión natural para conectar más eventos según se necesite.

## Preguntar a TRAZA (`services/asistente.py`)

Catálogo cerrado de funciones (`consultar_facturacion`, `consultar_cartera`, `consultar_cliente`, `consultar_conciliacion`, `consultar_riesgo`, `consultar_auditoria`, `consultar_recupero`). Nunca se genera SQL libre desde el LLM: FastAPI clasifica la pregunta por palabras clave, consulta los datos reales, construye un contexto compacto y se lo pasa a Dify para que lo explique en lenguaje natural. Si Dify no responde, se devuelve el contexto ya redactado (fallback local), para que la pantalla nunca se quede sin respuesta.
