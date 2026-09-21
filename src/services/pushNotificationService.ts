export interface UpcomingAppointmentReminder {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  barberName: string;
  chair: string;
  scheduledTime: string; // e.g. "11:30 AM"
  minutesRemaining: number; // estimated minutes from now
  price: number;
  isVip?: boolean;
  reminderSent: boolean;
  sentAt?: string;
}

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  timeFormatted: string;
  type: 'appointment_reminder' | 'test' | 'vip_arrival' | 'system';
  appointmentId?: string;
  read: boolean;
}

export interface PushReminderSettings {
  enabled: boolean;
  leadTimeMinutes: number; // e.g. 15, 30, 45
  soundEnabled: boolean;
  notifyVipOnly: boolean;
  showInAppBanner: boolean;
}

const SETTINGS_KEY = 'barberos_push_reminder_settings';
const HISTORY_KEY = 'barberos_push_history';

const DEFAULT_SETTINGS: PushReminderSettings = {
  enabled: true,
  leadTimeMinutes: 15,
  soundEnabled: true,
  notifyVipOnly: false,
  showInAppBanner: true,
};

type NotificationListener = (item: PushNotificationItem) => void;

class PushNotificationService {
  private listeners: Set<NotificationListener> = new Set();
  private audioCtx: AudioContext | null = null;

  constructor() {
    // Lazy AudioContext setup on first interaction
  }

  public getSettings(): PushReminderSettings {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  }

  public saveSettings(settings: PushReminderSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Could not save push settings to localStorage', e);
    }
  }

  public isBrowserNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermission {
    if (!this.isBrowserNotificationSupported()) {
      return 'denied';
    }
    try {
      return Notification.permission;
    } catch {
      return 'default';
    }
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isBrowserNotificationSupported()) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Error requesting notification permission (possibly iframe restricted):', err);
      return 'denied';
    }
  }

  public playChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Note 1: Warm barber bell chime tone (F#5 - 740 Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(740, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // Note 2: Harmonic resolution chime (A5 - 880 Hz)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.75);
    } catch (e) {
      console.warn('Audio chime playback omitted:', e);
    }
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getHistory(): PushNotificationItem[] {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore
    }
    return [
      {
        id: 'hist-init-1',
        title: '✂️ Cita en 15 minutos: Camilo Gómez',
        body: 'Corte Degradé + Barba con David Morales en Silla #2 (11:30 AM).',
        timestamp: Date.now() - 1000 * 60 * 18,
        timeFormatted: 'Hace 18 min',
        type: 'appointment_reminder',
        appointmentId: 'apt-camilo',
        read: true,
      },
      {
        id: 'hist-init-2',
        title: '⭐ Cliente VIP Agendado: Roberto Mejía',
        body: 'Recordatorio programado para las 12:00 PM con Mateo Castro.',
        timestamp: Date.now() - 1000 * 60 * 45,
        timeFormatted: 'Hace 45 min',
        type: 'vip_arrival',
        appointmentId: 'apt-roberto',
        read: true,
      },
    ];
  }

  public saveHistory(items: PushNotificationItem[]): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
    } catch (e) {
      console.warn('Failed to save notification history', e);
    }
  }

  public sendNotification(
    title: string,
    body: string,
    type: PushNotificationItem['type'] = 'appointment_reminder',
    appointmentId?: string
  ): PushNotificationItem {
    const settings = this.getSettings();

    // Sound alert
    if (settings.soundEnabled) {
      this.playChime();
    }

    // Try native system push notification
    if (this.isBrowserNotificationSupported() && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: appointmentId || `barberos-push-${Date.now()}`,
        });
      } catch (err) {
        console.warn('Native notification instantiation error, using in-app push fallback:', err);
      }
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const notificationItem: PushNotificationItem = {
      id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      body,
      timestamp: Date.now(),
      timeFormatted,
      type,
      appointmentId,
      read: false,
    };

    // Save to history
    const history = [notificationItem, ...this.getHistory()];
    this.saveHistory(history);

    // Notify listeners asynchronously for in-app banner display to avoid React setState-in-render conflicts
    setTimeout(() => {
      this.listeners.forEach((listener) => {
        try {
          listener(notificationItem);
        } catch (e) {
          console.error('Error in push listener:', e);
        }
      });
    }, 0);

    return notificationItem;
  }
}

export const pushService = new PushNotificationService();
