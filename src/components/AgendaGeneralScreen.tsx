import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { apiAppointments, apiBarbers, apiServices } from '../services/api';

// ---------- Helpers (módulo) ----------
const DAY_MS = 86_400_000;
const dayKey = (d: Date) => Math.floor(d.getTime() / DAY_MS);
const pad = (n: number) => String(n).padStart(2, '0');
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(m)} ${ampm}`;
};
const WEEK_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const FULL_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const dateFromKey = (k: number) => new Date(k * DAY_MS);
const fmtLongDay = (k: number) => {
  const d = dateFromKey(k);
  return `${FULL_DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};
const monthOfKey = (k: number) => MONTHS[dateFromKey(k).getMonth()];

const buildWeek = (today: Date) => {
  const start = new Date(today);
  const dow = (today.getDay() + 6) % 7; // Lunes = 0
  start.setDate(today.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      key: dayKey(d),
      day: WEEK_LABELS[d.getDay()],
      num: d.getDate(),
      fullName: FULL_DAYS[d.getDay()],
      month: MONTHS[d.getMonth()],
      dateISO: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    };
  });
};

// Convierte '01:00 PM' / '11:30 AM' / 'Ahora mismo' a Date local
const parseSlotTime = (time: string, dateISO: string) => {
  if (time.toLowerCase() === 'ahora mismo') return new Date();
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return new Date(`${dateISO}T13:00:00`);
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (/pm/i.test(m[3]) && h !== 12) h += 12;
  if (/am/i.test(m[3]) && h === 12) h = 0;
  return new Date(`${dateISO}T${pad(h)}:${pad(min)}:00`);
};

// ---------- Tipos de la pantalla ----------
interface AgendaGeneralScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

interface Appointment {
  id: string;
  dayKey: number;
  time: string;
  timeRange: string;
  clientName: string;
  phone: string | null;
  barberId: string | null;
  barberName: string | null;
  chair: string | null;
  service: string;
  price: number;
  status: string;
  paymentStatus: string | null;
  isVip: boolean;
  isWalkIn: boolean;
  start_at: string;
}

interface BarberItem {
  id: string;
  name: string;
  fullName: string;
  chair: string;
  avatar: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  duration: string;
}

