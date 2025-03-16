// Import all components and re-export them for easier imports throughout the app

// Layout Components
import { Navbar, Alert, PrivateRoute as LayoutPrivateRoute } from "./LayoutComponents"

// User Components
import {
  UserCard,
  UserPhotoGallery,
  UserPhotoViewer,
  UserList,
  UserFilter
} from "./UserComponents"

// Chat Components
import {
  ChatBox,
  VideoCall,
  Spinner
} from "./ChatComponents"

// Import EmbeddedChat as a named import
import EmbeddedChat from "./EmbeddedChat"

// Stories Components
import StoriesCarousel from "./Stories/StoriesCarousel"
import StoriesViewer from "./Stories/StoriesViewer"
import StoryCreator from "./Stories/StoryCreator"
import StoryThumbnail from "./Stories/StoryThumbnail"

// Error Boundary
import ErrorBoundary from "./ErrorBoundary"

// Import from PrivateRoute.jsx which is our main implementation
import PrivateRoute from "./PrivateRoute.jsx"

// Theme Toggle
import { ThemeToggle } from "./theme-toggle.tsx"

export {
  // Layout Components
  Navbar,
  Alert,
  LayoutPrivateRoute,

  // User Components
  UserCard,
  UserPhotoGallery,
  UserPhotoViewer,
  UserList,
  UserFilter,

  // Chat Components
  ChatBox,
  VideoCall,
  Spinner,
  EmbeddedChat,

  // Stories Components
  StoriesCarousel,
  StoriesViewer,
  StoryCreator,
  StoryThumbnail,

  // Error Boundary
  ErrorBoundary,

  // Auth Components
  PrivateRoute,

  // Theme Toggle
  ThemeToggle,
}
