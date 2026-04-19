INSERT INTO user_profiles (user_id, tenant_id, display_name, status) VALUES
  ('4cb0fc52400e77251b5945c33eb328b3d4b2eb1f0073902e47ada8a201819649', 'default', 'Vasislav Damenilev', 'active'),
  ('400362df848705a71aa1e4a773153a9a9471e2d984f45a1ee25167f3def338b1', 'default', 'Hugh Dunkerley', 'active'),
  ('4cc4bcfb21e173f02d662d5c8e9837dbb52b9a3a17e5cde79c996964ee079bf5', 'default', 'Admin', 'active')
ON CONFLICT (user_id) DO NOTHING;
