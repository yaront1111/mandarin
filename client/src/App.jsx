// client/src/App.jsx
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/utilities.css";
import "./styles/settings.css"; // Using regular CSS for settings
import "./styles/notifications.css";
import "./styles/stories.css"; // Using regular CSS for stories

import {
  AuthProvider,
  UserProvider,
  StoriesProvider,
  ThemeProvider,
  NotificationProvider,
} from "./context";
import { ChatConnectionProvider } from "./context/ChatConnectionContext";
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
import { EmbeddedChat } from "./components";

function App() {
  // Call the hook here to set up navigation for the notification service
  useInitializeNotificationServiceNavigation();
  
  // State for global chat component
  const [chatRecipient, setChatRecipient] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    // Listen for custom chat events
    const handleOpenChat = (event) => {
      console.log('openChat event received in App.jsx', event.detail);
      const { recipient } = event.detail;
      
      if (recipient && recipient._id) {
        console.log('Setting chat recipient and opening chat in App.jsx');
        setChatRecipient(recipient);
        setIsChatOpen(true);
        
        // Force the component to re-render with a slight delay
        setTimeout(() => {
          console.log('Forcing chat open state refresh');
          setIsChatOpen(true);
        }, 50);
      }
    };

    // Add the event listener
    window.addEventListener("openChat", handleOpenChat);

    // Test the event listener on mount in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Chat event handler registered in App.jsx');
    }

    return () => {
      window.removeEventListener("openChat", handleOpenChat);
    };
  }, []);

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  return (
    // ErrorBoundary and Providers remain the same
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <UserProvider>
            <ChatConnectionProvider>
                <StoriesProvider>
                  <NotificationProvider>
                    <div className="app-wrapper">
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
                      
                      {/* Global floating chat window */}
                      {isChatOpen && chatRecipient && (
                        <EmbeddedChat 
                          recipient={chatRecipient}
                          isOpen={isChatOpen}
                          onClose={handleCloseChat}
                        />
                      )}
                      
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
            </ChatConnectionProvider>
          </UserProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Export App directly. Ensure <Router> wraps it in main.jsx or index.js
export default App;
