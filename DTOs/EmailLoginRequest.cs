namespace Ticketing.DTOs
{
    public class EmailLoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}