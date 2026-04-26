using System;

namespace Ticketing.Models
{
    public class Reserva
    {
        public int Id { get; set; }
        public int ButacaId { get; set; }

        // Propiedad de navegación sugerida por Entity Framework Core
        public Butaca? Butaca { get; set; }

        public DateTime FechaCreacion { get; set; }
        public DateTime Expiracion { get; set; }

        public int UsuarioId { get; set; }
        public virtual Usuario Usuario { get; set; } = null!;

        // Estado de la reserva ('Pending', 'Paid', 'Expired')
        public string Estado { get; set; } = "Pending";

    }
}
