// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Styles ---
import "./styles/base.css";
import "./styles/pages.css";
import "./styles/notifications.css";

import {
  AuthProvider,
  UserProvider,
  StoriesProvider,
  ThemeProvider,
  NotificationProvider,
  LanguageProvider
} from "./context";
import { ChatConnectionProvider } from "./context/ChatConnectionContext";
import { useNotificationNavigation } from "./services/notificationService";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import VerificationBanner from "./components/VerificationBanner.jsx";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Messages from "./pages/Messages.jsx";
import Subscription from "./pages/Subscription";
import VerifyEmail from "./pages/VerifyEmail.jsx";
// Import Footer and Navbar from common/ or components/
import Footer from "./components/Footer.jsx"; // Adjust path if needed
import { Navbar } from "./components/LayoutComponents"; // Navbar likely stays here
import { EmbeddedChat, UserProfileModal } from "./components";

function App() {
  useNotificationNavigation();

  const [chatRecipient, setChatRecipient] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const isProfileModalOpen = Boolean(profileModalUserId);

  const openProfileModal = (userId) => setProfileModalUserId(userId);
  const closeProfileModal = () => setProfileModalUserId(null);
  const handleCloseChat = () => setIsChatOpen(false);

  useEffect(() => {
    const handleOpenChat = (event) => {
      const { recipient } = event.detail; // Assuming recipient object is passed
      if (recipient?._id) {
        setChatRecipient(recipient);
        setIsChatOpen(true);
      }
    };

    const handleLanguageDirectionChange = (event) => {
      // Language direction change logic...
      document.body.classList.add('direction-changing');
      document.body.offsetHeight // force reflow
      setTimeout(() => document.body.classList.remove('direction-changing'), 50);
      const toastContainer = document.querySelector('.Toastify');
      if (toastContainer) {
        if (event.detail.isRTL) toastContainer.classList.add('Toastify__toast--rtl');
        else toastContainer.classList.remove('Toastify__toast--rtl');
      }
    };

    window.addEventListener("openChat", handleOpenChat);
    window.addEventListener("languageDirectionChanged", handleLanguageDirectionChange);
    return () => {
      window.removeEventListener("openChat", handleOpenChat);
      window.removeEventListener("languageDirectionChanged", handleLanguageDirectionChange);
    };
  }, []);

  return (
    <ErrorBoundary>
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
                    {/* Use a flex column layout to push footer down */}
                    <div className="app-container">
                       <Navbar /> {/* Render Navbar here */}
                       <VerificationBanner />
                       {/* Main content area that grows */}
                       <main className="main-content">
                          <Routes>
                            {/* Routes remain the same */}
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/verify-email" element={<VerifyEmail />} />
                            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                            <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
                            <Route path="/messages/:userId" element={<PrivateRoute><Messages /></PrivateRoute>} />
                            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                            <Route path="/subscription" element={<PrivateRoute><Subscription /></PrivateRoute>} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                       </main>

                       {/* Render Footer outside main content */}
                       <Footer />

                       {/* Modals and Overlays */}
                       {isChatOpen && chatRecipient && (
                         <EmbeddedChat recipient={chatRecipient} isOpen={isChatOpen} onClose={handleCloseChat} />
                       )}
                       <UserProfileModal userId={profileModalUserId} isOpen={isProfileModalOpen} onClose={closeProfileModal} />
                       <ToastContainer /* Props remain the same */
                         position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false}
                         closeOnClick rtl={document.documentElement.dir === 'rtl'} pauseOnFocusLoss draggable pauseOnHover limit={5}
                         theme="colored" className={document.documentElement.dir === 'rtl' ? 'rtl-layout Toastify__toast--rtl' : ''}
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
  );
}

export default App;
