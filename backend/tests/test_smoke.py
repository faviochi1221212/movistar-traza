"""Smoke tests minimos (seccion 33 del prompt maestro): lo suficiente para
confiar en que la demo no se cae, no una suite exhaustiva."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.ml.predictor import get_predictor
from app.services.rules import get_regla

client = TestClient(app)


def test_root_responde_y_supabase_conecta():
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database_conectada"] is True


def test_dify_configurado():
    body = client.get("/").json()
    assert body["dify_configurado"] is True


def test_facturacion_resumen_lee_datos_reales():
    r = client.get("/api/facturacion/resumen")
    assert r.status_code == 200
    body = r.json()
    assert body["emision"]["emitidas"] >= 0


def test_cobranzas_cartera_usa_vista_saldo():
    r = client.get("/api/cobranzas/cartera?limit=5")
    assert r.status_code == 200
    rows = r.json()
    if rows:
        assert "saldo_pendiente" in rows[0]
        assert "aging" in rows[0]


def test_recaudo_movimientos_lista():
    r = client.get("/api/recaudo/movimientos?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_reglas_configurables_no_hardcodeadas():
    db = SessionLocal()
    try:
        valor = get_regla(db, "MATCH_AUTOMATICO_SCORE_MIN")
        assert valor == 0.95
    finally:
        db.close()


def test_ml_predict_proba_carga_y_predice():
    predictor = get_predictor()
    assert predictor is not None, "El modelo .pkl no cargo; revisar ML_MODEL_PATH en .env"
    proba = predictor.predict_proba({
        "monto_total_facturado": 500.0, "cantidad_facturas": 10, "cantidad_pagos": 10,
        "ratio_pago_historico": 1.0, "dias_mora_promedio": 52, "dias_mora_maximo": 67,
    })
    assert proba is not None
    assert 0.0 <= proba <= 1.0


def test_bi_resumen_agrega_facturacion_cobranzas_recaudo():
    r = client.get("/api/bi/resumen")
    assert r.status_code == 200
    body = r.json()
    assert "facturacion" in body and "cobranzas" in body and "recaudo" in body


def test_auditoria_resumen():
    r = client.get("/api/auditoria/resumen")
    assert r.status_code == 200
    assert "eventos_registrados" in r.json()
