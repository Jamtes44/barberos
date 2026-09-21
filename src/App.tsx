import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScreenId, TransitionType } from './types';
import { api } from './services/api';

import { LoginScreen } from './components/LoginScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen';
import { WompiPlanScreen } from './components/WompiPlanScreen';
import { RegisterShopScreen } from './components/RegisterShopScreen';
import { AgendaGeneralScreen } from './components/AgendaGeneralScreen';
import { OwnerDashboardScreen } from './components/OwnerDashboardScreen';
import { SalesCashScreen } from './components/SalesCashScreen';
import { ServicesPricingScreen } from './components/ServicesPricingScreen';
import { BarberTerminalScreen } from './components/BarberTerminalScreen';
import { ClientsListScreen } from './components/ClientsListScreen';
import { ClientsHistoryScreen } from './components/ClientsHistoryScreen';
import { ReportsFinanceScreen } from './components/ReportsFinanceScreen';
import { BarbersCommissionsScreen } from './components/BarbersCommissionsScreen';
import { ConfirmExitModal } from './components/ConfirmExitModal';
import { PushNotificationBanner } from './components/PushNotificationBanner';
import { BarberCheckoutScreen } from './components/BarberCheckoutScreen';

const AUTHENTICATED_SCREENS: ScreenId[] = [
  'owner_dashboard',
  'agenda_general',
  'sales_cash',
  'services_pricing',
  'barber_terminal',
  'barber_checkout',
  'clients_list',
  'clients_history',
  'reports_finance',
  'barbers_commissions',
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('login');
  const [transition, setTransition] = useState<TransitionType>('none');
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [history, setHistory] = useState<ScreenId[]>(['login']);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'barber'>(() => {
    try {
      const saved = localStorage.getItem('barberos_user_role');
      if (saved === 'barber' || saved === 'owner') return saved;
    } catch {
      // Ignore
    }
    return 'owner';
  });

  useEffect(() => {
    const user = api.user();
    if (!user || !api.token()) return;
    setIsLoggedIn(true);
    setUserRole(user.role);
    try {
      localStorage.setItem('barberos_user_role', user.role);
    } catch {
      // Ignore
    }
    setHistory(['login', user.role === 'owner' ? 'owner_dashboard' : 'barber_terminal']);
    setCurrentScreen(user.role === 'owner' ? 'owner_dashboard' : 'barber_terminal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (screen: ScreenId, trans: TransitionType = 'none', trackHistory = true) => {
    if (screen === 'login' && isLoggedIn) {
      setShowExitModal(true);
      return;
    }

    if (AUTHENTICATED_SCREENS.includes(screen)) {
      setIsLoggedIn(true);
    } else if (screen === 'login') {
      setIsLoggedIn(false);
    }

    if (screen === 'barber_terminal' || screen === 'barber_checkout') {
      setUserRole('barber');
      try {
        localStorage.setItem('barberos_user_role', 'barber');
      } catch {
        // Ignore
      }
    } else if (
      screen === 'owner_dashboard' ||
      screen === 'agenda_general' ||
      screen === 'sales_cash' ||
      screen === 'services_pricing' ||
      screen === 'reports_finance'
    ) {
      setUserRole('owner');
      try {
        localStorage.setItem('barberos_user_role', 'owner');
      } catch {
        // Ignore
      }
    }

    if (trackHistory) {
      setHistory((prev) => {
        if (prev[prev.length - 1] === screen) return prev;
        return [...prev, screen];
      });
    }

    setTransition(trans);
    setCurrentScreen(screen);
    // Scroll to top on screen change
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    // If user is logged in and about to exit to main screen
    if (history.length > 1) {
      const prevScreen = history[history.length - 2];
      if (prevScreen === 'login' && isLoggedIn) {
        setShowExitModal(true);
        return;
      }
      setHistory((prev) => prev.slice(0, -1));
      navigate(prevScreen, 'push_back', false);
    } else {
      // At the root of history
      if (isLoggedIn && currentScreen !== 'login') {
        setShowExitModal(true);
      } else if (currentScreen !== 'login') {
        navigate('login', 'push_back', false);
      }
    }
  };

  const handleConfirmExit = () => {
    api.logout();
    setShowExitModal(false);
    setIsLoggedIn(false);
    setHistory(['login']);
    setTransition('push_back');
    setCurrentScreen('login');
    window.scrollTo(0, 0);
  };

  const getAnimationVariants = (type: TransitionType) => {
    switch (type) {
      case 'push':
        return {
          initial: { x: '100%', opacity: 0.9 },
          animate: { x: 0, opacity: 1, transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } },
          exit: { x: '-25%', opacity: 0.6, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } },
        };
      case 'push_back':
        return {
          initial: { x: '-100%', opacity: 0.9 },
          animate: { x: 0, opacity: 1, transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } },
          exit: { x: '25%', opacity: 0.6, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } },
        };
      case 'slide_up':
        return {
          initial: { y: '100%', opacity: 0.9 },
          animate: { y: 0, opacity: 1, transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] } },
          exit: { y: '100%', opacity: 0.5, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } },
        };
      case 'none':
      default:
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
        };
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onNavigate={navigate} onRoleSelect={(r) => setUserRole(r)} />;
      case 'forgot_password':
        return <ForgotPasswordScreen onNavigate={navigate} onBack={goBack} />;
      case 'wompi_plan':
        return <WompiPlanScreen onNavigate={navigate} onBack={goBack} />;
      case 'register_shop':
        return <RegisterShopScreen onNavigate={navigate} onBack={goBack} />;
      case 'agenda_general':
        return <AgendaGeneralScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner_dashboard':
        return <OwnerDashboardScreen onNavigate={navigate} onBack={goBack} />;
      case 'sales_cash':
        return <SalesCashScreen onNavigate={navigate} onBack={goBack} />;
      case 'services_pricing':
        return <ServicesPricingScreen onNavigate={navigate} onBack={goBack} />;
      case 'barber_terminal':
        return <BarberTerminalScreen onNavigate={navigate} onBack={goBack} />;
      case 'barber_checkout':
        return <BarberCheckoutScreen onNavigate={navigate} onBack={goBack} />;
      case 'clients_list':
        return <ClientsListScreen onNavigate={navigate} onBack={goBack} />;
      case 'clients_history':
        return <ClientsHistoryScreen onNavigate={navigate} onBack={goBack} />;
      case 'reports_finance':
        return <ReportsFinanceScreen onNavigate={navigate} onBack={goBack} />;
      case 'barbers_commissions':
        return <BarbersCommissionsScreen onNavigate={navigate} onBack={goBack} />;
      default:
        return <LoginScreen onNavigate={navigate} />;
    }
  };

  const screensList: { id: ScreenId; label: string; number: number }[] = [
    { id: 'login', label: '1. Login con Selección de Rol', number: 1 },
    { id: 'forgot_password', label: '1b. Recuperar Contraseña', number: 2 },
    { id: 'wompi_plan', label: '2. Configuración Inicial y Plan Wompi', number: 3 },
    { id: 'register_shop', label: '3. Registro de Barbería', number: 4 },
    { id: 'agenda_general', label: '4. Agenda General', number: 5 },
    { id: 'owner_dashboard', label: '5. Dashboard del Dueño', number: 6 },
    { id: 'sales_cash', label: '6. Ventas y Caja en Tiempo Real', number: 7 },
    { id: 'services_pricing', label: '7. Servicios y Precios', number: 8 },
    { id: 'barber_terminal', label: '8. Agenda y Terminal de Barbero', number: 9 },
    { id: 'barber_checkout', label: '8b. Cobro Rápido en Silla (Exclusivo Barbero)', number: 10 },
    { id: 'clients_list', label: '9. Directorio y Lista de Clientes', number: 11 },
    { id: 'clients_history', label: '9b. Ficha de Historial de Cliente', number: 12 },
    { id: 'reports_finance', label: '10. Reportes y Finanzas', number: 13 },
    { id: 'barbers_commissions', label: '11. Barberos y Comisiones', number: 14 },
  ];

  const variants = getAnimationVariants(transition);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col relative w-full overflow-x-hidden">
      {/* Quick Navigation Floating Shortcut for Prototyping/Testing */}
      <div className="fixed top-2 right-2 z-50">
        <button
          type="button"
          onClick={() => setShowQuickSwitcher(!showQuickSwitcher)}
          className="px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white font-label-caps text-[10px] tracking-wider uppercase font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer border border-white/20 transition-all opacity-85 hover:opacity-100"
          title="Saltar a cualquier pantalla del prototipo"
        >
          <span className="material-symbols-outlined text-[14px]">layers</span>
          <span>13 Pantallas</span>
          <span className="material-symbols-outlined text-[12px]">
            {showQuickSwitcher ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showQuickSwitcher && (
          <div className="absolute right-0 mt-1 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 flex flex-col gap-1 max-h-[80vh] overflow-y-auto">
            <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100">
              <span className="font-label-caps text-[11px] text-slate-500 font-bold uppercase">
                Explorar Pantallas BarberOS
              </span>
              <button
                onClick={() => setShowQuickSwitcher(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            {screensList.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  navigate(s.id, 'none');
                  setShowQuickSwitcher(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                  currentScreen === s.id
                    ? 'bg-amber-50 text-[#8d4b00] font-bold border border-amber-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{s.label}</span>
                {currentScreen === s.id && (
                  <span className="material-symbols-outlined text-sm text-amber-600">check</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentScreen}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          className="w-full flex-1 flex flex-col"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {/* Confirmation modal before returning to login if logged in */}
      <ConfirmExitModal
        isOpen={showExitModal}
        onConfirm={handleConfirmExit}
        onCancel={() => setShowExitModal(false)}
      />

      {/* Global Push Notification Floating Banner */}
      <PushNotificationBanner onNavigate={navigate} />
    </div>
  );
}
