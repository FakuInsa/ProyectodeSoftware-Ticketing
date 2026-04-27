namespace Ticketing.DTOs
{
    public class SeatStatusDto
    {
        public int ButacaId { get; set; }
        public string SectorNombre { get; set; } = string.Empty;
        public decimal Precio { get; set; }
        public string Fila { get; set; } = string.Empty;
        public int NumeroAsiento { get; set; }
        public string Estado { get; set; } = string.Empty;
    }
}
