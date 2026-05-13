namespace Ticketing.DTOs
{
    public class CreateSessionRequest
    {
        public int UsuarioId { get; set; }
        public int EventoId { get; set; }
        public int LimiteElegido { get; set; }
    }
}
