using Microsoft.Data.SqlClient;

using System.Diagnostics;

using Service.DatabaseModels;

namespace Service.Repositories
{
    public class Hosts : Repository<Service.DatabaseModels.Host>
    {
        private readonly Context _context;

        public Hosts(Context context)
        {
            _context = context;
        }

        public async Task<int> AddAsync(Service.DatabaseModels.Host entity)
        {
            try
            {
                _context.Hosts.Add(entity);
                await _context.SaveChangesAsync();

                Debug.Assert(entity.Id != null);
                return (int)entity.Id;
            }
            catch (SqlException ex)
            {
                const int violationOfUniqueConstraint = 2601;
                if (ex.Number == violationOfUniqueConstraint)
                {
                    throw new Exception($"Failed to add new host to database. Probably host with name {entity.Name} already exists. Details: {ex.Message}");
                }
                else
                {
                    throw new Exception($"Failed to add new host to database with sql error: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to add new host to database with error: {ex.Message}");
            }
        }

        public async Task RemoveAsync(Service.DatabaseModels.Host entity)
        {
            try
            {
                _context.Hosts.Remove(entity);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to remove host from database with error: {ex.Message}");
            }
        }

        public Task<Service.DatabaseModels.Host> GetByIdAsync(int id)
        {
            throw new NotImplementedException();
        }

        public Task<Service.DatabaseModels.Host> GetByNameAsync(string name)
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<Service.DatabaseModels.Host>> ListAsync()
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<Service.DatabaseModels.Host>> ListAsync(System.Linq.Expressions.Expression<Func<Service.DatabaseModels.Host, bool>> predicate)
        {
            throw new NotImplementedException();
        }
    }
}
