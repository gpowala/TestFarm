using Service.DatabaseModels;
using System.Linq.Expressions;

namespace Service.Repositories
{
    public interface Repository<T> where T : EntityBase
    {
        Task<T> GetByIdAsync(int id);
        Task<T> GetByNameAsync(string name);

        Task<IEnumerable<T>> ListAsync();
        Task<IEnumerable<T>> ListAsync(Expression<Func<T, bool>> predicate);

        Task AddAsync(T entity);
        Task RemoveAsync(T entity);
    }
}
