// Debug middleware for admin routes to help with troubleshooting

/**
 * Logs user role information to console for debugging admin access
 * @param {Object} user - The user object from authentication context
 */
export const logUserRoleToConsole = (user) => {
  if (process.env.NODE_ENV !== 'production') {
    console.group('Admin Route Debug Info');
    console.log('User ID:', user?._id);
    console.log('Username:', user?.username);
    console.log('Role:', user?.role);
    console.log('Has admin access:', user?.role === 'admin' || user?.roles?.includes('admin'));
    console.groupEnd();
  }
};

/**
 * Helper to check if user has admin privileges
 * @param {Object} user - The user object from authentication context
 * @returns {boolean} Whether the user has admin privileges
 */
export const hasAdminPrivileges = (user) => {
  return user?.role === 'admin' || user?.roles?.includes('admin');
};