using System.Threading.Tasks;
using Ticketing.DTOs;

namespace Ticketing.Services
{
    public interface IPaymentService
    {
        Task<(bool Success, string Message)> ConfirmPaymentAsync(ConfirmPaymentRequest request);
    }
}