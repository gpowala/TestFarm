using Microsoft.EntityFrameworkCore;

using Service.Configuration;

namespace Service.DatabaseModels
{
    public class ContextImpl : DbContext, Context
    {
        public DbSet<Grid> Grids { get; set; }
        public DbSet<Host> Hosts { get; set; }

        private readonly ServiceConfiguration _configuration;

        public ContextImpl(ServiceConfiguration configuration)
        {
            _configuration = configuration;
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            MapGridsTable(modelBuilder);
            MapHostsTable(modelBuilder);
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlServer
            (
                _configuration.DatabaseConnectionString.Replace("###NAME###", _configuration.DatabaseName)
            );
        }

        private void MapGridsTable(ModelBuilder modelBuilder)
        {
            var gridsEntityBuilder = modelBuilder.Entity<Grid>();

            gridsEntityBuilder
                .ToTable("Grids")
                .HasKey(g => g.Id);

            gridsEntityBuilder
                .HasMany(g => g.Hosts)
                .WithOne(h => h.Grid)
                .HasForeignKey(h => h.GridId)
                .IsRequired();
        }

        private void MapHostsTable(ModelBuilder modelBuilder)
        {
            var holidayRightsAdjustmentsEntityBuilder = modelBuilder.Entity<Host>();

            holidayRightsAdjustmentsEntityBuilder
                .ToTable("Hosts")
                .HasKey(h => h.Id);

            holidayRightsAdjustmentsEntityBuilder
                .HasOne(h => h.Grid)
                .WithMany(g => g.Hosts)
                .HasForeignKey(h => h.GridId)
                .IsRequired();
        }
    }
}
