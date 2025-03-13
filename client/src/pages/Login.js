// client/src/pages/Login.js - Fixed error handling
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, Alert } from '../components';
import { useAuth } from '../context';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [alert, setAlert] = useState(null);
  const { login, error, clearErrors, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { email, password } = formData;

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    if (error) {
      // Format the error to ensure it's a string
      const errorMessage = typeof error === 'object' ? 
                          (error.message || JSON.stringify(error)) : 
                          String(error);
      
      setAlert({ type: 'danger', message: errorMessage });
      clearErrors();
    }
  }, [error, isAuthenticated, clearErrors, navigate]);

  const onChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });
    
  const onSubmit = e => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-container">
        <h1>Login to Mandarin</h1>
        {alert && (
          <Alert 
            type={alert.type} 
            message={alert.message} 
            onClose={() => setAlert(null)} 
          />
        )}
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              value={email} 
              onChange={onChange} 
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              value={password} 
              onChange={onChange} 
              required 
              minLength="6" 
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Login
          </button>
        </form>
        <p className="auth-redirect">
          Don't have an account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  );
};

export default Login;
