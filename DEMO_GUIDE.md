# DEMO_GUIDE

Recorrido pensado para el jurado: **Facturación → Cobranzas → Conciliación → Rebaja → BI → Preguntar a TRAZA → Auditoría**, sin editar la base manualmente durante la presentación.

## Antes de empezar

1. `backend/`: `uvicorn app.main:app --port 8000` (si ya corriste `scripts/seed.py` una vez, no hace falta repetirlo).
2. `react-export/`: `npm run dev`, abrir la URL que muestre Vite.
3. Verifica `GET http://localhost:8000/` → `dify_configurado: true`, `database_conectada: true`.

## Acto 1 — Facturación

1. Entra a **Facturación → Resumen del ciclo**. Verás validaciones ya ejecutadas por el seed y casos abiertos reales (ej. `SERVICIO_ACTIVO_SIN_FACTURACION`: servicios activos sin facturación reciente, detectados por el motor real, no hardcodeados).
2. Click en un caso → **Revisar caso**: se abre el drawer con la evidencia registrada por el agente.
3. Ve a la tab **Emisión**. Ahí verás facturas cíclicas listas y, si el seed dejó alguna acíclica en `ESPERANDO_CONFORMIDAD`, aparecerá **Bloqueada**.
4. Para mostrar el flujo de conformidad completo: en **Casos detectados**, busca una factura acíclica y haz clic en **Revisar caso** → te lleva a la pantalla de Conformidad. Escribe una respuesta como *"Aprobado, conforme con la factura"* y pulsa **Registrar respuesta** → la conformidad pasa a `APROBADO`.
5. Vuelve a **Emisión**: la factura ya no está bloqueada → **Emitir**.

## Acto 2 — Cobranzas y Recaudo

1. Ve a **Cobranzas & Recaudo → Bandeja IA**. Hay correos de demo sin clasificar (Outlook no está conectado a un buzón real en este entorno — están marcados explícitamente como datos de demostración).
2. Abre un correo de tipo *"Confirmo transferencia..."* → **Clasificar con IA**: FastAPI llama a Dify Cloud.
   - **Nota para el presentador**: la app de Dify de este proyecto a veces responde `Model is not configured` (configuración pendiente en el panel de Dify Cloud del proyecto, no un fallo del backend). Si ocurre, el correo queda marcado como pendiente de revisión — es el comportamiento correcto y seguro, no un error de la demo. Puedes mostrar la corrección manual como plan B.
3. Ve a **Gestión de cobranza**: elige una factura con saldo vencido → **Gestionar caso** → registra una promesa de pago o notas.
4. Ve a **Conciliación y recaudo**. Verás movimientos bancarios (`movimientos_bancarios_demo`, fuente simulada del MVP) pendientes.
5. Elige uno → **Ver detalle** → **Evaluar match**: el backend calcula el score determinístico (referencia 40% + monto 30% + cliente 20% + fecha 10%) contra la cartera real.
6. Si el score es alto y sin ambigüedad → **Confirmar coincidencia**. Si es parcial/ambiguo → se ve **Revisar manualmente** con los criterios que sí y no coincidieron.
7. Al confirmar: se crea la conciliación, la aplicación de pago y la rebaja automáticamente. El botón **Conciliar automáticos** (arriba de la tabla) corre esto mismo en lote sobre los movimientos con match exacto e inequívoco.

## Acto 3 — BI y Recupero

1. Ve a **BI & Recupero → Resumen de cartera**: el saldo ya refleja la conciliación del Acto 2.
2. **Riesgo y predicción**: probabilidad de pago calculada por el modelo `.pkl` real (botón *Recalcular* disponible vía API si quieres mostrar el modelo ejecutándose en vivo).
3. **Oportunidades de recupero**: priorización por saldo + aging + riesgo + incumplimientos.
4. **Consultas IA**: pregunta *"¿Cuál es la cartera vencida actual?"* — si Dify no está disponible, TRAZA responde igual con los datos reales (fallback local), sin quedar en blanco.

## Acto 4 — Preguntar a TRAZA (global)

Desde cualquier pantalla, botón **Preguntar a TRAZA** (arriba a la derecha). Preguntas que funcionan con datos reales:

1. ¿Cuál es la cartera vencida actual?
2. ¿Qué clientes tienen mayor riesgo de pago?
3. ¿Qué facturas están pendientes de conformidad?
4. ¿Qué pagos necesitan revisión manual?
5. ¿Cuál es el ratio cobrado/facturado?
6. ¿Qué oportunidades de recupero tenemos?
7. ¿Qué casos críticos necesitan atención?

## Acto 5 — Auditoría

1. Ve a **Auditoría**: verás el conteo real de eventos, acciones de IA y revisiones pendientes.
2. En la tabla de eventos, busca una fila de la conciliación que hiciste en el Acto 2 y pulsa **Ver detalle** → se reconstruye la traza completa (`correlation_id`) desde la conciliación hasta la rebaja.
3. **Configuración**: cambia `MATCH_AUTOMATICO_SCORE_MIN` o `MORA_CRITICA_DIAS` y explica que el motor usa ese valor en la siguiente evaluación, sin tocar código.

## Mensaje de cierre

*"Las operaciones reales están llenas de excepciones. TRAZA no intenta esconderlas: las detecta, las organiza y permite resolverlas sin perder el control del ciclo del ingreso. TRAZA automatiza lo inequívoco y organiza las excepciones."*
