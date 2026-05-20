import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, addDoc } from '@angular/fire/firestore';

@Component({
    selector: 'app-carta',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './carta.html'
})
export class CartaComponent implements OnInit {
    private firestore: Firestore = inject(Firestore);

    platos: any[] = [];
    categorias: string[] = ['Todos', 'Entrantes', 'Principales', 'Postres', 'Bebidas'];
    categoriaSeleccionada: string = 'Todos';

    mostrarFormulario: boolean = false;
    nuevaReserva = {
        nombre: '',
        telefono: '',
        personas: 2,
        fecha: '',
        hora: '',
        estado: 'Pendiente'
    };

    ngOnInit() {
        onSnapshot(collection(this.firestore, 'platos'), (snap) => {
            this.platos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
    }

    seleccionarCategoria(cat: string) {
        this.categoriaSeleccionada = cat;
    }

    abrirReserva() {
        this.mostrarFormulario = true;
    }

    cerrarReserva() {
        this.mostrarFormulario = false;
    }

    async enviarReserva() {
        if (!this.nuevaReserva.nombre || !this.nuevaReserva.fecha || !this.nuevaReserva.hora) {
            alert("Por favor, rellena nombre, fecha y hora.");
            return;
        }
        try {
            await addDoc(collection(this.firestore, 'reservas'), {
                ...this.nuevaReserva,
                fechaCreacion: new Date()
            });
            alert("¡Reserva enviada con éxito! Espera confirmación.");
            this.cerrarReserva();
            this.nuevaReserva = { nombre: '', telefono: '', personas: 2, fecha: '', hora: '', estado: 'Pendiente' };
        } catch (e) {
            console.error("Error al enviar reserva", e);
        }
    }
}