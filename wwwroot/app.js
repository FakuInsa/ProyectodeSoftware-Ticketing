const API_BASE = '/api/v1';
let currentEventId = null;
let currentEventName = null;
let currentUser = null;
let pendingEventToLoad = null;

// Plan B: Sesión Global
let currentSessionId = null;
let globalTimerInterval = null;

// SignalR Connection
let connection = null;

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadEvents();
    initSeatMapClickDelegation();
    initSignalR();

    // Listeners UI
    document.getElementById('back-btn').addEventListener('click', showEventsSection);
    document.getElementById('cancel-operation-btn').addEventListener('click', cancelOperation);
    document.getElementById('cart-toggle-btn').addEventListener('click', toggleCart);
    document.getElementById('close-cart-btn').addEventListener('click', closeCart);
    document.getElementById('pay-all-btn').addEventListener('click', payAll);
    document.getElementById('btn-salir').addEventListener('click', logout);

    // Listeners del Pop-up de Cantidad
    document.getElementById('close-qty-btn').addEventListener('click', () => document.getElementById('qty-modal').classList.add('hidden'));
    document.getElementById('confirm-qty-btn').addEventListener('click', startSession);

    // Listeners Autenticación
    document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('btn-submit-login').addEventListener('click', () => submitAuth('login'));
    document.getElementById('btn-submit-register').addEventListener('click', () => submitAuth('register'));

    // Listeners Pago (Simulación)
    document.getElementById('close-payment-btn').addEventListener('click', () => document.getElementById('payment-modal').classList.add('hidden'));
    document.getElementById('btn-confirm-payment').addEventListener('click', processPayment);

    document.getElementById('cart-items').addEventListener('click', e => {
        const btn = e.target.closest('.remove-item-btn');
        if (!btn) return;
        const reservaId = parseInt(btn.dataset.reservaId, 10);
        if (reservaId) removeCartItem(reservaId);
    });
});

function initAuth() {
    const savedUser = localStorage.getItem('ticketing_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        actualizarUI();
    } else {
        actualizarUI();
        openAuthModal();
    }
}

function actualizarUI() {
    if (currentUser) {
        document.getElementById('user-section').classList.remove('hidden');
        document.getElementById('events-section').classList.remove('hidden');
        document.getElementById('user-name-display').textContent = currentUser.email;
        checkActiveSession();
    } else {
        document.getElementById('user-section').classList.add('hidden');
        document.getElementById('events-section').classList.add('hidden');
    }
}

const openAuthModal = () => document.getElementById('auth-modal').classList.remove('hidden');
const closeAuthModal = () => document.getElementById('auth-modal').classList.add('hidden');

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
}

async function submitAuth(action) {
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
        showToast('Error de conexión.', 'error');
    }
}

function logout() {
    localStorage.removeItem('ticketing_user');
    currentUser = null;
    window.location.href = window.location.pathname;
}

// ==========================================
// SESSION MANAGAMENT (PLAN B) & SIGNALR
// ==========================================

function initSignalR() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/ticketingHub")
        .withAutomaticReconnect()
        .build();

    connection.on("SeatMapUpdated", () => {
        // Solo refrescar si el mapa está visible
        if (!document.getElementById('seat-map-section').classList.contains('hidden')) {
            refreshSeatMap();
        }
    });

    connection.start().catch(err => console.error("Error conectando a SignalR: ", err));
}

async function checkActiveSession() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_BASE}/sessions/active/${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            // Restaura la sesión activa
            currentSessionId = data.sesionId;
            currentEventId = data.eventoId;
            currentEventName = data.eventoNombre;

            // Restaura reservas en carrito
            data.reservas.forEach(p => {
                if (!document.getElementById(`cart-item-${p.reservaId}`)) {
                    addCartItem(p.butaca, p.reservaId, data.eventoNombre);
                }
            });

            // Inicia timer visual
            startGlobalTimer(new Date(data.expiracionGlobal));

            // Carga el mapa
            showSeatMapSection(data.eventoNombre);
            refreshSeatMap();
        }
    } catch (error) {
        console.error('No se pudo verificar la sesión:', error);
    }
}

function openQtyModal(event) {
    if (!currentUser) {
        openAuthModal();
        return;
    }

    // Si ya tiene una sesión activa para este evento, lo pasamos directo al mapa
    if (currentSessionId && currentEventId === event.id) {
        showSeatMapSection(event.nombre);
        refreshSeatMap();
        return;
    } else if (currentSessionId && currentEventId !== event.id) {
        showToast('Tienes una sesión activa en otro evento. Cancélala primero.', 'error');
        return;
    }

    pendingEventToLoad = event;
    document.getElementById('ticket-qty-input').value = 1;
    document.getElementById('qty-modal').classList.remove('hidden');
}

