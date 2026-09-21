import React, { useCallback, useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import {
  Barber,
  Sale,
  getSessionUser,
  getSessionShop,
  apiAppointments,
  apiSales,
  apiBarbers,
  apiShop,
} from '../services/api';

interface BarberBalanceScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtCOP = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

const monthStart = () => {
  const d = new Date();
  return localDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'BA';

function commissionLabel(b: Barber | null): string {
  if (!b) return '—';
  if (b.commission_scheme === 'fixed') return `${fmtCOP(b.commission_value ?? 0)} por cobro`;
  if (b.commission_scheme === 'none') return 'Sin comisión';
  return `${b.commission_value ?? 0}% de cada venta`;
}

export const BarberBalanceScreen: React.FC<BarberBalanceScreenProps> = ({ onNavigate, onBack }) => {
  const [sessionUser] = useState(() => getSessionUser());
  const sessionShop = getSessionShop();
  const [shopName, setShopName] = useState(sessionShop?.name ?? 'Mi barbería');
  const [barber, setBarber] = useState<Barber | null>(null);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [monthSales, setMonthSales] = useState<Sale[]>([]);
  const [todayCuts, setTodayCuts] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const today = localDate(new Date());
  const barberId = sessionUser?.barberId ?? undefined;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [shop, barbers, sToday, sMonth, apts] = await Promise.all([
        apiShop.get(),
        apiBarbers.list(),
        apiSales.list({ from: today, to: today, barberId }),
        apiSales.list({ from: monthStart(), to: today, barberId }),
        apiAppointments.list({ from: today, to: today, barberId }),
      ]);
      setShopName(shop.name);
      setBarber(barbers.find((b) => b.user_id === sessionUser?.id) ?? barbers.find((b) => b.id === barberId) ?? null);
      setTodaySales(sToday);
      setMonthSales(sMonth);
      setTodayCuts(apts.length);
    } catch (err) {
      showToast(`No se pudo cargar tu balance: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [today, barberId, sessionUser?.id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const barberName = sessionUser?.fullName || barber?.name || 'Mi perfil';
  const todayProduction = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const todayEarnings = todaySales.reduce((acc, s) => acc + Number(s.barber_earnings || 0), 0);
  const todayTips = todaySales.reduce((acc, s) => acc + Number(s.tip || 0), 0);
  const monthProduction = monthSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const monthEarnings = monthSales.reduce((acc, s) => acc + Number(s.barber_earnings || 0), 0);
  const monthTips = monthSales.reduce((acc, s) => acc + Number(s.tip || 0), 0);

  // Las ventas de hoy ya incluyen el detalle por servicio (ítems)
  const todayItems = todaySales.flatMap((s) =>
    (s.items ?? []).map((it) => ({
      time: new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      clientName: s.client_name || 'Cliente',
      name: it.name,
      commission: Number(it.commission || 0),
    })),
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Volver"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-200"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_balance_wallet
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[11px] text-amber-700 font-bold uppercase tracking-wider block">
                Mi Balance
              </span>
              <span className="font-headline-md text-base text-slate-900 font-bold truncate max-w-[220px]">
                {barberName} · {shopName}
              </span>
            </div>
          </div>
          <span className="rounded-full w-9 h-9 bg-[#8d4b00] text-white flex items-center justify-center text-sm font-bold">
            {initialsOf(barberName)}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full pb-16">
        <div className="flex flex-col w-full px-4 sm:px-6 py-4 gap-4 max-w-3xl mx-auto">
          {loading && <div className="text-center text-xs text-slate-400 py-2">Cargando tu balance...</div>}

          {/* Esquema de comisión (directo de la BD) */}
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">percent</span>
              <div>
                <span className="font-label-md text-xs text-slate-500 block">Tu esquema de comisión</span>
                <span className="font-headline-md text-sm text-slate-900 font-bold">{commissionLabel(barber)}</span>
              </div>
            </div>
            {barber && (
              <span className="font-label-caps text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded">
                {barber.chair || 'Silla no asignada'}
              </span>
            )}
          </div>

          {/* Balance del mes */}
          <div className="bg-gradient-to-br from-amber-600 to-amber-500 text-white rounded-2xl p-4 shadow-md">
            <span className="font-label-caps text-[11px] text-white/80 uppercase font-bold block mb-1">
              Balance del mes
            </span>
            <span className="font-currency-metric text-3xl text-white font-bold block">
              {fmtCOP(monthEarnings)}
            </span>
            <span className="text-[11px] text-white/85 font-medium">ganancia liquidable (comisiones)</span>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/20">
              <div>
                <span className="font-label-md text-[10px] text-white/75 block">Producción</span>
                <span className="font-headline-md text-sm font-bold">{fmtCOP(monthProduction)}</span>
              </div>
              <div>
                <span className="font-label-md text-[10px] text-white/75 block">Propinas</span>
                <span className="font-headline-md text-sm font-bold">{fmtCOP(monthTips)}</span>
              </div>
              <div>
                <span className="font-label-md text-[10px] text-white/75 block">Cobros</span>
                <span className="font-headline-md text-sm font-bold">{monthSales.length}</span>
              </div>
            </div>
          </div>

          {/* Resumen de hoy */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-label-md text-[11px] text-slate-500 block">Hoy (producción)</span>
              <span className="font-currency-metric text-xl text-slate-900 font-bold mt-1 block">{fmtCOP(todayProduction)}</span>
              <span className="font-body-sm text-[10px] text-emerald-600 font-semibold">{todayCuts} turnos</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-label-md text-[11px] text-slate-500 block">Hoy (ganancia)</span>
              <span className="font-currency-metric text-xl text-amber-700 font-bold mt-1 block">{fmtCOP(todayEarnings)}</span>
              <span className="font-body-sm text-[10px] text-slate-400">tu liquidación</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-label-md text-[11px] text-slate-500 block">Hoy (propinas)</span>
              <span className="font-currency-metric text-xl text-slate-900 font-bold mt-1 block">{fmtCOP(todayTips)}</span>
              <span className="font-body-sm text-[10px] text-slate-400">100% tuyas</span>
            </div>
          </div>

          {/* Detalle de cobros de hoy */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-2">
            <span className="font-label-caps text-xs text-slate-500 uppercase font-bold">Tus cortes de hoy (comisiones)</span>
            {todayItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">Aún no has registrado cobros hoy</div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {todayItems.map((it, i) => (
                  <div key={i} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-label-lg text-xs font-bold text-slate-900 block truncate">{it.name}</span>
                      <span className="font-body-sm text-[11px] text-slate-400">
                        {it.time} · {it.clientName}
                      </span>
                    </div>
                    <span className="font-headline-md text-xs text-emerald-700 font-bold">{fmtCOP(it.commission)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solo acciones de salida, sin acceso a administración */}
          <button
            type="button"
            onClick={() => onNavigate('barber_terminal', 'push_back')}
            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
            Volver a mi terminal
          </button>
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