-- 2026-11-12 align naming with the rest of the schema (*_user_id).
ALTER TABLE appointments RENAME COLUMN created_by TO created_by_user_id;
