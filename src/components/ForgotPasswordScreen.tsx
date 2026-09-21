import React, { useState, useEffect } from 'react';
import { ScreenId, TransitionType } from '../types';

interface ForgotPasswordScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onNavigate, onBack }) => {
  const [method, setMethod] = useState<'email' | 'whatsapp'>('email');
  const [accountInput, setAccountInput] = useState('master@barberos.co');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-redirect back to login after execution and success
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSuccess && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isSuccess && countdown === 0) {
      if (onBack) {
        onBack();
      } else {
        onNavigate('login', 'push_back');
      }
    }
    return () => clearTimeout(timer);
  }, [isSuccess, countdown, onNavigate, onBack]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountInput.trim()) {
      setErrorMessage('Por favor ingresa un correo o teléfono válido');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(false);
      setErrorMessage('El envío del correo de recuperación estará disponible próximamente. Por ahora, contacta a soporte para restablecer tu acceso.');
    }, 400);
  };

  const handleReturnToLogin = () => {
    if (onBack) {
      onBack();
    } else {
      onNavigate('login', 'push_back');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      <main className="flex-1 flex flex-col relative w-full bg-[#f8fafc]">
        <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4">
          {/* Top Bar with Back Action */}
          <div className="flex items-center justify-between w-full py-2">
            <button
              id="btn-back-login"
              type="button"
              onClick={handleReturnToLogin}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-label-md text-xs font-semibold py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span>Volver al inicio</span>
            </button>

            <span className="font-label-caps text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase">
              Seguridad BarberOS
            </span>
          </div>

          {/* Ambient Decorative Header */}
          <div className="relative w-full pt-4 pb-5 flex flex-col items-center overflow-hidden">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-36 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm mb-3">
              <span className="material-symbols-outlined text-amber-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                lock_reset
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-xs">
                OS
              </span>
            </div>

            <h1 className="font-headline-lg-mobile text-2xl text-slate-900 font-bold text-center">
              Recuperar Contraseña
            </h1>
            <p className="font-body-sm text-xs text-slate-500 text-center max-w-xs mt-1">
              Restablece el acceso a tu cuenta de administración o terminal de corte de forma segura
            </p>
          </div>

          {!isSuccess ? (
            /* Recovery Request Form Card */
            <div className="w-full bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
              {/* Delivery Method Switcher */}
              <div className="flex flex-col gap-1.5">
                <span className="font-label-caps text-[12px] text-slate-600 font-bold">
                  Método de recuperación
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-method-email"
                    type="button"
                    onClick={() => {
                      setMethod('email');
                      setAccountInput('master@barberos.co');
                    }}
                    className={`py-2 px-3 rounded-xl font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      method === 'email'
                        ? 'bg-amber-50 text-[#8d4b00] border-amber-400 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">mail</span>
                    <span>Por Correo</span>
                  </button>

                  <button
                    id="btn-method-whatsapp"
                    type="button"
                    onClick={() => {
                      setMethod('whatsapp');
                      setAccountInput('+57 312 456 7890');
                    }}
                    className={`py-2 px-3 rounded-xl font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      method === 'whatsapp'
                        ? 'bg-amber-50 text-[#8d4b00] border-amber-400 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    <span>Por WhatsApp</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 w-full">
                  <label htmlFor="recovery-input" className="font-label-caps text-[12px] text-slate-600 font-bold">
                    {method === 'email' ? 'Correo Electrónico Registrado' : 'Número Celular / WhatsApp'}
                  </label>
                  <div className="relative w-full flex items-center">
                    <span className="absolute left-3.5 text-slate-400 material-symbols-outlined pointer-events-none text-xl">
                      {method === 'email' ? 'alternate_email' : 'phone_iphone'}
                    </span>
                    <input
                      id="recovery-input"
                      type={method === 'email' ? 'email' : 'tel'}
                      required
                      value={accountInput}
                      onChange={(e) => setAccountInput(e.target.value)}
                      placeholder={method === 'email' ? 'tu-correo@barberia.co' : '312 456 7890'}
                      className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-body-md text-sm rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                    />
                  </div>
                  {errorMessage && (
                    <span className="font-body-sm text-xs text-rose-600 flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errorMessage}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-700 text-lg shrink-0 mt-0.5">
                    info
                  </span>
                  <p className="font-body-sm text-[12px] text-amber-900 leading-relaxed">
                    Te enviaremos un enlace de un solo uso para redefinir tu contraseña. Por seguridad del negocio, el enlace vencerá en 15 minutos.
                  </p>
                </div>

                <button
                  id="btn-recover-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 mt-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-headline-md text-base rounded-xl flex items-center justify-center gap-2 shadow-sm font-bold transition-all uppercase tracking-wider cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin inline-block" />
                      <span>Enviando solicitud...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">send</span>
                      <span>Enviar Enlace de Recuperación</span>
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Quick Return Action */}
              <div className="flex items-center justify-center pt-2 border-t border-slate-100">
                <button
                  id="btn-cancel-return-login"
                  type="button"
                  onClick={handleReturnToLogin}
                  className="font-label-md text-xs text-slate-600 hover:text-amber-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>¿Recordaste tu contraseña?</span>
                  <span className="text-amber-700 font-bold hover:underline">Iniciar Sesión</span>
                </button>
              </div>
            </div>
          ) : (
            /* Execution Success Confirmation Card */
            <div className="w-full bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 mb-1">
                <span className="material-symbols-outlined text-3xl font-bold">mark_email_read</span>
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="font-headline-md text-xl text-slate-900 font-bold">
                  ¡Enlace Enviado con Éxito!
                </h2>
                <p className="font-body-sm text-xs text-slate-600 max-w-xs mx-auto">
                  Hemos enviado las instrucciones para restablecer tu contraseña a:
                </p>
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-800 inline-block mx-auto">
                  {accountInput}
                </div>
              </div>

              <div className="w-full p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex flex-col gap-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700 text-sm">verified_user</span>
                  <span className="font-label-caps text-[11px] text-emerald-800 font-bold uppercase">
                    Paso Siguiente
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-emerald-900">
                  Revisa tu bandeja principal o carpeta de spam y abre el enlace para crear tu nueva clave.
                </p>
              </div>

              {/* Countdown badge */}
              <div className="flex items-center justify-center gap-2 py-1 px-3 rounded-full bg-slate-100 text-slate-600 font-label-md text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Volviendo a la pantalla de inicio en <strong>{countdown}s</strong>...</span>
              </div>

              {/* Return to Login Action Button */}
              <button
                id="btn-return-login-success"
                type="button"
                onClick={handleReturnToLogin}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-headline-md text-sm uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span>Volver al Inicio de Sesión Ahora</span>
              </button>

              {/* Secondary Option: Reenviar */}
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setCountdown(4);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 hover:underline font-label-md cursor-pointer"
              >
                ¿No recibiste el mensaje? Probar con otro correo
              </button>
            </div>
          )}

          {/* Help & Support Banner */}
          <div className="mt-4 p-3 rounded-xl bg-slate-100/70 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-500 text-base">help</span>
              <span>¿Problemas para acceder a tu local?</span>
            </div>
            <a
              href="#soporte"
              onClick={(e) => {
                e.preventDefault();
                alert('Contactando a soporte técnico de BarberOS: soporte@barberos.co');
              }}
              className="font-bold text-amber-700 hover:underline"
            >
              Soporte
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
