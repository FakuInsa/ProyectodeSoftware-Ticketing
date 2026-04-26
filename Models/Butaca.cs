using System;

namespace Ticketing.Models
{
    public class Butaca
    {
        public int Id { get; set; }
        public int SectorId { get; set; }
        public virtual Sector Sector { get; set; } = null!;
        public string Fila { get; set; } = string.Empty;
        public int NumeroAsiento { get; set; }

        // Bloqueo optimista
        public int Version { get; set; }
        public EstadoButaca Estado { get; set; }
        public DateTime? FechaBloqueo { get; set; }
    }

    public enum EstadoButaca
    {
        Disponible,
        Bloqueada,
        Reservada,
        Vendida
    }
}