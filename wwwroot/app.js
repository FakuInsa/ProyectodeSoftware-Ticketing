const API_BASE = '/api/v1';
let currentEventId = null;

// Guardamos los intervals por reservaId para poder cancelarlos
// cuando el usuario remueve un item o expira el tiempo
const activeTimers = {};

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    document.getElementById('back-btn').addEventListener('click', showEventsSection);
});

// =========================================
// EVENTOS
// =========================================

async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE}/events`);
        const result = await response.json();
        renderEvents(result.data || []);
    } catch (error) {
        console.error('Error cargando eventos:', error);
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-container');
    container.innerHTML = '';

    events.forEach(event => {
        const card = document.createElement('div');
        const esActivo = event.estado === 'Activo';
        card.className = esActivo ? 'event-card' : 'event-card inactivo';

        card.innerHTML = `
            <h3 class="event-title">${event.nombre}</h3>
            <div class="event-detail">${event.lugar}</div>
        `;

        card.addEventListener('click', () => loadSeatMap(event));
        container.appendChild(card);
    });
}

function showEventsSection() {
    document.getElementById('events-section').classList.remove('hidden');
    document.getElementById('seat-map-section').classList.add('hidden');
}

function showSeatMapSection(eventTitle) {
    document.getElementById('events-section').classList.add('hidden');
    document.getElementById('seat-map-section').classList.remove('hidden');
    document.getElementById('event-title').textContent = eventTitle;
    document.getElementById('seat-grid-container').innerHTML =
        '<div class="loading-msg">Cargando butacas...</div>';
}

async function loadSeatMap(event) {
    currentEventId = event.id;
    showSeatMapSection(event.nombre);
    try {
        const response = await fetch(`${API_BASE}/events/${event.id}/seats`);
        const seats = await response.json();
        renderSeatMap(seats);
    } catch (error) {
        showToast('Error al cargar butacas', 'error');
    }
}

// =========================================
// MAPA DE ASIENTOS
// =========================================

function renderSeatMap(seats) {
    const container = document.getElementById('seat-grid-container');
    container.innerHTML = '';

    const sectors = {};
    seats.forEach(seat => {
        if (!sectors[seat.sectorNombre]) sectors[seat.sectorNombre] = [];
        sectors[seat.sectorNombre].push(seat);
    });

    const orderedSectorNames = Object.keys(sectors).sort((a, b) => {
        if (a.toLowerCase().includes('campo')) return -1;
        if (b.toLowerCase().includes('campo')) return 1;
        return 0;
    });

    orderedSectorNames.forEach(sectorName => {
        const sectorDiv = document.createElement('div');
        sectorDiv.className = 'sector-container';
        sectorDiv.innerHTML = `<h3 class="sector-title">Sector: ${sectorName}</h3>`;

        const filas = {};
        sectors[sectorName].forEach(seat => {
            if (!filas[seat.fila]) filas[seat.fila] = [];
            filas[seat.fila].push(seat);
        });

        Object.keys(filas).sort().forEach(filaName => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'seat-row';

            const rowLabel = document.createElement('div');
            rowLabel.className = 'row-label';
            rowLabel.textContent = filaName;
            rowDiv.appendChild(rowLabel);

            filas[filaName].forEach(seat => {
                const seatEl = document.createElement('div');
                seatEl.className = `seat ${seat.estado.toLowerCase()}`;
                seatEl.textContent = seat.numeroAsiento;

                if (seat.estado === 'Disponible') {
                    seatEl.addEventListener('click', () => reserveSeat(seat, seatEl));
                }
                rowDiv.appendChild(seatEl);
            });

            sectorDiv.appendChild(rowDiv);
        });

        container.appendChild(sectorDiv);
    });
}

async function refreshSeatMap() {
    if (!currentEventId) return;
    try {
        const response = await fetch(`${API_BASE}/events/${currentEventId}/seats`);
        if (response.ok) {
            const seats = await response.json();
            renderSeatMap(seats);
        }
    } catch (error) {
        console.error('Error refrescando el mapa:', error);
    }
}

// =========================================
// RESERVAS
// =========================================

async function reserveSeat(seat, seatElement) {
    seatElement.classList.add('processing');

    let data;
    let status;

    try {
        const response = await fetch(`${API_BASE}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ butacaId: seat.butacaId, usuarioId: 1 })
        });

        // Leemos el JSON una sola vez antes de cualquier ramificación
        status = response.status;
        data = await response.json();

    } catch (error) {
        seatElement.classList.remove('processing');
        showToast('Error de conexión. Revisá tu red.', 'error');
        return;
    }

    if (status === 200 || status === 201) {
        // Actualizamos el asiento visualmente y limpiamos sus listeners
        seatElement.className = 'seat reservada';
        const newSeat = seatElement.cloneNode(true);
        seatElement.parentNode.replaceChild(newSeat, seatElement);

        // Usamos data.expiracion del servidor — nunca calculamos el tiempo
        // en el cliente para evitar desfases entre relojes
        addCartItem(seat, data.reservaId, data.expiracion);
        showToast('¡Reserva exitosa! Revisá tu carrito 🎟', 'success');

    } else if (status === 409) {
        // Otro usuario ganó la carrera — refrescamos el mapa inmediatamente
        seatElement.classList.remove('processing');
        showToast('😔 Asiento ya no disponible. Otro usuario lo tomó.', 'error');
        refreshSeatMap();

    } else {
        seatElement.classList.remove('processing');
        showToast(data?.error || 'No se pudo reservar. Intentá de nuevo.', 'error');
    }
}

