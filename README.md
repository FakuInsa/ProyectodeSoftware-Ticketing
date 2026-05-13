# PROYECTO DE SOFTWARE - TICKETING

Requerimientos: Tener instalado Docker Desktop.

Abrir una terminal en la carpeta del proyecto (ProyectodeSoftware-Ticketing).
Ingresar el comando : docker-compose up --build 


## Accesos al Sistema
Una vez que la terminal indique que la aplicación ha iniciado, puede acceder a los siguientes servicios:

Frontend Web: http://localhost:8080

Interfaz de usuario para visualizar eventos y realizar reservas en tiempo real.

Documentación API (Swagger): http://localhost:8080/swagger

Detalle de los endpoints de Eventos y Reservas.

Administrador de Base de Datos (pgAdmin): http://localhost:5050 (Esperar unos segundos para que cargue la pagina)

Interfaz visual para auditar las tablas de la base de datos.

## Configuración de la Base de Datos (pgAdmin)

Para visualizar las tablas dentro de pgAdmin, utilice las siguientes credenciales:

Acceso a pgAdmin:

Email: admin@ticketpro.com

Password: admin

Conexión al Servidor de Base de Datos:

(Click derecho en servers -> Register-> Server...)

Al registrar un nuevo servidor en pgAdmin, utilice estos datos:

### General

Name: TicketingDB

### Connection

Host name/address: db

Port: 5432

Maintenance/database : postgres

Username: postgres

Password: admin

### Ingreso al sistema(Frontend)
**Credenciales de usuario de prueba (Test):**

Mail de test:
test@example.com

Contraseña de test:
test123

## Tecnologías Utilizadas

- **Backend:** .NET 9 (ASP.NET Core Web API)
- **Base de Datos:** PostgreSQL
- **ORM:** Entity Framework Core 9
- **Tiempo Real:** SignalR (WebSockets)
- **Frontend:** Vanilla JS, HTML5, CSS3 Nativo
- **Infraestructura:** Docker & Docker Compose

## Características Principales

**Selección en Tiempo Real:** Las butacas seleccionadas por un usuario se bloquean instantáneamente para el resto de los clientes conectados gracias a SignalR.
**Expiración Automática de Reservas:** Un `BackgroundService` (.NET Hosted Service) verifica constantemente el tiempo de las sesiones y libera de forma automática las butacas si no se concreta el pago tras 5 minutos.
**Manejo de Concurrencia:** Implementación de concurrencia optimista mediante `Tokens de Concurrencia` (Row Versioning) en PostgreSQL para evitar reservas duplicadas en el mismo milisegundo (overbooking).
**Auditoría Transaccional Robusta:** Sistema de registro inmutable. Cada intento de pago o reserva guarda automáticamente auditorías tanto en el éxito (vinculadas a la transacción principal) como en el fracaso (mediante scopes independientes para sobrevivir al rollback).
**Autenticación Local Segura:** Sistema de usuarios con encriptación de contraseñas mediante BCrypt.

## Notas de Arquitectura

- **Persistencia:** Los datos de la base de datos persisten entre reinicios gracias a los volúmenes de Docker.
- **Migraciones Automáticas:** Al iniciar, la API ejecuta automáticamente las migraciones de Entity Framework Core y realiza el *Seeding* de datos inicial (Eventos, Sectores, Butacas y el usuario de prueba).
- **Integridad ACID:** El flujo de compra (reserva -> confirmación de pago) se maneja con transacciones explícitas de base de datos (`BeginTransactionAsync`), asegurando que la confirmación de la venta y el cambio de estado de la butaca jamás queden inconsistentes.
