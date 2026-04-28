using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.DTOs;

namespace Ticketing.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class EventsController : ControllerBase
    {
        private readonly SistemaTicketingContext _context;

        public EventsController(SistemaTicketingContext context)
        {
            _context = context;
        }

        // GET: api/v1/events
        [HttpGet]
        public async Task<ActionResult<PaginatedResponse<EventDto>>> GetEvents(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 10;
            if (pageSize > 100) pageSize = 100;

            var totalItems = await _context.Eventos.CountAsync();
            var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

            var eventos = await _context.Eventos
                .OrderBy(e => e.Fecha)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => new EventDto
                {
                    Id = e.Id,
                    Nombre = e.Nombre,
                    Fecha = e.Fecha,
                    Lugar = e.Lugar,
                    Estado = e.Estado
                })
                .ToListAsync();

            return Ok(new PaginatedResponse<EventDto>
            {
                Page = page,
                PageSize = pageSize,
                TotalItems = totalItems,
                TotalPages = totalPages,
                Data = eventos
            });
        }

        // GET: api/v1/events/{id}/seats
        [HttpGet("{id}/seats")]
        public async Task<ActionResult<System.Collections.Generic.IEnumerable<SeatStatusDto>>> GetEventSeats(int id)
        {
            var eventoExists = await _context.Eventos.AnyAsync(e => e.Id == id);
            if (!eventoExists)
            {
                return NotFound($"No se encontró el evento con ID {id}.");
            }

            var seats = await _context.Butacas
                .Include(b => b.Sector)
                .Where(b => b.Sector.EventoId == id)
                .OrderBy(b => b.Fila)
                .ThenBy(b => b.NumeroAsiento)
                .Select(b => new SeatStatusDto
                {
                    ButacaId = b.Id,
                    SectorNombre = b.Sector.Nombre,
                    Precio = b.Sector.Precio,
                    Fila = b.Fila,
                    NumeroAsiento = b.NumeroAsiento,
                    Estado = b.Estado.ToString()
                })
                .ToListAsync();

            return Ok(seats);
        }
    }
}
