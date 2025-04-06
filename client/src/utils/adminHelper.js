/**
 * Utility for making the currently logged in user an admin
 * This is a client-side override for testing purposes
 */

// Add admin helpers to window for debugging
if (typeof window !== 'undefined') {
  window.__admin__ = window.__admin__ || {};
}

// Function to temporarily make the current user an admin
export const makeCurrentUserAdmin = (user) => {
  if (!user) return null;
  
  // Create a new user object with admin privileges
  const adminUser = {
    ...user,
    role: 'admin', // Set the role field
    // Keep any existing roles array
    roles: user.roles ? 
           (user.roles.includes('admin') ? user.roles : [...user.roles, 'admin']) : 
           ['admin']
  };
  
  console.log('Admin privileges added to user:', user.email);
  return adminUser;
};

// Apply admin role override to specific email addresses
export const applyAdminOverride = (user) => {
  // List of admin emails
  const adminEmails = [
    'yaront111@gmail.com',
    // Add other admin emails here if needed
  ];
  
  if (!user) return null;
  
  // Check if the user's email is in the admin list
  if (adminEmails.includes(user.email?.toLowerCase())) {
    console.log(`Admin override applied for: ${user.email}`);
    const adminUser = makeCurrentUserAdmin(user);
    
    // Add to window object for debugging
    if (typeof window !== 'undefined') {
      window.__admin__.lastOverride = {
        timestamp: new Date().toISOString(),
        email: user.email,
        before: { ...user },
        after: { ...adminUser }
      };
    }
    
    return adminUser;
  }
  
  return user;
};

// Export a utility to manually apply admin privileges via console
if (typeof window !== 'undefined') {
  // Add utility function to window.__admin__
  window.__admin__.makeAdmin = async () => {
    try {
      // Get the context modules
      const AuthContext = await import('../context/AuthContext');
      
      // Access the current user
      const currentUser = AuthContext.useAuth ? AuthContext.useAuth().user : null;
      
      if (!currentUser) {
        console.error('No user is currently logged in');
        return false;
      }
      
      // Create admin user
      const adminUser = makeCurrentUserAdmin(currentUser);
      
      // Log changes
      console.log('User before:', currentUser);
      console.log('User after:', adminUser);
      
      // Save to window for debugging
      window.__admin__.current = adminUser;
      
      console.log('Admin privileges applied. Refresh the page to see changes.');
      return true;
    } catch (error) {
      console.error('Failed to apply admin privileges:', error);
      return false;
    }
  };
  
  console.log('Admin helper utilities loaded. Use window.__admin__.makeAdmin() to apply admin privileges.');
}