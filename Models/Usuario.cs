using System;

namespace Ticketing.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public string GoogleSubjectId { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}