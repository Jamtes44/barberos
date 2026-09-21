// BarberOS · Cliente API (Express backend en /api, proxy Vite en dev)

const TOKEN_KEY = 'barberos_token';
const USER_KEY = 'barberos_user';
const SHOP_KEY = 'barberos_shop';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'barber';
  shopId: string | null;
  barberId: string | null;
}

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  settings: Record<string, unknown>;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  commission_rate: number;
  duration_minutes: number;
  category: string | null;
  active: boolean;
}

export interface Barber {
  id: string;
  name: string;
  phone: string | null;
  chair: string | null;
  avatar_url: string | null;
  active: boolean;
  commission_scheme: 'percentage' | 'fixed' | 'none';
  commission_value: number | null;
  user_id: string | null;
  user_email: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  is_vip: boolean;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string | null;
  client_name: string;
  phone: string | null;
  start_at: string;
  end_at: string | null;
  status: string;
  payment_status: string | null;
  is_walkin: boolean;
  notes: string | null;
  price: number;
  service_name: string | null;
  barber_id: string | null;
  barber_name: string | null;
}

export interface Sale {
  id: string;
  client_name: string | null;
  total: number;
  barber_earnings: number;
  tip: number;
  payment_method: string;
  status: string;
  created_at: string;
  barber_id: string | null;
  barber_name: string | null;
  items: Array<{ name: string; qty: number; unit_price: number; commission: number }>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- Sesión ----------

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getSessionUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getSessionShop(): Shop | null {
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    return raw ? (JSON.parse(raw) as Shop) : null;
  } catch {
    return null;
  }
}

export function saveSession(_token: string, user: AuthUser, shop?: Shop): void {
  try {
    // El token viaja en una cookie httpOnly (inaccesible desde JS) para evitar
    // robo por XSS. Aquí solo se guardan datos no sensibles de la sesión.
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (shop) localStorage.setItem(SHOP_KEY, JSON.stringify(shop));
  } catch {
    // Ignore (storage lleno / bloqueado)
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SHOP_KEY);
  } catch {
    // Ignore
  }
}

