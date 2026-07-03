CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    email TEXT UNIQUE NOT NULL,
    login TEXT UNIQUE NOT NULL,
    emoji TEXT,

    lava_pillars_games INTEGER NOT NULL DEFAULT 0,
    lava_pillars_wins  INTEGER NOT NULL DEFAULT 0,

    formula_wars_games INTEGER NOT NULL DEFAULT 0,
    formula_wars_wins  INTEGER NOT NULL DEFAULT 0,

    password_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);