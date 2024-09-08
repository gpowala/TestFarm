using FluentMigrator;

namespace TestFarmGridsMigrator.Migrations
{
    [Migration(202310281544)]
    public partial class M202310281544_CreateHostsTable : ForwardOnlyMigration
    {
        public override void Up()
        {
            Create.Table("Hosts")
                .WithColumn("Id").AsInt32().NotNullable().PrimaryKey().Identity()
                .WithColumn("GridId").AsInt32().NotNullable().ForeignKey("Grids", "Id")

                .WithColumn("Name").AsString().NotNullable().Unique()
                .WithColumn("Type").AsString().NotNullable()
                .WithColumn("Status").AsString().NotNullable()

                .WithColumn("Hostname").AsString().NotNullable()
                .WithColumn("Cores").AsInt16().NotNullable()
                .WithColumn("RAM").AsInt16().Nullable()

                .WithColumn("CreationTimestamp").AsDateTime2().NotNullable()
                .WithColumn("LastUpdateTimestamp").AsDateTime2().NotNullable();
        }
    }
}
