import React, { useCallback, useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { apiSales, apiReports, apiServices, apiBarbers, apiAppointments, Appointment, Barber } from '../services/api';

interface SalesCashScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

interface ServiceItem {
  id: string;
  name: string;
  price: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtCOP = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const PENDING_TURN_KEY = 'barberos_pending_turn';
const readPendingTurn = (): string | null => {
  try {
    return localStorage.getItem(PENDING_TURN_KEY);
  } catch {
    return null;
  }
};
const clearPendingTurn = () => {
  try {
    localStorage.removeItem(PENDING_TURN_KEY);
  } catch {
    // Ignore
  }
};

const METHOD_LABEL: Record<string, { label: string; color: string; badge: string }> = {
  efectivo: { label: 'Efectivo', color: 'text-emerald-700', badge: 'bg-emerald-100 text-[#006c49]' },
  nequi: { label: 'Nequi/Davi', color: 'text-[#de1484]', badge: 'bg-pink-100 text-[#de1484]' },
  tarjeta: { label: 'Tarjeta', color: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  caja_central: { label: 'Caja Central', color: 'text-slate-600', badge: 'bg-slate-100 text-slate-600' },
};

export const SalesCashScreen: React.FC<SalesCashScreenProps> = ({ onNavigate, onBack }) => {
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'nequi' | 'tarjeta'>('efectivo');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [sales, setSales] = useState<ReturnType<typeof apiSales.list> extends Promise<infer T> ? T : never>([]);
  const [summary, setSummary] = useState<{
    total: number;
    byMethod: Array<{ payment_method: string; count: number; total: number; tips: number }>;
  } | null>(null);
  const [kpis, setKpis] = useState<{ barberEarnings: number; houseEarnings: number; salesCount: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = localDate(new Date());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const load = useCallback(async () => {
    try {
      const [srv, barb, salesList, sum, k, apts] = await Promise.all([
        apiServices.list(),
        apiBarbers.list(),
        apiSales.list({ from: today, to: today }),
        apiSales.summary(today),
        apiReports.kpis(today),
        apiAppointments.list({ from: today, to: today }),
      ]);
      const activeServices = srv
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: s.name, price: Number(s.price) }));
      setServices(activeServices);
      setBarbers(barb.filter((b) => b.active));
      setSales(salesList);
      setSummary(sum);
      setAppointments(apts);
      setKpis({ barberEarnings: k.barberEarnings, houseEarnings: k.houseEarnings, salesCount: k.salesCount });

      const pending = readPendingTurn();
      if (pending) {
        const match = apts.find(
          (a) =>
            a.id === pending &&
            (a.status === 'en_corte' || a.status === 'confirmada' || a.status === 'pendiente'),
        );
        if (match) {
          setSelectedApptId(match.id);
          if (match.barber_id) setSelectedBarber(match.barber_id);
          const srvMatch = activeServices.find(
            (s) => s.name.toLowerCase() === (match.service_name || '').toLowerCase(),
          );
          if (srvMatch) setSelectedService(srvMatch.id);
        }
        clearPendingTurn();
      }
    } catch {
      // Sin sesión
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedServiceObj = services.find((s) => s.id === selectedService) || null;
  const selectedAppt = appointments.find((a) => a.id === selectedApptId) || null;
  const liquidableApps = appointments
    .filter((a) => a.status === 'en_corte' || a.status === 'confirmada' || a.status === 'pendiente')
    .sort((a, b) =>
      a.status === b.status
        ? a.start_at.localeCompare(b.start_at)
        : a.status === 'en_corte'
          ? -1
          : 1,
    );
  const totalTransacciones = summary?.byMethod.reduce((acc, m) => acc + m.count, 0) || 0;

  const handleSelectAppointment = (apt: Appointment) => {
    setSelectedApptId(apt.id);
    if (apt.barber_id) setSelectedBarber(apt.barber_id);
    if (!selectedService) {
      const match = services.find((s) => s.name.toLowerCase() === (apt.service_name || '').toLowerCase());
      if (match) setSelectedService(match.id);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selectedServiceObj) {
      showToast('Selecciona un servicio');
      return;
    }
    setSaving(true);
    try {
      await apiSales.create({
        barberId: selectedBarber ?? selectedAppt?.barber_id ?? undefined,
        clientName: selectedAppt?.client_name ?? 'Cliente en sala',
        appointmentId: selectedAppt?.id,
        items: [{ serviceId: selectedServiceObj.id, qty: 1 }],
        paymentMethod,
        tip: 0,
      });
      showToast(
        selectedAppt
          ? `Cobro registrado: ${fmtCOP(selectedServiceObj.price)} COP · ${selectedAppt.client_name} marcado completado en la agenda`
          : `Cobro registrado con éxito: ${fmtCOP(selectedServiceObj.price)} COP`,
      );
      setSelectedService(null);
      setSelectedApptId(null);
      clearPendingTurn();
      window.dispatchEvent(new Event('agenda-changed'));
      load();
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const totalRecaudado = summary?.total || 0;

  const handleExportArqueo = async () => {
    if (!summary || (sales.length === 0 && totalRecaudado === 0)) {
      showToast('Aún no hay movimientos para exportar el arqueo');
      return;
    }
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const fechaLabel = new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const arqueo: (string | number)[][] = [
      ['ARQUEO DE CAJA EN VIVO'],
      ['Fecha', fechaLabel],
      [],
      ['RESUMEN FINANCIERO'],
      ['Total Recaudado', totalRecaudado],
      ['Transacciones', totalTransacciones],
      ['Comisión Barberos', kpis?.barberEarnings ?? 0],
      ['Caja Neta Local', kpis?.houseEarnings ?? 0],
      [],
      ['DESGLOSE POR MÉTODO DE PAGO'],
      ['Método', 'Transacciones', 'Total', 'Propinas'],
      ...(summary?.byMethod ?? []).map(
        (m) =>
          [METHOD_LABEL[m.payment_method]?.label ?? m.payment_method, m.count, m.total, m.tips] as (string | number)[],
      ),
    ];
    const wsArqueo = XLSX.utils.aoa_to_sheet(arqueo);
    wsArqueo['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];

    const tx: (string | number)[][] = [
      ['DETALLE DE TRANSACCIONES'],
      ['Hora', 'Cliente', 'Barbero', 'Servicio', 'Método', 'Propina', 'Comisión', 'Total'],
      ...sales.map((s) => [
        new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        s.client_name ?? '—',
        s.barber_name ?? '—',
        s.items.map((i) => i.name).join(' · ') || 'Venta',
        s.payment_method,
        s.tip,
        s.barber_earnings,
        s.total,
      ]),
    ];
    const wsTx = XLSX.utils.aoa_to_sheet(tx);
    wsTx['!cols'] = [{ wch: 10 }, { wch: 26 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];

    XLSX.utils.book_append_sheet(wb, wsArqueo, 'Arqueo');
    XLSX.utils.book_append_sheet(wb, wsTx, 'Transacciones');
    XLSX.writeFile(wb, `arqueo-caja-${today}.xlsx`);
    showToast('Arqueo de Caja descargado (Excel)');
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Caja en Vivo"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 md:pb-28 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 max-w-7xl mx-auto">
          {/* Header Banner */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline-lg-mobile text-2xl text-[#0f172a] font-bold">Caja y Liquidación</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#006c49] font-label-caps text-xs font-bold">
                  Abierta
                </span>
              </div>
              <span className="font-body-sm text-xs text-[#64748b]">
                Jornada de Hoy · {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <button
              type="button"
              onClick={handleExportArqueo}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              title="Descargar Arqueo"
            >
              <span className="material-symbols-outlined text-xl">download</span>
            </button>
          </div>

          {/* 2 columnas en desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">

          {/* Columna derecha: resumen financiero */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="bg-gradient-to-br from-white via-amber-50/40 to-white rounded-2xl p-4 shadow-sm border border-amber-200/80 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-xs uppercase text-[#8d4b00] tracking-wider font-bold">
                Total Recaudado Hoy
              </span>
              <span className="font-label-md text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
                {loading ? '...' : `${totalTransacciones} Transacciones`}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-currency-metric text-4xl text-[#0f172a] tracking-tight font-bold">
                {loading ? '$0' : fmtCOP(totalRecaudado)}
              </span>
              <span className="font-headline-md text-base text-[#64748b] font-semibold">COP</span>
            </div>

            {/* Channels breakdown */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {(['efectivo', 'nequi', 'tarjeta'] as const).map((m) => {
                const meta = (summary?.byMethod || []).find((b) => b.payment_method === m);
                return (
                  <div key={m} className="flex flex-col bg-white p-2 rounded-lg border border-slate-100">
                    <span className={`font-label-md text-[11px] ${METHOD_LABEL[m].color} flex items-center gap-1 font-semibold`}>
                      <span className="material-symbols-outlined text-[14px]">{m === 'efectivo' ? 'payments' : m === 'nequi' ? 'smartphone' : 'credit_card'}</span>
                      {METHOD_LABEL[m].label}
                    </span>
                    <span className="font-headline-md text-sm text-[#0f172a] font-bold mt-1">
                      {loading ? '$0' : fmtCOP(meta?.total || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Split Comisiones vs Margen Barbercía */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#8d4b00] text-xl">pie_chart</span>
                <h3 className="font-headline-md text-lg text-[#0f172a] font-bold">Reparto de Ingresos</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('barbers_commissions', 'push')}
                className="font-label-md text-xs text-[#8d4b00] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ver Tablas y Barberos</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="font-label-caps text-xs text-[#8d4b00] font-bold">Comisiones Barberos</span>
                <span className="font-currency-metric text-2xl text-[#8d4b00] font-bold mt-1">
                  {loading ? '$0' : fmtCOP(kpis?.barberEarnings || 0)}
                </span>
                <span className="font-body-sm text-[11px] text-slate-500 mt-0.5">
                  {kpis && kpis.salesCount > 0 ? `${Math.round((kpis.barberEarnings / Math.max(1, kpis.barberEarnings + kpis.houseEarnings)) * 100)}% repartido` : 'Sin ventas hoy'}
                </span>
              </div>

              <div className="flex flex-col p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="font-label-caps text-xs text-[#006c49] font-bold">Margen Barbería</span>
                <span className="font-currency-metric text-2xl text-[#006c49] font-bold mt-1">
                  {loading ? '$0' : fmtCOP(kpis?.houseEarnings || 0)}
                </span>
                <span className="font-body-sm text-[11px] text-slate-500 mt-0.5">caja neta local</span>
              </div>
            </div>
          </section>

          </div>{/* fin col derecha */}

          {/* Columna izquierda: cobro express táctil */}
          <div className="lg:col-span-7 flex flex-col gap-4 lg:order-first">

          {/* Cobro Express Táctil */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f59e0b] text-xl">bolt</span>
                <h3 className="font-headline-md text-lg text-[#0f172a] font-bold">Cobro Rápido en Caja</h3>
              </div>
              <span className="font-label-caps text-[11px] text-[#64748b] uppercase font-bold">Terminal Táctil</span>
            </div>

            {/* Turno a liquidar (agenda) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-xs text-[#64748b] font-medium">
                  1. Cliente / turno a liquidar
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedApptId(null)}
                  className={`px-2 py-1 rounded-lg font-label-md text-[11px] font-bold transition cursor-pointer ${
                    !selectedApptId
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Walk-in / Sin cita
                </button>
              </div>
              {liquidableApps.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">
                  No hay turnos en silla o confirmados hoy
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto min-h-0 pr-0.5">
                  {liquidableApps.map((apt) => (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => handleSelectAppointment(apt)}
                      className={`p-2.5 rounded-xl text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                        selectedApptId === apt.id
                          ? 'bg-amber-50 border-2 border-amber-500'
                          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            apt.status === 'en_corte'
                              ? 'bg-amber-100 text-[#8d4b00]'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {apt.status === 'en_corte' ? (
                            <span className="material-symbols-outlined text-[16px]">content_cut</span>
                          ) : (
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <span className="font-label-lg text-xs font-bold text-[#0f172a] block truncate">
                            {apt.client_name}
                          </span>
                          <span className="font-body-sm text-[11px] text-[#64748b] block truncate">
                            {apt.service_name || 'Servicio'} ·{' '}
                            {new Date(apt.start_at).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {fmtCOP(apt.price)} COP
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-label-caps shrink-0 ${
                          apt.status === 'en_corte'
                            ? 'bg-amber-100 text-[#8d4b00]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {apt.status === 'en_corte' ? 'En silla' : apt.status === 'pendiente' ? 'Pendiente' : 'Confirmada'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Barber Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs text-[#64748b] font-medium">2. Barbero que realizó el corte</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBarber(b.id)}
                    className={`py-2 px-2 rounded-lg text-center font-label-md text-xs transition cursor-pointer ${
                      selectedBarber === b.id
                        ? 'bg-[#8d4b00] text-white font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
                {barbers.length === 0 && (
                  <p className="col-span-3 text-xs text-slate-400 text-center py-2">Aún no hay barberos activos</p>
                )}
              </div>
            </div>

            {/* Service Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs text-[#64748b] font-medium">3. Servicio ejecutado</label>
              <div className="grid grid-cols-2 gap-2">
                {services.map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setSelectedService(srv.id)}
                    className={`p-2 rounded-lg text-left transition cursor-pointer ${
                      selectedService === srv.id
                        ? 'bg-amber-50 border-2 border-amber-500'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <span className="font-label-lg text-xs font-bold text-[#0f172a] block truncate">{srv.name}</span>
                    <span className="font-currency-metric text-sm text-[#8d4b00] font-bold">{fmtCOP(srv.price)} COP</span>
                  </button>
                ))}
                {services.length === 0 && (
                  <p className="col-span-2 text-xs text-slate-400 text-center py-2">Configura servicios en "Tarifas y Servicios"</p>
                )}
              </div>
            </div>

            {/* Payment method */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs text-[#64748b] font-medium">4. Medio de pago</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`py-2 px-1 rounded-lg text-center font-label-md text-xs transition cursor-pointer ${
                    paymentMethod === 'efectivo'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('nequi')}
                  className={`py-2 px-1 rounded-lg text-center font-label-md text-xs transition cursor-pointer ${
                    paymentMethod === 'nequi'
                      ? 'bg-[#de1484] text-white font-bold'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  📲 Nequi
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('tarjeta')}
                  className={`py-2 px-1 rounded-lg text-center font-label-md text-xs transition cursor-pointer ${
                    paymentMethod === 'tarjeta'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  💳 Tarjeta
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleRegisterPayment}
              disabled={saving}
              className={`w-full h-12 mt-1 rounded-xl bg-[#f59e0b] hover:bg-amber-500 text-white font-headline-md text-lg tracking-wider uppercase font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-transform cursor-pointer ${
                saving ? 'opacity-70 pointer-events-none' : ''
              }`}
            >
              <span>Cobrar {selectedServiceObj ? `${fmtCOP(selectedServiceObj.price)} COP` : ''}</span>
              <span className="material-symbols-outlined text-xl">point_of_sale</span>
            </button>
          </section>

          {/* Historial de Caja */}
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-2 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-lg text-[#0f172a] font-bold">Flujo de Cobros Hoy</h3>
              <span className="font-body-sm text-xs text-[#64748b]">Actualizado en vivo</span>
            </div>

            <div className="flex flex-col gap-2">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-4">Cargando cobros...</p>
              ) : sales.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Aún no hay cobros registrados hoy</p>
              ) : (
                sales.map((s) => {
                  const meta = METHOD_LABEL[s.payment_method] || METHOD_LABEL.efectivo;
                  const item = s.items && s.items[0];
                  return (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${meta.badge} flex items-center justify-center font-bold text-xs`}>
                          {s.payment_method === 'efectivo' ? '$' : s.payment_method === 'nequi' ? 'N' : '💳'}
                        </div>
                        <div>
                          <span className="font-label-lg text-xs font-bold text-[#0f172a] block">
                            {item?.name || s.client_name || 'Venta'}
                          </span>
                          <span className="font-body-sm text-[11px] text-[#64748b]">
                            {s.barber_name || 'Sin barbero'} · {new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-headline-md text-sm font-bold text-[#0f172a] block">{fmtCOP(s.total)} COP</span>
                        <span className={`font-label-caps text-[10px] ${meta.color} font-semibold`}>{meta.label}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
          </div>{/* fin col izquierda */}

          </div>{/* fin grid 2 cols */}

        {toastMsg && (
          <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
          </div>
        )}
        </div>
      </main>

      <BottomNav
        activeTab="caja"
        cajaPathVariant="caja-ventas"
        masPathVariant="mas-opciones"
        onNavigate={onNavigate}
      />
    </div>
  );
};