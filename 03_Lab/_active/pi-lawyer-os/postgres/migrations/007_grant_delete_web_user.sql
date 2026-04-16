-- Migration 007: Grant DELETE privilege on tables missing it for web_user role
-- Required for Settings demo data clear-and-regenerate to work from the browser
GRANT DELETE ON case_settlements TO web_user;
GRANT DELETE ON client_users TO web_user;
