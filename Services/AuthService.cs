using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Ticketing.Data; // Ajustá si tu DbContext está en otro namespace
using Ticketing.Models;

namespace Ticketing.Services
{
    public class AuthService : IAuthService
    {
        private readonly SistemaTicketingContext _context;

        public AuthService(SistemaTicketingContext context)
        {
            _context = context;
        }
        public async Task<(bool Success, string Message, Usuario? Usuario)> LoginAsync(string email, string password)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return (false, "Email y contraseña son requeridos", null);

            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == email.ToLower().Trim());

            if (usuario == null || !BCrypt.Net.BCrypt.Verify(password, usuario.PasswordHash))
                return (false, "Credenciales incorrectas", null);

            return (true, "Login exitoso", usuario);
        }

        public async Task<(bool Success, string Message, Usuario? Usuario)> RegisterAsync(string email, string nombre, string password)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(nombre) || string.IsNullOrWhiteSpace(password))
                return (false, "Todos los campos son requeridos", null);

            var emailNormalizado = email.ToLower().Trim();

            if (await _context.Usuarios.AnyAsync(u => u.Email == emailNormalizado))
                return (false, "El email ya está registrado", null);

            var usuario = new Usuario
            {
                Email = emailNormalizado,
                Nombre = nombre.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password)
            };

            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();

            return (true, "Registro exitoso", usuario);
        }
    }
}