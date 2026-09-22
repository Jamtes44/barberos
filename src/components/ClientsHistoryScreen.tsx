import React, { useEffect, useMemo, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { apiClients, Appointment, Client, Sale } from '../services/api';

interface ClientsHistoryScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

type ClientDetail = Client & { history: Appointment[]; purchases: Sale[] };

const SELECTED_CLIENT_KEY = 'barberos_selected_client';

const getSelectedClientId = (): string | null => {
  try {
    return sessionStorage.getItem(SELECTED_CLIENT_KEY);
  } catch {
    return null;
  }
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (name.trim().slice(0, 2) || '??').toUpperCase();
};

const fmtFullDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

const money = (n: number): string => `$${Math.round(n).toLocaleString('es-CO')}`;

const paymentLabel = (m: string): string =>
  m === 'efectivo' ? 'Efectivo' : m === 'nequi' ? 'Nequi' : m === 'tarjeta' ? 'Llave Bre-B' : m || '—';

const statusLabel = (s: string | null | undefined): string =>
  s === 'completado'
    ? 'Completado'
    : s === 'cancelado'
      ? 'Cancelado'
      : s === 'pendiente'
        ? 'Pendiente'
        : s || '—';

const statusColor = (s: string | null | undefined): string =>
  s === 'cancelado' ? 'text-rose-600' : s === 'pendiente' ? 'text-amber-600' : 'text-emerald-600';

export const ClientsHistoryScreen: React.FC<ClientsHistoryScreenProps> = ({ onNavigate, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleBack = onBack || (() => onNavigate('clients_list', 'push_back'));

  useEffect(() => {
    const id = getSelectedClientId();
    if (!id) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    apiClients
      .get(id)
      .then((data) => {
        setClient(data);
        setLoadError(false);
      })
      .catch(() => {
        setClient(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const favBarber = useMemo(() => {
    if (!client) return null;
    const entries = [...client.history, ...client.purchases]
      .filter((x) => x.barber_name)
      .map((x) => x.barber_name as string);
    const counts = new Map<string, number>();
    entries.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
    let best: string | null = null;
    let bestCount = 0;
    counts.forEach((cnt, name) => {
      if (cnt > bestCount) {
        best = name;
        bestCount = cnt;
      }
    });
    return best;
  }, [client]);

  const avgFrequency = useMemo(() => {
    if (!client || client.history.length < 2) return null;
    const times = client.history
      .map((a) => new Date(a.start_at).getTime())
      .sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length / 86400000;
    return Math.round(avg);
  }, [client]);

  const totalInvested = useMemo(
    () =>
      client
        ? client.history.reduce((s, a) => s + Number(a.price || 0), 0) +
          client.purchases.reduce((s, p) => s + Number(p.total || 0), 0)
        : 0,
    [client],
  );

  const visitsCount = client ? client.history.length : 0;

  const filteredAppointments = useMemo(() => {
    if (!client) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return client.history;
    return client.history.filter(
      (a) =>
        (a.service_name || '').toLowerCase().includes(q) ||
        (a.barber_name || '').toLowerCase().includes(q),
    );
  }, [client, searchTerm]);

  const filteredPurchases = useMemo(() => {
    if (!client) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return client.purchases;
    return client.purchases.filter(
      (p) =>
        (p.barber_name || '').toLowerCase().includes(q) ||
        p.items.some((i) => i.name.toLowerCase().includes(q)),
    );
  }, [client, searchTerm]);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Ficha de Clientes"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={handleBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 max-w-4xl mx-auto">
          {/* Back to Client List navigation header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              id="btn-back-to-clients-list"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-label-md font-bold shadow-xs border border-slate-200 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-600">arrow_back</span>
              <span>Volver a Lista de Clientes</span>
            </button>
            <span className="font-label-caps text-[11px] text-slate-400 font-bold uppercase">
              Ficha Técnica del Cliente
            </span>
          </div>

          {/* Search bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-xl pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, teléfono o corte..."
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          {loading ? (
            <div className="py-12 px-4 text-center rounded-2xl bg-white border border-dashed border-slate-200 flex items-center justify-center">
              <span className="font-body-sm text-xs text-slate-400">Cargando historial del cliente...</span>
            </div>
          ) : loadError || !client ? (
            <div className="py-12 px-4 text-center rounded-2xl bg-white border border-dashed border-slate-200 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">person_search</span>
              <span className="font-headline-md text-sm font-bold text-slate-700">
                No se pudo cargar la ficha del cliente
              </span>
              <span className="font-body-sm text-xs text-slate-400">
                Selecciona un cliente desde el directorio para ver su historial.
              </span>
            </div>
          ) : (
            <>
              {/* Client Profile Header Card */}
              <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white font-bold text-xl flex items-center justify-center shadow-sm">
                      {getInitials(client.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h1 className="font-headline-lg-mobile text-xl text-[#0f172a] font-bold">{client.name}</h1>
                        {client.is_vip && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-caps text-[10px] font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="font-body-sm text-xs text-slate-500 block">📱 {client.phone || 'Sin teléfono'}</span>
                      <span className="font-body-sm text-[11px] text-slate-400">Registrado el {fmtFullDate(client.created_at)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => showToast(`Abriendo chat de WhatsApp con ${client.name}`)}
                    className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    title="Escribir por WhatsApp"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                  </button>
                </div>

                {/* Barber Affinity */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-lg">content_cut</span>
                    <span className="font-label-md text-xs text-slate-700">
                      Barbero de Confianza: <strong className="text-slate-900">{favBarber || 'Sin asignar'}</strong>
                    </span>
                  </div>
                  <span className="font-label-caps text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded shadow-xs">
                    {visitsCount} Visitas
                  </span>
                </div>

                {/* Quick Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                  <div>
                    <span className="font-label-md text-[11px] text-slate-400 block">Visitas</span>
                    <span className="font-currency-metric text-lg text-slate-900 font-bold">{visitsCount}</span>
                  </div>
                  <div>
                    <span className="font-label-md text-[11px] text-slate-400 block">Frecuencia</span>
                    <span className="font-currency-metric text-lg text-slate-900 font-bold">
                      {avgFrequency ? `${avgFrequency} días` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-label-md text-[11px] text-slate-400 block">Inversión</span>
                    <span className="font-currency-metric text-lg text-[#8d4b00] font-bold">{money(totalInvested)}</span>
                  </div>
                </div>
              </section>

              {/* Ficha Técnica de Corte (Estilo Preferido) */}
              <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-lg">brush</span>
                    <h2 className="font-headline-md text-base text-[#0f172a] font-bold">Ficha Técnica & Preferencias</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Modo edición de ficha técnica')}
                    className="text-xs font-label-md text-amber-700 font-bold hover:underline cursor-pointer"
                  >
                    Editar
                  </button>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70">
                    <span className="font-label-caps text-[11px] text-amber-900 uppercase font-bold block">
                      Notas de Estilo & Preferencias:
                    </span>
                    <p className="font-body-sm text-xs text-slate-700 mt-0.5">
                      {client.notes || 'Sin notas registradas.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={() => onNavigate('agenda_general', 'push')}
                className="w-full h-14 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-md flex items-center justify-center gap-2 font-headline-md text-lg uppercase tracking-wider font-bold active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">calendar_add_on</span>
                <span>Agendar Próxima Cita {favBarber ? `con ${favBarber.split(' ')[0]}` : ''}</span>
              </button>

              {/* Historic Appointments Timeline */}
              <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
                <h3 className="font-headline-md text-base text-[#0f172a] font-bold">Historial de Visitas Pasadas</h3>
                <div className="flex flex-col divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <div className="py-8 text-center">
                      <span className="font-body-sm text-xs text-slate-400">No hay visitas registradas.</span>
                    </div>
                  ) : (
                    filteredAppointments.map((a) => (
                      <div key={a.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-label-lg text-xs font-bold text-slate-900 block">
                            {a.service_name || 'Sin servicio'}
                          </span>
                          <span className="font-body-sm text-[11px] text-slate-400">
                            {fmtFullDate(a.start_at)} · Barbero: {a.barber_name || 'Sin asignar'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-headline-md text-xs text-slate-900 font-bold">{money(a.price || 0)}</span>
                          <span className={`font-label-caps text-[10px] ${statusColor(a.status)} block`}>
                            {statusLabel(a.status)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Historic Purchases */}
              <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2 mb-6">
                <h3 className="font-headline-md text-base text-[#0f172a] font-bold">Historial de Compras</h3>
                <div className="flex flex-col divide-y divide-slate-100">
                  {filteredPurchases.length === 0 ? (
                    <div className="py-8 text-center">
                      <span className="font-body-sm text-xs text-slate-400">No hay compras registradas.</span>
                    </div>
                  ) : (
                    filteredPurchases.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-label-lg text-xs font-bold text-slate-900 block">
                            {p.items.map((i) => (i.qty > 1 ? `${i.qty}x ${i.name}` : i.name)).join(' · ') ||
                              'Venta de productos'}
                          </span>
                          <span className="font-body-sm text-[11px] text-slate-400">
                            {fmtFullDate(p.created_at)} · {paymentLabel(p.payment_method)} · {p.barber_name || 'Sin barbero'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-headline-md text-xs text-slate-900 font-bold">{money(p.total || 0)}</span>
                          <span className={`font-label-caps text-[10px] ${statusColor(p.status)} block`}>
                            {statusLabel(p.status)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {toastMsg && (
          <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
          </div>
        )}
      </main>

      <BottomNav
        activeTab="clientes"
        cajaPathVariant="caja"
        masPathVariant="mas"
        onNavigate={onNavigate}
      />
    </div>
  );
};