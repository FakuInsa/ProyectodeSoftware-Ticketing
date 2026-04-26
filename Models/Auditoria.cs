using System;

namespace Ticketing.Models
{
    public class Auditoria
    {
        public int Id { get; set; }
        public int? UsuarioId { get; set; }
        public string Accion { get; set; } = string.Empty;
        public string RecursoAfectado { get; set; } = string.Empty;
        public int RecursoId { get; set; }
        public DateTime FechaHora { get; set; }
        public string Detalle { get; set; } = string.Empty;
    }
}