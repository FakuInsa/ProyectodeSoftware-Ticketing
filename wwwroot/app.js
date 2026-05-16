const API_BASE = '/api/v1';
let currentEventId = null;
let currentEventName = null;
let currentUser = null;
let pendingEventToLoad = null;
let currentSessionId = null;
let globalTimerInterval = null;
let connection = null;
let cartCount = 0;
const seatRegistry = new Map();

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadEvents();
    initSeatMapClickDelegation();
    initSignalR();

    // Input Masks (DRY)
    ['card-number', 'card-cvv'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, ''));
    });

    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', e => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2, 4);
            e.target.value = val;
        });
    }

    // UI Listeners
    document.getElementById('back-btn').addEventListener('click', showEventsSection);
    document.getElementById('cancel-operation-btn').addEventListener('click', cancelOperation);
    document.getElementById('cart-toggle-btn').addEventListener('click', toggleCart);
    document.getElementById('close-cart-btn').addEventListener('click', closeCart);
    document.getElementById('pay-all-btn').addEventListener('click', () => document.getElementById('payment-modal').classList.remove('hidden'));
    document.getElementById('btn-salir').addEventListener('click', logout);
    document.getElementById('close-qty-btn').addEventListener('click', () => document.getElementById('qty-modal').classList.add('hidden'));
    document.getElementById('confirm-qty-btn').addEventListener('click', startSession);

    // Auth Listeners
    document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('btn-submit-login').addEventListener('click', () => submitAuth('login'));
    document.getElementById('btn-submit-register').addEventListener('click', () => submitAuth('register'));

    // Payment Listeners
    document.getElementById('close-payment-btn').addEventListener('click', () => document.getElementById('payment-modal').classList.add('hidden'));
    document.getElementById('btn-confirm-payment').addEventListener('click', processPayment);

    document.getElementById('cart-items').addEventListener('click', e => {
        const btn = e.target.closest('.remove-item-btn');
        if (btn) removeCartItem(parseInt(btn.dataset.reservaId, 10));
    });
});

function initAuth() {
    const savedUser = localStorage.getItem('ticketing_user');
    if (savedUser) currentUser = JSON.parse(savedUser);
    actualizarUI();
    if (!currentUser) openAuthModal();
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
    const isLogin = action === 'login';
    const endpoint = isLogin ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;

    const bodyData = {
        email: document.getElementById(isLogin ? 'auth-email-login' : 'auth-email-reg').value.trim(),
        password: document.getElementById(isLogin ? 'auth-password-login' : 'auth-password-reg').value.trim(),
        nombre: isLogin ? "N/A" : document.getElementById('auth-nombre-reg').value.trim()
    };

    if (!bodyData.email || !bodyData.password || (!isLogin && !bodyData.nombre)) {
        return showToast('Por favor, completá todos los campos.', 'error');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bodyData.email)) {
        return showToast('Formato de email inválido.', 'error');
    }

    if (!isLogin) {
        if (/\d/.test(bodyData.nombre)) return showToast('El nombre no puede contener números.', 'error');
        if (bodyData.nombre.length < 2) return showToast('El nombre es muy corto.', 'error');
        if (bodyData.password.length < 6) return showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
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
    } catch {
        showToast('Error de conexión al servidor.', 'error');
    }
}

function logout() {
    localStorage.removeItem('ticketing_user');
    currentUser = null;
    window.location.href = window.location.pathname;
}

function initSignalR() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/ticketingHub")
        .withAutomaticReconnect()
        .build();

    connection.on("SeatMapUpdated", () => {
        if (!document.getElementById('seat-map-section').classList.contains('hidden')) {
            refreshSeatMap();
        }
    });

    connection.start().catch(err => console.error("SignalR Error:", err));
}

