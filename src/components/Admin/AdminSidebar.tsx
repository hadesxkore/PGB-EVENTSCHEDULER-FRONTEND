import React, { useState, useEffect } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import axios from 'axios';

import { getGlobalSocket } from '@/hooks/useSocket';

import { 

  LayoutDashboard, 

  Users, 

  Calendar, 

  CalendarDays, 

  CalendarPlus,

  Building2,

  Activity,

  Shield,
  Menu as MenuIcon,
  X as XIcon,

  ChevronLeft,

  ChevronRight,

  LogOut,

  List,

  FileText,

  Settings

} from 'lucide-react';



const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;



interface AdminSidebarProps {

  user?: {

    name: string;

    email: string;

    department: string;

    role?: string;

    avatar?: string;

  };

}



const AdminSidebar: React.FC<AdminSidebarProps> = ({ user }) => {

  // Use actual user data or fallback

  const currentUser = user || {

    name: "Admin User",

    email: "admin@bataan.gov.ph",

    department: "Administration",

    role: "admin"

  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [calendarEventCount, setCalendarEventCount] = useState(0);

  const [submittedEventsCount, setSubmittedEventsCount] = useState(0);

  const navigate = useNavigate();

  const location = useLocation();

  

  // Get user role from user prop or localStorage (normalized to lowercase)

  const getUserRole = (): string => {

    let role = 'admin'; // default

    

    if (user?.role) {

      role = user.role;

    } else {

      const userData = localStorage.getItem('userData');

      if (userData) {

        try {

          const parsed = JSON.parse(userData);

          role = parsed.role || 'admin';

        } catch {

          role = 'admin';

        }

      }

    }

    

    // Normalize to lowercase for consistent checking

    return role.toLowerCase();

  };

  

  const userRole = getUserRole();

  const isSuperAdmin = userRole === 'superadmin';

  

  // All navigation items

  const allNavigationItems = [

    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard', roles: ['superadmin'] },

    { icon: Calendar, label: 'All Events', href: '/admin/all-events', roles: ['superadmin'] },

    { icon: List, label: 'Overall Events', href: '/admin/overall-events', roles: ['superadmin'] },

    { icon: CalendarDays, label: 'Calendar', href: '/admin/calendar', roles: ['superadmin', 'admin'] },

    { icon: CalendarPlus, label: 'Request Event', href: '/users/request-event', roles: ['superadmin', 'admin'] },

    { icon: FileText, label: 'My Events', href: '/users/my-events', roles: ['superadmin', 'admin'] },

    { icon: FileText, label: 'Event Reports', href: '/admin/event-reports', roles: ['superadmin'] },

    { icon: Users, label: 'Users', href: '/admin/users', roles: ['superadmin'] },

    { icon: Activity, label: 'Users Logs', href: '/admin/users-logs', roles: ['superadmin'] },

    { icon: Building2, label: 'Departments', href: '/admin/departments', roles: ['superadmin'] },

    { icon: Settings, label: 'Settings', href: '/admin/settings', roles: ['superadmin'] },

  ];

  

  // Filter navigation items based on user role (case-insensitive)

  const navigationItems = allNavigationItems.filter(item => 

    item.roles.includes(userRole)

  );



  const handleNavigation = (href: string) => {

    navigate(href);

    // Auto-collapse sidebar after navigation for a cleaner workspace

    setIsCollapsed(true);

  };



  // Fetch calendar event count

  const fetchCalendarEventCount = async () => {

    try {

      const token = localStorage.getItem('authToken');

      const response = await axios.get(`${API_BASE_URL}/events`, {

        headers: {

          'Authorization': `Bearer ${token}`

        }

      });

      

      if (response.data.success) {

        const events = response.data.data || [];

        // Count all events except drafts (submitted, approved, rejected, cancelled, completed)

        const count = events.filter((event: any) => 

          event.status !== 'draft'

        ).length;

        setCalendarEventCount(count);

      }

    } catch (error) {

      console.error('Error fetching calendar event count:', error);

    }

  };



  // Fetch submitted events count (for All Events badge)

  const fetchSubmittedEventsCount = async () => {

    try {

      const token = localStorage.getItem('authToken');

      const response = await axios.get(`${API_BASE_URL}/events`, {

        headers: {

          'Authorization': `Bearer ${token}`

        }

      });

      

      if (response.data.success) {

        const events = response.data.data || [];

        // Count only submitted events

        const count = events.filter((event: any) => 

          event.status?.toLowerCase() === 'submitted'

        ).length;

        setSubmittedEventsCount(count);

      }

    } catch (error) {

      console.error('Error fetching submitted events count:', error);

    }

  };



  // Fetch count on mount and when location changes

  useEffect(() => {

    fetchCalendarEventCount();

    fetchSubmittedEventsCount();

    

    // Refresh every 30 seconds as fallback

    const interval = setInterval(() => {

      fetchCalendarEventCount();

      fetchSubmittedEventsCount();

    }, 30000);

    

    return () => clearInterval(interval);

  }, [location.pathname]);



  // Socket.IO real-time updates

  useEffect(() => {

    const socket = getGlobalSocket();

    

    if (!socket) {

      return;

    }



    const handleEventCreated = (data: any) => {

      fetchCalendarEventCount();

      fetchSubmittedEventsCount();

    };



    const handleEventUpdated = (data: any) => {

      fetchCalendarEventCount();

      fetchSubmittedEventsCount();

    };



    const handleEventDeleted = (data: any) => {

      fetchCalendarEventCount();

      fetchSubmittedEventsCount();

    };



    const handleEventStatusUpdated = (data: any) => {

      fetchCalendarEventCount();

      fetchSubmittedEventsCount();

    };



    // Remove existing listeners to prevent duplicates

    socket.off('event-created');

    socket.off('event-updated');

    socket.off('event-deleted');

    socket.off('event-status-updated');



    // Add listeners

    socket.on('event-created', handleEventCreated);

    socket.on('event-updated', handleEventUpdated);

    socket.on('event-deleted', handleEventDeleted);

    socket.on('event-status-updated', handleEventStatusUpdated);



    return () => {

      socket.off('event-created', handleEventCreated);

      socket.off('event-updated', handleEventUpdated);

      socket.off('event-deleted', handleEventDeleted);

      socket.off('event-status-updated', handleEventStatusUpdated);

    };

  }, []);



  const handleLogout = () => {

    // Clear authentication token and user data

    localStorage.removeItem('authToken');

    localStorage.removeItem('userData');

    

    // Navigate to login page or home

    navigate('/login');

  };



  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <XIcon className="h-5 w-5 text-gray-700" /> : <MenuIcon className="h-5 w-5 text-gray-700" />}
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`
          flex flex-col h-dvh bg-white border-r border-gray-100 transition-all duration-300
          w-64 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
          fixed top-0 left-0 z-50 lg:relative lg:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 py-5 relative shrink-0">
          <img
            src="/images/bataanlogo.png"
            alt="Bataan Logo"
            className="w-9 h-9 object-contain shrink-0"
          />
          <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <h2 className="text-sm font-semibold text-gray-900 truncate">Event Scheduler</h2>
            <p className="text-xs text-gray-400 truncate">Admin Panel</p>
          </div>
          {/* Toggle Button (desktop only) */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-200 hover:bg-gray-50 rounded-full shadow-sm"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Navigation Items (scrolls when the screen is short) */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 [scrollbar-width:thin] [scrollbar-color:#e5e7eb_transparent]">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            const isCalendar = item.href === '/admin/calendar';
            const isAllEvents = item.href === '/admin/all-events';
            const showCalendarBadge = isCalendar && calendarEventCount > 0;
            const showAllEventsBadge = isAllEvents && submittedEventsCount > 0;
            const badgeCount = showCalendarBadge ? calendarEventCount : showAllEventsBadge ? submittedEventsCount : 0;

            return (
              <Button
                key={index}
                variant="ghost"
                onClick={() => {
                  handleNavigation(item.href);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full h-10 rounded-lg text-sm transition-colors relative ${
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${isCollapsed ? 'lg:justify-center lg:px-0 justify-start gap-3 px-3' : 'justify-start gap-3 px-3'}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>

                {/* Badge (Calendar / All Events) */}
                {badgeCount > 0 && !isCollapsed && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold tabular-nums rounded-full min-w-[20px] h-[18px] flex items-center justify-center px-1.5">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </div>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Profile + Logout (always visible) */}
        <div className="shrink-0 border-t border-gray-100 p-3 space-y-1">
          <div className={`flex items-center rounded-lg ${isCollapsed ? 'lg:justify-center p-2' : 'gap-3 p-2'}`}>
            <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-gray-900 truncate">{currentUser.name}</p>
              <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }}
            className={`w-full h-9 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors ${
              isCollapsed ? 'lg:justify-center lg:px-0 justify-start gap-3 px-3' : 'justify-start gap-3 px-3'
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className={isCollapsed ? 'lg:hidden' : ''}>Logout</span>
          </Button>
        </div>
      </div>
    </>
  );
};

export default AdminSidebar;
