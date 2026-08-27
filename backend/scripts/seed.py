"""Carga los CSV oficiales de C:\\...\\data\\csv al schema nuevo de Supabase y
ejecuta el motor de reglas real (validaciones, casos, gestiones) para dejar
la demo lista. No inventa columnas: lee exactamente lo que traen los CSV.

Uso:
    python scripts/seed.py
"""
import math
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.models import (
    AplicacionNotaCredito, AplicacionPago, CasoFacturacion, ClienteB2B, CuentaB2B,
    EmailCobranza, FacturaB2B, MLPrediction, MovimientoBancarioDemo, NotaCreditoB2B,
    PagoB2B, PlantaFijaB2B, PlantaMovilB2B,
)
from app.services import facturacion as facturacion_svc
from app.services.audit import log as audit_log

random.seed(42)

BANCOS = ["BCP", "BBVA", "Interbank", "Scotiabank"]


def parse_yyyymmdd(value) -> date:
    s = str(int(value))
    return datetime.strptime(s, "%Y%m%d").date()


def parse_date_flexible(value) -> date:
    """Los CSV mezclan fechas como 20260525 y 2026-05-25 para la misma columna."""
    s = str(value).strip()
    if "-" in s:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    return datetime.strptime(s, "%Y%m%d").date()


def to_uuid() -> uuid.UUID:
    return uuid.uuid4()


