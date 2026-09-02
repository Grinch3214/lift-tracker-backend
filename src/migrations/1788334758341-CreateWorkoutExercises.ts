import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkoutExercises1788334758341 implements MigrationInterface {
  name = 'CreateWorkoutExercises1788334758341';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "workout_exercises" ("id" uuid NOT NULL, "workout_id" uuid NOT NULL, "exercise_id" text NOT NULL, "order" integer, CONSTRAINT "PK_377f9ead6fd69b29f0d0feb1028" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_workout_exercises_workout_id" ON "workout_exercises" ("workout_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" DROP CONSTRAINT "workout_exercises_workout_id_fkey"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_workout_exercises_workout_id"`,
    );
    await queryRunner.query(`DROP TABLE "workout_exercises"`);
  }
}
