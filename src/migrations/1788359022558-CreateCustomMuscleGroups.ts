import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomMuscleGroups1788359022558 implements MigrationInterface {
  name = 'CreateCustomMuscleGroups1788359022558';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "custom_muscle_groups" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "name" text NOT NULL, "order" integer NOT NULL, "is_deleted" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d185e8cef299a32a3c143f3b4ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_custom_muscle_groups_user_id" ON "custom_muscle_groups" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_muscle_groups" ADD CONSTRAINT "custom_muscle_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_muscle_groups" DROP CONSTRAINT "custom_muscle_groups_user_id_fkey"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_custom_muscle_groups_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "custom_muscle_groups"`);
  }
}
