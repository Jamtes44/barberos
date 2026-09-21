# BarberOS · Backend (Node/Express + PostgreSQL)

API REST en Node.js + Express + TypeScript, con **PostgreSQL** (Supabase) y **JWT**.

## Estructura

```
server/
  src/
    index.ts            # Arranque Express (API + sirve dist/ del frontend)
    config.ts           # Variables de entorno
    db.ts               # Pool pg + helpers + summary de caja
    schema.sql          # Esquema PostgreSQL (idempotente, se aplica solo)
    middleware/auth.ts  # requireAuth / requireOwner / signToken
    routes/             # auth, shops, services, barbers, clients, appointments, sales, reports
    util.ts             # asyncHandler, AppError, validaciones
```

El API vive bajo `/api`. En producción (`npm start`) Express además sirve el
frontend compilado de `dist/`, así que **Render publica un solo servicio**.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Crea dueño + barbería (email, password, fullName, shopName...) |
| POST | `/api/auth/login` | Devuelve `{token, user}` (rol owner/barber) |
| GET | `/api/auth/me` | Usuario + barbería actuales |
| GET/PUT | `/api/shop` | Ver / actualizar datos de la barbería |
| CRUD | `/api/services` | Servicios y precios (rate de comisión %) |
| CRUD | `/api/barbers` | Barberos; con `email`+`password` crea su login |
| CRUD | `/api/clients` | Clientes + historial (`GET /:id`) |
| GET/POST/PATCH | `/api/appointments` | Agenda: filtros `from`,`to`,`barberId`,`status` |
| CRUD | `/api/sales` | Caja; `GET /summary?date=`, `POST` cobro con items |
| GET | `/api/reports/kpis?date=` | KPIs del día (dashboard) |
| GET | `/api/reports/commissions?from=&to=` | Comisiones por barbero y por día |
| GET | `/api/reports/period?from=&to=` | Ventas por día/método/servicios/barberos |
| GET | `/api/health` | Estado del server + conexión a BD |

Todo (salvo register/login/health) requiere header `Authorization: Bearer <token>`.

### Regla de comisiones usada en `POST /api/sales`
Cada item: `comisión = (precio × cantidad) × rate%` (rate del servicio).
`barber_earnings = comisiones + propina`. `casa = total - barber_earnings`.

## Configuración local

1. `npm install` (ya hecho)
2. Tomar `server/../.env.example` y crear `.env` en la raíz con la conexión Postgres:
   ```
   DATABASE_URL="postgresql://..."
   JWT_SECRET="secreto-largo-aleatorio"
   ```
3. `npm run dev` → web en `http://localhost:3000` y API en `http://localhost:4000`
   (Vite ya tiene proxy: `/api` → `localhost:4000`).

Las tablas se crean solas al arrancar (`schema.sql` es idempotente). También
puedes ejecutarlo manualmente en el editor SQL de Supabase.

## 1. Base de datos: Supabase (Postgres gratis, sin caducidad)

1. Crear proyecto en https://supabase.com (gratis, ~500 MB, se pausa solo tras 7 días sin uso).
2. En **Project Settings → Database → Connection string → URI**: copia la URL `postgresql://postgres:[PASSWORD]@db.[host].supabase.co:5432/postgres`.
3. Sustituye `[PASSWORD]` por la contraseña de tu base (Settings → Database → Reset database password si no la recuerdas).
4. Pégala en `.env` (`DATABASE_URL=...`) — o créala en el panel de Render (paso siguiente).

Las extensiones/tablas no requieren permisos extra: el usuario `postgres` de Supabase
tiene `SUPERUSER`, así que el `CREATE TABLE IF NOT EXISTS` del arranque funciona.

## 2. Despliegue: Render (Web Service, free tier)

1. Sube el repo a GitHub (actualmente no es un repo git: `git init` en la raíz).
2. Opción A (rápida): Render → **New → Blueprint** y conecta el repo.
   Ya está `render.yaml` en la raíz: build `npm run build`, start `npm start`,
   healthcheck `/api/health` y `NODE_ENV=production`. Solo te pedirá los valores
   de `DATABASE_URL` y `JWT_SECRET`.
   Opción B (manual): **New → Web Service → Connect repo**.
   - Build command: `npm run build`
   - Start command: `npm start`
   - (Root Directory = raíz del repo.)
3. En **Environment** añade:
   - `DATABASE_URL` = la URL del pooler de Supabase (region-style `pooler.supabase.com`)
   - `JWT_SECRET` = valor largo aleatorio
   - `NODE_ENV` = `production`
4. Deploy. El healthcheck: `GET /api/health`.

> Ojo con Supabase: usa la conexión **Pooler** (`aws-0-xxx.pooler.supabase.com`),
> no el host directo (`db.xxxx.supabase.co`), porque el host directo solo expone
> IPv6 y Render lo enrutará mal.

Notas del free tier de Render: 512 MB RAM, duerme a los 15 min sin tráfico y la
primera petición tarda ~1 min en despertar. Es aceptable al inicio.

## Curiosidades del repo
- `express`, `dotenv`, `@google/genai`, `tsx`, `pg` ya estaban en `package.json`
  (el template de AI Studio los dejó sin usar). Ahora se usan de verdad.
- `metadata.json` declara `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`; si quieres
  el chatbot con Gemini, se añade más adelante (la var `GEMINI_API_KEY` ya pasa al server).