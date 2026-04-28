const API_BASE = '/api/v1';
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
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