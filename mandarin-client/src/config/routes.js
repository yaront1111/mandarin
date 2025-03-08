// src/config/routes.js

/**
 * Define path constants or a route config object for your application's screens.
 */

// Option 1: Simple object with path strings
export const ROUTES = {
  HOME: '/',
  DISCOVER: '/discover',
  MAP: '/map',
  MATCHES: '/matches',
  MESSAGES: '/messages',
  STORIES: '/stories',
  PROFILE: '/profile',
  // Admin
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_MODERATION: '/admin/moderation',
};

// Option 2: Array of route objects (for React Router `useRoutes`)
export const routesConfig = [
  { path: '/', element: <HomePage /> },
  { path: '/discover', element: <DiscoverPage /> },
  { path: '/map', element: <MapPage /> },
  // etc...
];
