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

namespace Ticketing.Jobs
{
    // BackgroundService es la clase base de .NET para tareas en segundo plano.
    // Se registra como Singleton y corre en paralelo al servidor HTTP.
    public class ReservationExpirationJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ReservationExpirationJob> _logger;

        // Cada cuánto corre el job. 60 segundos es razonable, las reservas vencen a los 5 minutos, así que el peor caso
        // es que una butaca tarde 6 minutos en liberarse — aceptable.
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);
        public ReservationExpirationJob(IServiceScopeFactory scopeFactory, ILogger<ReservationExpirationJob> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ReservationExpirationJob iniciado.");

            // Loop principal — corre mientras la app esté viva
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcesarReservasVencidasAsync();
                }
                catch (Exception ex)
                {
                    // Logueamos pero NO relanzamos — si relanzamos, el job muere
                    // y las reservas nunca se liberarían hasta reiniciar la app.
                    _logger.LogError(ex, "Error en ReservationExpirationJob.");
                }

                // Esperamos el intervalo antes de la próxima ejecución.Task.Delay respeta la cancelación: si la app se apaga
                // durante la espera, no esperamos los 60 seg completos.
                await Task.Delay(_interval, stoppingToken);
            }

            _logger.LogInformation("ReservationExpirationJob detenido.");
        }

        private async Task ProcesarReservasVencidasAsync()
        {
            // Creamos un scope nuevo por cada ejecución del job.Esto es obligatorio porque DbContext es Scoped y el job es Singleton.
            // Sin el scope, .NET tiraría un error de lifetime en runtime.
            using var scope = _scopeFactory.CreateScope();

            var context = scope.ServiceProvider.GetRequiredService<SistemaTicketingContext>();
            var auditService = scope.ServiceProvider.GetRequiredService<IAuditService>();

            var ahora = DateTime.UtcNow;

            // Buscamos todas las reservas que cumplan las 3 condiciones:
            // 1. Estado "Pending" 
            // 2. Expiracion < ahora — superaron los 5 minutos
            // 3. Incluimos la Butaca para poder cambiar su estado en la misma query
            var reservasVencidas = await context.Reservas
                .Include(r => r.Butaca)
                .Where(r => r.Estado == "Pending" && r.Expiracion < ahora)
                .ToListAsync();

            if (!reservasVencidas.Any())
            {
                _logger.LogInformation(
                    "[Job] {Hora} — Sin reservas vencidas.", ahora);
                return;
            }

            _logger.LogInformation(
                "[Job] {Hora} — Procesando {Cantidad} reservas vencidas.",
                ahora, reservasVencidas.Count);

            // Procesamos cada reserva vencida individualmente.
            // Usamos try/catch por reserva para que si una falla,
            // las demás sigan procesándose igual.
            foreach (var reserva in reservasVencidas)
            {
                using var transaction = await context.Database.BeginTransactionAsync();

                try
                {
                    // Operación 1: liberar la butaca
                    reserva.Butaca!.Estado = EstadoButaca.Disponible;
                    reserva.Butaca.FechaBloqueo = null;

                    // Operación 2: marcar la reserva como expirada
                    reserva.Estado = "Expired";

                    await context.SaveChangesAsync();

                    // Operación 3: registrar en auditoría
                    // UsuarioId null indica que la acción la hizo el sistema,
                    // no un usuario — el TP lo menciona explícitamente.
                    await auditService.LogAsync(
                        null,
                        "RESERVATION_EXPIRED",
                        "Reserva",
                        reserva.Id,
                        $"{{\"reservaId\": {reserva.Id}, " +
                        $"\"butacaId\": {reserva.ButacaId}, " +
                        $"\"usuarioId\": {reserva.UsuarioId}, " +
                        $"\"expiracion\": \"{reserva.Expiracion:O}\", " +
                        $"\"liberadaEn\": \"{ahora:O}\"}}"
                    );

                    await transaction.CommitAsync();

                    _logger.LogInformation(
                        "[Job] Reserva {ReservaId} — butaca {ButacaId} liberada.",
                        reserva.Id, reserva.ButacaId);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();

                    _logger.LogError(ex,
                        "[Job] Error liberando reserva {ReservaId}.", reserva.Id);
                }
            }
        }
    }
}