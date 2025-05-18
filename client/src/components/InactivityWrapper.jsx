import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { useAuth } from '../context/AuthContext';

// Wrapper component to handle inactivity timer
export function InactivityWrapper({ children }) {
  const { isAuthenticated } = useAuth();
  
  // Call the hook unconditionally - the hook itself handles the authentication check
  useInactivityTimer();
  
  return children;
}