const API_BASE = '/api/v1';
let currentEventId = null;
let currentEventName = null;//para que se vea en la reserva

let maxTicketsAllowed = 0;
let currentReservedCount = 0;
let pendingEventToLoad = null;

let currentUser = null;

// Inicializar al recargar la página
function initAuth() {
    const savedUser = localStorage.getItem('ticketing_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        actualizarUI();
    } else {
        // SI NO HAY USUARIO, FORZAMOS EL POP-UP
        actualizarUI();
        openAuthModal();
    }

    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) {
        btnSalir.addEventListener('click', () => {
            console.log("¡Me hicieron clic!"); // Para que lo veas en F12
            localStorage.removeItem('ticketing_user');
            currentUser = null;
            window.location.href = window.location.pathname;
        });
    }
}

function actualizarUI() {
    if (currentUser) {
        document.getElementById('user-section').style.display = 'flex';
        document.getElementById('events-section').style.display = 'block';
        document.getElementById('user-name-display').textContent = currentUser.email;

        // Magia: Apenas sabemos quién es el usuario, traemos su carrito de la base de datos
        loadPendingReservations();
    } else {
        document.getElementById('user-section').style.display = 'none';
        document.getElementById('events-section').style.display = 'none';
    }
}

// Control del Pop-up
window.openAuthModal = () => document.getElementById('auth-modal').style.display = 'flex';
// Dejamos la función closeAuthModal por si la llamamos desde el código al loguear exitosamente
window.closeAuthModal = () => document.getElementById('auth-modal').style.display = 'none';

window.switchAuthTab = (tab) => {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');

    document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'flex' : 'none';
};

// Enviar Login o Registro
window.submitAuth = async (action) => {
    // CORRECCIÓN CLAVE: Agregamos API_BASE para evitar el error de red
    const endpoint = action === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
    let bodyData = {};

    if (action === 'login') {
        bodyData.email = document.getElementById('auth-email-login').value.trim();
        bodyData.password = document.getElementById('auth-password-login').value.trim();
        bodyData.nombre = "N/A";
    } else {
        bodyData.email = document.getElementById('auth-email-reg').value.trim();
        bodyData.password = document.getElementById('auth-password-reg').value.trim();
        bodyData.nombre = document.getElementById('auth-nombre-reg').value.trim();
    }

    if (!bodyData.email || !bodyData.password || (action === 'register' && !bodyData.nombre)) {
        showToast('Por favor, completá todos los campos.', 'error');
        return;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = { id: data.userId, nombre: data.nombre, email: data.email };
            localStorage.setItem('ticketing_user', JSON.stringify(currentUser));

            actualizarUI();
            closeAuthModal();
            showToast(`¡Bienvenido, ${currentUser.nombre}!`, 'success');
        } else {
            const errorData = await response.json();
            showToast(`Error: ${errorData.error}`, 'error');
        }
    } catch (err) {
        console.error("Error completo:", err); // Para debugear en la consola F12
        showToast('Error de conexión. ¿Está corriendo el backend?', 'error');
    }
};

window.logout = function () {
    console.log("Ejecutando logout..."); // Si abrís F12 deberías ver esto

    // 1. Limpiamos la memoria local
    localStorage.removeItem('ticketing_user');

    // 2. Blanqueamos la variable por las dudas
    currentUser = null;

    // 3. Redirección forzada y limpia (mejor que reload)
    window.location.href = window.location.pathname;
};
document.addEventListener('DOMContentLoaded', initAuth);

window.logout = function () {
    currentUser = null;
    localStorage.removeItem('ticketing_user');
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('user-section').style.display = 'none';
};

