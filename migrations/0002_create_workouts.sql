CREATE TABLE workouts (
  id UUID PRIMARY KEY,      -- приходит от клиента
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)    -- один Workout на дату
);
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
