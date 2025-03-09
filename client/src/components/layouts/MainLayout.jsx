// src/components/layouts/MainLayout.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/authSlice';

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col">
      {/* Header */}
      <header className="bg-bg-card shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center">
              <span className="text-white text-lg font-bold">M</span>
            </div>
            <span className="ml-2 text-xl font-bold text-text-primary">Mandarin</span>
          </div>

          <div className="flex items-center">
            {/* User dropdown */}
            <div className="relative ml-3">
              <div className="flex items-center">
                <button className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-brand-pink">
                  <div className="w-8 h-8 rounded-full bg-bg-input flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user?.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-text-primary">{user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  className="ml-4 px-3 py-1 text-sm bg-transparent border border-gray-700 text-text-secondary rounded-md hover:border-brand-pink hover:text-brand-pink transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-bg-card border-t border-gray-800 shadow-md fixed bottom-0 w-full z-10">
        <div className="max-w-md mx-auto px-4 py-2">
          <div className="flex justify-around">
            {/* Dashboard Link */}
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 ${isActive ? 'text-brand-pink' : 'text-text-secondary hover:text-brand-pink'}`
              }
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Home</span>
            </NavLink>

            {/* Discover Link */}
            <NavLink
              to="/discover"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 ${isActive ? 'text-brand-pink' : 'text-text-secondary hover:text-brand-pink'}`
              }
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs mt-1">Discover</span>
            </NavLink>

            {/* Messages Link */}
            <NavLink
              to="/messages"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 ${isActive ? 'text-brand-pink' : 'text-text-secondary hover:text-brand-pink'}`
              }
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-xs mt-1">Messages</span>
            </NavLink>

            {/* Profile Link */}
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 ${isActive ? 'text-brand-pink' : 'text-text-secondary hover:text-brand-pink'}`
              }
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs mt-1">Profile</span>
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-grow py-6 pb-20">
        {children}
      </main>
    </div>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired
};

export default MainLayout;
