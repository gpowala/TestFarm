using Microsoft.Data.SqlClient;

using System.Diagnostics;

using Service.DatabaseModels;

namespace Service.Repositories
{
    public class Grids : Repository<Grid>
    {
        private readonly Context _context;

        public Grids(Context context)
        {
            _context = context;
        }

        public async Task<int> AddAsync(Grid entity)
        {
            int? gridId = null;

            try
            {
                var existingGrid = _context.Grids.Where(g => g.Name == entity.Name).FirstOrDefault();

                if (existingGrid != null)
                {
                    gridId = existingGrid.Id;
                }
                else
                {
                    _context.Grids.Add(entity);
                    await _context.SaveChangesAsync();

                    gridId = entity.Id;
                }
            }
            catch (SqlException ex)
            {
                const int violationOfUniqueConstraint = 2601;
                if (ex.Number == violationOfUniqueConstraint)
                {
                    throw new Exception($"Failed to add new grid to database. Probably due to race between 2 hosts trying to add grid at the same time. Please, retry... Details: {ex.Message}");
                }
                else
                {
                    throw new Exception($"Failed to add new grid to database with sql error: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to add new grid to database with error: {ex.Message}");
            }

            Debug.Assert(gridId != null);
            return (int)gridId;
        }

        public async Task RemoveAsync(Grid entity)
        {
            try
            {
                if (!_context.Hosts.Any(h => h.GridId == entity.Id))
                {
                    _context.Grids.Remove(entity);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    throw new Exception($"There are hosts running in {entity.Name} grid. Will not remove.");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to remove grid from database with error: {ex.Message}");
            }
        }

        public Task<Grid> GetByIdAsync(int id)
        {
            throw new NotImplementedException();
        }

        public Task<Grid> GetByNameAsync(string name)
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<Grid>> ListAsync()
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<Grid>> ListAsync(System.Linq.Expressions.Expression<Func<Grid, bool>> predicate)
        {
            throw new NotImplementedException();
        }
    }
}
