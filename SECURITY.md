# SECURITY

Higiene mínima de un prototipo de hackathon (sección 32 del Prompt Maestro). No es una postura de seguridad productiva.

## Aplicado

- Secretos (Supabase, Dify) solo en `backend/.env`, nunca en el frontend ni en commits (`backend/.env` está en `.gitignore`).
- `backend/.env.example` sin valores reales.
- CORS restringido a `FRONTEND_URL` / `localhost:5173`.
- Todo input de request pasa por modelos Pydantic.
- No se ejecuta SQL construido a partir de input del usuario ni del LLM ("Preguntar a TRAZA" usa un catálogo fijo de funciones, nunca SQL libre).
- Errores devueltos al frontend son mensajes cortos (`HTTPException`), no stack traces completos.
- Sin `print`/log de claves.

## Explícitamente fuera de alcance (por diseño del MVP)

- Autenticación, autorización, RBAC, JWT, OAuth de usuarios.
- MFA, rate limiting avanzado, CSRF avanzado.
- Cualquier usuario puede acceder a todas las pantallas.

## Nota sobre las credenciales del `.env`

El `backend/.env` de este entorno de desarrollo reutiliza credenciales reales (Supabase, Dify) que ya existían en otra carpeta del mismo equipo (`movistar traza/`), provistas previamente por el usuario para este mismo proyecto. Antes de compartir este repositorio o desplegarlo, rota esas credenciales si se sospecha exposición.