// =========================================
// CARRITO
// =========================================

let cartCount = 0;

function updateCartCount(delta) {
    cartCount += delta;
    if (cartCount < 0) cartCount = 0;
    document.getElementById('cart-count').textContent = cartCount;
}

function addCartItem(seat, reservaId, expiracion) {
    const cartContainer = document.getElementById('cart-items');

    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.id = `cart-item-${reservaId}`;

    cartItem.innerHTML = `
        <div class="cart-item-info">
            <h4>Reserva #${reservaId}</h4>
            <p>Sector ${seat.sectorNombre} — Fila ${seat.fila}, Butaca ${seat.numeroAsiento}</p>
        </div>
        <div class="cart-item-actions">
            <button class="remove-item-btn" 
                    onclick="removeCartItem(${reservaId})" 
                    title="Quitar reserva">×</button>
            <div class="cart-item-timer" id="timer-${reservaId}">05:00</div>
        </div>
    `;

    cartContainer.appendChild(cartItem);
    updateCartCount(1);
    openCart();

    // Pasamos la fecha de expiración del servidor para el countdown
    startTimer(reservaId, new Date(expiracion));
}

function startTimer(reservaId, expiracion) {
    const timerEl = document.getElementById(`timer-${reservaId}`);

    function tick() {
        const msRestantes = expiracion - new Date();

        if (msRestantes <= 0) {
            // Tiempo agotado — cancelamos y limpiamos
            clearInterval(activeTimers[reservaId]);
            delete activeTimers[reservaId];

            if (timerEl) {
                timerEl.textContent = '00:00';
                timerEl.classList.add('expired');
            }

            const cartItem = document.getElementById(`cart-item-${reservaId}`);
            if (cartItem) cartItem.classList.add('item-expired');

            showToast('⏰ Tiempo agotado. Tu reserva fue liberada.', 'error');

            // El Background Job ya liberó la butaca en el servidor,
            // refrescamos el mapa para que quede verde nuevamente
            refreshSeatMap();
            return;
        }

        const minutos = Math.floor(msRestantes / 60000);
        const segundos = Math.floor((msRestantes % 60000) / 1000);
        timerEl.textContent =
            `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        // Menos de 60 segundos → color rojo para urgencia
        timerEl.classList.toggle('expired', msRestantes < 60000);
    }

    // Ejecutamos inmediatamente para evitar el delay inicial de 1 segundo
    tick();
    activeTimers[reservaId] = setInterval(tick, 1000);
}

function removeCartItem(reservaId) {
    // Cancelamos el interval antes de remover el elemento del DOM
    // para evitar memory leaks y referencias a elementos inexistentes
    if (activeTimers[reservaId]) {
        clearInterval(activeTimers[reservaId]);
        delete activeTimers[reservaId];
    }

    const cartItem = document.getElementById(`cart-item-${reservaId}`);
    if (cartItem) cartItem.remove();

    updateCartCount(-1);
    showToast('Reserva eliminada del carrito.', 'success');
    refreshSeatMap();
}

// =========================================
// TOAST
// =========================================

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.className = `toast show ${type}`;
    toast.textContent = message;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// =========================================
// DRAWER DEL CARRITO
// =========================================

function toggleCart() {
    document.getElementById('cart-drawer').classList.toggle('open');
}

function openCart() {
    document.getElementById('cart-drawer').classList.add('open');
}

function closeCart() {
    document.getElementById('cart-drawer').classList.remove('open');
}