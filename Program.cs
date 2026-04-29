using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.Services;
using Ticketing.DTOs;

var builder = WebApplication.CreateBuilder(args);



// Add services to the container.
builder.Services.AddControllers();

// Configure Entity Framework Core with PostgreSQL
builder.Services.AddDbContext<SistemaTicketingContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));


// Inyección de Dependencias
builder.Services.AddScoped<IReservationService, ReservationService>();

//para poner swagger porque instalamos .net9 y no viene mas con sawgger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<SistemaTicketingContext>();

        // Ejecutar las migraciones automáticamente (Crea la base de datos y tablas si no existen)
        context.Database.Migrate();

        // inicializa la base de datos con datos de prueba
        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocurrió un error inicializando la base de datos.");
    }
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthorization();
app.MapControllers();

app.Run();
