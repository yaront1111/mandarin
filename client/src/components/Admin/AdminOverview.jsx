import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import { FaUsers, FaUserCheck, FaImage, FaComment, FaEnvelope, FaCreditCard, FaExclamationTriangle } from 'react-icons/fa';
import { adminService } from '../../services';

const AdminOverview = ({ stats, loading }) => {
  const [userStats, setUserStats] = useState(null);
  const [contentStats, setContentStats] = useState(null);
  const [messagingStats, setMessagingStats] = useState(null);
  const [loadingDetailStats, setLoadingDetailStats] = useState(true);

  useEffect(() => {
    const fetchDetailedStats = async () => {
      try {
        // Fetch additional stats in parallel
        const [userStatsRes, contentStatsRes, messagingStatsRes] = await Promise.all([
          adminService.getUserStats(),
          adminService.getContentStats(),
          adminService.getMessagingStats()
        ]);

        if (userStatsRes.success) {
          setUserStats(userStatsRes.data);
        }
        
        if (contentStatsRes.success) {
          setContentStats(contentStatsRes.data);
        }
        
        if (messagingStatsRes.success) {
          setMessagingStats(messagingStatsRes.data);
        }
      } catch (error) {
        console.error('Error fetching detailed stats:', error);
      } finally {
        setLoadingDetailStats(false);
      }
    };

    fetchDetailedStats();
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="admin-overview">
      <h1>Dashboard Overview</h1>
      
      {/* Summary Stats */}
      <div className="admin-stats-grid">
        <div className="admin-stat">
          <div className="admin-stat-icon">
            <FaUsers />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-title">Total Users</div>
            <div className="admin-stat-value">{stats?.totalUsers || 0}</div>
            {stats?.userGrowth && (
              <div className={`admin-stat-trend ${stats.userGrowth > 0 ? 'positive' : 'negative'}`}>
                {stats.userGrowth > 0 ? '↑' : '↓'} {Math.abs(stats.userGrowth)}% from last month
              </div>
            )}
          </div>
        </div>

        <div className="admin-stat">
          <div className="admin-stat-icon">
            <FaUserCheck />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-title">Active Users</div>
            <div className="admin-stat-value">{stats?.activeUsers || 0}</div>
            <div className="admin-stat-subtitle">Last 7 days</div>
          </div>
        </div>

        <div className="admin-stat">
          <div className="admin-stat-icon">
            <FaImage />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-title">Photos Pending Review</div>
            <div className="admin-stat-value">{stats?.pendingPhotos || 0}</div>
          </div>
        </div>

        <div className="admin-stat">
          <div className="admin-stat-icon">
            <FaComment />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-title">Messages (24h)</div>
            <div className="admin-stat-value">{stats?.recentMessages || 0}</div>
          </div>
        </div>

        <div className="admin-stat">
          <div className="admin-stat-icon">
            <FaExclamationTriangle />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-title">Reports</div>
            <div className="admin-stat-value">{stats?.pendingReports || 0}</div>
            <div className="admin-stat-subtitle">Pending review</div>
          </div>
        </div>

        <div className="admin-stat">
          <div className="admin-stat-icon">
            <FaCreditCard />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-title">Paid Subscriptions</div>
            <div className="admin-stat-value">{stats?.paidUsers || 0}</div>
            <div className="admin-stat-subtitle">
              {stats?.paidPercentage ? `${stats.paidPercentage}% of users` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Sections */}
      <div className="admin-cards-container">
        {/* User Statistics */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>User Statistics</h3>
          </div>
          <div className="admin-card-body">
            {loadingDetailStats ? (
              <div className="admin-loading-inline">Loading user stats...</div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User Metric</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>New users (today)</td>
                      <td>{userStats?.newToday || 0}</td>
                    </tr>
                    <tr>
                      <td>New users (this week)</td>
                      <td>{userStats?.newThisWeek || 0}</td>
                    </tr>
                    <tr>
                      <td>Verified users</td>
                      <td>{userStats?.verified || 0}</td>
                    </tr>
                    <tr>
                      <td>Unverified users</td>
                      <td>{userStats?.unverified || 0}</td>
                    </tr>
                    <tr>
                      <td>Male users</td>
                      <td>{userStats?.maleUsers || 0}</td>
                    </tr>
                    <tr>
                      <td>Female users</td>
                      <td>{userStats?.femaleUsers || 0}</td>
                    </tr>
                    <tr>
                      <td>Couple accounts</td>
                      <td>{userStats?.coupleUsers || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Content Statistics */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Content Statistics</h3>
          </div>
          <div className="admin-card-body">
            {loadingDetailStats ? (
              <div className="admin-loading-inline">Loading content stats...</div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Content Metric</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total photos</td>
                      <td>{contentStats?.totalPhotos || 0}</td>
                    </tr>
                    <tr>
                      <td>Approved photos</td>
                      <td>{contentStats?.approvedPhotos || 0}</td>
                    </tr>
                    <tr>
                      <td>Rejected photos</td>
                      <td>{contentStats?.rejectedPhotos || 0}</td>
                    </tr>
                    <tr>
                      <td>Total stories</td>
                      <td>{contentStats?.totalStories || 0}</td>
                    </tr>
                    <tr>
                      <td>Active stories</td>
                      <td>{contentStats?.activeStories || 0}</td>
                    </tr>
                    <tr>
                      <td>Total reports</td>
                      <td>{contentStats?.totalReports || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Messaging Statistics */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Messaging Statistics</h3>
          </div>
          <div className="admin-card-body">
            {loadingDetailStats ? (
              <div className="admin-loading-inline">Loading messaging stats...</div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Messaging Metric</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Messages today</td>
                      <td>{messagingStats?.messagesCount?.today || 0}</td>
                    </tr>
                    <tr>
                      <td>Messages this week</td>
                      <td>{messagingStats?.messagesCount?.week || 0}</td>
                    </tr>
                    <tr>
                      <td>Messages this month</td>
                      <td>{messagingStats?.messagesCount?.month || 0}</td>
                    </tr>
                    <tr>
                      <td>Active conversations</td>
                      <td>{messagingStats?.activeConversations || 0}</td>
                    </tr>
                    <tr>
                      <td>Avg. response time</td>
                      <td>{messagingStats?.avgResponseTime || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;