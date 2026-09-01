CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,      -- NULL, если пользователь пришёл только через Google OAuth
  google_id TEXT UNIQUE,   -- NULL, если Google не привязан
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_has_auth_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);
