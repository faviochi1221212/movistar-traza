# TRAZA — Orquestación inteligente del ciclo del ingreso

MVP para el **AI Telecom Challenge 2026 · Desafío 03 SON-IA**. Conecta Facturación, Cobranzas, Recaudo y BI de una operación B2B de telecomunicaciones en un solo ciclo orquestado, con agentes que interpretan lenguaje (Dify), un backend determinístico (FastAPI) que decide, Supabase/PostgreSQL que recuerda, y React que permite operar.

> **TRAZA automatiza lo inequívoco y organiza las excepciones.**

## Stack

- **Frontend**: React + TypeScript + Vite (`react-export/`)
- **Backend**: FastAPI + SQLAlchemy (`backend/`)
- **Base de datos**: Supabase / PostgreSQL (schema en `../TRAZA_FINAL_SCHEMA.sql`, fuera de este repo)
- **IA semántica**: Dify Cloud (clasificador de correos + asistente conversacional)
- **Machine Learning**: scikit-learn (Pipeline StandardScaler + LogisticRegression), cargado con `joblib`

## Arranque rápido

### 1. Backend

```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env   # y completa DATABASE_URL, SUPABASE_*, DIFY_*
python scripts/seed.py   # carga los CSV oficiales y ejecuta el motor de reglas una vez
uvicorn app.main:app --reload --port 8000
```

`GET http://localhost:8000/` debe devolver `{"status":"ok", "database_conectada": true, ...}`.

> Nota de este entorno de desarrollo: `--reload` de Uvicorn con WatchFiles no siempre recargó el worker de forma confiable en Windows durante el desarrollo (algunos cambios de código no se aplicaban hasta reiniciar el proceso manualmente). Si algo no refleja un cambio reciente, reinicia uvicorn sin `--reload`.

### 2. Frontend

```bash
cd react-export
npm install
copy .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev
```

### 3. Tests mínimos

```bash
cd backend
pytest tests/ -v
```

## Estructura

```text
react-export/     Frontend React (fuente de verdad visual: TRAZA UI mockups)
backend/           FastAPI: api/, services/, models/, integrations/, ml/, core/, scripts/, tests/
```

Ver `ARCHITECTURE.md`, `DATA_MODEL.md`, `AGENTS.md`, `API.md` para el detalle técnico, `SECURITY.md` para la higiene mínima aplicada y `DEMO_GUIDE.md` para el recorrido de la demo.

## Bloqueos externos conocidos (no dependen de este código)

- **Dify**: las dos apps de Dify Cloud del proyecto (clasificador y asistente) devuelven intermitentemente `400 "Model is not configured"` — es una configuración pendiente del lado del panel de Dify Cloud (seleccionar el modelo LLM en cada app), no un bug del backend. El backend ya maneja este caso: si Dify falla, el correo queda `procesado=false` (pendiente de revisión manual) y el asistente cae a una respuesta generada localmente con datos reales, en vez de romper la demo.
- **Outlook**: no hay credenciales `MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET/MS_MAILBOX` reales disponibles. La integración con Microsoft Graph está implementada (`app/integrations/outlook.py`) pero inactiva; `/api/outlook/sync` lo reporta explícitamente en vez de fallar.
