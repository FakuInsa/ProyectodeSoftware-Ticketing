using System.Threading.Tasks;
using Ticketing.DTOs;
using Ticketing.Models;

namespace Ticketing.Services
{
    public interface IReservationService
    {
        Task<(bool Success, string Message, Reserva? Reserva)> CreateReservationAsync(CreateReservationRequest request);
        Task<(bool Success, string Message)> CancelReservationAsync(int reservaId, int usuarioId);
        Task<System.Collections.Generic.IEnumerable<object>> GetPendingReservationsAsync(int usuarioId);
    }
}