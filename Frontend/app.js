const API_BASE = '/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    document.getElementById('back-btn').addEventListener('click', showEventsSection);
});

async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE}/events`);
        const result = await response.json();
        renderEvents(result.data || []);
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-container');
    container.innerHTML = '';
    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <h3>${event.nombre}</h3>
            <div>${event.lugar}</div>
        `;
        card.addEventListener('click', () => loadSeatMap(event));
        container.appendChild(card);
    });
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }

    // Asignamos las clases limpias (sin inyectar borderLeft por JS)
    toast.className = `toast show ${type}`;
    toast.textContent = message;

    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showEventsSection() {
    document.getElementById('events-section').classList.remove('hidden');
    document.getElementById('seat-map-section').classList.add('hidden');
}

function showSeatMapSection(eventTitle) {
    document.getElementById('events-section').classList.add('hidden');
    document.getElementById('seat-map-section').classList.remove('hidden');
    document.getElementById('event-title').textContent = eventTitle;

    // Reemplazamos el style inline por una clase de CSS
    document.getElementById('seat-grid-container').innerHTML = '<div class="loading-msg">Cargando butacas...</div>';
}

async function loadSeatMap(event) {
    showSeatMapSection(event.nombre);
    try {
        const response = await fetch(`${API_BASE}/events/${event.id}/seats`);
        const seats = await response.json();
        renderSeatMap(seats);
    } catch (error) {
        showToast('Error al cargar butacas', 'error');
    }
}

function renderSeatMap(seats) {
    const container = document.getElementById('seat-grid-container');
    container.innerHTML = '';

    // 1. Agrupar por Sector
    const sectors = {};
    seats.forEach(seat => {
        if (!sectors[seat.sectorNombre]) sectors[seat.sectorNombre] = [];
        sectors[seat.sectorNombre].push(seat);
    });

    // REQUISITO CUMPLIDO: Forzar el orden para que "Campo" esté arriba
    const orderedSectorNames = Object.keys(sectors).sort((a, b) => {
        const nameA = a.toLowerCase();
        const nameB = b.toLowerCase();
        if (nameA.includes('campo')) return -1; // Tira "Campo" para arriba
        if (nameB.includes('campo')) return 1;  // Tira "Campo" para arriba
        return 0; // El resto los deja como están (ej: VIP)
    });

    // 2. Iterar sobre Sectores ordenados
    orderedSectorNames.forEach(sectorName => {
        const sectorDiv = document.createElement('div');
        sectorDiv.className = 'sector-container';
        sectorDiv.innerHTML = `<h3 class="sector-title">Sector: ${sectorName}</h3>`;

        const filas = {};
        sectors[sectorName].forEach(seat => {
            if (!filas[seat.fila]) filas[seat.fila] = [];
            filas[seat.fila].push(seat);
        });

        // Ordenamos las filas alfabéticamente (A, B, C...)
        Object.keys(filas).sort().forEach(filaName => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'seat-row'; // Clase en vez de style.display='flex'

            // REQUISITO CUMPLIDO: Dibujar la letra de la fila al principio
            const rowLabel = document.createElement('div');
            rowLabel.className = 'row-label';
            rowLabel.textContent = filaName;
            rowDiv.appendChild(rowLabel);

            // Dibujar los asientos de esa fila
            filas[filaName].forEach(seat => {
                const seatEl = document.createElement('div');
                seatEl.className = `seat ${seat.estado.toLowerCase()}`;
                seatEl.textContent = seat.numeroAsiento;

                if (seat.estado === 'Disponible') {
                    seatEl.addEventListener('click', () => reserveSeat(seat.butacaId, seatEl));
                }
                rowDiv.appendChild(seatEl);
            });
            sectorDiv.appendChild(rowDiv);
        });
        container.appendChild(sectorDiv);
    });
}

async function reserveSeat(butacaId, seatElement) {
    // Usamos una clase en lugar de .style.opacity
    seatElement.classList.add('processing');

    try {
        const response = await fetch(`${API_BASE}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ butacaId: butacaId, usuarioId: 1 })
        });

        if (response.ok) {
            seatElement.className = 'seat reservada';
            // Remover event listener clonando el elemento
            const newSeat = seatElement.cloneNode(true);
            seatElement.parentNode.replaceChild(newSeat, seatElement);
            showToast('¡Reserva exitosa!', 'success');
        } else {
            throw new Error('Error en el servidor');
        }
    } catch (error) {
        seatElement.classList.remove('processing');
        showToast('No se pudo reservar', 'error');
    }
}