async function checkActiveSession() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_BASE}/sessions/active/${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            currentSessionId = data.sesionId;
            currentEventId = data.eventoId;
            currentEventName = data.eventoNombre;

            data.reservas.forEach(p => {
                if (!document.getElementById(`cart-item-${p.reservaId}`)) {
                    addCartItem(p.butaca, p.reservaId, data.eventoNombre);
                }
            });

            startGlobalTimer(new Date(data.expiracionGlobal));
            showSeatMapSection(data.eventoNombre);
            refreshSeatMap();
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

function openQtyModal(event) {
    if (!currentUser) return openAuthModal();

    if (currentSessionId && currentEventId === event.id) {
        showSeatMapSection(event.nombre);
        refreshSeatMap();
        return;
    } else if (currentSessionId && currentEventId !== event.id) {
        return showToast('Tienes una sesión activa en otro evento. Cancélala primero.', 'error');
    }

    pendingEventToLoad = event;
    document.getElementById('ticket-qty-input').value = 1;
    document.getElementById('qty-modal').classList.remove('hidden');
}

async function startSession() {
    const limiteElegido = parseInt(document.getElementById('ticket-qty-input').value, 10);

    if (isNaN(limiteElegido) || limiteElegido < 1 || limiteElegido > 10) {
        return showToast('Cantidad inválida (1 a 10).', 'error');
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
    } catch {
        showToast('Error de conexión al iniciar sesión.', 'error');
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
            showToast('Sesión expirada. Butacas liberadas.', 'error');
            resetSessionUI();
            showEventsSection();
            return;
        }

        const mins = Math.floor(msRestantes / 60000).toString().padStart(2, '0');
        const secs = Math.floor((msRestantes % 60000) / 1000).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
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

        // Convertimos la fecha del backend a un formato amigable con día de la semana
        const fechaObj = new Date(event.fecha);
        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
        let fechaFormateada = fechaObj.toLocaleDateString('es-ES', opciones);

        // Ponemos la primera letra en mayúscula (ej: Viernes...)
        fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

        card.innerHTML = `
            <h3 class="event-title">${event.nombre}</h3>
            <div class="event-detail">${fechaFormateada}</div>
            <div class="event-detail"> ${event.lugar}</div>
        `;

        card.addEventListener('click', () => esActivo ? openQtyModal(event) : showToast('Evento no disponible.', 'error'));
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

function renderSeatMap(seats) {
    const container = document.getElementById('seat-grid-container');
    container.innerHTML = '';

    // --- NUEVO: Generar Lista de Precios 100% Dinámica ---
    const sectorPrices = {};
    seats.forEach(seat => {
        if (!sectorPrices[seat.sectorNombre]) {
            sectorPrices[seat.sectorNombre] = seat.precio;
        }
    });

    const priceListUl = document.querySelector('.price-legend-box ul');
    if (priceListUl) {
        priceListUl.innerHTML = '';

        const sortedPrices = Object.entries(sectorPrices).sort((a, b) => b[1] - a[1]);

        sortedPrices.forEach(([name, price]) => {
            let colorClass = 'general-color';
            const lower = name.toLowerCase();

            if (lower.includes('palco')) colorClass = 'palco-color';
            else if (lower.includes('platea') || lower.includes('izq') || lower.includes('der') || lower.includes('central')) colorClass = 'platea-color';

            const li = document.createElement('li');
            li.innerHTML = `<span class="color-box ${colorClass}"></span> ${name}: $${Number(price).toLocaleString('es-AR')}`;
            priceListUl.appendChild(li);
        });
    }
    // ----------------------------------------------------

    const sectors = {};
    seats.forEach(seat => {
        if (!sectors[seat.sectorNombre]) sectors[seat.sectorNombre] = [];
        sectors[seat.sectorNombre].push(seat);
    });

    const orderedSectorNames = Object.keys(sectors).sort((a, b) => {
        if (a.toLowerCase().includes('campo') || a.toLowerCase().includes('general')) return -1;
        if (b.toLowerCase().includes('campo') || b.toLowerCase().includes('general')) return 1;
        return 0;
    });

    orderedSectorNames.forEach(sectorName => {
        const sectorDiv = document.createElement('div');
        const sectorClass = getSectorClass(sectorName);
        sectorDiv.className = `sector-container ${sectorClass}`;

        sectorDiv.innerHTML = `<h3 class="sector-title">${sectorName}</h3>`;

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

// Helper: devuelve clase CSS según el nombre del sector
function getSectorClass(sectorName) {
    const lower = sectorName.toLowerCase();

    if (lower.includes('izquierda') || lower.includes('izq')) return 'sector-lateral-izq';
    if (lower.includes('derecha') || lower.includes('der')) return 'sector-lateral-der';
    if (lower.includes('general') || lower.includes('campo')) return 'sector-general';
    if (lower.includes('central')) return 'sector-platea-central';

    // NUEVO: Identificamos cada palco por separado para el CSS Grid
    if (lower.includes('palco a')) return 'sector-palco palco-a';
    if (lower.includes('palco b')) return 'sector-palco palco-b';
    if (lower.includes('palco c')) return 'sector-palco palco-c';
    if (lower.includes('palco d')) return 'sector-palco palco-d';

    if (lower.includes('palco')) return 'sector-palco'; // Fallback
    return 'sector-default';
}

function initSeatMapClickDelegation() {
    document.getElementById('seat-grid-container').addEventListener('click', e => {
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
        if (response.ok) renderSeatMap(await response.json());
    } catch (error) {
        console.error('Error refrescando mapa:', error);
    }
}

async function reserveSeat(seat, seatElement) {
    if (!currentSessionId) return showToast('No tienes sesión activa.', 'error');

    seatElement.classList.add('processing');

    try {
        const response = await fetch(`${API_BASE}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sesionId: currentSessionId, butacaId: seat.butacaId })
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
    } catch {
        seatElement.classList.remove('processing');
        showToast('Error de conexión.', 'error');
    }
}

function updateCartCount(delta) {
    cartCount = Math.max(0, cartCount + delta);
    document.getElementById('cart-count').textContent = cartCount;
}

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
            <button class="remove-item-btn" data-reserva-id="${reservaId}" title="Quitar reserva">&times;</button>
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
            body: JSON.stringify({ usuarioId: currentUser.id })
        });

        if (response.ok) {
            const cartItem = document.getElementById(`cart-item-${reservaId}`);
            if (cartItem) cartItem.remove();
            updateCartCount(-1);
            showToast('Reserva removida.', 'success');
            refreshSeatMap();
        } else {
            const data = await response.json();
            showToast(data?.error || 'Error al cancelar reserva.', 'error');
        }
    } catch {
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

async function processPayment() {
    const cardNum = document.getElementById('card-number').value;
    const cardExpiry = document.getElementById('card-expiry').value;
    const cardCvv = document.getElementById('card-cvv').value;

    if (cardNum.length !== 16) return showToast('El número debe tener 16 dígitos.', 'error');
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return showToast('Formato MM/YY requerido.', 'error');
    if (cardCvv.length !== 3) return showToast('El CVV debe tener 3 dígitos.', 'error');

    document.getElementById('payment-modal').classList.add('hidden');
    const reservaIds = Array.from(document.getElementById('cart-items').children).map(item => parseInt(item.id.replace('cart-item-', '')));

    const confirmBtn = document.getElementById('btn-confirm-payment');
    confirmBtn.textContent = 'Procesando...';
    confirmBtn.disabled = true;

    let successCount = 0;
    for (const reservaId of reservaIds) {
        try {
            const response = await fetch(`${API_BASE}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservaId, usuarioId: currentUser.id })
            });

            if (response.ok) {
                const cartItem = document.getElementById(`cart-item-${reservaId}`);
                if (cartItem) cartItem.remove();
                updateCartCount(-1);
                successCount++;
            }
        } catch (error) {
            console.error('Error procesando pago:', error);
        }
    }

    confirmBtn.textContent = 'Pagar Ahora';
    confirmBtn.disabled = false;

    if (successCount > 0) {
        showToast(`¡Pago de ${successCount} entrada(s) exitoso!`, 'success');
        refreshSeatMap();
        if (document.getElementById('cart-items').children.length === 0) {
            closeCart();
            cancelOperation();
        }
    }
}

async function cancelOperation() {
    if (currentSessionId) {
        try {
            await fetch(`${API_BASE}/sessions/${currentSessionId}/cancel`, { method: 'POST' });
        } catch (e) { console.error('Error cancelando sesión', e); }
    }
    resetSessionUI();
    showEventsSection();
}