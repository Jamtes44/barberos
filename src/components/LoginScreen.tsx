import React, { useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { api, ApiError } from '../services/api';

interface LoginScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onRoleSelect?: (role: 'owner' | 'barber') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigate, onRoleSelect }) => {
  const [role, setRole] = useState<'owner' | 'barber'>('owner');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  const handleRoleChange = (newRole: 'owner' | 'barber') => {
    setRole(newRole);
    setError(null);
    try {
      localStorage.setItem('barberos_user_role', newRole);
    } catch {
      // Ignore
    }
    if (onRoleSelect) onRoleSelect(newRole);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { user } = await api.login(username.trim(), password, remember);

      // Validación por puesto seleccionado:
      // - Sección Dueño/Admin: solo cuentas de dueño.
      // - Sección Barbero: solo cuentas de barbero. Un dueño entra SOLO si está
      //   registrado como barbero en la barbería (barber_id asignado).
      if (role === 'owner' && user.role === 'barber') {
        setError(
          'Este usuario no aparece registrado como Dueño / Administrador. Verifica las credenciales o regístrate si eres un dueño nuevo.',
        );
        return;
      }
      if (role === 'barber' && user.role === 'owner' && !user.barberId) {
        setError(
          'Tu cuenta de Dueño no está registrada como barbero. Vincúlela desde el panel de administración (sección Equipo) para entrar a la agenda de cortes.',
        );
        return;
      }

      try {
        localStorage.setItem('barberos_user_role', role);
      } catch {
        // Ignore
      }
      if (onRoleSelect) onRoleSelect(role);
      if (role === 'owner') {
        onNavigate('owner_dashboard', 'push');
      } else {
        onNavigate('barber_terminal', 'push');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      <main className="flex-1 flex flex-col relative w-full bg-[#f8fafc]">
        <div className="flex flex-col w-full pb-safe max-w-md mx-auto">
          {/* Atmospheric Ambient Backdrop */}
          <div className="relative w-full px-4 pt-4 pb-6 flex flex-col items-center overflow-hidden">
            {/* Soft Amber Ambient Glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-44 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
            
            {/* Barber Pole Decorative Motif */}
            <div className="flex items-center gap-1 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </div>

            {/* Brand Emblem & Monogram */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-white border border-slate-200 shadow-sm mb-2">
              <span className="material-symbols-outlined text-amber-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                content_cut
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-xs">
                OS
              </span>
            </div>

            {/* Slogan & Intro */}
            <h1 className="font-headline-lg-mobile text-[26px] text-slate-900 tracking-wide text-center uppercase mb-1 font-bold">
              Barber<span className="text-amber-600">OS</span>
            </h1>
            <p className="font-label-caps text-[13px] text-slate-500 text-center tracking-widest uppercase font-semibold">
              El sistema operativo de tu barbería
            </p>
          </div>

          {/* Main Login Card Area */}
          <div className="w-full px-4 flex flex-col gap-4">
            {/* Header Welcome */}
            <div className="flex flex-col text-center">
              <h2 className="font-headline-md text-2xl text-slate-900 mb-1 font-bold">Bienvenido de nuevo</h2>
              <p className="font-body-sm text-[13px] text-slate-500">
                Selecciona tu función en el local para comenzar el turno
              </p>
            </div>

            {/* Role Selector Segmented Deck */}
            <div aria-label="Selección de perfil" className="flex flex-col gap-1" role="radiogroup">
              <span className="font-label-caps text-[13px] text-slate-600 px-1 font-bold">Puesto de trabajo</span>
              <div className="grid grid-cols-2 gap-2 w-full">
                {/* Role 1: Owner / Admin */}
                <button
                  id="btn-role-owner"
                  onClick={() => handleRoleChange('owner')}
                  type="button"
                  className={`relative flex flex-col p-4 rounded-xl text-left transition-all duration-200 shadow-sm cursor-pointer ${
                    role === 'owner'
                      ? 'bg-amber-50/80 border-2 border-amber-500 text-slate-900'
                      : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`} id="icon-container-owner">
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        storefront
                      </span>
                    </div>
                    <span
                      id="radio-owner"
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        role === 'owner'
                          ? 'bg-amber-500 text-white text-xs'
                          : 'border border-slate-300 bg-slate-50'
                      }`}
                    >
                      {role === 'owner' && (
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      )}
                    </span>
                  </div>
                  <span className="font-label-lg text-sm text-slate-900 font-bold">Dueño / Admin</span>
                  <span className="font-body-sm text-[12px] text-slate-600 mt-1 line-clamp-2">
                    Métricas, caja mayor y control global del local.
                  </span>
                  {role === 'owner' && (
                    <div id="pillar-owner" className="absolute left-0 top-3 bottom-3 w-1 bg-amber-500 rounded-r-full" />
                  )}
                </button>

                {/* Role 2: Barber in Chair */}
                <button
                  id="btn-role-barber"
                  onClick={() => handleRoleChange('barber')}
                  type="button"
                  className={`relative flex flex-col p-4 rounded-xl text-left transition-all duration-200 shadow-sm cursor-pointer ${
                    role === 'barber'
                      ? 'bg-amber-50/80 border-2 border-amber-500 text-slate-900'
                      : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      role === 'barber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`} id="icon-container-barber">
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        content_cut
                      </span>
                    </div>
                    <span
                      id="radio-barber"
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        role === 'barber'
                          ? 'bg-amber-500 text-white text-xs'
                          : 'border border-slate-300 bg-slate-50'
                      }`}
                    >
                      {role === 'barber' && (
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      )}
                    </span>
                  </div>
                  <span className="font-label-lg text-sm text-slate-900 font-bold">Barbero en Silla</span>
                  <span className="font-body-sm text-[12px] text-slate-500 mt-1 line-clamp-2">
                    Mi agenda, registro rápido de cortes y comisiones.
                  </span>
                  {role === 'barber' && (
                    <div id="pillar-barber" className="absolute left-0 top-3 bottom-3 w-1 bg-amber-500 rounded-r-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Authentication Form Card */}
            <div className="w-full bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm flex flex-col gap-4">
              <form className="flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                {/* Input: Email / Username */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="font-label-caps text-[12px] text-slate-600 flex items-center justify-between font-bold" htmlFor="username-input">
                    <span>Usuario o Correo</span>
                    <span
                      id="role-badge-pill"
                      className="text-amber-700 font-label-caps text-[11px] uppercase tracking-wider font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                    >
                      {role === 'owner' ? 'Perfil Dueño' : 'Perfil Barbero'}
                    </span>
                  </label>
                  <div className="relative w-full flex items-center">
                    <span className="absolute left-3.5 text-slate-400 material-symbols-outlined pointer-events-none text-xl">
                      badge
                    </span>
                    <input
                      id="username-input"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin@barberia.co"
                      className="w-full h-[50px] pl-11 pr-4 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-body-md text-[15px] rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Input: Password */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="font-label-caps text-[12px] text-slate-600 font-bold" htmlFor="password-input">
                    Contraseña
                  </label>
                  <div className="relative w-full flex items-center">
                    <span className="absolute left-3.5 text-slate-400 material-symbols-outlined pointer-events-none text-xl">
                      lock
                    </span>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-[50px] pl-11 pr-12 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-body-md text-[15px] rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                    />
                    <button
                      type="button"
                      aria-label="Mostrar contraseña"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xl" id="pwd-icon">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Utilities Row: Remember + Forgot Pwd */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="remember-me-checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-400"
                    />
                    <span className="font-body-sm text-[13px] text-slate-700 font-medium">Recordarme en este teléfono</span>
                  </label>
                  <button
                    type="button"
                    id="btn-forgot-password"
                    onClick={() => onNavigate('forgot_password', 'push')}
                    className="font-label-md text-[12px] text-amber-700 hover:text-amber-800 font-semibold hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {/* Error de autenticación */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-body-sm text-[13px]">
                    <span className="material-symbols-outlined text-lg shrink-0">error</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Dynamic Contextual Submit Action */}
                <button
                  id="btn-submit-action"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 mt-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-headline-md text-xl rounded-lg flex items-center justify-center gap-2 shadow-sm font-bold transition-all uppercase tracking-wider cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin inline-block" />
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    <>
                      <span id="submit-label">
                        {role === 'owner' ? 'Entrar al Dashboard del Dueño' : 'Entrar a mi Agenda de Cortes'}
                      </span>
                      <span className="material-symbols-outlined text-xl font-bold">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Registration Link */}
            <div className="flex flex-col items-center justify-center text-center py-2 mb-6">
              <p className="font-body-sm text-[13px] text-slate-600">
                ¿Eres dueño y aún no tienes cuenta?
              </p>
              <a
                href="#registro"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('register_shop', 'push');
                }}
                className="font-label-lg text-sm text-amber-700 hover:text-amber-800 hover:underline font-bold mt-1 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Registra tu barbería aquí</span>
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
