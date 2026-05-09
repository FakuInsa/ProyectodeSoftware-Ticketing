namespace Ticketing.DTOs
{
    public class ConfirmPaymentRequest
    {
        // ID de la reserva que el usuario quiere pagar
        public int ReservaId { get; set; }

        // ID del usuario que está pagando (para validar que sea el dueño de la reserva)
        public int UsuarioId { get; set; }
    }
}