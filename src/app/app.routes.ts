import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { AdminLogin } from './admin-login/admin-login';

import { DashboardOverviewComponent } from './dashboard-overview/dashboard-overview';

import { SmartInventory } from './smart-inventory/smart-inventory';
import { CartaComponent } from './carta/carta';
import { AdminReservasComponent } from './admin-reservas/admin-reservas';
import { AdminMenuComponent } from './admin-menu/admin-menu';
import { AdminStaffComponent } from './admin-staff/admin-staff';
import { AdminVentasComponent } from './admin-ventas/admin-ventas';
import { MonitorCocinaComponent } from './monitor-cocina/monitor-cocina';
import { AdminMesasComponent } from './mis-mesas/mis-mesas';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: AdminLogin },

  { path: 'admin', component: DashboardOverviewComponent },

  { path: 'inventory', component: SmartInventory },
  { path: 'carta', component: CartaComponent },
  { path: 'admin-reservas', component: AdminReservasComponent },
  { path: 'admin-menu', component: AdminMenuComponent },
  { path: 'admin-staff', component: AdminStaffComponent },
  { path: 'admin-ventas', component: AdminVentasComponent },
  { path: 'monitor-cocina', component: MonitorCocinaComponent },
  { path: 'mis-mesas', component: AdminMesasComponent },
  { path: '**', redirectTo: '' }
];