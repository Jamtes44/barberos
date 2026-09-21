import React, { useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { api, ApiError } from '../services/api';

interface RegisterShopScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

export const RegisterShopScreen: React.FC<RegisterShopScreenProps> = ({ onNavigate, onBack }) => {
  const [shopName, setShopName] = useState('Black Crown Barber Shop');
  const [ownerName, setOwnerName] = useState('Carlos Ramírez');
  const [ownerEmail, setOwnerEmail] = useState('carlos@barberos.co');
  const [ownerPhone, setOwnerPhone] = useState('310 123 4567');
  const [password, setPassword] = useState('BarberMaster2025!');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStrengthLevel = () => {
    if (!password) return 0;
    if (password.length < 6) return 1;
    if (password.length < 10) return 2;
    return 3;
  };

  const strength = getStrengthLevel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const { user } = await api.register({
        email: ownerEmail.trim(),
        password,
        fullName: ownerName.trim(),
        shopName: shopName.trim(),
        shopAddress: '',
        shopPhone: ownerPhone.trim(),
      });
      try {
        localStorage.setItem('barberos_user_role', 'owner');
      } catch {
        // Ignore
      }
      onNavigate('wompi_plan', 'push');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la barbería');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      <main className="flex-1 flex flex-col relative w-full bg-[#f8fafc] max-w-md mx-auto">
        <div className="flex flex-col w-full px-4 pb-12 text-[#0f172a]">
          {/* Top back navigation button */}
          <div className="flex items-center justify-between pt-3 pb-2">
            <button
              type="button"
              id="btn-register-back"
              onClick={onBack || (() => onNavigate('login', 'push_back'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-md text-xs font-semibold cursor-pointer active:scale-95 transition-all border border-slate-200"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Volver al Login</span>
            </button>
            <span className="font-label-caps text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-200">
              Registro Barbería
            </span>
          </div>

          {/* Brand Atmosphere Ambient Light */}
          <div className="relative w-full overflow-hidden rounded-xl bg-[#f8fafc] border border-slate-200 p-4 mb-4 shadow-sm">
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-[#fef3c7]/70 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fef3c7] text-[#b45309] font-label-caps text-xs uppercase tracking-wider font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />
                Paso 1 de 2: Tu Negocio
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-6 rounded-full bg-[#f59e0b]" />
                <span className="h-1.5 w-2.5 rounded-full bg-slate-200" />
              </div>
            </div>

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="font-headline-lg-mobile text-[26px] text-[#0f172a] uppercase tracking-tight font-bold">
                  Registra tu Barbería
                </h1>
                <p className="font-body-sm text-xs text-[#64748b] mt-1">
                  Toma el control total de citas, comisiones y caja en minutos.
                </p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b45309] shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  content_cut
                </span>
              </div>
            </div>
          </div>

          {/* Form Container */}
          <form id="barber-register-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Input 1: Nombre de la Barbería */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-sm text-[#0f172a] flex items-center gap-2 font-semibold" htmlFor="shop-name">
                <span className="material-symbols-outlined text-[#b45309] text-lg">storefront</span>
                Nombre de la Barbería
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 text-xl pointer-events-none">
                  badge
                </span>
                <input
                  id="shop-name"
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Ej: Black Crown Barber Shop"
                  className="w-full h-[52px] pl-12 pr-4 bg-white border border-slate-300 rounded-lg font-body-md text-sm text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Input 2: Nombre del Dueño */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-sm text-[#0f172a] flex items-center gap-2 font-semibold" htmlFor="owner-name">
                <span className="material-symbols-outlined text-[#b45309] text-lg">person</span>
                Nombre del Dueño / Administrador
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 text-xl pointer-events-none">
                  account_circle
                </span>
                <input
                  id="owner-name"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej: Carlos Ramírez"
                  className="w-full h-[52px] pl-12 pr-4 bg-white border border-slate-300 rounded-lg font-body-md text-sm text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Input 3: Correo Electrónico */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-sm text-[#0f172a] flex items-center gap-2 font-semibold" htmlFor="owner-email">
                <span className="material-symbols-outlined text-[#b45309] text-lg">alternate_email</span>
                Correo Electrónico
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 text-xl pointer-events-none">
                  mail
                </span>
                <input
                  id="owner-email"
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="carlos@tu-barberia.com"
                  className="w-full h-[52px] pl-12 pr-4 bg-white border border-slate-300 rounded-lg font-body-md text-sm text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Input 4: WhatsApp / Móvil */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-sm text-[#0f172a] flex items-center gap-2 font-semibold" htmlFor="owner-phone">
                <span className="material-symbols-outlined text-[#b45309] text-lg">chat</span>
                WhatsApp / Celular de contacto
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1.5 pr-2 pointer-events-none text-[#b45309] font-label-caps text-xs font-bold">
                  <span className="text-sm">🇨🇴</span>
                  <span>+57</span>
                </div>
                <input
                  id="owner-phone"
                  type="tel"
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="310 123 4567"
                  className="w-full h-[52px] pl-20 pr-4 bg-white border border-slate-300 rounded-lg font-body-md text-sm text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20 transition-all shadow-sm"
                />
              </div>
              <p className="font-body-sm text-xs text-[#64748b] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-xs text-[#006c49]">check_circle</span>
                Te notificaremos confirmaciones de citas por este canal.
              </p>
            </div>

            {/* Input 5: Contraseña + Medidor */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-lg text-sm text-[#0f172a] flex items-center gap-2 font-semibold" htmlFor="password-input">
                <span className="material-symbols-outlined text-[#b45309] text-lg">lock</span>
                Contraseña de Acceso
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 text-xl pointer-events-none">
                  key
                </span>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full h-[52px] pl-12 pr-12 bg-white border border-slate-300 rounded-lg font-body-md text-sm text-[#0f172a] placeholder:text-slate-400 focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20 transition-all shadow-sm"
                />
                <button
                  type="button"
                  aria-label="Ver u ocultar contraseña"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  <span className="material-symbols-outlined text-xl" id="pwd-icon">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Simple Strength Meter */}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 grid grid-cols-3 gap-1.5 h-1.5">
                  <div className={`rounded-full transition-colors duration-300 ${
                    strength >= 1 ? (strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : 'bg-emerald-600') : 'bg-slate-200'
                  }`} />
                  <div className={`rounded-full transition-colors duration-300 ${
                    strength >= 2 ? (strength === 2 ? 'bg-amber-500' : 'bg-emerald-600') : 'bg-slate-200'
                  }`} />
                  <div className={`rounded-full transition-colors duration-300 ${
                    strength >= 3 ? 'bg-emerald-600' : 'bg-slate-200'
                  }`} />
                </div>
                <span className="font-body-sm text-xs text-[#64748b] text-right min-w-[70px]">
                  {strength === 0 ? 'Seguridad' : strength === 1 ? 'Baja' : strength === 2 ? 'Media' : 'Óptima'}
                </span>
              </div>
            </div>

            {/* Checkbox Términos */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  id="terms-check"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded text-[#f59e0b] border-slate-300 focus:ring-[#f59e0b]"
                />
                <span className="font-body-sm text-xs text-[#64748b] leading-tight">
                  Acepto los <span className="text-[#b45309] underline font-medium">Términos de Servicio</span> y autorizo el tratamiento de datos de mi barbería conforme a la <span className="text-[#b45309] underline font-medium">Política de Privacidad</span>.
                </span>
              </label>
            </div>

            {/* Error de registro */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-body-sm text-[13px]">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Botón CTA Principal */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full h-[52px] mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:opacity-95 text-white rounded-lg font-headline-md text-xl tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer font-bold"
            >
              {isSaving ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando Negocio...</span>
                </>
              ) : (
                <>
                  <span>Continuar a Configuración Inicial</span>
                  <span className="material-symbols-outlined text-2xl">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-4 text-center">
            <p className="font-body-md text-sm text-[#64748b]">
              ¿Ya tienes cuenta en BarberOS?
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('login', 'push_back');
                }}
                className="font-label-lg text-sm text-[#b45309] hover:text-amber-800 ml-1 inline-flex items-center gap-0.5 font-semibold cursor-pointer"
              >
                <span>Iniciar sesión</span>
                <span className="material-symbols-outlined text-sm">login</span>
              </a>
            </p>
          </div>

          {/* Trust Badges Strip */}
          <div className="mt-6 p-3 rounded-xl bg-[#f8fafc] border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-center text-[#1e293b] font-label-caps text-xs font-semibold">
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[#006c49] text-base">verified_user</span>
                Sin contratos forzosos
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[#006c49] text-base">event_available</span>
                Cancela cuando quieras
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-center text-[#b45309] font-body-sm text-xs font-medium">
              <span className="material-symbols-outlined text-base">support_agent</span>
              <span>Acompañamiento VIP por WhatsApp durante tu setup</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
