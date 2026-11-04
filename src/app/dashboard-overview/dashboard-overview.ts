import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Firestore, collection, onSnapshot, query } from '@angular/fire/firestore';

@Component({
    selector: 'app-dashboard-overview',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard-overview.html'
})
export class DashboardOverviewComponent implements OnInit {
    private firestore: Firestore = inject(Firestore);
    private destroyRef = inject(DestroyRef);
    private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
    private router: Router = inject(Router);
    private auth = inject(AuthService);

    // Estadísticas Reales
    totalMesas: number = 12;
    mesasOcupadas: number = 0;
    porcentajeOcupacion: number = 0;
    
    // NUEVO: Contador de alertas de inventario
    alertasInventario: number = 0;

    // Variables de Roles
    esAdmin: boolean = false;
    esStaff: boolean = false;
    esCocinero: boolean = false;

    ngOnInit() {
        // 1. CONTROL DE ACCESO (el staffGuard ya ha cargado el perfil)
        this.esAdmin = this.auth.esGerente();
        this.esCocinero = this.auth.esCocina();
        this.esStaff = !this.esAdmin && !this.esCocinero;

        // 2. ESCUCHA DE FIREBASE: COMANDAS (Mesas ocupadas)
        const qComandas = query(collection(this.firestore, 'comandas'));
        this.destroyRef.onDestroy(onSnapshot(qComandas, (snap) => {
            const activas = snap.docs
                .map(d => d.data())
                .filter((c: any) => c.estado !== 'Pagada');

            this.mesasOcupadas = activas.length;
            this.porcentajeOcupacion = (this.mesasOcupadas / this.totalMesas) * 100;
            this.cdr.detectChanges();
        }));

        // 3. ESCUCHA DE FIREBASE: INVENTARIO (Stock crítico)
        // Solo lanzamos esta consulta si el usuario es Admin (ahorro de lecturas)
        if (this.esAdmin) {
            const qInventario = query(collection(this.firestore, 'inventario'));
            this.destroyRef.onDestroy(onSnapshot(qInventario, (snap) => {
                let criticos = 0;
                snap.forEach(doc => {
                    const data = doc.data();
                    const stock = data['stock'] || 0;
                    const target = data['target'] || 100;
                    // Comprobamos si está por debajo del 20%
                    if (stock < (target * 0.2)) {
                        criticos++;
                    }
                });
                this.alertasInventario = criticos;
                this.cdr.detectChanges();
            }));
        }
    }

    // Función para vaciar la sesión y volver al login
    async cerrarSesion() {
        await this.auth.logout();
        this.router.navigate(['/login']);
    }
}