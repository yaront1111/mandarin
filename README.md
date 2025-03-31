# Mandarin Messaging Application

A modern messaging platform with real-time chat, video calls, and stories functionality.

## Overview

Mandarin is a comprehensive messaging application built with React and Node.js that provides users with a full-featured chat experience including:

- Real-time messaging with read receipts
- File sharing and multimedia messages
- Video calling
- User stories
- Profile customization
- Privacy settings

## Architecture

The application is built with a client-server architecture:

### Frontend

- **React**: UI library for component-based development
- **React Router**: For page navigation
- **Socket.io Client**: For real-time communication
- **Custom Hooks**: For reusable logic and state management

### Backend

- **Node.js**: Server-side JavaScript runtime
- **Express**: Web framework for API routes
- **MongoDB**: Database for storing user data and messages
- **Socket.io**: For real-time event handling
- **JWT**: For authentication

## Features

- **User Authentication**: Secure login and registration with JWT
- **Real-time Messaging**: Send and receive messages instantly
- **Message Types**: Support for text, emojis, images, files, and "winks"
- **Read Receipts**: See when messages are delivered and read
- **Video Calls**: One-to-one video chat functionality
- **User Stories**: Share time-limited updates with followers
- **Photo Privacy**: Set permissions for who can see your photos
- **User Profiles**: Customize your profile with photos and information
- **Notifications**: Real-time notifications for new messages and interactions
- **Subscription Tiers**: Free and premium account options

## Installation and Setup

### Prerequisites

- Node.js (v14+)
- MongoDB (v4+)
- npm or yarn

### Client Setup

1. Navigate to the client directory: `cd client`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

### Server Setup

1. Navigate to the server directory: `cd server`
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start the server: `npm start`

## Code Structure

### Client

```
client/
├── src/
│   ├── components/       # UI components
│   │   ├── common/       # Reusable UI components
│   │   └── Stories/      # Story-related components
│   ├── context/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── services/         # API and socket services
│   ├── styles/           # CSS styles
│   └── utils/            # Utility functions
└── public/               # Static assets
```

### Server

```
server/
├── middleware/           # Express middleware
├── models/               # MongoDB schemas
├── routes/               # API routes
├── socket/               # Socket.io handlers
└── utils/                # Utility functions
```

## Custom Hooks

The application uses several custom hooks to encapsulate common functionality:

- **useChatMessages**: For loading, sending, and managing messages
- **useSocketConnection**: For managing socket.io connections
- **useApi**: For making standardized API calls
- **useSettings**: For managing user settings
- **useMounted**: For safely handling asynchronous operations

## Contributing

Contributions are welcome! Please follow the existing code style and commit conventions.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License.