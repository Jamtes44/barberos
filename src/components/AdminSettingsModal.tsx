import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, TransitionType } from '../types';
import { apiShop, getSessionShop, getSessionUser, getToken, saveSession } from '../services/api';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'shop' | 'payments' | 'team' | 'security';
  onNavigate?: (screen: ScreenId, transition?: TransitionType) => void;
  onToast?: (msg: string) => void;
}

interface ShopSettings {
  shopName: string;
  nit: string;
  phone: string;
  address: string;
  city: string;
  wompiIntegration: boolean;
  wompiKey: string;
  autoCloseCash: boolean;
  cashCloseHour: string;
  currency: string;
  commissionType: 'percentage' | 'fixed';
  defaultCommissionRate: number;
  allowChairDirectCheckout: boolean;
  pushRemindersLeadTime: number;
  dailyGoal: number;
}

const INITIAL_SETTINGS: ShopSettings = {
  shopName: 'Black Crown Barber Shop',
  nit: '901.482.391-4',
  phone: '+57 310 845 9920',
  address: 'Cra. 43A # 7D-15, El Poblado',
  city: 'Medellín, Antioquia',
  wompiIntegration: true,
  wompiKey: 'pub_prod_wompi_7942_bc91',
  autoCloseCash: true,
  cashCloseHour: '21:00',
  currency: 'COP ($)',
  commissionType: 'percentage',
  defaultCommissionRate: 50,
  allowChairDirectCheckout: true,
  pushRemindersLeadTime: 15,
  dailyGoal: 1200000,
};

