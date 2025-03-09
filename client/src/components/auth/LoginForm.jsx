// src/components/auth/LoginForm.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../../store/authSlice';

const LoginForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, user, token } = useSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Add this effect to handle successful login
  useEffect(() => {
    // If we have a user and token, user is authenticated
    if (user && token) {
      // Redirect to the dashboard or home page
      navigate('/dashboard'); // Change this to your desired route
      console.log('Login successful, redirecting...');
    }
  }, [user, token, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-text-primary mb-1">Email</label>
        <input
          type="email"
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                   text-text-primary placeholder:text-text-secondary
                   focus:outline-none focus:ring-1 focus:ring-brand-pink"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-text-primary mb-1">Password</label>
        <input
          type="password"
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                   text-text-primary placeholder:text-text-secondary
                   focus:outline-none focus:ring-1 focus:ring-brand-pink"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-error text-center">{error}</p>}
      <button
        type="submit"
        className="w-full bg-brand-pink text-white py-2 rounded
                 hover:bg-opacity-90 transition-colors disabled:opacity-50
                 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

export default LoginForm;
