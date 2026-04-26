using System;
using System.Linq;
using Ticketing.Models;

namespace Ticketing.Data
{
    public static class DbInitializer
    {
        public static void Initialize(SistemaTicketingContext context)
        {
            var usuario = new Usuario
            {
                Nombre = "Usuario Test",
                Email = "test@example.com",
                GoogleSubjectId = "dev_mock_123"
            };

            if (!context.Usuarios.Any(u => u.GoogleSubjectId == usuario.GoogleSubjectId))
            {
                context.Usuarios.Add(usuario);
                context.SaveChanges();
            }

            if (context.Eventos.Any())
            {
                return;   // La base de datos ya ha sido inicializada
            }

            var evento = new Evento
            {
                Nombre = "Concierto Clasico",
                Fecha = DateTime.UtcNow.AddMonths(2),
                Lugar = "Teatro FM"
            };

            context.Eventos.Add(evento);
            context.SaveChanges();

            var sectores = new Sector[]
            {
                new Sector { EventoId = evento.Id, Nombre = "VIP", Precio = 25000.00m, Capacidad = 50 },
                new Sector { EventoId = evento.Id, Nombre = "Campo", Precio = 10000.00m, Capacidad = 50 }
            };

            context.Sectores.AddRange(sectores);
            context.SaveChanges();

            foreach (var sector in sectores)
            {
                for (int i = 1; i <= 50; i++)
                {
                    context.Butacas.Add(new Butaca
                    {
                        SectorId = sector.Id,
                        Fila = ((char)('A' + ((i - 1) / 10))).ToString(), // Filas A, B, C, D, E (10 asientos por fila)
                        NumeroAsiento = ((i - 1) % 10) + 1, // 1 al 10
                        Estado = EstadoButaca.Disponible,
                        Version = 1
                    });
                }
            }

            context.SaveChanges();
        }
    }
}
