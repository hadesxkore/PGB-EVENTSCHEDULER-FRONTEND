import React, { useEffect, useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminNotificationSystem from './AdminNotificationSystem';

interface AdminMainLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    department: string;
    avatar?: string;
  };
}

const AdminMainLayout: React.FC<AdminMainLayoutProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setCurrentUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  return (
    <div className="flex h-dvh bg-gray-50 overflow-hidden">
      <AdminNotificationSystem />
      <AdminSidebar user={currentUser} />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
};

export default AdminMainLayout;
