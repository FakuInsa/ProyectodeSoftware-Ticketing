using System;
using System.Threading.Tasks;

namespace Ticketing.Services
{
    public interface IAuditService
    {
        Task LogAsync(int? usuarioId, string accion, string recursoAfectado, int recursoId, string detalle);
        Task LogIndependentAsync(int? usuarioId, string accion, string recursoAfectado, int recursoId, string detalle);
    }
}
