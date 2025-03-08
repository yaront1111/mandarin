// src/pages/Admin/UserManagement.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

import { adminService } from '../../services/adminService';

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const data = await adminService.getAllUsers();
        setUsers(data);
      } catch (err) {
        console.error('Error loading users:', err);
        setError('Failed to load user list.');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBanUser = async (userId) => {
    if (!window.confirm('Are you sure you want to ban this user?')) return;
    try {
      await adminService.banUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      console.error('Error banning user:', err);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <Header />
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main">
        <h1 className="text-xl font-bold mb-4">User Management</h1>

        <div className="relative mb-4">
          <input
            type="text"
            className="w-full bg-gray-800 rounded-lg border-0 py-2 pl-4 pr-4
                       focus:outline-none focus:ring-1 focus:ring-pink-500"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-gray-400 text-center">No users found</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-800">
                  <td className="py-2">{user.name}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">{user.role}</td>
                  <td className="py-2">
                    <button
                      className="btn btn-danger text-sm"
                      onClick={() => handleBanUser(user.id)}
                    >
                      Ban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
      <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
}

export default UserManagement;
