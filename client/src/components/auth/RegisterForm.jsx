// src/components/auth/RegisterForm.jsx
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../../store/authSlice';

const RegisterForm = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    // etc.
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(registerUser(formData));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Email</label>
        <input
          type="email"
          name="email"
          className="border p-2 w-full"
          value={formData.email}
          onChange={handleChange}
        />
      </div>
      <div>
        <label>Password</label>
        <input
          type="password"
          name="password"
          className="border p-2 w-full"
          value={formData.password}
          onChange={handleChange}
        />
      </div>
      {/* Additional fields */}
      <div>
        <label>First Name</label>
        <input
          type="text"
          name="firstName"
          className="border p-2 w-full"
          value={formData.firstName}
          onChange={handleChange}
        />
      </div>
      <div>
        <label>Birth Date</label>
        <input
          type="date"
          name="birthDate"
          className="border p-2 w-full"
          value={formData.birthDate}
          onChange={handleChange}
        />
      </div>
      <div>
        <label>Gender</label>
        <select name="gender" className="border p-2 w-full" value={formData.gender} onChange={handleChange}>
          <option value="">Select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          {/* etc. */}
        </select>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};

export default RegisterForm;
