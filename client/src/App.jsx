"use client"

// client/src/App.jsx
import { useEffect, useState, Suspense, lazy } from "react"
import { Routes, Route } from "react-router-dom"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { LocaleHelper } from "./components" // Import LocaleHelper for SEO
import "./styles/base.css"
import "./styles/components.css"
import "./styles/pages.css"
import "./styles/utilities.css"
import "./styles/settings.css" // Using regular CSS for settings
import "./styles/notifications.css"
import "./styles/stories.css" // Using regular CSS for stories
import "./styles/footer.css" // Footer styles

import { AuthProvider, UserProvider, StoriesProvider, ThemeProvider, NotificationProvider, LanguageProvider } from "./context"
import { ChatConnectionProvider } from "./context/ChatConnectionContext"
// Correctly import the named hook
import { useInitializeNotificationServiceNavigation } from "./services/notificationService.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"
import PrivateRoute from "./components/PrivateRoute.jsx"
import AdminRoute from "./components/AdminRoute.jsx"
import VerificationBanner from "./components/VerificationBanner.jsx"
import { Footer } from "./components"
import { lazyLoad } from "./utils/lazyLoad"
import LoadingSpinner from "./components/common/LoadingSpinner"

// Eagerly load critical paths
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from "./pages/Register"

// Lazy load non-critical components
const Dashboard = lazy(() => import("./pages/Dashboard"))
const UserProfile = lazy(() => import("./pages/UserProfile"))
const Profile = lazy(() => import("./pages/Profile"))
const Settings = lazy(() => import("./pages/Settings.jsx"))
const NotFound = lazy(() => import("./pages/NotFound"))
const Messages = lazy(() => import("./pages/Messages.jsx"))
const Subscription = lazy(() => import("./pages/Subscription"))
const Admin = lazy(() => import("./pages/Admin.jsx"))
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.jsx"))
const AboutUs = lazy(() => import("./pages/AboutUs"))
const Safety = lazy(() => import("./pages/Safety"))
const Support = lazy(() => import("./pages/Support"))
const EmbeddedChat = lazy(() => import("./components/EmbeddedChat").then(module => ({ default: module.EmbeddedChat })))

function App() {
  // Call the hook here to set up navigation for the notification service
  useInitializeNotificationServiceNavigation()

  // State for global chat component
  const [chatRecipient, setChatRecipient] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    // Listen for custom chat events
    const handleOpenChat = (event) => {
      console.log("openChat event received in App.jsx", event.detail)
      const { recipient } = event.detail

      if (recipient && recipient._id) {
        console.log("Setting chat recipient and opening chat in App.jsx")
        setChatRecipient(recipient)
        setIsChatOpen(true)

        // Force the component to re-render with a slight delay
        setTimeout(() => {
          console.log("Forcing chat open state refresh")
          setIsChatOpen(true)
        }, 50)
      }
    }
    
    // Listen for language direction changes
    const handleLanguageDirectionChange = (event) => {
      console.log("Language direction changed", event.detail)
      // Force a re-render of critical components by adding/removing a temporary class
      document.body.classList.add('direction-changing')
      
      // Force layout recalculation
      document.body.offsetHeight
      
      setTimeout(() => {
        document.body.classList.remove('direction-changing')
      }, 50)
      
      // Apply RTL to toasts if Hebrew
      const toastContainer = document.querySelector('.Toastify')
      if (toastContainer) {
        if (event.detail.isRTL) {
          toastContainer.classList.add('Toastify__toast--rtl')
        } else {
          toastContainer.classList.remove('Toastify__toast--rtl')
        }
      }
    }

    // Add the event listeners
    window.addEventListener("openChat", handleOpenChat)
    window.addEventListener("languageDirectionChanged", handleLanguageDirectionChange)

    // Test the event listener on mount in development
    if (process.env.NODE_ENV === "development") {
      console.log("Event handlers registered in App.jsx")
    }

    return () => {
      window.removeEventListener("openChat", handleOpenChat)
      window.removeEventListener("languageDirectionChanged", handleLanguageDirectionChange)
    }
  }, [])

  const handleCloseChat = () => {
    setIsChatOpen(false)
  }

  return (
    // ErrorBoundary and Providers remain the same
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <UserProvider>
              <ChatConnectionProvider>
                <StoriesProvider>
                  <NotificationProvider>
                  {/* Add LocaleHelper for i18n SEO support */}
                  <LocaleHelper />
                  <div className="app-wrapper">
                    {/* Add the verification banner at the top level */}
                    <VerificationBanner />

                    <Routes>
                      {/* Critical paths loaded eagerly */}
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      
                      {/* Lazy-loaded routes with Suspense */}
                      <Route path="/verify-email" element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <VerifyEmail />
                        </Suspense>
                      } />
                      
                      {/* Public pages */}
                      <Route path="/about-us" element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <AboutUs />
                        </Suspense>
                      } />
                      <Route path="/about" element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <AboutUs />
                        </Suspense>
                      } />
                      <Route path="/safety" element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <Safety />
                        </Suspense>
                      } />
                      <Route path="/support" element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <Support />
                        </Suspense>
                      } />
                      
                      {/* Protected routes */}
                      <Route
                        path="/dashboard"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Dashboard />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/user/:id"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <UserProfile />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Profile />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/messages"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Messages />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/messages/:userId"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Messages />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Settings />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/subscription"
                        element={
                          <PrivateRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Subscription />
                            </Suspense>
                          </PrivateRoute>
                        }
                      />
                      
                      {/* Admin Routes */}
                      <Route
                        path="/admin/*"
                        element={
                          <AdminRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Admin />
                            </Suspense>
                          </AdminRoute>
                        }
                      />
                      
                      {/* Fallback route */}
                      <Route path="*" element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <NotFound />
                        </Suspense>
                      } />
                    </Routes>

                    {/* Footer appears on all pages */}
                    <Footer />

                    {/* Global floating chat window - lazy loaded */}
                    {isChatOpen && chatRecipient && (
                      <Suspense fallback={<div className="loading-chat">Loading chat...</div>}>
                        <EmbeddedChat recipient={chatRecipient} isOpen={isChatOpen} onClose={handleCloseChat} />
                      </Suspense>
                    )}

                    <ToastContainer
                      position="top-right"
                      autoClose={3000}
                      hideProgressBar={false}
                      newestOnTop={false}
                      closeOnClick
                      rtl={document.documentElement.dir === 'rtl'}
                      pauseOnFocusLoss
                      draggable
                      pauseOnHover
                      limit={5}
                      theme="colored"
                      className={document.documentElement.dir === 'rtl' ? 'rtl-layout Toastify__toast--rtl' : ''}
                    />
                  </div>
                </NotificationProvider>
              </StoriesProvider>
            </ChatConnectionProvider>
          </UserProvider>
        </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

// Export App directly. Ensure <Router> wraps it in main.jsx or index.js
export default App
