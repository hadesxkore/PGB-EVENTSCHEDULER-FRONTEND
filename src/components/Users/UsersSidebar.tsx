import React, { useState, useEffect } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import axios from 'axios';

import { Button } from '@/components/ui/button';

import EventCountBadge from '@/components/ui/event-count-badge';

import { useUnreadMessages } from '@/hooks/useUnreadMessages';

import { useMessagesStore } from '@/stores/messagesStore';

import { useSocket, getGlobalSocket } from '@/hooks/useSocket';

import {

  Calendar,

  CalendarDays,

  Package,

  MapPin,

  // MessageSquare, // Messages page temporarily disabled

  Building2,

  LogOut,

  LayoutDashboard,

  CalendarPlus,

  PanelLeft,

  CalendarCheck,

  Menu,

  X,

  FileText,

  BookOpen,

  ChevronDown,

  ChevronLeft,

  ChevronRight,

  ClipboardList,

  Monitor

} from 'lucide-react';

import { Separator } from '@/components/ui/separator';



interface UsersSidebarProps {

  user?: {

    name: string;

    email: string;

    department: string;

    avatar?: string;

  };

}



const UsersSidebar: React.FC<UsersSidebarProps> = ({ user }) => {

  // Get user data from localStorage for more accurate department info

  const [currentUser, setCurrentUser] = useState({

    id: "unknown",

    name: user?.name || "User",

    email: user?.email || "user@bataan.gov.ph",

    department: user?.department || "Department",

    role: ''

  });



  // Load user data from localStorage on mount

  useEffect(() => {

    const userData = localStorage.getItem('userData');

    if (userData) {

      try {

        const parsedUser = JSON.parse(userData);

        setCurrentUser({

          id: parsedUser._id || parsedUser.id || "unknown",

          name: parsedUser.name || user?.name || "User",

          email: parsedUser.email || user?.email || "user@bataan.gov.ph",

          department: parsedUser.department || parsedUser.departmentName || user?.department || "Department",

          role: (parsedUser.role || '').toString()

        });

      } catch (error) {

        // Error parsing user data - using fallback values

      }

    }

  }, [user]);

  const userRole = (currentUser.role || '').toString().trim().toLowerCase();
  const isAdminLike = userRole === 'admin' || userRole === 'superadmin';
  const adminHomeHref = userRole === 'superadmin' ? '/admin/dashboard' : '/admin/calendar';

  const [isCollapsed, setIsCollapsed] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [requestEventOpen, setRequestEventOpen] = useState(true);



  // Prevent body scroll when mobile menu is open

  useEffect(() => {

    if (isMobileMenuOpen) {

      document.body.style.overflow = 'hidden';

    } else {

      document.body.style.overflow = 'unset';

    }



    return () => {

      document.body.style.overflow = 'unset';

    };

  }, [isMobileMenuOpen]);

  const [permissions, setPermissions] = useState({

    myRequirements: false,

    manageLocation: false,

    myCalendar: false,

    allEvents: false,

    taggedDepartments: false

  });

  const navigate = useNavigate();

  const location = useLocation();



  // Initialize Socket.IO

  const { onStatusUpdate, offStatusUpdate } = useSocket(currentUser.id);



  // Event count state for My Calendar badge

  const [eventCount, setEventCount] = useState(0);



  // Location event count state for Manage Location badge

  const [locationEventCount, setLocationEventCount] = useState(0);



  // Tagged departments ongoing events count

  const [taggedDepartmentsCount, setTaggedDepartmentsCount] = useState(0);



  // All events count (all statuses: submitted, approved, rejected, etc.)

  const [allEventsCount, setAllEventsCount] = useState(0);



  // My Events badge count (tagged requirements count - same logic as MyEventsPage)

  const [myEventsBadgeCount, setMyEventsBadgeCount] = useState(0);



  // Track if My Events badge has been viewed

  const [myEventsBadgeViewed, setMyEventsBadgeViewed] = useState(

    localStorage.getItem('myEventsBadgeViewed') === 'true'

  );



  // Event Reports badge count (pending reports count)

  const [eventReportsBadgeCount, setEventReportsBadgeCount] = useState(0);



  // BAC Requests pending badge count

  const [bacRequestsPendingCount, setBacRequestsPendingCount] = useState(0);



  // Track if Event Reports badge has been viewed

  const [eventReportsBadgeViewed, setEventReportsBadgeViewed] = useState(

    localStorage.getItem('eventReportsBadgeViewed') === 'true'

  );



  // Listen for My Events badge viewed event

  useEffect(() => {

    const handleBadgeViewed = () => {

      setMyEventsBadgeViewed(true);

    };



    window.addEventListener('myEventsBadgeViewed', handleBadgeViewed);



    return () => {

      window.removeEventListener('myEventsBadgeViewed', handleBadgeViewed);

    };

  }, []);



  // Listen for Event Reports badge viewed event

  useEffect(() => {

    const handleEventReportsBadgeViewed = () => {

      setEventReportsBadgeViewed(true);

      localStorage.setItem('eventReportsBadgeViewed', 'true');

    };



    window.addEventListener('eventReportsBadgeViewed', handleEventReportsBadgeViewed);



    return () => {

      window.removeEventListener('eventReportsBadgeViewed', handleEventReportsBadgeViewed);

    };

  }, []);



  // Listen for real-time Event Reports updates

  useEffect(() => {

    const handleEventReportsUpdated = async (event: any) => {

      // Refetch the event reports badge count when a report is uploaded

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];

          // Filter for approved, ongoing, and completed events (match EventReportsPage logic)

          const reportableEvents = events.filter((evt: any) => {

            const status = evt.status?.toLowerCase();

            return status === 'approved' || status === 'ongoing' || status === 'completed';

          });



          // Count events with pending reports

          let pendingCount = 0;

          reportableEvents.forEach((evt: any) => {

            const reports = evt.eventReports;

            if (reports) {

              const completed = [

                reports.completionReport?.uploaded,

                reports.postActivityReport?.uploaded

              ].filter(Boolean).length;



              if (completed < 2) {

                pendingCount += 1;

              }

            } else {

              pendingCount += 1;

            }

          });



          // Update badge count in real-time

          setEventReportsBadgeCount(pendingCount);

        }

      } catch (error) {

        // Failed to update badge

      }

    };



    window.addEventListener('eventReportsUpdated', handleEventReportsUpdated);



    return () => {

      window.removeEventListener('eventReportsUpdated', handleEventReportsUpdated);

    };

  }, []);



  // Fetch event count for My Calendar badge

  useEffect(() => {

    const fetchEventCount = async () => {

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];

          // Filter events for current user's department - ONLY APPROVED events

          const departmentEvents = events.filter((event: any) => {

            const isForDepartment = event.taggedDepartments?.includes(currentUser.department) ||

              event.requestorDepartment === currentUser.department;

            const isApproved = event.status === 'approved';

            return isForDepartment && isApproved;

          });

          setEventCount(departmentEvents.length);

        }

      } catch (error) {

        // Keep default count if fetch fails

        setEventCount(0);

      }

    };



    if (currentUser.department && currentUser.department !== "Department") {

      fetchEventCount();

    }

  }, [currentUser.department]);



  // Fetch location event count for Manage Location badge

  useEffect(() => {

    const fetchLocationEventCount = async () => {

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];

          // Count all events that have location bookings - ONLY APPROVED

          const locationBookedEvents = events.filter((event: any) =>

            event.location &&

            event.location.trim() !== '' &&

            event.status === 'approved'

          );

          setLocationEventCount(locationBookedEvents.length);

        }

      } catch (error) {

        // Keep default count if fetch fails

        setLocationEventCount(0);

      }

    };



    if (currentUser.department && currentUser.department !== "Department") {

      fetchLocationEventCount();

    }

  }, [currentUser.department]);



  // Fetch tagged departments ongoing events count

  useEffect(() => {

    const fetchTaggedDepartmentsCount = async () => {

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events/tagged`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];

          // Count only ongoing events where this department has pending requirements

          const ongoingEvents = events.filter((event: any) => {

            const eventStatus = (event.status || '').toLowerCase();

            if (eventStatus !== 'approved' && eventStatus !== 'completed') return false;

            const userDeptReqs = event.departmentRequirements?.[currentUser.department] || [];

            const releasedReqs = userDeptReqs.filter((r: any) => !r.requirementsStatus || r.requirementsStatus === 'released');

            const totalCount = releasedReqs.length;

            const pendingCount = releasedReqs.filter((r: any) => (r.status || 'pending') === 'pending').length;

            return totalCount > 0 && pendingCount > 0;

          });

          setTaggedDepartmentsCount(ongoingEvents.length);

        }

      } catch (error) {

        // Keep default count if fetch fails

        setTaggedDepartmentsCount(0);

      }

    };



    if (currentUser.department && currentUser.department !== "Department" && permissions.taggedDepartments) {

      fetchTaggedDepartmentsCount();

    }

  }, [currentUser.department, permissions.taggedDepartments]);



  // Fetch all events count (all statuses)

  useEffect(() => {

    const fetchAllEventsCount = async () => {

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];

          // Count ALL events regardless of status

          setAllEventsCount(events.length);

        }

      } catch (error) {

        // Keep default count if fetch fails

        setAllEventsCount(0);

      }

    };



    if (currentUser.department && currentUser.department !== "Department" && permissions.allEvents) {

      fetchAllEventsCount();

    }

  }, [currentUser.department, permissions.allEvents]);



  // Fetch My Events badge count (total count of all events with tagged requirements)

  useEffect(() => {

    const fetchMyEventsBadgeCount = async () => {

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];



          // Count ALL events that have department requirements (tagged requirements)

          let count = 0;

          events.forEach((event: any) => {

            if (event.departmentRequirements && Object.keys(event.departmentRequirements).length > 0) {

              count += 1;

            }

          });



          setMyEventsBadgeCount(count);

          // Show badge if there are any events with tagged requirements

          if (count > 0) {

            setMyEventsBadgeViewed(false);

            localStorage.removeItem('myEventsBadgeViewed');

          }

        }

      } catch (error) {

        // Keep default count if fetch fails

        setMyEventsBadgeCount(0);

      }

    };



    if (currentUser.department && currentUser.department !== "Department") {

      fetchMyEventsBadgeCount();

    }

  }, [currentUser.department]);



  // Fetch Event Reports badge count (pending reports count)

  useEffect(() => {

    const fetchEventReportsBadgeCount = async () => {

      try {

        const token = localStorage.getItem('authToken');

        if (!token) return;



        const response = await axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          const events = response.data.data || [];

          // Filter for approved, ongoing, and completed events (match EventReportsPage logic)

          const reportableEvents = events.filter((event: any) => {

            const status = event.status?.toLowerCase();

            return status === 'approved' || status === 'ongoing' || status === 'completed';

          });



          // Count events with pending reports (not all reports completed)

          let pendingCount = 0;

          reportableEvents.forEach((event: any) => {

            const reports = event.eventReports;

            if (reports) {

              const completed = [

                reports.completionReport?.uploaded,

                reports.postActivityReport?.uploaded

              ].filter(Boolean).length;



              // If not all 2 reports are completed, count as pending

              if (completed < 2) {

                pendingCount += 1;

              }

            } else {

              // No reports at all, count as pending

              pendingCount += 1;

            }

          });



          // Update badge count - badge will hide automatically when count reaches 0

          setEventReportsBadgeCount(pendingCount);

        }

      } catch (error) {

        // Keep default count if fetch fails

        setEventReportsBadgeCount(0);

      }

    };



    if (currentUser.department && currentUser.department !== "Department") {

      fetchEventReportsBadgeCount();

    }

  }, [currentUser.department]);



  // Real-time refresh functions

  const refreshEventCounts = async () => {

    try {

      const token = localStorage.getItem('authToken');

      if (!token) return;



      const response = await axios.get(`${API_BASE_URL}/events`, {

        headers: getAuthHeaders()

      });



      if (response.data.success) {

        const events = response.data.data || [];



        // Update My Calendar count - ONLY APPROVED events

        const departmentEvents = events.filter((event: any) => {

          const isForDepartment = event.taggedDepartments?.includes(currentUser.department) ||

            event.requestorDepartment === currentUser.department;

          const isApproved = event.status === 'approved';

          return isForDepartment && isApproved;

        });

        setEventCount(departmentEvents.length);



        // Update Manage Location count - ONLY APPROVED

        if (permissions.manageLocation) {

          const locationBookedEvents = events.filter((event: any) =>

            event.location &&

            event.location.trim() !== '' &&

            event.status === 'approved'

          );

          setLocationEventCount(locationBookedEvents.length);

        }



        // Update All Events count - ALL STATUSES

        if (permissions.allEvents) {

          setAllEventsCount(events.length);

        }

      }



      // Update Tagged Departments count

      if (permissions.taggedDepartments) {

        const taggedResponse = await axios.get(`${API_BASE_URL}/events/tagged`, {

          headers: getAuthHeaders()

        });



        if (taggedResponse.data.success) {

          const taggedEvents = taggedResponse.data.data || [];

          const ongoingEvents = taggedEvents.filter((event: any) => {

            const eventStatus = (event.status || '').toLowerCase();

            if (eventStatus !== 'approved' && eventStatus !== 'completed') return false;

            const userDeptReqs = event.departmentRequirements?.[currentUser.department] || [];

            const releasedReqs = userDeptReqs.filter((r: any) => !r.requirementsStatus || r.requirementsStatus === 'released');

            const totalCount = releasedReqs.length;

            const pendingCount = releasedReqs.filter((r: any) => (r.status || 'pending') === 'pending').length;

            return totalCount > 0 && pendingCount > 0;

          });

          setTaggedDepartmentsCount(ongoingEvents.length);

        }

      }



      // Update My Events badge count

      const myEventsResponse = await axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, {

        headers: getAuthHeaders()

      });



      if (myEventsResponse.data.success) {

        const myEvents = myEventsResponse.data.data || [];

        const viewedEvents = new Set(JSON.parse(localStorage.getItem('viewedTaggedRequirementsEvents') || '[]'));



        // Count only UNVIEWED events that have updates

        let count = 0;

        myEvents.forEach((event: any) => {

          // Skip if this event has already been viewed

          if (viewedEvents.has(event._id)) {

            return;

          }



          if (event.departmentRequirements) {

            let hasUpdates = false;

            Object.entries(event.departmentRequirements).forEach(([dept, reqs]: [string, any]) => {

              (reqs as any[]).forEach((req: any) => {

                const status = (req.status || 'pending').toLowerCase();

                const hasStatusChange = status !== 'pending';

                const hasDeptNotes = !!req.departmentNotes;

                const hasDeptReplies = Array.isArray(req.replies)

                  ? req.replies.some((r: any) => r.role === 'department')

                  : false;



                if (hasStatusChange || hasDeptNotes || hasDeptReplies) {

                  hasUpdates = true;

                }

              });

            });



            if (hasUpdates) {

              count += 1;

            }

          }

        });

        // Only update if count changed

        const previousCount = myEventsBadgeCount;

        setMyEventsBadgeCount(count);

        // Reset viewed flag ONLY if count increased (new updates)

        if (count > previousCount && count > 0) {

          setMyEventsBadgeViewed(false);

          localStorage.removeItem('myEventsBadgeViewed');

        }

      }

    } catch (error) {

      // Keep current counts if refresh fails

    }

  };



  // Refresh counts only on initial mount - Socket.IO handles real-time updates

  useEffect(() => {

    refreshEventCounts();

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []); // Empty deps = only runs once on mount



  // Removed polling - now using Socket.IO for real-time updates!

  // Badge counts update via Socket.IO 'status-update' event (see below)



  // Refresh when window gains focus (user comes back to the app)

  useEffect(() => {

    const handleFocus = () => {

      refreshEventCounts();

    };



    const handleStorageChange = (e: StorageEvent) => {

      // Refresh counts when localStorage changes (cross-tab sync)

      if (e.key === 'authToken' || e.key === 'userData') {

        refreshEventCounts();

      }

    };



    window.addEventListener('focus', handleFocus);

    window.addEventListener('storage', handleStorageChange);



    return () => {

      window.removeEventListener('focus', handleFocus);

      window.removeEventListener('storage', handleStorageChange);

    };

  }, [currentUser.department, permissions]);



  // Socket.IO listener for real-time requirement status updates

  useEffect(() => {

    if (typeof onStatusUpdate === 'function') {

      const handleStatusUpdate = (data: any) => {



        // Immediately refresh badge counts (non-blocking)

        setTimeout(() => {

          const token = localStorage.getItem('authToken');

          if (token) {

            // Update Tagged Departments count

            if (permissions.taggedDepartments) {

              axios.get(`${API_BASE_URL}/events/tagged`, {

                headers: getAuthHeaders()

              })

                .then(taggedResponse => {

                  if (taggedResponse.data.success) {

                    const taggedEvents = taggedResponse.data.data || [];

                    const ongoingEvents = taggedEvents.filter((event: any) => {

                      const eventStatus = (event.status || '').toLowerCase();

                      if (eventStatus !== 'approved' && eventStatus !== 'completed') return false;

                      const userDeptReqs = event.departmentRequirements?.[currentUser.department] || [];

                      const releasedReqs = userDeptReqs.filter((r: any) => !r.requirementsStatus || r.requirementsStatus === 'released');

                      const totalCount = releasedReqs.length;

                      const pendingCount = releasedReqs.filter((r: any) => (r.status || 'pending') === 'pending').length;

                      return totalCount > 0 && pendingCount > 0;

                    });

                    setTaggedDepartmentsCount(ongoingEvents.length);

                  }

                })

                .catch(error => {

                  // Failed to update badge

                });

            }



            // Update My Events badge count (total count of all events with tagged requirements)

            axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, {

              headers: getAuthHeaders()

            })

              .then(myEventsResponse => {

                if (myEventsResponse.data.success) {

                  const myEvents = myEventsResponse.data.data || [];



                  // Count ALL events that have department requirements (tagged requirements)

                  let count = 0;

                  myEvents.forEach((event: any) => {

                    if (event.departmentRequirements && Object.keys(event.departmentRequirements).length > 0) {

                      count += 1;

                    }

                  });



                  setMyEventsBadgeCount(count);

                  // Show badge if there are any events with tagged requirements

                  if (count > 0) {

                    setMyEventsBadgeViewed(false);

                    localStorage.removeItem('myEventsBadgeViewed');

                  }

                }

              })

              .catch(error => {

                // Failed to update badge

              });



            // Update Event Reports badge count (pending reports)

            axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, {

              headers: getAuthHeaders()

            })

              .then(eventReportsResponse => {

                if (eventReportsResponse.data.success) {

                  const events = eventReportsResponse.data.data || [];

                  // Filter for ongoing/approved events

                  const ongoingEvents = events.filter((event: any) => {

                    const status = event.status?.toLowerCase();

                    return status === 'approved' || status === 'ongoing';

                  });



                  // Count events with pending reports

                  let pendingCount = 0;

                  ongoingEvents.forEach((event: any) => {

                    const reports = event.eventReports;

                    if (reports) {

                      const completed = [

                        reports.completionReport?.uploaded,

                        reports.postActivityReport?.uploaded

                      ].filter(Boolean).length;



                      if (completed < 2) {

                        pendingCount += 1;

                      }

                    } else {

                      pendingCount += 1;

                    }

                  });



                  // Update badge count - badge will hide automatically when count reaches 0

                  setEventReportsBadgeCount(pendingCount);

                }

              })

              .catch(error => {

                // Failed to update badge

              });

          }

        }, 0); // Execute immediately but non-blocking

      };



      onStatusUpdate(handleStatusUpdate);



      return () => {

        if (typeof offStatusUpdate === 'function') {

          offStatusUpdate();

        }

      };

    }

  }, [currentUser.department, permissions.taggedDepartments]);



  // Use messages store for real-time unread counts

  const {

    initializeUser: initializeMessagesUser,

    fetchEventConversations,

    getTotalUnreadCount,

    currentUser: messagesCurrentUser

  } = useMessagesStore();



  // State for unread messages count

  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);

  const [unreadLoading, setUnreadLoading] = useState(false);



  // Initialize messages store user

  useEffect(() => {

    if (currentUser.id !== "unknown") {

      initializeMessagesUser();

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [currentUser.id]); // REMOVED initializeMessagesUser to prevent infinite loop



  // Get unread count from messages store with real-time updates

  useEffect(() => {

    const updateUnreadCount = () => {

      const count = getTotalUnreadCount();

      setTotalUnreadMessages(count);

    };



    // Update immediately

    updateUnreadCount();



    // Set up interval to check for updates (reduced frequency)

    const interval = setInterval(updateUnreadCount, 15000); // Check every 15 seconds to reduce API calls



    // Listen for custom events for immediate updates

    const handleUnreadUpdate = () => {

      updateUnreadCount();

    };



    const handleMessageRead = () => {

      updateUnreadCount(); // INSTANT update - no delays

    };



    const handleNewMessage = () => {

      updateUnreadCount(); // INSTANT update - no delays

    };



    // Add event listeners

    window.addEventListener('unreadMessagesUpdated', handleUnreadUpdate);

    window.addEventListener('messagesReadGlobal', handleMessageRead);

    window.addEventListener('newMessageReceived', handleNewMessage);



    return () => {

      clearInterval(interval);

      window.removeEventListener('unreadMessagesUpdated', handleUnreadUpdate);

      window.removeEventListener('messagesReadGlobal', handleMessageRead);

      window.removeEventListener('newMessageReceived', handleNewMessage);

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []); // REMOVED getTotalUnreadCount to prevent infinite loop - function is stable from Zustand



  // Fetch conversations when user changes or navigates

  useEffect(() => {

    if (currentUser.department && currentUser.department !== "Department") {

      fetchEventConversations(false); // Use cache to avoid spamming unread-count requests

      // Also update unread count immediately after fetching

      setTimeout(() => {

        const count = getTotalUnreadCount();

        setTotalUnreadMessages(count);

      }, 1000);

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [currentUser.department, location.pathname]); // REMOVED fetchEventConversations and getTotalUnreadCount to prevent infinite loop









  // API Configuration

  const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

  const getAuthHeaders = () => {

    const token = localStorage.getItem('authToken');

    return {

      'Authorization': `Bearer ${token}`,

      'Content-Type': 'application/json'

    };

  };



  const fetchBacPendingCount = async () => {

    try {

      const token = localStorage.getItem('authToken');

      if (!token) return;



      const isBAC = (currentUser.department || '').trim().toLowerCase() === 'bac';
      const isPITO = (currentUser.department || '').trim().toUpperCase() === 'PITO';

      if (!isBAC) {

        setBacRequestsPendingCount(0);

        return;

      }



      const resp = await fetch(`${API_BASE_URL}/events/bac/requests?status=pending&page=1&limit=1`, {

        headers: getAuthHeaders()

      });

      const json = await resp.json().catch(() => null);

      if (resp.ok && json?.success) {

        setBacRequestsPendingCount(typeof json.total === 'number' ? json.total : 0);

      }

    } catch {

      // keep existing count if fetch fails

    }

  };



  // Fetch department permissions

  useEffect(() => {

    const fetchPermissions = async () => {

      try {

        const response = await axios.get(`${API_BASE_URL}/department-permissions/${currentUser.department}`, {

          headers: getAuthHeaders()

        });



        if (response.data.success) {

          setPermissions(response.data.data.permissions);

        }

      } catch (error) {

        // Keep default permissions if fetch fails

      }

    };



    if (currentUser.department && currentUser.department !== "Department") {

      fetchPermissions();

    }

  }, [currentUser.department]);



  // Fetch BAC pending count on mount / when department changes

  useEffect(() => {

    if (!currentUser.id || currentUser.id === 'unknown') return;

    fetchBacPendingCount();

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [currentUser.id, currentUser.department]);



  // Realtime refresh BAC pending count

  useEffect(() => {

    const socket = getGlobalSocket();

    const isBAC = (currentUser.department || '').trim().toLowerCase() === 'bac';
    const isPITO = (currentUser.department || '').trim().toUpperCase() === 'PITO';

    if (!socket || !isBAC) return;



    const handleBacRequestUpdated = () => {

      fetchBacPendingCount();

    };



    const handleNewNotification = (data: any) => {

      const t = data?.notificationType || data?.type;

      if (t === 'bac-location-request') {

        fetchBacPendingCount();

      }

    };



    socket.on('bac-request-updated', handleBacRequestUpdated);

    socket.on('new-notification', handleNewNotification);



    return () => {

      socket.off('bac-request-updated', handleBacRequestUpdated);

      socket.off('new-notification', handleNewNotification);

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [currentUser.department]);



  // Dynamic navigation items based on permissions - GROUPED

  const getNavigationGroups = () => {

    const isBAC = (currentUser.department || '').trim().toLowerCase() === 'bac';
    const isPITO = (currentUser.department || '').trim().toUpperCase() === 'PITO';



    // Group 1: Requesting of Event

    const group1 = {

      label: 'Requesting of Event',

      items: [

        ...(isAdminLike ? [{ icon: ChevronLeft, label: 'Back to Admin Panel', href: adminHomeHref }] : []),

        { icon: LayoutDashboard, label: 'Dashboard', href: '/users/dashboard' },

        {
          icon: CalendarPlus, label: 'Request Event', href: '/users/request-event', hasSubmenu: true, submenu: [

            { icon: BookOpen, label: 'Request Event Guide', href: '/users/request-event-guide' }

          ]
        },

        { icon: CalendarDays, label: 'Calendar', href: '/users/calendar' },

        { icon: Calendar, label: 'My Events', href: '/users/my-events' },

        // Messages page temporarily disabled (not needed for now)
        // { icon: MessageSquare, label: 'Messages', href: '/users/messages' },

        { icon: FileText, label: 'Event Reports', href: '/users/event-reports' },

        ...(isBAC ? [{ icon: ClipboardList, label: 'BAC Requests', href: '/users/bac-requests' }] : []),

        ...(isPITO || isAdminLike ? [{ icon: Monitor, label: 'Equipment Availability', href: '/users/pito-equipment' }] : []),

      ]

    };



    // Group 2: Tagged Departments

    const group2Items = [];

    if (permissions.myCalendar) {

      group2Items.push({ icon: CalendarDays, label: 'My Calendar', href: '/users/my-calendar' });

    }

    if (permissions.myRequirements) {

      group2Items.push({ icon: Package, label: 'My Requirements', href: '/users/my-requirements' });

    }

    if (permissions.taggedDepartments) {

      group2Items.push({ icon: Building2, label: 'Tagged Departments', href: '/users/tagged-departments' });

    }

    const group2 = group2Items.length > 0 ? { label: 'Tagged Departments', items: group2Items } : null;



    // Group 3: For PGSO Controls

    const group3Items = [];

    if (permissions.allEvents) {

      group3Items.push({ icon: CalendarCheck, label: 'All Events', href: '/users/all-events' });

    }

    if (permissions.manageLocation) {

      group3Items.push({ icon: MapPin, label: 'Manage Location', href: '/users/manage-location' });

    }

    const group3 = group3Items.length > 0 ? { label: 'For PGSO Controls', items: group3Items } : null;



    return [group1, group2, group3].filter(group => group !== null);

  };



  const navigationGroups = getNavigationGroups();



  const handleNavigation = (href: string) => {

    try {

      navigate(href);

    } catch (error) {

      // Navigation failed - handle silently

    }

  };



  const handleLogout = async () => {

    try {

      const token = localStorage.getItem('authToken');

      const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;



      // Call logout endpoint to clear HTTP-Only cookie

      await fetch(`${API_BASE_URL}/users/logout`, {

        method: 'POST',

        headers: {

          'Authorization': token ? `Bearer ${token}` : '',

          'Content-Type': 'application/json'

        }

      });

    } catch (error) {

      console.error('Logout error:', error);

    } finally {

      // Clear any stored authentication data

      localStorage.removeItem('authToken');

      localStorage.removeItem('userData');

      // Navigate to login page

      navigate('/login');

    }

  };



  return (

    <>

      {/* Mobile Menu Button - Only visible on mobile */}

      <button

        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}

        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"

      >

        {isMobileMenuOpen ? (

          <X className="h-6 w-6 text-gray-700" />

        ) : (

          <Menu className="h-6 w-6 text-gray-700" />

        )}

      </button>



      {/* Overlay for mobile - Only visible when menu is open */}

      {isMobileMenuOpen && (

        <div

          className="lg:hidden fixed inset-0 bg-black/50 z-40"

          onClick={() => setIsMobileMenuOpen(false)}

          aria-hidden="true"

        />

      )}



      {/* Sidebar */}

      <div className={`

        flex flex-col h-screen bg-white border-r border-gray-200 shadow-sm transition-all duration-300

        ${isCollapsed ? 'lg:w-16' : 'lg:w-64'

        }

        w-64

        lg:relative lg:translate-x-0

        fixed top-0 left-0 z-50

        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'

        }

      `}>

        {/* Header */}

        <div className="flex items-center gap-3 p-4 border-b border-gray-100 relative">

          <img

            src="/images/bataanlogo.png"

            alt="Bataan Logo"

            className="w-8 h-8 object-contain flex-shrink-0"

          />

          <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'

            }`}>

            <h2 className="text-sm font-semibold text-gray-900 truncate">Event Scheduler</h2>

            <p className="text-xs text-blue-600 truncate">Provincial Government</p>

          </div>



          {/* Floating Toggle Button - Only on desktop */}

          <Button

            variant="ghost"

            size="icon"

            onClick={() => setIsCollapsed(!isCollapsed)}

            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 bg-white border border-gray-200 hover:bg-gray-50 rounded-full shadow-sm z-10"

          >

            <PanelLeft className={`h-3 w-3 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''

              }`} />

          </Button>

        </div>



        {/* Navigation */}

        <nav className="flex-1 p-2 space-y-3 overflow-y-auto">

          {navigationGroups.map((group, groupIndex) => (

            <div key={groupIndex} className="space-y-1">

              {/* Group Label */}

              {!isCollapsed && (

                <div className="px-3 py-1">

                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">

                    {group.label}

                  </p>

                </div>

              )}



              {/* Group Items */}

              {group.items.map((item: any) => {

                const Icon = item.icon;

                const isActive = location.pathname === item.href;

                const isMyCalendar = item.label === 'My Calendar';

                const isMessages = item.label === 'Messages';

                const isManageLocation = item.label === 'Manage Location';

                const isTaggedDepartments = item.label === 'Tagged Departments';

                const isAllEvents = item.label === 'All Events';

                const isRequestEvent = item.label === 'Request Event';

                const isMyEvents = item.label === 'My Events';

                const isEventReports = item.label === 'Event Reports';

                const isBacRequests = item.label === 'BAC Requests';

                const totalEventCount = isMyCalendar ? eventCount : 0;

                const hasSubmenu = item.hasSubmenu && item.submenu;

                const isSubmenuOpen = isRequestEvent && requestEventOpen;



                return (

                  <div key={item.label}>

                    <div className="relative">

                      <div className="flex items-center gap-0">

                        <Button

                          variant="ghost"

                          onClick={() => {

                            handleNavigation(item.href);

                            setIsMobileMenuOpen(false);

                          }}

                          className={`flex-1 h-10 transition-all duration-200 ${isActive

                              ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-600'

                              : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'

                            } ${isCollapsed

                              ? 'lg:justify-center lg:px-2'

                              : 'justify-start gap-3 px-3'

                            } ${hasSubmenu && !isCollapsed ? 'rounded-r-none' : ''}`}

                          title={isCollapsed ? item.label : undefined}

                        >

                          <Icon className="h-5 w-5 flex-shrink-0" />

                          <span className={`flex-1 text-left truncate transition-opacity duration-200 ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'

                            }`}>

                            {item.label}

                          </span>

                        </Button>

                        {hasSubmenu && !isCollapsed && (

                          <Button

                            variant="ghost"

                            size="sm"

                            onClick={() => setRequestEventOpen(!requestEventOpen)}

                            className={`h-10 w-8 p-0 rounded-l-none ${isActive

                                ? 'text-blue-700 hover:bg-blue-200'

                                : 'text-gray-700 hover:bg-blue-50'

                              }`}

                          >

                            {isSubmenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}

                          </Button>

                        )}

                      </div>



                      {/* Event Count Badge for My Calendar */}

                      {isMyCalendar && totalEventCount > 0 && !isCollapsed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {totalEventCount > 99 ? '99+' : totalEventCount}

                        </div>

                      )}



                      {/* Unread Messages Badge for Messages */}

                      {isMessages && totalUnreadMessages > 0 && !isCollapsed && !unreadLoading && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}

                        </div>

                      )}



                      {/* Location Event Count Badge for Manage Location */}

                      {isManageLocation && locationEventCount > 0 && !isCollapsed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {locationEventCount > 99 ? '99+' : locationEventCount}

                        </div>

                      )}



                      {/* Ongoing Events Count Badge for Tagged Departments */}

                      {isTaggedDepartments && taggedDepartmentsCount > 0 && !isCollapsed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {taggedDepartmentsCount > 99 ? '99+' : taggedDepartmentsCount}

                        </div>

                      )}



                      {/* All Events Count Badge (all statuses) */}

                      {isAllEvents && allEventsCount > 0 && !isCollapsed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {allEventsCount > 99 ? '99+' : allEventsCount}

                        </div>

                      )}



                      {/* My Events Badge Count (tagged requirements count) */}

                      {isMyEvents && myEventsBadgeCount > 0 && !isCollapsed && !myEventsBadgeViewed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {myEventsBadgeCount > 99 ? '99+' : myEventsBadgeCount}

                        </div>

                      )}



                      {/* Event Reports Badge Count (pending reports count) */}

                      {isEventReports && eventReportsBadgeCount > 0 && !isCollapsed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {eventReportsBadgeCount > 99 ? '99+' : eventReportsBadgeCount}

                        </div>

                      )}



                      {/* BAC Requests Pending Count Badge */}

                      {isBacRequests && bacRequestsPendingCount > 0 && !isCollapsed && (

                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full">

                          {bacRequestsPendingCount > 99 ? '99+' : bacRequestsPendingCount}

                        </div>

                      )}

                    </div>



                    {/* Submenu */}

                    {hasSubmenu && isSubmenuOpen && !isCollapsed && (

                      <div className="ml-8 mt-1 space-y-1">

                        {item.submenu.map((subItem: any) => {

                          const SubIcon = subItem.icon;

                          const isSubActive = location.pathname === subItem.href;



                          return (

                            <Button

                              key={subItem.label}

                              variant="ghost"

                              onClick={() => {

                                handleNavigation(subItem.href);

                                setIsMobileMenuOpen(false);

                              }}

                              className={`w-full h-9 transition-all duration-200 ${isSubActive

                                  ? 'bg-blue-50 text-blue-700'

                                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'

                                } justify-start gap-2 px-3 text-sm`}

                            >

                              <SubIcon className="h-4 w-4 flex-shrink-0" />

                              <span className="truncate">{subItem.label}</span>

                            </Button>

                          );

                        })}

                      </div>

                    )}

                  </div>

                );

              })}



              {/* Separator between groups (except after last group) */}

              {groupIndex < navigationGroups.length - 1 && (

                <Separator className="my-3" />

              )}

            </div>

          ))}

        </nav>



        {/* Footer */}

        <div className="border-t border-gray-100 p-4 space-y-3">

          <div className="flex items-center gap-3">

            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">

              <span className="text-sm font-bold text-white">

                {currentUser.department?.charAt(0)?.toUpperCase() || 'D'}

              </span>

            </div>

            <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'

              }`}>

              <p className="text-sm font-semibold text-gray-900 truncate">{currentUser.department}</p>

              <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>

            </div>

          </div>



          {/* Logout Button */}

          <Button

            variant="ghost"

            onClick={() => {

              handleLogout();

              setIsMobileMenuOpen(false); // Close mobile menu on logout

            }}

            className={`w-full h-9 transition-all duration-200 text-red-600 hover:bg-red-50 hover:text-red-700 ${isCollapsed

                ? 'lg:justify-center lg:px-2'

                : 'justify-start gap-3 px-3'

              }`}

            title={isCollapsed ? 'Logout' : undefined}

          >

            <LogOut className="h-4 w-4 flex-shrink-0" />

            <span className={`truncate transition-opacity duration-200 ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'

              }`}>

              Logout

            </span>

          </Button>

        </div>

      </div>

    </>

  );

};



export default UsersSidebar;

