import React, { useEffect, useMemo, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { apiReports } from '../services/api';

interface ReportsFinanceScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

type PeriodKey = 'today' | 'week' | 'month';

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const fmtCop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const fmtCopCOP = (n: number) => `${fmtCop(n)} COP`;

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi/Davi',
  tarjeta: 'Tarjeta',
  caja_central: 'Caja Central',
};

interface Range {
  from: string;
  to: string;
}

const rangeFor = (period: PeriodKey): Range => {
  const today = new Date();
  if (period === 'today') return { from: localDate(today), to: localDate(today) };
  if (period === 'week') {
    return { from: localDate(addDays(today, -((today.getDay() + 6) % 7))), to: localDate(today) };
  }
  return { from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDate(today) };
};

const prevRange = (r: Range): Range => {
  const from = new Date(r.from + 'T00:00:00');
  const days = Math.round((new Date(r.to + 'T00:00:00').getTime() - from.getTime()) / 86400000) + 1;
  return { from: localDate(addDays(from, -days)), to: localDate(addDays(from, -1)) };
};

interface PeriodReport {
  from: string;
  to: string;
  byDay: Array<{ day: string; sales_count: number; total: number }>;
  byMethod: Array<{ payment_method: string; count: number; total: number }>;
  topServices: Array<{ service_name: string; count: number; total: number }>;
  topBarbers: Array<{ name: string; sales_count: number; total: number }>;
}

interface CommissionsReport {
  byBarber: Array<{ id: string; name: string; sales_count: number; revenue: number; earnings: number; tips: number }>;
}

