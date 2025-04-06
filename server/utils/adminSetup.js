/**
 * Admin setup utility to ensure designated admin accounts always have admin role
 */
import User from '../models/User.js';
import logger from '../logger.js';

// List of admin emails that should always have admin role
const PERMANENT_ADMIN_EMAILS = [
  'yaront111@gmail.com'
];

/**
 * Ensures that designated accounts always have admin role 
 * This runs periodically to maintain admin access
 */
export const ensureAdminAccounts = async () => {
  try {
    logger.info('Checking admin accounts setup...');
    
    // For each admin email, find user and ensure admin role
    for (const email of PERMANENT_ADMIN_EMAILS) {
      // Find user with case-insensitive search
      const user = await User.findOne({ 
        email: { $regex: new RegExp(`^${email}$`, 'i') } 
      });
      
      if (user) {
        // If user exists but doesn't have admin role, update it
        if (user.role !== 'admin') {
          logger.info(`Setting admin role for ${email}`);
          
          user.role = 'admin';
          await user.save();
          
          logger.info(`Successfully updated role to admin for ${email}`);
        } else {
          logger.debug(`User ${email} already has admin role`);
        }
      } else {
        logger.warn(`Admin user ${email} not found in database`);
      }
    }
    
    logger.info('Admin accounts setup completed');
  } catch (error) {
    logger.error('Error ensuring admin accounts', error);
  }
};

export default { ensureAdminAccounts };