async function startSession() {
    const qtyInput = document.getElementById('ticket-qty-input');
    const limiteElegido = parseInt(qtyInput.value, 10);

    if (isNaN(limiteElegido) || limiteElegido < 1 || limiteElegido > 10) {
        showToast('Por favor, ingresá una cantidad válida (1 a 10).', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: currentUser.id,
                eventoId: pendingEventToLoad.id,
                limiteElegido: limiteElegido
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentSessionId = data.sesionId;
            document.getElementById('qty-modal').classList.add('hidden');

            startGlobalTimer(new Date(data.expiracionGlobal));
            loadSeatMap(pendingEventToLoad);
            pendingEventToLoad = null;
        } else {
            showToast(data.error || 'Error al crear la sesión.', 'error');
        }
    } catch (err) {
        showToast('Error de conexión al iniciar sesión de compra.', 'error');
    }
}

function startGlobalTimer(expiracion) {
    document.getElementById('global-timer-container').classList.remove('hidden');
    const timerEl = document.getElementById('global-timer');

    if (globalTimerInterval) clearInterval(globalTimerInterval);

    function tick() {
        const msRestantes = expiracion - new Date();

        if (msRestantes <= 0) {
            clearInterval(globalTimerInterval);
            globalTimerInterval = null;

            timerEl.textContent = '00:00';
            timerEl.classList.add('expired');

            showToast('Tu sesión ha expirado. Las butacas han sido liberadas.', 'error');
            resetSessionUI();
            showEventsSection();
            return;
        }

        const minutos = Math.floor(msRestantes / 60000);
        const segundos = Math.floor((msRestantes % 60000) / 1000);
        timerEl.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
        timerEl.classList.toggle('expired', msRestantes < 60000);
    }

    tick();
    globalTimerInterval = setInterval(tick, 1000);
}

function resetSessionUI() {
    currentSessionId = null;
    currentEventId = null;
    currentEventName = null;
    if (globalTimerInterval) clearInterval(globalTimerInterval);
    document.getElementById('global-timer-container').classList.add('hidden');
    document.getElementById('cart-items').innerHTML = '';
    cartCount = 0;
    document.getElementById('cart-count').textContent = cartCount;
}


// ==========================================
// EVENTOS Y MAPA
// ==========================================

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
            // AHORA LLAMA A openQtyModal en lugar de loadSeatMap directamente
            card.addEventListener('click', () => openQtyModal(event));
        } else {
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
    document.getElementById('seat-grid-container').innerHTML = '<div class="loading-msg">Cargando butacas...</div>';
}

async function loadSeatMap(event) {
    currentEventId = event.id;
    currentEventName = event.nombre;
    showSeatMapSection(event.nombre);
    await refreshSeatMap();
}

const seatRegistry = new Map();

function renderSeatMap(seats) {
    const container = document.getElementById('seat-grid-container');
    container.innerHTML = '';
    seatRegistry.clear();

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
                    seatEl.dataset.butacaId = seat.butacaId;
                    seatRegistry.set(String(seat.butacaId), seat);
                }

                rowDiv.appendChild(seatEl);
            });

            sectorDiv.appendChild(rowDiv);
        });

        fragment.appendChild(sectorDiv);
    });

    container.appendChild(fragment);
}

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

// ==========================================
// RESERVAS (ASOCIADAS A SESIÓN GLOBAL)
// ==========================================

