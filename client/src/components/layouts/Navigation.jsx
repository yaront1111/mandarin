import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import { useSelector } from 'react-redux';

const Navigation = () => {
  const location = useLocation();
  const user = useSelector(state => state.auth.user);

  // Active link styling
  const getLinkClass = (path) => {
    const baseClass = "px-6 py-2 font-medium transition-colors";
    return location.pathname === path
      ? `${baseClass} text-brand-pink`
      : `${baseClass} text-text-primary hover:text-brand-pink`;
  };

  return (
    <nav className="h-16 bg-bg-card border-b border-gray-800 flex items-center justify-between px-6">
      {/* Logo */}
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center mr-3">
          <span className="text-white text-lg font-bold">M</span>
        </div>
        <span className="text-xl font-semibold">Mandarin</span>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center space-x-8">
        <Link to="/discover" className={getLinkClass("/discover")}>Discover</Link>
        <Link to="/matches" className={getLinkClass("/matches")}>Matches</Link>
        <Link to="/messages" className={getLinkClass("/messages")}>Messages</Link>
        <Link to="/stories" className={getLinkClass("/stories")}>Stories</Link>
      </div>

      {/* User Menu */}
      <div className="flex items-center">
        <Link to="/profile">
          <div className="relative">
            <Avatar
              src={user?.avatar}
              size={36}
              alt={user?.firstName || 'Profile'}
            />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-pink opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-pink"></span>
            </span>
          </div>
        </Link>
      </div>
    </nav>
  );
};

export default Navigation;
