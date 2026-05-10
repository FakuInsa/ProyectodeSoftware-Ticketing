using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Ticketing.DTOs;
using Ticketing.Services;

namespace Ticketing.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _paymentService;

        public PaymentsController(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        // POST: api/v1/payments
        [HttpPost]
        public async Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentRequest request)
        {
            var result = await _paymentService.ConfirmPaymentAsync(request);

            if (!result.Success)
            {
                // La reserva expiró o ya fue procesada → 409
                if (result.Message.Contains("expirado") || result.Message.Contains("procesada"))
                    return Conflict(new { error = result.Message });

                // Cualquier otra validación fallida → 400
                return BadRequest(new { error = result.Message });
            }

            return Ok(new { mensaje = result.Message });
        }
    }
}