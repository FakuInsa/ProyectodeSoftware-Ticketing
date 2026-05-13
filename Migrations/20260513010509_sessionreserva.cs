using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProyectodeSoftware_Ticketing.Migrations
{
    /// <inheritdoc />
    public partial class sessionreserva : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Expiracion",
                table: "Reservas");

            migrationBuilder.AddColumn<int>(
                name: "SesionId",
                table: "Reservas",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "SesionesReserva",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    EventoId = table.Column<int>(type: "integer", nullable: false),
                    LimiteElegido = table.Column<int>(type: "integer", nullable: false),
                    ExpiracionGlobal = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SesionesReserva", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SesionesReserva_Eventos_EventoId",
                        column: x => x.EventoId,
                        principalTable: "Eventos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SesionesReserva_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reservas_SesionId",
                table: "Reservas",
                column: "SesionId");

            migrationBuilder.CreateIndex(
                name: "IX_SesionesReserva_EventoId",
                table: "SesionesReserva",
                column: "EventoId");

            migrationBuilder.CreateIndex(
                name: "IX_SesionesReserva_UsuarioId",
                table: "SesionesReserva",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Reservas_SesionesReserva_SesionId",
                table: "Reservas",
                column: "SesionId",
                principalTable: "SesionesReserva",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reservas_SesionesReserva_SesionId",
                table: "Reservas");

            migrationBuilder.DropTable(
                name: "SesionesReserva");

            migrationBuilder.DropIndex(
                name: "IX_Reservas_SesionId",
                table: "Reservas");

            migrationBuilder.DropColumn(
                name: "SesionId",
                table: "Reservas");

            migrationBuilder.AddColumn<DateTime>(
                name: "Expiracion",
                table: "Reservas",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }
    }
}
