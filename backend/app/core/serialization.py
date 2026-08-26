import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeBase


def to_jsonable(value):
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, DeclarativeBase):
        return model_to_dict(value)
    return value


def model_to_dict(obj) -> dict:
    result = {}
    for attr in inspect(obj).mapper.column_attrs:
        col_name = attr.columns[0].name
        result[col_name] = to_jsonable(getattr(obj, attr.key))
    return result