def main():
    settings = get_settings()
    data_dir = Path(settings.seed_data_dir)
    db = SessionLocal()

    print("Leyendo CSVs desde", data_dir)
    clientes_df = pd.read_csv(data_dir / "clientes.csv")
    cuentas_df = pd.read_csv(data_dir / "cuentas_cliente.csv")
    servicios_df = pd.read_csv(data_dir / "servicios.csv")
    facturas_df = pd.read_csv(data_dir / "facturas.csv")
    notas_df = pd.read_csv(data_dir / "notas_credito.csv")
    pagos_df = pd.read_csv(data_dir / "pagos.csv")
    predicciones_df = pd.read_csv(data_dir / "predicciones_riesgo.csv")

    # ---- 1. Clientes ----
    cliente_map: dict[int, uuid.UUID] = {}
    cliente_razon_map: dict[int, str] = {}
    clientes_rows = []
    for _, r in clientes_df.iterrows():
        cid = to_uuid()
        cliente_map[int(r["cliente_id"])] = cid
        cliente_razon_map[int(r["cliente_id"])] = r["nombre_cliente"]
        clientes_rows.append({
            "id": cid,
            "segmento_pais": r.get("segmento"),
            "tipo_documento": "RUC",
            "numero_identificacion_fiscal": str(r["ruc"]),
            "razon_social": r["nombre_cliente"],
            "activo": str(r.get("estado_cliente")).strip().upper() == "ACTIVO",
        })
    db.bulk_insert_mappings(ClienteB2B, clientes_rows)
    db.commit()
    print(f"clientes_b2b: {len(clientes_rows)}")

    # ---- 2. Cuentas ----
    cuenta_map: dict[int, uuid.UUID] = {}
    cuentas_rows = []
    for _, r in cuentas_df.iterrows():
        cliente_id = cliente_map.get(int(r["cliente_id"])) if not pd.isna(r["cliente_id"]) else None
        if cliente_id is None:
            continue
        acc_id = to_uuid()
        cuenta_map[int(r["cuenta_id"])] = acc_id
        cuentas_rows.append({
            "id": acc_id, "cliente_id": cliente_id,
            "cod_cliente": str(r["codigo_cliente"]), "cod_cuenta": str(r["codigo_cuenta"]),
        })
    db.bulk_insert_mappings(CuentaB2B, cuentas_rows)
    db.commit()
    print(f"cuentas_b2b: {len(cuentas_rows)}")

    # ---- 3. Servicios (planta fija / movil) ----
    fija_rows, movil_rows = [], []
    for _, r in servicios_df.iterrows():
        if pd.isna(r["cliente_id"]):
            continue
        cliente_id = cliente_map.get(int(r["cliente_id"]))
        if cliente_id is None:
            continue
        cuenta_id = cuenta_map.get(int(r["cuenta_id"])) if not pd.isna(r.get("cuenta_id")) else None
        if r["tipo_servicio"] == "PLANTA_FIJA":
            fija_rows.append({"id": to_uuid(), "cliente_id": cliente_id, "cuenta_id": cuenta_id, "status_desc": r.get("estado")})
        else:
            movil_rows.append({"id": to_uuid(), "cliente_id": cliente_id, "cuenta_id": cuenta_id,
                                 "producto": r.get("producto"), "estado_linea": r.get("estado")})
    if fija_rows:
        db.bulk_insert_mappings(PlantaFijaB2B, fija_rows)
    if movil_rows:
        db.bulk_insert_mappings(PlantaMovilB2B, movil_rows)
    db.commit()
    print(f"planta_fija_b2b: {len(fija_rows)}, planta_movil_b2b: {len(movil_rows)}")

    # ---- 4. Facturas ----
    facturas_df = facturas_df.dropna(subset=["cliente_id"])
    max_fecha = facturas_df["fecha_emision"].apply(parse_yyyymmdd).max()
    corte_reciente = max_fecha - timedelta(days=10)

    factura_map: dict[int, uuid.UUID] = {}
    factura_meta: dict[int, dict] = {}
    factura_numero_map: dict[int, str] = {}
    facturas_rows = []
    en_pipeline_ids: list[int] = []

    for _, r in facturas_df.iterrows():
        cliente_id = cliente_map.get(int(r["cliente_id"]))
        if cliente_id is None:
            continue
        f_id = to_uuid()
        f_emision = parse_yyyymmdd(r["fecha_emision"])
        f_venc = parse_date_flexible(r["fecha_vencimiento"])
        monto = Decimal(str(r["monto_facturado"]))
        monto_neto = Decimal(str(r["monto_neto"]))
        igv = max(monto - monto_neto, Decimal("0"))
        tipo_factura = facturacion_svc.clasificar_tipo_factura(monto_neto)
        requiere_conf = tipo_factura == "ACICLICA"

        en_pipeline = f_emision >= corte_reciente
        estado = "GENERADO" if en_pipeline else "EMITIDO"

        factura_map[int(r["factura_id"])] = f_id
        factura_meta[int(r["factura_id"])] = {"cliente_id": cliente_id, "en_pipeline": en_pipeline, "tipo_factura": tipo_factura}
        factura_numero_map[int(r["factura_id"])] = r["numero_factura"]
        if en_pipeline:
            en_pipeline_ids.append(int(r["factura_id"]))

        facturas_rows.append({
            "id": f_id, "numero": r["numero_factura"], "cliente_id": cliente_id,
            "cuenta_id": cuenta_map.get(int(r["cuenta_id"])) if not pd.isna(r.get("cuenta_id")) else None,
            "fuente": "CSV_HISTORICO", "sistema": "LEGACY",
            "fecha_emision": f_emision, "fecha_vencimiento": f_venc, "moneda": r.get("moneda", "PEN"),
            "monto_neto": monto_neto, "igv": igv, "monto": monto,
            "tipo_factura": tipo_factura, "requiere_conformidad": requiere_conf,
            "estado": estado,
            "fecha_emision_real": None if en_pipeline else datetime.combine(f_emision, datetime.min.time(), tzinfo=timezone.utc),
        })

    for i in range(0, len(facturas_rows), 1000):
        db.bulk_insert_mappings(FacturaB2B, facturas_rows[i:i + 1000])
    db.commit()
    print(f"facturas_b2b: {len(facturas_rows)} (en pipeline de facturacion: {len(en_pipeline_ids)})")

    # ---- 5. Notas de credito ----
    nc_rows, nc_aplic_rows = [], []
    for idx, r in notas_df.iterrows():
        factura_csv_id = int(r["factura_id"]) if not pd.isna(r["factura_id"]) else None
        factura_id = factura_map.get(factura_csv_id) if factura_csv_id else None
        cliente_id = cliente_map.get(int(r["cliente_id"])) if not pd.isna(r["cliente_id"]) else None
        if cliente_id is None:
            continue
        nc_id = to_uuid()
        monto = Decimal(str(r["MONTO"]))
        estado = "APLICADA" if str(r.get("estado_nota")).upper() == "APLICADA" else "REGISTRADA"
        nc_rows.append({
            "id": nc_id, "numero": f"NC-{idx+1:06d}", "cliente_id": cliente_id, "factura_id": factura_id,
            "fecha_emision": parse_yyyymmdd(r["fecha_emision"]), "monto_sin_igv": monto, "igv": Decimal("0"),
            "monto": monto, "estado": estado, "motivo": r.get("motivo"),
        })
        if estado == "APLICADA" and factura_id:
            nc_aplic_rows.append({"id": to_uuid(), "nota_credito_id": nc_id, "factura_id": factura_id, "monto_aplicado": monto})
    if nc_rows:
        db.bulk_insert_mappings(NotaCreditoB2B, nc_rows)
    if nc_aplic_rows:
        db.bulk_insert_mappings(AplicacionNotaCredito, nc_aplic_rows)
    db.commit()
    print(f"notas_credito_b2b: {len(nc_rows)}, aplicaciones_nota_credito: {len(nc_aplic_rows)}")

    # ---- 6. Pagos ----
    pago_rows, aplic_rows, movimientos_rows = [], [], []
    for _, r in pagos_df.iterrows():
        factura_csv_id = int(r["factura_id"]) if not pd.isna(r["factura_id"]) else None
        factura_id = factura_map.get(factura_csv_id) if factura_csv_id else None
        cliente_id = cliente_map.get(int(r["cliente_id"])) if not pd.isna(r["cliente_id"]) else None
        conciliado = str(r.get("estado_conciliacion")).upper() == "CONCILIADO"
        fecha_pago = parse_date_flexible(r["fecha_pago"])
        monto = Decimal(str(r["monto_pagado"]))

        if conciliado and (cliente_id is None or factura_id is None):
            continue

        if conciliado:
            pago_id = to_uuid()
            pago_rows.append({
                "id": pago_id, "cliente_id": cliente_id, "cuenta_id": cuenta_map.get(int(r["cuenta_id"])) if not pd.isna(r.get("cuenta_id")) else None,
                "factura_id": factura_id, "fecha_pago": fecha_pago, "monto": monto,
                "identificado": True, "fuente": "CSV",
            })
            aplic_rows.append({"id": to_uuid(), "pago_id": pago_id, "factura_id": factura_id, "monto_aplicado": monto})
        else:
            # Pago aun no identificado con certeza: se representa como movimiento
            # bancario demo pendiente, para ejercer el flujo real de conciliacion.
            #
            # La descripcion bancaria debe parecerse a una transferencia real:
            # una transferencia corporativa suele traer alguna referencia (numero
            # de factura y/o razon social) en el campo libre del banco, aunque no
            # siempre — por eso variamos el detalle en vez de dejar el mismo texto
            # generico fijo en el 100% de los movimientos, lo que hacia imposible
            # que el motor de matching (conciliacion.calcular_score) encontrara una
            # coincidencia en ningun caso, sin importar que tan bien calzaran monto
            # y fecha (ver seccion "referencia_factura"/"cliente_compatible").
            banco = BANCOS[hash((int(r["pago_id"]))) % len(BANCOS)]
            numero_factura = factura_numero_map.get(factura_csv_id) if factura_csv_id else None
            razon_social = cliente_razon_map.get(int(r["cliente_id"]))
            variante = random.random()
            if numero_factura and variante < 0.55:
                descripcion = f"TRANSF PAGO FACT {numero_factura}"
            elif razon_social and variante < 0.80:
                descripcion = f"TRANSF {razon_social}"
            else:
                descripcion = "TRANSF VARIOS"
            movimientos_rows.append({
                "id": to_uuid(), "fecha_movimiento": datetime.combine(fecha_pago, datetime.min.time(), tzinfo=timezone.utc),
                "banco": banco, "nro_operacion": f"OP-{800000 + int(r['pago_id'])}",
                "descripcion": descripcion, "monto": monto, "tipo_movimiento": "ABONO",
                "estado": "PENDIENTE", "fuente": "DEMO",
            })

    for i in range(0, len(pago_rows), 1000):
        db.bulk_insert_mappings(PagoB2B, pago_rows[i:i + 1000])
    db.commit()
    for i in range(0, len(aplic_rows), 1000):
        db.bulk_insert_mappings(AplicacionPago, aplic_rows[i:i + 1000])
    db.commit()
    if movimientos_rows:
        db.bulk_insert_mappings(MovimientoBancarioDemo, movimientos_rows)
        db.commit()
    print(f"pagos_b2b (conciliados historicos): {len(pago_rows)}, aplicaciones_pago: {len(aplic_rows)}, "
          f"movimientos_bancarios_demo (pendientes reales de conciliar): {len(movimientos_rows)}")

    # ---- 7. ml_predictions (snapshot desde el CSV oficial de predicciones) ----
    # Un cliente con 0 facturas/0 pagos no tiene historial real: el modelo
    # extrapola sobre un input en blanco y da una probabilidad sin sentido de
    # negocio (ver DATA_MODEL.md). Para esos casos no se guarda prediccion:
    # queda como NO_DISPONIBLE a nivel de API en vez de mostrar "riesgo ALTO"
    # contradictorio con saldo/dias vencidos en 0.
    ml_rows = []
    sin_historial = 0
    for _, r in predicciones_df.iterrows():
        cliente_id = cliente_map.get(int(r["cliente_id"]))
        if cliente_id is None:
            continue
        if float(r["cantidad_facturas"]) == 0:
            sin_historial += 1
            continue
        ml_rows.append({
            "id": to_uuid(), "cliente_id": cliente_id, "modelo_nombre": "modelo_riesgo_cliente_traza",
            "probabilidad_pago": round(float(r["probabilidad_pago"]), 5), "nivel_riesgo": r["nivel_riesgo"],
            "features": {
                "monto_total_facturado": float(r["monto_total_facturado"]),
                "cantidad_facturas": float(r["cantidad_facturas"]),
                "cantidad_pagos": float(r["cantidad_pagos"]),
                "ratio_pago_historico": float(r["ratio_pago_historico"]),
                "dias_mora_promedio": float(r["dias_mora_promedio"]),
                "dias_mora_maximo": float(r["dias_mora_maximo"]),
            },
        })
    for i in range(0, len(ml_rows), 1000):
        db.bulk_insert_mappings(MLPrediction, ml_rows[i:i + 1000])
    db.commit()
    print(f"ml_predictions (snapshot inicial): {len(ml_rows)} (sin historial, omitidos: {sin_historial})")

    # ---- 8. Emails de cobranza (demo explicita, Outlook no conectado a buzon real) ----
    clientes_con_saldo = (
        db.query(FacturaB2B.cliente_id, FacturaB2B.id, FacturaB2B.numero, FacturaB2B.monto)
        .filter(FacturaB2B.estado == "EMITIDO")
        .order_by(FacturaB2B.monto.desc())
        .limit(12)
        .all()
    )
    demo_correos = [
        ("Confirmo transferencia realizada el dia de hoy", "Estimado equipo, confirmo que realice la transferencia correspondiente a la factura {numero} por S/ {monto}. Adjunto el voucher.", ["voucher_pago.pdf"]),
        ("Solicito plazo adicional para el pago", "Buenas tardes, debido a un inconveniente de flujo de caja, solicito una extension de plazo para el pago de la factura {numero}. Me comprometo a regularizar antes de fin de mes.", []),
        ("Posible cobro duplicado en factura", "He identificado un posible cobro duplicado en la factura {numero}, el monto no coincide con lo pactado.", []),
        ("Consulta sobre el monto de la factura", "Hola, tengo una duda sobre el monto facturado en {numero}, podrian confirmar el desglose de los cargos aplicados?", []),
    ]
    email_rows = []
    for i, (cliente_id, factura_id, numero, monto) in enumerate(clientes_con_saldo):
        asunto, cuerpo_tpl, adjuntos = demo_correos[i % len(demo_correos)]
        email_rows.append({
            "id": to_uuid(), "outlook_message_id": f"demo-msg-{i+1:03d}",
            "cliente_id": cliente_id, "factura_id": factura_id,
            "remitente": "contacto@cliente-demo.pe", "destinatarios": ["cobranzas@traza.pe"],
            "asunto": asunto, "cuerpo": cuerpo_tpl.format(numero=numero, monto=monto),
            "recibido_at": datetime.now(timezone.utc) - timedelta(hours=i * 6),
            "adjuntos": [{"nombre": a} for a in adjuntos], "procesado": False,
        })
    db.bulk_insert_mappings(EmailCobranza, email_rows)
    db.commit()
    print(f"emails_cobranza (demo): {len(email_rows)}")

    # ---- 9. Ejecutar el motor real sobre las facturas en pipeline ----
    facturas_pipeline = db.query(FacturaB2B).filter(FacturaB2B.estado == "GENERADO").all()
    for f in facturas_pipeline:
        facturacion_svc.validar_factura(db, f, f.cliente)
        if f.requiere_conformidad:
            facturacion_svc.crear_solicitud_conformidad(db, f)
        else:
            f.estado = "LISTO_EMISION" if not db.query(CasoFacturacion).filter(CasoFacturacion.factura_id == f.id, CasoFacturacion.estado == "ABIERTO").first() else "VALIDANDO"
    db.commit()
    print(f"Motor de validaciones ejecutado sobre {len(facturas_pipeline)} facturas en pipeline.")

    detectados = facturacion_svc.detectar_servicio_no_facturado(db)
    db.commit()
    print(f"Casos SERVICIO_ACTIVO_SIN_FACTURACION detectados: {detectados}")

    audit_log(db, actor_tipo="SYSTEM", accion="SEED_INICIAL", metadata={
        "clientes": len(clientes_rows), "facturas": len(facturas_rows), "pagos": len(pago_rows),
    })
    db.commit()
    db.close()
    print("Seed completado.")


if __name__ == "__main__":
    main()
