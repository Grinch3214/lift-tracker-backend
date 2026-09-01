CREATE TABLE set_entries (
  id UUID PRIMARY KEY,      -- приходит от клиента
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  weight NUMERIC,               -- кг, только для trackingType 'weight-reps'
  reps INTEGER,
  duration_seconds INTEGER,     -- только для trackingType 'time-distance'
  distance_km NUMERIC,
  dumbbell_count SMALLINT CHECK (dumbbell_count IS NULL OR dumbbell_count IN (1, 2)),
  is_completed BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_set_entries_workout_exercise_id ON set_entries(workout_exercise_id);
