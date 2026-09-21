import React, { useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { RegisterBarberModal } from './RegisterBarberModal';
import {
  apiReports,
  apiBarbers,
  getSessionUser,
  getToken,
  saveSession,
  Barber,
} from '../services/api';

interface BarbersCommissionsScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtCop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const SCHEME_META: Record<Barber['commission_scheme'], { label: string }> = {
  percentage: { label: 'Porcentaje' },
  fixed: { label: 'Fija por cobro' },
  none: { label: 'Sin comisión' },
};

const schemeSummary = (scheme: Barber['commission_scheme'], value: number | null): string => {
  if (scheme === 'fixed' && value !== null) return `${fmtCop(value)} /cobro`;
  if (scheme === 'percentage' && value !== null) return `${Math.round(value)}%`;
  if (scheme === 'percentage') return 'Tarifa de servicio';
  return 'Sin comisión';
};

interface BarberCommissionEditorProps {
  barber: { id: string; scheme: Barber['commission_scheme']; schemeValue: number | null };
  onSaved: () => void;
}

const BarberCommissionEditor: React.FC<BarberCommissionEditorProps> = ({ barber, onSaved }) => {
  const [scheme, setScheme] = useState<Barber['commission_scheme']>(barber.scheme);
  const [valueStr, setValueStr] = useState<string>(
    barber.schemeValue !== null ? String(barber.schemeValue) : '',
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    let value: number | null = null;
    if (scheme === 'percentage' || scheme === 'fixed') {
      const v = Number(valueStr);
      if (scheme === 'percentage' && (valueStr.trim() === '' || !Number.isFinite(v) || v < 0 || v > 100)) {
        setErr('% entre 0 y 100');
        return;
      }
      if (scheme === 'fixed' && (valueStr.trim() === '' || !Number.isFinite(v) || v <= 0)) {
        setErr('Valor fijo en COP');
        return;
      }
      value = v;
    }
    setSaving(true);
    try {
      await apiBarbers.update(barber.id, { commission_scheme: scheme, commission_value: value });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveBtn = (
    <button
      type="button"
      disabled={saving}
      onClick={handleSave}
      className="shrink-0 px-2.5 py-1 rounded-lg bg-[#8d4b00] hover:bg-amber-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
    >
      {saving ? (
        <span className="text-[11px]">…</span>
      ) : (
        <>
          <span className="material-symbols-outlined text-[12px]">save</span>
          <span>Guardar</span>
        </>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
        {(Object.keys(SCHEME_META) as Array<Barber['commission_scheme']>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setScheme(key);
              setErr(null);
            }}
            className={`py-1 rounded font-label-caps text-[10px] transition cursor-pointer font-bold truncate ${
              scheme === key ? 'bg-amber-500 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {SCHEME_META[key].label}
          </button>
        ))}
      </div>

      {scheme !== 'none' ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={valueStr}
            onChange={(e) => {
              setValueStr(e.target.value);
              setErr(null);
            }}
            placeholder={scheme === 'percentage' ? '40' : '15000'}
            className="w-full min-w-0 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
          />
          <span className="text-[10px] font-bold text-slate-400 shrink-0">
            {scheme === 'percentage' ? '%' : 'COP'}
          </span>
          {saveBtn}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] text-slate-400">Recibe solo sus propinas</span>
          {saveBtn}
        </div>
      )}

      {err && <span className="text-[10px] text-red-600 font-semibold">{err}</span>}
    </div>
  );
};

interface BarberRow {
  id: string;
  name: string;
  phone: string;
  chair: string;
  avatar: string;
  active: boolean;
  userId: string | null;
  scheme: Barber['commission_scheme'];
  schemeValue: number | null;
  sales_count: number;
  revenue: number;
  earnings: number;
  tips: number;
}

export const BarbersCommissionsScreen: React.FC<BarbersCommissionsScreenProps> = ({ onNavigate, onBack }) => {
  const today = new Date();
  const from = localDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = localDate(today);

  const [rows, setRows] = useState<BarberRow[]>([]);
  const [totalBarbers, setTotalBarbers] = useState(0);
  const [totals, setTotals] = useState<{
    totalEarnings: number;
    totalRevenue: number;
    salesCount: number;
    tips: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const sessionUser = getSessionUser();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([apiBarbers.list(), apiReports.commissions(from, to)])
      .then(([barbers, comm]) => {
        if (!active) return;
        const byBarber = new Map(comm.byBarber.map((b) => [String(b.id), b]));
        setRows(
          barbers
            .filter((b) => b.active)
            .map((b) => {
              const m = byBarber.get(String(b.id));
              return {
                id: b.id,
                name: b.name,
                phone: b.phone ?? '',
                chair: b.chair ?? 'Sin silla',
                avatar: b.avatar_url ?? '',
                active: b.active,
                userId: b.user_id,
                scheme: b.commission_scheme,
                schemeValue: b.commission_value,
                sales_count: m?.sales_count ?? 0,
                revenue: m?.revenue ?? 0,
                earnings: m?.earnings ?? 0,
                tips: m?.tips ?? 0,
              };
            }),
        );
        setTotalBarbers(barbers.length);
        setTotals({
          totalEarnings: comm.totalEarnings,
          totalRevenue: comm.totalRevenue,
          salesCount: comm.byBarber.reduce((acc, b) => acc + b.sales_count, 0),
          tips: comm.byBarber.reduce((acc, b) => acc + b.tips, 0),
        });
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
  }, [from, to, refreshKey]);

  const handleBarberCreated = (created?: { isAdmin?: boolean; barberId?: string }) => {
    setShowRegisterModal(false);
    if (created?.isAdmin && created.barberId) {
      const token = getToken();
      const user = getSessionUser();
      if (token && user) {
        saveSession(token, { ...user, barberId: created.barberId }, undefined);
        showToast('Ahora trabajas también como barbero (admin vinculado)');
      }
    } else {
      showToast('Barbero registrado correctamente');
    }
    setRefreshKey((k) => k + 1);
  };

  const activePct = totalBarbers > 0 ? Math.round((rows.length / totalBarbers) * 100) : 0;
  const corteLabel = today.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  const rangeLabel = `${new Date(from + 'T00:00:00').toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  })} – ${new Date(to + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Comisiones"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 max-w-4xl mx-auto">
          {/* Header Card */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-headline-lg-mobile text-2xl text-[#0f172a] font-bold">Barberos y Comisiones</h1>
              <p className="font-body-sm text-xs text-[#64748b]">Reglas de liquidación y nómina quincenal</p>
            </div>
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="px-3 py-2 rounded-xl bg-[#8d4b00] hover:bg-amber-800 text-white font-label-md text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span>+ Nuevo</span>
            </button>
          </div>

          {error && <p className="text-center text-xs text-slate-400">No se pudieron cargar los datos: {error}</p>}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100">
              <span className="font-label-md text-xs text-slate-500">Barberos Activos</span>
              <span className="font-currency-metric text-2xl text-slate-900 font-bold block mt-1">
                {loading ? '…' : `${rows.length} en Turno`}
              </span>
              <span className="font-body-sm text-[11px] text-emerald-600 font-semibold">
                {loading ? 'Cargando…' : `${activePct}% operatividad`}
              </span>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <span className="font-label-md text-xs text-[#8d4b00]">Comisiones por Pagar</span>
              <span className="font-currency-metric text-2xl text-[#8d4b00] font-bold block mt-1">
                {loading ? '…' : fmtCop(totals?.totalEarnings ?? 0)}
              </span>
              <span className="font-body-sm text-[11px] text-amber-800 font-semibold">Corte al {corteLabel}</span>
            </div>
          </div>

          {/* Barbers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              <p className="col-span-full text-center text-xs text-slate-400 py-8">Cargando barberos…</p>
            ) : rows.length === 0 ? (
              <p className="col-span-full text-center text-xs text-slate-400 py-8">Sin barberos activos</p>
            ) : (
              rows.map((barber) => {
                const myCommission = barber.earnings;
                const shopCut = barber.revenue - myCommission;

                return (
                  <div
                    key={barber.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {barber.avatar ? (
                          <img
                            className="w-12 h-12 rounded-xl object-cover border border-amber-500/40 shrink-0"
                            alt={barber.name}
                            src={barber.avatar}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl border border-amber-500/40 bg-slate-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl text-slate-400">content_cut</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="font-headline-md text-base text-slate-900 font-bold truncate">{barber.name}</h2>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-label-caps text-[10px] text-slate-600 font-semibold shrink-0">
                              {barber.chair}
                            </span>
                            {sessionUser && barber.userId === sessionUser.id && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-[#8d4b00] font-label-caps text-[9px] font-bold uppercase flex items-center gap-0.5 shrink-0">
                                <span className="material-symbols-outlined text-[10px]">verified_user</span>
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="font-body-sm text-xs text-slate-500 block truncate">{barber.phone}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-label-caps text-[11px] font-bold flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        En Turno
                      </span>
                    </div>

                    {/* Commission Scheme Editor */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-xs text-slate-500">Esquema de Comisión</span>
                        <span className="font-label-caps text-xs text-[#8d4b00] font-bold">
                          {schemeSummary(barber.scheme, barber.schemeValue)}
                        </span>
                      </div>
                      <BarberCommissionEditor
                        key={barber.id}
                        barber={{ id: barber.id, scheme: barber.scheme, schemeValue: barber.schemeValue }}
                        onSaved={() => {
                          setRefreshKey((k) => k + 1);
                          showToast(`Comisión de ${barber.name} actualizada`);
                        }}
                      />
                    </div>

                    {/* Financial Metrics Split */}
                    <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <div className="min-w-0">
                        <span className="font-label-md text-[10px] text-slate-400 block leading-tight">Producido</span>
                        <span className="font-currency-metric text-xs text-slate-900 font-bold block mt-0.5 leading-none truncate">
                          {fmtCop(barber.revenue)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-label-md text-[10px] text-amber-700 block leading-tight">Comisión Barbero</span>
                        <span className="font-currency-metric text-xs text-[#8d4b00] font-bold block mt-0.5 leading-none truncate">
                          {fmtCop(myCommission)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-label-md text-[10px] text-emerald-700 block leading-tight">Caja Barbería</span>
                        <span className="font-currency-metric text-xs text-emerald-700 font-bold block mt-0.5 leading-none truncate">
                          {fmtCop(shopCut)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <span className="font-label-md text-[10px] text-slate-400">{barber.sales_count} servicios</span>
                      <span className="font-label-md text-[10px] text-slate-400">Propinas: {fmtCop(barber.tips)}</span>
                    </div>

                    {/* Liquidate button */}
                    <button
                      type="button"
                      onClick={() => showToast(`Liquidación generada para ${barber.name}`)}
                      className="w-full h-auto min-h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-label-md text-xs font-bold flex items-center justify-center gap-1.5 px-2 py-2 transition-colors cursor-pointer flex-wrap"
                    >
                      <span className="material-symbols-outlined text-sm">receipt</span>
                      <span>Liquidar Quincena ({fmtCop(myCommission)} COP)</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-base text-[#0f172a] font-bold">Totales del Periodo</h3>
              <span className="font-label-caps text-[11px] text-slate-400 font-bold">{rangeLabel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="flex flex-col items-center gap-0.5 bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <span className="font-label-md text-[10px] text-slate-400">Servicios</span>
                <span className="font-currency-metric text-lg text-slate-900 font-bold">
                  {loading ? '…' : (totals?.salesCount ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <span className="font-label-md text-[10px] text-slate-400">Producido</span>
                <span className="font-currency-metric text-lg text-slate-900 font-bold">
                  {loading ? '…' : fmtCop(totals?.totalRevenue ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <span className="font-label-md text-[10px] text-[#8d4b00]">Comisiones</span>
                <span className="font-currency-metric text-lg text-[#8d4b00] font-bold">
                  {loading ? '…' : fmtCop(totals?.totalEarnings ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <span className="font-label-md text-[10px] text-slate-400">Propinas</span>
                <span className="font-currency-metric text-lg text-slate-900 font-bold">
                  {loading ? '…' : fmtCop(totals?.tips ?? 0)}
                </span>
              </div>
            </div>
          </div>
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

      <RegisterBarberModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onCreated={handleBarberCreated}
      />
    </div>
  );
};