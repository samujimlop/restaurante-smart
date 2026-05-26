import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; // Añadimos Router para redireccionar al salir
import { Firestore, collection, onSnapshot, query } from '@angular/fire/firestore';

@Component({
    selector: 'app-dashboard-overview',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard-overview.html'
})
export class DashboardOverviewComponent implements OnInit {
    private firestore: Firestore = inject(Firestore);
    private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
    private router: Router = inject(Router);

    // Estadísticas Reales
    totalMesas: number = 12;
    mesasOcupadas: number = 0;
    porcentajeOcupacion: number = 0;

    // Variables de Roles
    esAdmin: boolean = false;
    esStaff: boolean = false;
    esCocinero: boolean = false;

    ngOnInit() {
        // 1. CONTROL DE ACCESO (Leer rol del usuario logueado)
        const sesion = localStorage.getItem('usuarioLogueado');
        if (sesion) {
            const usuario = JSON.parse(sesion);
            const rol = usuario.rol ? String(usuario.rol).toLowerCase() : '';
            this.esAdmin = (rol === 'admin' || rol === 'administrador' || rol === 'jefe' || rol === 'gerente');
            this.esStaff = (rol === 'staff' || rol === 'camarero');
            this.esCocinero = (rol === 'cocinero' || rol === 'cocina');
            
            // Perfil por defecto de seguridad si el rol no coincide
            if (!this.esAdmin && !this.esStaff && !this.esCocinero) {
                this.esStaff = true; 
            }
        }

        // 2. ESCUCHA DE FIREBASE EN TIEMPO REAL (Tus estadísticas)
        const q = query(collection(this.firestore, 'comandas'));

        onSnapshot(q, (snap) => {
            const activas = snap.docs
                .map(d => d.data())
                .filter((c: any) => c.estado !== 'Pagada');

            this.mesasOcupadas = activas.length;
            this.porcentajeOcupacion = (this.mesasOcupadas / this.totalMesas) * 100;

            this.cdr.detectChanges();
        });
    }

    // Función para vaciar la sesión y volver al login
    cerrarSesion() {
        localStorage.removeItem('usuarioLogueado');
        this.router.navigate(['/login']);
    }
}