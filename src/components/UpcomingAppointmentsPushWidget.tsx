import React, { useState, useEffect } from 'react';
import {
  pushService,
  UpcomingAppointmentReminder,
  PushReminderSettings,
} from '../services/pushNotificationService';
import { PushSettingsModal } from './PushSettingsModal';
import { ScreenId, TransitionType } from '../types';
import { apiAppointments, apiBarbers } from '../services/api';

interface UpcomingAppointmentsPushWidgetProps {
  onNavigate?: (screen: ScreenId, transition?: TransitionType) => void;
  onToast: (msg: string) => void;
}

const dateKey = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const UpcomingAppointmentsPushWidget: React.FC<UpcomingAppointmentsPushWidgetProps> = ({
  onNavigate,
  onToast,
}) => {
  const [appointments, setAppointments] = useState<UpcomingAppointmentReminder[]>([]);
  const [settings, setSettings] = useState<PushReminderSettings>(pushService.getSettings());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    pushService.getPermissionStatus()
  );
  const [simulationCountdown, setSimulationCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = () => {
    setSettings(pushService.getSettings());
    setPermissionStatus(pushService.getPermissionStatus());
  };

  useEffect(() => {
    let cancelled = false;
    const fetchUpcoming = async () => {
      try {
        const today = new Date();
        const horizon = new Date(today);
        horizon.setDate(today.getDate() + 7);
        const list = await apiAppointments.list({ from: dateKey(today), to: dateKey(horizon) });
        if (cancelled) return;
        const now = Date.now();
        const upcoming = list
          .filter((a) => (a.status === 'pendiente' || a.status === 'confirmada') && new Date(a.start_at).getTime() >= now)
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
        let chairById: Record<string, string> = {};
        try {
          const barbers = await apiBarbers.list();
          chairById = barbers.reduce<Record<string, string>>((acc, b) => {
            if (b.chair) acc[b.id] = b.chair;
            return acc;
          }, {});
        } catch {
          chairById = {};
        }
        if (cancelled) return;
        setAppointments(
          upcoming.map((a) => ({
            id: a.id,
            clientName: a.client_name,
            clientPhone: a.phone ?? '',
            serviceName: a.service_name ?? 'Servicio',
            barberName: a.barber_name ?? 'Sin asignar',
            chair: a.barber_id ? chairById[a.barber_id] ?? '' : '',
            scheduledTime: new Date(a.start_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
            minutesRemaining: Math.max(0, Math.round((new Date(a.start_at).getTime() - Date.now()) / 60000)),
            price: a.price,
            isVip: false,
            reminderSent: false,
          }))
        );
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Automated background checker for upcoming appointments
  useEffect(() => {
    if (!settings.enabled) return;

    const interval = setInterval(() => {
      setAppointments((prev) => {
        const toNotify: UpcomingAppointmentReminder[] = [];
        const nextAppointments = prev.map((apt) => {
          // If VIP only is active and not VIP, skip
          if (settings.notifyVipOnly && !apt.isVip) return apt;

          // Check if appointment is inside the reminder threshold
          if (!apt.reminderSent && apt.minutesRemaining <= settings.leadTimeMinutes) {
            toNotify.push(apt);
            return {
              ...apt,
              reminderSent: true,
              sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          }
          return apt;
        });

        // Trigger notifications outside of the pure state updater function
        if (toNotify.length > 0) {
          setTimeout(() => {
            toNotify.forEach((apt) => {
              pushService.sendNotification(
                `✂️ Cita en ${apt.minutesRemaining} min: ${apt.clientName}${apt.isVip ? ' (VIP)' : ''}`,
                `${apt.serviceName} con ${apt.barberName} en ${apt.chair} (${apt.scheduledTime}).`,
                apt.isVip ? 'vip_arrival' : 'appointment_reminder',
                apt.id
              );
            });
          }, 0);
        }

        return nextAppointments;
      });
    }, 15000); // Checks every 15s

    return () => clearInterval(interval);
  }, [settings]);

  // Simulation countdown handler
  useEffect(() => {
    if (simulationCountdown === null) return;

    if (simulationCountdown > 0) {
      const timer = setTimeout(() => {
        setSimulationCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown reached 0: fire simulated push!
      pushService.sendNotification(
        '✂️ Cita en 5 min: Alejandro Vélez (Simulación)',
        'Corte Fade Platinum con Mateo Castro en Silla #1 (11:20 AM). El cliente ya está en camino.',
        'appointment_reminder',
        'simulated-apt'
      );
      onToast('🔔 ¡Alerta Push de Cita Próxima enviada con éxito!');
      setSimulationCountdown(null);
    }
  }, [simulationCountdown, onToast]);

  const handleRequestPermission = async () => {
    const perm = await pushService.requestPermission();
    setPermissionStatus(perm);
    if (perm === 'granted') {
      onToast('✅ Permisos de notificaciones push concedidos');
      pushService.sendNotification(
        '🎉 Notificaciones Push BarberOS Activadas',
        'Recibirás recordatorios automáticos de citas próximas para tu barbería.',
        'system'
      );
    } else {
      onToast('ℹ️ Notificaciones nativas bloqueadas. Usando alertas dentro de la app.');
    }
  };

  const handleTriggerManualPush = (apt: UpcomingAppointmentReminder) => {
    pushService.sendNotification(
      `🔔 Recordatorio: ${apt.clientName}${apt.isVip ? ' ⭐' : ''} a las ${apt.scheduledTime}`,
      `${apt.serviceName} con ${apt.barberName} en ${apt.chair}. Anticipación: ${apt.minutesRemaining} min.`,
      apt.isVip ? 'vip_arrival' : 'appointment_reminder',
      apt.id
    );

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apt.id
          ? {
              ...a,
              reminderSent: true,
              sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : a
      )
    );

    onToast(`Notificación Push enviada para ${apt.clientName}`);
  };

  const handleSendClientWhatsApp = (apt: UpcomingAppointmentReminder) => {
    const text = encodeURIComponent(
      `¡Hola ${apt.clientName}! Te recordamos tu cita de ${apt.serviceName} programada para hoy a las ${apt.scheduledTime} en Black Crown Barber Shop con ${apt.barberName} (${apt.chair}). ¡Te esperamos!`
    );
    const cleanPhone = apt.clientPhone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${text}`;

    // Show feedback
    onToast(`Abriendo recordatorio WhatsApp para ${apt.clientName}...`);
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // Fallback
    }
  };

  const handleTestInstantPush = () => {
    pushService.sendNotification(
      '✂️ Cita Próxima de Prueba: Juan Camilo Roa',
      'Corte Degradé + Barba Ritual con David Morales en Silla #2 (11:30 AM).',
      'test'
    );
    onToast('🔔 Notificación push de prueba emitida');
  };

  const handleStartSimulation = () => {
    setSimulationCountdown(5);
    onToast('⏳ Simulando cita inminente en 5 segundos...');
  };

  return (
    <section className="flex flex-col gap-2.5" id="section-push-reminders">
      {/* Header with status pill and controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span
              className="material-symbols-outlined text-[20px] text-amber-600"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              notifications_active
            </span>
            {settings.enabled && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <span className="font-headline-md text-xl text-[#0f172a] font-bold">
            Recordatorios Push de Citas
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            title="Configurar recordatorios push"
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex flex-col gap-3">
        {/* Status Bar */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                settings.enabled ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300'
              }`}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-xs font-bold text-slate-800 truncate">
                {settings.enabled
                  ? `Servicio Push Activo (${settings.leadTimeMinutes} min antes)`
                  : 'Servicio en Pausa'}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {permissionStatus === 'granted'
                  ? 'Nativo del Navegador + Audio'
                  : 'Modo In-App + Audio Chime'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {permissionStatus !== 'granted' && (
              <button
                type="button"
                id="btn-request-push-perm"
                onClick={handleRequestPermission}
                className="py-1 px-2 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] active:scale-95 transition-all cursor-pointer shadow-2xs"
              >
                Permitir Web Push
              </button>
            )}
            <button
              type="button"
              id="btn-test-push-notification"
              onClick={handleTestInstantPush}
              title="Disparar notificación de prueba"
              className="py-1 px-2 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] active:scale-95 transition-all cursor-pointer"
            >
              Probar Push
            </button>
          </div>
        </div>

        {/* Upcoming Appointments List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Próximas en Agenda ({appointments.length})</span>
            <button
              type="button"
              onClick={() => onNavigate?.('agenda_general', 'push')}
              className="text-amber-700 hover:underline cursor-pointer font-bold lowercase first-letter:uppercase"
            >
              Ver agenda completa →
            </button>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400">Consultando citas próximas...</div>
          ) : appointments.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No hay citas próximas en los próximos 7 días</div>
          ) : (
            appointments.map((apt) => (
            <div
              key={apt.id}
              className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                apt.reminderSent
                  ? 'bg-slate-50/80 border-slate-200'
                  : apt.minutesRemaining <= settings.leadTimeMinutes
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Appointment Top Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      apt.isVip
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {apt.isVip ? '⭐' : apt.clientName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs truncate">{apt.clientName}</span>
                      {apt.isVip && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] uppercase tracking-wide">
                          VIP
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-600 block truncate">{apt.serviceName}</span>
                  </div>
                </div>

                {/* Remaining Time Badge */}
                <div className="flex flex-col items-end shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      apt.reminderSent
                        ? 'bg-emerald-100 text-emerald-800'
                        : apt.minutesRemaining <= 15
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {apt.reminderSent ? 'Enviado' : `En ${apt.minutesRemaining} min`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold mt-0.5">{apt.scheduledTime}</span>
                </div>
              </div>

              {/* Middle details: Barber & Chair */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-amber-600">person</span>
                  <span className="truncate">{apt.barberName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                    {apt.chair}
                  </span>
                  <span className="font-bold text-slate-800">${apt.price.toLocaleString('es-CO')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">
                    {apt.reminderSent ? 'done_all' : 'alarm'}
                  </span>
                  <span className="truncate">
                    {apt.reminderSent
                      ? `Push enviado (${apt.sentAt || 'Hoy'})`
                      : `Alerta auto: ${settings.leadTimeMinutes}m antes`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSendClientWhatsApp(apt)}
                    title="Enviar recordatorio por WhatsApp al cliente"
                    className="p-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">chat</span>
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerManualPush(apt)}
                    className="p-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] active:scale-95 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">notification_important</span>
                    <span>{apt.reminderSent ? 'Reenviar Push' : 'Enviar Push'}</span>
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
        </div>

        {/* Live Simulation Trigger (Probar flujo automático) */}
        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0">schedule</span>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-[11px] block truncate">
                Simulador de Cita Inminente
              </span>
              <span className="text-[10px] text-slate-600 truncate block">
                Comprueba la llegada del push con sonido y banner en vivo
              </span>
            </div>
          </div>
          <button
            type="button"
            id="btn-simulate-upcoming-push"
            disabled={simulationCountdown !== null}
            onClick={handleStartSimulation}
            className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-[11px] shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            {simulationCountdown !== null ? `En ${simulationCountdown}s...` : 'Simular en 5s'}
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <PushSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSettingsChanged={refreshSettings}
      />
    </section>
  );
};
