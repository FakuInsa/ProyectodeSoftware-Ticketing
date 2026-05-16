using System;
using System.Linq;
using Ticketing.Models;

namespace Ticketing.Data
{
    public static class DbInitializer
    {
        public static void Initialize(SistemaTicketingContext context)
        {

            context.Database.EnsureDeleted();
            context.Database.EnsureCreated();

            // Creamos el usuario de prueba
            var usuario = new Usuario
            {
                Nombre = "Usuario Test",
                Email = "test@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("test1234")
            };

            if (!context.Usuarios.Any(u => u.Email == usuario.Email))
            {
                context.Usuarios.Add(usuario);
                context.SaveChanges();
            }


            var evento = new Evento
            {
                Nombre = "Concierto Clasico",
                Fecha = DateTime.UtcNow.AddMonths(2),
                Lugar = "Teatro FM",
                Estado = "Activo"
            };

            context.Eventos.Add(evento);
            context.SaveChanges();

            var sectores = new Sector[]
            {
                new Sector { EventoId = evento.Id, Nombre = "Platea Izquierda", Precio = 23000.00m, Capacidad = 30 },
                new Sector { EventoId = evento.Id, Nombre = "Platea Derecha", Precio = 23000.00m, Capacidad = 30 },
                new Sector { EventoId = evento.Id, Nombre = "Platea Central", Precio = 23000.00m, Capacidad = 50 },
                new Sector { EventoId = evento.Id, Nombre = "General", Precio = 10000.00m, Capacidad = 50 },
                new Sector { EventoId = evento.Id, Nombre = "Palco A", Precio = 36000.00m, Capacidad = 5 },
                new Sector { EventoId = evento.Id, Nombre = "Palco B", Precio = 36000.00m, Capacidad = 5 },
                new Sector { EventoId = evento.Id, Nombre = "Palco C", Precio = 36000.00m, Capacidad = 5},
                new Sector { EventoId = evento.Id, Nombre = "Palco D", Precio = 36000.00m, Capacidad = 5 }
            };

            context.Sectores.AddRange(sectores);
            context.SaveChanges();

            foreach (var sector in sectores)
            {

                int asientosPorFila = 10;
                if (sector.Nombre.Contains("Izquierda") || sector.Nombre.Contains("Derecha")) asientosPorFila = 5;
                for (int i = 1; i <= sector.Capacidad; i++)
                {
                    context.Butacas.Add(new Butaca
                    {
                        SectorId = sector.Id,
                        Fila = ((char)('A' + ((i - 1) / asientosPorFila))).ToString(),
                        NumeroAsiento = ((i - 1) % asientosPorFila) + 1,
                        Estado = EstadoButaca.Disponible,
                        Version = 1
                    });
                }
            }
            context.SaveChanges();


            var evento3 = new Evento
            {
                Nombre = "La Bella Y La Bestia",
                Fecha = DateTime.UtcNow.AddMonths(3),
                Lugar = "Teatro AM",
                Estado = "Activo"
            };

            context.Eventos.Add(evento3);
            context.SaveChanges();

            var sectores3 = new Sector[]
            {
                // CORREGIDO: Ahora usan evento3.Id
                new Sector { EventoId = evento3.Id, Nombre = "Platea Izquierda", Precio = 20000.00m, Capacidad = 20 },
                new Sector { EventoId = evento3.Id, Nombre = "Platea Derecha", Precio = 20000.00m, Capacidad = 20 },
                new Sector { EventoId = evento3.Id, Nombre = "Platea Central", Precio = 20000.00m, Capacidad = 30 },
                new Sector { EventoId = evento3.Id, Nombre = "General", Precio = 12000.00m, Capacidad = 40 },
                new Sector { EventoId = evento3.Id, Nombre = "Palco A", Precio = 30000.00m, Capacidad = 3 },
                new Sector { EventoId = evento3.Id, Nombre = "Palco B", Precio = 30000.00m, Capacidad = 3},
                new Sector { EventoId = evento3.Id, Nombre = "Palco C", Precio = 30000.00m, Capacidad = 3 },
                new Sector { EventoId = evento3.Id, Nombre = "Palco D", Precio = 30000.00m, Capacidad = 3}
            };

            context.Sectores.AddRange(sectores3);
            context.SaveChanges();

            foreach (var sector in sectores3)
            {
                // Palcos de a 3 
                int asientosPorFila = 10;
                if (sector.Nombre.Contains("Izquierda") || sector.Nombre.Contains("Derecha")) asientosPorFila = 5;

                for (int i = 1; i <= sector.Capacidad; i++)
                {
                    context.Butacas.Add(new Butaca
                    {
                        SectorId = sector.Id,
                        Fila = ((char)('A' + ((i - 1) / asientosPorFila))).ToString(),
                        NumeroAsiento = ((i - 1) % asientosPorFila) + 1,
                        Estado = EstadoButaca.Disponible,
                        Version = 1
                    });
                }
            }
            context.SaveChanges();


            var evento2 = new Evento
            {
                Nombre = "Festival de Rock",
                Fecha = new DateTime(2027, 1, 10),
                Lugar = "Estadio Central",
                Estado = "Inactivo"
            };

            context.Eventos.Add(evento2);
            context.SaveChanges();

            var sectoresEvento2 = new Sector[]
            {
                new Sector { EventoId = evento2.Id, Nombre = "Platea Central", Precio = 15000.00m, Capacidad = 20 },
                new Sector { EventoId = evento2.Id, Nombre = "General", Precio = 8000.00m, Capacidad = 20 }
            };

            context.Sectores.AddRange(sectoresEvento2);
            context.SaveChanges();

            foreach (var sector in sectoresEvento2)
            {
                for (int i = 1; i <= 20; i++)
                {
                    context.Butacas.Add(new Butaca
                    {
                        SectorId = sector.Id,
                        Fila = ((char)('A' + ((i - 1) / 10))).ToString(),
                        NumeroAsiento = ((i - 1) % 10) + 1,
                        Estado = EstadoButaca.Vendida,
                        Version = 3
                    });
                }
            }

            context.SaveChanges();
        }
    }
}