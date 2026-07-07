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

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT,
    login TEXT,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)