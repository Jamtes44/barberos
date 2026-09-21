import React, { useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { UpcomingAppointmentsPushWidget } from './UpcomingAppointmentsPushWidget';
import { PushSettingsModal } from './PushSettingsModal';
import { apiReports, apiSales, apiShop, Kpis, Sale, Appointment, apiAppointments, api } from '../services/api';

interface OwnerDashboardScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

const fmtCop = (n: number) => `$${n.toLocaleString('es-CO')}`;
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const OwnerDashboardScreen: React.FC<OwnerDashboardScreenProps> = ({ onNavigate, onBack }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [shopName, setShopName] = useState('Mi Barbería');
  const [sales, setSales] = useState<Sale[]>([]);
  const [stations, setStations] = useState<Appointment[]>([]);
  const [ownerName, setOwnerName] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  useEffect(() => {
    const user = api.user();
    if (user) setOwnerName(user.fullName.split(' ')[0]);
    Promise.allSettled([
      apiReports.kpis(today()),
      apiShop.get(),
      apiSales.list({ from: today() }),
      apiAppointments.list({ status: 'en_corte' }),
      apiAppointments.list({ status: 'confirmada' }),
    ]).then(([k, shop, salesRes, cutting, waiting]) => {
      if (k.status === 'fulfilled' && k.value) setKpis(k.value);
      if (shop.status === 'fulfilled' && shop.value) setShopName(shop.value.name);
      if (salesRes.status === 'fulfilled') setSales(salesRes.value.slice(0, 4));
      const ktrue = cutting.status === 'fulfilled' ? cutting.value : [];
      const wtrue = waiting.status === 'fulfilled' ? waiting.value : [];
      setStations([...wtrue, ...ktrue].slice(0, 5));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Dashboard"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
        onNotificationsClick={() => setShowPushSettings(true)}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 md:pb-28 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 lg:gap-6 max-w-7xl mx-auto">
          {/* Top Executive Header */}
          <section className="flex flex-col gap-1 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h1 className="font-headline-lg-mobile text-[26px] text-[#0f172a] tracking-tight font-bold">
                  Hola {ownerName || 'bienvenido'} 👋
                </h1>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f4f4f6] text-[#0b1c30]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006c49]" />
                </span>
                <span className="font-label-md text-xs text-[#64748b]">Polling 20s</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[#64748b] text-xs">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">storefront</span>
                <span className="font-label-lg text-xs font-semibold text-[#0f172a]">{shopName}</span>
              </div>
              <span className="font-body-sm text-xs">
                {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
          </section>

          {/* KPI Grid (Responsive 2x2 on mobile, 4 columns on tablet & desktop) */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="font-label-caps text-xs uppercase text-[#64748b] font-bold">Métricas Operativas</span>
              <span className="font-label-md text-xs text-[#006c49] font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> En meta (+18%)
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 lg:gap-4">
              {/* KPI 1: Ventas Hoy */}
              <div className="flex flex-col justify-between bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-100 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-md text-xs text-[#64748b]">Ventas Hoy</span>
                  <span className="material-symbols-outlined text-[18px] text-[#8d4b00]">payments</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-currency-metric text-3xl sm:text-4xl text-[#0f172a] font-bold">{fmtCop(kpis?.revenue ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[#64748b] text-xs">
                  <span className="font-label-md font-medium text-[#006c49]">Hoy</span>
                  <span className="font-label-md">{kpis?.salesCount ?? 0} serv.</span>
                </div>
              </div>

              {/* KPI 2: Citas del Día */}
              <div className="flex flex-col justify-between bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-100 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-md text-xs text-[#64748b]">Citas del Día</span>
                  <span className="material-symbols-outlined text-[18px] text-[#565e74]">event_available</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-currency-metric text-3xl sm:text-4xl text-[#0f172a] font-bold">{kpis?.totalAppointments ?? 0}</span>
                  <span className="font-label-caps text-xs text-[#64748b] uppercase font-bold">Total</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[#64748b] text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="font-label-md">{kpis?.appointments?.['en_corte'] ?? 0} en curso</span>
                  <span className="text-[10px]">•</span>
                  <span className="font-label-md">{kpis?.appointments?.['pendiente'] ?? 0} x llegar</span>
                </div>
              </div>

              {/* KPI 3: Comisiones */}
              <div className="flex flex-col justify-between bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-100 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-md text-xs text-[#64748b]">Comisiones</span>
                  <span className="material-symbols-outlined text-[18px] text-[#b45309]">account_balance_wallet</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-currency-metric text-3xl sm:text-4xl text-[#0f172a] font-bold">{fmtCop(kpis?.barberEarnings ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[#64748b] text-xs">
                  <span className="font-label-md">Comisiones hoy</span>
                </div>
              </div>

              {/* KPI 4: Ticket Promedio */}
              <div className="flex flex-col justify-between bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-100 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-md text-xs text-[#64748b]">Ticket Prom.</span>
                  <span className="material-symbols-outlined text-[18px] text-[#006c49]">analytics</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-currency-metric text-3xl sm:text-4xl text-[#0f172a] font-bold">{fmtCop(kpis?.avgTicket ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[#64748b] text-xs">
                  <span className="font-label-md text-[#006c49] font-medium">COP</span>
                  <span className="font-label-md">Hoy</span>
                </div>
              </div>
            </div>
          </section>

          {/* Main 2-Column Responsive Deck for Tablet & Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            {/* Left Column (Quick Actions + Chairs in Real Time + Recent Transactions) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Quick Action Hub */}
              <section className="flex flex-col gap-1">
                <span className="font-label-caps text-xs uppercase text-[#64748b] px-1 font-bold">Operación Rápida</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('sales_cash', 'none')}
                    className="flex flex-col items-center justify-center p-2.5 h-14 bg-[#8d4b00] hover:bg-[#723c00] rounded-lg text-white shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      <span className="font-headline-md text-sm font-bold tracking-wide">+ Cobro</span>
                    </div>
                    <span className="font-label-md text-[10px] opacity-90">Venta Express</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('agenda_general', 'none')}
                    className="flex flex-col items-center justify-center p-2.5 h-14 bg-white hover:bg-slate-50 rounded-lg text-[#0f172a] shadow-sm border border-slate-200 active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">event</span>
                      <span className="font-headline-md text-sm font-bold tracking-wide">+ Agendar</span>
                    </div>
                    <span className="font-label-md text-[10px] text-[#64748b]">Nueva Reserva</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      showToast('Arqueo de caja iniciado');
                      onNavigate('sales_cash', 'none');
                    }}
                    className="flex flex-col items-center justify-center p-2.5 h-14 bg-white hover:bg-slate-50 rounded-lg text-[#0f172a] shadow-sm border border-slate-200 active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-[#ef4444]">lock_clock</span>
                      <span className="font-headline-md text-sm font-bold tracking-wide">Cierre</span>
                    </div>
                    <span className="font-label-md text-[10px] text-[#64748b]">Caja Parcial</span>
                  </button>
                </div>
              </section>

              {/* En la Silla Ahora Mismo */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">chair</span>
                    <span className="font-headline-md text-xl text-[#0f172a] font-bold">En la Silla Ahora Mismo</span>
                  </div>
                  <span className="font-label-caps text-xs text-[#006c49] font-bold">{stations.length} Sillas Activas</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {stations.length === 0 && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center text-[#64748b] text-sm">
                      No hay clientes en silla ahora mismo.
                    </div>
                  )}
                  {stations.map((a) => (
                    <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col gap-2">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#8d4b00]" />
                      <div className="flex items-start justify-between min-w-0 pl-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-[#f4f4f6] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl text-[#8d4b00]">content_cut</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-label-lg text-sm font-bold text-[#0f172a] truncate">
                                {a.barber_name || 'Sin asignar'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#f4f4f6] font-label-caps text-[10px] text-[#64748b]">Silla</span>
                            </div>
                            <span className="font-body-sm text-xs text-[#1e293b] truncate">
                              {a.client_name}{a.service_name ? ` · ${a.service_name}` : ''}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#b45309] font-label-caps text-xs shrink-0 font-bold">
                          {a.status === 'en_corte' ? 'En Corte' : 'Esperando'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-2 bg-[#f8fafc] p-2 rounded-lg pl-3 text-[#1e293b]">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">schedule</span>
                          <span className="font-label-md text-xs font-medium">
                            {new Date(a.start_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="font-currency-metric text-sm font-bold text-[#8d4b00]">{fmtCop(a.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Transacciones Recientes */}
              <section className="flex flex-col gap-1">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#006c49]">receipt_long</span>
                    <span className="font-headline-md text-xl text-[#0f172a] font-bold">Transacciones Recientes</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('sales_cash', 'push')}
                    className="font-label-md text-xs text-[#8d4b00] font-bold hover:underline cursor-pointer"
                  >
                    Ver libro
                  </button>
                </div>

                <div className="bg-white rounded-xl p-2 shadow-sm border border-slate-100 flex flex-col gap-1">
                  {sales.length === 0 && (
                    <div className="p-4 text-center text-[#64748b] text-sm">
                      Sin ventas registradas hoy todavía.
                    </div>
                  )}
                  {sales.map((s, i) => (
                    <div key={s.id} className="flex flex-col gap-1">
                      {i > 0 && <div className="h-[1px] bg-slate-100 mx-2" />}
                      <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#f4f4f6] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px] text-[#006c49]">attach_money</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-label-lg text-sm font-bold text-[#0f172a] truncate">
                              {s.items[0]?.name || 'Venta'}
                            </span>
                            <div className="flex items-center gap-1 text-[#64748b] text-xs">
                              <span className="truncate">{s.barber_name || 'Sin barbero'}</span>
                              <span className="text-[10px]">•</span>
                              <span>{new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 pl-2">
                          <span className="font-headline-md text-lg text-[#0f172a] font-bold">{fmtCop(s.total)}</span>
                          <div className="flex items-center gap-1 text-[#006c49] font-label-md text-xs font-semibold">
                            <span>{s.payment_method}</span>
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column (Push Notifications & Upcoming Appointments Widget) */}
            <div className="lg:col-span-5 flex flex-col gap-5 sticky lg:top-20">
              {/* Servicio de Notificaciones Push para Citas Próximas */}
              <UpcomingAppointmentsPushWidget onNavigate={onNavigate} onToast={showToast} />
            </div>
        </div>

        {/* Micro Interaction Toast */}
        {toastMessage && (
          <div className="fixed bottom-20 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center justify-between z-50 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#f59e0b] text-[20px]">bolt</span>
              <span className="font-body-sm text-xs font-medium">{toastMessage}</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-slate-400">done</span>
          </div>
        )}
        </div>
      </main>

      <BottomNav
        activeTab="dashboard"
        cajaPathVariant="caja-ventas"
        masPathVariant="mas-opciones"
        onNavigate={onNavigate}
      />

      <PushSettingsModal
        isOpen={showPushSettings}
        onClose={() => setShowPushSettings(false)}
        onSettingsChanged={() => {}}
      />
    </div>
  );
};
