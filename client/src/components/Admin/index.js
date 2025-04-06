// Export all Admin components
import '../../styles/admin.css';
import AdminOverview from './AdminOverview';
import AdminUserManagement from './AdminUserManagement';
import AdminContentModeration from './AdminContentModeration';
import AdminReports from './AdminReports';
import AdminSubscriptions from './AdminSubscriptions';
import AdminSettings from './AdminSettings';
import AdminAuditLogs from './AdminAuditLogs';
import AdminCommunications from './AdminCommunications';
import AdminLayout from './AdminLayout';

export {
  AdminOverview,
  AdminUserManagement,
  AdminContentModeration,
  AdminReports, 
  AdminSubscriptions,
  AdminSettings,
  AdminAuditLogs,
  AdminCommunications,
  AdminLayout
};

// Default export for convenience
export default {
  Overview: AdminOverview,
  UserManagement: AdminUserManagement,
  ContentModeration: AdminContentModeration,
  Reports: AdminReports,
  Subscriptions: AdminSubscriptions,
  Settings: AdminSettings,
  AuditLogs: AdminAuditLogs,
  Communications: AdminCommunications,
  Layout: AdminLayout
};