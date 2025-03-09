// src/components/auth/RegisterForm.jsx

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { registerUser, resetRegistrationSuccess } from '../../store/authSlice';

/**
 * Registration form component
 */
const RegisterForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, registrationSuccess } = useSelector((state) => state.auth);

  // Local form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    nickname: '',
    birthDate: '',
    gender: '',
    lookingFor: [],
  });

  // Local client-side error messages
  const [clientErrors, setClientErrors] = useState({});

  // Effect to handle successful registration
  useEffect(() => {
    if (registrationSuccess) {
      // Display success message - using alert as a fallback if toast isn't available
      if (typeof window !== 'undefined') {
        if (window.toast && window.toast.success) {
          window.toast.success('Registration successful! Please log in to continue.');
        } else {
          alert('Registration successful! Please log in to continue.');
        }
      }

      // Reset the success flag
      dispatch(resetRegistrationSuccess());

      // Redirect to login page after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    }
  }, [registrationSuccess, dispatch, navigate]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        lookingFor: [...prev.lookingFor, name],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        lookingFor: prev.lookingFor.filter((opt) => opt !== name),
      }));
    }
  };

  // Form validation and submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setClientErrors({});

    const newErrors = {};

    // Basic validations
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.nickname.trim()) {
      newErrors.nickname = 'Nickname is required';
    }
    if (!formData.birthDate) {
      newErrors.birthDate = 'Birth date is required';
    }
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    if (formData.lookingFor.length === 0) {
      newErrors.lookingFor = 'Select at least one option for "lookingFor"';
    }

    if (Object.keys(newErrors).length > 0) {
      setClientErrors(newErrors);
      return;
    }

    // Dispatch registration action
    dispatch(registerUser(formData));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-text-primary mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="example@domain.com"
          value={formData.email}
          onChange={handleChange}
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                     text-text-primary placeholder:text-text-secondary
                     focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        {clientErrors.email && (
          <p className="text-error text-sm mt-1">{clientErrors.email}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-text-primary mb-1">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={handleChange}
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                     text-text-primary placeholder:text-text-secondary
                     focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        {clientErrors.password && (
          <p className="text-error text-sm mt-1">{clientErrors.password}</p>
        )}
      </div>

      {/* First Name */}
      <div>
        <label htmlFor="firstName" className="block text-text-primary mb-1">
          First Name
        </label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          placeholder="John"
          value={formData.firstName}
          onChange={handleChange}
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                     text-text-primary placeholder:text-text-secondary
                     focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        {clientErrors.firstName && (
          <p className="text-error text-sm mt-1">{clientErrors.firstName}</p>
        )}
      </div>

      {/* Nickname */}
      <div>
        <label htmlFor="nickname" className="block text-text-primary mb-1">
          Nickname
        </label>
        <input
          type="text"
          id="nickname"
          name="nickname"
          placeholder="Your cool nickname"
          value={formData.nickname}
          onChange={handleChange}
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                     text-text-primary placeholder:text-text-secondary
                     focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        {clientErrors.nickname && (
          <p className="text-error text-sm mt-1">{clientErrors.nickname}</p>
        )}
      </div>

      {/* Birth Date */}
      <div>
        <label htmlFor="birthDate" className="block text-text-primary mb-1">
          Birth Date
        </label>
        <input
          type="date"
          id="birthDate"
          name="birthDate"
          value={formData.birthDate}
          onChange={handleChange}
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                     text-text-primary placeholder:text-text-secondary
                     focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        {clientErrors.birthDate && (
          <p className="text-error text-sm mt-1">{clientErrors.birthDate}</p>
        )}
      </div>

      {/* Gender */}
      <div>
        <label htmlFor="gender" className="block text-text-primary mb-1">
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          className="w-full p-2 bg-bg-input rounded border border-gray-700
                     text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-pink"
        >
          <option value="">Select your gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          {/* You can add "non-binary", "other", etc., if needed */}
        </select>
        {clientErrors.gender && (
          <p className="text-error text-sm mt-1">{clientErrors.gender}</p>
        )}
      </div>

      {/* lookingFor: Array of checkboxes */}
      <div>
        <p className="block text-text-primary mb-1">Looking For</p>
        <div className="flex flex-col space-y-2">
          {/* Option 1: 'sex' */}
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              name="sex"
              checked={formData.lookingFor.includes('sex')}
              onChange={handleCheckboxChange}
              className="form-checkbox h-4 w-4 text-brand-pink bg-bg-input border-gray-700
                         focus:ring-brand-pink focus:ring-2"
            />
            <span className="text-text-primary">Sex</span>
          </label>

          {/* Option 2: 'dating' */}
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              name="dating"
              checked={formData.lookingFor.includes('dating')}
              onChange={handleCheckboxChange}
              className="form-checkbox h-4 w-4 text-brand-pink bg-bg-input border-gray-700
                         focus:ring-brand-pink focus:ring-2"
            />
            <span className="text-text-primary">Dating</span>
          </label>

          {/* Option 3: 'all' */}
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              name="all"
              checked={formData.lookingFor.includes('all')}
              onChange={handleCheckboxChange}
              className="form-checkbox h-4 w-4 text-brand-pink bg-bg-input border-gray-700
                         focus:ring-brand-pink focus:ring-2"
            />
            <span className="text-text-primary">All</span>
          </label>
        </div>
        {clientErrors.lookingFor && (
          <p className="text-error text-sm mt-1">{clientErrors.lookingFor}</p>
        )}
      </div>

      {/* Server-side Errors (from Redux) */}
      {error && <p className="text-error text-center">{error}</p>}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-pink text-white py-2 rounded
                   hover:bg-opacity-90 transition-colors disabled:opacity-50
                   disabled:cursor-not-allowed"
      >
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};

export default RegisterForm;
