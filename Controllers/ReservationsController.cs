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
                return BadRequest(result.Message);

            return Ok(new { Mensaje = result.Message, ReservaId = result.Reserva?.Id });
        }
    }
}