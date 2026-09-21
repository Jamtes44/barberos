import React from 'react';
import { ScreenId, TransitionType } from '../types';

interface BottomNavProps {
  activeTab: 'dashboard' | 'agenda' | 'caja' | 'clientes' | 'mas';
  cajaPathVariant?: 'caja' | 'caja-ventas';
  masPathVariant?: 'mas' | 'mas-opciones';
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  cajaPathVariant = 'caja-ventas',
  masPathVariant = 'mas-opciones',
  onNavigate,
}) => {
  return (
    <nav
      className="fixed bottom-0 md:bottom-4 inset-x-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-50 pb-safe md:pb-0 bg-white/95 backdrop-blur-xl shadow-[0_-1px_12px_rgba(15,23,42,0.06)] md:shadow-2xl border-t md:border border-slate-200 md:rounded-2xl w-full md:w-auto md:min-w-[480px] lg:min-w-[560px]"
      data-active-classes="text-primary font-bold"
    >
      <div className="flex justify-around items-center h-16 px-1 md:px-4 max-w-md md:max-w-2xl mx-auto md:gap-2">
        {/* Dashboard */}
        <a
          href="#dashboard"
          data-path="dashboard"
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onNavigate('owner_dashboard', 'none');
          }}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 py-1 px-1 rounded-lg transition-colors cursor-pointer active:scale-95 ${
            activeTab === 'dashboard'
              ? 'text-[#8d4b00] font-bold'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">
            {activeTab === 'dashboard' ? 'dashboard' : 'space_dashboard'}
          </span>
          <span className="font-label-md text-xs mt-0.5">Dashboard</span>
        </a>

        {/* Agenda */}
        <a
          href="#agenda"
          data-path="agenda"
          aria-current={activeTab === 'agenda' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onNavigate('agenda_general', 'none');
          }}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 py-1 px-1 rounded-lg transition-colors cursor-pointer active:scale-95 ${
            activeTab === 'agenda'
              ? 'text-[#8d4b00] font-bold'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">calendar_today</span>
          <span className="font-label-md text-xs mt-0.5">Agenda</span>
        </a>

        {/* Caja */}
        <a
          href="#caja"
          data-path={cajaPathVariant}
          aria-current={activeTab === 'caja' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onNavigate('sales_cash', 'none');
          }}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 py-1 px-1 rounded-lg transition-colors cursor-pointer active:scale-95 ${
            activeTab === 'caja'
              ? 'text-[#8d4b00] font-bold'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
          <span className="font-label-md text-xs mt-0.5">Caja</span>
        </a>

        {/* Clientes */}
        <a
          href="#clientes"
          data-path="clientes"
          aria-current={activeTab === 'clientes' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onNavigate('clients_list', 'none');
          }}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 py-1 px-1 rounded-lg transition-colors cursor-pointer active:scale-95 ${
            activeTab === 'clientes'
              ? 'text-[#8d4b00] font-bold'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">group</span>
          <span className="font-label-md text-xs mt-0.5">Clientes</span>
        </a>

        {/* Más */}
        <a
          href="#mas"
          data-path={masPathVariant}
          aria-current={activeTab === 'mas' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onNavigate('services_pricing', 'none');
          }}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 py-1 px-1 rounded-lg transition-colors cursor-pointer active:scale-95 ${
            activeTab === 'mas'
              ? 'text-[#8d4b00] font-bold'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">more_horiz</span>
          <span className="font-label-md text-xs mt-0.5">Más</span>
        </a>
      </div>
    </nav>
  );
};
