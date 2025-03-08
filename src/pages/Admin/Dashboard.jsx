// src/pages/Admin/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';

import { adminService } from '../../services/adminService';

function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await adminService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Error loading admin dashboard:', err);
        setError('Failed to load dashboard stats.');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

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

  if (error) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main">
        <h1 className="text-xl font-bold mb-4">Admin Dashboard</h1>
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-md">
              <h2 className="text-sm text-gray-400 mb-1">Total Users</h2>
              <p className="text-xl font-bold">{stats.totalUsers}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-md">
              <h2 className="text-sm text-gray-400 mb-1">Active Today</h2>
              <p className="text-xl font-bold">{stats.activeToday}</p>
            </div>
            {/* Additional stats */}
          </div>
        )}
      </main>
      <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
}

export default AdminDashboard;
