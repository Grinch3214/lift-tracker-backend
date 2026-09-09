import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSetEntries1788334774706 implements MigrationInterface {
  name = 'CreateSetEntries1788334774706';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "set_entries" ("id" uuid NOT NULL, "workout_exercise_id" uuid NOT NULL, "weight" numeric, "reps" integer, "duration_seconds" integer, "distance_km" numeric, "dumbbell_count" smallint, "is_completed" boolean NOT NULL DEFAULT true, CONSTRAINT "set_entries_dumbbell_count_check" CHECK ("dumbbell_count" IS NULL OR "dumbbell_count" IN (1, 2)), CONSTRAINT "PK_239c7dde1e909456065ad610175" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_set_entries_workout_exercise_id" ON "set_entries" ("workout_exercise_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "set_entries" ADD CONSTRAINT "set_entries_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "set_entries" DROP CONSTRAINT "set_entries_workout_exercise_id_fkey"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_set_entries_workout_exercise_id"`,
    );
    await queryRunner.query(`DROP TABLE "set_entries"`);
  }
}
