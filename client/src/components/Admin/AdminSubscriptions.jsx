import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import AdminLayout from './AdminLayout';

const AdminSubscriptions = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    activeSubscribers: 0,
    expiredSubscribers: 0,
    trialSubscribers: 0,
    monthlyRevenue: 0,
    annualRevenue: 0,
    conversionRate: 0
  });
  
  // Mock subscription data
  useEffect(() => {
    const fetchData = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate mock subscription stats
      const mockStats = {
        totalSubscribers: Math.floor(Math.random() * 500) + 200,
        activeSubscribers: Math.floor(Math.random() * 300) + 150,
        expiredSubscribers: Math.floor(Math.random() * 100) + 50,
        trialSubscribers: Math.floor(Math.random() * 50) + 20,
        monthlyRevenue: Math.floor(Math.random() * 5000) + 2000,
        annualRevenue: Math.floor(Math.random() * 50000) + 20000,
        conversionRate: Math.floor(Math.random() * 20) + 10
      };
      
      // Generate mock subscriptions
      const plans = ['monthly', 'annual', 'premium', 'trial'];
      const statuses = ['active', 'expired', 'cancelled', 'trial'];
      const paymentMethods = ['Credit Card', 'PayPal', 'Apple Pay', 'Google Pay'];
      
      const mockSubscriptions = Array.from({ length: 50 }, (_, i) => {
        const planType = plans[Math.floor(Math.random() * plans.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        const startDate = new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000));
        
        let endDate = new Date(startDate);
        if (planType === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (planType === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else if (planType === 'premium') {
          endDate.setMonth(endDate.getMonth() + 3);
        } else {
          // Trial period is 7 days
          endDate.setDate(endDate.getDate() + 7);
        }
        
        // If expired or cancelled, set end date in the past
        if (status === 'expired' || status === 'cancelled') {
          endDate = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
        }
        
        const amount = planType === 'monthly' ? 9.99 : 
                      planType === 'annual' ? 99.99 : 
                      planType === 'premium' ? 19.99 : 0;
        
        return {
          id: `sub-${i + 1000}`,
          userId: `user-${i + 1000}`,
          userEmail: `user${i + 1000}@example.com`,
          userName: `User ${i + 1000}`,
          planType,
          status,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          amount,
          paymentMethod,
          autoRenew: status === 'active' && Math.random() > 0.3,
          lastPaymentDate: status === 'active' ? 
            new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString() : 
            null,
          nextPaymentDate: status === 'active' ? 
            new Date(Date.now() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString() : 
            null
        };
      });
      
      setStats(mockStats);
      setSubscriptions(mockSubscriptions);
      setLoading(false);
    };
    
    fetchData();
  }, []);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active': return 'admin-status-badge active';
      case 'trial': return 'admin-status-badge verified';
      case 'expired': return 'admin-status-badge inactive';
      case 'cancelled': return 'admin-status-badge unverified';
      default: return 'admin-status-badge';
    }
  };
  
  const getPlanLabel = (planType) => {
    switch (planType) {
      case 'monthly': return 'Monthly Plan';
      case 'annual': return 'Annual Plan';
      case 'premium': return 'Premium Plan';
      case 'trial': return 'Free Trial';
      default: return planType;
    }
  };

  return (
    <AdminLayout title="Subscription Management">
      {loading ? (
        <div className="admin-loading">
          <div className="spinner"></div>
          <p>Loading subscription data...</p>
        </div>
      ) : (
        <>
          {/* Subscription Statistics */}
          <div className="admin-stats-grid">
            <div className="admin-stat">
              <div className="admin-stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="admin-stat-content">
                <div className="admin-stat-title">Total Subscribers</div>
                <div className="admin-stat-value">{stats.totalSubscribers}</div>
                <div className="admin-stat-subtitle">Across all plans</div>
              </div>
            </div>
            
            <div className="admin-stat">
              <div className="admin-stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="admin-stat-content">
                <div className="admin-stat-title">Active Subscribers</div>
                <div className="admin-stat-value">{stats.activeSubscribers}</div>
                <div className="admin-stat-subtitle">{Math.floor(stats.activeSubscribers/stats.totalSubscribers*100)}% of total users</div>
              </div>
            </div>
            
            <div className="admin-stat">
              <div className="admin-stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.05 11C3.01722 11.3304 3 11.6644 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C8.31535 3 5.11546 5.14749 3.72447 8.26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 3L3 8L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="admin-stat-content">
                <div className="admin-stat-title">Trial Users</div>
                <div className="admin-stat-value">{stats.trialSubscribers}</div>
                <div className="admin-stat-subtitle">Conversion rate: {stats.conversionRate}%</div>
              </div>
            </div>
            
            <div className="admin-stat">
              <div className="admin-stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="admin-stat-content">
                <div className="admin-stat-title">Monthly Revenue</div>
                <div className="admin-stat-value">{formatCurrency(stats.monthlyRevenue)}</div>
                <div className="admin-stat-subtitle">Annual: {formatCurrency(stats.annualRevenue)}</div>
              </div>
            </div>
          </div>
          
          {/* Subscription Table */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Active Subscriptions</h3>
              <div className="admin-filters">
                <input
                  type="text"
                  placeholder="Search subscriptions..."
                  className="admin-input"
                />
                <select className="admin-select">
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select className="admin-select">
                  <option value="all">All Plans</option>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="premium">Premium</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
            </div>
            <div className="admin-card-body">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Amount</th>
                      <th>Payment Method</th>
                      <th>Auto-Renew</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td>
                          <div className="admin-user-info">
                            <span className="admin-user-name">{subscription.userName}</span>
                            <span className="admin-user-id">{subscription.userEmail}</span>
                          </div>
                        </td>
                        <td>{getPlanLabel(subscription.planType)}</td>
                        <td>
                          <span className={getStatusBadgeClass(subscription.status)}>
                            {subscription.status}
                          </span>
                        </td>
                        <td>{formatDate(subscription.startDate)}</td>
                        <td>{formatDate(subscription.endDate)}</td>
                        <td>{formatCurrency(subscription.amount)}</td>
                        <td>{subscription.paymentMethod}</td>
                        <td>{subscription.autoRenew ? 'Yes' : 'No'}</td>
                        <td>
                          <div className="admin-actions">
                            <button className="admin-action-button view" title="View details">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            {subscription.status === 'active' && (
                              <button className="admin-action-button inactive" title="Cancel subscription">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="admin-pagination">
                <div className="admin-pagination-info">
                  Showing 50 of {stats.totalSubscribers} subscriptions
                </div>
                <div className="admin-pagination-controls">
                  <button disabled>First</button>
                  <button disabled>Previous</button>
                  <span className="admin-pagination-current">Page 1 of 1</span>
                  <button disabled>Next</button>
                  <button disabled>Last</button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Subscription Plans */}
          <div className="admin-card" style={{ marginTop: '1.5rem' }}>
            <div className="admin-card-header">
              <h3>Subscription Plans</h3>
              <button className="admin-button admin-button-outline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Add New Plan
              </button>
            </div>
            <div className="admin-card-body">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Features</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Free Trial</td>
                      <td>7-day free trial with limited features</td>
                      <td>$0.00</td>
                      <td>7 days</td>
                      <td>
                        <span className="admin-status-badge active">Active</span>
                      </td>
                      <td>Basic messaging, Limited browsing</td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-action-button view" title="Edit plan">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Monthly Plan</td>
                      <td>Standard monthly subscription</td>
                      <td>$9.99</td>
                      <td>1 month</td>
                      <td>
                        <span className="admin-status-badge active">Active</span>
                      </td>
                      <td>Unlimited messaging, Full browsing, Photo sharing</td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-action-button view" title="Edit plan">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Annual Plan</td>
                      <td>Annual subscription with discount</td>
                      <td>$99.99</td>
                      <td>12 months</td>
                      <td>
                        <span className="admin-status-badge active">Active</span>
                      </td>
                      <td>All monthly features, Priority support, Profile boost</td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-action-button view" title="Edit plan">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Premium Plan</td>
                      <td>Premium features for serious users</td>
                      <td>$19.99</td>
                      <td>1 month</td>
                      <td>
                        <span className="admin-status-badge active">Active</span>
                      </td>
                      <td>All annual features, Video calls, Advanced filters</td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-action-button view" title="Edit plan">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminSubscriptions;