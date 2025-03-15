"use client"

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import "./styles/main.css"
import "./styles/stories.css" // Import stories styles

import { AuthProvider, UserProvider, ChatProvider, StoriesProvider } from "./context"
import PrivateRoute from "./components/PrivateRoute.jsx"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import UserProfile from "./pages/UserProfile"
import Profile from "./pages/Profile"
import Settings from "./pages/Settings.jsx"
import NotFound from "./pages/NotFound"

function App() {
  return (
    <Router>
      <AuthProvider>
        <UserProvider>
          <ChatProvider>
            <StoriesProvider>
              {" "}
              {/* Add StoriesProvider */}
              <div className="app">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/dashboard"
                    element={
                      <PrivateRoute>
                        <Dashboard />
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
                  <Route
                    path="/profile"
                    element={
                      <PrivateRoute>
                        <Profile />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <PrivateRoute>
                        <Settings />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <ToastContainer
                  position="top-right"
                  autoClose={3000}
                  hideProgressBar={false}
                  closeOnClick
                  pauseOnHover
                />
              </div>
            </StoriesProvider>
          </ChatProvider>
        </UserProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
