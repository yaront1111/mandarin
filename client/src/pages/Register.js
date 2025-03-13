import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, Alert } from '../components';
import { useAuth } from '../context';

const Register = () => {
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    password2: '',
    age: '',
    gender: '',
    location: ''
  });
  const [alert, setAlert] = useState(null);
  const { register, error, clearErrors, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { nickname, email, password, password2, age, gender, location } = formData;

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    if (error) {
      setAlert({ type: 'danger', message: error });
      clearErrors();
    }
  }, [error, isAuthenticated, clearErrors, navigate]);

  const onChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });
  const onSubmit = e => {
    e.preventDefault();
    if (password !== password2) {
      setAlert({ type: 'danger', message: 'Passwords do not match' });
    } else {
      register({
        nickname,
        email,
        password,
        details: {
          age: parseInt(age, 10),
          gender,
          location
        }
      });
    }
  };

  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-container">
        <h1>Create an Account</h1>
        {alert && (
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="nickname">Nickname</label>
            <input type="text" id="nickname" name="nickname" value={nickname} onChange={onChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" value={email} onChange={onChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" value={password} onChange={onChange} required minLength="6" />
          </div>
          <div className="form-group">
            <label htmlFor="password2">Confirm Password</label>
            <input type="password" id="password2" name="password2" value={password2} onChange={onChange} required minLength="6" />
          </div>
          <div className="form-group">
            <label htmlFor="age">Age</label>
            <input type="number" id="age" name="age" value={age} onChange={onChange} min="18" max="120" />
          </div>
          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <select id="gender" name="gender" value={gender} onChange={onChange}>
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input type="text" id="location" name="location" value={location} onChange={onChange} />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Register
          </button>
        </form>
        <p className="auth-redirect">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
};

export default Register;