function settingsFromSession(): ShopSettings {
  const shop = getSessionShop();
  const saved = shop?.settings ?? {};
  return {
    shopName: shop?.name ?? INITIAL_SETTINGS.shopName,
    nit: typeof saved.nit === 'string' ? saved.nit : INITIAL_SETTINGS.nit,
    phone: shop?.phone ?? INITIAL_SETTINGS.phone,
    address: shop?.address ?? INITIAL_SETTINGS.address,
    city: typeof saved.city === 'string' ? saved.city : INITIAL_SETTINGS.city,
    wompiIntegration: typeof saved.wompiIntegration === 'boolean' ? saved.wompiIntegration : INITIAL_SETTINGS.wompiIntegration,
    wompiKey: typeof saved.wompiKey === 'string' ? saved.wompiKey : INITIAL_SETTINGS.wompiKey,
    autoCloseCash: typeof saved.autoCloseCash === 'boolean' ? saved.autoCloseCash : INITIAL_SETTINGS.autoCloseCash,
    cashCloseHour: typeof saved.cashCloseHour === 'string' ? saved.cashCloseHour : INITIAL_SETTINGS.cashCloseHour,
    currency: typeof saved.currency === 'string' ? saved.currency : INITIAL_SETTINGS.currency,
    commissionType: saved.commissionType === 'fixed' ? 'fixed' : 'percentage',
    defaultCommissionRate: typeof saved.defaultCommissionRate === 'number' ? saved.defaultCommissionRate : INITIAL_SETTINGS.defaultCommissionRate,
    allowChairDirectCheckout: typeof saved.allowChairDirectCheckout === 'boolean' ? saved.allowChairDirectCheckout : INITIAL_SETTINGS.allowChairDirectCheckout,
    pushRemindersLeadTime: typeof saved.pushRemindersLeadTime === 'number' ? saved.pushRemindersLeadTime : INITIAL_SETTINGS.pushRemindersLeadTime,
    dailyGoal: typeof saved.dailyGoal === 'number' ? saved.dailyGoal : INITIAL_SETTINGS.dailyGoal,
  };
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'shop',
  onNavigate,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'shop' | 'payments' | 'team' | 'security'>(initialTab);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [settings, setSettings] = useState<ShopSettings>(() => settingsFromSession());
  const [isSaving, setIsSaving] = useState(false);

  const [hasChanges, setHasChanges] = useState(false);

  const handleUpdate = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const shop = getSessionShop();
      const updated = await apiShop.update({
        name: settings.shopName,
        address: settings.address,
        phone: settings.phone,
        settings: {
          ...(shop?.settings ?? {}),
          nit: settings.nit,
          city: settings.city,
          wompiIntegration: settings.wompiIntegration,
          wompiKey: settings.wompiKey,
          autoCloseCash: settings.autoCloseCash,
          cashCloseHour: settings.cashCloseHour,
          currency: settings.currency,
          commissionType: settings.commissionType,
          defaultCommissionRate: settings.defaultCommissionRate,
          allowChairDirectCheckout: settings.allowChairDirectCheckout,
          pushRemindersLeadTime: settings.pushRemindersLeadTime,
          dailyGoal: settings.dailyGoal,
        },
      });
      const token = getToken();
      const user = getSessionUser();
      if (token && user) {
        saveSession(token, user, updated);
      }
      setHasChanges(false);
      setIsSaving(false);
      if (onToast) {
        onToast('Configuración del local actualizada exitosamente');
      }
      onClose();
    } catch {
      setIsSaving(false);
      if (onToast) {
        onToast('No se pudo guardar la configuración. Revisa tu conexión e inténtalo de nuevo.');
      }
    }
  };

  const handleNavigateToSection = (screen: ScreenId) => {
    onClose();
    if (onNavigate) {
      onNavigate(screen, 'push');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
            id="modal-admin-settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-settings-title"
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shadow-2xs">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    settings
                  </span>
                </div>
                <div>
                  <h3 id="admin-settings-title" className="font-headline-md text-base font-bold text-slate-900 leading-none">
                    Configuración de Administración
                  </h3>
                  <span className="text-[11px] text-slate-500">Parámetros del negocio, cobros y permisos</span>
                </div>
              </div>

              <button
                type="button"
                id="btn-close-admin-settings"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Cerrar configuración"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-3 pt-2 gap-1 overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                id="tab-admin-shop"
                onClick={() => setActiveTab('shop')}
                className={`pb-2.5 px-3 text-xs font-label-md font-bold transition-all relative cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'shop'
                    ? 'text-amber-700 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">storefront</span>
                <span>Barbería</span>
              </button>

              <button
                type="button"
                id="tab-admin-payments"
                onClick={() => setActiveTab('payments')}
                className={`pb-2.5 px-3 text-xs font-label-md font-bold transition-all relative cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'payments'
                    ? 'text-amber-700 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Cobros & Caja</span>
              </button>

              <button
                type="button"
                id="tab-admin-team"
                onClick={() => setActiveTab('team')}
                className={`pb-2.5 px-3 text-xs font-label-md font-bold transition-all relative cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'team'
                    ? 'text-amber-700 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>Equipo & Sillas</span>
              </button>

              <button
                type="button"
                id="tab-admin-security"
                onClick={() => setActiveTab('security')}
                className={`pb-2.5 px-3 text-xs font-label-md font-bold transition-all relative cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'security'
                    ? 'text-amber-700 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shield</span>
                <span>Seguridad</span>
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: SHOP PROFILE */}
              {activeTab === 'shop' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block mb-3">
                      Identidad del Negocio
                    </span>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nombre Comercial
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
                            store
                          </span>
                          <input
                            type="text"
                            value={settings.shopName}
                            onChange={(e) => handleUpdate('shopName', e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            NIT o Cédula
                          </label>
                          <input
                            type="text"
                            value={settings.nit}
                            onChange={(e) => handleUpdate('nit', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Teléfono / WhatsApp
                          </label>
                          <input
                            type="text"
                            value={settings.phone}
                            onChange={(e) => handleUpdate('phone', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Dirección del Local
                        </label>
                        <input
                          type="text"
                          value={settings.address}
                          onChange={(e) => handleUpdate('address', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ciudad y Departamento
                        </label>
                        <input
                          type="text"
                          value={settings.city}
                          onChange={(e) => handleUpdate('city', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operational Daily Goals */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block mb-3">
                      Meta de Ventas Diaria
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Objetivo del Día (COP)
                        </label>
                        <input
                          type="number"
                          value={settings.dailyGoal}
                          onChange={(e) => handleUpdate('dailyGoal', Number(e.target.value))}
                          step="50000"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="pt-5 text-xs text-slate-500 font-medium">
                        Referencia en gráficos de caja
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PAYMENTS & CASH */}
              {activeTab === 'payments' && (
                <div className="space-y-4">
                  {/* Wompi Integration */}
                  <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-700 text-xl">account_balance_wallet</span>
                        <span className="font-label-md text-xs font-bold text-amber-950">
                          Pasarela Wompi Bancolombia
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdate('wompiIntegration', !settings.wompiIntegration)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          settings.wompiIntegration ? 'bg-amber-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            settings.wompiIntegration ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                      Permite cobro con QR Bancolombia, Nequi y tarjetas directo desde el terminal o la silla.
                    </p>
                    {settings.wompiIntegration && (
                      <div className="mt-2 pt-2 border-t border-amber-200/60">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Llave Pública Wompi (Producción)
                        </label>
                        <input
                          type="text"
                          value={settings.wompiKey}
                          onChange={(e) => handleUpdate('wompiKey', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 font-mono focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Cash Closing Policy */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block">
                      Políticas de Cuadre y Cierre
                    </span>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Cierre Automático Diario</div>
                        <div className="text-[11px] text-slate-500">Bloquea caja y genera arqueo a la hora pactada</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdate('autoCloseCash', !settings.autoCloseCash)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          settings.autoCloseCash ? 'bg-amber-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            settings.autoCloseCash ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {settings.autoCloseCash && (
                      <div className="flex items-center gap-3 pt-2">
                        <label className="text-xs font-semibold text-slate-700">Hora límite de corte:</label>
                        <input
                          type="time"
                          value={settings.cashCloseHour}
                          onChange={(e) => handleUpdate('cashCloseHour', e.target.value)}
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                        />
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Cobro Directo en Silla</div>
                        <div className="text-[11px] text-slate-500">Habilitar cobro rápido para los barberos</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdate('allowChairDirectCheckout', !settings.allowChairDirectCheckout)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          settings.allowChairDirectCheckout ? 'bg-amber-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            settings.allowChairDirectCheckout ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Direct Link to Services & Pricing */}
                  <button
                    type="button"
                    onClick={() => handleNavigateToSection('services_pricing')}
                    className="w-full py-2.5 px-3 bg-white border border-slate-300 hover:border-amber-500 rounded-xl flex items-center justify-between text-slate-800 text-xs font-semibold hover:bg-amber-50/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-lg">dry_cleaning</span>
                      <span>Configurar Catálogo de Servicios y Precios</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-base">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* TAB 3: TEAM & COMMISSIONS */}
              {activeTab === 'team' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block">
                      Esquema de Comisiones Base
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate('commissionType', 'percentage')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                          settings.commissionType === 'percentage'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Porcentaje (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate('commissionType', 'fixed')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                          settings.commissionType === 'fixed'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Monto Fijo ($)
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="text-xs font-semibold text-slate-700">Comisión Estándar para Barberos:</label>
                      <div className="flex items-center gap-1.5 w-24">
                        <input
                          type="number"
                          value={settings.defaultCommissionRate}
                          onChange={(e) => handleUpdate('defaultCommissionRate', Number(e.target.value))}
                          className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-right"
                        />
                        <span className="text-xs font-bold text-slate-600">
                          {settings.commissionType === 'percentage' ? '%' : 'COP'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sillas Activas */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold">
                        Sillas de Corte Registradas (4)
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        Todas Operativas
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold">Silla 1 - Principal</span>
                        <span className="text-slate-500">Mateo Castro (Master)</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold">Silla 2 - Degradé & Barba</span>
                        <span className="text-slate-500">David Morales</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold">Silla 3 - Clásico & Tijera</span>
                        <span className="text-slate-500">Andrés Silva</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold">Silla 4 - Libre / Rotativa</span>
                        <span className="text-amber-600 font-semibold">Disponible</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Access to Team Commissions Screen */}
                  <button
                    type="button"
                    onClick={() => handleNavigateToSection('barbers_commissions')}
                    className="w-full py-2.5 px-3 bg-white border border-slate-300 hover:border-amber-500 rounded-xl flex items-center justify-between text-slate-800 text-xs font-semibold hover:bg-amber-50/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-lg">percent</span>
                      <span>Administrar Comisiones & Liquidación de Barberos</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-base">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* TAB 4: SECURITY & ROLES */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <span className="font-label-caps text-[11px] text-slate-500 uppercase font-bold block">
                      Credenciales y Acceso
                    </span>

                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                      <div>
                        <div className="text-xs font-bold text-slate-900">PIN de Supervisor / Dueño</div>
                        <div className="text-[11px] text-slate-500">Requerido para anular cobros y reabrir caja</div>
                      </div>
                      <div className="font-mono text-xs font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300">
                        •••• (4 dígitos)
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Modo Terminal Barbero</div>
                        <div className="text-[11px] text-slate-500">Ocultar métricas financieras globales a barberos</div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Protegido
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-red-50/60 rounded-xl border border-red-200/80">
                    <div className="flex items-center gap-2 text-red-800 text-xs font-bold mb-1">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      <span>Cerrar Sesión Administrativa</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2">
                      Si sales, deberás ingresar tus credenciales de Dueño / Admin nuevamente.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavigateToSection('login')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      Cerrar Sesión de Admin
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-save-admin-settings"
                onClick={handleSave}
                disabled={isSaving}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                  hasChanges
                    ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                    : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Guardar Ajustes</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
