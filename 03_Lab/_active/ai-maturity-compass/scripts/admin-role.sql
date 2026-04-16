INSERT INTO user_roles (user_id, role, organization_id)
VALUES ('62993da8-a4cc-40e7-9c20-353168f3b03f'::uuid, 'admin'::app_role, NULL)
ON CONFLICT DO NOTHING;

SELECT ur.role, u.email
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id;
