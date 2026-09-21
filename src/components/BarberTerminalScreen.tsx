import React, { useCallback, useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AccountDropdownMenu } from './AccountDropdownMenu';
import {
  Appointment,
  Barber,
  Sale,
  getSessionUser,
  getSessionShop,
  apiAppointments,
  apiSales,
  apiBarbers,
  apiShop,
} from '../services/api';

interface BarberTerminalScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

const SELECTED_CLIENT_KEY = 'barberos_selected_client';

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtCOP = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

// Comisión real del barbero según su esquema en la BD (igual que la caja POS).
const commissionOf = (barber: Barber | null, price: number, fallbackRate = 0.5): number => {
  const scheme = barber?.commission_scheme;
  const value = barber?.commission_value ?? null;
  if (scheme === 'fixed') return Math.round(Number(value) || 0);
  if (scheme === 'none') return 0;
  if (scheme === 'percentage' && value !== null && value !== undefined) {
    return Math.round((price * Number(value)) / 100);
  }
  return Math.round(price * fallbackRate);
};

const commissionLabelOf = (barber: Barber | null, fallbackRate = 0.5): string => {
  const scheme = barber?.commission_scheme;
  const value = barber?.commission_value ?? null;
  if (scheme === 'fixed') return `${fmtCOP(Number(value) || 0)} por cobro`;
  if (scheme === 'none') return 'Sin comisión';
  if (scheme === 'percentage' && value !== null && value !== undefined) {
    return `${value}% Comisión`;
  }
  return `${Math.round(fallbackRate * 100)}% Comisión`;
};

