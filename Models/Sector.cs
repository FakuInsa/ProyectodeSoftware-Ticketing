using System;

namespace Ticketing.Models
{
    public class Sector
    {
        public int Id { get; set; }
        public int EventoId { get; set; }
        public virtual Evento Evento { get; set; } = null!;
        public string Nombre { get; set; } = string.Empty;
        public decimal Precio { get; set; }
        public int Capacidad { get; set; }
    }
}