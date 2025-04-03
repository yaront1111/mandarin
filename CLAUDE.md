# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint & Test Commands
- check logs

## Code Style Guidelines
- ES Modules syntax is used (import/export)
- React component files use JSX extension
- Follow existing indentation (2 spaces) and formatting
- Prefer const over let, avoid var
- Use async/await for asynchronous operations
- Follow React hooks naming convention (useHookName)
- Avoid console.log in production code (use logger in server)
- Handle errors with try/catch and proper error boundaries
- Follow RESTful API patterns for server routes
- Name components with PascalCase, functions with camelCase
- Socket.io is used for real-time communication

## Server Configuration Notes
- The server uses Express to serve the `/uploads` directory statically
- Images should be properly normalized with the `normalizePhotoUrl` function
- For direct image access, add CORS headers to prevent 403 Forbidden
- Images from the app should all go through the `/uploads/images/` path

## Nginx Configuration (for reference)
If you're using Nginx with this app, make sure your configuration includes:

```nginx
# In your server or location block
location /uploads/ {
    alias /path/to/app/uploads/;
    add_header Access-Control-Allow-Origin *;
    add_header Cross-Origin-Resource-Policy cross-origin;
    expires 1d;
    try_files $uri $uri/ =404;
}
```

## Common Issues
- 403 Forbidden on direct image URLs: Add proper CORS headers in Express and Nginx
- Missing image URLs: Make sure to use `normalizePhotoUrl` utility
- Socket disconnection: Check token validation in socket authentication
