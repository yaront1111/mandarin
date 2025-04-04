ok# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint & Test Commands
- Start server: `npm start`
- Development mode with auto-reload: `npm run dev`
- Run tests: `npm test`
- Run linter: `npm run lint`
- Format code: `npm run format`
- Check logs in `/logs` directory: daily server and error logs

## Code Style Guidelines
- ES Modules syntax is used (import/export)
- Follow existing indentation (2 spaces) and formatting
- Prefer const over let, avoid var
- Use async/await for asynchronous operations
- Follow RESTful API patterns for routes
- Name models with PascalCase, functions with camelCase
- Handle errors with try/catch blocks
- Use the logger utility instead of console.log
- MongoDB/Mongoose for database operations
- Socket.io for real-time features (messaging, notifications)

## Architecture Notes
- Express serves static files from `/uploads` with proper CORS headers
- Media files stored in dedicated subdirectories
- Authentication uses JWT with middleware validation
- User permissions based on account tiers (FREE, PAID, FEMALE, COUPLE)
- Use utility functions in `/utils` for common operations
