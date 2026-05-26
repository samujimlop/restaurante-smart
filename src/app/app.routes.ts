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

//  Importar el Guard
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: AdminLogin },
  
  // Panel general (Abierto a staff/cocina)
  { path: 'admin', component: DashboardOverviewComponent },
  { path: 'carta', component: CartaComponent },
  { path: 'monitor-cocina', component: MonitorCocinaComponent },
  { path: 'mis-mesas', component: AdminMesasComponent },
  { path: 'admin-reservas', component: AdminReservasComponent },

  // Rutas Blindadas (Solo Admins)
  { path: 'inventory', component: SmartInventory, canActivate: [adminGuard] },
  { path: 'admin-menu', component: AdminMenuComponent, canActivate: [adminGuard] },
  { path: 'admin-staff', component: AdminStaffComponent, canActivate: [adminGuard] },
  { path: 'admin-ventas', component: AdminVentasComponent, canActivate: [adminGuard] },
  
  { path: '**', redirectTo: '' }
];