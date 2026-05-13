using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Ticketing.Hubs
{
    public class TicketingHub : Hub
    {
        // El cliente se conecta automáticamente aquí. 
        // No necesitamos métodos complejos desde el cliente al servidor de momento, 
        // ya que las reservas se hacen vía la API HTTP y el servidor hace "push".
    }
}
