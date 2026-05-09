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
            if (butaca.Estado != EstadoButaca.Disponible)return (false, "Butaca no disponible.", null);
            
            var versionLeida = butaca.Version;

            butaca.Estado = EstadoButaca.Reservada;
            butaca.FechaBloqueo = DateTime.UtcNow;

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
                    $"{{\"reservaId\": {reserva.Id}, " +
                    $"\"expiracion\": \"{reserva.Expiracion:O}\", " +
                    $"\"versionLeida\": {versionLeida}}}"
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
                    $"{{\"razon\": \"Conflicto de concurrencia\", " +
                    $"\"versionLeida\": {versionLeida}, " +
                    $"\"usuarioId\": {request.UsuarioId}}}"
                );

                return (false, "CONCURRENCY_ERROR", null);
            }
            catch (Exception ex)
            {
                await _auditService.LogAsync(
                    request.UsuarioId,
                    "RESERVE_FAILED_UNEXPECTED",
                    "Butaca",
                    butaca.Id,
                    $"{{\"error\": \"{ex.Message}\"}}"
                );
                return (false, $"Error inesperado: {ex.Message}", null);
            }
        }
    }
}