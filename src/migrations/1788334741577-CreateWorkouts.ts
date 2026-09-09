import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkouts1788334741577 implements MigrationInterface {
  name = 'CreateWorkouts1788334741577';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "workouts" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "date" date NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "workouts_user_id_date_key" UNIQUE ("user_id", "date"), CONSTRAINT "PK_5b2319bf64a674d40237dbb1697" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_workouts_user_id" ON "workouts" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workouts" DROP CONSTRAINT "workouts_user_id_fkey"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_workouts_user_id"`);
    await queryRunner.query(`DROP TABLE "workouts"`);
  }
}
