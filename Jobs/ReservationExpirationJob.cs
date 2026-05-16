using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ticketing.Data;
using Ticketing.Models;
using Ticketing.Services;
using Microsoft.AspNetCore.SignalR;
using Ticketing.Hubs;

namespace Ticketing.Jobs
{
    // Job que corre en segundo plano para limpiar reservas viejas
    public class ReservationExpirationJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ReservationExpirationJob> _logger;

        // Intervalo de chequeo
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);
        private readonly IHubContext<TicketingHub> _hubContext;

        public ReservationExpirationJob(IServiceScopeFactory scopeFactory, ILogger<ReservationExpirationJob> logger, IHubContext<TicketingHub> hubContext)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _hubContext = hubContext;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ReservationExpirationJob iniciado.");

            // Loop infinito mientras la app esté prendida
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcesarReservasVencidasAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en ReservationExpirationJob.");
                }

                // Esperamos un toque antes de volver a chequear
                await Task.Delay(_interval, stoppingToken);
            }

            _logger.LogInformation("ReservationExpirationJob detenido.");
        }

        private async Task ProcesarReservasVencidasAsync()
        {
            // Scope para el DbContext
            using var scope = _scopeFactory.CreateScope();

            var context = scope.ServiceProvider.GetRequiredService<SistemaTicketingContext>();
            var auditService = scope.ServiceProvider.GetRequiredService<IAuditService>();

            var ahora = DateTime.UtcNow;

            // Plan B: Buscamos Sesiones globales que hayan vencido
            var sesionesVencidas = await context.SesionesReserva
                .Include(s => s.Reservas)
                    .ThenInclude(r => r.Butaca)
                .Where(s => s.Estado == "Activa" && s.ExpiracionGlobal < ahora)
                .ToListAsync();

            if (!sesionesVencidas.Any())
            {
                _logger.LogInformation("[Job] {Hora} — Sin sesiones vencidas.", ahora);
                return;
            }

            _logger.LogInformation("[Job] {Hora} — Procesando {Cantidad} sesiones vencidas.", ahora, sesionesVencidas.Count);

            foreach (var sesion in sesionesVencidas)
            {
                using var transaction = await context.Database.BeginTransactionAsync();

                try
                {
                    sesion.Estado = "Cancelada"; // Marcamos la sesión como inactiva/cancelada por expiración

                    foreach (var reserva in sesion.Reservas)
                    {
                        if (reserva.Estado == "Pending")
                        {
                            reserva.Estado = "Expired";
                            if (reserva.Butaca != null)
                            {
                                reserva.Butaca.Estado = EstadoButaca.Disponible;
                                reserva.Butaca.FechaBloqueo = null;
                            }
                        }
                    }

                    await context.SaveChangesAsync();

                    // Registrar en auditoría
                    await auditService.LogAsync(
                        null,
                        "SESSION_EXPIRED",
                        "SesionReserva",
                        sesion.Id,
                        $"{{\"sesionId\": {sesion.Id}, " +
                        $"\"reservasLiberadas\": {sesion.Reservas.Count}, " +
                        $"\"expiracionGlobal\": \"{sesion.ExpiracionGlobal:O}\", " +
                        $"\"liberadaEn\": \"{ahora:O}\"}}"
                    );

                    await transaction.CommitAsync();

                    _logger.LogInformation("[Job] Sesion {SesionId} expirada y {Cantidad} butacas liberadas.", sesion.Id, sesion.Reservas.Count);

                    // Notificar a todos los clientes en tiempo real
                    await _hubContext.Clients.All.SendAsync("SeatMapUpdated");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "[Job] Error liberando sesión {SesionId}.", sesion.Id);
                }
            }
        }
    }
}