import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaAndExerciseMediaId1790710607501 implements MigrationInterface {
  name = 'CreateMediaAndExerciseMediaId1790710607501';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "content_type" text NOT NULL, "size" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_media_user_id" ON "media" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_exercises" ADD "media_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "media_user_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_exercises" DROP COLUMN "media_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_media_user_id"`);
    await queryRunner.query(`DROP TABLE "media"`);
  }
}
