INSERT INTO user_profiles (user_id, tenant_id, display_name, status)
VALUES ('12811ef75a96f3385089b94fc963d9b7779cfbd3b780323a784a8a8ccf79f19f', 'default', 'Tilesh Maharaj', 'active')
ON CONFLICT (user_id) DO NOTHING;
