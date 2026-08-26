# DATA_MODEL

La fuente de verdad del schema es `TRAZA_FINAL_SCHEMA.sql` (28 tablas + 5 vistas). No se regenera desde el ORM ni se modifica sin autorización.

## Grupos de tablas

**Maestras**: `clientes_b2b`, `cuentas_b2b`, `planta_fija_b2b`, `planta_movil_b2b`.

**Facturación**: `facturas_b2b`, `notas_credito_b2b`, `aplicaciones_nota_credito`, `validaciones_facturacion`, `casos_facturacion`, `conformidades`, `conformidad_eventos`.

**Cobranzas**: `pagos_b2b`, `gestiones_cobranza`, `promesas_pago`, `emails_cobranza`, `casos_cobranza`.

**Recaudo**: `movimientos_bancarios_demo` (fuente simulada del MVP — no hay conexión bancaria real), `matches_bancarios`, `conciliaciones`, `aplicaciones_pago`, `rebajas_documento`.

**Orquestación/IA/reglas/trazabilidad**: `trazas_ciclo_ingreso`, `agent_tasks`, `decisiones_ia`, `business_rules`, `audit_log`.

**ML**: `ml_predictions`.

## Vistas operativas usadas por el backend

- `v_facturas_saldo` — saldo real por factura (`monto - notas_credito_aplicadas - pagos_aplicados`).
- `v_cartera_cobranza` — cartera pendiente con aging (`POR_VENCER`, `0_30`, `31_60`, `61_90`, `MAS_90`).
- `v_ml_riesgo_actual` — última predicción de riesgo por cliente.
- `v_servicios_b2b` — unión de planta fija/móvil.
- `v_cliente_360` — vista consolidada usada por el módulo Cliente 360.

## Regla financiera crítica

```
factura.estado == 'APROBADO'  →  conformidad de Facturación (nunca "pagada")
saldo real = monto - notas_credito_aplicadas - pagos_aplicados (v_facturas_saldo)
```

## Origen de los datos cargados (`backend/scripts/seed.py`)

Los CSV en `C:\Users\LENOVO\Desktop\data\csv` (fuente más reciente, verificada contra `TRAZA_FINAL_V7\DATA`) traen un modelo más simple que el schema nuevo (ids numéricos, sin `tipo_factura`, sin conformidad, sin matching bancario). El seed:

- Mapea `cliente_id`/`cuenta_id`/`factura_id` numéricos → UUID del schema nuevo.
- Clasifica `tipo_factura` (CICLICA/ACICLICA) por una regla simple de monto (no existe esa señal en el CSV origen): facturas con `monto_neto` sobre un umbral se tratan como acíclicas, ya que en la práctica son las que ameritan conformidad previa. Documentado en `services/facturacion.clasificar_tipo_factura`.
- Los 2903 pagos ya `CONCILIADO` en el CSV se cargan directo como `pagos_b2b` + `aplicaciones_pago` (son historial ya resuelto).
- Los 74 pagos `PENDIENTE` (sin factura identificada en el CSV origen) se convierten en `movimientos_bancarios_demo` reales, para poder ejercer el flujo completo de matching/conciliación en la demo.
- `predicciones_riesgo.csv` se carga como snapshot inicial de `ml_predictions`; el modelo `.pkl` real también puede recalcularse en vivo desde `POST /api/bi/riesgo/recalcular`.
- `casos.csv`/`decisiones_ia.csv` del CSV origen **no se importan tal cual** (eran ~3400 filas casi 1:1 con las facturas, generadas sintéticamente sin diferenciación real). En su lugar, el motor real (`services/facturacion.validar_factura`, `detectar_servicio_no_facturado`) corre sobre los datos ya cargados y genera casos únicamente cuando encuentra una excepción real.
