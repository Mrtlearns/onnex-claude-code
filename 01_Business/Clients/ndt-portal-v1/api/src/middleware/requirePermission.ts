import { Request, Response, NextFunction, Router } from 'express';
import { AuthUser } from './jwt';

/**
 * Permission gate middleware
 * Verifies that the authenticated user has the required permission(s)
 *
 * Usage:
 *   router.use(requirePermission('ADMIN_PANEL'));
 *   router.get('/settings', requirePermission('ADMIN_PANEL'), handler);
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Must be authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthenticated',
        code: 'UNAUTHORIZED',
      });
    }

    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some((perm) =>
      (req.user as AuthUser).permissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: requiredPermissions,
        user_permissions: (req.user as AuthUser).permissions,
      });
    }

    next();
  };
}

/**
 * Helper: require at least one specific permission
 * More semantic than requirePermission('X')
 */
export const requireRT = requirePermission('RT_INSPECTION');
export const requireUT = requirePermission('UT_INSPECTION');
export const requireAdmin = requirePermission('ADMIN_PANEL');
export const requireReportExport = requirePermission('REPORT_EXPORT');
export const requireWorkshop = requirePermission('WORKSHOP_ACCESS');
