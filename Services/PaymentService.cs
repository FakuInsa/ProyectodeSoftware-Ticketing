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
            // Traemos la reserva junto con la butaca en una sola query para no hacer dos roundtrips a la DB
            var reserva = await _context.Reservas
                .Include(r => r.Butaca)
                .Include(r => r.Sesion)
                .FirstOrDefaultAsync(r => r.Id == request.ReservaId);

            // Validaciones previas a la transacción
            if (reserva == null)
                return (false, "Reserva no encontrada.");

            if (reserva.UsuarioId != request.UsuarioId)
                return (false, "Esta reserva no pertenece al usuario indicado.");

            if (reserva.Estado != "Pending")
                return (false, $"La reserva ya fue procesada. Estado actual: {reserva.Estado}.");

            // Verificamos que la reserva no haya expirado mediante su Sesión.
            if (DateTime.UtcNow > reserva.Sesion.ExpiracionGlobal)
                return (false, "La sesión ha expirado. El asiento fue liberado.");

            
            // TRANSACCIÓN ACID
            // Abrimos una transacción explícita. Si cualquiera de las 3 operaciones dentro falla, el catch ejecuta Rollback y la DB
            // queda exactamente como estaba antes. Nada queda a medias.
           
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Operación 1: cambiar butaca a Vendida
                reserva.Butaca!.Estado = EstadoButaca.Vendida;

                // Operación 2: marcar la reserva como Paid
                reserva.Estado = "Paid";

                // Guardamos ambos cambios en la misma unidad de trabajo.EF Core los envía en un solo batch a la DB dentro de la tx.
                await _context.SaveChangesAsync();

                // Operación 3: registrar en auditoría
                // Lo hacemos DENTRO de la transacción para que si esto falla,también se revierta todo lo anterior. Así garantizamos que nunca haya un pago confirmado sin su registro de auditoría.
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

                // Confirmamos la transacción — recién acá los cambios se vuelven visibles para el resto del sistema
                await transaction.CommitAsync();

                await _hubContext.Clients.All.SendAsync("SeatMapUpdated");

                return (true, "Pago confirmado exitosamente.");
            }
            catch (Exception ex)
            {
                // Si cualquier cosa falló, revertimos TODO.La butaca vuelve a Reservada, la reserva sigue Pending,
                // y no queda ningún registro de auditoría del intento.
                await transaction.RollbackAsync();

                // Enviamos el fallo FUERA de la transacción revertida,
                // usando un scope nuevo del AuditService para que este registro sí persista aunque la tx principal haya fallado.
                await _auditService.LogAsync(
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