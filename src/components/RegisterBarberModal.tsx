import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiBarbers, getSessionUser } from '../services/api';

type CommissionScheme = 'percentage' | 'fixed' | 'none';

const SCHEME_META: Record<CommissionScheme, { label: string; desc: string; icon: string }> = {
  percentage: { label: 'Porcentaje', desc: '% de cada venta', icon: 'percent' },
  fixed: { label: 'Fija por cobro', desc: 'COP por cada venta', icon: 'payments' },
  none: { label: 'Sin comisión', desc: 'Solo propinas', icon: 'do_not_disturb_on' },
};

const fmtCop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

interface RegisterBarberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (created?: { isAdmin?: boolean; barberId?: string }) => void;
}

export const RegisterBarberModal: React.FC<RegisterBarberModalProps> = ({ isOpen, onClose, onCreated }) => {
  const sessionUser = getSessionUser();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [chair, setChair] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [commScheme, setCommScheme] = useState<CommissionScheme>('percentage');
  const [commValue, setCommValue] = useState('40');

  const reset = () => {
    setName('');
    setPhone('');
    setChair('');
    setIsAdmin(false);
    setEmail('');
    setPassword('');
    setCommScheme('percentage');
    setCommValue('40');
    setError(null);
  };

  const handleClose = () => {
    if (isSaving) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Escribe el nombre del barbero');
      return;
    }
    if (!isAdmin) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        setError('Escribe un correo válido para el login del barbero');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }
    }
    setError(null);
    let commissionValue: number | undefined;
    if (commScheme === 'percentage') {
      const v = Number(commValue);
      if (commValue.trim() === '' || !Number.isFinite(v) || v < 0 || v > 100) {
        setError('Ingresa un porcentaje de comisión entre 0 y 100');
        return;
      }
      commissionValue = v;
    } else if (commScheme === 'fixed') {
      const v = Number(commValue);
      if (commValue.trim() === '' || !Number.isFinite(v) || v <= 0) {
        setError('Ingresa el valor fijo por cobro (COP) para la comisión');
        return;
      }
      commissionValue = v;
    }
    setIsSaving(true);
    try {
      const created = await apiBarbers.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
        chair: chair.trim() || undefined,
        email: isAdmin ? undefined : email.trim(),
        password: isAdmin ? undefined : password,
        linkToUser: isAdmin || undefined,
        commissionScheme: commScheme,
        commissionValue,
      });
      reset();
      if (onCreated) {
        onCreated({ isAdmin: Boolean(created.isAdmin || isAdmin), barberId: created.id });
      }
    } catch (err) {
      setError((err as Error).message || 'No se pudo registrar el barbero');
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClass =
    'w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500';
  const inputWrapClass = 'relative';
  const inputIconClass = 'material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
            id="modal-register-barber"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-barber-title"
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shadow-2xs">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    person_add
                  </span>
                </div>
                <div>
                  <h3 id="register-barber-title" className="font-headline-md text-base font-bold text-slate-900 leading-none">
                    Registrar Barbero
                  </h3>
                  <span className="text-[11px] text-slate-500">Añade una silla y sus credenciales de turno</span>
                </div>
              </div>

              <button
                type="button"
                id="btn-close-register-barber"
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Cerrar registro de barbero"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block mb-3">
                  Datos del Barbero
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre completo <span className="text-amber-600">*</span>
                    </label>
                    <div className={inputWrapClass}>
                      <span className={inputIconClass}>content_cut</span>
                      <input
                        type="text"
                        id="input-barber-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Juan Pérez"
                        autoFocus
                        className={`${fieldClass} pl-9`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                      <div className={inputWrapClass}>
                        <span className={inputIconClass}>call</span>
                        <input
                          type="tel"
                          id="input-barber-phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+57 300..."
                          className={`${fieldClass} pl-9`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Silla</label>
                      <div className={inputWrapClass}>
                        <span className={inputIconClass}>chair</span>
                        <input
                          type="text"
                          id="input-barber-chair"
                          value={chair}
                          onChange={(e) => setChair(e.target.value)}
                          placeholder="Silla #2"
                          className={`${fieldClass} pl-9`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block mb-3">
                  Esquema de Comisión
                </span>

                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {(Object.keys(SCHEME_META) as CommissionScheme[]).map((key) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => {
                        setCommScheme(key);
                        setError(null);
                      }}
                      aria-pressed={commScheme === key}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                        commScheme === key
                          ? 'bg-amber-500/15 text-[#8d4b00] border-amber-400'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{SCHEME_META[key].icon}</span>
                      <span>{SCHEME_META[key].label}</span>
                      <span
                        className={`${
                          commScheme === key ? 'text-[#8d4b00]' : 'text-slate-400'
                        } font-semibold text-[9px] leading-tight`}
                      >
                        {SCHEME_META[key].desc}
                      </span>
                    </button>
                  ))}
                </div>

                {commScheme !== 'none' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {commScheme === 'percentage' ? 'Porcentaje por venta' : 'Valor fijo por cobro (COP)'}{' '}
                      <span className="text-amber-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
                        {commScheme === 'percentage' ? 'percent' : 'payments'}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        id="input-barber-commission"
                        value={commValue}
                        onChange={(e) => setCommValue(e.target.value)}
                        placeholder={commScheme === 'percentage' ? 'P. ej. 50' : 'P. ej. 15000'}
                        className={`${fieldClass} pl-9`}
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                        {commScheme === 'percentage' ? '%' : 'COP'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {commScheme === 'percentage'
                        ? 'Se calcula sobre el total de cada venta (además conserva sus propinas)'
                        : 'Gana este monto fijo por cada venta cobrada, además de sus propinas'}
                    </span>
                  </div>
                )}
              </div>

              {sessionUser && sessionUser.role === 'owner' && (
                <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0">
                        <span className="material-symbols-outlined text-lg">verified_user</span>
                      </span>
                      <div>
                        <span className="font-label-md text-xs font-bold text-slate-900 block">Soy el administrador</span>
                        <span className="text-[11px] text-slate-500 block leading-tight">
                          Vincular este barbero a mi cuenta ({sessionUser.fullName || 'admin'}) para trabajar desde mi sesión
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      id="toggle-barber-is-admin"
                      onClick={() => {
                        setIsAdmin((prev) => !prev);
                        setError(null);
                      }}
                      aria-pressed={isAdmin}
                      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${
                        isAdmin ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          isAdmin ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {!isAdmin && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block mb-3">
                    Credenciales de Turno
                  </span>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Correo electrónico <span className="text-amber-600">*</span>
                      </label>
                      <div className={inputWrapClass}>
                        <span className={inputIconClass}>alternate_email</span>
                        <input
                          type="email"
                          id="input-barber-email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="barbero@tu-barberia.com"
                          className={`${fieldClass} pl-9`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Contraseña <span className="text-amber-600">*</span>
                      </label>
                      <div className={inputWrapClass}>
                        <span className={inputIconClass}>lock</span>
                        <input
                          type="password"
                          id="input-barber-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className={`${fieldClass} pl-9`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        El barbero usará esta cuenta para iniciar sesión en su terminal
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  <span className="material-symbols-outlined text-sm shrink-0">error</span>
                  <span className="text-xs font-medium">{error}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-save-register-barber"
                onClick={handleSave}
                disabled={isSaving}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                  isSaving
                    ? 'bg-slate-900 hover:bg-slate-800 text-white opacity-60'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>{isSaving ? 'Guardando...' : 'Registrar Barbero'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};