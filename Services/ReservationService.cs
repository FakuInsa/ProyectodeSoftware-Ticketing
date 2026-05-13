using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.DTOs;
using Ticketing.Models;
using System.Linq;
using Microsoft.AspNetCore.SignalR;
using Ticketing.Hubs;

namespace Ticketing.Services
{
    public class ReservationService : IReservationService
    {
        private readonly SistemaTicketingContext _context;
        private readonly IAuditService _auditService;
        private readonly IHubContext<TicketingHub> _hubContext;

        public ReservationService(SistemaTicketingContext context, IAuditService auditService, IHubContext<TicketingHub> hubContext)
        {
            _context = context;
            _auditService = auditService;
            _hubContext = hubContext;
        }

        public async Task<(bool Success, string Message, Reserva? Reserva)> CreateReservationAsync(CreateReservationRequest request)
        {
            var sesion = await _context.SesionesReserva
                .Include(s => s.Reservas)
                .FirstOrDefaultAsync(s => s.Id == request.SesionId);

            if (sesion == null || sesion.Estado != "Activa" || sesion.ExpiracionGlobal <= DateTime.UtcNow)
                return (false, "Sesión no válida o expirada.", null);

            if (sesion.Reservas.Count(r => r.Estado == "Pending") >= sesion.LimiteElegido)
                return (false, "Límite de entradas excedido.", null);

            var butaca = await _context.Butacas.FirstOrDefaultAsync(b => b.Id == request.ButacaId);

            if (butaca == null) return (false, "Butaca no encontrada.", null);
            if (butaca.Estado != EstadoButaca.Disponible) return (false, "Butaca no disponible.", null);

            var versionLeida = butaca.Version;

            butaca.Estado = EstadoButaca.Reservada;
            butaca.FechaBloqueo = DateTime.UtcNow;

            var reserva = new Reserva
            {
                ButacaId = request.ButacaId,
                UsuarioId = sesion.UsuarioId,
                SesionId = request.SesionId,
                FechaCreacion = DateTime.UtcNow,
                Estado = "Pending"
            };

            _context.Reservas.Add(reserva);

            try
            {
                await _context.SaveChangesAsync();

                // Registrar auditoría exitosa (fuera de la transacción principal para garantizar inmutabilidad)
                await _auditService.LogAsync(
                    sesion.UsuarioId,
                    "CREATE_RESERVATION",
                    "Butaca",
                    butaca.Id,
                    $"{{\"reservaId\": {reserva.Id}, " +
                    $"\"sesionId\": {reserva.SesionId}, " +
                    $"\"versionLeida\": {versionLeida}}}"
                );

                await _hubContext.Clients.All.SendAsync("SeatMapUpdated");

                return (true, "Reserva exitosa.", reserva);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Registrar auditoría fallida por concurrencia
                await _auditService.LogAsync(
                    sesion.UsuarioId,
                    "RESERVATION_FAILED_CONCURRENCY",
                    "Butaca",
                    butaca.Id,
                    $"{{\"razon\": \"Conflicto de concurrencia\", " +
                    $"\"versionLeida\": {versionLeida}, " +
                    $"\"usuarioId\": {sesion.UsuarioId}}}"
                );

                return (false, "CONCURRENCY_ERROR", null);
            }
            catch (Exception ex)
            {
                await _auditService.LogAsync(
                    sesion.UsuarioId,
                    "RESERVE_FAILED_UNEXPECTED",
                    "Butaca",
                    butaca.Id,
                    $"{{\"error\": \"{ex.Message}\"}}"
                );
                return (false, $"Error inesperado: {ex.Message}", null);
            }
        }

        public async Task<(bool Success, string Message)> CancelReservationAsync(int reservaId, int usuarioId)
        {
            var reserva = await _context.Reservas
                .Include(r => r.Butaca)
                .FirstOrDefaultAsync(r => r.Id == reservaId);

            if (reserva == null)
            {
                return (false, "Reserva no encontrada.");
            }

            if (reserva.UsuarioId != usuarioId)
            {
                return (false, "No tienes permiso para cancelar esta reserva.");
            }

            if (reserva.Estado != "Pending")
            {
                return (false, "Solo se pueden cancelar reservas en estado pendiente.");
            }

            reserva.Estado = "Cancelled";

            if (reserva.Butaca != null)
            {
                reserva.Butaca.Estado = EstadoButaca.Disponible;
                reserva.Butaca.FechaBloqueo = null;
                reserva.Butaca.Version++;
            }

            try
            {
                await _context.SaveChangesAsync();

                // Registrar auditoría exitosa (fuera de la transacción principal para garantizar inmutabilidad)
                await _auditService.LogAsync(
                    usuarioId,
                    "CANCEL_RESERVATION",
                    "Reserva",
                    reserva.Id,
                    $"{{\"mensaje\": \"Reserva {reserva.Id} cancelada por el usuario\"}}"
                );

                await _hubContext.Clients.All.SendAsync("SeatMapUpdated");

                return (true, "Reserva cancelada exitosamente.");
            }
            catch (DbUpdateConcurrencyException)
            {
                return (false, "Error de concurrencia al intentar cancelar la reserva.");
            }
            catch (Exception ex)
            {
                return (false, $"Error inesperado: {ex.Message}");
            }
        }

        public async Task<System.Collections.Generic.IEnumerable<object>> GetPendingReservationsAsync(int usuarioId)
        {
            var now = DateTime.UtcNow;
            return await _context.Reservas
                .Include(r => r.Sesion)
                .Include(r => r.Butaca)
                    .ThenInclude(b => b!.Sector)
                    .ThenInclude(s => s!.Evento)
                .Where(r => r.UsuarioId == usuarioId && r.Estado == "Pending" && r.Sesion.Estado == "Activa" && r.Sesion.ExpiracionGlobal > now)
                .Select(r => new
                {
                    reservaId = r.Id,
                    expiracion = r.Sesion.ExpiracionGlobal, // Expiración global desde la sesión
                    eventoNombre = r.Butaca!.Sector.Evento.Nombre,
                    butaca = new
                    {
                        butacaId = r.Butaca.Id,
                        sectorNombre = r.Butaca.Sector.Nombre,
                        fila = r.Butaca.Fila,
                        numeroAsiento = r.Butaca.NumeroAsiento
                    }
                })
                .ToListAsync();
        }
    }
}