async function reserveSeat(seat, seatElement) {
    if (!currentSessionId) {
        showToast('No tienes una sesión de compra activa.', 'error');
        return;
    }
    seatElement.classList.add('processing');

    try {
        const response = await fetch(`${API_BASE}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sesionId: currentSessionId,
                butacaId: seat.butacaId
            })
        });

        const status = response.status;
        const data = await response.json();

        if (status === 200 || status === 201) {
            seatElement.className = 'seat reservada';
            const newSeat = seatElement.cloneNode(true);
            seatElement.parentNode.replaceChild(newSeat, seatElement);

            addCartItem(seat, data.reservaId, currentEventName);
            showToast('¡Reserva exitosa!', 'success');
        } else if (status === 409) {
            seatElement.classList.remove('processing');
            showToast('Asiento ya no disponible.', 'error');
            refreshSeatMap();
        } else {
            seatElement.classList.remove('processing');
            showToast(data?.error || 'No se pudo reservar.', 'error');
        }
    } catch (error) {
        seatElement.classList.remove('processing');
        showToast('Error de conexión. Revisá tu red.', 'error');
    }
}

let cartCount = 0;

function updateCartCount(delta) {
    cartCount += delta;
    if (cartCount < 0) cartCount = 0;
    document.getElementById('cart-count').textContent = cartCount;
}

// No pasamos expiración individual porque usamos la global
function addCartItem(seat, reservaId, eventoNombre) {
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
            <button class="remove-item-btn" data-reserva-id="${reservaId}" title="Quitar reserva">×</button>
        </div>
    `;

    cartContainer.appendChild(cartItem);
    updateCartCount(1);
    openCart();
}


async function removeCartItem(reservaId) {
    try {
        const response = await fetch(`${API_BASE}/reservations/${reservaId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuarioId: currentUser.id }) // Si backend requiere validacion
        });

        const data = await response.json();

        if (response.ok) {
            const cartItem = document.getElementById(`cart-item-${reservaId}`);
            if (cartItem) cartItem.remove();

            updateCartCount(-1);
            showToast('Reserva removida.', 'success');
            refreshSeatMap();
        } else {
            showToast(data?.error || 'Error al cancelar la reserva.', 'error');
        }
    } catch (error) {
        showToast('Error de conexión.', 'error');
    }
}

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

function toggleCart() { document.getElementById('cart-drawer').classList.toggle('open'); }
function openCart() { document.getElementById('cart-drawer').classList.add('open'); }
function closeCart() { document.getElementById('cart-drawer').classList.remove('open'); }

function openPaymentModal() {
    if (!currentUser) return;
    const cartItems = document.getElementById('cart-items').children;
    if (cartItems.length === 0) {
        showToast('El carrito está vacío.', 'error');
        return;
    }
    // Limpiar campos
    document.getElementById('card-number').value = '';
    document.getElementById('card-expiry').value = '';
    document.getElementById('card-cvv').value = '';
    
    document.getElementById('payment-modal').classList.remove('hidden');
}

async function processPayment() {
    const cardNum = document.getElementById('card-number').value.replace(/\s/g, '');
    const cardExpiry = document.getElementById('card-expiry').value;
    const cardCvv = document.getElementById('card-cvv').value;

    // Validaciones simples de simulación
    if (cardNum.length !== 16 || isNaN(cardNum)) {
        showToast('El número de tarjeta debe tener 16 dígitos.', 'error');
        return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        showToast('La fecha debe tener el formato MM/YY.', 'error');
        return;
    }
    if (cardCvv.length !== 3 || isNaN(cardCvv)) {
        showToast('El CVV debe tener 3 dígitos.', 'error');
        return;
    }

    // Si pasa "validación", procedemos al pago real en backend
    document.getElementById('payment-modal').classList.add('hidden');
    
    const cartItems = document.getElementById('cart-items').children;
    const reservaIds = Array.from(cartItems).map(item => parseInt(item.id.replace('cart-item-', '')));
    let successCount = 0;
    
    const confirmBtn = document.getElementById('btn-confirm-payment');
    confirmBtn.textContent = 'Procesando...';
    confirmBtn.disabled = true;

    for (const reservaId of reservaIds) {
        try {
            const response = await fetch(`${API_BASE}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservaId: reservaId, usuarioId: currentUser.id })
            });

            if (response.ok) {
                const cartItem = document.getElementById(`cart-item-${reservaId}`);
                if (cartItem) cartItem.remove();
                updateCartCount(-1);
                successCount++;
            }
        } catch (error) {
            console.error(error);
        }
    }

    confirmBtn.textContent = 'Pagar Ahora';
    confirmBtn.disabled = false;

    if (successCount > 0) {
        showToast(`¡Pago realizado con éxito! Se procesaron ${successCount} entradas.`, 'success');
        refreshSeatMap();
        if (document.getElementById('cart-items').children.length === 0) {
            closeCart();
            cancelOperation();
        }
    }
}

// Renombramos payAll para que solo abra el modal
function payAll() {
    openPaymentModal();
}

async function cancelOperation() {
    if (currentSessionId) {
        try {
            await fetch(`${API_BASE}/sessions/${currentSessionId}/cancel`, { method: 'POST' });
        } catch (e) { }
    }
    resetSessionUI();
    showEventsSection();
}