import { Routes } from '@angular/router';

import { adminGuard } from './guards/admin.guard';
import { staffGuard } from './guards/staff.guard';

// Cada pantalla se carga bajo demanda (lazy loading): el cliente que abre la carta
// no descarga el código del panel de gerencia.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.HomeComponent) },
  {
    path: 'login',
    loadComponent: () => import('./admin-login/admin-login').then((m) => m.AdminLogin),
  },

  { path: 'carta', loadComponent: () => import('./carta/carta').then((m) => m.CartaComponent) },

  // Personal con sesión iniciada (camareros, cocina y gerencia)
  {
    path: 'admin',
    loadComponent: () =>
      import('./dashboard-overview/dashboard-overview').then((m) => m.DashboardOverviewComponent),
    canActivate: [staffGuard],
  },
  {
    path: 'monitor-cocina',
    loadComponent: () =>
      import('./monitor-cocina/monitor-cocina').then((m) => m.MonitorCocinaComponent),
    canActivate: [staffGuard],
  },
  {
    path: 'mis-mesas',
    loadComponent: () => import('./mis-mesas/mis-mesas').then((m) => m.AdminMesasComponent),
    canActivate: [staffGuard],
  },
  {
    path: 'admin-reservas',
    loadComponent: () =>
      import('./admin-reservas/admin-reservas').then((m) => m.AdminReservasComponent),
    canActivate: [staffGuard],
  },

  // Solo gerencia
  {
    path: 'inventory',
    loadComponent: () => import('./smart-inventory/smart-inventory').then((m) => m.SmartInventory),
    canActivate: [adminGuard],
  },
  {
    path: 'admin-menu',
    loadComponent: () => import('./admin-menu/admin-menu').then((m) => m.AdminMenuComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin-staff',
    loadComponent: () => import('./admin-staff/admin-staff').then((m) => m.AdminStaffComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin-ventas',
    loadComponent: () => import('./admin-ventas/admin-ventas').then((m) => m.AdminVentasComponent),
    canActivate: [adminGuard],
  },

  { path: '**', redirectTo: '' },
];
