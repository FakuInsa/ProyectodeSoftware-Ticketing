using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.DTOs;
using Ticketing.Models;
using Microsoft.AspNetCore.SignalR;
using Ticketing.Hubs;

namespace Ticketing.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly SistemaTicketingContext _context;
        private readonly IAuditService _auditService;
        private readonly IHubContext<TicketingHub> _hubContext;

        public PaymentService(SistemaTicketingContext context, IAuditService auditService, IHubContext<TicketingHub> hubContext)
        {
            _context = context;
            _auditService = auditService;
            _hubContext = hubContext;
        }

        public async Task<(bool Success, string Message)> ConfirmPaymentAsync(ConfirmPaymentRequest request)
        {
            // Traigo la reserva y la butaca de una para no ir dos veces a la base
            var reserva = await _context.Reservas
                .Include(r => r.Butaca)
                .Include(r => r.Sesion)
                .FirstOrDefaultAsync(r => r.Id == request.ReservaId);

            // Validamos un par de cosas antes de arrancar
            if (reserva == null)
                return (false, "Reserva no encontrada.");

            if (reserva.UsuarioId != request.UsuarioId)
                return (false, "Esta reserva no pertenece al usuario indicado.");

            if (reserva.Estado != "Pending")
                return (false, $"La reserva ya fue procesada. Estado actual: {reserva.Estado}.");

            // Checkeamos que no haya expirado la sesion
            if (DateTime.UtcNow > reserva.Sesion.ExpiracionGlobal)
                return (false, "La sesión ha expirado. El asiento fue liberado.");


            // Metemos todo en una transacción ACID para que no quede nada a medias
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Pasamos la butaca a Vendida
                reserva.Butaca!.Estado = EstadoButaca.Vendida;

                // Y la reserva a Pagada
                reserva.Estado = "Paid";

                // Guardamos los cambios. EF Core manda todo junto
                await _context.SaveChangesAsync();

                // Registramos en auditoría dentro de la misma transacción
                await _auditService.LogAsync(
                    request.UsuarioId,
                    "PAYMENT_SUCCESS",
                    "Reserva",
                    reserva.Id,
                    $"{{\"reservaId\": {reserva.Id}, " +
                    $"\"butacaId\": {reserva.ButacaId}, " +
                    $"\"usuarioId\": {request.UsuarioId}, " +
                    $"\"fechaPago\": \"{DateTime.UtcNow:O}\"}}"
                );

                // Si llegamos acá sin errores, confirmamos todo
                await transaction.CommitAsync();

                await _hubContext.Clients.All.SendAsync("SeatMapUpdated");

                return (true, "Pago confirmado exitosamente.");
            }
            catch (Exception ex)
            {
                // Si algo falla, rollback para que no se rompa nada
                await transaction.RollbackAsync();

                // Registramos el fallo por separado para que quede constancia aunque la tx falle
                await _auditService.LogIndependentAsync(
                    request.UsuarioId,
                    "PAYMENT_FAILED",
                    "Reserva",
                    request.ReservaId,
                    $"{{\"error\": \"{ex.Message}\", " +
                    $"\"usuarioId\": {request.UsuarioId}}}"
                );

                return (false, $"Error procesando el pago: {ex.Message}");
            }
        }
    }
}