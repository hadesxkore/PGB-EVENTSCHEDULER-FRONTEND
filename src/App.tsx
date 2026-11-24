import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import GlobalNotificationSystem from './components/GlobalNotificationSystem'
import LoginForm from './components/LoginForm'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/Users/MainLayout'
import Dashboard from './components/Users/Dashboard'
import RequestEventPage from './components/Users/RequestEventPage'
import MyEventsPage from './components/Users/MyEventsPage'
import MyCalendarPage from './components/Users/MyCalendarPage'
import MyRequirementsPage from './components/Users/MyRequirementsPage'
import ManageLocationPage from './components/Users/ManageLocationPage'
import MessagesPage from './components/Users/MessagesPage'
import TaggedDepartmentPage from './components/Users/TaggedDepartmentPage'
import UserAllEventsPage from './components/Users/AllEventsPage'
import EventReportsPage from './components/Users/EventReportsPage'
import RequestEventGuidePage from './components/Users/RequestEventGuidePage'
import LocationAvailabilityCalendarPage from './components/Users/LocationAvailabilityCalendarPage'
import BacRequestsPage from './components/Users/BacRequestsPage'
import PitoEquipmentAvailabilityPage from './components/Users/PitoEquipmentAvailabilityPage'
import AdminMainLayout from './components/Admin/AdminMainLayout'
import AdminDashboard from './components/Admin/AdminDashboard'
import AllEventsPage from './components/Admin/AllEventsPage'
import OverallEventsPage from './components/Admin/OverallEventsPage'
import AdminCalendarPage from './components/Admin/CalendarPage'
import UsersManagement from './components/Admin/UsersManagement'
import UsersLogsPage from './components/Admin/UsersLogsPage'
import DepartmentsManagement from './components/Admin/DepartmentsManagement'
import EventReportsManagement from './components/Admin/EventReportsManagement'
import AdminSettingsPage from './components/Admin/AdminSettingsPage'
import './App.css'

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);

  const adminUser = {
    name: "Admin User",
    email: "admin@bataan.gov.ph",
    department: "Administration"
  };

  // Auto-login on app load if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('userData');

      if (token && storedUser) {
        try {
          // Validate token by making a request to /me endpoint
          const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include' // Include cookies in request
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Token is valid, update user data
              setUser(data.data);
              setIsLoggedIn(true);
              localStorage.setItem('userData', JSON.stringify(data.data));
            }
          } else if (response.status === 401) {
            // Token expired or invalid, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            setIsLoggedIn(false);
            setUser(null);
          } else {
            setIsLoggedIn(false);
            setUser(null);
          }
        } catch (error) {
          // Don't clear storage on network error, let user stay logged in
          // Try to use stored user data
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
              setIsLoggedIn(true);
            } catch {
              setIsLoggedIn(false);
              setUser(null);
            }
          }
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }

      setIsInitialized(true);
    };

    initializeAuth();
  }, []);

  // Listen for auth state changes (e.g., when login happens in LoginForm)
  useEffect(() => {
    const handleAuthStateChange = (event: any) => {
      const { isLoggedIn: loggedIn, user: userData } = event.detail;
      setIsLoggedIn(loggedIn);
      setUser(userData);
    };

    window.addEventListener('authStateChanged', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange);
    };
  }, []);

  // Show loading state while initializing auth
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalNotificationSystem />
      <Router>
        <Routes>
          {/* Login Route */}
          <Route path="/login" element={<LoginForm />} />
          
          {/* Users Routes */}
          <Route path="/users/*" element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <MainLayout user={user}>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="request-event" element={<RequestEventPage />} />
                  <Route path="my-events" element={<MyEventsPage />} />
                  <Route path="my-calendar" element={<MyCalendarPage />} />
                  <Route path="my-requirements" element={<MyRequirementsPage />} />
                  <Route path="manage-location" element={<ManageLocationPage />} />
                  <Route path="calendar" element={<LocationAvailabilityCalendarPage />} />
                  <Route path="all-events" element={<UserAllEventsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="tagged-departments" element={<TaggedDepartmentPage />} />
                  <Route path="event-reports" element={<EventReportsPage />} />
                  <Route path="request-event-guide" element={<RequestEventGuidePage />} />
                  <Route path="bac-requests" element={<BacRequestsPage />} />
                  <Route path="pito-equipment" element={<PitoEquipmentAvailabilityPage />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          } />
          
          {/* Admin Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <AdminMainLayout user={adminUser}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="all-events" element={<AllEventsPage />} />
                  <Route path="overall-events" element={<OverallEventsPage />} />
                  <Route path="calendar" element={<AdminCalendarPage />} />
                  <Route path="users" element={<UsersManagement />} />
                  <Route path="users-logs" element={<UsersLogsPage />} />
                  <Route path="departments" element={<DepartmentsManagement />} />
                  <Route path="event-reports" element={<EventReportsManagement />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                  <Route path="reports" element={<div className="p-6"><h1 className="text-2xl font-bold">Reports</h1><p>Coming soon...</p></div>} />
                  <Route path="" element={
                    <Navigate 
                      to={
                        (() => {
                          const userData = localStorage.getItem('userData');
                          if (userData) {
                            try {
                              const parsed = JSON.parse(userData);
                              const role = (parsed.role || '').toLowerCase();
                              // If admin role, redirect to calendar, if superadmin go to dashboard
                              if (role === 'admin') {
                                return 'calendar';
                              } else if (role === 'superadmin') {
                                return 'dashboard';
                              }
                              // Default fallback
                              return 'all-events';
                            } catch {
                              return 'all-events';
                            }
                          }
                          return 'all-events';
                        })()
                      } 
                      replace 
                    />
                  } />
                </Routes>
              </AdminMainLayout>
            </ProtectedRoute>
          } />
          
          {/* Default redirect - route based on login status and user role */}
          <Route path="/" element={
            (() => {
              if (!isLoggedIn) {
                return <Navigate to="/login" replace />;
              }
              
              // User is logged in, redirect to appropriate dashboard
              if (user) {
                const userRole = (user.role || '').toLowerCase();
                if (userRole === 'admin') {
                  return <Navigate to="/admin/calendar" replace />;
                } else if (userRole === 'superadmin') {
                  return <Navigate to="/admin/dashboard" replace />;
                } else {
                  return <Navigate to="/users/dashboard" replace />;
                }
              }
              
              // Default fallback
              return <Navigate to="/login" replace />;
            })()
          } />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </>
  )
}

export default App
