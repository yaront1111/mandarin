// client/src/components/index.js
// Import all components and re-export them for easier imports throughout the app

// Layout Components
import { Navbar, Alert } from "./LayoutComponents"

// User card
import UserCard from "./UserCard.jsx"

// Chat Components - Legacy
import EmbeddedChat from "./EmbeddedChat"

// Stories Components
import StoriesCarousel from "./Stories/StoriesCarousel"
import StoriesViewer from "./Stories/StoriesViewer"
import StoryCreator from "./Stories/StoryCreator"
import StoryThumbnail from "./Stories/StoryThumbnail"

// Error Boundary
import ErrorBoundary from "./ErrorBoundary"

// Import consolidated PrivateRoute implementation
import PrivateRoute from "./common/PrivateRoute.jsx"

// Theme Toggle
import { ThemeToggle } from "./theme-toggle.tsx"

// User Profile Modal
import UserProfileModal from "./UserProfileModal"

// SEO Component
import SEO from "./SEO"

export {
  // Layout Components
  Navbar,
  Alert,
  // Chat Components
  EmbeddedChat,

  UserCard,
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
  // User Profile Modal
  UserProfileModal,
  // SEO
  SEO,
}
