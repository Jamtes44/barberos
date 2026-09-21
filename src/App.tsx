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
import { BarberBalanceScreen } from './components/BarberBalanceScreen';

const AUTHENTICATED_SCREENS: ScreenId[] = [
  'owner_dashboard',
  'agenda_general',
  'sales_cash',
  'services_pricing',
  'barber_terminal',
  'barber_checkout',
  'barber_balance',
  'clients_list',
  'clients_history',
  'reports_finance',
  'barbers_commissions',
];

// Pantallas exclusivas de administración: un barbero jamás las alcanza.
const ADMIN_ONLY_SCREENS: ScreenId[] = [
  'owner_dashboard',
  'agenda_general',
  'sales_cash',
  'services_pricing',
  'reports_finance',
  'barbers_commissions',
  'wompi_plan',
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('login');
  const [transition, setTransition] = useState<TransitionType>('none');
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

    // Un barbero solo ve su terminal y su balance; lo demás está vetado.
    if (userRole === 'barber' && ADMIN_ONLY_SCREENS.includes(screen)) {
      setCurrentScreen('barber_terminal');
      setTransition('none');
      return;
    }

    if (AUTHENTICATED_SCREENS.includes(screen)) {
      setIsLoggedIn(true);
    } else if (screen === 'login') {
      setIsLoggedIn(false);
    }

    if (screen === 'barber_terminal' || screen === 'barber_checkout' || screen === 'barber_balance') {
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
      case 'barber_balance':
        return <BarberBalanceScreen onNavigate={navigate} onBack={goBack} />;
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

const variants = getAnimationVariants(transition);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col relative w-full overflow-x-hidden">
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
