using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.Models;
using Ticketing.DTOs;
using Microsoft.AspNetCore.SignalR;
using Ticketing.Hubs;

namespace Ticketing.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class SessionsController : ControllerBase
    {
        private readonly SistemaTicketingContext _context;
        private readonly IHubContext<TicketingHub> _hubContext;

        public SessionsController(SistemaTicketingContext context, IHubContext<TicketingHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpPost]
        public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request)
        {
            var evento = await _context.Eventos.FindAsync(request.EventoId);
            if (evento == null || evento.Estado != "Activo")
                return BadRequest(new { error = "Evento no disponible." });

            // Nos fijamos si el usuario ya tiene una sesión para este evento
            var sesionActiva = await _context.SesionesReserva
                .FirstOrDefaultAsync(s => s.UsuarioId == request.UsuarioId && s.EventoId == request.EventoId && s.Estado == "Activa" && s.ExpiracionGlobal > DateTime.UtcNow);

            if (sesionActiva != null)
            {
                return Ok(new 
                { 
                    sesionId = sesionActiva.Id, 
                    expiracionGlobal = sesionActiva.ExpiracionGlobal 
                });
            }

            // Nueva sesión con 5 minutos de tiempo
            var sesion = new SesionReserva
            {
                UsuarioId = request.UsuarioId,
                EventoId = request.EventoId,
                LimiteElegido = request.LimiteElegido,
                ExpiracionGlobal = DateTime.UtcNow.AddMinutes(5),
                Estado = "Activa"
            };

            _context.SesionesReserva.Add(sesion);
            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                sesionId = sesion.Id, 
                expiracionGlobal = sesion.ExpiracionGlobal 
            });
        }

        [HttpGet("active/{usuarioId}")]
        public async Task<IActionResult> GetActiveSession(int usuarioId)
        {
            var now = DateTime.UtcNow;
            var sesionActiva = await _context.SesionesReserva
                .Include(s => s.Evento)
                .Include(s => s.Reservas)
                    .ThenInclude(r => r.Butaca)
                        .ThenInclude(b => b!.Sector)
                .FirstOrDefaultAsync(s => s.UsuarioId == usuarioId && s.Estado == "Activa" && s.ExpiracionGlobal > now);

            if (sesionActiva == null)
            {
                return NotFound(new { error = "No active session" });
            }

            var result = new
            {
                sesionId = sesionActiva.Id,
                eventoId = sesionActiva.EventoId,
                eventoNombre = sesionActiva.Evento?.Nombre,
                expiracionGlobal = sesionActiva.ExpiracionGlobal,
                reservas = sesionActiva.Reservas.Where(r => r.Estado == "Pending").Select(r => new
                {
                    reservaId = r.Id,
                    butaca = new
                    {
                        butacaId = r.ButacaId,
                        sectorNombre = r.Butaca?.Sector?.Nombre,
                        fila = r.Butaca?.Fila,
                        numeroAsiento = r.Butaca?.NumeroAsiento
                    }
                })
            };

            return Ok(result);
        }

        [HttpPost("{sesionId}/cancel")]
        public async Task<IActionResult> CancelSession(int sesionId)
        {
            var sesion = await _context.SesionesReserva
                .Include(s => s.Reservas)
                    .ThenInclude(r => r.Butaca)
                .FirstOrDefaultAsync(s => s.Id == sesionId);

            if (sesion == null) return NotFound();

            sesion.Estado = "Cancelada";
            foreach(var r in sesion.Reservas)
            {
                if (r.Estado == "Pending")
                {
                    r.Estado = "Cancelled";
                    if (r.Butaca != null)
                    {
                        r.Butaca.Estado = EstadoButaca.Disponible;
                        r.Butaca.FechaBloqueo = null;
                    }
                }
            }

            await _context.SaveChangesAsync();
            
            await _hubContext.Clients.All.SendAsync("SeatMapUpdated");

            return Ok();
        }
    }
}
