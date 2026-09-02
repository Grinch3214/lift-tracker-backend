import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogOrder1788359071099 implements MigrationInterface {
  name = 'CreateCatalogOrder1788359071099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "catalog_order" ("user_id" uuid NOT NULL, "group_order" jsonb NOT NULL DEFAULT '[]', "exercise_order" jsonb NOT NULL DEFAULT '{}', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_70aa33804631093adf242dddce6" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_order" ADD CONSTRAINT "catalog_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_order" DROP CONSTRAINT "catalog_order_user_id_fkey"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_order"`);
  }
}
