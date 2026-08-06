-- Runs on first container start (empty data volume). Adds a second database
-- for the Vitest suite so it can be wiped independently of dev data, and
-- grants the app user permission on it.
CREATE DATABASE IF NOT EXISTS discgolf_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON discgolf_test.* TO 'discgolf'@'%';
FLUSH PRIVILEGES;
