import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, TransitionType } from '../types';
import { pushService } from '../services/pushNotificationService';
import {
  getSessionUser,
  getSessionShop,
  apiAppointments,
  apiServices,
  apiBarbers,
  apiSales,
  apiShop,
  Appointment,
  Barber,
  Sale,
} from '../services/api';

interface BarberCheckoutScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

interface ServiceItem {
  id: string;
  name: string;
  category: 'cortes' | 'barba' | 'combos' | 'productos' | 'quimicos';
  price: number;
  commissionRate: number; // 0.50 = 50%
  icon: string;
  popular?: boolean;
}

interface CartItem {
  service: ServiceItem;
  quantity: number;
}

interface BarberCompletedSale {
  id: string;
  time: string;
  clientName: string;
  services: string[];
  total: number;
  barberCommission: number;
  tip: number;
  netBarberEarnings: number;
  paymentMethod: 'efectivo' | 'nequi' | 'tarjeta' | 'caja_central';
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = localDate(new Date());
const fmtCOP = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  tarjeta: 'Llave Bre-B',
  caja_central: 'Caja Central',
};

const barberCommissionOf = (
  barber: Barber | null,
  subtotal: number,
  byServiceRate: number,
): number => {
  if (!barber) return byServiceRate;
  const scheme = barber.commission_scheme;
  const value = barber.commission_value;
  if (scheme === 'fixed') return Math.round(Number(value) || 0);
  if (scheme === 'none') return 0;
  if (scheme === 'percentage' && value !== null && value !== undefined) {
    return Math.round((subtotal * Number(value)) / 100);
  }
  return byServiceRate;
};

const catOf = (cat: string | null): 'cortes' | 'barba' | 'combos' | 'productos' | 'quimicos' => {
  const c = (cat || '').toLowerCase();
  if (c.includes('barba') || c.includes('perfil')) return 'barba';
  if (c.includes('combo')) return 'combos';
  if (c.includes('producto')) return 'productos';
  if (c.includes('quimico') || c.includes('tinte') || c.includes('color') || c.includes('plata')) return 'quimicos';
  return 'cortes';
};

const iconOf = (cat: 'cortes' | 'barba' | 'combos' | 'productos' | 'quimicos'): string =>
  cat === 'barba'
    ? 'face'
    : cat === 'combos'
      ? 'workspace_premium'
      : cat === 'productos'
        ? 'shopping_bag'
        : cat === 'quimicos'
          ? 'palette'
          : 'content_cut';

const mapSaleToView = (s: Sale): BarberCompletedSale => ({
  id: s.id,
  time: new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
  clientName: s.client_name || 'Cliente',
  services: s.items.map((it) => (it.qty > 1 ? `${it.name} (x${it.qty})` : it.name)),
  total: Math.round(Number(s.total || 0)),
  barberCommission: Math.round(s.items.reduce((acc, it) => acc + Number(it.commission || 0), 0)),
  tip: Math.round(Number(s.tip || 0)),
  netBarberEarnings: Math.round(Number(s.barber_earnings || 0)),
  paymentMethod: (['efectivo', 'nequi', 'tarjeta', 'caja_central'].includes(s.payment_method)
    ? s.payment_method
    : 'efectivo') as BarberCompletedSale['paymentMethod'],
});

