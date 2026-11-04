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

import { adminGuard } from './guards/admin.guard';
import { staffGuard } from './guards/staff.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: AdminLogin },

  { path: 'carta', component: CartaComponent },

  // Personal con sesión iniciada (camareros, cocina y gerencia)
  { path: 'admin', component: DashboardOverviewComponent, canActivate: [staffGuard] },
  { path: 'monitor-cocina', component: MonitorCocinaComponent, canActivate: [staffGuard] },
  { path: 'mis-mesas', component: AdminMesasComponent, canActivate: [staffGuard] },
  { path: 'admin-reservas', component: AdminReservasComponent, canActivate: [staffGuard] },

  // Solo gerencia
  { path: 'inventory', component: SmartInventory, canActivate: [adminGuard] },
  { path: 'admin-menu', component: AdminMenuComponent, canActivate: [adminGuard] },
  { path: 'admin-staff', component: AdminStaffComponent, canActivate: [adminGuard] },
  { path: 'admin-ventas', component: AdminVentasComponent, canActivate: [adminGuard] },

  { path: '**', redirectTo: '' },
];
