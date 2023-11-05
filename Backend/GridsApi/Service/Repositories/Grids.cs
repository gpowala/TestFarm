using Microsoft.Data.SqlClient;
using Service.DatabaseModels;
using System.Runtime.CompilerServices;

namespace Service.Repositories
{
    public class Grids : Repository<Grid>
    {
        private readonly Context _context;

        public Grids(Context context)
        {
            _context = context;
        }

        public async Task AddAsync(Grid entity)
        {
            try
            {
                _context.Grids.Add(entity);
                await _context.SaveChangesAsync();
            }
            catch (SqlException ex)
            {
                const int violationOfUniqueConstraint = 2601;
                if (ex.Number == violationOfUniqueConstraint)
                {
                    // Grid already exists, proceed forward.
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
        }

        public async Task Remove(Grid entity)
        {
            try
            {
                _context.Grids.Remove(entity);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to remove grid from database with error: {ex.Message}");
            }
        }

        public Grid GetById(int id)
        {
            throw new NotImplementedException();
        }

        public Grid GetByName(string name)
        {
            throw new NotImplementedException();
        }

        public IEnumerable<Grid> List()
        {
            throw new NotImplementedException();
        }

        public IEnumerable<Grid> List(System.Linq.Expressions.Expression<Func<Grid, bool>> predicate)
        {
            throw new NotImplementedException();
        }
    }
}
