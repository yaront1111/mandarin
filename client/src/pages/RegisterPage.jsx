// src/pages/RegisterPage.jsx
import React from 'react';
import RegisterForm from '../components/auth/RegisterForm';

const RegisterPage = () => {
  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Register</h2>
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;