export const ReportsFinanceScreen: React.FC<ReportsFinanceScreenProps> = ({ onNavigate, onBack }) => {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [commReport, setCommReport] = useState<CommissionsReport | null>(null);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    const r = rangeFor(period);
    const p = prevRange(r);
    Promise.all([apiReports.period(r.from, r.to), apiReports.commissions(r.from, r.to), apiReports.period(p.from, p.to)])
      .then(([rep, comm, prev]) => {
        if (!active) return;
        setReport(rep);
        setCommReport(comm);
        setTotalEarnings(comm.totalEarnings);
        setPrevTotal(prev.byDay.reduce((acc, d) => acc + d.total, 0));
        setError(null);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  const totalRevenue = report ? report.byDay.reduce((acc, d) => acc + d.total, 0) : 0;
  const salesCount = report ? report.byDay.reduce((acc, d) => acc + d.sales_count, 0) : 0;
  const avgTicket = salesCount ? totalRevenue / salesCount : 0;
  const houseEarnings = totalRevenue - totalEarnings;
  const commissionPct = totalRevenue ? (totalEarnings / totalRevenue) * 100 : 0;
  const housePct = totalRevenue ? (houseEarnings / totalRevenue) * 100 : 0;
  const delta = prevTotal != null && prevTotal > 0 ? ((totalRevenue - prevTotal) / prevTotal) * 100 : null;
  const deltaLabel = delta == null ? 'Sin comparación' : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs periodo ant.`;

  const chart = useMemo(() => {
    const groups: Array<{ label: string; amount: number }> = [];
    let weekStart = '';
    let current: { label: string; amount: number } | null = null;
    (report?.byDay ?? []).forEach((d) => {
      const dt = new Date(d.day + 'T00:00:00');
      if (Number.isNaN(dt.getTime())) return;
      const start = localDate(addDays(dt, -((dt.getDay() + 6) % 7)));
      if (start !== weekStart) {
        weekStart = start;
        current = { label: `Sem ${groups.length + 1}`, amount: 0 };
        groups.push(current);
      }
      if (current) current.amount += d.total;
    });
    return groups;
  }, [report]);

  const chartMax = Math.max(...chart.map((g) => g.amount), 1);
  const chartLabel = report
    ? new Date(report.to + 'T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase()
    : '';

  const fmtCompact = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return fmtCop(n);
  };

  const handleExportExcel = async () => {
    if (!report) {
      showToast('Aún no hay datos para exportar');
      return;
    }
    const XLSX = await import('xlsx');
    const label = period === 'today' ? 'hoy' : period === 'week' ? 'semana' : 'mes';
    const periodo = `${report.from} a ${report.to}`;
    const wb = XLSX.utils.book_new();

    const resumen: (string | number)[][] = [
      ['REPORTE DE CAJA Y LIQUIDACIÓN'],
      ['Periodo', periodo],
      [],
      ['Métrica', 'Valor'],
      ['Ingresos Totales', totalRevenue],
      ['Servicios / Cortes', salesCount],
      ['Ticket Promedio', Math.round(avgTicket)],
      ['Comisiones Barberos', totalEarnings],
      ['Margen Neto Local', houseEarnings],
      [],
      ['DESGLOSE POR MÉTODO DE PAGO'],
      ['Método', 'Transacciones', 'Total'],
      ...report.byMethod.map((m) => [METHOD_LABEL[m.payment_method] ?? m.payment_method, m.count, m.total] as (string | number)[]),
      [],
      ['TOP SERVICIOS'],
      ['Servicio', 'Cantidad', 'Total'],
      ...report.topServices.map((s) => [s.service_name, s.count, s.total] as (string | number)[]),
      [],
      ['TOP BARBEROS'],
      ['Barbero', 'Cantidad', 'Total'],
      ...report.topBarbers.map((b) => [b.name, b.sales_count, b.total] as (string | number)[]),
    ];

    const liq: (string | number)[][] = [
      ['LIQUIDACIÓN POR BARBERO'],
      ['Periodo', periodo],
      [],
      ['Barbero', 'Servicios', 'Ingresos Generados', 'Comisión', 'Propinas'],
      ...(commReport?.byBarber ?? []).map(
        (b) => [b.name, b.sales_count, b.revenue, b.earnings, b.tips] as (string | number)[],
      ),
    ];

    const dayRows: (string | number)[][] = [
      ['VENTAS POR DÍA'],
      ['Periodo', periodo],
      [],
      ['Día', 'Ventas', 'Ingresos'],
      ...report.byDay.map((d) => [d.day, d.sales_count, d.total] as (string | number)[]),
    ];

    const sheetResumen = XLSX.utils.aoa_to_sheet(resumen);
    sheetResumen['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }];
    const sheetLiq = XLSX.utils.aoa_to_sheet(liq);
    sheetLiq['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];
    const sheetDays = XLSX.utils.aoa_to_sheet(dayRows);
    sheetDays['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }];

    XLSX.utils.book_append_sheet(wb, sheetResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, sheetLiq, 'Liquidación');
    XLSX.utils.book_append_sheet(wb, sheetDays, 'Detalle Diario');
    XLSX.writeFile(wb, `reporte-finanzas-${label}-${report.to}.xlsx`);
    showToast(`Excel descargado (${report.from} a ${report.to})`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Finanzas"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 max-w-5xl mx-auto">
          {/* Header & Period Switcher */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-headline-lg-mobile text-2xl text-[#0f172a] font-bold">Reportes y Finanzas</h1>
                <p className="font-body-sm text-xs text-[#64748b]">Rendimiento económico y flujo de caja</p>
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">file_download</span>
                <span>Excel</span>
              </button>
            </div>

            {/* Period Pills */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPeriod('today')}
                className={`flex-1 py-1.5 rounded-lg font-label-md text-xs transition cursor-pointer ${
                  period === 'today'
                    ? 'bg-[#8d4b00] text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setPeriod('week')}
                className={`flex-1 py-1.5 rounded-lg font-label-md text-xs transition cursor-pointer ${
                  period === 'week'
                    ? 'bg-[#8d4b00] text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`flex-1 py-1.5 rounded-lg font-label-md text-xs transition cursor-pointer ${
                  period === 'month'
                    ? 'bg-[#8d4b00] text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Este Mes
              </button>
            </div>

            {error && <p className="text-center text-xs text-slate-400">No se pudieron cargar los datos: {error}</p>}
          </div>

          {/* Core Balance Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
              <span className="font-label-md text-xs text-slate-500">Ingresos Totales</span>
              <span className="font-currency-metric text-2xl text-slate-900 font-bold mt-1">
                {loading ? '…' : fmtCop(totalRevenue)}
              </span>
              <span className="font-label-caps text-[10px] text-emerald-600 font-bold mt-0.5">
                {loading ? 'Cargando…' : deltaLabel}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
              <span className="font-label-md text-xs text-slate-500">Cortes / Servicios</span>
              <span className="font-currency-metric text-2xl text-slate-900 font-bold mt-1">
                {loading ? '…' : salesCount}
              </span>
              <span className="font-label-caps text-[10px] text-slate-500 font-semibold mt-0.5">
                Ticket prom: {loading ? '…' : fmtCop(Math.round(avgTicket))}
              </span>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 flex flex-col justify-between">
              <span className="font-label-md text-xs text-[#8d4b00] font-semibold">Comisiones Barberos</span>
              <span className="font-currency-metric text-2xl text-[#8d4b00] font-bold mt-1">
                {loading ? '…' : fmtCop(totalEarnings)}
              </span>
              <span className="font-label-caps text-[10px] text-amber-800 font-bold mt-0.5">
                {loading ? 'Cargando…' : `${Math.round(commissionPct)}% promedio`}
              </span>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
              <span className="font-label-md text-xs text-[#006c49] font-semibold">Margen Neto Local</span>
              <span className="font-currency-metric text-2xl text-[#006c49] font-bold mt-1">
                {loading ? '…' : fmtCop(houseEarnings)}
              </span>
              <span className="font-label-caps text-[10px] text-emerald-800 font-bold mt-0.5">
                {loading ? 'Cargando…' : `${Math.round(housePct)}% caja limpia`}
              </span>
            </div>
          </div>

          {/* Weekly Flow Chart */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-base text-[#0f172a] font-bold">Ventas por Semana</h2>
              <span className="font-label-caps text-[11px] text-slate-400 font-bold">{chartLabel || '—'}</span>
            </div>

            <div className="flex items-end justify-between gap-3 h-36 pt-4 px-2">
              {loading ? (
                <p className="text-xs text-slate-400 text-center w-full">Cargando ventas…</p>
              ) : chart.length === 0 ? (
                <p className="text-xs text-slate-400 text-center w-full">Sin ventas en el periodo</p>
              ) : (
                chart.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="font-label-md text-[10px] text-slate-500 font-bold">{fmtCompact(item.amount)}</span>
                    <div
                      className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
                      style={{ height: `${Math.max((item.amount / chartMax) * 100, 8)}%` }}
                    />
                    <span className="font-label-md text-[11px] text-slate-600">{item.label}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Top Services by Revenue */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
            <h3 className="font-headline-md text-base text-[#0f172a] font-bold">Servicios Más Rentables</h3>
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                <p className="text-center text-xs text-slate-400 py-4">Cargando servicios…</p>
              ) : !report || report.topServices.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">Sin servicios vendidos en el periodo</p>
              ) : (
                report.topServices.map((s) => (
                  <div key={s.service_name} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-label-lg text-xs font-bold text-slate-900 block">{s.service_name}</span>
                      <span className="font-body-sm text-[11px] text-slate-400">{s.count} servicios realizados</span>
                    </div>
                    <div className="text-right">
                      <span className="font-headline-md text-sm text-slate-900 font-bold">{fmtCopCOP(s.total)}</span>
                      <span className="font-label-caps text-[10px] text-emerald-600 block">
                        {((s.total / totalRevenue) * 100).toFixed(1)}% del total
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Top Barbers by Revenue */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
            <h3 className="font-headline-md text-base text-[#0f172a] font-bold">Top Barberos</h3>
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                <p className="text-center text-xs text-slate-400 py-4">Cargando barberos…</p>
              ) : !report || report.topBarbers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">Sin ventas de barberos en el periodo</p>
              ) : (
                report.topBarbers.map((b) => (
                  <div key={b.name} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-label-lg text-xs font-bold text-slate-900 block">{b.name}</span>
                      <span className="font-body-sm text-[11px] text-slate-400">{b.sales_count} servicios realizados</span>
                    </div>
                    <div className="text-right">
                      <span className="font-headline-md text-sm text-slate-900 font-bold">{fmtCopCOP(b.total)}</span>
                      <span className="font-label-caps text-[10px] text-emerald-600 block">
                        {((b.total / totalRevenue) * 100).toFixed(1)}% del total
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Payment Methods */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2 mb-6">
            <h3 className="font-headline-md text-base text-[#0f172a] font-bold">Métodos de Pago</h3>
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                <p className="text-center text-xs text-slate-400 py-4">Cargando métodos…</p>
              ) : !report || report.byMethod.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">Sin pagos en el periodo</p>
              ) : (
                report.byMethod.map((m) => (
                  <div key={m.payment_method} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-label-lg text-xs font-bold text-slate-900 block">
                        {METHOD_LABEL[m.payment_method] ?? m.payment_method}
                      </span>
                      <span className="font-body-sm text-[11px] text-slate-400">{m.count} transacciones</span>
                    </div>
                    <div className="text-right">
                      <span className="font-headline-md text-sm text-slate-900 font-bold">{fmtCopCOP(m.total)}</span>
                      <span className="font-label-caps text-[10px] text-emerald-600 block">
                        {((m.total / totalRevenue) * 100).toFixed(1)}% del total
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {toastMsg && (
          <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
          </div>
        )}
      </main>

      {/* Nav matching xpath:
          //nav//a[@data-path='dashboard']
          //nav//a[@data-path='agenda']
          //nav//a[@data-path='caja']
          //nav//a[@data-path='mas']
      */}
      <BottomNav
        activeTab="mas"
        cajaPathVariant="caja"
        masPathVariant="mas"
        onNavigate={onNavigate}
      />
    </div>
  );
};