export const AgendaGeneralScreen: React.FC<AgendaGeneralScreenProps> = ({ onNavigate, onBack }) => {
  const [activeDay, setActiveDay] = useState<number>(() => dayKey(new Date()));
  const [activeBarber, setActiveBarber] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dia' | 'semana'>('dia');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Express Appointment Modal State
  const [showExpressModal, setShowExpressModal] = useState(false);
  const [expressForm, setExpressForm] = useState({
    clientName: '',
    phone: '312 456 7890',
    barberId: null as string | null,
    service: '',
    serviceId: '',
    price: 0,
    day: dayKey(new Date()),
    time: '01:00 PM',
    isWalkIn: false,
    sendWhatsapp: true,
  });

  // Datos reales desde la API
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const loadAppointments = useCallback(async () => {
    try {
      const apts = await apiAppointments.list();
      setAppointments(
        apts
          .filter((a) => a.status !== 'cancelado')
          .map((a) => ({
            id: a.id,
            dayKey: dayKey(new Date(a.start_at)),
            time: fmtTime(a.start_at),
            timeRange: `${fmtTime(a.start_at)} - ${a.end_at ? fmtTime(a.end_at) : 'Sin hora fin'}`,
            clientName: a.client_name || 'Cliente',
            phone: a.phone,
            barberId: a.barber_id,
            barberName: a.barber_name,
            chair: null,
            service: a.service_name || 'Servicio',
            price: Number(a.price ?? 0),
            status: a.status,
            paymentStatus: a.payment_status,
            isVip: false,
            isWalkIn: a.is_walkin,
            start_at: a.start_at,
          })),
      );
    } catch {
      // Sin sesión o error de red: dejamos la pantalla vacía
    }
  }, []);

  const loadRefs = useCallback(async () => {
    try {
      const [barbersArr, svcArr] = await Promise.all([apiBarbers.list(), apiServices.list()]);
      setBarbers(
        barbersArr
          .filter((b) => b.active)
          .map((b, i) => ({
            id: b.id,
            name: b.name,
            fullName: b.name,
            chair: b.chair || `Silla #${i + 1}`,
            avatar: b.avatar_url,
          })),
      );
      setServices(
        svcArr
          .filter((s) => s.active)
          .map((s) => ({
            id: s.id,
            name: s.name,
            price: Number(s.price),
            duration: `${s.duration_minutes} min`,
          })),
      );
    } catch {
      // Sin sesión
    }
    await loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    loadRefs().finally(() => setLoading(false));
  }, [loadRefs]);

  useEffect(() => {
    const onChanged = () => loadAppointments();
    window.addEventListener('agenda-changed', onChanged);
    window.addEventListener('focus', onChanged);
    const interval = setInterval(loadAppointments, 60000);
    return () => {
      window.removeEventListener('agenda-changed', onChanged);
      window.removeEventListener('focus', onChanged);
      clearInterval(interval);
    };
  }, [loadAppointments]);

  const weekDays = useMemo(() => buildWeek(dateFromKey(activeDay)), [activeDay]);
  const todayKey = dayKey(new Date());
  const navBy = (dir: number) => setActiveDay((prev) => prev + dir * (viewMode === 'semana' ? 7 : 1));
  const goWeek = (dir: number) => setActiveDay((prev) => prev + dir * 7);
  const weekRangeLabel =
    weekDays[0]?.month === weekDays[6]?.month
      ? `${weekDays[0]?.num} - ${weekDays[6]?.num} ${weekDays[0]?.month}`
      : `${weekDays[0]?.num} ${weekDays[0]?.month} - ${weekDays[6]?.num} ${weekDays[6]?.month}`;
  const weekKeys = useMemo(() => weekDays.map((d) => d.key), [weekDays]);
  const weekAppointments = useMemo(
    () => appointments.filter((a) => weekKeys.includes(a.dayKey)),
    [appointments, weekKeys],
  );
  const activeDayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.dayKey === activeDay && (activeBarber === null || a.barberId === activeBarber))
        .sort((x, y) => x.start_at.localeCompare(y.start_at)),
    [appointments, activeDay, activeBarber],
  );
  const activeDayObj = weekDays.find((d) => d.key === activeDay);
  const topBarber = barbers
    .map((b) => ({ name: b.name, n: weekAppointments.filter((a) => a.barberId === b.id).length }))
    .sort((x, y) => y.n - x.n)[0];
  const topBarberLabel =
    topBarber && topBarber.n > 0
      ? `${topBarber.name} (${Math.round((topBarber.n / Math.max(1, weekAppointments.length)) * 100)}%)`
      : '—';

  // Abrir el modal de Cita Express
  const handleOpenExpressModal = (slotTime?: string, targetDay?: number) => {
    setExpressForm((prev) => ({
      ...prev,
      day: targetDay ?? activeDay,
      time: slotTime ?? '01:00 PM',
      clientName: prev.clientName || 'Cliente Express / Walk-in',
    }));
    setShowExpressModal(true);
  };

  // Crear Cita Express (vía API real)
  const handleCreateExpressAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expressForm.serviceId) {
      showToast(`Selecciona un servicio obligatorio para agendar`);
      return;
    }
    const dayObj = weekDays.find((d) => d.key === expressForm.day) || weekDays[4];
    const startAt = parseSlotTime(expressForm.time, dayObj.dateISO).toISOString();
    try {
      await apiAppointments.create({
        clientName: expressForm.clientName.trim() || 'Cliente Express',
        phone: expressForm.phone,
        startAt,
        barberId: expressForm.barberId ?? undefined,
        serviceId: expressForm.serviceId,
        serviceName: expressForm.service,
        price: expressForm.price,
        isWalkin: expressForm.isWalkIn,
      });
      setShowExpressModal(false);
      showToast(`⚡ Cita Express agendada con éxito`);
      window.dispatchEvent(new Event('agenda-changed'));
      loadAppointments();
    } catch (err) {
      showToast(`No se pudo agendar: ${(err as Error).message}`);
    }
  };

  const barberChipAvatar = (b: BarberItem) =>
    b.avatar ? (
      <img className="w-4 h-4 rounded-full object-cover" alt={b.name} src={b.avatar} />
    ) : (
      <span className="w-4 h-4 rounded-full bg-[#8d4b00]/20 text-[#8d4b00] flex items-center justify-center text-[9px] font-bold">
        {b.name.charAt(0)}
      </span>
    );

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Agenda"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 md:pb-28 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full max-w-7xl mx-auto">
          {/* Header Bar: Date navigation & View switcher */}
          <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-3 bg-white shadow-xs border-b border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navBy(-1)}
                  className="w-8 h-8 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#565e74] active:scale-95 transition-transform cursor-pointer"
                  title="Anterior (día anterior / semana anterior)"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-lg-mobile text-xl text-[#0f172a] tracking-wide font-bold">
                      {viewMode === 'dia' ? (
                        activeDayObj ? `${activeDayObj.fullName}, ${activeDayObj.num}` : fmtLongDay(activeDay)
                      ) : (
                        `Semana ${weekRangeLabel}`
                      )}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#fef3c7] text-[#b45309] font-label-caps text-[11px] uppercase font-bold">
                      {activeDay === todayKey ? 'Hoy' : monthOfKey(activeDay)}
                    </span>
                  </div>
                  <span className="font-body-sm text-[11px] text-[#64748b]">
                    {viewMode === 'dia'
                      ? 'Horario operativo: 08:00 AM - 07:00 PM'
                      : 'Vista consolidada de turnos semanales'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navBy(1)}
                  className="w-8 h-8 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#565e74] active:scale-95 transition-transform cursor-pointer"
                  title="Siguiente (día siguiente / semana siguiente)"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
                {activeDay !== todayKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDay(todayKey);
                      setViewMode('dia');
                    }}
                    className="px-2.5 h-8 rounded-full bg-[#8d4b00] text-white font-label-md text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                    title="Volver a hoy"
                  >
                    <span className="material-symbols-outlined text-[14px]">today</span>
                    <span>Hoy</span>
                  </button>
                )}
              </div>

              {/* Segmented Control: Día vs Semana */}
              <div className="flex items-center p-1 rounded-xl bg-[#f4f4f6] shadow-inner">
                <button
                  type="button"
                  id="btn-view-day"
                  onClick={() => setViewMode('dia')}
                  className={`px-3 py-1 rounded-lg font-label-md text-xs transition-all cursor-pointer ${
                    viewMode === 'dia' ? 'bg-white shadow-xs text-[#0f172a] font-bold' : 'text-[#64748b]'
                  }`}
                >
                  Día
                </button>
                <button
                  type="button"
                  id="btn-view-week"
                  onClick={() => setViewMode('semana')}
                  className={`px-3 py-1 rounded-lg font-label-md text-xs transition-all cursor-pointer ${
                    viewMode === 'semana' ? 'bg-white shadow-xs text-[#0f172a] font-bold' : 'text-[#64748b]'
                  }`}
                >
                  Semana
                </button>
              </div>
            </div>

            {/* Horizontal Week Calendar Picker con navegación en vivo */}
            <div className="flex items-center gap-1 py-1">
              <button
                type="button"
                onClick={() => goWeek(-1)}
                className="shrink-0 w-7 h-7 rounded-lg bg-[#f8fafc] hover:bg-[#e5eeff] flex items-center justify-center text-[#565e74] active:scale-95 transition-transform cursor-pointer border border-slate-200"
                title="Semana anterior"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>

              <div className="flex-1 flex items-center justify-between gap-1.5 overflow-x-auto min-w-0">
                {weekDays.map((item) => {
                  const dayAptsCount = appointments.filter((a) => a.dayKey === item.key).length;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveDay(item.key);
                      }}
                      className={`flex flex-col items-center justify-center py-2 px-2.5 min-w-[44px] rounded-xl transition-all cursor-pointer ${
                        activeDay === item.key
                          ? 'bg-[#8d4b00] text-white shadow-md scale-105 font-bold'
                          : 'bg-[#f8fafc] text-[#1e293b] hover:bg-[#e5eeff]'
                      }`}
                    >
                      <span
                        className={`font-label-md text-[11px] uppercase ${
                          activeDay === item.key ? 'text-white/90' : 'text-[#64748b]'
                        }`}
                      >
                        {item.day}
                      </span>
                      <span
                        className={`font-headline-md text-base mt-0.5 ${
                          activeDay === item.key ? 'text-white' : 'text-[#0f172a]'
                        }`}
                      >
                        {item.num}
                      </span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {activeDay === item.key && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />}
                        {dayAptsCount > 0 && (
                          <span
                            className={`text-[9px] font-bold ${
                              activeDay === item.key ? 'text-amber-200' : 'text-slate-400'
                            }`}
                          >
                            {dayAptsCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => goWeek(1)}
                className="shrink-0 w-7 h-7 rounded-lg bg-[#f8fafc] hover:bg-[#e5eeff] flex items-center justify-center text-[#565e74] active:scale-95 transition-transform cursor-pointer border border-slate-200"
                title="Semana siguiente"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Barbers Quick Filter Carousel */}
          <div className="px-4 sm:px-6 lg:px-8 py-2 bg-[#f8fafc] border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => setActiveBarber(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 shadow-xs transition-colors cursor-pointer ${
                    activeBarber === null
                      ? 'bg-[#8d4b00] text-white font-bold'
                      : 'bg-white text-[#1e293b] border border-slate-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">💈</span>
                  <span className="font-label-md text-xs">Todos ({barbers.length})</span>
                </button>

                {barbers.map((b) => {
                  const barberDayCount = appointments.filter(
                    (a) => a.dayKey === activeDay && a.barberId === b.id,
                  ).length;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setActiveBarber(b.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 shadow-xs transition-colors cursor-pointer ${
                        activeBarber === b.id
                          ? 'bg-[#8d4b00] text-white font-bold'
                          : 'bg-white text-[#1e293b] border border-slate-200'
                      }`}
                    >
                      {barberChipAvatar(b)}
                      <span className="font-label-md text-xs">{b.name}</span>
                      <span className="font-label-caps text-[10px] px-1 py-0.2 rounded-full bg-black/10">
                        {barberDayCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Agendar Action Button in Bar */}
              <button
                type="button"
                id="btn-quick-agendar-header"
                onClick={() => handleOpenExpressModal()}
                className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-label-md text-xs font-bold flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">bolt</span>
                <span>+ Agendar</span>
              </button>
            </div>
          </div>

          {/* Operational Pulse Banner */}
          <div className="mx-4 sm:mx-6 lg:mx-8 my-2.5 p-3 rounded-xl bg-white shadow-xs border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#e5eeff] flex items-center justify-center text-[#8d4b00] shrink-0">
                <span className="material-symbols-outlined text-[20px]">
                  {viewMode === 'semana' ? 'calendar_view_week' : 'event_available'}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-label-lg text-xs font-bold text-[#0f172a]">
                    {viewMode === 'semana'
                      ? `${weekAppointments.length} Citas en la Semana`
                      : `${activeDayAppointments.length} Citas Agendadas`}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                  <span className="font-label-md text-xs text-[#006c49] font-bold">
                    {viewMode === 'semana'
                      ? `${Math.max(0, barbers.length * 16 - weekAppointments.length)} Libres`
                      : `${Math.max(0, 9 - activeDayAppointments.length)} Libres`}
                  </span>
                </div>
                <span className="font-body-sm text-[11px] text-[#64748b]">
                  {viewMode === 'semana'
                    ? weekAppointments.length > 0
                      ? `Capacidad semanal operativa: ${Math.min(100, Math.round((weekAppointments.length / Math.max(1, barbers.length * 16)) * 100))}% ocupada`
                      : 'Sin citas registradas esta semana'
                    : activeDayAppointments.length > 0
                    ? `Ocupación estimada: ${Math.min(100, Math.round((activeDayAppointments.length / 9) * 100))}% de capacidad de sillas`
                    : 'Día sin citas por el momento'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 pl-2">
              <span className="font-headline-md text-lg text-[#8d4b00] font-bold">
                {viewMode === 'semana'
                  ? `$${((weekAppointments.reduce((sum, a) => sum + a.price, 0) || 0) / 1000).toFixed(0)}k`
                  : `$${((activeDayAppointments.reduce((sum, a) => sum + a.price, 0) || 0) / 1000).toFixed(0)}k`}
              </span>
              <span className="font-label-caps text-[10px] text-[#64748b] uppercase">
                {viewMode === 'semana' ? 'Semanal' : 'Proyectado'}
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VIEW MODE 1: INTERFAZ DE LA SEMANA (WEEKLY VIEW & MATRIX)                 */}
          {/* ========================================================================= */}
          {viewMode === 'semana' ? (
            <div className="px-4 sm:px-6 lg:px-8 flex flex-col gap-3 pb-24 lg:grid lg:grid-cols-2 lg:items-start">
              {/* Week Overview Card */}
              <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-xl">date_range</span>
                    <span className="font-headline-md text-sm font-bold tracking-wide">
                      Matriz Semanal de Barbería
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-label-caps text-[10px] font-bold">
                    {barbers.length} SILLONES EN TURNO
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/80 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 font-label-md block">Total Citas</span>
                    <span className="font-currency-metric text-lg text-white font-bold">{weekAppointments.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-label-md block">Sillón Top</span>
                    <span className="font-currency-metric text-lg text-amber-400 font-bold truncate">{topBarberLabel}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-label-md block">Facturación</span>
                    <span className="font-currency-metric text-lg text-emerald-400 font-bold">
                      ${(((weekAppointments.reduce((acc, c) => acc + c.price, 0) || 0)) / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Week Calendar Cards */}
              <div className="flex flex-col gap-3">
                {weekDays.map((dayItem) => {
                  const dayApts = appointments.filter(
                    (a) => a.dayKey === dayItem.key && (activeBarber === null || a.barberId === activeBarber),
                  );
                  const isToday = dayItem.key === todayKey;

                  return (
                    <div
                      key={dayItem.key}
                      className={`rounded-2xl bg-white p-3.5 shadow-sm border transition-all ${
                        isToday ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'
                      }`}
                    >
                      {/* Day Title Row */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                              isToday
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {dayItem.num}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-headline-md text-sm font-bold text-slate-900">
                                {dayItem.fullName} {dayItem.num} de {dayItem.month}
                              </span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase font-label-caps">
                                  Hoy
                                </span>
                              )}
                            </div>
                            <span className="font-body-sm text-[11px] text-slate-400">
                              {dayApts.length} {dayApts.length === 1 ? 'cita agendada' : 'citas agendadas'}
                            </span>
                          </div>
                        </div>

                        {/* Direct "+ Agendar" on this specific day */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDay(dayItem.key);
                              setViewMode('dia');
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-md text-[11px] font-semibold transition cursor-pointer"
                            title="Ver en vista de día"
                          >
                            Ver Día
                          </button>
                          <button
                            type="button"
                            id={`btn-agendar-day-${dayItem.num}`}
                            onClick={() => handleOpenExpressModal('01:00 PM', dayItem.key)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-label-md text-[11px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            <span>Agendar</span>
                          </button>
                        </div>
                      </div>

                      {/* Appointments List for this day */}
                      {dayApts.length === 0 ? (
                        <div className="py-3 px-2 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-400 text-base">event_busy</span>
                            <span>Sin citas registradas aún para este día</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenExpressModal('10:00 AM', dayItem.key)}
                            className="text-amber-700 font-bold hover:underline cursor-pointer text-xs"
                          >
                            + Agendar Cita
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {dayApts.map((apt) => (
                            <div
                              key={apt.id}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-bold text-slate-700 shrink-0 w-16">
                                  {apt.time}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-headline-md text-xs font-bold text-slate-900 truncate">
                                      {apt.clientName}
                                    </span>
                                    {apt.isVip && (
                                      <span className="px-1 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                        VIP
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-body-sm text-[11px] text-slate-500 truncate">
                                    {apt.service} · {apt.barberName?.split(' ')[0] ?? '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-headline-md text-xs font-bold text-slate-900">
                                  ${(apt.price / 1000).toFixed(0)}k
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-label-caps ${
                                    apt.status === 'en_corte'
                                      ? 'bg-amber-100 text-amber-800'
                                      : apt.status === 'finalizado'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : apt.status === 'confirmada'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {apt.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW MODE 2: INTERFAZ DE DÍA (TIMELINE DETALLADO)                         */
            /* ========================================================================= */
            <div className="px-4 sm:px-6 lg:px-8 flex flex-col lg:grid lg:grid-cols-12 lg:items-start gap-4 pb-24">
              {/* Timeline de citas - col principal */}
              <div className="lg:col-span-8 flex flex-col gap-3">
                {loading ? (
                  <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-100 text-center text-sm text-slate-400">
                    Cargando agenda...
                  </div>
                ) : activeDayAppointments.length === 0 ? (
                  <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-100 flex flex-col items-center gap-2 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300">event_busy</span>
                    <span className="text-sm text-slate-500 font-semibold">Sin citas para este día</span>
                    <span className="text-xs text-slate-400">Usa el botón + para agendar una cita express</span>
                  </div>
                ) : (
                  activeDayAppointments.map((apt) => {
                    const barber = barbers.find((b) => b.id === apt.barberId);
                    const isActive = apt.status === 'en_corte';
                    const isDone = apt.status === 'finalizado';
                    return (
                      <div key={apt.id} className="flex gap-2.5 items-start">
                        <div className="w-12 pt-2 flex flex-col items-end shrink-0">
                          <span
                            className={`font-label-md text-xs font-bold ${
                              isActive ? 'text-[#b45309]' : 'text-[#0f172a]'
                            }`}
                          >
                            {apt.time.split(' ')[0]}
                          </span>
                          <span
                            className={`font-body-sm text-[11px] ${
                              isActive ? 'text-[#b45309]' : 'text-[#64748b]'
                            }`}
                          >
                            {apt.time.split(' ')[1]}
                          </span>
                        </div>
                        <div
                          className={`flex-1 rounded-xl bg-white p-3.5 shadow-sm border ${
                            isActive ? 'border-amber-200 shadow-md relative overflow-hidden' : 'border-slate-100'
                          }`}
                        >
                          {isActive && <div className="absolute top-0 inset-x-0 h-1.5 bg-[#f59e0b]" />}
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full font-label-caps text-[11px] flex items-center gap-1 font-bold ${
                                  isDone
                                    ? 'bg-emerald-50 text-[#006c49]'
                                    : isActive
                                    ? 'bg-[#fef3c7] text-[#b45309]'
                                    : apt.status === 'confirmada'
                                    ? 'bg-[#e5eeff] text-[#565e74]'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isDone ? 'check_circle' : isActive ? 'content_cut' : 'schedule'}
                                </span>
                                {apt.status.replace('_', ' ')}
                              </span>
                              <span className="font-label-md text-xs text-[#64748b]">{apt.timeRange}</span>
                            </div>
                            <span className="font-headline-md text-base text-[#0f172a] font-bold">
                              ${apt.price.toLocaleString('es-CO')}
                            </span>
                          </div>
                          <div className="font-headline-md text-lg text-[#0f172a] mb-0.5 font-bold">{apt.clientName}</div>
                          <div className="flex items-center justify-between gap-2 text-[#64748b] font-body-sm text-xs">
                            <span className="truncate">{apt.service}</span>
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#f4f4f6] text-[#1e293b] text-[11px] font-medium">
                              {barber ? `${barber.chair} · ${barber.name}` : 'Sin barbero'}
                            </span>
                          </div>
                          {apt.paymentStatus && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[12px] text-[#006c49]">
                              <span className="flex items-center gap-1 font-semibold">
                                <span className="material-symbols-outlined text-[16px]">payments</span>
                                {apt.paymentStatus}
                              </span>
                            </div>
                          )}
                          {!isDone && !loading && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 mt-2">
                              <button
                                type="button"
                                onClick={() => onNavigate('clients_history', 'none')}
                                className="flex items-center justify-center gap-1 h-9 px-2 rounded-lg bg-[#f8fafc] text-[#1e293b] hover:bg-[#e5eeff] active:scale-95 transition-all cursor-pointer font-semibold text-xs"
                              >
                                <span className="material-symbols-outlined text-[18px]">account_box</span>
                                <span>Ver Ficha</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    localStorage.setItem('barberos_pending_turn', apt.id);
                                  } catch {
                                    // Ignore
                                  }
                                  onNavigate('sales_cash', 'none');
                                }}
                                className="flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-[#f59e0b] hover:bg-amber-500 text-white shadow-xs active:scale-95 transition-all cursor-pointer font-bold text-xs uppercase tracking-wider"
                              >
                                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                                <span>Cobrar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Espacio disponible -> Agendar */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-12 pt-2 flex flex-col items-end shrink-0">
                    <span className="font-label-md text-xs font-semibold text-[#64748b]">01:00</span>
                    <span className="font-body-sm text-[11px] text-[#64748b]">PM</span>
                  </div>
                  <div className="flex-1 rounded-xl bg-[#f8fafc] border border-dashed border-slate-300 p-3.5 flex items-center justify-between gap-2 shadow-inner">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#64748b] shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[20px]">chair</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-lg text-xs text-[#0f172a] font-semibold truncate">
                          Espacio Disponible (1h)
                        </span>
                        <span className="font-body-sm text-[11px] text-[#64748b] truncate">
                          Ideal para Walk-in o cliente express
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-slot-agendar"
                      onClick={() => handleOpenExpressModal('01:00 PM')}
                      className="h-8 px-3 rounded-lg bg-amber-500 text-white shadow-xs hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-1 shrink-0 font-bold text-xs uppercase cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Agendar</span>
                    </button>
                  </div>
                </div>
              </div>{/* fin timeline columna principal */}

              {/* Sidebar Derecho: estadísticas del día en desktop */}
              <div className="hidden lg:flex lg:col-span-4 flex-col gap-3 sticky top-20">
                {/* KPIs del día */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">bar_chart</span>
                    <span className="font-headline-md text-sm font-bold text-slate-900">Resumen del Día</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                      <span className="font-label-md text-xs text-slate-700">Citas del día</span>
                      <span className="font-headline-md text-lg text-amber-800 font-bold">{activeDayAppointments.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="font-label-md text-xs text-slate-700">Proyección</span>
                      <span className="font-headline-md text-lg text-emerald-800 font-bold">
                        ${(((activeDayAppointments.reduce((s, a) => s + a.price, 0) || 0)) / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="font-label-md text-xs text-slate-700">En proceso</span>
                      <span className="font-headline-md text-lg text-[#8d4b00] font-bold">
                        {activeDayAppointments.filter((a) => a.status === 'en_corte').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista compacta de citas */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-headline-md text-sm font-bold text-slate-900">Agenda del Día</span>
                    <button
                      type="button"
                      onClick={() => handleOpenExpressModal()}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-label-md text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>Nueva</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {loading ? (
                      <p className="text-xs text-slate-400 text-center py-4">Cargando...</p>
                    ) : activeDayAppointments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Sin citas para este día</p>
                    ) : (
                      activeDayAppointments.map((apt) => (
                        <div key={apt.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="font-mono text-xs font-bold text-slate-600 w-12 shrink-0">{apt.time}</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-label-md text-xs font-bold text-slate-900 block truncate">{apt.clientName}</span>
                            <span className="font-body-sm text-[10px] text-slate-400 truncate block">{apt.service}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-label-caps ${
                            apt.status === 'en_corte' ? 'bg-amber-100 text-amber-800' :
                            apt.status === 'finalizado' ? 'bg-emerald-100 text-emerald-800' :
                            apt.status === 'confirmada' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>{apt.status.replace('_', ' ')}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Floating Action Button (FAB) for Cita Express */}
          <div className="fixed bottom-20 md:bottom-24 right-4 md:right-6 z-40">
            <button
              type="button"
              id="fab-cita-express"
              onClick={() => handleOpenExpressModal()}
              className="flex items-center gap-2 h-13 pl-4 pr-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-xl hover:from-amber-400 hover:to-amber-500 active:scale-95 transition-all cursor-pointer font-bold border border-white/30"
            >
              <div className="w-7 h-7 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">bolt</span>
              </div>
              <span className="font-label-caps text-xs uppercase tracking-wider">Cita Express</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL / SHEET: AGREGAR CITA EXPRESS                                       */}
        {/* ========================================================================= */}
        {showExpressModal && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
            <div
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              {/* Modal Header */}
              <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl font-bold">bolt</span>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-lg text-slate-900 font-bold">
                      Agregar Cita Express
                    </h2>
                    <p className="font-body-sm text-[11px] text-slate-500">
                      Registro rápido para clientes en sala o agendamiento veloz
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExpressModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateExpressAppointment} className="flex-1 overflow-y-auto min-h-0 p-5 flex flex-col gap-4">
                {/* Walk-in vs Scheduled Pill Switch */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setExpressForm((p) => ({ ...p, isWalkIn: true }))}
                    className={`flex-1 py-2 rounded-lg font-label-md text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      expressForm.isWalkIn
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">directions_walk</span>
                    <span>Cliente en Sala (Walk-in)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpressForm((p) => ({ ...p, isWalkIn: false }))}
                    className={`flex-1 py-2 rounded-lg font-label-md text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !expressForm.isWalkIn
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                    <span>Cita Programada</span>
                  </button>
                </div>

                {/* Client Name Input & Quick Suggestions */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="client-name" className="font-label-caps text-xs text-slate-700 font-bold">
                    Nombre del Cliente
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-xl pointer-events-none">
                      person
                    </span>
                    <input
                      id="client-name"
                      type="text"
                      required
                      value={expressForm.clientName}
                      onChange={(e) => setExpressForm({ ...expressForm, clientName: e.target.value })}
                      placeholder="Ej. Roberto Mejía o Cliente de paso"
                      className="w-full h-11 pl-10 pr-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  {/* Quick Client Suggestions */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                    {['Roberto Mejía (VIP)', 'Cliente de Paso', 'Juan Camilo', 'Andrés Pérez'].map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setExpressForm({ ...expressForm, clientName: name })}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-label-md text-slate-700 whitespace-nowrap cursor-pointer"
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone / WhatsApp */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="client-phone" className="font-label-caps text-xs text-slate-700 font-bold">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-xl pointer-events-none">
                      chat
                    </span>
                    <input
                      id="client-phone"
                      type="tel"
                      value={expressForm.phone}
                      onChange={(e) => setExpressForm({ ...expressForm, phone: e.target.value })}
                      placeholder="312 456 7890"
                      className="w-full h-11 pl-10 pr-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Barber Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-caps text-xs text-slate-700 font-bold">
                    Barbero Asignado
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {barbers.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setExpressForm({ ...expressForm, barberId: b.id })}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer text-center ${
                          expressForm.barberId === b.id
                            ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {b.avatar ? (
                          <img className="w-8 h-8 rounded-full object-cover shadow-xs" alt={b.name} src={b.avatar} />
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-[#8d4b00]/15 text-[#8d4b00] flex items-center justify-center text-sm font-bold shadow-xs">
                            {b.name.charAt(0)}
                          </span>
                        )}
                        <span className="font-label-md text-xs font-bold text-slate-900 truncate w-full">
                          {b.name}
                        </span>
                        <span className="text-[10px] text-slate-500">{b.chair}</span>
                      </button>
                    ))}
                    {barbers.length === 0 && (
                      <p className="col-span-3 text-xs text-slate-400 text-center py-2">Aún no hay barberos activos</p>
                    )}
                  </div>
                </div>

                {/* Service Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-caps text-xs text-slate-700 font-bold">
                    Servicio a Realizar <span className="text-amber-600">*</span>
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {services.map((srv) => (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setExpressForm({ ...expressForm, serviceId: srv.id, service: srv.name, price: srv.price })}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                          expressForm.serviceId === srv.id
                            ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className="font-label-md text-xs font-bold text-slate-900 block">{srv.name}</span>
                          <span className="font-body-sm text-[11px] text-slate-500">Duración: {srv.duration}</span>
                        </div>
                        <span className="font-headline-md text-sm font-bold text-amber-800">
                          ${srv.price.toLocaleString('es-CO')}
                        </span>
                      </button>
                    ))}
                    {services.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">Configura servicios en "Tarifas y Servicios"</p>
                    )}
                    {expressForm.serviceId === '' && (
                      <p className="text-[11px] text-amber-700 font-semibold">Obligatorio: selecciona un servicio para agendar.</p>
                    )}
                  </div>
                </div>

                {/* Day & Time Quick Slots */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="slot-day" className="font-label-caps text-xs text-slate-700 font-bold">
                      Día
                    </label>
                    <select
                      id="slot-day"
                      value={expressForm.day}
                      onChange={(e) => setExpressForm({ ...expressForm, day: Number(e.target.value) })}
                      className="h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                    >
                      {weekDays.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.fullName} {d.num} de {d.month} {d.key === todayKey ? '(Hoy)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="slot-time" className="font-label-caps text-xs text-slate-700 font-bold">
                      Hora de Cita
                    </label>
                    <select
                      id="slot-time"
                      value={expressForm.time}
                      onChange={(e) => setExpressForm({ ...expressForm, time: e.target.value })}
                      className="h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Ahora mismo">Ahora Mismo (En sala)</option>
                      <option value="11:30 AM">11:30 AM</option>
                      <option value="01:00 PM">01:00 PM</option>
                      <option value="02:00 PM">02:00 PM</option>
                      <option value="03:30 PM">03:30 PM</option>
                      <option value="05:00 PM">05:00 PM</option>
                      <option value="06:15 PM">06:15 PM</option>
                    </select>
                  </div>
                </div>

                {/* Auto WhatsApp Confirmation toggle */}
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expressForm.sendWhatsapp}
                    onChange={(e) => setExpressForm({ ...expressForm, sendWhatsapp: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <div className="flex flex-col">
                    <span className="font-label-md text-xs font-bold text-emerald-900">
                      Notificar confirmación por WhatsApp
                    </span>
                    <span className="font-body-sm text-[11px] text-emerald-700">
                      Envía recordatorio automático al cliente con fecha y hora
                    </span>
                  </div>
                </label>

                {/* Submit Action */}
                <button
                  type="submit"
                  id="btn-submit-express-appointment"
                  disabled={!expressForm.serviceId}
                  className={`w-full h-13 mt-1 rounded-xl text-white font-headline-md text-sm font-bold uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all ${
                    expressForm.serviceId
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">bolt</span>
                  <span>Confirmar y Agendar Cita Express</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Floating toast notification */}
        {toastMsg && (
          <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
          </div>
        )}
      </main>

      <BottomNav
        activeTab="agenda"
        cajaPathVariant="caja-ventas"
        masPathVariant="mas-opciones"
        onNavigate={onNavigate}
      />
    </div>
  );
};