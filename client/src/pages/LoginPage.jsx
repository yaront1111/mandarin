// src/pages/LoginPage.jsx
import React from 'react';
import LoginForm from '../components/auth/LoginForm';

const LoginPage = () => {
  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <LoginForm />
    </div>
  );
};

export default LoginPage;
