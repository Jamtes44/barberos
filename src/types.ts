export type ScreenId =
  | 'login'
  | 'forgot_password'
  | 'wompi_plan'
  | 'register_shop'
  | 'agenda_general'
  | 'owner_dashboard'
  | 'sales_cash'
  | 'services_pricing'
  | 'barber_terminal'
  | 'barber_checkout'
  | 'clients_list'
  | 'clients_history'
  | 'reports_finance'
  | 'barbers_commissions';

export type TransitionType = 'none' | 'push' | 'push_back' | 'slide_up';

export interface NavigationState {
  currentScreen: ScreenId;
  previousScreen?: ScreenId;
  transition: TransitionType;
}
