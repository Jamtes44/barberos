import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getSessionShop } from '../services/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: 'mensual' | 'anual';
}

export interface MyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
  onNavigateToWompi?: () => void;
  supportPhone?: string;
}

export const MyPlanModal: React.FC<MyPlanModalProps> = ({
  isOpen,
  onClose,
  businessName = 'Black Crown Barber Shop',
  onNavigateToWompi,
  supportPhone = '573108459920',
}) => {
  if (!isOpen) return null;

  const plan = getSessionShop()?.settings?.plan as Plan | undefined;
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + (plan?.period === 'anual' ? 365 : 30));

  const handleOpenWhatsAppSales = () => {
    const message = `Hola BarberOS 👋, soy Carlos de *${businessName}*. Quisiera consultar opciones sobre planes corporativos o cambio de plan.`;
    const url = `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[92vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-modal-title"
        >
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 shadow-2xs">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  workspace_premium
                </span>
              </div>
              <div>
                <h3 id="plan-modal-title" className="font-headline-md text-base font-bold text-slate-900 leading-none">
                  Mi Plan BarberOS
                </h3>
                <span className="text-[11px] text-slate-500">{businessName}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Cerrar modal de plan"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body content */}
          <div className="p-4 overflow-y-auto space-y-4">
            {/* Active Plan Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-900 to-slate-900 text-white shadow-md relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-xs text-emerald-300 font-bold uppercase tracking-wider">
                  Suscripción Actual
                </span>
                {plan ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-bold border border-emerald-400/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Activo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-500/40 text-slate-200 text-[10px] font-bold border border-slate-400/40 flex items-center gap-1">
                    Sin Plan
                  </span>
                )}
              </div>

              {plan ? (
                <>
                  <div className="flex items-baseline gap-1 my-1">
                    <h2 className="font-headline-lg text-2xl text-white font-bold">{plan.name}</h2>
                    <span className="text-sm text-slate-300 font-normal">
                      / {plan.period === 'anual' ? 'anual' : 'mensual'}
                    </span>
                  </div>

                  <p className="font-currency-metric text-3xl font-bold text-emerald-300">
                    ${plan.price.toLocaleString('es-CO')} <span className="text-xs font-normal text-slate-300">COP</span>
                  </p>

                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                    <span>Próxima renovación:</span>
                    <span className="font-semibold text-white">
                      {renewalDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col my-1 py-2">
                  <h2 className="font-headline-lg text-2xl text-white font-bold">Plan gratuito</h2>
                  <span className="text-sm text-slate-300 font-normal mt-1">
                    Sin plan configurado todavía
                  </span>
                </div>
              )}
            </div>

            {/* Features Included List */}
            <div className="flex flex-col gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="font-label-caps text-[11px] text-slate-600 font-bold uppercase tracking-wide">
                Incluido en tu suscripción
              </span>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span>Agenda y turnos multi-barbero ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span>Terminal de cobro en silla con cálculo de comisiones</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span>Control de caja en vivo y reportes de facturación</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span>Recordatorios de citas y alertas sonoras para el barbero</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span>Soporte prioritario 7 días a la semana por WhatsApp</span>
                </li>
              </ul>
            </div>

            {/* Próximamente: Cambiar de plan */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-900">
                <span className="material-symbols-outlined text-lg text-amber-700">info</span>
                <span className="font-label-md text-xs font-bold">
                  Próximamente: Nuevos Planes
                </span>
              </div>
              <p className="font-body-sm text-xs text-amber-950/80">
                Estamos preparando opciones de facturación anual con descuento y el nuevo <strong>Plan Franquicia</strong> para múltiples sedes.
              </p>

              <div className="flex items-center gap-2 pt-1">
                {onNavigateToWompi && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToWompi();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-label-md text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Ver Pasarela Wompi
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenWhatsAppSales}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100/60 active:scale-95 text-amber-900 border border-amber-300 font-label-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Consultar por WhatsApp</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-md text-xs font-bold transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
