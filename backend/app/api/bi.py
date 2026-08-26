from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import to_jsonable
from app.services import bi

router = APIRouter(prefix="/api/bi", tags=["bi"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    return to_jsonable(bi.resumen_general(db))


@router.get("/riesgo")
def riesgo(limit: int = 20, nivel_riesgo: str | None = None, db: Session = Depends(get_db)):
    return {
        "resumen": bi.riesgo_resumen(db),
        "top_clientes": [to_jsonable(dict(r)) for r in bi.top_riesgo(db, limit=limit, nivel_riesgo=nivel_riesgo)],
    }


@router.post("/riesgo/recalcular")
def recalcular(limit: int | None = None, db: Session = Depends(get_db)):
    creados = bi.recalcular_riesgo(db, limit=limit)
    db.commit()
    return {"predicciones_generadas": creados}


@router.get("/recupero")
def recupero(limit: int = 30, prioridad: str | None = None, db: Session = Depends(get_db)):
    return [to_jsonable(o) for o in bi.oportunidades_recupero(db, limit=limit, prioridad=prioridad)]
