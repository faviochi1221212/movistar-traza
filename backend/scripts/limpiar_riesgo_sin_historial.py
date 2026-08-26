"""Elimina predicciones de riesgo de clientes sin ninguna factura registrada.

Estas filas quedaron cargadas por el snapshot inicial de predicciones_riesgo.csv
antes de que el seed excluyera este caso (ver seccion 7 de scripts/seed.py y
DATA_MODEL.md). No son necesarias para que el fix funcione (los endpoints de
BI ya las filtran por consulta), pero conviene dejar la tabla consistente.

Uso:
    python scripts/limpiar_riesgo_sin_historial.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.core.database import SessionLocal

db = SessionLocal()
result = db.execute(text("""
    DELETE FROM public.ml_predictions p
    WHERE NOT EXISTS (SELECT 1 FROM public.facturas_b2b f WHERE f.cliente_id = p.cliente_id)
"""))
db.commit()
print(f"Predicciones eliminadas (clientes sin historial): {result.rowcount}")
db.close()
