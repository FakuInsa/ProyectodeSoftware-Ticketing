using Microsoft.EntityFrameworkCore;
using Ticketing.Data;
using Ticketing.Services;
using Ticketing.DTOs;
using Ticketing.Jobs;
using Ticketing.Hubs;

var builder = WebApplication.CreateBuilder(args);



// Agregamos controladores
builder.Services.AddControllers();

// Config de la DB con Postgres
builder.Services.AddDbContext<SistemaTicketingContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));


// Inyección de Dependencias
builder.Services.AddScoped<IReservationService, ReservationService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddHostedService<ReservationExpirationJob>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSignalR();

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

        // Corremos las migraciones al toque
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

// app.UseHttpsRedirection(); // Sacamos esto para que no joda en Docker sin SSL
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthorization();
app.MapControllers();
app.MapHub<TicketingHub>("/ticketingHub");

app.Run();
