import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router'; // Importante para que funcionen los botones
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

    // Estadísticas Reales
    totalMesas: number = 12;
    mesasOcupadas: number = 0;
    porcentajeOcupacion: number = 0;

    ngOnInit() {
        // Escuchamos las comandas para actualizar el dashboard en tiempo real
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
}