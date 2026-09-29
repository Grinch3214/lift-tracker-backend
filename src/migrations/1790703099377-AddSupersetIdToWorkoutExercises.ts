import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupersetIdToWorkoutExercises1790703099377 implements MigrationInterface {
  name = 'AddSupersetIdToWorkoutExercises1790703099377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" ADD "superset_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" DROP COLUMN "superset_id"`,
    );
  }
}
