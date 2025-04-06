// Debugging middleware for user roles
export const logUserRoleToConsole = (user) => {
  console.log('User auth debug:');
  console.log('- User ID:', user?._id || 'No ID');
  console.log('- Email:', user?.email || 'No email');
  console.log('- Role field:', user?.role || 'No role field');
  console.log('- isAdmin property:', user?.isAdmin);
  console.log('- Roles array:', user?.roles);
  
  // Analyze the user object structure
  if (user) {
    console.log('User object keys:', Object.keys(user));
  }
  
  return user;
};