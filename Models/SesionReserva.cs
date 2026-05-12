using System;
using System.Collections.Generic;

namespace Ticketing.Models
{
    public class SesionReserva
    {
        public int Id { get; set; }
        public int UsuarioId { get; set; }
        public virtual Usuario Usuario { get; set; } = null!;

        public int EventoId { get; set; }
        public virtual Evento Evento { get; set; } = null!;

        public int LimiteElegido { get; set; }
        public DateTime ExpiracionGlobal { get; set; }

        public string Estado { get; set; } = "Activa"; // "Activa", "Cancelada", "Completada"

        public ICollection<Reserva> Reservas { get; set; } = new List<Reserva>();
    }
}
