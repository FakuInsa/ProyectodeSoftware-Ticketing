using System.Threading.Tasks;
using Ticketing.Models;

namespace Ticketing.Services
{
    public interface IAuthService
    {
        Task<(bool Success, string Message, Usuario? Usuario)> LoginAsync(string email, string password);
        Task<(bool Success, string Message, Usuario? Usuario)> RegisterAsync(string email, string nombre, string password);
    }
}