import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomExercises1788359047722 implements MigrationInterface {
  name = 'CreateCustomExercises1788359047722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "custom_exercises" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "muscle_group_id" text NOT NULL, "name" text NOT NULL, "equipment" text, "tracking_type" text NOT NULL, "order" integer, "is_deleted" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "custom_exercises_tracking_type_check" CHECK ("tracking_type" IN ('weight-reps', 'time-distance')), CONSTRAINT "PK_a5d68d671d966065795bf6ccd97" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_custom_exercises_user_id" ON "custom_exercises" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_exercises" ADD CONSTRAINT "custom_exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_exercises" DROP CONSTRAINT "custom_exercises_user_id_fkey"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_custom_exercises_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "custom_exercises"`);
  }
}