export const BarberTerminalScreen: React.FC<BarberTerminalScreenProps> = ({ onNavigate, onBack }) => {
  const [sessionUser] = useState(() => getSessionUser());
  const sessionShop = getSessionShop();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [shopName, setShopName] = useState<string>(sessionShop?.name ?? 'Mi barbería');
  const [elapsedOffset, setElapsedOffset] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const today = localDate(new Date());

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2000);
  }, []);

  const load = useCallback(async () => {
    const u = getSessionUser();
    if (!u) {
      setLoading(false);
      return;
    }
    try {
      const [apts, sales, shop, barbers] = await Promise.all([
        apiAppointments.list({ from: today, to: today, barberId: u.barberId ?? undefined }),
        apiSales.list({ from: today, to: today, barberId: u.barberId ?? undefined }),
        apiShop.get(),
        apiBarbers.list(),
      ]);
      setAppointments(apts);
      setTodaySales(sales);
      setShopName(shop.name);
      setBarber(barbers.find((b) => b.user_id === u.id) ?? barbers.find((b) => b.id === u.barberId) ?? null);
    } catch (err) {
      showToast(`No se pudo cargar tu jornada: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [today, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const barberName = sessionUser?.fullName || barber?.name || 'Barbero';

  const chairLabel = barber?.chair || 'Mi silla';
  const myCommissionLabel = commissionLabelOf(barber);
  const myCommissionRate = barber?.commission_scheme === 'percentage' ? (Number(barber.commission_value) || 0) / 100 : 0.5;

  const myAppointments = appointments.filter(
    (a) => !sessionUser?.barberId || a.barber_id === sessionUser.barberId,
  );
  const currentAppt = myAppointments.find((a) => a.status === 'en_corte') || null;
  const nextAppt =
    myAppointments
      .filter((a) => a.status === 'confirmada')
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] || null;
  const doneAppts = myAppointments
    .filter((a) => a.status === 'finalizado')
    .sort((a, b) => b.start_at.localeCompare(a.start_at));

  const production = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const myEarnings = todaySales.reduce((acc, s) => acc + Number(s.barber_earnings || 0), 0);
  const tipsEarned = todaySales.reduce((acc, s) => acc + Number(s.tip || 0), 0);

  const minutesUntil = nextAppt
    ? Math.max(0, Math.round((new Date(nextAppt.start_at).getTime() - Date.now()) / 60000))
    : 0;
  const nextTurnLabel = nextAppt
    ? `${fmtTime(nextAppt.start_at)}${minutesUntil > 0 ? ` (En ${minutesUntil} min)` : ''}`
    : 'Sin turnos';

  const initialsOf = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'CL';

  const handleSetStatus = async (id: string, status: string) => {
    setSavingId(id);
    try {
      await apiAppointments.patch(id, { status });
      showToast('Turno actualizado correctamente');
      await load();
    } catch (err) {
      showToast(`Error al actualizar el turno: ${(err as Error).message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleNotifyClient = (a: Appointment) => {
    const phone = (a.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      showToast('Este turno no tiene teléfono para avisar');
      return;
    }
    const msg = `¡Hola ${a.client_name}! Te avisamos desde *${shopName}*: tu turno ya está por empezar. Te esperamos 😉`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    showToast(`Notificando a ${a.client_name} por WhatsApp`);
  };

  const handleOpenClientFile = (a: Appointment) => {
    if (!a.client_id) {
      showToast('Este cliente aún no tiene ficha registrada');
      return;
    }
    try {
      sessionStorage.setItem(SELECTED_CLIENT_KEY, a.client_id);
    } catch {
      // Ignorar
    }
    onNavigate('clients_history', 'none');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      {/* Header with barber profile button matching xpath:
          //header//button[contains(., 'Carlos Fade') or contains(@class, 'rounded-full')]
      */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                id="btn-barber-terminal-back"
                onClick={onBack}
                title="Volver a la pantalla anterior"
                aria-label="Volver a la pantalla anterior"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-200"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
            )}

            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                content_cut
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[11px] text-amber-700 font-bold uppercase tracking-wider block">
                {chairLabel} · Terminal Barbero
              </span>
              <span className="font-headline-md text-base text-slate-900 font-bold">{shopName}</span>
            </div>
          </div>

          {/* User profile toggle button */}
          <div className="relative">
            <button
              type="button"
              id="btn-barber-profile-toggle"
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="true"
              title="Mi perfil y comisiones"
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 transition-all cursor-pointer border border-slate-200 shadow-2xs"
            >
              <span
                className="w-7 h-7 rounded-full bg-[#8d4b00] text-white flex items-center justify-center text-xs font-bold border border-amber-500 shrink-0"
                aria-label={barberName}
              >
                {initialsOf(barberName)}
              </span>
              <span className="font-label-md text-xs font-bold text-slate-900">{barberName}</span>
              <span className="material-symbols-outlined text-sm text-slate-500">
                {isAccountMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Account Dropdown for Barber */}
            <AccountDropdownMenu
              isOpen={isAccountMenuOpen}
              onClose={() => setIsAccountMenuOpen(false)}
              role="barber"
              barberName={barberName}
              chairLabel={chairLabel}
              businessName={shopName}
              onNavigateCommissions={() => {
                onNavigate('barber_balance', 'push');
              }}
              onLogout={() => {
                onNavigate('login', 'push_back');
              }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full pb-16 bg-[#f8fafc]">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 lg:gap-6 max-w-5xl mx-auto">
          {loading && (
            <div className="text-center text-xs text-slate-400 py-2">Cargando tu jornada de hoy...</div>
          )}

          {/* Status banner */}
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="font-label-md text-xs text-emerald-800 font-bold">En Turno Activo</span>
              <span className="text-slate-300">•</span>
              <span className="font-body-sm text-xs text-slate-500">Terminal táctil personal</span>
            </div>
            <span className="font-label-caps text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
              {myCommissionLabel}
            </span>
          </div>

          {/* Quick Stats: My Performance Today */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="font-label-md text-[11px] sm:text-xs text-slate-500">Cortes Hoy</span>
              <span className="font-currency-metric text-2xl sm:text-3xl text-slate-900 font-bold mt-1">
                {todaySales.length}
              </span>
              <span className="font-body-sm text-[10px] sm:text-xs text-emerald-600 font-semibold">
                {fmtCOP(production)} prod.
              </span>
            </div>

            <div className="bg-amber-500 text-white p-3.5 rounded-xl shadow-sm flex flex-col justify-between">
              <span className="font-label-md text-[11px] sm:text-xs text-white/90 font-medium">Mi Ganancia</span>
              <span className="font-currency-metric text-2xl sm:text-3xl text-white font-bold mt-1">
                {fmtCOP(myEarnings)}
              </span>
              <span className="font-body-sm text-[10px] sm:text-xs text-white/90 font-medium">{myCommissionLabel}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="font-label-md text-[11px] sm:text-xs text-slate-500">Propinas</span>
              <span className="font-currency-metric text-2xl sm:text-3xl text-slate-900 font-bold mt-1">
                {fmtCOP(tipsEarned)}
              </span>
              <span className="font-body-sm text-[10px] sm:text-xs text-slate-400">100% tuya</span>
            </div>
          </div>

          {/* Responsive Dual Column for Tablet and Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">
            {/* Left Column (Active Chair & Checkout Action) */}
            <div className="md:col-span-7 flex flex-col gap-4">
              {/* Primary Action Button: Dedicated Barber POS Checkout */}
              <button
                type="button"
                id="btn-barber-chair-checkout"
                onClick={() => onNavigate('barber_checkout', 'push')}
                className="w-full h-14 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-md flex items-center justify-between px-4 font-headline-md text-base uppercase tracking-wider font-bold active:scale-[0.99] transition-all cursor-pointer border border-amber-400/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    point_of_sale
                  </span>
                  <div className="text-left normal-case">
                    <span className="font-bold text-sm block leading-none">Cobro en Silla (Barbero)</span>
                    <span className="text-[10px] text-amber-100 font-medium">Calcula tu comisión ({myCommissionLabel}) y propina directa</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>

              {/* Current Client in Chair */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-amber-500 relative overflow-hidden flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    <span className="font-label-caps text-xs text-amber-800 font-bold uppercase tracking-wider">
                      En Silla Ahora
                    </span>
                  </div>
                  <span className="font-label-md text-xs text-slate-500">
                    {currentAppt
                      ? `${fmtTime(currentAppt.start_at)} - ${fmtTime(currentAppt.end_at)}`
                      : 'Sin cliente'}
                  </span>
                </div>

                {currentAppt ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg border border-slate-200 shrink-0">
                        {initialsOf(currentAppt.client_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-headline-md text-xl text-slate-900 font-bold truncate">
                          {currentAppt.client_name}
                        </h2>
                        <p className="font-body-sm text-xs text-slate-600 font-medium">
                          {currentAppt.service_name || 'Servicio'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-currency-metric text-lg text-amber-600 font-bold">
                            {fmtCOP(currentAppt.price)} COP
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-label-caps text-xs text-emerald-600 font-bold">
                          Tu comisión: {fmtCOP(commissionOf(barber, currentAppt.price, myCommissionRate))}
                        </span>
                        </div>
                      </div>
                    </div>

                    {/* In-Chair Timer */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-600">timer</span>
                        <div>
                          <span className="font-label-md text-xs text-slate-500 block">Tiempo en Silla</span>
                          <span className="font-headline-md text-lg text-slate-900 font-bold">
                            {currentAppt
                              ? `${Math.max(0, Math.round((nowTick - new Date(currentAppt.start_at).getTime()) / 60000)) + elapsedOffset} min / 45 min`
                              : '0 min / 45 min'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setElapsedOffset((prev) => prev + 5);
                          showToast('+5 min añadidos al corte');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-label-md text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        +5 min
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenClientFile(currentAppt)}
                        className="h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-label-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">history_edu</span>
                        <span>Ficha del Cliente</span>
                      </button>
                      <button
                        type="button"
                        id="btn-chair-finalize-and-charge"
                        onClick={() => onNavigate('barber_checkout', 'push')}
                        className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider shadow-xs active:scale-98"
                      >
                        <span className="material-symbols-outlined text-sm">point_of_sale</span>
                        <span>Finalizar y Cobrar</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-1.5">
                    <span className="material-symbols-outlined text-3xl text-slate-300">airline_seat_recline_normal</span>
                    <span className="text-xs text-slate-400">Sin cliente en la silla ahora mismo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (Queue and Today's Completed Cuts) */}
            <div className="md:col-span-5 flex flex-col gap-4">
              {/* Next in Line */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-slate-500 uppercase font-bold">Próximo Turno</span>
                  <span className="font-label-md text-xs text-amber-700 font-bold">{nextTurnLabel}</span>
                </div>
                {nextAppt ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-headline-md text-base text-slate-900 font-bold block">{nextAppt.client_name}</span>
                      <span className="font-body-sm text-xs text-slate-500">
                        {nextAppt.service_name || 'Servicio'} · {fmtCOP(nextAppt.price)} COP
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleNotifyClient(nextAppt)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 font-label-md text-xs font-bold border border-amber-200 hover:bg-amber-100 cursor-pointer"
                      >
                        Avisar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetStatus(nextAppt.id, 'en_corte')}
                        disabled={savingId === nextAppt.id}
                        className={`px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-label-md text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-1 ${
                          savingId === nextAppt.id ? 'opacity-60' : ''
                        }`}
                        title="Iniciar servicio"
                      >
                        {savingId === nextAppt.id ? (
                          <span>Cargando...</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">play_arrow</span>
                            <span>Iniciar</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('barber_checkout', 'push')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-label-md text-xs font-bold hover:bg-slate-800 cursor-pointer flex items-center gap-1"
                        title="Cobrar este turno"
                      >
                        <span className="material-symbols-outlined text-xs">point_of_sale</span>
                        <span>Cobrar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center text-xs text-slate-400">Sin turnos confirmados por ahora</div>
                )}
              </div>

              {/* Completed Cuts Today by this barber */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-slate-500 uppercase font-bold">Mis Cortes Finalizados Hoy</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('barber_checkout', 'push')}
                    className="text-amber-700 hover:text-amber-800 font-bold text-xs flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ver historial</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
                <div className="flex flex-col divide-y divide-slate-100">
                  {doneAppts.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">Aún no has finalizado cortes hoy</div>
                  ) : (
                    doneAppts.map((a) => (
                      <div key={a.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-label-lg text-xs font-bold text-slate-900 block">{a.client_name}</span>
                          <span className="font-body-sm text-[11px] text-slate-400">
                            {fmtTime(a.start_at)} · {a.service_name || 'Servicio'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-headline-md text-xs text-slate-900 font-bold">{fmtCOP(a.price)}</span>
                          <span className="font-label-caps text-[10px] text-emerald-600 block">
                            + {fmtCOP(commissionOf(barber, a.price, myCommissionRate))} com.
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {toastMsg && (
          <div className="fixed bottom-6 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
          </div>
        )}
      </main>
    </div>
  );
};