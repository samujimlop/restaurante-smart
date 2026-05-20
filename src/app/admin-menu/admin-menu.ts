import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Firestore, collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-menu.html'
})
export class AdminMenuComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  listaPlatos: any[] = [];
  mostrarModal = false;
  editandoId: string | null = null;

  categorias = ['Entrantes', 'Principales', 'Postres', 'Bebidas'];
  opcionesAllergens = ['Gluten', 'Lactosa', 'Huevo', 'Pescado', 'Frutos Cáscara', 'Soja', 'Crustáceos', 'Mostaza'];

  nuevoPlato: any = {
    name: '',
    description: '',
    price: 0,
    costPrice: 0,
    category: 'Entrantes',
    allergens: []
  };

  ngOnInit() {
    const ref = collection(this.firestore, 'platos');
    onSnapshot(ref, (snapshot) => {
      const arrayTemporal: any[] = [];
      snapshot.forEach((documento) => {
        const data = documento.data();
        arrayTemporal.push({
          id: documento.id,
          ...data,
          allergens: Array.isArray(data['allergens']) ? data['allergens'] : []
        });
      });
      this.listaPlatos = arrayTemporal;
      this.cdr.detectChanges();
    });
  }

  toggleAllergen(alergeno: string) {
    const index = this.nuevoPlato.allergens.indexOf(alergeno);
    if (index > -1) {
      this.nuevoPlato.allergens.splice(index, 1);
    } else {
      this.nuevoPlato.allergens.push(alergeno);
    }
  }

  abrir() {
    this.editandoId = null;
    this.resetearForm();
    this.mostrarModal = true;
  }

  editar(plato: any) {
    this.editandoId = plato.id;
    this.nuevoPlato = {
      ...plato,
      allergens: Array.isArray(plato.allergens) ? [...plato.allergens] : []
    };
    this.mostrarModal = true;
  }

  async guardar() {
    if (!this.nuevoPlato.name || !this.nuevoPlato.price) return alert("Nombre y precio obligatorios");
    try {
      if (this.editandoId) {
        await updateDoc(doc(this.firestore, `platos/${this.editandoId}`), this.nuevoPlato);
      } else {
        await addDoc(collection(this.firestore, 'platos'), this.nuevoPlato);
      }
      this.cerrar();
    } catch (e) { console.error(e); }
  }

  cerrar() { this.mostrarModal = false; }

  async borrar(id: string) {
    if (confirm("¿Eliminar este plato del menú?")) {
      await deleteDoc(doc(this.firestore, `platos/${id}`));
    }
  }

  resetearForm() {
    this.nuevoPlato = { name: '', description: '', price: null, costPrice: null, category: 'Entrantes', allergens: [] };
  }

  // ==========================================
  // 🚀 SCRIPT INYECTOR DE MENÚ (DATA SEEDER)
  // ==========================================
  async generarMenuMagico() {
    const confirmar = confirm("¿Quieres inyectar una carta completa de prueba con sus costes de escandallo?");
    if (!confirmar) return;

    const cartaSimulada = [
      { name: 'Nachos con Queso', description: 'Totopos bañados en cheddar fundido, guacamole casero y jalapeños.', price: 8.50, costPrice: 2.10, category: 'Entrantes', allergens: ['Lactosa', 'Gluten'] },
      { name: 'Croquetas Ibéricas', description: 'Ración de 6 croquetas caseras extra cremosas.', price: 9.00, costPrice: 2.50, category: 'Entrantes', allergens: ['Gluten', 'Lactosa', 'Huevo'] },
      { name: 'Hamburguesa Trufada', description: '200g de ternera, queso brie, rúcula y mayonesa de trufa.', price: 14.50, costPrice: 4.80, category: 'Principales', allergens: ['Gluten', 'Lactosa', 'Huevo'] },
      { name: 'Salmón a la Plancha', description: 'Lomo de salmón noruego con guarnición de verduritas.', price: 16.00, costPrice: 6.50, category: 'Principales', allergens: ['Pescado'] },
      { name: 'Pizza Margarita', description: 'Masa fina con tomate San Marzano y mozzarella fresca.', price: 11.00, costPrice: 2.80, category: 'Principales', allergens: ['Gluten', 'Lactosa'] },
      { name: 'Tarta de Queso', description: 'Al estilo viña, muy cremosa y con el centro líquido.', price: 6.50, costPrice: 1.50, category: 'Postres', allergens: ['Lactosa', 'Huevo', 'Gluten'] },
      { name: 'Brownie con Helado', description: 'Puro chocolate con nueces y helado de vainilla.', price: 5.50, costPrice: 1.20, category: 'Postres', allergens: ['Gluten', 'Lactosa', 'Huevo', 'Frutos Cáscara'] },
      { name: 'Cerveza Artesanal', description: 'Doble malta, muy fría.', price: 3.50, costPrice: 1.00, category: 'Bebidas', allergens: ['Gluten'] },
      { name: 'Refresco de Cola', description: 'Lata 33cl.', price: 2.50, costPrice: 0.60, category: 'Bebidas', allergens: [] }
    ];

    try {
      for (const plato of cartaSimulada) {
        await addDoc(collection(this.firestore, 'platos'), plato);
      }
      alert("¡Carta generada con éxito! Tu restaurante ya tiene stock.");
    } catch (e) {
      console.error("Error al inyectar el menú:", e);
      alert("Hubo un error, comprueba la consola.");
    }
  }
}