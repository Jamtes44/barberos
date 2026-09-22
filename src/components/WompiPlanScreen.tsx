import React, { useCallback, useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import {
  api,
  apiMembership,
  apiShop,
  apiServices,
  apiBarbers,
  Membership,
  MembershipCheckout,
  ApiError,
  saveSession,
} from '../services/api';

interface WompiPlanScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

const PRICE = 35900;

declare global {
  interface Window {
    WidgetCheckout?: new (options: Record<string, unknown>) => { open: (cb?: () => void) => void };
  }
}

function loadWompiWidget(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-wompi-widget]') || window.WidgetCheckout) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.wompi.co/widget.js';
    s.dataset.wompiWidget = 'true';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el widget de pagos de Wompi'));
    document.head.appendChild(s);
  });
}

function parseCop(value: string): number {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function fmtCop(n: number): string {
  return `$${n.toLocaleString('es-CO')}`;
}

export const WompiPlanScreen: React.FC<WompiPlanScreenProps> = ({ onNavigate, onBack }) => {
  // Estado de membresía
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'trial' | 'pay' | 'save' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Onboarding rápido (opcional): primer servicio + primer barbero
  const [serviceName, setServiceName] = useState('Corte Clásico Degradé + Barba');
  const [durationMin, setDurationMin] = useState('45');
  const [servicePrice, setServicePrice] = useState('35000');
  const [barberName, setBarberName] = useState('');
  const [commission, setCommission] = useState(50);

  const refresh = useCallback(async () => {
    try {
      const m = await apiMembership.get();
      setMembership(m);
      const shop = await apiShop.get();
      const token = api.token();
      const user = api.user();
      if (token && user) saveSession(token, user, shop);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudo consultar la membresía');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasStartedTrial = Boolean(membership?.trialStartedAt);

  const handleStartTrial = async () => {
    setErrorMessage(null);
    setNotice(null);
    setWorking('trial');
    try {
      const m = await apiMembership.trial();
      setMembership(m);
      setNotice(`Prueba gratis iniciada: activa por ${m.trialDays} días. A partir del día ${m.reminderFromDay} te recordaremos la membresía.`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudo activar la prueba gratis');
    } finally {
      setWorking(null);
    }
  };

  const saveOnboarding = async () => {
    const created: string[] = [];
    const name = serviceName.trim();
    const price = parseCop(servicePrice);
    const duration = parseCop(durationMin) || 45;
    if (name && price > 0) {
      try {
        await apiServices.create({
          name,
          price,
          duration_minutes: duration,
          commission_rate: commission,
          category: 'cortes',
        });
        created.push('servicio');
      } catch {
        // Se continua aunque el servicio opcional falle
      }
    }
    const bName = barberName.trim();
    if (bName) {
      try {
        await apiBarbers.create({
          name: bName,
          chair: '1',
          commissionScheme: 'percentage',
          commissionValue: commission,
        });
        created.push('barbero');
      } catch {
        // Opcional
      }
    }
    return created;
  };

  const handlePay = async () => {
    setErrorMessage(null);
    setNotice(null);
    setWorking('pay');
    try {
      const created = await saveOnboarding();
      if (created.length) setNotice(`Listo: ${created.join(' y ')} configurado(s).`);

      const checkout = await apiMembership.checkout();
      if (!checkout.wompi) {
        setErrorMessage(
          'La pasarela de pagos no está configurada aún. Pídele al administrador las llaves de Wompi para activar el cobro.',
        );
        setWorking(null);
        return;
      }
      await loadWompiWidget();
      if (!window.WidgetCheckout) throw new Error('Widget de Wompi no disponible');
      const widget = new window.WidgetCheckout({
        currency: checkout.wompi.currency,
        amountInCents: checkout.wompi.amountInCents,
        reference: checkout.wompi.reference,
        publicKey: checkout.wompi.publicKey,
        redirectUrl: checkout.wompi.redirectUrl,
        ...(checkout.wompi.acceptanceToken ? { acceptanceToken: checkout.wompi.acceptanceToken } : {}),
      });
      widget.open(() => {
        setNotice('Pago enviado. Apenas el banco lo confirme, tu membresía se activa automáticamente.');
        void refresh();
      });
      setWorking(null);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : 'No se pudo iniciar el pago. Revisa tu conexión e inténtalo de nuevo.',
      );
      setWorking(null);
    }
  };

  const handleTestPay = async () => {
    setErrorMessage(null);
    setNotice(null);
    setWorking('pay');
    try {
      await apiMembership.testPay('');
      setNotice(`Membresía activada en modo prueba (simulación de pago aprobado).`);
      setMembership(await apiMembership.get());
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudo simular el pago');
    } finally {
      setWorking(null);
    }
  };

  const handleEnter = async () => {
    setErrorMessage(null);
    setNotice(null);
    setWorking('save');
    try {
      await saveOnboarding();
      onNavigate('owner_dashboard', 'push');
    } catch {
      onNavigate('owner_dashboard', 'push');
    } finally {
      setWorking(null);
    }
  };

  const status = membership?.status ?? 'trial';
  const blocked = membership?.blocked ?? false;
  const trialActive = status === 'trial';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      <main className="flex-1 flex flex-col relative w-full bg-[#f8fafc] max-w-md mx-auto">
        <div className="flex flex-col w-full px-4 pb-12 gap-y-4 text-[#0f172a]">
          {/* Top back navigation */}
          <div className="flex items-center justify-between pt-3">
            <button
              type="button"
              id="btn-wompi-back"
              onClick={onBack || (() => onNavigate('register_shop', 'push_back'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-md text-xs font-semibold cursor-pointer active:scale-95 transition-all border border-slate-200"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Volver</span>
            </button>
            <span className="font-label-caps text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-200">
              Último paso
            </span>
          </div>

          {/* Header */}
          <div className="flex flex-col gap-y-1">
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-[#f59e0b] h-full rounded-full w-full transition-all duration-500" />
            </div>
            <h1 className="font-headline-lg-mobile text-[26px] text-[#0f172a] tracking-tight font-bold mt-2">
              Elige tu plan
            </h1>
            <p className="font-body-sm text-xs text-[#64748b]">
              Prueba gratis de 7 días y luego $35.900/mes para tu barbería sin límites.
            </p>
          </div>

          {/* Emblem */}
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm mx-auto">
            <span className="material-symbols-outlined text-amber-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              content_cut
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-xs">
              OS
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <span className="w-8 h-8 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
              <span className="font-body-sm text-xs">Consultando tu membresía...</span>
            </div>
          ) : (
            <>
              {/* Plan / estado de membresía */}
              <section
                className={`rounded-xl p-4 border shadow-sm flex flex-col gap-y-2 ${
                  blocked
                    ? 'bg-rose-50 border-rose-200'
                    : status === 'active'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-gradient-to-br from-amber-50/70 via-white to-slate-50 border-amber-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`material-symbols-outlined text-[22px] ${
                        blocked ? 'text-rose-600' : status === 'active' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      workspace_premium
                    </span>
                    <span className="font-label-caps text-xs tracking-widest font-bold text-[#0f172a]">
                      {status === 'active'
                        ? 'MEMBRESÍA ACTIVA'
                        : blocked
                          ? 'CUENTA BLOQUEADA'
                          : 'PLAN ILIMITADO BARBERÍA'}
                    </span>
                  </div>
                  <span className="bg-[#0f172a] text-white font-label-caps text-xs px-2.5 py-0.5 rounded shadow-xs font-bold">
                    {fmtCop(PRICE)}/mes
                  </span>
                </div>

                {status === 'active' && (
                  <div className="text-xs text-emerald-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>
                      Activa hasta{' '}
                      <strong>
                        {membership!.activeUntil
                          ? new Date(membership!.activeUntil).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : '30 días'}
                      </strong>
                    </span>
                  </div>
                )}

                {blocked && (
                  <div className="text-xs text-rose-700 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0">block</span>
                    <span>
                      Tu prueba gratis venció y no se recibió el pago. La cuenta está temporalmente
                      bloqueada: paga {fmtCop(PRICE)} para reactivar tu barbería.
                    </span>
                  </div>
                )}

                {trialActive && !hasStartedTrial && (
                  <div className="text-xs text-slate-600">
                    Activa tu prueba gratis de <strong>7 días</strong>, con recordatorios desde el día 3
                    para que no pierdas tu membresía.
                  </div>
                )}

                {trialActive && hasStartedTrial && (
                  <div className="flex flex-col gap-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Prueba gratis</span>
                      <span className="font-bold text-[#0f172a]">
                        {membership!.daysLeft > 0
                          ? `quedan ${membership!.daysLeft} día${membership!.daysLeft === 1 ? '' : 's'}`
                          : 'termina hoy'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (membership!.daysLeft / membership!.trialDays) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      A partir del día {membership!.reminderFromDay} te recordamos diario por WhatsApp.
                    </p>
                  </div>
                )}
              </section>

              {/* Onboarding rápido (opcional) */}
              <>
                <section className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-[#b45309] flex items-center justify-center font-label-caps text-xs font-bold">
                        1
                      </div>
                      <h2 className="font-headline-md text-xl text-[#0f172a] tracking-tight font-bold">
                        Opcional: tu primer servicio
                      </h2>
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <label className="font-label-md text-xs text-[#64748b] font-medium">Nombre</label>
                      <input
                        type="text"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        className="w-full h-12 bg-white text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] shadow-sm"
                        placeholder="Ej. Fade Clásico"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-2">
                      <div className="flex flex-col gap-y-1">
                        <label className="font-label-md text-xs text-[#64748b] font-medium">Duración (min)</label>
                        <input
                          type="number"
                          value={durationMin}
                          onChange={(e) => setDurationMin(e.target.value)}
                          className="w-full h-12 bg-white text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] shadow-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-y-1">
                        <label className="font-label-md text-xs text-[#64748b] font-medium">Precio (COP)</label>
                        <input
                          type="number"
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                          className="w-full h-12 bg-white text-[#b45309] border border-slate-300 rounded-lg px-3 font-body-md text-sm font-bold focus:outline-none focus:border-[#f59e0b] shadow-sm"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-[#b45309] flex items-center justify-center font-label-caps text-xs font-bold">
                        2
                      </div>
                      <h2 className="font-headline-md text-xl text-[#0f172a] tracking-tight font-bold">
                        Opcional: tu primer barbero
                      </h2>
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <label className="font-label-md text-xs text-[#64748b] font-medium">Nombre</label>
                      <input
                        type="text"
                        value={barberName}
                        onChange={(e) => setBarberName(e.target.value)}
                        className="w-full h-12 bg-white text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] shadow-sm"
                        placeholder="Nombre del barbero (silla 1)"
                      />
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <div className="flex justify-between items-center">
                        <label className="font-label-md text-xs text-[#64748b] font-medium">Comisión</label>
                        <span className="font-label-caps text-xs text-[#b45309] font-bold">{commission}%</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                        {[40, 50, 60, 70].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCommission(val)}
                            className={`flex-1 py-2 rounded font-label-caps text-xs font-bold transition cursor-pointer ${
                              commission === val
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-50'
                            }`}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
</>

              {/* Pago */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-md text-base text-[#0f172a] font-bold">
                    {blocked ? 'Reactivar cuenta' : 'Pago de membresía'}
                  </h3>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-label-caps text-[11px] font-bold">
                    Wompi · 256-bit SSL
                  </span>
                </div>
                <p className="font-body-sm text-xs text-[#64748b]">
                  Un solo pago de <strong className="text-[#0f172a]">{fmtCop(PRICE)} / mes</strong> con
                  Nequi, PSE o tarjeta. Sin permanencia.
                </p>

                {notice && (
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">check_circle</span>
                    <span className="font-body-sm text-xs text-emerald-800">{notice}</span>
                  </div>
                )}
                {errorMessage && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0">error</span>
                    <span className="font-body-sm text-xs text-rose-700">{errorMessage}</span>
                  </div>
                )}

                {!hasStartedTrial && trialActive && (
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={handleStartTrial}
                    className="w-full h-[54px] bg-[#f59e0b] hover:bg-amber-500 text-white font-label-caps text-lg rounded-xl font-bold tracking-wide flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {working === 'trial' ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Activando prueba gratis...</span>
                      </>
                    ) : (
                      <>
                        <span>Activar 7 días gratis</span>
                        <span className="material-symbols-outlined text-[22px]">bolt</span>
                      </>
                    )}
                  </button>
                )}

                {(hasStartedTrial || !trialActive) && (
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={handlePay}
                    className="w-full h-[54px] bg-[#f59e0b] hover:bg-amber-500 text-white font-label-caps text-lg rounded-xl font-bold tracking-wide flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {working === 'pay' ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Procesando pago Wompi...</span>
                      </>
                    ) : (
                      <>
                        <span>{blocked ? `Pagar ${fmtCop(PRICE)} y reactivar` : `Pagar ${fmtCop(PRICE)} / mes`}</span>
                        <span className="material-symbols-outlined text-[22px]">lock</span>
                      </>
                    )}
                  </button>
                )}

                {membership?.testPayAvailable && (
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={handleTestPay}
                    className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-label-md text-xs font-semibold cursor-pointer active:scale-[0.99] transition"
                  >
                    Simular pago aprobado (modo prueba)
                  </button>
                )}

                <a
                  href="#enter"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleEnter();
                  }}
                  className="w-full py-2.5 text-center font-label-lg text-sm text-[#64748b] hover:text-[#0f172a] transition-colors flex items-center justify-center gap-1 font-semibold cursor-pointer"
                >
                  {working === 'save' ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Entrar y completar después</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </>
                  )}
                </a>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};