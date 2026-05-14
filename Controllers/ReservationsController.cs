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
                // Si la DB detecta choque en el mismo milisegundo (CONCURRENCY_ERROR) 
                // O si entró 1 milisegundo tarde y la app detecta que ya está ocupada ("Butaca no disponible.")
                if (result.Message == "CONCURRENCY_ERROR" || result.Message == "Butaca no disponible.")
                {
                    return Conflict(new { error = "Conflicto: La butaca ya fue reservada." });
                }

                return BadRequest(new { error = result.Message });
            }

            // Si todo salió bien, devolvemos 200 OK
            return Ok(new { Mensaje = result.Message, ReservaId = result.Reserva?.Id });
        }

        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelReservation(int id, [FromBody] CancelReservationRequest request)
        {
            var result = await _reservationService.CancelReservationAsync(id, request.UsuarioId);

            if (!result.Success)
            {
                if (result.Message.Contains("permiso") || result.Message.Contains("encontrada"))
                {
                    return NotFound(new { error = result.Message });
                }

                return BadRequest(new { error = result.Message });
            }

            return Ok(new { Mensaje = result.Message });
        }

        [HttpGet("user/{usuarioId}/pending")]
        public async Task<IActionResult> GetPendingReservations(int usuarioId)
        {
            var result = await _reservationService.GetPendingReservationsAsync(usuarioId);
            return Ok(result);
        }
    }
}