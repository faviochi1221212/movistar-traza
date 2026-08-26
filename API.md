# API

Base: `/api`. Todas las respuestas son JSON. `GET /` (sin prefijo) es el health check.

## Facturación

```
GET  /api/facturacion/resumen
GET  /api/facturacion/validaciones?resultado=&limit=&offset=
GET  /api/facturacion/casos?estado=&limit=&offset=
GET  /api/facturacion/casos/{caso_id}
POST /api/facturacion/casos/{caso_id}/resolver          {resolucion?, accion: CREAR_TAREA|DESCARTAR}
GET  /api/facturacion/conformidades?estado=
GET  /api/facturacion/conformidades/{factura_id}
POST /api/facturacion/facturas/{factura_id}/solicitar-conformidad
POST /api/facturacion/conformidades/{conformidad_id}/recordatorio
POST /api/facturacion/conformidades/{conformidad_id}/respuesta   {respuesta}
GET  /api/facturacion/emision
POST /api/facturacion/facturas/{factura_id}/emitir
POST /api/facturacion/procesar-lote?limit=300             ejecuta el motor de validaciones sobre facturas nuevas
```

## Cobranzas

```
GET  /api/cobranzas/resumen
GET  /api/cobranzas/cartera?aging=&limit=&offset=
GET  /api/cobranzas/emails?clasificacion=&limit=
GET  /api/cobranzas/emails/{email_id}
POST /api/cobranzas/emails/{email_id}/clasificar          llama a Dify
POST /api/cobranzas/emails/{email_id}/corregir            {clasificacion, usuario?}
GET  /api/cobranzas/casos?estado=
GET  /api/cobranzas/gestion/{factura_id}
POST /api/cobranzas/gestiones/{factura_id}                {notas?, prioridad?}
POST /api/cobranzas/promesas/{factura_id}                 {monto, fecha_prometida, origen?}
POST /api/cobranzas/procesar-lote
```

## Recaudo

```
GET  /api/recaudo/resumen
GET  /api/recaudo/movimientos?estado=&limit=
GET  /api/recaudo/movimientos/{movimiento_id}
POST /api/recaudo/movimientos/{movimiento_id}/evaluar
POST /api/recaudo/matches/{match_id}/confirmar             {factura_id?}
POST /api/recaudo/matches/{match_id}/rechazar              {motivo}
POST /api/recaudo/procesar-lote                            concilia automáticos EXACTOS
GET  /api/recaudo/export                                   CSV
```

## BI

```
GET  /api/bi/resumen
GET  /api/bi/riesgo?limit=
POST /api/bi/riesgo/recalcular?limit=      ejecuta el modelo .pkl real
GET  /api/bi/recupero?limit=
```

## Auditoría / Configuración / Cliente 360 / Centro de Control

```
GET  /api/auditoria/resumen
GET  /api/auditoria?limit=&offset=&entidad_tipo=
GET  /api/auditoria/export                  CSV
GET  /api/auditoria/{trace_id}              reconstruye la traza completa

GET  /api/configuracion/reglas?modulo=
PUT  /api/configuracion/reglas/{codigo}     {valor}

GET  /api/cliente360/buscar?q=
GET  /api/cliente360/{cliente_id}

GET  /api/centro-control/resumen
```

## Chat / Outlook

```
POST /api/chat                              {pregunta}
POST /api/outlook/sync
POST /api/outlook/messages/{message_id}/reply   {comentario}
```
