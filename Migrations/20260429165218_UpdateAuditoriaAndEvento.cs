using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProyectodeSoftware_Ticketing.Migrations
{
    /// <inheritdoc />
    public partial class UpdateAuditoriaAndEvento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Estado",
                table: "Eventos",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Auditorias_UsuarioId",
                table: "Auditorias",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Auditorias_Usuarios_UsuarioId",
                table: "Auditorias",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Auditorias_Usuarios_UsuarioId",
                table: "Auditorias");

            migrationBuilder.DropIndex(
                name: "IX_Auditorias_UsuarioId",
                table: "Auditorias");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "Eventos");
        }
    }
}
