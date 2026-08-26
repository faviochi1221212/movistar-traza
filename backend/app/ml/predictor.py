"""Wrapper del modelo de riesgo de pago (Pipeline StandardScaler + LogisticRegression).

No se cambia target, features, pipeline ni entrenamiento (seccion 23 del prompt maestro).
Features y orden confirmados desde features_riesgo_cliente_traza.pkl:
  log_monto_facturado, cantidad_facturas, cantidad_pagos,
  ratio_pago_historico, dias_mora_promedio, dias_mora_maximo
"""
import logging
import math
from functools import lru_cache
from pathlib import Path

import joblib

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# backend/app/ml/predictor.py -> parents[2] == backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _resolve_path(raw_path: str) -> str:
    """Las rutas relativas del .env se resuelven contra backend/, sin
    importar desde que carpeta se haya lanzado el proceso (Render arranca
    uvicorn con distintos working directories segun el buildpack)."""
    path = Path(raw_path)
    return str(path if path.is_absolute() else BACKEND_ROOT / path)


class PaymentRiskPredictor:
    def __init__(self, model_path: str, features_path: str):
        self.model = joblib.load(model_path)
        self.feature_order: list[str] = joblib.load(features_path)

    def build_features(self, stats: dict) -> dict:
        """stats: monto_total_facturado, cantidad_facturas, cantidad_pagos,
        ratio_pago_historico, dias_mora_promedio, dias_mora_maximo"""
        return {
            "log_monto_facturado": math.log1p(float(stats.get("monto_total_facturado") or 0)),
            "cantidad_facturas": float(stats.get("cantidad_facturas") or 0),
            "cantidad_pagos": float(stats.get("cantidad_pagos") or 0),
            "ratio_pago_historico": float(stats.get("ratio_pago_historico") or 0),
            "dias_mora_promedio": float(stats.get("dias_mora_promedio") or 0),
            "dias_mora_maximo": float(stats.get("dias_mora_maximo") or 0),
        }

    def predict_proba(self, stats: dict) -> float | None:
        try:
            feats = self.build_features(stats)
            row = [[feats[name] for name in self.feature_order]]
            proba = self.model.predict_proba(row)[0]
            classes = list(self.model.named_steps["logistic"].classes_) if hasattr(self.model, "named_steps") else [0, 1]
            idx_pago = classes.index(1) if 1 in classes else len(classes) - 1
            return float(proba[idx_pago])
        except Exception:
            logger.exception("ML predict_proba fallo; features insuficientes o modelo incompatible")
            return None


@lru_cache
def get_predictor() -> PaymentRiskPredictor | None:
    settings = get_settings()
    if not settings.ml_model_path or not settings.ml_features_path:
        return None
    model_path = _resolve_path(settings.ml_model_path)
    features_path = _resolve_path(settings.ml_features_path)
    try:
        return PaymentRiskPredictor(model_path, features_path)
    except Exception:
        logger.exception("No se pudo cargar el modelo ML en %s", model_path)
        return None


def nivel_riesgo(probabilidad: float, riesgo_bajo_min: float, riesgo_medio_min: float) -> str:
    if probabilidad >= riesgo_bajo_min:
        return "BAJO"
    if probabilidad >= riesgo_medio_min:
        return "MEDIO"
    return "ALTO"
