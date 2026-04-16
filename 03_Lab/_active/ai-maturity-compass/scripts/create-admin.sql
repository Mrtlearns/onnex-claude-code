-- ============================================================
-- Create Admin User
-- Run AFTER schema.sql, AFTER creating the user via Supabase
-- Studio > Authentication > Users > "Add user"
--
-- Steps:
--   1. Go to poc-nursery.poc.playsap.us (Supabase Studio)
--   2. Authentication > Users > Add user
--   3. Enter admin email + password
--   4. Copy the user UUID from the users list
--   5. Replace <ADMIN_USER_UUID> below and run this SQL
-- ============================================================

INSERT INTO user_roles (user_id, role, organization_id)
VALUES ('<ADMIN_USER_UUID>', 'admin', NULL)
ON CONFLICT DO NOTHING;

-- Verify
SELECT u.email, r.role, r.organization_id
FROM auth.users u
JOIN user_roles r ON r.user_id = u.id
WHERE r.role = 'admin';
