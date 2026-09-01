CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY,      -- приходит от клиента
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,   -- ссылка в каталог (статичный или custom_exercises) — НЕ внешний ключ в БД,
                                -- т.к. статичный каталог (app/data/muscle-groups.ts) в базе не хранится
  "order" INTEGER
);
CREATE INDEX idx_workout_exercises_workout_id ON workout_exercises(workout_id);
