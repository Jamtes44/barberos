import React, { useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { api, apiShop, getSessionShop, saveSession } from '../services/api';

interface WompiPlanScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

export const WompiPlanScreen: React.FC<WompiPlanScreenProps> = ({ onNavigate, onBack }) => {
  const [commission, setCommission] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState<'nequi' | 'pse' | 'card'>('nequi');
  const [nequiPhone, setNequiPhone] = useState('312 849 2041');
  const [serviceName, setServiceName] = useState('Corte Clásico Degradé + Barba');
  const [duration, setDuration] = useState('45 min');
  const [servicePrice, setServicePrice] = useState('$ 35.000 COP');
  const [barberName, setBarberName] = useState("Mateo 'Blade' Castro");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePayAndActivate = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      let shop = getSessionShop();
      let currentSettings = shop?.settings ?? {};
      if (!shop) {
        shop = await apiShop.get();
        currentSettings = shop?.settings ?? {};
      }
      const merged = {
        ...currentSettings,
        plan: {
          id: 'ilimitado_barberia',
          name: 'Plan Ilimitado Barbería',
          price: 35900,
          period: 'mensual' as const,
        },
      };
      const updated = await apiShop.update({ settings: merged });
      const token = api.token();
      const user = api.user();
      if (token && user) {
        saveSession(token, user, updated);
      }
      setIsProcessing(false);
      onNavigate('owner_dashboard', 'push');
    } catch {
      setIsProcessing(false);
      setErrorMessage('No pudimos guardar tu plan. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      <main className="flex-1 flex flex-col relative w-full bg-[#f8fafc] max-w-md mx-auto">
        <div className="flex flex-col w-full px-4 pb-12 gap-y-4 text-[#0f172a]">
          {/* Top back navigation button */}
          <div className="flex items-center justify-between pt-3">
            <button
              type="button"
              id="btn-wompi-back"
              onClick={onBack || (() => onNavigate('register_shop', 'push_back'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-md text-xs font-semibold cursor-pointer active:scale-95 transition-all border border-slate-200"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Volver a Paso 1</span>
            </button>
            <span className="font-label-caps text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-200">
              Paso 2 de 2
            </span>
          </div>

          {/* Progress Bar & Stage Indicator */}
          <div className="flex flex-col gap-y-1">
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-[#f59e0b] h-full rounded-full w-full transition-all duration-500" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <h1 className="font-headline-lg-mobile text-[26px] text-[#0f172a] tracking-tight font-bold">Configuración Express</h1>
              <span className="font-label-md text-xs px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[#b45309] font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Wompi Live
              </span>
            </div>
            <p className="font-body-sm text-xs text-[#64748b]">
              Configura tu operación inicial y activa tu estación de corte en menos de 2 minutos.
            </p>
          </div>

          {/* Visual Craft Showcase Context */}
          <div className="relative w-full h-24 rounded-xl overflow-hidden shadow-sm border border-slate-200">
            <img
              className="w-full h-full object-cover"
              alt="Close up shot of polished stainless steel barber shears and textured amber pomade jar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD49famXnnP2igvk2JTcZAbY1mw4Ls3eUQsxSH02q0O3eHXjrpwKWxDTD3e69ejazAleJkW5-4WjnJRm34speEPATWctChs50R6esnq77nQVj2xieRkSmTiZJFR2aCXjy4Hl69drUGRMKnD8KrkTNgUxpXIYYzw9D7k4k5yGT3x8dVWEyeskyTRV9o5fgVvqPXdFXzMZ39GlAoZEMeHdFRn5zDQB4QEuP8xG03dfiGxJFoiqaDSAJo-"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent flex items-center px-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <span className="material-symbols-outlined text-[24px]">content_cut</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-caps text-xs text-amber-300 font-bold">Estación de Trabajo</span>
                  <span className="font-body-sm text-xs text-white font-semibold">Taller Maestro Listo para Producción</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: First Service Setup Card */}
          <section className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-[#b45309] flex items-center justify-center font-label-caps text-xs font-bold">
                  1
                </div>
                <h2 className="font-headline-md text-xl text-[#0f172a] tracking-tight font-bold">Tu Primer Servicio</h2>
              </div>
              <span className="font-label-md text-xs text-[#b45309] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                Recomendado
              </span>
            </div>

            <div className="flex flex-col gap-y-1">
              <label className="font-label-md text-xs text-[#64748b] font-medium">Nombre del servicio o combo</label>
              <div className="relative">
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full h-12 bg-white text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] shadow-sm"
                  placeholder="Ej. Fade Clásico"
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-[20px]">
                  brush
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2">
              <div className="flex flex-col gap-y-1">
                <label className="font-label-md text-xs text-[#64748b] font-medium">Duración</label>
                <div className="relative">
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full h-12 bg-white text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] shadow-sm"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-[20px]">
                    schedule
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-y-1">
                <label className="font-label-md text-xs text-[#64748b] font-medium">Precio al cliente</label>
                <div className="relative">
                  <input
                    type="text"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="w-full h-12 bg-white text-[#b45309] border border-slate-300 rounded-lg px-3 font-currency-metric text-lg font-bold focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] shadow-sm"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-[20px]">
                    payments
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Step 2: First Barber Setup Card */}
          <section className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-[#b45309] flex items-center justify-center font-label-caps text-xs font-bold">
                  2
                </div>
                <h2 className="font-headline-md text-xl text-[#0f172a] tracking-tight font-bold">Tu Primer Barbero (Silla #1)</h2>
              </div>
              <span className="material-symbols-outlined text-[#64748b] text-[20px]">chair</span>
            </div>

            <div className="grid grid-cols-1 gap-y-1">
              <label className="font-label-md text-xs text-[#64748b] font-medium">Nombre del barbero titular</label>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0 overflow-hidden shadow-sm border border-slate-200">
                  <img
                    className="w-full h-full object-cover"
                    alt="Portrait profile of a skilled urban barber"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJx2fnsn874KBOtWoZH60rxUG0aVv8KVrd4cKHEUC8Ya66D7Sk17GnTypfAvolM6yzVDFvQwp-WA6hEyDXBoDA-bQWQLxVTmsVj4mVCZukDaC9S0a9jTVS09eGsslOu0mWYUdtklDwgXlpk9SDtKQZLyQn1kCHiooi-XaMqEoVkco6N-wMyG8aZ9nIl8woZ1QCKKLlXNunOIO9VewCPThUPuk_4A03flkN4qDMzImu4RkXBV8Nc0SQ"
                  />
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={barberName}
                    onChange={(e) => setBarberName(e.target.value)}
                    className="w-full h-12 bg-white text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] shadow-sm"
                    placeholder="Nombre completo"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-[20px]">
                    badge
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-y-1">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-xs text-[#64748b] font-medium">Comisión por servicio</label>
                <span className="font-label-caps text-xs text-[#b45309] font-bold" id="commissionLabel">
                  {commission}% Comisión
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                {[40, 50, 60, 70].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCommission(val)}
                    className={`flex-1 py-2 rounded font-label-caps text-xs font-bold transition ${
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

          {/* Step 3: Plan Overview Card (Hero Tier) */}
          <section className="bg-gradient-to-br from-amber-50/70 via-white to-slate-50 border border-amber-200/80 rounded-xl p-4 relative overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[22px]">workspace_premium</span>
                <span className="font-label-caps text-xs text-[#b45309] tracking-widest font-bold">MEMBRESÍA ACTIVA</span>
              </div>
              <span className="bg-amber-500 text-white font-label-caps text-xs px-2.5 py-0.5 rounded shadow-xs font-bold">
                Plan Ilimitado Barbería
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-1 mb-3">
              <span className="font-headline-md text-xl text-[#b45309] font-bold">COP</span>
              <span className="font-currency-metric text-4xl text-[#0f172a] tracking-tight font-bold">$35.900</span>
              <span className="font-body-sm text-xs text-[#64748b] font-medium">/ mes</span>
            </div>

            <div className="flex flex-col gap-y-2 py-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                <span className="font-body-sm text-xs text-[#1e293b] font-medium">Barberos y sillas sin límite</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                <span className="font-body-sm text-xs text-[#1e293b] font-medium">Cobro rápido táctil con Nequi y PSE en vivo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                <span className="font-body-sm text-xs text-[#1e293b] font-medium">Liquidación de caja y comisiones en tiempo real</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                <span className="font-body-sm text-xs text-[#1e293b] font-medium">Recordatorios automáticos por WhatsApp</span>
              </div>
            </div>

            <div className="mt-2 pt-2 bg-white/90 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">verified</span>
                <span className="font-label-md text-xs text-[#0f172a] font-semibold">Sin cláusulas de permanencia</span>
              </div>
              <span className="font-label-caps text-xs text-[#64748b] uppercase font-bold">Cancela cuando quieras</span>
            </div>
          </section>

          {/* Wompi Integration Section */}
          <section className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#b45309] text-[22px]">lock</span>
                <h3 className="font-headline-md text-xl text-[#0f172a] tracking-tight font-bold">Checkout Seguro Wompi</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded text-[#1e293b] font-label-caps text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 256-bit SSL
              </div>
            </div>

            <p className="font-body-sm text-xs text-[#64748b]">
              Selecciona tu medio de pago colombiano favorito para activar al instante:
            </p>

            {/* Payment Methods Grid */}
            <div className="grid grid-cols-3 gap-1.5" id="paymentOptions">
              {/* Option 1: Nequi */}
              <button
                id="opt-nequi"
                type="button"
                onClick={() => setPaymentMethod('nequi')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white transition-all relative text-left min-h-[82px] shadow-sm ${
                  paymentMethod === 'nequi' ? 'border-2 border-amber-500' : 'border border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center mb-1 shadow-xs">
                  <span className="font-label-caps text-xs text-[#de1484] font-bold">N</span>
                </div>
                <span className="font-label-caps text-xs text-[#0f172a] font-bold">NEQUI</span>
                <span className="font-label-md text-[11px] text-[#b45309] mt-0.5 font-semibold">Celular</span>
                {paymentMethod === 'nequi' && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>

              {/* Option 2: PSE */}
              <button
                id="opt-pse"
                type="button"
                onClick={() => setPaymentMethod('pse')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white transition-all relative text-left min-h-[82px] shadow-sm ${
                  paymentMethod === 'pse' ? 'border-2 border-amber-500' : 'border border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mb-1 text-emerald-700 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                </div>
                <span className="font-label-caps text-xs text-[#0f172a] font-bold">PSE</span>
                <span className="font-label-md text-[11px] text-[#64748b] mt-0.5 font-medium">Cualquier banco</span>
                {paymentMethod === 'pse' && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>

              {/* Option 3: Card */}
              <button
                id="opt-card"
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white transition-all relative text-left min-h-[82px] shadow-sm ${
                  paymentMethod === 'card' ? 'border-2 border-amber-500' : 'border border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-1 text-blue-700 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">credit_card</span>
                </div>
                <span className="font-label-caps text-xs text-[#0f172a] font-bold">TARJETA</span>
                <span className="font-label-md text-[11px] text-[#64748b] mt-0.5 font-medium">Crédito/Débito</span>
                {paymentMethod === 'card' && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>
            </div>

            {/* Dynamic Payment Input Container */}
            <div className="mt-1 bg-white border border-slate-200 p-4 rounded-xl flex flex-col gap-y-2 shadow-xs">
              {paymentMethod === 'nequi' && (
                <div className="flex flex-col gap-y-1">
                  <label className="font-label-md text-xs text-[#64748b] font-medium flex items-center justify-between">
                    <span>Número de cuenta Nequi (Móvil)</span>
                    <span className="text-[#b45309] font-label-caps text-xs font-bold">Notificación Push</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={nequiPhone}
                      onChange={(e) => setNequiPhone(e.target.value)}
                      placeholder="300 000 0000"
                      className="w-full h-12 bg-[#f8fafc] text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] focus:bg-white"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-3 text-[#64748b] text-[20px]">
                      phone_iphone
                    </span>
                  </div>
                  <span className="font-body-sm text-xs text-[#64748b]">
                    Recibirás un push en tu app Nequi para autorizar el cobro de $35.900 COP en 45 segundos.
                  </span>
                </div>
              )}

              {paymentMethod === 'pse' && (
                <div className="flex flex-col gap-y-2">
                  <label className="font-label-md text-xs text-[#64748b] font-medium">Banco del titular</label>
                  <select className="w-full h-12 bg-[#f8fafc] text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b]">
                    <option>Bancolombia (Personas / Negocios)</option>
                    <option>Davivienda / Daviplata</option>
                    <option>Banco de Bogotá</option>
                    <option>Banco Falabella</option>
                    <option>Lulo Bank / Nu Colombia</option>
                  </select>
                  <input
                    type="email"
                    defaultValue="barberia.central@barberos.co"
                    placeholder="Correo registrado en PSE"
                    className="w-full h-12 bg-[#f8fafc] text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b]"
                  />
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="flex flex-col gap-y-2">
                  <label className="font-label-md text-xs text-[#64748b] font-medium">Número de tarjeta</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="4500 •••• •••• 1092"
                      className="w-full h-12 bg-[#f8fafc] text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm focus:outline-none focus:border-[#f59e0b]"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-[20px]">lock</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="MM/AA"
                      className="w-full h-12 bg-[#f8fafc] text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm text-center focus:outline-none focus:border-[#f59e0b]"
                    />
                    <input
                      type="text"
                      placeholder="CVC"
                      className="w-full h-12 bg-[#f8fafc] text-[#0f172a] border border-slate-300 rounded-lg px-3 font-body-md text-sm text-center focus:outline-none focus:border-[#f59e0b]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Security & Guarantee Badge */}
            <div className="flex items-center justify-center gap-2 pt-1 text-center">
              <span className="material-symbols-outlined text-[#b45309] text-[18px]">verified_user</span>
              <span className="font-body-sm text-xs text-[#64748b] font-medium">
                Procesado directamente por <strong className="text-[#0f172a]">Wompi Bancolombia</strong>. Facturación legal DIAN.
              </span>
            </div>
          </section>

          {/* Summary of Total */}
          <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <span className="font-label-caps text-xs text-[#64748b] block font-bold">Total Inversión Mensual</span>
              <span className="font-headline-md text-2xl text-[#0f172a] font-bold">COP $35.900</span>
            </div>
            <div className="text-right">
              <span className="font-label-caps text-xs text-[#006c49] block font-bold">IVA INCLUIDO</span>
              <span className="font-body-sm text-xs text-[#64748b] font-medium">Cobra desde hoy</span>
            </div>
          </div>

          {/* Primary Action CTA */}
          <div className="flex flex-col gap-y-2 pt-2">
            {errorMessage && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-xs">
                <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0">error</span>
                <span className="font-body-sm text-xs text-rose-700">{errorMessage}</span>
              </div>
            )}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handlePayAndActivate}
              className="w-full h-[54px] bg-[#f59e0b] hover:bg-amber-500 text-white font-label-caps text-xl rounded-xl font-bold tracking-wide flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando pago Wompi...</span>
                </>
              ) : (
                <>
                  <span>Pagar $35.900 y Activar Barbería</span>
                  <span className="material-symbols-outlined text-[24px]">bolt</span>
                </>
              )}
            </button>

            {/* Secondary Discrete Link */}
            <a
              href="#skip"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('owner_dashboard', 'none');
              }}
              className="w-full py-2.5 text-center font-label-lg text-sm text-[#64748b] hover:text-[#0f172a] transition-colors flex items-center justify-center gap-1 font-semibold cursor-pointer"
            >
              <span>Saltar por ahora y explorar demo (3 días gratis)</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
