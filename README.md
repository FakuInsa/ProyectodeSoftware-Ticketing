# PROYECTO DE SOFTWARE - TICKETING

Requerimientos: Tener instalado Docker Desktop.

Para correr el programa usar el comando : docker-compose up


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



## Notas de Arquitectura

Persistencia: Los datos de la base de datos persisten entre reinicios gracias a los volúmenes de Docker.

Migraciones Automáticas: Al iniciar, la API ejecuta automáticamente las migraciones de Entity Framework Core y realiza el Seeding de datos.

Seguridad: El sistema implementa manejo de concurrencia optimista para evitar reservas duplicadas en el mismo milisegundo.
