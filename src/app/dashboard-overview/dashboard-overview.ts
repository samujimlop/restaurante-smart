import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Firestore, collection, onSnapshot, query, where } from '@angular/fire/firestore';

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

    // Roles y permisos: se leen en directo del perfil, así que si gerencia
    // cambia un permiso el panel se actualiza sin recargar.
    get esAdmin() { return this.auth.esGerente(); }
    get esCocinero() { return this.auth.esCocina(); }
    get esStaff() { return !this.esAdmin && !this.esCocinero; }
    get verInventario() { return this.auth.puedeVerInventario(); }
    get verVentas() { return this.auth.puedeVerVentas(); }

    ngOnInit() {
        // 1. ESCUCHA DE FIREBASE: COMANDAS ABIERTAS (Mesas ocupadas)
        const qComandas = query(collection(this.firestore, 'comandas'), where('estado', '!=', 'Pagada'));
        this.destroyRef.onDestroy(onSnapshot(qComandas, (snap) => {
            // Mesas distintas: si una mesa tuviera dos comandas abiertas, cuenta una vez.
            const mesas = new Set(snap.docs.map(d => d.data()['numeroMesa']));
            this.mesasOcupadas = Math.min(mesas.size, this.totalMesas);
            this.porcentajeOcupacion = (this.mesasOcupadas / this.totalMesas) * 100;
            this.cdr.detectChanges();
        }));

        // 3. ESCUCHA DE FIREBASE: INVENTARIO (Stock crítico)
        // Solo si el usuario puede ver el inventario (las reglas denegarían la lectura)
        if (this.verInventario) {
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
