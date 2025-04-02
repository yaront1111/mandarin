# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint & Test Commands
- check logsn

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