// Llamamos a la inicialización ni bien carga el script
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});
// Guardamos los intervals por reservaId para poder cancelarlos
// cuando el usuario remueve un item o expira el tiempo
const activeTimers = {};

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    loadPendingReservations();
    initSeatMapClickDelegation();
    document.getElementById('back-btn').addEventListener('click', showEventsSection);

    // Listeners estáticos del header y el drawer — sin onclick= en el HTML
    document.getElementById('cancel-operation-btn').addEventListener('click', cancelOperation);
    document.getElementById('confirm-qty-btn').addEventListener('click', confirmTicketQuantity);
    document.getElementById('close-qty-btn').addEventListener('click', closeTicketQuantityModal);
    document.getElementById('cart-toggle-btn').addEventListener('click', toggleCart);
    document.getElementById('close-cart-btn').addEventListener('click', closeCart);
    document.getElementById('pay-all-btn').addEventListener('click', payAll);

    // Delegación para los botones de cancelar (se crean dinámicamente en addCartItem)
    document.getElementById('cart-items').addEventListener('click', e => {
        const btn = e.target.closest('.remove-item-btn');
        if (!btn) return;
        const reservaId = parseInt(btn.dataset.reservaId, 10);
        if (reservaId) removeCartItem(reservaId);
    });
});

async function loadPendingReservations() {
    // Si no hay usuario logueado, no buscamos nada
    if (!currentUser) return;

    try {
        // ACÁ ESTABA EL ERROR: Cambiamos el 1 por currentUser.id
        const response = await fetch(`${API_BASE}/reservations/user/${currentUser.id}/pending`);

        if (response.ok) {
            const pending = await response.json();
            pending.forEach(p => {
                // Solo agregar si no existe ya en el HTML
                if (!document.getElementById(`cart-item-${p.reservaId}`)) {
                    currentReservedCount++; // Sumamos a la memoria para no pasarnos del límite
                    addCartItem(p.butaca, p.reservaId, p.expiracion, p.eventoNombre);
                }
            });
        }
    } catch (error) {
        console.error('Error cargando reservas pendientes:', error);
    }
}

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

        if (esActivo) {
            card.addEventListener('click', () => promptTicketQuantity(event));
        } else {
            // Evento inactivo: no abre nada y tira error
            card.addEventListener('click', () => showToast('Este evento ya no está disponible.', 'error'));
        }

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
    currentEventName = event.nombre;

    const itemsEnCarrito = document.querySelectorAll('#cart-items .cart-item');
    let contador = 0;
    itemsEnCarrito.forEach(item => {
        if (item.querySelector('h4').textContent === event.nombre) {
            contador++;
        }
    });
    currentReservedCount = contador;
    showSeatMapSection(event.nombre);

    try {
        const response = await fetch(`${API_BASE}/events/${event.id}/seats`);
        const seats = await response.json();
        renderSeatMap(seats);
    } catch (error) {
        showToast('Error al cargar butacas', 'error');
    }
}

// Mapa en memoria para la delegación de eventos: butacaId -> objeto seat completo.
// Se reconstruye con cada llamada a renderSeatMap.
const seatRegistry = new Map();

function renderSeatMap(seats) {
    const container = document.getElementById('seat-grid-container');
    container.innerHTML = '';
    seatRegistry.clear();

    // --- Agrupación ---
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

    // --- Construcción en un DocumentFragment (sin tocar el DOM real) ---
    const fragment = document.createDocumentFragment();

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
                    // Guardamos el objeto completo en el registro para la delegación
                    seatEl.dataset.butacaId = seat.butacaId;
                    seatRegistry.set(String(seat.butacaId), seat);
                }

                rowDiv.appendChild(seatEl);
            });

            sectorDiv.appendChild(rowDiv);
        });

        fragment.appendChild(sectorDiv); // Va al fragment, no al DOM real
    });

    // --- 1 solo Repaint: inyectamos todo de una sola vez ---
    container.appendChild(fragment);
}

