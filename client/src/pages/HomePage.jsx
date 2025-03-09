// src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import OnlineUsersGrid from '../components/online/OnlineUsersGrid';

export default function HomePage() {
  const isAuthenticated = useSelector(state => state.auth.token !== null);

  return (
    <div className="min-h-screen bg-bg-dark text-white">
      {/* Hero Section */}
      <div className="relative h-screen">
        {/* Background with overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple to-brand-pink opacity-10"></div>

        {/* Dark diagonal overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-dark via-transparent to-bg-dark"></div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-center">
          <div className="max-w-2xl">
            {/* Logo */}
            <div className="flex items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center mr-4">
                <span className="text-white text-3xl font-bold">M</span>
              </div>
              <h1 className="text-5xl font-bold">Mandarin</h1>
            </div>

            {/* Tagline */}
            <h2 className="text-4xl font-semibold leading-tight mb-4">
              Discover Connections That <span className="text-brand-pink">Match Your Desires</span>
            </h2>

            <p className="text-xl text-gray-300 mb-8">
              Join our exclusive community where meaningful connections come to life. Find matches based on compatibility, interests, and chemistry.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              {isAuthenticated ? (
                <Link
                  to="/discover"
                  className="bg-brand-pink hover:bg-opacity-90 text-white font-semibold py-3 px-8 rounded-full transition-colors"
                >
                  Start Discovering
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="bg-brand-pink hover:bg-opacity-90 text-white font-semibold py-3 px-8 rounded-full transition-colors"
                  >
                    Join Now
                  </Link>
                  <Link
                    to="/login"
                    className="border-2 border-brand-pink text-brand-pink hover:bg-brand-pink hover:bg-opacity-10 font-semibold py-3 px-8 rounded-full transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white opacity-70"
          >
            <path
              d="M12 5L12 19M12 19L19 12M12 19L5 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Online Users Grid (visible when not authenticated) */}
      {!isAuthenticated && (
        <div className="container mx-auto px-6 py-12">
          <OnlineUsersGrid />
        </div>
      )}
      
      {/* Features Section */}
      <div className="container mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-16">Why Choose Mandarin</h2>
        
        <div className="grid md:grid-cols-3 gap-12">
          {/* Feature 1 */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-brand-pink"
              >
                <path 
                  d="M19.5 12.5719L12 19.9999L4.5 12.5719C2.5 10.5719 2.5 7.07192 4.5 5.07192C6.5 3.07192 10 3.07192 12 5.07192C14 3.07192 17.5 3.07192 19.5 5.07192C21.5 7.07192 21.5 10.5719 19.5 12.5719Z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Smart Matching</h3>
            <p className="text-gray-400">
              Our advanced algorithm analyzes compatibility across 25+ dimensions to find your perfect matches.
            </p>
          </div>
          
          {/* Feature 2 */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-brand-pink"
              >
                <path 
                  d="M8 12H16M8 12C8 15.3137 10.6863 18 14 18C17.3137 18 20 15.3137 20 12C20 8.68629 17.3137 6 14 6C10.6863 6 8 8.68629 8 12ZM8 12H4" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Private Sharing</h3>
            <p className="text-gray-400">
              Securely share private content with trusted connections. You control who sees what.
            </p>
          </div>
          
          {/* Feature 3 */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-brand-pink bg-opacity-10 rounded-full flex items-center justify-center">
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-brand-pink"
              >
                <path 
                  d="M9 12.75L11.25 15L15 9.75M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21Z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Verified Profiles</h3>
            <p className="text-gray-400">
              Connect with confidence knowing our members go through a thorough verification process.
            </p>
          </div>
        </div>
      </div>
      
      {/* Testimonials Section */}
      <div className="bg-bg-card py-24">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">Success Stories</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-bg-dark p-8 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-brand-pink to-brand-purple rounded-full mr-4"></div>
                <div>
                  <h4 className="font-semibold">Sarah & Michael</h4>
                  <p className="text-sm text-gray-400">Matched for 8 months</p>
                </div>
              </div>
              <p className="text-gray-300 italic">
                &quot;Mandarin introduced us through its amazing compatibility system. We had a 94% match score and it shows! We&apos;ve never connected with anyone so deeply before.&quot;
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-bg-dark p-8 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-brand-pink to-brand-purple rounded-full mr-4"></div>
                <div>
                  <h4 className="font-semibold">David & Emma</h4>
                  <p className="text-sm text-gray-400">Matched for 1 year</p>
                </div>
              </div>
              <p className="text-gray-300 italic">
                &quot;I was skeptical at first but Mandarin&apos;s private photo feature allowed us to build trust gradually. Now we&apos;re celebrating our one-year anniversary!&quot;
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-bg-dark py-12 border-t border-gray-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center mr-3">
                <span className="text-white text-lg font-bold">M</span>
              </div>
              <span className="text-xl font-semibold">Mandarin</span>
            </div>

            <div className="text-center md:text-right text-sm text-gray-400">
              <p>© {new Date().getFullYear()} Mandarin Dating. All rights reserved.</p>
              <p className="mt-1">Privacy Policy • Terms of Service • Community Guidelines</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
