import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenId, TransitionType } from '../types';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { apiClients, Client } from '../services/api';

interface ClientsListScreenProps {
  onNavigate: (screen: ScreenId, transition?: TransitionType) => void;
  onBack?: () => void;
}

type ClientCategory = 'vip' | 'frecuente' | 'nuevo' | 'inactivo';

const SELECTED_CLIENT_KEY = 'barberos_selected_client';

const AVATAR_COLORS = [
  'bg-amber-500',
  'bg-blue-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-purple-600',
  'bg-slate-500',
];

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (name.trim().slice(0, 2) || '??').toUpperCase();
};

const clientCategory = (c: Client): ClientCategory => {
  if (c.is_vip) return 'vip';
  const days = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
  if (days <= 30) return 'nuevo';
  return 'frecuente';
};

const daysSinceRegistro = (iso: string): number => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return Math.max(days, 0);
};

const fmtShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });

const setSelectedClientId = (id: string) => {
  try {
    sessionStorage.setItem(SELECTED_CLIENT_KEY, id);
  } catch {
    // Ignore
  }
};

export const ClientsListScreen: React.FC<ClientsListScreenProps> = ({ onNavigate, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | ClientCategory>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const sentQueryRef = useRef('');

  const [newClientForm, setNewClientForm] = useState({
    name: '',
    phone: '',
    email: '',
    category: 'frecuente' as 'vip' | 'frecuente' | 'nuevo',
    favoriteBarber: "Mateo 'Blade' Castro",
    notes: '',
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const loadClients = useCallback(
    async (q: string) => {
      const query = q.trim();
      sentQueryRef.current = query;
      try {
        const data = await apiClients.list(query);
        if (sentQueryRef.current !== query) return;
        setClients(data);
        setLoadError(false);
      } catch {
        if (sentQueryRef.current !== query) return;
        setClients([]);
        setLoadError(true);
        showToast('No se pudieron cargar los clientes');
      } finally {
        if (sentQueryRef.current === query) setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      loadClients(searchTerm);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm, loadClients]);

  const filteredClients = clients.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.notes || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    return clientCategory(c) === activeFilter;
  });

  const vipCount = clients.filter((c) => c.is_vip).length;
  const frequentCount = clients.filter((c) => clientCategory(c) === 'frecuente').length;
  const newCount = clients.filter((c) => clientCategory(c) === 'nuevo').length;
  const inactiveCount = clients.filter((c) => clientCategory(c) === 'inactivo').length;

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.name.trim()) return;

    const name = newClientForm.name.trim();

    try {
      await apiClients.create({
        name,
        phone: newClientForm.phone || undefined,
        is_vip: newClientForm.category === 'vip',
        notes: newClientForm.notes || undefined,
      });

      setShowAddModal(false);
      setNewClientForm({
        name: '',
        phone: '',
        email: '',
        category: 'frecuente',
        favoriteBarber: "Mateo 'Blade' Castro",
        notes: '',
      });
      showToast(`✓ Cliente ${name} añadido a la base de datos`);
      setSearchTerm('');
      await loadClients('');
    } catch {
      showToast('No se pudo registrar el cliente');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0f172a] flex flex-col antialiased select-none">
      <AppHeader
        currentSection="Directorio de Clientes"
        role="owner"
        onNavigate={onNavigate}
        onLogout={() => onNavigate('login', 'push_back')}
        onBack={onBack}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#f8f9ff] min-h-screen">
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4 gap-4 max-w-5xl mx-auto">
          {/* Header Banner & Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-headline-lg-mobile text-xl text-[#0f172a] font-bold tracking-tight">
                Lista de Clientes
              </h1>
              <span className="font-body-sm text-xs text-slate-500">
                {clients.length} clientes fidelizados en el sistema
              </span>
            </div>

            {/* Quick Add Client Button */}
            <button
              type="button"
              id="btn-add-client"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-label-md text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>+ Nuevo</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <span className="font-label-caps text-[10px] text-slate-400 font-bold uppercase">Total Clientes</span>
              <span className="font-currency-metric text-xl font-bold text-slate-900 mt-0.5">{clients.length}</span>
              <span className="font-body-sm text-[10px] text-emerald-600 font-semibold mt-0.5">+4 este mes</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <span className="font-label-caps text-[10px] text-slate-400 font-bold uppercase">Clientes VIP</span>
              <span className="font-currency-metric text-xl font-bold text-amber-600 mt-0.5">{vipCount}</span>
              <span className="font-body-sm text-[10px] text-amber-700 font-semibold mt-0.5">Fidelización alta</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex flex-col">
              <span className="font-label-caps text-[10px] text-slate-400 font-bold uppercase">Frecuencia Prom.</span>
              <span className="font-currency-metric text-xl font-bold text-slate-900 mt-0.5">18.4 d</span>
              <span className="font-body-sm text-[10px] text-slate-500 font-semibold mt-0.5">Retorno constante</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-xl pointer-events-none">
              search
            </span>
            <input
              type="text"
              id="input-search-clients"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, teléfono, barbero o corte..."
              className="w-full h-11 pl-11 pr-10 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todos ({clients.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('vip')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'vip'
                  ? 'bg-amber-500 text-white font-bold'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="material-symbols-outlined text-xs">star</span>
              <span>VIP ({vipCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('frecuente')}
              className={`px-3 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'frecuente'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Frecuentes ({frequentCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('nuevo')}
              className={`px-3 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'nuevo'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Nuevos ({newCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('inactivo')}
              className={`px-3 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'inactivo'
                  ? 'bg-slate-600 text-white font-bold'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Inactivos ({inactiveCount})
            </button>
          </div>

          {/* List of Clients Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              <div className="py-12 px-4 text-center rounded-2xl bg-white border border-dashed border-slate-200 flex items-center justify-center">
                <span className="font-body-sm text-xs text-slate-400">Cargando clientes...</span>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-2xl bg-white border border-dashed border-slate-200 flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">person_search</span>
                <span className="font-headline-md text-sm font-bold text-slate-700">
                  No se encontraron clientes
                </span>
                <span className="font-body-sm text-xs text-slate-400">
                  {loadError
                    ? 'No se pudieron cargar los clientes. Verifica tu conexión.'
                    : 'Intenta con otro término de búsqueda o limpia los filtros.'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setActiveFilter('all');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Restablecer Filtros
                </button>
              </div>
            ) : (
              filteredClients.map((client, index) => {
                const isRoberto = client.id === 'cli-roberto';
                const category = clientCategory(client);

                return (
                  <div
                    key={client.id}
                    className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 hover:border-amber-300 transition-all flex flex-col gap-3"
                  >
                    {/* Top row: Avatar, Info, Category & WhatsApp */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl ${AVATAR_COLORS[index % AVATAR_COLORS.length]} text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs`}
                        >
                          {getInitials(client.name)}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-headline-md text-base text-slate-900 font-bold truncate">
                              {client.name}
                            </span>
                            {client.is_vip && (
                              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-label-caps text-[9px] font-bold uppercase flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">star</span> VIP
                              </span>
                            )}
                            {category === 'nuevo' && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-label-caps text-[9px] font-bold uppercase">
                                Nuevo
                              </span>
                            )}
                            {category === 'inactivo' && (
                              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-label-caps text-[9px] font-bold uppercase">
                                +30 días
                              </span>
                            )}
                          </div>
                          <span className="font-body-sm text-xs text-slate-500 truncate">
                            📱 {client.phone || 'Sin teléfono'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => showToast(`Abriendo chat de WhatsApp con ${client.name}`)}
                        className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 hover:bg-emerald-100 cursor-pointer shrink-0"
                        title={`Escribir a ${client.name}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                      </button>
                    </div>

                    {/* Notes & Registration summary */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <span className="material-symbols-outlined text-amber-600 text-sm">content_cut</span>
                        <span className="truncate">
                          {client.notes || 'Sin notas de estilo'}
                        </span>
                      </div>
                      <span className="font-body-sm text-[11px] text-slate-400 shrink-0">
                        Desde {fmtShortDate(client.created_at)}
                      </span>
                    </div>

                    {/* Stats row & Action buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <div>
                          <span className="font-bold text-slate-900">{client.is_vip ? 'VIP' : 'Regular'}</span> cliente
                        </div>
                        <div>•</div>
                        <div>
                          <span className="font-bold text-amber-700">{daysSinceRegistro(client.created_at)}d</span> registrado
                        </div>
                      </div>

                      {/* Primary Navigation to Client Details / Technical History */}
                      <button
                        type="button"
                        id={isRoberto ? 'btn-view-client-roberto' : `btn-view-client-${client.id}`}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          onNavigate('clients_history', 'push');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-label-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-amber-200 active:scale-95"
                      >
                        <span>Ver Ficha</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal: Registrar Nuevo Cliente */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">person_add</span>
                  </div>
                  <h2 className="font-headline-md text-lg text-slate-900 font-bold">Nuevo Cliente</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="flex flex-col gap-3">
                <div>
                  <label className="font-label-md text-xs text-slate-700 font-bold block mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Andrés Camilo Morales"
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-label-md text-xs text-slate-700 font-bold block mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 314 555 6677"
                      value={newClientForm.phone}
                      onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="font-label-md text-xs text-slate-700 font-bold block mb-1">
                      Categoría
                    </label>
                    <select
                      value={newClientForm.category}
                      onChange={(e) =>
                        setNewClientForm({
                          ...newClientForm,
                          category: e.target.value as 'vip' | 'frecuente' | 'nuevo',
                        })
                      }
                      className="w-full h-10 px-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-amber-500 bg-white"
                    >
                      <option value="frecuente">Frecuente</option>
                      <option value="vip">VIP ⭐</option>
                      <option value="nuevo">Nuevo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-label-md text-xs text-slate-700 font-bold block mb-1">
                    Barbero Preferido
                  </label>
                  <select
                    value={newClientForm.favoriteBarber}
                    onChange={(e) => setNewClientForm({ ...newClientForm, favoriteBarber: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="Mateo 'Blade' Castro">Mateo 'Blade' Castro (Silla #1)</option>
                    <option value="David Morales">David Morales (Silla #2)</option>
                    <option value="Andrés Silva">Andrés Silva (Silla #3)</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-md text-xs text-slate-700 font-bold block mb-1">
                    Notas de Estilo / Preferencias Iniciales
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej. Prefiere degradé medio, piel sensible..."
                    value={newClientForm.notes}
                    onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {toastMsg && (
          <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between z-50 text-xs">
            <span>{toastMsg}</span>
            <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
          </div>
        )}
      </main>

      {/* BottomNav with activeTab="clientes" */}
      <BottomNav
        activeTab="clientes"
        cajaPathVariant="caja"
        masPathVariant="mas"
        onNavigate={onNavigate}
      />
    </div>
  );
};