namespace Service.DatabaseModels
{
    public class Host : EntityBase
    {
        public int? Id { get; set; }

        public required string Name { get; set; }
        public required string Status { get; set; }
        
        public required string HostDetailsJson { get; set; }

        public required DateTime CreationTimestamp { get; set; }
        public required DateTime LastUpdateTimestamp { get; set; }

        public required int GridId { get; set; }
        public Grid Grid { get; set; } = null!;
    }
}
