"use client"

// client/src/App.js
import { useEffect } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Home, Login, Register, Dashboard, Profile, UserProfile, NotFound } from "./pages"
import { PrivateRoute } from "./components"
import "./utils/apiDebugger"
import { AuthProvider, UserProvider, ChatProvider, useAuth } from "./context"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import "./App.css"

// Apply React Router future flags if available
if (typeof window !== "undefined") {
  window.__reactRouterFutureFlags = window.__reactRouterFutureFlags || {}
  window.__reactRouterFutureFlags.v7_startTransition = true
  window.__reactRouterFutureFlags.v7_relativeSplatPath = true
}

const AppInitializer = ({ children }) => {
  const { getCurrentUser } = useAuth()

  useEffect(() => {
    // Load token from sessionStorage and set it in apiService
    const token = sessionStorage.getItem("token")
    if (token) {
      getCurrentUser()
    }
  }, [getCurrentUser])

  return children
}

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <ChatProvider>
          <Router>
            <AppInitializer>
              <div className="dating-app">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Protected Routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <PrivateRoute>
                        <Dashboard />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <PrivateRoute>
                        <Profile />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/user/:id"
                    element={
                      <PrivateRoute>
                        <UserProfile />
                      </PrivateRoute>
                    }
                  />

                  {/* Fallback Route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                />
              </div>
            </AppInitializer>
          </Router>
        </ChatProvider>
      </UserProvider>
    </AuthProvider>
  )
}

export default App
