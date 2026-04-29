using Microsoft.EntityFrameworkCore;
using Ticketing.Models;

namespace Ticketing.Data
{
    public class SistemaTicketingContext : DbContext
    {
        public SistemaTicketingContext(DbContextOptions<SistemaTicketingContext> options) 
            : base(options)
        {
        }

        public DbSet<Evento> Eventos { get; set; }
        public DbSet<Sector> Sectores { get; set; }
        public DbSet<Butaca> Butacas { get; set; }
        public DbSet<Reserva> Reservas { get; set; }
        public DbSet<Auditoria> Auditorias { get; set; }
        public DbSet<Usuario> Usuarios { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configuración de Claves Primarias y Validaciones mediante Fluent API
            // Evento
            modelBuilder.Entity<Evento>()
                .HasKey(e => e.Id);// Referencia e --> al evento
            
            modelBuilder.Entity<Evento>()
                .Property(e => e.Nombre)
                .IsRequired()
                .HasMaxLength(150); // Validación básica adicional sugerida

            // Sector
            modelBuilder.Entity<Sector>()
                .HasKey(s => s.Id);
            
            modelBuilder.Entity<Sector>()
                .Property(s => s.Precio)
                .HasColumnType("decimal(18,2)"); // Para precios
                
            modelBuilder.Entity<Sector>()
                .HasOne(s => s.Evento)
                .WithMany()
                .HasForeignKey(s => s.EventoId);

            // Butaca
            modelBuilder.Entity<Butaca>()
                .HasKey(b => b.Id);

            // Configuración del Token de Concurrencia
            modelBuilder.Entity<Butaca>()
                .Property(b => b.Version)
                .IsConcurrencyToken();

            modelBuilder.Entity<Butaca>()
                .HasOne(b => b.Sector)
                .WithMany()
                .HasForeignKey(b => b.SectorId);

            // Reserva
            modelBuilder.Entity<Reserva>()
                .HasKey(r => r.Id);

            // Auditoria
            modelBuilder.Entity<Auditoria>()
                .HasKey(a => a.Id);

            // Precisión de milisegundos para FechaHora (3 decimales de segundo)
            modelBuilder.Entity<Auditoria>()
                .Property(a => a.FechaHora)
                .HasPrecision(3);

            // Configurar Detalle como JSONB en Postgres
            modelBuilder.Entity<Auditoria>()
                .Property(a => a.Detalle)
                .HasColumnType("jsonb");

            // Relación Auditoria -> Usuario
            modelBuilder.Entity<Auditoria>()
                .HasOne(a => a.Usuario)
                .WithMany()
                .HasForeignKey(a => a.UsuarioId)
                .IsRequired(false); // Porque UsuarioId es nullable (int?)

            // Usuario
            modelBuilder.Entity<Usuario>()
                .HasKey(u => u.Id);
            
            modelBuilder.Entity<Usuario>()
                .Property(u => u.GoogleSubjectId)
                .IsRequired()
                .HasMaxLength(255);
                
            modelBuilder.Entity<Reserva>()
                .HasOne(r => r.Butaca)
                .WithMany()
                .HasForeignKey(r => r.ButacaId);

            modelBuilder.Entity<Reserva>()
                .HasOne(r => r.Usuario)
                .WithMany()
                .HasForeignKey(r => r.UsuarioId);
        }
    }
}
