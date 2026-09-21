import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api, getSessionUser } from '../services/api';

export interface AccountDropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  role?: 'owner' | 'barber';
  businessName?: string;
  ownerName?: string;
  barberName?: string;
  chairLabel?: string;
  onOpenBusinessSettings?: () => void;
  onOpenPlanModal?: () => void;
  onNavigateCommissions?: () => void;
  onLogout: () => void;
  supportPhone?: string;
}

export const AccountDropdownMenu: React.FC<AccountDropdownMenuProps> = ({
  isOpen,
  onClose,
  role = 'owner',
  businessName = 'Black Crown Barber Shop',
  ownerName = 'Carlos Mendoza',
  barberName = 'Carlos Fade',
  chairLabel = 'Silla #1',
  onOpenBusinessSettings,
  onOpenPlanModal,
  onNavigateCommissions,
  onLogout,
  supportPhone = '573108459920',
}) => {
  const sessionUser = getSessionUser();
  const effectiveRole = sessionUser?.role ?? role;
  const isOwner = effectiveRole === 'owner';
  const displayOwnerName = sessionUser?.fullName ?? ownerName;
  const displayBarberName = sessionUser?.fullName ?? barberName;
  const displayEmail = sessionUser?.email ?? '';
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate friendly WhatsApp support link
  const handleOpenWhatsAppSupport = () => {
    onClose();
    const message =
      isOwner
        ? `Hola soporte de BarberOS 👋. Necesito asistencia técnica para mi negocio *${businessName}* (Propietario: ${displayOwnerName}).`
        : `Hola soporte de BarberOS 👋. Soy *${displayBarberName}* (${chairLabel} en ${businessName}) y requiero ayuda con la aplicación.`;

    const url = `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay for outside click */}
          <div
            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px] transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Floating Dropdown Container */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-3 top-16 z-50 w-80 max-w-[calc(100vw-24px)] rounded-2xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden select-none text-[#0f172a]"
            role="menu"
            aria-orientation="vertical"
            aria-label="Menú de cuenta y configuración"
          >
            {/* Header: User & Business Identity (Informative Only) */}
            <div className="p-4 bg-gradient-to-br from-amber-500/10 via-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-3">
                {isOwner ? (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md border border-amber-400/40">
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      storefront
                    </span>
                  </div>
                ) : (
                  <div className="relative w-12 h-12 shrink-0">
                    <img
                      className="w-12 h-12 rounded-xl object-cover border-2 border-amber-500 shadow-sm"
                      alt={displayBarberName}
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfZYOGJAgxMSZIvlX2W8LeWdsGH5_NQ1wvKLiDERRaDILDk80xpLQVxDaPxFWsTsMvWL5aOyl1CfTnjTtX3EZYo_vZrxtl2MkMYrBenJZWMnPgE6SzhpX4bhfLsksqHN-DrqpfBuwEZ98ZcUZjHOshc8L9_oTL8zv2k8KST4GSsHQiB-Mhjc5xETP2YZAiDz7llOuXjXFmHDO7Tbxk2O3L6LU8DgnIhf_-pR10QGsPmCXBnKwmPCNO"
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] font-bold ring-2 ring-white">
                      ✓
                    </span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {isOwner ? (
                    <>
                      <h4 className="font-headline-md text-base font-bold text-slate-900 truncate leading-snug">
                        {businessName}
                      </h4>
                      <p className="font-body-sm text-xs text-slate-600 truncate mt-0.5">
                        {displayOwnerName}
                      </p>
                      {displayEmail && (
                        <p className="font-body-sm text-[11px] text-slate-400 truncate mt-0.5">
                          {displayEmail}
                        </p>
                      )}
                      <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-200/80">
                        <span className="text-[10px]">👑</span>
                        <span className="font-label-caps text-[10px] font-bold uppercase tracking-wide">
                          Dueño / Administrador
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="font-headline-md text-base font-bold text-slate-900 truncate leading-snug">
                        {displayBarberName}
                      </h4>
                      <p className="font-body-sm text-xs text-slate-600 truncate mt-0.5">
                        {chairLabel} · {businessName}
                      </p>
                      {displayEmail && (
                        <p className="font-body-sm text-[11px] text-slate-400 truncate mt-0.5">
                          {displayEmail}
                        </p>
                      )}
                      <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="text-[10px]">✂️</span>
                        <span className="font-label-caps text-[10px] font-bold uppercase tracking-wide">
                          Barbero en Turno
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Options Deck */}
            <div className="p-2 flex flex-col gap-1">
              {/* ===================== ROL: DUEÑO ===================== */}
              {isOwner && (
                <>
                  {/* Mi negocio */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenBusinessSettings) onOpenBusinessSettings();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between group cursor-pointer"
                    role="menuitem"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 transition-colors border border-amber-200/60">
                        <span className="material-symbols-outlined text-[20px]">store</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-md text-xs font-bold text-slate-900">
                          Mi negocio
                        </span>
                        <span className="font-body-sm text-[11px] text-slate-500 truncate">
                          Editar nombre, logo y datos del local
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-700 text-[18px] transition-colors shrink-0 ml-2">
                      chevron_right
                    </span>
                  </button>

                  {/* Mi plan */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenPlanModal) onOpenPlanModal();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between group cursor-pointer"
                    role="menuitem"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 transition-colors border border-emerald-200/60">
                        <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-label-md text-xs font-bold text-slate-900">
                            Mi plan
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                            Activo
                          </span>
                        </div>
                        <span className="font-body-sm text-[11px] text-slate-500 truncate">
                          Plan Pro · Próximamente cambiar
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-700 text-[18px] transition-colors shrink-0 ml-2">
                      chevron_right
                    </span>
                  </button>
                </>
              )}

              {/* ===================== ROL: BARBERO ===================== */}
              {effectiveRole === 'barber' && (
                <>
                  {/* Mis comisiones */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onNavigateCommissions) onNavigateCommissions();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between group cursor-pointer"
                    role="menuitem"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 transition-colors border border-amber-200/60">
                        <span className="material-symbols-outlined text-[20px]">payments</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-md text-xs font-bold text-slate-900">
                          Mis comisiones
                        </span>
                        <span className="font-body-sm text-[11px] text-slate-500 truncate">
                          Ver balance de cortes y propinas
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-700 text-[18px] transition-colors shrink-0 ml-2">
                      chevron_right
                    </span>
                  </button>
                </>
              )}

              {/* Ayuda / Soporte (Común a ambos, enlace directo a WhatsApp) */}
              <button
                type="button"
                onClick={handleOpenWhatsAppSupport}
                className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50/60 active:bg-emerald-100/60 transition-colors flex items-center justify-between group cursor-pointer"
                role="menuitem"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    {/* WhatsApp Icon */}
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.77 2.71 4.3 3.79.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-label-md text-xs font-bold text-slate-900">
                        Ayuda / Soporte
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                        WhatsApp
                      </span>
                    </div>
                    <span className="font-body-sm text-[11px] text-slate-500 truncate">
                      Atención directa sin complicaciones
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 ml-2">
                  open_in_new
                </span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              {/* Cerrar sesión */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  api.logout();
                  onLogout();
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 active:bg-rose-100 transition-colors flex items-center justify-between group cursor-pointer text-rose-700"
                role="menuitem"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 group-hover:bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 transition-colors border border-rose-200/60">
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-xs font-bold text-rose-700">
                      Cerrar sesión
                    </span>
                    <span className="font-body-sm text-[11px] text-rose-500/80 truncate">
                      {isOwner ? 'Salir del panel de administración' : 'Cambiar de barbero o finalizar turno'}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-rose-400 group-hover:text-rose-600 text-[18px] transition-colors shrink-0 ml-2">
                  chevron_right
                </span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
