namespace Service.Configuration
{
    public interface ServiceConfiguration
    {
        string DatabaseConnectionString { get; set; }
        string DatabaseName { get; set; }
    }
}
