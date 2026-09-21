import React, { useEffect, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { apiServices, Service, ApiError } from '../services/api';

interface ServicesPricingScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

const catOf = (cat: string | null): 'cortes' | 'barba' | 'combos' => {
  const c = (cat || '').toLowerCase();
  if (c.includes('barba') || c.includes('perfil')) return 'barba';
  if (c.includes('combo')) return 'combos';
  return 'cortes';
};

const fmtCop = (n: number) => n.toLocaleString('es-CO');

export const ServicesPricingScreen: React.FC<ServicesPricingScreenProps> = ({ onNavigate, onBack }) => {
  const [activeTab, setActiveTab] = useState<'todos' | 'cortes' | 'barba' | 'combos'>('todos');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', price: '', duration_minutes: '45', commission_rate: '50', category: 'corte' });
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const load = async () => {
    setLoading(true);
    try {
      setServices(await apiServices.list());
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleService = async (id: string) => {
    const current = services.find((s) => s.id === id);
    if (!current) return;
    const updated = await apiServices.update(id, { active: !current.active });
    setServices((prev) => prev.map((s) => (s.id === id ? updated : s)));
    showToast('Estado del servicio actualizado');
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', price: '', duration_minutes: '45', commission_rate: '50', category: 'corte' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      price: String(s.price),
      duration_minutes: String(s.duration_minutes),
      commission_rate: String(s.commission_rate),
      category: catOf(s.category),
    });
    setFormError(null);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price <= 0) {
      setFormError('Ingresa un nombre y un precio válido');
      return;
    }
    setFormError(null);
    try {
      const payload: Partial<Service> = {
        name: form.name.trim(),
        price,
        duration_minutes: Number(form.duration_minutes) || 45,
        commission_rate: Number(form.commission_rate) || 0,
        category: form.category === 'cortes' ? 'corte' : form.category,
      };
      if (editing) {
        const updated = await apiServices.update(editing.id, payload);
        setServices((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
        showToast('Servicio actualizado');
      } else {
        const created = await apiServices.create(payload);
        setServices((prev) => [...prev, created]);
        showToast('Servicio creado');
      }
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Error al guardar servicio');
    }
  };

  const filteredServices = services.filter((s) => {
    if (activeTab === 'todos') return true;
    return catOf(s.category) === activeTab;
  });

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Servicios"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 max-w-4xl mx-auto">
          {/* Header Card with Historial de Precios button */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-headline-lg-mobile text-2xl text-[#0f172a] font-bold">Servicios y Precios</h1>
                <p className="font-body-sm text-xs text-[#64748b]">Tarifas vigentes y porcentajes de liquidación</p>
              </div>

              {/* Exact xpath requirement:
                  //button[contains(., 'Historial de Precios') or @title='Historial de Precios'] -> Reportes y Finanzas (push transition)
              */}
              <button
                type="button"
                title="Historial de Precios"
                onClick={() => onNavigate('reports_finance', 'push')}
                className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[#8d4b00] font-label-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span>Historial de Precios</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              {[
                { id: 'todos', label: `Todos (${services.length})` },
                { id: 'cortes', label: 'Cortes' },
                { id: 'barba', label: 'Barba' },
                { id: 'combos', label: 'Combos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-label-md transition cursor-pointer shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[#8d4b00] text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Add Bar */}
          <div className="flex items-center justify-between px-1">
            <span className="font-label-caps text-xs text-[#64748b] uppercase font-bold">Servicios Configurados</span>
            <button
              type="button"
              onClick={openCreate}
              className="text-xs font-label-md text-[#8d4b00] font-bold flex items-center gap-1 cursor-pointer hover:underline"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>+ Nuevo Servicio</span>
            </button>
          </div>

          {/* Services List */}
          <div className="flex flex-col gap-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
                <span className="w-5 h-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
                <span className="font-body-sm text-xs">Cargando servicios...</span>
              </div>
            )}
            {!loading && filteredServices.length === 0 && (
              <div className="py-8 text-center text-slate-400 font-body-sm text-sm">
                No hay servicios en esta categoría. Crea uno con "+ Nuevo Servicio".
              </div>
            )}
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
                  service.active ? 'border-slate-100' : 'border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#8d4b00] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">content_cut</span>
                    </div>
                    <div>
                      <h3 className="font-headline-md text-base text-[#0f172a] font-bold leading-tight">
                        {service.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-label-md text-xs text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span> {service.duration_minutes} min
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-label-caps text-[11px] text-[#006c49] font-bold">
                          Comisión: {service.commission_rate}% (${fmtCop(service.price * service.commission_rate / 100)} COP)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Switch */}
                  <button
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      service.active ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        service.active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="font-currency-metric text-xl text-[#8d4b00] font-bold">
                      ${service.price.toLocaleString('es-CO')}
                    </span>
                    <span className="font-label-caps text-xs text-slate-400">COP</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-md text-xs font-semibold cursor-pointer"
                    >
                      Editar Tarifa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Sub-Navigation Shortcuts to Reports and Barbers */}
          <div className="grid grid-cols-2 gap-2 mt-2 mb-6">
            <button
              type="button"
              onClick={() => onNavigate('reports_finance', 'push')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-300 text-left flex flex-col gap-1 shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[#8d4b00]">
                <span className="material-symbols-outlined text-lg">insights</span>
                <span className="font-label-caps text-xs font-bold">Reportes y Finanzas</span>
              </div>
              <span className="font-body-sm text-[11px] text-slate-500">Márgenes y rentabilidad</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('barbers_commissions', 'push')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-300 text-left flex flex-col gap-1 shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[#8d4b00]">
                <span className="material-symbols-outlined text-lg">badge</span>
                <span className="font-label-caps text-xs font-bold">Barberos y Comisiones</span>
              </div>
              <span className="font-body-sm text-[11px] text-slate-500">Esquemas 40% / 50% / 60%</span>
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-lg text-[#0f172a] font-bold">
                  {editing ? 'Editar Servicio' : 'Nuevo Servicio'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={submitForm} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-[12px] text-slate-600 font-bold">Nombre del servicio</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Corte Degradé Clásico"
                    className="h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-[12px] text-slate-600 font-bold">Precio COP</label>
                    <input
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="25000"
                      className="h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-[12px] text-slate-600 font-bold">Duración (min)</label>
                    <input
                      type="number"
                      min="5"
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                      className="h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-[12px] text-slate-600 font-bold">Comisión barbero %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.commission_rate}
                      onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                      className="h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-[12px] text-slate-600 font-bold">Categoría</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-amber-500 bg-white"
                    >
                      <option value="corte">Corte</option>
                      <option value="barba">Barba</option>
                      <option value="combos">Combo</option>
                    </select>
                  </div>
                </div>
                {formError && (
                  <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {formError}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full h-11 mt-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg uppercase tracking-wider"
                >
                  {editing ? 'Guardar Cambios' : 'Crear Servicio'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Must match xpath:
          //nav//a[@data-path='dashboard']
          //nav//a[@data-path='agenda']
          //nav//a[@data-path='caja']
          //nav//a[@data-path='clientes']
      */}
      <BottomNav
        activeTab="mas"
        cajaPathVariant="caja"
        masPathVariant="mas"
        onNavigate={onNavigate}
      />
    </div>
  );
};
