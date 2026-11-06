-- Runs once, the first time the container's data directory is created.
-- The database tests truncate every table, so they get their own database and can
-- never be pointed at the one you are developing against by accident.
CREATE DATABASE billon_test OWNER billon;
CREATE DATABASE billon_legacy_test OWNER billon;
