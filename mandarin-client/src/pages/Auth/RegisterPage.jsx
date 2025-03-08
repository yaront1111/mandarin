// src/pages/Auth/Register.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await authService.register(formData);
      console.log('Registered user:', data.user);
      navigate('/discover');
    } catch (err) {
      console.error('Register error:', err);
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>
      <main className="main flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Register</h1>
        <form onSubmit={handleSubmit} className="max-w-md w-full p-4 bg-gray-800 rounded-lg">
          <div className="mb-3">
            <label className="block mb-1 text-sm text-gray-400" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              className="w-full bg-gray-700 rounded-md border-0 p-2
                         focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1 text-sm text-gray-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full bg-gray-700 rounded-md border-0 p-2
                         focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 text-sm text-gray-400" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full bg-gray-700 rounded-md border-0 p-2
                         focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-2">{error}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full flex items-center justify-center"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={20} color="#FFFFFF" /> : 'Register'}
          </button>
        </form>
        <button
          className="mt-2 text-blue-400 text-sm"
          onClick={() => navigate('/login')}
        >
          Already have an account?
        </button>
      </main>
      <ErrorBoundary>
        <Navigation
          activeTab="profile"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>
    </div>
  );
}

export default RegisterPage;
