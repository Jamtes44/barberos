import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PushNotificationItem, pushService } from '../services/pushNotificationService';
import { ScreenId, TransitionType } from '../types';
import { api, apiAppointments, getSessionUser } from '../services/api';

interface PushNotificationBannerProps {
  onNavigate?: (screen: ScreenId, transition?: TransitionType) => void;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({ onNavigate }) => {
  const [currentNotification, setCurrentNotification] = useState<PushNotificationItem | null>(null);
  const [todayPendingCount, setTodayPendingCount] = useState(0);
  const [greetingName, setGreetingName] = useState('');
  const hasToken = api.token() !== null;

  useEffect(() => {
    const user = getSessionUser();
    setGreetingName(user?.fullName ? user.fullName.split(' ')[0] : '');
    if (!hasToken) {
      setTodayPendingCount(0);
      return;
    }
    let cancelled = false;
    const fetchToday = async () => {
      try {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const list = await apiAppointments.list({ from: today, to: today });
        if (cancelled) return;
        setTodayPendingCount(
          list.filter((a) => a.status === 'pendiente' || a.status === 'confirmada').length
        );
      } catch {
        if (!cancelled) setTodayPendingCount(0);
      }
    };
    fetchToday();
    const interval = setInterval(fetchToday, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasToken]);

  useEffect(() => {
    const unsubscribe = pushService.subscribe((item) => {
      setCurrentNotification(item);
    });
    return () => unsubscribe();
  }, []);

  // Auto-dismiss after 7 seconds
  useEffect(() => {
    if (!currentNotification) return;
    const timer = setTimeout(() => {
      setCurrentNotification(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [currentNotification]);

  const now = new Date();
  const summaryItem: PushNotificationItem = {
    id: 'banner-daily-summary',
    title: `Hola ${greetingName || 'bienvenido'} 👋`,
    body:
      todayPendingCount === 1
        ? 'Tienes 1 cita pendiente para hoy. Revisa tu agenda para estar listo.'
        : `Tienes ${todayPendingCount} citas pendientes para hoy. Revisa tu agenda para estar listo.`,
    timestamp: now.getTime(),
    timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: 'appointment_reminder',
    read: true,
  };

  const displayItem = currentNotification ?? (todayPendingCount > 0 ? summaryItem : null);

  if (!displayItem) return null;

  return (
    <AnimatePresence>
      <div className="fixed top-4 inset-x-4 max-w-md mx-auto z-[9999] pointer-events-none select-none">
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 350 }}
          className="pointer-events-auto bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-amber-500/40 p-4 overflow-hidden"
          role="alert"
          aria-live="assertive"
        >
          {/* Progress bar timer */}
          {currentNotification && (
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 7, ease: 'linear' }}
              className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-300"
            />
          )}

          <div className="flex items-start gap-3 mt-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 shadow-sm">
              <span className="material-symbols-outlined text-2xl animate-bounce">notifications_active</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Notificación Push · Recordatorio
                </span>
                <span className="text-[10px] text-slate-400">{displayItem.timeFormatted}</span>
              </div>
              <h4 className="font-headline-md text-sm font-bold text-white tracking-tight mt-0.5">
                {displayItem.title}
              </h4>
              <p className="font-body-sm text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                {displayItem.body}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentNotification(null);
                      onNavigate('agenda_general', 'push');
                    }}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-label-md font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                    <span>Ver en Agenda</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentNotification(null)}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-label-md font-medium transition-all text-center cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentNotification(null)}
              className="text-slate-400 hover:text-white p-1 -mr-1 -mt-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Cerrar notificación"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};