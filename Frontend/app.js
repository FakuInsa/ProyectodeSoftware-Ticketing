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
            <div>📍 ${event.lugar}</div>
        `;
        card.addEventListener('click', () => loadSeatMap(event)); // Preparando la navegación
        container.appendChild(card);
    });
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.borderLeft = `4px solid ${type === 'error' ? 'red' : 'green'}`;
    toast.classList.add('show');

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
    document.getElementById('seat-grid-container').innerHTML = '<div style="text-align:center; padding: 2rem;">Cargando butacas...</div>';
}

async function loadSeatMap(event) {
    showSeatMapSection(event.nombre);
    const response = await fetch(`${API_BASE}/events/${event.id}/seats`);
    const seats = await response.json();
    renderSeatMap(seats);
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

    // 2. Iterar sobre Sectores y agrupar por Fila
    Object.keys(sectors).forEach(sectorName => {
        const sectorDiv = document.createElement('div');
        sectorDiv.innerHTML = `<h3>Sector: ${sectorName}</h3>`;

        const filas = {};
        sectors[sectorName].forEach(seat => {
            if (!filas[seat.fila]) filas[seat.fila] = [];
            filas[seat.fila].push(seat);
        });

        // 3. Pintar Butacas por Fila
        Object.keys(filas).forEach(filaName => {
            const rowDiv = document.createElement('div');
            rowDiv.style.display = 'flex';
            rowDiv.style.gap = '5px';

            filas[filaName].forEach(seat => {
                const seatEl = document.createElement('div');
                seatEl.className = `seat ${seat.estado.toLowerCase()}`;
                seatEl.textContent = seat.numeroAsiento;

                // Solo si está disponible se le agrega evento click
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