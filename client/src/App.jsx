"use client"

// client/src/App.jsx
import { useEffect, useState } from "react"
import { Routes, Route } from "react-router-dom"
import { ToastContainer } from "react-toastify"
import { HelmetProvider } from 'react-helmet-async'
import "react-toastify/dist/ReactToastify.css"

// --- Base Styles ---
import "./styles/base.css" // Base is usually imported in main.jsx, but keep if needed here too

// --- Styles to be addressed in later steps ---
import "./styles/pages.css"      // Step 3: Migrate to page/feature modules
import "./styles/notifications.css" // Step 3: Migrate to component modules (Notifications)
// import "./styles/utilities.css"; // REMOVED

import {
  AuthProvider,
  UserProvider,
  StoriesProvider,
  ThemeProvider,
  NotificationProvider,
  LanguageProvider
} from "./context"
import { ChatConnectionProvider } from "./context/ChatConnectionContext"
import { useNotificationNavigation } from "./services/notificationService"
import ErrorBoundary from "./components/ErrorBoundary.jsx"
import PrivateRoute from "./components/PrivateRoute.jsx"
import VerificationBanner from "./components/VerificationBanner.jsx"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import Profile from "./pages/Profile"
import Settings from "./pages/Settings.jsx"
import NotFound from "./pages/NotFound"
import Home from "./pages/Home"
import Messages from "./pages/Messages.jsx"
import Subscription from "./pages/Subscription"
import VerifyEmail from "./pages/VerifyEmail.jsx"
import About from "./pages/About"
import Safety from "./pages/Safety"
import Support from "./pages/Support"
import Terms from "./pages/Terms"
import Privacy from "./pages/Privacy"
import { EmbeddedChat, UserProfileModal } from "./components"

function App() {
  // initialize notification navigation hook
  useNotificationNavigation()

  const [chatRecipient, setChatRecipient] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [profileModalUserId, setProfileModalUserId] = useState(null)
  const isProfileModalOpen = Boolean(profileModalUserId)

  const openProfileModal = (userId) => {
    setProfileModalUserId(userId)
  }

  const closeProfileModal = () => {
    setProfileModalUserId(null)
  }

  useEffect(() => {
    const handleOpenChat = (event) => {
      const { recipient } = event.detail
      if (recipient && recipient._id) {
        setChatRecipient(recipient)
        setIsChatOpen(true)
        setTimeout(() => setIsChatOpen(true), 50)
      }
    }

    const handleLanguageDirectionChange = (event) => {
      document.body.classList.add('direction-changing')
      document.body.offsetHeight // force reflow
      setTimeout(() => document.body.classList.remove('direction-changing'), 50)

      const toastContainer = document.querySelector('.Toastify')
      if (toastContainer) {
        if (event.detail.isRTL) {
          toastContainer.classList.add('Toastify__toast--rtl')
        } else {
          toastContainer.classList.remove('Toastify__toast--rtl')
        }
      }
    }

    window.addEventListener("openChat", handleOpenChat)
    window.addEventListener("languageDirectionChanged", handleLanguageDirectionChange)
    return () => {
      window.removeEventListener("openChat", handleOpenChat)
      window.removeEventListener("languageDirectionChanged", handleLanguageDirectionChange)
    }
  }, [])

  const handleCloseChat = () => {
    setIsChatOpen(false)
  }

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <UserProvider>
                <ChatConnectionProvider>
                  <StoriesProvider>
                    <NotificationProvider
                      openProfileModal={openProfileModal}
                      closeProfileModal={closeProfileModal}
                    >
                      <div className="app-wrapper">
                        {/* Uses class from base.css */}
                        <VerificationBanner />

                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />
                          <Route path="/verify-email" element={<VerifyEmail />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/safety" element={<Safety />} />
                          <Route path="/support" element={<Support />} />
                          <Route path="/terms" element={<Terms />} />
                          <Route path="/privacy" element={<Privacy />} />
                          <Route
                            path="/dashboard"
                            element={<PrivateRoute><Dashboard /></PrivateRoute>}
                          />
                          <Route
                            path="/profile"
                            element={<PrivateRoute><Profile /></PrivateRoute>}
                          />
                          <Route
                            path="/messages"
                            element={<PrivateRoute><Messages /></PrivateRoute>}
                          />
                          <Route
                            path="/messages/:userId"
                            element={<PrivateRoute><Messages /></PrivateRoute>}
                          />
                          <Route
                            path="/settings"
                            element={<PrivateRoute><Settings /></PrivateRoute>}
                          />
                          <Route
                            path="/subscription"
                            element={<PrivateRoute><Subscription /></PrivateRoute>}
                          />
                          <Route path="*" element={<NotFound />} />
                        </Routes>

                        {isChatOpen && chatRecipient && (
                          <EmbeddedChat
                            recipient={chatRecipient}
                            isOpen={isChatOpen}
                            onClose={handleCloseChat}
                          />
                        )}

                        <UserProfileModal
                          userId={profileModalUserId}
                          isOpen={isProfileModalOpen}
                          onClose={closeProfileModal}
                        />

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
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App
