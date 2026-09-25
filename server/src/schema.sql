-- BarberOS · Esquema PostgreSQL (compatible Supabase)
-- Idempotente: CREATE TABLE IF NOT EXISTS. Se puede ejecutar en cada arranque.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ Barberías ============
CREATE TABLE IF NOT EXISTS shops (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  address       text,
  phone         text,
  owner_id      uuid,
  settings      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============ Usuarios ============
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  role          text NOT NULL CHECK (role IN ('owner', 'barber')),
  shop_id       uuid REFERENCES shops(id) ON DELETE CASCADE,
  barber_id     uuid,
  token_version integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============ Membresía (plan de las barberías) ============
-- Ciclo: prueba gratis 7 días -> a partir del día 3 recordatorios diarios ->
-- en el día 7 se verifica el pago: pagó -> 'active' 30 días más; si no -> 'blocked'.
-- estados: trial | active | blocked
ALTER TABLE shops ADD COLUMN IF NOT EXISTS membership_status      text NOT NULL DEFAULT 'trial';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS trial_started_at       timestamptz;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS trial_ends_at          timestamptz;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS membership_activated_at timestamptz;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS membership_expires_at  timestamptz;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_id                text;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_name              text;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_price             numeric NOT NULL DEFAULT 35900;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_payment_at        timestamptz;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_reminder_at       timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_membership_status_check') THEN
    ALTER TABLE shops ADD CONSTRAINT shops_membership_status_check
      CHECK (membership_status IN ('trial', 'active', 'blocked'));
  END IF;
END $$;

-- Dueños registrados antes de las membresías: se les da la prueba de 7 días
-- vigente desde su primer arranque con este código (backfill idempotente).
UPDATE shops SET
  trial_started_at = COALESCE(trial_started_at, now()),
  trial_ends_at    = COALESCE(trial_ends_at, now() + make_interval(days => 7))
WHERE trial_started_at IS NULL AND membership_status = 'trial';

CREATE INDEX IF NOT EXISTS idx_shops_membership_status ON shops(membership_status);
CREATE INDEX IF NOT EXISTS idx_shops_membership_expires ON shops(membership_expires_at);

-- Bitácora de recordatorios de membresía (evita duplicados y sirve de auditoría)
CREATE TABLE IF NOT EXISTS membership_reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  shop_name   text,
  owner_phone text,
  owner_email text,
  type        text NOT NULL DEFAULT 'trial_reminder',
  sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_reminders_shop ON membership_reminders(shop_id, sent_at);

-- ============ Barberos ============
CREATE TABLE IF NOT EXISTS barbers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id     uuid,
  name        text NOT NULL,
  phone       text,
  chair       text,
  avatar_url  text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Esquema de comisión por barbero:
--   percentage -> commission_value = % del total de la venta (NULL = tarifas de servicio, legado)
--   fixed      -> commission_value = COP fijos por cada venta
--   none       -> el barbero no gana comisión
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS commission_scheme text NOT NULL DEFAULT 'percentage';
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS commission_value numeric;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barbers_commission_scheme_check') THEN
    ALTER TABLE barbers ADD CONSTRAINT barbers_commission_scheme_check
      CHECK (commission_scheme IN ('percentage', 'fixed', 'none'));
  END IF;
END $$;

-- ============ Servicios ============
CREATE TABLE IF NOT EXISTS services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name             text NOT NULL,
  price            numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate  numeric(5,2) NOT NULL DEFAULT 45, -- % para el barbero
  duration_minutes int NOT NULL DEFAULT 45,
  category         text,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============ Clientes ============
CREATE TABLE IF NOT EXISTS clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       text NOT NULL,
  phone      text,
  is_vip     boolean NOT NULL DEFAULT false,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Citas / Agenda ============
CREATE TABLE IF NOT EXISTS appointments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name    text NOT NULL,
  phone          text,
  barber_id      uuid REFERENCES barbers(id) ON DELETE SET NULL,
  service_id     uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name   text,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz,
  price          numeric(12,2) DEFAULT 0,
  status         text NOT NULL DEFAULT 'pendiente'
                 CHECK (status IN ('pendiente', 'confirmada', 'en_corte', 'finalizado', 'cancelado', 'no_show')),
  payment_status text,
  is_walkin      boolean NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============ Ventas ============
CREATE TABLE IF NOT EXISTS sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name     text,
  barber_id       uuid REFERENCES barbers(id) ON DELETE SET NULL,
  appointment_id  uuid REFERENCES appointments(id) ON DELETE SET NULL,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  barber_earnings numeric(12,2) NOT NULL DEFAULT 0,
  tip             numeric(12,2) NOT NULL DEFAULT 0,
  payment_method  text NOT NULL DEFAULT 'efectivo'
                  CHECK (payment_method IN ('efectivo', 'nequi', 'tarjeta', 'caja_central')),
  cash_received   numeric(12,2),
  change_amount   numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'completada'
                  CHECK (status IN ('completada', 'pendiente', 'anulada')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============ Items de venta ============
CREATE TABLE IF NOT EXISTS sale_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  service_id    uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name  text NOT NULL,
  quantity      int NOT NULL DEFAULT 1,
  unit_price    numeric(12,2) NOT NULL DEFAULT 0,
  commission    numeric(12,2) NOT NULL DEFAULT 0
);

-- ============ Índices ============
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_shop         ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_shop       ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_services_shop      ON services(shop_id);
CREATE INDEX IF NOT EXISTS idx_clients_shop       ON clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_apt_shop_time      ON appointments(shop_id, start_at);
CREATE INDEX IF NOT EXISTS idx_apt_barber_time    ON appointments(barber_id, start_at);
CREATE INDEX IF NOT EXISTS idx_sales_shop_time    ON sales(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_barber_time  ON sales(barber_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);

-- ============ Trigger: mantener barbers.user_id = users.barber_id ============
-- (Eliminado: el código inserta barber_id explícitamente y este trigger
--  referenciaba 'NEW.user_id' que no existe en la tabla. SOLO limpia el viejo.)
DROP TRIGGER IF EXISTS sync_barber_user ON users;
DROP FUNCTION IF EXISTS sync_barber_user();

-- ============ Row Level Security ============
-- La API de BarberOS accede por SQL directo con el rol dueño (que ignora RLS).
-- Habilitar RLS SIN políticas en todas las tablas públicas bloquea la API REST
-- de Supabase (anon/authenticated) sin romper la app. Idempotente en cada arranque.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;