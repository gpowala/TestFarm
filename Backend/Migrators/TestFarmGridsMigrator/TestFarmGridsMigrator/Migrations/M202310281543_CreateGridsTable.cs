using FluentMigrator;

namespace TestFarmGridsMigrator.Migrations
{
    [Migration(202310281543)]
    public partial class M202310281543_CreateGridsTable : ForwardOnlyMigration
    {
        public override void Up()
        {
            Create.Table("Grids")
                .WithColumn("Id").AsInt32().NotNullable().PrimaryKey().Identity()

                .WithColumn("Name").AsString().NotNullable().Unique()
                .WithColumn("Status").AsString().NotNullable()

                .WithColumn("CreationTimestamp").AsDateTime2().NotNullable()
                .WithColumn("LastUpdateTimestamp").AsDateTime2().NotNullable();
        }
    }
}
