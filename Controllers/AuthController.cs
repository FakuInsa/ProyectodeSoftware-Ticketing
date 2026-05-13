using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Ticketing.DTOs;
using Ticketing.Services;

namespace Ticketing.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] EmailLoginRequest request)
        {
            var result = await _authService.LoginAsync(request.Email, request.Password);
            if (!result.Success) return BadRequest(new { error = result.Message });

            return Ok(new { userId = result.Usuario!.Id, nombre = result.Usuario.Nombre, email = result.Usuario.Email });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] EmailLoginRequest request)
        {
            var result = await _authService.RegisterAsync(request.Email, request.Nombre, request.Password);
            if (!result.Success) return BadRequest(new { error = result.Message });

            return Ok(new { userId = result.Usuario!.Id, nombre = result.Usuario.Nombre, email = result.Usuario.Email });
        }
    }
}