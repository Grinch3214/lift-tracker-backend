import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { RefreshToken } from './auth/refresh-token.entity';
import { CatalogOrder } from './catalog/catalog-order.entity';
import { CustomExercise } from './catalog/custom-exercise.entity';
import { CustomMuscleGroup } from './catalog/custom-muscle-group.entity';
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
  entities: [
    User,
    RefreshToken,
    Workout,
    WorkoutExercise,
    SetEntry,
    CustomMuscleGroup,
    CustomExercise,
    CatalogOrder,
  ],
  // __dirname — это src/ под ts-node (CLI-миграции) и dist/ в собранном приложении,
  // поэтому паттерн сам подхватывает нужное расширение в каждом случае
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // схема меняется только через миграции, никогда автоматически
};

// Используется и NestJS-модулем (app.module.ts), и TypeORM CLI (генерация/прогон миграций)
export default new DataSource(dataSourceOptions);
