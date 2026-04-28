using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProyectodeSoftware_Ticketing.Migrations
{
    /// <inheritdoc />
    public partial class AddEstadoToEvento : Migration
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Estado",
                table: "Eventos");
        }
    }
}
