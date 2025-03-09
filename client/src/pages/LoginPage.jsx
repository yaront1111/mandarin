// src/pages/LoginPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Welcome Back</h1>
          <p className="text-text-secondary mt-2">Sign in to continue your journey</p>
        </div>

        <div className="bg-bg-card rounded-xl p-8 shadow-lg">
          <LoginForm />

          <div className="mt-6 text-center">
            <p className="text-text-secondary">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-brand-pink hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-text-secondary text-sm">
          <p>By signing in, you agree to our</p>
          <p>
            <Link to="/terms" className="hover:text-brand-pink transition-colors">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy" className="hover:text-brand-pink transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
