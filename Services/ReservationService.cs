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
        private readonly IAuditService _auditService;

        public ReservationService(SistemaTicketingContext context, IAuditService auditService)
        {
            _context = context;
            _auditService = auditService;
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

            try
            {
                await _context.SaveChangesAsync();

                // Registrar auditoría exitosa (fuera de la transacción principal para garantizar inmutabilidad)
                await _auditService.LogAsync(
                    request.UsuarioId,
                    "CREATE_RESERVATION",
                    "Butaca",
                    butaca.Id,
                    $"{{\"mensaje\": \"Reserva creada para butaca {butaca.Id}\"}}"
                );

                return (true, "Reserva exitosa.", reserva);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Registrar auditoría fallida por concurrencia
                await _auditService.LogAsync(
                    request.UsuarioId,
                    "RESERVATION_FAILED_CONCURRENCY",
                    "Butaca",
                    butaca.Id,
                    $"{{\"mensaje\": \"Fallo al intentar reservar butaca {butaca.Id} por concurrencia\"}}"
                );

                return (false, "CONCURRENCY_ERROR", null);
            }
            catch (Exception ex)
            {
                return (false, $"Error inesperado: {ex.Message}", null);
            }
        }
    }
}