// Listener delegado: UNO solo para toda la grilla, registrado en DOMContentLoaded.
// Captura clicks en cualquier butaca disponible sin importar cuántas haya.
function initSeatMapClickDelegation() {
    const container = document.getElementById('seat-grid-container');
    container.addEventListener('click', e => {
        const seatEl = e.target.closest('.seat.disponible');
        if (!seatEl) return;

        const seat = seatRegistry.get(seatEl.dataset.butacaId);
        if (seat) reserveSeat(seat, seatEl);
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
    // 1. BLOQUEO DE SEGURIDAD (Si no hay usuario, abrimos el Pop-up y cortamos)
    if (!currentUser) {
        openAuthModal();
        return;
    }
    if (currentReservedCount >= maxTicketsAllowed) {
        showToast(`Ya seleccionaste el máximo de ${maxTicketsAllowed} butaca(s).`, 'error');
        return;
    }
    seatElement.classList.add('processing');

    let data;
    let status;

    try {
        const response = await fetch(`${API_BASE}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 2. REEMPLAZO CLAVE: Usamos currentUser.id en vez del 1
            body: JSON.stringify({ butacaId: seat.butacaId, usuarioId: currentUser.id })
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
        addCartItem(seat, data.reservaId, data.expiracion, currentEventName);
        showToast('¡Reserva exitosa! Revisá tu carrito', 'success');
        currentReservedCount++;

    } else if (status === 409) {
        // Otro usuario ganó la carrera — refrescamos el mapa inmediatamente
        seatElement.classList.remove('processing');
        showToast('Asiento ya no disponible. Otro usuario lo tomó.', 'error');
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

function addCartItem(seat, reservaId, expiracion, eventoNombre) {
    const cartContainer = document.getElementById('cart-items');

    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.id = `cart-item-${reservaId}`;

    cartItem.innerHTML = `
        <div class="cart-item-info">
           <h4>${eventoNombre ?? 'Evento'}</h4> 
            <p>Sector ${seat.sectorNombre} — Fila ${seat.fila}, Butaca ${seat.numeroAsiento}</p>
        </div>
        <div class="cart-item-actions">
            <button class="remove-item-btn"
                    data-reserva-id="${reservaId}"
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
            if (cartItem) {
                cartItem.classList.add('item-expired');

                // Quitamos el botón de remover
                const removeBtn = cartItem.querySelector('.remove-item-btn');
                if (removeBtn) removeBtn.remove();

                // Lo movemos a la sección de expiradas
                const expiredContainer = document.getElementById('cart-items-expired');
                if (expiredContainer) expiredContainer.appendChild(cartItem);
            }

            updateCartCount(-1);
            showToast('Tiempo agotado. Tu reserva fue liberada.', 'error');

            currentReservedCount--;
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

async function removeCartItem(reservaId) {
    if (!currentUser) {
        openAuthModal();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/reservations/${reservaId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // REEMPLAZO CLAVE: Usamos el ID del usuario real
            body: JSON.stringify({ usuarioId: currentUser.id })
        });

        const data = await response.json();

        if (response.ok) {
            if (activeTimers[reservaId]) {
                clearInterval(activeTimers[reservaId]);
                delete activeTimers[reservaId];
                currentReservedCount--;
            }

            const cartItem = document.getElementById(`cart-item-${reservaId}`);
            if (cartItem) cartItem.remove();

            updateCartCount(-1);
            showToast('Reserva cancelada exitosamente.', 'success');
            refreshSeatMap();
        } else {
            showToast(data?.error || 'Error al cancelar la reserva.', 'error');
        }
    } catch (error) {
        showToast('Error de conexión al cancelar.', 'error');
    }
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

async function payAll() {
    // 1. Barrera de seguridad
    if (!currentUser) {
        openAuthModal();
        return;
    }

    const cartItems = document.getElementById('cart-items').children;
    if (cartItems.length === 0) {
        showToast('El carrito está vacío.', 'error');
        return;
    }

    const reservaIds = Array.from(cartItems).map(item => parseInt(item.id.replace('cart-item-', '')));

    let successCount = 0;

    // Cambiamos a estilo de botón "Cargando..."
    const payBtn = document.getElementById('pay-all-btn');
    payBtn.textContent = 'Procesando...';
    payBtn.disabled = true;

    for (const reservaId of reservaIds) {
        try {
            const response = await fetch(`${API_BASE}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 2. LA SOLUCIÓN: Usamos el ID del usuario real
                body: JSON.stringify({ reservaId: reservaId, usuarioId: currentUser.id })
            });

            const data = await response.json();

            if (response.ok) {
                if (activeTimers[reservaId]) {
                    clearInterval(activeTimers[reservaId]);
                    delete activeTimers[reservaId];
                }
                const cartItem = document.getElementById(`cart-item-${reservaId}`);
                if (cartItem) cartItem.remove();
                updateCartCount(-1);
                successCount++;
            } else {
                showToast(data?.error || `Error al pagar reserva #${reservaId}`, 'error');
            }
        } catch (error) {
            showToast(`Error de conexión al pagar reserva #${reservaId}`, 'error');
        }
    }

    payBtn.textContent = 'Pagar Todo';
    payBtn.disabled = false;

    if (successCount > 0) {
        showToast(`¡${successCount} pago(s) exitoso(s)!`, 'success');
        refreshSeatMap();
        if (document.getElementById('cart-items').children.length === 0) {
            closeCart();
        }
    }

}

function promptTicketQuantity(event) {
    // 1. Buscamos si el usuario ya había fijado un límite para ESTE evento
    const savedLimit = sessionStorage.getItem(`max_tickets_${event.id}`);

    if (savedLimit) {
        // Restauramos su límite original
        maxTicketsAllowed = parseInt(savedLimit, 10);

        // Recontamos cuántas reservas ya tiene en el carrito
        const itemsEnCarrito = document.querySelectorAll('#cart-items .cart-item');
        let reservasPrevias = 0;
        itemsEnCarrito.forEach(item => {
            if (item.querySelector('h4').textContent === event.nombre) {
                reservasPrevias++;
            }
        });

        currentReservedCount = reservasPrevias;
        loadSeatMap(event);
        return;
    }

    // 2. Si es un evento nuevo y no hay límite, abrimos el Pop-up
    pendingEventToLoad = event;
    const modal = document.getElementById('qty-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function confirmTicketQuantity() {
    const qtyInput = document.getElementById('ticket-qty-input');
    const qty = parseInt(qtyInput.value, 10);

    if (isNaN(qty) || qty < 1 || qty > 10) {
        showToast('Por favor, ingresá una cantidad válida (1 a 10).', 'error');
        return;
    }

    // Fijamos los límites en las variables
    maxTicketsAllowed = qty;
    currentReservedCount = 0;

    // GUARDAMOS EL LÍMITE EN LA SESIÓN DEL NAVEGADOR
    if (pendingEventToLoad) {
        sessionStorage.setItem(`max_tickets_${pendingEventToLoad.id}`, qty);

        document.getElementById('qty-modal').style.display = 'none';
        qtyInput.value = '1';

        loadSeatMap(pendingEventToLoad);
        pendingEventToLoad = null;
    }
}
async function cancelOperation() {
    if (!currentEventId) return;

    // 1. Borramos la "sesión" de cantidad de este evento
    sessionStorage.removeItem(`max_tickets_${currentEventId}`);
    maxTicketsAllowed = 0;
    currentReservedCount = 0;

    // 2. Liberamos las butacas que haya reservado para este evento
    const itemsEnCarrito = document.querySelectorAll('#cart-items .cart-item');
    for (let item of itemsEnCarrito) {
        // Le mandamos .trim() para evitar que un espacio rompa la validación
        const tituloEnCarrito = item.querySelector('h4').textContent.trim();
        const tituloActual = currentEventName.trim();

        if (tituloEnCarrito === tituloActual) {
            const btnRemove = item.querySelector('.remove-item-btn');
            if (btnRemove) {
                const reservaId = btnRemove.dataset.reservaId;
                await removeCartItem(reservaId);
            }
        }
    }

    // 3. Volvemos a la pantalla principal
    showEventsSection();
    showToast('Operación cancelada. El límite se reseteó a cero.', 'success');
}