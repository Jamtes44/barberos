import React, { useState, useEffect } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AccountDropdownMenu } from './AccountDropdownMenu';
import { AdminSettingsModal } from './AdminSettingsModal';
import { MyPlanModal } from './MyPlanModal';
import { getSessionShop, getSessionUser, getToken, saveSession, apiShop } from '../services/api';

interface AppHeaderProps {
  currentSection?: string;
  role?: 'owner' | 'barber';
  onProfileClick?: () => void;
  onBack?: () => void;
  showBack?: boolean;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  unreadCount?: number;
  onNavigate?: (screen: ScreenId, transition?: TransitionType) => void;
  onLogout?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentSection = 'Dashboard',
  role: propRole,
  onProfileClick,
  onBack,
  showBack = true,
  onNotificationsClick,
  onSettingsClick,
  unreadCount,
  onNavigate,
  onLogout,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [shopName, setShopName] = useState<string>(() => getSessionShop()?.name ?? 'Mi Barbería');

  // Determine current active role from prop or localStorage
  const currentRole = propRole || (typeof window !== 'undefined' && localStorage.getItem('barberos_user_role') === 'barber' ? 'barber' : 'owner');

  // Siempre usa la barbería del usuario logueado (evita mostrar una sede
  // guardada de otro dueño o sesión anterior).
  useEffect(() => {
    const user = getSessionUser();
    if (!user) return;
    apiShop
      .get()
      .then((s) => {
        setShopName(s.name);
        const token = getToken();
        if (token) saveSession(token, user, s);
      })
      .catch(() => {
        // Ignorar: se mantiene el valor por defecto
      });
  }, [isAdminSettingsOpen]);

  const handleToggleAccountMenu = () => {
    if (onProfileClick) {
      onProfileClick();
    } else {
      setIsAccountMenuOpen((prev) => !prev);
    }
  };

  const handleLogoutAction = () => {
    setIsAccountMenuOpen(false);
    if (onLogout) {
      onLogout();
    } else if (onNavigate) {
      onNavigate('login', 'push_back');
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(15,23,42,0.04)] border-b border-slate-100">
        <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 max-w-7xl mx-auto w-full relative">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {onBack && showBack && (
              <button
                type="button"
                id="btn-header-back"
                onClick={onBack}
                title="Volver a la pantalla anterior"
                aria-label="Volver a la pantalla anterior"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-200"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
            )}

            {/* Logo mark */}
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                content_cut
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-md text-base uppercase tracking-wider text-[#0f172a] truncate font-bold">
                  BarberOS
                </span>
                <span className="text-slate-400 text-[10px]">/</span>
                <button
                  type="button"
                  onClick={() => setIsAdminSettingsOpen(true)}
                  className="flex items-center gap-0.5 text-slate-700 hover:text-slate-900 py-0.5 px-1 rounded-md transition-colors cursor-pointer"
                  title="Configurar sede"
                >
                  <span className="font-label-md text-xs font-semibold truncate max-w-[100px] sm:max-w-xs md:max-w-sm">{shopName}</span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                <span className="font-label-md text-[11px] text-slate-500 truncate">En Vivo · 20s</span>
                <span className="text-slate-300 text-[10px]">•</span>
                <span className="font-label-md text-[11px] font-semibold text-slate-600 truncate">
                  {currentSection}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onSettingsClick && (
              <button
                type="button"
                id="btn-header-settings"
                onClick={onSettingsClick}
                aria-label="Configuración de Administración"
                title="Configuración de Administración"
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[22px]">settings</span>
              </button>
            )}

            <button
              type="button"
              id="btn-header-notifications"
              onClick={onNotificationsClick}
              aria-label="Notificaciones y Alertas"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
              {unreadCount !== undefined && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white font-bold text-[9px] flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile / Account Toggle Button */}
            <button
              type="button"
              id="btn-header-account-profile"
              onClick={handleToggleAccountMenu}
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="true"
              aria-label="Abrir menú de cuenta"
              title="Mi cuenta y configuración"
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition-all active:scale-95 border ${
                isAccountMenuOpen
                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/40'
                  : 'bg-[#8d4b00] hover:bg-[#723c00] text-white border-amber-700/50'
              }`}
            >
              {currentRole === 'owner' ? (
                <span className="material-symbols-outlined text-white text-[19px]">person</span>
              ) : (
                <img
                  className="w-full h-full rounded-full object-cover"
                  alt="Carlos Fade"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfZYOGJAgxMSZIvlX2W8LeWdsGH5_NQ1wvKLiDERRaDILDk80xpLQVxDaPxFWsTsMvWL5aOyl1CfTnjTtX3EZYo_vZrxtl2MkMYrBenJZWMnPgE6SzhpX4bhfLsksqHN-DrqpfBuwEZ98ZcUZjHOshc8L9_oTL8zv2k8KST4GSsHQiB-Mhjc5xETP2YZAiDz7llOuXjXFmHDO7Tbxk2O3L6LU8DgnIhf_-pR10QGsPmCXBnKwmPCNO"
                />
              )}
            </button>

            {/* Floating Account Dropdown Menu */}
            <AccountDropdownMenu
              isOpen={isAccountMenuOpen}
              onClose={() => setIsAccountMenuOpen(false)}
              role={currentRole}
              businessName={shopName}
              ownerName="Carlos Mendoza"
              barberName="Carlos Fade"
              chairLabel="Silla #1"
              onOpenBusinessSettings={() => setIsAdminSettingsOpen(true)}
              onOpenPlanModal={() => setIsPlanModalOpen(true)}
              onNavigateCommissions={() => {
                if (onNavigate) onNavigate('barbers_commissions', 'push');
              }}
              onLogout={handleLogoutAction}
            />
          </div>
        </div>
      </header>

      {/* Modal: Mi Negocio (Edición de nombre, NIT, dirección) */}
      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        initialTab="shop"
        onNavigate={onNavigate}
      />

      {/* Modal: Mi Plan (Plan actual y cambio futuro) */}
      <MyPlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        businessName={shopName}
        onNavigateToWompi={() => {
          if (onNavigate) onNavigate('wompi_plan', 'push');
        }}
      />
    </>
  );
};
