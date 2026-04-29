using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.DTOs;
using Ticketing.Models;

namespace Ticketing.Services
{
    public class ReservationService : IReservationService
    {
        private readonly SistemaTicketingContext _context;

        public ReservationService(SistemaTicketingContext context)
        {
            _context = context;
        }

        public async Task<(bool Success, string Message, Reserva? Reserva)> CreateReservationAsync(CreateReservationRequest request)
        {
            var butaca = await _context.Butacas.FirstOrDefaultAsync(b => b.Id == request.ButacaId);

            if (butaca == null) return (false, "Butaca no encontrada.", null);
            if (butaca.Estado != EstadoButaca.Disponible) return (false, "Butaca no disponible.", null);

            butaca.Estado = EstadoButaca.Reservada;
            butaca.FechaBloqueo = DateTime.UtcNow;
            butaca.Version++;

            var reserva = new Reserva
            {
                ButacaId = request.ButacaId,
                UsuarioId = request.UsuarioId,
                FechaCreacion = DateTime.UtcNow,
                Expiracion = DateTime.UtcNow.AddMinutes(5),
                Estado = "Pending"
            };

            _context.Reservas.Add(reserva);

            var auditoria = new Auditoria
            {
                UsuarioId = request.UsuarioId,
                Accion = "CREATE_RESERVATION",
                RecursoAfectado = "Butaca",
                RecursoId = butaca.Id,
                FechaHora = DateTime.UtcNow,
                Detalle = $"{{\"mensaje\": \"Reserva creada para butaca {butaca.Id}\"}}"
            };

            _context.Auditorias.Add(auditoria);

            try
            {
                await _context.SaveChangesAsync();
                return (true, "Reserva exitosa.", reserva);
            }
            catch (DbUpdateConcurrencyException)
            {
                return (false, "CONCURRENCY_ERROR", null);
            }
            catch (Exception ex)
            {
                return (false, $"Error inesperado: {ex.Message}", null);
            }
        }
    }
}