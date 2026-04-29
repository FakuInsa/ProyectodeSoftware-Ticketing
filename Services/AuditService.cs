using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Ticketing.Data;
using Ticketing.Models;

namespace Ticketing.Services
{
    public class AuditService : IAuditService
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public AuditService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task LogAsync(int? usuarioId, string accion, string recursoAfectado, int recursoId, string detalle)
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<SistemaTicketingContext>();

                var auditoria = new Auditoria
                {
                    UsuarioId = usuarioId,
                    Accion = accion,
                    RecursoAfectado = recursoAfectado,
                    RecursoId = recursoId,
                    FechaHora = DateTime.UtcNow,
                    Detalle = detalle
                };

                context.Auditorias.Add(auditoria);
                await context.SaveChangesAsync();
            }
        }
    }
}
