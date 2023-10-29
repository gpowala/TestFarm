namespace Service.DatabaseModels
{
    public class Grid
    {
        public int? Id { get; set; }

        public required string Name { get; set; }
        public required string Status { get; set; }

        public required DateTime CreationTimestamp { get; set; }
        public required DateTime LastUpdateTimestamp { get; set; }

        public ICollection<Host> Hosts { get; } = new List<Host>();
    }
}
