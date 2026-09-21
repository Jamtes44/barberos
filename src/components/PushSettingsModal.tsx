import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  pushService,
  PushReminderSettings,
  PushNotificationItem,
} from '../services/pushNotificationService';
import { api, apiShop, getSessionShop, saveSession } from '../services/api';

interface PushSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

const SHOP_SETTINGS_KEY = 'pushReminders';

const DEFAULT_REMINDER_SETTINGS: PushReminderSettings = {
  enabled: true,
  leadTimeMinutes: 15,
  soundEnabled: true,
  notifyVipOnly: false,
  showInAppBanner: true,
};

const readInitialSettings = (): PushReminderSettings => {
  const shop = getSessionShop();
  const stored = shop?.settings?.[SHOP_SETTINGS_KEY];
  if (stored && typeof stored === 'object') {
    return { ...DEFAULT_REMINDER_SETTINGS, ...(stored as Partial<PushReminderSettings>) };
  }
  return { ...DEFAULT_REMINDER_SETTINGS, ...pushService.getSettings() };
};

export const PushSettingsModal: React.FC<PushSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsChanged,
}) => {
  const [settings, setSettings] = useState<PushReminderSettings>(readInitialSettings);
  const [history, setHistory] = useState<PushNotificationItem[]>(pushService.getHistory());
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    pushService.getPermissionStatus()
  );
  const [testingChime, setTestingChime] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(readInitialSettings());
      setSaveFeedback(null);
    }
  }, [isOpen]);

  const persistSettings = async (updated: PushReminderSettings): Promise<boolean> => {
    pushService.saveSettings(updated);
    try {
      let shop = getSessionShop();
      let currentSettings = shop?.settings ?? {};
      if (!shop) {
        shop = await apiShop.get();
        currentSettings = shop?.settings ?? {};
      }
      const merged = { ...currentSettings, [SHOP_SETTINGS_KEY]: updated };
      const saved = await apiShop.update({ settings: merged });
      const token = api.token();
      const user = api.user();
      if (token && user) saveSession(token, user, saved);
      return true;
    } catch {
      return false;
    }
  };

  const handleToggleEnabled = async () => {
    const updated = { ...settings, enabled: !settings.enabled };
    setSettings(updated);
    const ok = await persistSettings(updated);
    setSaveFeedback(
      ok
        ? { ok, msg: 'Ajustes guardados en la nube' }
        : { ok, msg: 'No se pudieron guardar los ajustes. Intenta de nuevo.' }
    );
    onSettingsChanged();
  };

  const handleLeadTimeChange = async (minutes: number) => {
    const updated = { ...settings, leadTimeMinutes: minutes };
    setSettings(updated);
    const ok = await persistSettings(updated);
    setSaveFeedback(
      ok
        ? { ok, msg: 'Ajustes guardados en la nube' }
        : { ok, msg: 'No se pudieron guardar los ajustes. Intenta de nuevo.' }
    );
    onSettingsChanged();
  };

  const handleToggleSound = async () => {
    const updated = { ...settings, soundEnabled: !settings.soundEnabled };
    setSettings(updated);
    const ok = await persistSettings(updated);
    setSaveFeedback(
      ok
        ? { ok, msg: 'Ajustes guardados en la nube' }
        : { ok, msg: 'No se pudieron guardar los ajustes. Intenta de nuevo.' }
    );
    onSettingsChanged();
  };

  const handleToggleVip = async () => {
    const updated = { ...settings, notifyVipOnly: !settings.notifyVipOnly };
    setSettings(updated);
    const ok = await persistSettings(updated);
    setSaveFeedback(
      ok
        ? { ok, msg: 'Ajustes guardados en la nube' }
        : { ok, msg: 'No se pudieron guardar los ajustes. Intenta de nuevo.' }
    );
    onSettingsChanged();
  };

  const handleTestSound = () => {
    setTestingChime(true);
    pushService.playChime();
    setTimeout(() => setTestingChime(false), 800);
  };

  const handleRequestPermission = async () => {
    const result = await pushService.requestPermission();
    setPermissionStatus(result);
    onSettingsChanged();
  };

  const handleClearHistory = () => {
    pushService.saveHistory([]);
    setHistory([]);
    onSettingsChanged();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh] select-none"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
                  <span className="material-symbols-outlined text-xl">notifications_active</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-base font-bold text-slate-900 leading-none">
                    Configurar Notificaciones Push
                  </h3>
                  <span className="text-[11px] text-slate-500">Recordatorios de citas para el Dueño</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`pb-2 text-xs font-label-md font-bold transition-all relative cursor-pointer ${
                  activeTab === 'settings'
                    ? 'text-amber-700 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ajustes del Recordatorio
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistory(pushService.getHistory());
                  setActiveTab('history');
                }}
                className={`pb-2 text-xs font-label-md font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'text-amber-700 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Historial de Envíos</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600">
                  {history.length}
                </span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-slate-800 text-xs">
              {activeTab === 'settings' ? (
                <>
                  {/* Master Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                    <div>
                      <span className="font-label-lg font-bold text-slate-900 text-sm block">
                        Recordatorios Automáticos Push
                      </span>
                      <span className="text-slate-600 text-[11px]">
                        Notificar automáticamente cuando una cita esté por comenzar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleEnabled}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        settings.enabled ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                      aria-pressed={settings.enabled}
                    >
                      <motion.div
                        layout
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`bg-white w-4 h-4 rounded-full shadow-md ${
                          settings.enabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Browser Permission Status */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`material-symbols-outlined text-[20px] ${
                          permissionStatus === 'granted'
                            ? 'text-emerald-600'
                            : permissionStatus === 'denied'
                            ? 'text-red-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {permissionStatus === 'granted'
                          ? 'verified_user'
                          : permissionStatus === 'denied'
                          ? 'block'
                          : 'help'}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">
                          Permisos del Navegador Web
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {permissionStatus === 'granted'
                            ? 'Permitido (recibirás notificaciones nativas)'
                            : permissionStatus === 'denied'
                            ? 'Bloqueado por el navegador (usando banner in-app)'
                            : 'Pendiente de autorización'}
                        </span>
                      </div>
                    </div>
                    {permissionStatus !== 'granted' && (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        Activar
                      </button>
                    )}
                  </div>

                  {/* Anticipation options */}
                  <div>
                    <label className="font-label-caps font-bold text-slate-600 uppercase text-[11px] block mb-2">
                      Anticipación del Recordatorio
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[15, 30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleLeadTimeChange(mins)}
                          className={`py-2 px-1 rounded-xl text-center font-bold text-xs border transition-all cursor-pointer ${
                            settings.leadTimeMinutes === mins
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-1.5">
                      Se enviará una alerta push {settings.leadTimeMinutes} minutos antes de la hora fijada.
                    </span>
                  </div>

                  {/* Audio Chime Setting */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-amber-600">volume_up</span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">Alerta Sonora (Chime)</span>
                        <span className="text-[11px] text-slate-500">
                          Tono sutil y elegante de campana al llegar la notificación
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSound}
                        title="Probar sonido"
                        className={`p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer ${
                          testingChime ? 'scale-110 text-amber-600' : ''
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">play_circle</span>
                      </button>
                      <input
                        type="checkbox"
                        checked={settings.soundEnabled}
                        onChange={handleToggleSound}
                        className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* VIP Only Filter */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-amber-500">star</span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">Prioridad Clientes VIP</span>
                        <span className="text-[11px] text-slate-500">
                          Solo enviar recordatorios push para clientes VIP o de alto ticket
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyVipOnly}
                      onChange={handleToggleVip}
                      className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                    />
                  </div>
                </>
              ) : (
                /* History Tab */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Últimos recordatorios emitidos</span>
                    {history.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        className="text-red-600 hover:underline font-bold text-[11px] cursor-pointer"
                      >
                        Limpiar historial
                      </button>
                    )}
                  </div>

                  {history.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl block mb-1">notifications_off</span>
                      <span>No hay notificaciones push registradas todavía</span>
                    </div>
                  ) : (
                    history.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-bold text-slate-900 truncate">{item.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{item.body}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.timeFormatted}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {saveFeedback && (
              <div
                className={`px-4 py-2.5 flex items-center gap-1.5 text-xs font-bold border-t ${
                  saveFeedback.ok
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {saveFeedback.ok ? 'check_circle' : 'error'}
                </span>
                <span>{saveFeedback.msg}</span>
              </div>
            )}

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-md font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Listo
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
