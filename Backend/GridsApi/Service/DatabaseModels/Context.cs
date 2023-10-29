using Microsoft.EntityFrameworkCore;

namespace Service.DatabaseModels
{
    public interface Context
    {
        DbSet<Grid> Grids { get; set; }
        DbSet<Host> Hosts { get; set; }

        int SaveChanges();
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default(CancellationToken));
    }
}