export const BarberCheckoutScreen: React.FC<BarberCheckoutScreenProps> = ({ onNavigate, onBack }) => {
  const [sessionUser] = useState(() => getSessionUser());
  const [activeTab, setActiveTab] = useState<'checkout' | 'history'>('checkout');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>(sessionUser?.barberId || '');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Client info
  const [clientType, setClientType] = useState<'chair' | 'next' | 'custom'>('chair');
  const [customClientName, setCustomClientName] = useState('');
  const [customClientPhone, setCustomClientPhone] = useState('+57 312 ');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Tip & Payment
  const [tipAmount, setTipAmount] = useState<number>(5000);
  const [customTip, setCustomTip] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'nequi' | 'tarjeta'>('efectivo');
  const [receivedCash, setReceivedCash] = useState<number>(50000);
  const [customReceivedCash, setCustomReceivedCash] = useState<string>('');
  const [showNequiQrModal, setShowNequiQrModal] = useState(false);

  // Datos de pago configurados por el admin (llave Bre-B / Nequi y QR)
  const sessionShop = getSessionShop();
  const [payNumber, setPayNumber] = useState<string>(
    typeof sessionShop?.settings?.payNumber === 'string' ? sessionShop.settings.payNumber : '312 456 7890',
  );
  const [payQr, setPayQr] = useState<string>(
    typeof sessionShop?.settings?.payQr === 'string' ? sessionShop.settings.payQr : '',
  );
  const [brebNumber, setBrebNumber] = useState<string>(
    typeof sessionShop?.settings?.brebNumber === 'string' ? sessionShop.settings.brebNumber : '',
  );
  const [brebQr, setBrebQr] = useState<string>(
    typeof sessionShop?.settings?.brebQr === 'string' ? sessionShop.settings.brebQr : '',
  );

  // Success state
  const [completedSale, setCompletedSale] = useState<BarberCompletedSale | null>(null);
  const [salesHistory, setSalesHistory] = useState<BarberCompletedSale[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const load = useCallback(async () => {
    const u = getSessionUser();
    try {
      const [svc, barb, apts, sales, shop] = await Promise.all([
        apiServices.list(),
        apiBarbers.list(),
        apiAppointments.list({ from: today, to: today, barberId: u?.barberId ?? undefined }),
        apiSales.list({ from: today, to: today, barberId: u?.barberId ?? undefined }),
        apiShop.get(),
      ]);
      const shopSettings = (shop.settings ?? {}) as Record<string, unknown>;
      if (typeof shopSettings.payNumber === 'string') setPayNumber(shopSettings.payNumber);
      if (typeof shopSettings.payQr === 'string') setPayQr(shopSettings.payQr);
      if (typeof shopSettings.brebNumber === 'string') setBrebNumber(shopSettings.brebNumber);
      if (typeof shopSettings.brebQr === 'string') setBrebQr(shopSettings.brebQr);
      const activeBarbers = barb.filter((b) => b.active);
      const svcItems: ServiceItem[] = svc
        .filter((s) => s.active)
        .map((s) => {
          const cat = catOf(s.category);
          return {
            id: s.id,
            name: s.name,
            category: cat,
            price: Number(s.price),
            commissionRate: Number(s.commission_rate) / 100,
            icon: iconOf(cat),
          };
        });
      setServices(svcItems);
      setBarbers(activeBarbers);
      setAppointments(apts);
      if (u?.barberId && activeBarbers.some((b) => b.id === u.barberId)) {
        setSelectedBarberId(u.barberId);
      } else if (activeBarbers.length > 0) {
        setSelectedBarberId(activeBarbers[0].id);
      }
      const mine = apts.filter((a) => !u?.barberId || a.barber_id === u.barberId);
      const tgt = mine.find((a) => a.status === 'en_corte') || mine.find((a) => a.status === 'confirmada') || mine.find((a) => a.status === 'pendiente') || null;
      if (tgt) {
        const matched = svcItems.find(
          (s) => s.name.toLowerCase() === (tgt.service_name || '').toLowerCase().trim(),
        );
        const chairService: ServiceItem =
          matched || {
            id: `apt-${tgt.id}`,
            name: tgt.service_name || 'Servicio',
            category: 'cortes',
            price: Number(tgt.price),
            commissionRate: 0.5,
            icon: 'content_cut',
          };
        setCart([{ service: chairService, quantity: 1 }]);
        setClientType(tgt.status === 'en_corte' ? 'chair' : 'next');
      }
      setSalesHistory(sales.map(mapSaleToView));
    } catch (err) {
      showToast(`No se pudo cargar el punto de venta: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedBarber = barbers.find((b) => b.id === selectedBarberId) || null;
  const barberDisplayName = selectedBarber?.name || sessionUser?.fullName || 'Barbero';
  const chairDisplay = selectedBarber?.chair || 'Silla #1';

  const myBarberAppointments = useMemo(
    () => appointments.filter((a) => !sessionUser?.barberId || a.barber_id === sessionUser.barberId),
    [appointments, sessionUser],
  );
  const chairAppt = myBarberAppointments.find((a) => a.status === 'en_corte') || null;
  const nextAppt =
    myBarberAppointments
      .filter((a) => a.status === 'confirmada' || a.status === 'pendiente')
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] || null;
  const saleAppointment = clientType === 'chair' ? chairAppt : clientType === 'next' ? nextAppt : null;

  // Calculations
  const getClientName = () => {
    if (clientType === 'chair') return chairAppt?.client_name || 'Cliente en Silla';
    if (clientType === 'next') return nextAppt?.client_name || 'Cliente en Fila';
    return customClientName.trim() || 'Cliente en Silla';
  };

  const getClientPhone = () => {
    if (clientType === 'chair') return chairAppt?.phone || '';
    if (clientType === 'next') return nextAppt?.phone || '';
    return customClientPhone;
  };

  const subtotal = Math.round(cart.reduce((acc, item) => acc + Number(item.service.price) * item.quantity, 0));
  const myBarber = barbers.find((b) => b.id === selectedBarberId) || null;
  const legacyCommission = Math.round(
    cart.reduce(
      (acc, item) => acc + Math.round(Number(item.service.price) * item.quantity * item.service.commissionRate),
      0,
    ),
  );
  const totalBarberCommission = barberCommissionOf(myBarber, subtotal, legacyCommission);
  const activeTip = Math.round(customTip !== '' ? Number(customTip) || 0 : tipAmount);
  const grandTotal = subtotal + activeTip;
  const barberTotalEarnings = totalBarberCommission + activeTip;

  const actualCashGiven = customReceivedCash !== '' ? Math.round(Number(customReceivedCash) || 0) : Math.round(receivedCash);
  const cashChange = Math.max(0, actualCashGiven - grandTotal);

  const chairClientShort = chairAppt ? chairAppt.client_name.split(' ')[0] : 'Silla libre';
  const nextClientShort = nextAppt ? nextAppt.client_name.split(' ')[0] : 'Sin turnos';

  // Cart operations
  const handleAddService = (service: ServiceItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.service.id === service.id);
      if (existing) {
        return prev.map((item) =>
          item.service.id === service.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { service, quantity: 1 }];
    });
    showToast(`+ ${service.name} agregado al cobro`);
  };

  const handleRemoveItem = (serviceId: string) => {
    setCart((prev) => prev.filter((item) => item.service.id !== serviceId));
  };

  const handleUpdateQuantity = (serviceId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.service.id === serviceId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Confirm and complete sale
  const handleFinalizeCheckout = async () => {
    if (cart.length === 0) {
      showToast('Agrega al menos un servicio o producto para cobrar');
      return;
    }
    setProcessing(true);
    try {
      pushService.playChime();
      const created = await apiSales.create({
        barberId: selectedBarberId || undefined,
        clientId: saleAppointment?.client_id ?? undefined,
        clientName: getClientName(),
        appointmentId: saleAppointment?.id,
        items: cart.map((item) => ({
          serviceId: item.service.id.startsWith('apt-') ? undefined : item.service.id,
          name: item.service.name,
          qty: item.quantity,
          price: item.service.price,
        })),
        paymentMethod,
        tip: activeTip,
        cashReceived: paymentMethod === 'efectivo' ? actualCashGiven : undefined,
      });

      const newSale: BarberCompletedSale = {
        id: created.id,
        time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        clientName: getClientName(),
        services: cart.map((c) => (c.quantity > 1 ? `${c.service.name} (x${c.quantity})` : c.service.name)),
        total: Math.round(created.total),
        barberCommission: Math.round(created.barberEarnings - created.tip),
        tip: Math.round(created.tip),
        netBarberEarnings: Math.round(created.barberEarnings),
        paymentMethod,
      };

      setCompletedSale(newSale);
      setSalesHistory((prev) => [newSale, ...prev]);
      setCart([]);
      setTipAmount(0);
      setCustomTip('');
      setCustomReceivedCash('');
      showToast(`Cobro registrado: ${fmtCOP(created.total)} COP`);
    } catch (err) {
      showToast(`No se pudo registrar el cobro: ${(err as Error).message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendWhatsAppReceipt = (sale: BarberCompletedSale) => {
    const text = encodeURIComponent(
      `💈 *${getSessionShop()?.name || 'Mi barbería'} - Comprobante Digital*\n` +
        `Hola ${sale.clientName}, gracias por atenderte hoy con *${barberDisplayName} (${chairDisplay})*.\n\n` +
        `✂️ *Servicios:* ${sale.services.join(', ')}\n` +
        `💵 *Total Pagado:* $${sale.total.toLocaleString('es-CO')} COP\n` +
        `💳 *Método:* ${(PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod).toUpperCase()}\n` +
        `⭐ *Recibo:* #${sale.id} | ${sale.time}\n\n` +
        `¡Esperamos verte pronto de nuevo!`
    );
    const cleanPhone = getClientPhone().replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${text}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // Fallback
    }
  };

  const handleResetForNextClient = () => {
    setCompletedSale(null);
    setCart([]);
    setTipAmount(0);
    setCustomTip('');
    setClientType('next');
    showToast('Listo para cobrar el siguiente turno');
  };

  // Filtered services
  const filteredServices =
    selectedCategory === 'todos'
      ? services
      : services.filter((s) => s.category === selectedCategory);

  // History stats
  const totalCommissionToday = salesHistory.reduce((acc, s) => acc + s.barberCommission, 0);
  const totalTipsToday = salesHistory.reduce((acc, s) => acc + s.tip, 0);
  const totalBarberEarningsToday = totalCommissionToday + totalTipsToday;
  const totalChargedToday = salesHistory.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col pt-safe pb-safe select-none">
      {/* Exclusive Barber POS Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white px-4 sm:px-6 py-3 shadow-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBack ? (
              <button
                type="button"
                id="btn-barber-checkout-back"
                onClick={onBack}
                title="Volver a la terminal"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-700"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('barber_terminal', 'push_back')}
                title="Volver a la terminal"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-700"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
            )}

            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-xs">
              <span className="material-symbols-outlined text-[19px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                point_of_sale
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-headline-md text-sm font-bold text-white leading-none">
                  Cobro en Silla
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[9px] uppercase tracking-wider">
                  Barbero
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {barberDisplayName}{selectedBarber?.chair ? ` · ${selectedBarber.chair}` : ''} (Comisión 50%)
              </span>
            </div>
          </div>

          {/* Quick exit / switch */}
          <button
            type="button"
            onClick={() => onNavigate('barber_terminal', 'push_back')}
            className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">view_agenda</span>
            <span>Mi Agenda</span>
          </button>
        </div>

        {/* Tab switch */}
        <div className="max-w-5xl mx-auto w-full flex border-t border-slate-800 mt-2.5 pt-2 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('checkout')}
            className={`pb-1 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'checkout'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">payments</span>
            <span>Nuevo Cobro</span>
            {cart.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-1 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            <span>Mis Cobros Hoy</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {salesHistory.length}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full pb-28 bg-[#f8fafc]">
        <div className="flex flex-col w-full px-4 sm:px-6 py-4 gap-4 max-w-5xl mx-auto">
          {activeTab === 'checkout' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
              {/* Left Column (Customer & Services Touch Catalog) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
              {/* SECTION 1: Client in Chair Selector */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">person</span>
                    <span>1. Cliente a Cobrar</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Turno Actual
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    Barbero
                  </span>
                  <select
                    value={selectedBarberId}
                    onChange={(e) => setSelectedBarberId(e.target.value)}
                    className="flex-1 min-w-0 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">Selecciona un barbero</option>
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.chair ? ` · ${b.chair}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setClientType('chair')}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      clientType === 'chair'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase opacity-85">En {chairDisplay}</span>
                    <span className="font-bold text-xs truncate block mt-0.5">{chairClientShort}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientType('next')}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      clientType === 'next'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase opacity-85">
                      {nextAppt ? `Cita ${fmtTime(nextAppt.start_at)}` : 'Siguiente'}
                    </span>
                    <span className="font-bold text-xs truncate block mt-0.5">{nextClientShort}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientType('custom')}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      clientType === 'custom'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase opacity-85">Otro Cliente</span>
                    <span className="font-bold text-xs truncate block mt-0.5">Sin Cita / Fila</span>
                  </button>
                </div>

                {clientType === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Nombre del cliente..."
                      value={customClientName}
                      onChange={(e) => setCustomClientName(e.target.value)}
                      className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 outline-hidden"
                    />
                    <input
                      type="tel"
                      placeholder="Celular WhatsApp..."
                      value={customClientPhone}
                      onChange={(e) => setCustomClientPhone(e.target.value)}
                      className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* SECTION 2: Touch Services & Products Catalog */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">content_cut</span>
                    <span>2. Servicios & Productos Realizados</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Toca para añadir</span>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'cortes', label: 'Cortes' },
                    { id: 'barba', label: 'Barba' },
                    { id: 'combos', label: 'Combos' },
                    { id: 'productos', label: 'Productos' },
                    { id: 'quimicos', label: 'Color' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`py-1 px-2.5 rounded-full font-bold whitespace-nowrap text-[11px] transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Grid of touch-friendly service buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {loading ? (
                    <div className="col-span-2 text-center text-xs text-slate-400 py-6">
                      Cargando servicios...
                    </div>
                  ) : filteredServices.length === 0 ? (
                    <div className="col-span-2 text-center text-xs text-slate-400 py-6">
                      Sin servicios disponibles para esta categoría
                    </div>
                  ) : (
                    filteredServices.map((service) => {
                      const inCart = cart.find((item) => item.service.id === service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => handleAddService(service)}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all relative active:scale-97 cursor-pointer min-h-[78px] ${
                            inCart
                              ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400/40'
                              : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 w-full">
                            <span className="material-symbols-outlined text-[18px] text-amber-600">
                              {service.icon}
                            </span>
                            {inCart && (
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                {inCart.quantity}
                              </span>
                            )}
                          </div>

                          <div className="mt-1">
                            <span className="font-bold text-xs text-slate-900 block leading-tight truncate">
                              {service.name}
                            </span>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="font-bold text-xs text-amber-700">
                                {fmtCOP(service.price)}
                              </span>
                              <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100/70 px-1 rounded">
                                {barberCommissionOf(
                                  myBarber,
                                  Math.round(service.price),
                                  Math.round(service.price * service.commissionRate),
                                ) > 0
                                  ? `+${fmtCOP(barberCommissionOf(myBarber, Math.round(service.price), Math.round(service.price * service.commissionRate)))} com.`
                                  : 'sin com.'}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Selected Items Detail List */}
                {cart.length > 0 && (
                  <div className="mt-1 pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Resumen del Ticket ({cart.reduce((a, b) => a + b.quantity, 0)} ítems)
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {cart.map((item) => (
                        <div
                          key={item.service.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 truncate block">
                              {item.service.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {fmtCOP(item.service.price)} c/u · Tu com: +
                              {fmtCOP(
                                barberCommissionOf(
                                  myBarber,
                                  Math.round(Number(item.service.price) * item.quantity),
                                  Math.round(Number(item.service.price) * item.quantity * item.service.commissionRate),
                                ),
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.service.id, -1)}
                              className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-bold text-slate-900">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.service.id, 1)}
                              className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.service.id)}
                              className="w-6 h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer ml-0.5"
                              title="Quitar"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Tip Selection (100% for the barber) */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-500">volunteer_activism</span>
                    <span>3. Propina en Silla</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    100% tuya (Sin comisión del local)
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 2000, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setTipAmount(amount);
                        setCustomTip('');
                      }}
                      className={`py-1.5 px-1 rounded-xl text-center font-bold text-xs border transition-all cursor-pointer ${
                        tipAmount === amount && customTip === ''
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {amount === 0 ? '$0' : `$${amount / 1000}k`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTipAmount(-1);
                      if (!customTip) setCustomTip('15000');
                    }}
                    className={`py-1.5 px-1 rounded-xl text-center font-bold text-xs border transition-all cursor-pointer ${
                      customTip !== ''
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Otro
                  </button>
                </div>

                {customTip !== '' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs font-bold text-slate-600">Monto propina ($ COP):</span>
                    <input
                      type="number"
                      placeholder="Ej: 15000"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      className="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* SECTION 4: Real-time Earnings Breakdown for Barber */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-lg border border-slate-700 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">savings</span>
                    <span>Tu Ganancia en Este Cobro</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Liquidación inmediata</span>
                </div>

                <div className="flex items-baseline justify-between border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-xs text-slate-400 block">Total a Cobrar al Cliente</span>
                    <span className="font-currency-metric text-2xl font-bold text-white">
                      {fmtCOP(grandTotal)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-emerald-400 font-bold block">Tu Bolsillo (Comisión + Propina)</span>
                    <span className="font-currency-metric text-3xl font-extrabold text-emerald-400">
                      +{fmtCOP(barberTotalEarnings)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-0.5">
                  <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400">Comisión servicios:</span>
                    <span className="font-bold text-white">{fmtCOP(totalBarberCommission)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400">Propina directa:</span>
                    <span className="font-bold text-amber-400">+{fmtCOP(activeTip)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Payment Method Selection */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col gap-2.5">
                <span className="font-label-caps text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">credit_card</span>
                  <span>4. Método de Cobro</span>
                </span>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('efectivo')}
                    className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === 'efectivo'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                    <span className="font-bold text-[10px]">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('nequi')}
                    className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === 'nequi'
                        ? 'bg-[#20003c] text-white border-[#de1484] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                    <span className="font-bold text-[10px]">Nequi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('tarjeta')}
                    className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === 'tarjeta'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">key</span>
                    <span className="font-bold text-[10px]">Llave Bre-B</span>
                  </button>
                </div>

                {/* Sub-tools for selected payment method */}
                {paymentMethod === 'efectivo' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-900">Calculadora de Devuelta / Cambio</span>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        Total: {fmtCOP(grandTotal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setReceivedCash(grandTotal);
                          setCustomReceivedCash('');
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                          actualCashGiven === grandTotal
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-800 border-emerald-200'
                        }`}
                      >
                        Exacto
                      </button>
                      {[50000, 100000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setReceivedCash(amt);
                            setCustomReceivedCash('');
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                            actualCashGiven === amt && customReceivedCash === ''
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-emerald-800 border-emerald-200'
                          }`}
                        >
                          ${amt / 1000}k
                        </button>
                      ))}
                      <input
                        type="number"
                        placeholder="Otro valor..."
                        value={customReceivedCash}
                        onChange={(e) => setCustomReceivedCash(e.target.value)}
                        className="flex-1 p-1 bg-white border border-emerald-200 rounded text-xs text-slate-800 outline-hidden"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200 text-xs">
                      <span className="font-bold text-slate-700">Cambio a entregar:</span>
                      <span className="font-currency-metric text-base font-extrabold text-emerald-800">
                        {fmtCOP(cashChange)} COP
                      </span>
                    </div>
                  </div>
                )}

                {paymentMethod === 'nequi' && (
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-purple-950 block">Pago Nequi</span>
                      <span className="text-[11px] text-purple-700">
                        {payNumber} {payNumber ? `(${barberDisplayName})` : '— sin llave configurada'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNequiQrModal(true)}
                      className="py-1 px-2.5 rounded-lg bg-[#20003c] text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">qr_code</span>
                      <span>Ver QR</span>
                    </button>
                  </div>
                )}

                {paymentMethod === 'tarjeta' && (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-blue-950 block">Llave Bre-B</span>
                      <span className="text-[11px] text-blue-700">
                        {brebNumber || '— sin llave configurada'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNequiQrModal(true)}
                      className="py-1 px-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">qr_code</span>
                      <span>Ver QR</span>
                    </button>
                  </div>
                )}
              </div>

              {/* FINAL ACTION BUTTON: Confirm and Charge */}
              <div className="pt-1">
                <button
                  type="button"
                  id="btn-confirm-barber-charge"
                  onClick={handleFinalizeCheckout}
                  disabled={processing}
                  className={`w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white font-headline-md text-base font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-between px-5 active:scale-[0.99] transition-all cursor-pointer ${
                    processing ? 'opacity-70 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                    <span>{processing ? 'Procesando cobro...' : 'Confirmar y Cobrar'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-100 uppercase tracking-wide block font-medium">
                      Ganarás +{fmtCOP(barberTotalEarnings)}
                    </span>
                    <span className="text-lg font-bold font-currency-metric">
                      {fmtCOP(grandTotal)}
                    </span>
                  </div>
                </button>
              </div>
            </div>
            </div>

          ) : (
            /* TAB 2: MY CHARGES TODAY (Exclusively for this Barber) */
            <div className="flex flex-col gap-3">
              {/* Daily Barber Summary Stats */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-label-caps text-xs uppercase font-bold text-amber-800 tracking-wider">
                      Resumen de Mi Turno de Hoy
                    </span>
                    <h2 className="font-headline-md text-lg text-slate-900 font-bold">
                      {barberDisplayName} · {chairDisplay}
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    {salesHistory.length} Cobros
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div className="p-2.5 rounded-xl bg-amber-500 text-white">
                    <span className="text-[11px] font-medium opacity-90 block">Mi Ganancia Acumulada</span>
                    <span className="font-currency-metric text-2xl font-extrabold mt-0.5 block">
                      {fmtCOP(totalBarberEarningsToday)}
                    </span>
                    <span className="text-[10px] opacity-90 font-medium">
                      (Comisiones + Propinas)
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium block">Total Cobrado al Público</span>
                    <span className="font-currency-metric text-2xl font-bold text-slate-900 mt-0.5 block">
                      {fmtCOP(totalChargedToday)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Propinas: {fmtCOP(totalTipsToday)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Completed Tickets List */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  Tickets Cobrados por Mí
                </span>

                {loading ? (
                  <div className="p-3.5 rounded-xl bg-white text-center text-xs text-slate-400">
                    Cargando tus cobros de hoy...
                  </div>
                ) : salesHistory.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-white text-center text-xs text-slate-400">
                    Aún no has realizado cobros hoy
                  </div>
                ) : (
                  salesHistory.map((sale) => (
                    <div
                      key={sale.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs">{sale.clientName}</span>
                            <span className="text-[10px] text-slate-400 font-medium">· {sale.time}</span>
                          </div>
                          <span className="text-[11px] text-slate-600 block mt-0.5">{sale.services.join(', ')}</span>
                        </div>

                        <div className="text-right">
                          <span className="font-headline-md text-sm text-slate-900 font-bold block">
                            {fmtCOP(sale.total)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 block">
                            +{fmtCOP(sale.netBarberEarnings)} para ti
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase">
                            {PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod}
                          </span>
                          {sale.tip > 0 && (
                            <span className="text-[10px] text-amber-700 font-bold">
                              Propina: {fmtCOP(sale.tip)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppReceipt(sale)}
                          className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">chat</span>
                          <span>Reenviar WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* SUCCESS RECEIPT MODAL */}
      <AnimatePresence>
        {completedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Top Banner */}
              <div className="bg-emerald-600 text-white p-5 flex flex-col items-center text-center relative">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white mb-2">
                  <span className="material-symbols-outlined text-3xl">check</span>
                </div>
                <h3 className="font-headline-md text-xl font-bold">¡Cobro Exitoso!</h3>
                <span className="text-xs text-emerald-100">Ticket #{completedSale.id} · {completedSale.time}</span>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col gap-3.5 text-slate-800 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col gap-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Cliente:</span>
                    <span className="font-bold text-slate-900">{completedSale.clientName}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Servicios:</span>
                    <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">
                      {completedSale.services.join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Método de Pago:</span>
                    <span className="font-bold text-slate-900 uppercase">
                      {PAYMENT_LABEL[completedSale.paymentMethod] || completedSale.paymentMethod}
                    </span>
                  </div>
                </div>

                {/* Earnings Highlight */}
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">
                      Acreditado a tu Cuenta
                    </span>
                    <span className="font-currency-metric text-2xl font-extrabold text-amber-900">
                      +{fmtCOP(completedSale.netBarberEarnings)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-amber-800 font-semibold">
                    <span>Comisión: {fmtCOP(completedSale.barberCommission)}</span>
                    {completedSale.tip > 0 && (
                      <span className="block">+ Propina: {fmtCOP(completedSale.tip)}</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppReceipt(completedSale)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    <span>Enviar Comprobante WhatsApp al Cliente</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetForNextClient}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Cobrar Siguiente Cliente</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCompletedSale(null);
                      onNavigate('barber_terminal', 'push_back');
                    }}
                    className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 font-bold text-xs text-center cursor-pointer"
                  >
                    Volver al Terminal de Barbero
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CODIGO QR POPUP MODAL (Nequi / Llave Bre-B) */}
      <AnimatePresence>
        {showNequiQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 flex flex-col items-center text-center gap-3 text-slate-800"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  paymentMethod === 'tarjeta' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">qr_code_scanner</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  {paymentMethod === 'tarjeta' ? 'Código QR Llave Bre-B' : 'Código QR Nequi'}
                </h4>
                <p className="text-xs text-slate-500">Muestra este código al cliente en tu silla</p>
              </div>

              {(paymentMethod === 'tarjeta' ? brebQr : payQr) ? (
                <img
                  src={paymentMethod === 'tarjeta' ? brebQr : payQr}
                  alt={paymentMethod === 'tarjeta' ? 'QR Bre-B' : 'QR Nequi'}
                  className="w-48 h-48 rounded-2xl border-2 border-slate-200 object-contain bg-white p-2"
                />
              ) : (
                /* QR mock (sin imagen configurada aún) */
                <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-inner">
                  <div className="w-44 h-44 bg-slate-950 rounded-xl p-2 flex items-center justify-center relative">
                    <div className="w-full h-full bg-white rounded-lg p-2 flex flex-col justify-between">
                      <div className="flex justify-between">
                        <div className="w-8 h-8 bg-black rounded-xs" />
                        <div className="w-8 h-8 bg-black rounded-xs" />
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px]">
                          {paymentMethod === 'tarjeta' ? 'BRE-B' : 'NEQUI'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <div className="w-8 h-8 bg-black rounded-xs" />
                        <div className="w-6 h-6 bg-slate-600 rounded-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs">
                <span className="text-slate-500 block">
                  {paymentMethod === 'tarjeta' ? 'Llave Bre-B:' : 'Número de cuenta:'}
                </span>
                <span className="font-bold text-sm text-slate-900 font-mono tracking-wider">
                  {(paymentMethod === 'tarjeta' ? brebNumber : payNumber) || 'Sin configurar'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{barberDisplayName} · {chairDisplay}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowNequiQrModal(false)}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer active:scale-95"
              >
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
          <span>{toastMsg}</span>
          <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
        </div>
      )}
    </div>
  );
};