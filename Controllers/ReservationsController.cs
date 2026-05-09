using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Ticketing.DTOs;
using Ticketing.Services;

namespace Ticketing.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ReservationsController : ControllerBase
    {
        private readonly IReservationService _reservationService;

        public ReservationsController(IReservationService reservationService)
        {
            _reservationService = reservationService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequest request)
        {
            var result = await _reservationService.CreateReservationAsync(request);

            if (!result.Success)
            {
                // Si el mensaje es el que definimos en el catch del servicio...
                if (result.Message == "CONCURRENCY_ERROR")
                {
                    // Devolvemos el código 409 Conflict
                    return Conflict(new
                    {
                        error = "La butaca ya no está disponible. Fue seleccionada por otro usuario en este instante."
                    });
                }

                // Para cualquier otro error (datos inválidos, etc.), devolvemos 400
                return BadRequest(new { error = result.Message });
            }

            // Si todo salió bien, devolvemos 200 OK
            return Ok(new { Mensaje = result.Message, ReservaId = result.Reserva?.Id, Expiracion = result.Reserva.Expiracion });
        }
    }
}