import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmExitModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export const ConfirmExitModal: React.FC<ConfirmExitModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = '¿Estás seguro de que quieres salir?',
  message = 'Estás a punto de cerrar tu sesión actual y volver a la pantalla principal de acceso. ¿Deseas continuar?',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            id="modal-confirm-exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-exit-title"
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 overflow-hidden z-10 select-none"
          >
            {/* Ambient accent header */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  logout
                </span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3
                  id="confirm-exit-title"
                  className="font-headline-md text-base font-bold text-slate-900 leading-snug"
                >
                  {title}
                </h3>
                <p className="font-body-sm text-xs text-slate-600 mt-1 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Warning info banner */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 mb-5 text-[11px] text-slate-600">
              <span className="material-symbols-outlined text-amber-600 text-sm shrink-0">
                shield
              </span>
              <span>Los datos de cortes, caja y clientes de hoy se conservan automáticamente.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-cancel-exit"
                onClick={onCancel}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-label-md text-xs font-semibold transition-all cursor-pointer text-center"
              >
                Permanecer aquí
              </button>
              <button
                type="button"
                id="btn-confirm-exit"
                onClick={onConfirm}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-98 text-white font-label-md text-xs font-bold transition-all shadow-sm cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Sí, salir</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
