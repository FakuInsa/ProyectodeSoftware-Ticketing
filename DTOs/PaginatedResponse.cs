using System.Collections.Generic;

namespace Ticketing.DTOs
{
    public class PaginatedResponse<T>
    {
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }
        public IEnumerable<T> Data { get; set; } = new List<T>();
    }
}