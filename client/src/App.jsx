// client/src/App.jsx
import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"; // Removed useNavigate, not needed here directly
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/utilities.css";
import "./styles/settings.css";
import "./styles/notifications.css";

import {
  AuthProvider,
  UserProvider,
  ChatProvider,
  StoriesProvider,
  ThemeProvider,
  NotificationProvider,
} from "./context";
// Correctly import the named hook
import { useInitializeNotificationServiceNavigation } from "./services/notificationService.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import UserProfile from "./pages/UserProfile";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Messages from "./pages/Messages.jsx";
import Subscription from "./pages/Subscription";

function App() {
  // Call the hook here to set up navigation for the notification service
  useInitializeNotificationServiceNavigation();

  return (
    // ErrorBoundary and Providers remain the same
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <UserProvider>
            <ChatProvider>
              <StoriesProvider>
                <NotificationProvider>
                  <div className="app">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/dashboard" element={ <PrivateRoute><Dashboard /></PrivateRoute> } />
                      <Route path="/user/:id" element={ <PrivateRoute><UserProfile /></PrivateRoute> } />
                      <Route path="/profile" element={ <PrivateRoute><Profile /></PrivateRoute> } />
                      <Route path="/messages" element={ <PrivateRoute><Messages /></PrivateRoute> } />
                      <Route path="/messages/:userId" element={ <PrivateRoute><Messages /></PrivateRoute> } />
                      <Route path="/settings" element={ <PrivateRoute><Settings /></PrivateRoute> } />
                      <Route path="/subscription" element={ <PrivateRoute><Subscription /></PrivateRoute> } />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <ToastContainer
                      position="top-right"
                      autoClose={3000}
                      hideProgressBar={false}
                      newestOnTop={false}
                      closeOnClick
                      rtl={false}
                      pauseOnFocusLoss
                      draggable
                      pauseOnHover
                      limit={5}
                      theme="colored"
                    />
                  </div>
                </NotificationProvider>
              </StoriesProvider>
            </ChatProvider>
          </UserProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Export App directly. Ensure <Router> wraps it in main.jsx or index.js
export default App;
