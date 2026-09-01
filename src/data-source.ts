import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './users/user.entity';
import { Workout } from './workouts/workout.entity';
import { WorkoutExercise } from './workouts/workout-exercise.entity';
import { SetEntry } from './workouts/set-entry.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [User, Workout, WorkoutExercise, SetEntry],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // схема меняется только через миграции, никогда автоматически
};

// Используется и NestJS-модулем (app.module.ts), и TypeORM CLI (генерация/прогон миграций)
export default new DataSource(dataSourceOptions);