/** Cierra la sesión en el servidor (borra la cookie httpOnly). */
export async function apiLogout(): Promise<void> {
  try {
    await fetch(`/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Si falla la red, igual se limpia la sesión local.
  }
  clearSession();
}

// ---------- Request ----------

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Respuesta sin JSON (p.ej. estático)
  }

  if (!res.ok) {
    const message = (body as { error?: string })?.error || res.statusText;
    if (res.status === 401) clearSession();
    throw new ApiError(res.status, message);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data !== undefined ? JSON.stringify(data) : undefined,
});

// ---------- Auth ----------

export async function apiLogin(email: string, password: string) {
  const res = await request<{ token: string; user: AuthUser }>('/auth/login', json('POST', { email, password }));
  saveSession(res.token, res.user);
  return res;
}

export async function apiRegister(payload: {
  email: string;
  password: string;
  fullName: string;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
}) {
  const res = await request<{ token: string; user: AuthUser; shopId: string }>(
    '/auth/register',
    json('POST', payload),
  );
  const shop = await request<Shop>('/shop', { headers: { Authorization: `Bearer ${res.token}` } });
  saveSession(res.token, res.user, shop);
  return res;
}

export async function apiMe() {
  const res = await request<{ user: AuthUser; shop: Shop | null }>('/auth/me');
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    if (res.shop) {
      localStorage.setItem(SHOP_KEY, JSON.stringify(res.shop));
    }
  } catch {
    // Ignore
  }
  return res;
}

// ---------- Shop ----------

export const apiShop = {
  get: () => request<Shop>('/shop'),
  update: (data: Partial<Pick<Shop, 'name' | 'address' | 'phone' | 'settings'>>) =>
    request<Shop>('/shop', json('PUT', data)),
};

// ---------- Services ----------

export const apiServices = {
  list: () => request<Service[]>('/services'),
  create: (data: Partial<Service>) => request<Service>('/services', json('POST', data)),
  update: (id: string, data: Partial<Service>) => request<Service>(`/services/${id}`, json('PUT', data)),
  remove: (id: string) => request<{ ok: boolean }>(`/services/${id}`, json('DELETE')),
};

// ---------- Barbers ----------

export const apiBarbers = {
  list: () => request<Barber[]>('/barbers'),
  create: (data: {
    name: string;
    phone?: string;
    chair?: string;
    email?: string;
    password?: string;
    avatar_url?: string;
    linkToUser?: boolean;
    commissionScheme?: 'percentage' | 'fixed' | 'none';
    commissionValue?: number;
  }) => request<Barber & { hasLogin?: boolean; isAdmin?: boolean }>('/barbers', json('POST', data)),
  update: (id: string, data: Partial<Barber>) => request<Barber>(`/barbers/${id}`, json('PUT', data)),
  remove: (id: string) => request<{ ok: boolean }>(`/barbers/${id}`, json('DELETE')),
};

// ---------- Clients ----------

export const apiClients = {
  list: (q = '') => request<Client[]>(`/clients?q=${encodeURIComponent(q)}`),
  get: (id: string) =>
    request<Client & { history: Appointment[]; purchases: Sale[] }>(`/clients/${id}`),
  create: (data: { name: string; phone?: string; is_vip?: boolean; notes?: string }) =>
    request<Client>('/clients', json('POST', data)),
  update: (id: string, data: Partial<Client>) => request<Client>(`/clients/${id}`, json('PUT', data)),
};

// ---------- Appointments ----------

export const apiAppointments = {
  list: (params: { from?: string; to?: string; barberId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.barberId) qs.set('barberId', params.barberId);
    if (params.status) qs.set('status', params.status);
    const q = qs.toString();
    return request<Appointment[]>(`/appointments${q ? `?${q}` : ''}`);
  },
  create: (data: {
    clientName: string;
    phone?: string;
    startAt: string;
    barberId?: string;
    serviceId?: string;
    serviceName?: string;
    price?: number;
    isWalkin?: boolean;
    notes?: string;
  }) => request<Appointment>('/appointments', json('POST', data)),
  patch: (id: string, data: { status?: string; paymentStatus?: string; barberId?: string; price?: number; startAt?: string }) =>
    request<Appointment>(`/appointments/${id}`, json('PATCH', data)),
  remove: (id: string) => request<{ ok: boolean }>(`/appointments/${id}`, json('DELETE')),
};

// ---------- Sales ----------

export const apiSales = {
  list: (params: { from?: string; to?: string; barberId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.barberId) qs.set('barberId', params.barberId);
    const q = qs.toString();
    return request<Sale[]>(`/sales${q ? `?${q}` : ''}`);
  },
  summary: (date: string) =>
    request<{ date: string; byMethod: Array<{ payment_method: string; count: number; total: number; tips: number }>; total: number }>(
      `/sales/summary?date=${encodeURIComponent(date)}`,
    ),
  create: (data: {
    barberId?: string;
    clientId?: string;
    clientName?: string;
    appointmentId?: string;
    items: Array<{ serviceId?: string; name?: string; qty: number; price?: number }>;
    paymentMethod: string;
    tip?: number;
    cashReceived?: number;
  }) => request<{ id: string; total: number; barberEarnings: number; tip: number; changeAmount: number }>(
    '/sales',
    json('POST', data),
  ),
  get: (id: string) => request<Sale>(`/sales/${id}`),
};

// ---------- Reports ----------

export interface Kpis {
  date: string;
  revenue: number;
  barberEarnings: number;
  houseEarnings: number;
  salesCount: number;
  avgTicket: number;
  appointments: Record<string, number>;
  totalAppointments: number;
  vipClients: number;
}

export const apiReports = {
  kpis: (date: string) => request<Kpis>(`/reports/kpis?date=${encodeURIComponent(date)}`),
  commissions: (from: string, to: string) =>
    request<{
      from: string;
      to: string;
      totalEarnings: number;
      totalRevenue: number;
      byBarber: Array<{ id: string; name: string; sales_count: number; revenue: number; earnings: number; tips: number }>;
      byDay: Array<{ day: string; earnings: number; revenue: number }>;
    }>(`/reports/commissions?from=${from}&to=${to}`),
  period: (from: string, to: string) =>
    request<{
      from: string;
      to: string;
      byDay: Array<{ day: string; sales_count: number; total: number }>;
      byMethod: Array<{ payment_method: string; count: number; total: number }>;
      topServices: Array<{ service_name: string; count: number; total: number }>;
      topBarbers: Array<{ name: string; sales_count: number; total: number }>;
    }>(`/reports/period?from=${from}&to=${to}`),
};

export const api = {
  login: apiLogin,
  register: apiRegister,
  me: apiMe,
  logout: apiLogout,
  token: getToken,
  user: getSessionUser,
  shop: getSessionShop,
  clear: clearSession,
};