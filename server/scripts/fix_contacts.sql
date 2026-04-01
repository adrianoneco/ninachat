-- Fix null timestamps that block TypeORM schema sync
BEGIN;

-- Set missing first_contact_date and last_activity to now()
UPDATE contacts SET first_contact_date = now() WHERE first_contact_date IS NULL;
UPDATE contacts SET last_activity = now() WHERE last_activity IS NULL;

COMMIT;
