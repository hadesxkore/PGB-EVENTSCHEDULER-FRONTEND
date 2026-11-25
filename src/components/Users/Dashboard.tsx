import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calendar, 
  CalendarDays, 
  Building2, 
  Bell,
  ArrowRight,
  Clock,
  MapPin,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { useSocket } from '@/hooks/useSocket';
import { useDashboardStore } from '@/stores/dashboardStore';
import { Toaster } from 'sonner';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;


interface EventData {
  _id: string;
  eventTitle: string;
  requestor: string;
  requestorDepartment?: string;
  location: string;
  locations?: string[];
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  status: string;
  taggedDepartments?: string[];
  createdBy?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  time: string;
  read: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  eventId?: string;
  eventDate?: string;
  requirementId?: string;
  departmentNotes?: string;
}

import { NotificationModal } from './NotificationModal';

const Dashboard: React.FC = () => {
  // Zustand store - replaces all useState calls above!
  const {
    notifications,
    upcomingEvents,
    totalUserEvents,
    totalSystemEvents,
    requirementsOverview,
    readNotifications,
    deleteNotifications,
    loading,
    fetchDashboardData,
    fetchReadNotifications,
    fetchDeletedNotifications,
    markNotificationAsRead,
    getFilteredRequirements,
    getUniqueEvents,
    getUnreadCount,
    refreshNotifications
  } = useDashboardStore();
  
  // Only keep local UI state
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  
  // Get current user data (memoized to prevent re-renders)
  const currentUser = useMemo(() => {
    return JSON.parse(localStorage.getItem('userData') || '{}');
  }, []);
  
  const userId = useMemo(() => {
    return currentUser._id || currentUser.id || 'unknown';
  }, [currentUser]);
  
  // User data loaded and memoized
  
  // Initialize Socket.IO for real-time updates
  const { onNotificationRead, offNotificationRead, onNewNotification, offNewNotification } = useSocket(userId);

  // Helper function to format time
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Helper function to make event title bold in status notifications
  const renderMessageWithBoldEventTitle = (message: string) => {
    // Pattern: 'for event "Event Title"'
    const eventTitleRegex = /(for event ")([^"]+)(")/g;
    const parts = message.split(eventTitleRegex);
    
    return parts.map((part, index) => {
      // If this part is an event title (every 4th part starting from index 2)
      if (index > 0 && (index - 2) % 4 === 0) {
        return <span key={index} className="font-bold">{part}</span>;
      }
      return part;
    });
  };

  // Helper function to calculate days until event
  const getDaysUntilEvent = (eventDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const event = new Date(eventDate);
    event.setHours(0, 0, 0, 0);
    
    const diffTime = event.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    
    return diffDays;
  };

  // Helper function to generate notification message
  const generateNotificationMessage = (event: EventData, isUserEvent: boolean, isTaggedEvent: boolean = false): string => {
    const daysUntil = getDaysUntilEvent(event.startDate);
    const formattedTime = formatTime(event.startTime);
    
    // Truncate event title if too long (max 40 characters)
    const truncatedTitle = event.eventTitle.length > 40 
      ? event.eventTitle.substring(0, 40) + "..." 
      : event.eventTitle;
    
    // Different message format for tagged events
    if (isTaggedEvent) {
      return `New event "${truncatedTitle}" has tagged your department`;
    }
    
    const eventPrefix = isUserEvent ? "Your event" : "Event";
    const departmentInfo = isUserEvent ? "" : ` (${event.requestorDepartment || 'Unknown Dept'})`;
    
    
    
    if (daysUntil === 1) {
      return `${eventPrefix} "${truncatedTitle}"${departmentInfo} is tomorrow at ${formattedTime}`;
    } else if (daysUntil === 2) {
      return `${eventPrefix} "${truncatedTitle}"${departmentInfo} is coming in 2 days at ${formattedTime}`;
    } else if (daysUntil > 0 && daysUntil <= 7) {
      return `${eventPrefix} "${truncatedTitle}"${departmentInfo} is coming in ${daysUntil} days at ${formattedTime}`;
    }
    return `${eventPrefix} "${truncatedTitle}"${departmentInfo} is scheduled for ${event.startDate} at ${formattedTime}`;
  };

  // Generate notifications from upcoming events
  const generateUpcomingEventNotifications = (events: EventData[]): Notification[] => {
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
    const userDepartment = currentUser.department || currentUser.departmentName || '';
    const userName = currentUser.name || '';
    
    
    return events
      .filter(event => {
        const daysUntil = getDaysUntilEvent(event.startDate);
        const isUpcoming = daysUntil >= 0 && daysUntil <= 7;
        
        
        if (!isUpcoming) {
          return false;
        }
        
        // Only show notifications for:
        // 1. Events created by the current user (flexible name matching)
        // 2. Events where the user's department is specifically tagged
        // 3. If user name is empty, show all events for their department
        const isUserEvent = userName && event.requestor === userName;
        
        const isTaggedForUserDepartment = userDepartment && event.taggedDepartments?.includes(userDepartment);
        const isFromSameDepartment = userDepartment && event.requestorDepartment === userDepartment;
        
        // Also check if user created the event by ID (more reliable than name matching)
        const isUserEventById = event.createdBy === userId;
        
        // CRITICAL: For tagged events, ONLY show if event is APPROVED
        // User's own events can be shown regardless of status
        if (isTaggedForUserDepartment && !isUserEvent && !isUserEventById) {
          if (event.status !== 'approved') {
            console.log(`🚫 [NOTIFICATION] Hiding tagged event "${event.eventTitle}" - status: ${event.status} (not approved)`);
            return false;
          }
        }
        
        // If no user name, show events from same department or tagged department
        const shouldShow = isUserEvent || isUserEventById || isTaggedForUserDepartment || (!userName && isFromSameDepartment);
        
        
        return shouldShow;
      })
      .map(event => {
        const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        const userName = currentUser.name || '';
        const userDepartment = currentUser.department || currentUser.departmentName || '';
        const userId = currentUser._id || currentUser.id || 'unknown';
        
        const isUserEvent = userName && event.requestor === userName;
        const isUserEventById = event.createdBy === userId;
        const isTaggedForUserDepartment = userDepartment && event.taggedDepartments?.includes(userDepartment);
        const isFromSameDepartment = userDepartment && event.requestorDepartment === userDepartment;
        
        // Determine category based on how the user is related to the event
        let category = "upcoming";
        let title = "Upcoming Event";
        
        if (isUserEvent || isUserEventById) {
          category = "upcoming";
        } else if (isTaggedForUserDepartment) {
          category = "tagged";
          title = "Tagged Event";
        }

        const contentFingerprint = createUpcomingEventFingerprint(event);
        const notificationId = `upcoming-${event._id}-${userId}-${contentFingerprint}`;
        
        return {
          id: notificationId,
          baseId: `upcoming-${event._id}-${userId}`,
          title: title,
          message: `Event "${event.eventTitle}" (${event.requestorDepartment}) is coming in ${getDaysUntilEvent(event.startDate)} days at ${formatTime(event.startTime)}`,
          type: "upcoming",
          category: category,
          time: getDaysUntilEvent(event.startDate) === 1 ? 
                "Tomorrow" : 
                `In ${getDaysUntilEvent(event.startDate)} days`,
          read: false,
          icon: AlertCircle,
          iconColor: getDaysUntilEvent(event.startDate) === 1 ? "text-red-600" : "text-orange-600",
          eventId: event._id,
          eventDate: event.startDate,
          contentFingerprint: contentFingerprint
        };
      });
  };

  // Create content fingerprint for upcoming events
  const createUpcomingEventFingerprint = (event: EventData) => {
    const contentString = `${event.eventTitle}-${event.startDate}-${event.startTime}-${event.status}-${event.location}`;
    return btoa(contentString);
  };

  // Create content fingerprint for change detection
  const createNotificationFingerprint = (req: any) => {
    // Create a hash of the notification content that changes when content changes
    const contentString = `${req.name}-${req.status}-${req.department}-${req.departmentNotes}-${req.lastUpdated}`;
    return btoa(contentString); // Simple base64 encoding as fingerprint
  };




  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'declined': return 'text-red-600';
      case 'partially_fulfill': return 'text-blue-600';
      case 'in_preparation': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };








  // Fetch data on component mount using Zustand
  useEffect(() => {
    fetchDashboardData(userId);
    fetchReadNotifications(userId);
    fetchDeletedNotifications(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // REMOVED fetchDashboardData and fetchReadNotifications to prevent infinite loop

  // Listen for Socket.IO new notification events (TRUE REAL-TIME, NO POLLING!)
  useEffect(() => {
    if (typeof onNewNotification === 'function') {
      const handleNewNotification = (notificationData: any) => {
        console.log('🔔 [DASHBOARD] Socket.IO notification received, refreshing dashboard');
        // Refresh dashboard when new notification arrives via Socket.IO
        fetchDashboardData(userId, true); // Force refresh to get new notifications
      };

      // Set up Socket.IO listener
      onNewNotification(handleNewNotification);
      
      // Cleanup
      return () => {
        if (typeof offNewNotification === 'function') {
          offNewNotification();
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Only depend on userId, not on fetchDashboardData to prevent loops

  
  // Real-time notification read status listener (new notifications handled by GlobalNotificationSystem)
  useEffect(() => {
    // Check if functions are available
    if (!onNotificationRead) {
      return;
    }

    // Listen for notification read events (from other devices/sessions)
    const handleNotificationRead = (data: any) => {
      if (data.userId === userId) {
        // Update read status if it's for current user - this will be handled by the store
        // Dispatch global event for read status update
        window.dispatchEvent(new CustomEvent('notificationUpdate', { 
          detail: { type: 'read', data } 
        }));
      }
    };

    // Set up the listener
    onNotificationRead(handleNotificationRead);

    // Cleanup
    return () => {
      offNotificationRead();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // REMOVED onNotificationRead and offNotificationRead to prevent infinite loop

  // Real-time status update listener (REMOVED - was causing infinite loops)
  // useEffect(() => {
  //   if (!onStatusUpdate) {
  //     return;
  //   }

  //   const handleStatusUpdate = (statusData: any) => {
  //     // Refresh notifications when status update is received
  //     fetchEventsAndNotifications();
  //   };

  //   onStatusUpdate(handleStatusUpdate);

  //   return () => {
  //     if (offStatusUpdate) {
  //       offStatusUpdate();
  //     }
  //   };
  // }, [onStatusUpdate, offStatusUpdate, fetchEventsAndNotifications]);

  // Handler for deleting notifications
  const handleDeleteNotifications = async (ids: string[]) => {
    setDeleting(true);
    await deleteNotifications(ids);
    setDeleting(false);
    setShowAllNotifications(false);
  };

  // Handler for marking as read
  const handleMarkAsRead = async (ids: string[]) => {
    setMarkingRead(true);
    for (const id of ids) {
      const notif = notifications.find((n) => n.id === id);
      if (notif) await markNotificationAsRead(id, notif);
    }
    setMarkingRead(false);
    setShowAllNotifications(false);
  };

  return (
  <div className="w-full md:px-4 lg:px-8 md:py-2 space-y-6 md:space-y-8 relative">
    <NotificationModal
      open={showAllNotifications}
      notifications={notifications}
      readNotifications={readNotifications}
      onClose={() => setShowAllNotifications(false)}
      onDelete={handleDeleteNotifications}
      onMarkRead={handleMarkAsRead}
    />
    {/* Notification Button - Fixed Top Right */}
    <div className="absolute top-0 right-0 md:right-4 lg:right-8 z-10">
      <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full bg-white border border-gray-100 text-gray-600 hover:bg-gray-50">
            <Bell className="h-5 w-5" />
            {getUnreadCount() > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{getUnreadCount() > 9 ? '9+' : getUnreadCount()}</span>
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[calc(100vw-2rem)] sm:w-96 p-0" align="end">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    console.log('🔄 [DASHBOARD] Manual refresh triggered');
                    fetchDashboardData(userId, true);
                  }} 
                  className="h-6 w-6 p-0"
                  title="Refresh notifications"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setNotificationOpen(false)} className="h-6 w-6 p-0">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="all" className="w-full">
            <div className="px-3 py-2 border-b">
              <TabsList className="grid w-full grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs relative px-2">
                  All
                  {getUnreadCount() > 0 && (
                    <Badge variant="destructive" className="ml-1 h-3 min-w-3 text-[10px] px-1">
                      {getUnreadCount()}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="text-xs relative px-2">
                  Upcoming
                  {getUnreadCount('upcoming') > 0 && (
                    <Badge variant="destructive" className="ml-1 h-3 min-w-3 text-[10px] px-1">
                      {getUnreadCount('upcoming')}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tagged" className="text-xs relative px-2">
                  Tagged
                  {getUnreadCount('tagged') > 0 && (
                    <Badge variant="destructive" className="ml-1 h-3 min-w-3 text-[10px] px-1">
                      {getUnreadCount('tagged')}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="status" className="text-xs relative px-2">
                  Status
                  {getUnreadCount('status') > 0 && (
                    <Badge variant="destructive" className="ml-1 h-3 min-w-3 text-[10px] px-1">
                      {getUnreadCount('status')}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
              
              <div className="max-h-72 overflow-y-auto">
                <TabsContent value="all" className="mt-0">
                  <div className="space-y-0">
                    {loading ? (
                      <div className="p-4 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-xs text-gray-500 mt-2">Loading notifications...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-center">
                        <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const IconComponent = notification.icon;
                        const isRead = readNotifications.has(notification.id);
                        return (
                          <div 
                            key={notification.id} 
                            className={`p-3 hover:bg-gray-50 transition-colors border-l-2 cursor-pointer ${
                              !isRead ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-transparent bg-gray-50/50'
                            }`}
                            onClick={() => markNotificationAsRead(notification.id, notification)}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`p-1 rounded ${notification.iconColor}`}>
                                <IconComponent className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <h4 className={`font-medium text-xs leading-tight ${
                                    !isRead ? 'text-gray-900' : 'text-gray-600'
                                  }`}>{notification.title}</h4>
                                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{notification.time}</span>
                                </div>
                                <p className={`text-xs mt-1 leading-relaxed ${
                                  !isRead ? 'text-gray-600' : 'text-gray-500'
                                }`}>{renderMessageWithBoldEventTitle(notification.message)}</p>
                                {!isRead && (
                                  <Badge variant="destructive" className="text-xs mt-1 h-4 px-1">New</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="upcoming" className="mt-0">
                  <div className="space-y-1">
                    {notifications.filter(n => n.category === 'upcoming').map((notification) => {
                      const IconComponent = notification.icon;
                      const isRead = readNotifications.has(notification.id);
                      return (
                        <div 
                          key={notification.id} 
                          className={`p-4 hover:bg-gray-50 transition-colors border-l-4 cursor-pointer ${
                            !isRead ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-transparent bg-gray-50/50'
                          }`}
                          onClick={() => markNotificationAsRead(notification.id, notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-gray-100 ${notification.iconColor}`}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium text-sm ${
                                  !isRead ? 'text-gray-900' : 'text-gray-600'
                                }`}>{notification.title}</h4>
                                <span className="text-xs text-gray-500">{notification.time}</span>
                              </div>
                              <p className={`text-sm mt-1 ${
                                !isRead ? 'text-gray-600' : 'text-gray-500'
                              }`}>{renderMessageWithBoldEventTitle(notification.message)}</p>
                              {!isRead && (
                                <div className="mt-2">
                                  <Badge variant="destructive" className="text-xs">New</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                
                <TabsContent value="tagged" className="mt-0">
                  <div className="space-y-1">
                    {notifications.filter(n => n.category === 'tagged').map((notification) => {
                      const IconComponent = notification.icon;
                      const isRead = readNotifications.has(notification.id);
                      return (
                        <div 
                          key={notification.id} 
                          className={`p-4 hover:bg-gray-50 transition-colors border-l-4 cursor-pointer ${
                            !isRead ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-transparent bg-gray-50/50'
                          }`}
                          onClick={() => markNotificationAsRead(notification.id, notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-gray-100 ${notification.iconColor}`}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium text-sm ${
                                  !isRead ? 'text-gray-900' : 'text-gray-600'
                                }`}>{notification.title}</h4>
                                <span className="text-xs text-gray-500">{notification.time}</span>
                              </div>
                              <p className={`text-sm mt-1 ${
                                !isRead ? 'text-gray-600' : 'text-gray-500'
                              }`}>{renderMessageWithBoldEventTitle(notification.message)}</p>
                              {!isRead && (
                                <div className="mt-2">
                                  <Badge variant="destructive" className="text-xs">New</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                
                <TabsContent value="status" className="mt-0">
                  <div className="space-y-1">
                    {notifications.filter(n => n.category === 'status').map((notification) => {
                      const IconComponent = notification.icon;
                      const isRead = readNotifications.has(notification.id);
                      return (
                        <div 
                          key={notification.id} 
                          className={`p-4 hover:bg-gray-50 transition-colors border-l-4 cursor-pointer ${
                            !isRead ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-transparent bg-gray-50/50'
                          }`}
                          onClick={() => markNotificationAsRead(notification.id, notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-gray-100 ${notification.iconColor}`}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium text-sm ${
                                  !isRead ? 'text-gray-900' : 'text-gray-600'
                                }`}>{notification.title}</h4>
                                <span className="text-xs text-gray-500">{notification.time}</span>
                              </div>
                              <p className={`text-sm mt-1 ${
                                !isRead ? 'text-gray-600' : 'text-gray-500'
                              }`}>{renderMessageWithBoldEventTitle(notification.message)}</p>
                              {!isRead && (
                                <div className="mt-2">
                                  <Badge variant="destructive" className="text-xs">New</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </div>
              
              <div className="p-2 border-t">
                <Button variant="outline" className="w-full h-8 text-xs" onClick={() => setShowAllNotifications(true)}>
                  View All Notifications
                </Button>
              </div>
            </Tabs>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    {/* Header */}
    <div className="pr-14">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">Your events and requirements at a glance</p>
    </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {[
          { label: 'Your events', value: totalUserEvents, hint: 'Total requested by you', icon: Calendar },
          { label: 'Upcoming', value: upcomingEvents.length, hint: 'Within the next 30 days', icon: CalendarDays },
          { label: 'Department events', value: totalSystemEvents, hint: 'All events in the system', icon: Building2 },
        ].map((s) => {
          const StatIcon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-500">{s.label}</p>
                <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <StatIcon className="h-4 w-4 text-gray-500" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
                {loading ? '–' : s.value}
              </p>
              <p className="mt-1 text-xs text-gray-400">{s.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

      {/* Upcoming Events Section */}
      <section className="xl:col-span-2 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Upcoming events</h2>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-gray-500 hover:text-gray-900 -mr-2">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[72px] rounded-xl bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">No upcoming events</h3>
              <p className="text-xs text-gray-500 mt-1">Nothing scheduled in the next 30 days.</p>
            </div>
          ) : (
            upcomingEvents.map((event) => {
              const d = new Date(event.startDate);
              const st = event.status;
              const pill =
                st === 'approved' || st === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                : st === 'submitted' || st === 'pending' ? 'bg-amber-50 text-amber-700'
                : st === 'declined' || st === 'rejected' ? 'bg-red-50 text-red-700'
                : 'bg-gray-100 text-gray-600';
              const label =
                st === 'approved' ? 'Approved' : st === 'confirmed' ? 'Confirmed'
                : st === 'submitted' || st === 'pending' ? 'Pending'
                : st === 'declined' ? 'Declined' : st === 'rejected' ? 'Rejected' : st;
              return (
                <div key={event._id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                  <div className="shrink-0 w-12 rounded-lg bg-gray-50 py-1.5 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {d.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="text-lg font-semibold leading-tight text-gray-900">
                      {d.toLocaleDateString('en-US', { day: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{event.eventTitle}</h3>
                    <div className="mt-0.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.startTime)}
                      </span>
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[160px]">
                          {event.locations && event.locations.length > 0 ? event.locations.join(', ') : event.location || ''}
                        </span>
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pill}`}>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Requirements Status Overview Section */}
      <section className="xl:col-span-3 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Requirements</h2>
            <span className="text-xs text-gray-400 tabular-nums">{getFilteredRequirements(selectedEventFilter).length}</span>
          </div>
          <Select value={selectedEventFilter} onValueChange={setSelectedEventFilter}>
            <SelectTrigger className="w-full sm:w-64 h-9 text-sm bg-gray-50 border-transparent rounded-xl">
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Events ({requirementsOverview.length})
              </SelectItem>
              {getUniqueEvents().map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title} ({getFilteredRequirements(event.id).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : getFilteredRequirements(selectedEventFilter).length === 0 ? (
          <div className="text-center py-10">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
              <AlertCircle className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">
              {selectedEventFilter === 'all' ? 'No requirements' : 'No requirements for this event'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {selectedEventFilter === 'all'
                ? "You don't have any requirements in your events."
                : "This event doesn't have any requirements."}
            </p>
          </div>
        ) : (
          <div className="max-h-[560px] overflow-y-auto -mx-2 px-2 divide-y divide-gray-100 [scrollbar-width:thin]">
            {getFilteredRequirements(selectedEventFilter).map((req) => {
              const dot =
                req.status === 'confirmed' ? 'bg-emerald-500'
                : req.status === 'pending' ? 'bg-amber-500'
                : req.status === 'declined' ? 'bg-red-500'
                : req.status === 'partially_fulfill' ? 'bg-blue-500'
                : req.status === 'in_preparation' ? 'bg-violet-500'
                : 'bg-gray-400';
              const pill =
                req.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                : req.status === 'pending' ? 'bg-amber-50 text-amber-700'
                : req.status === 'declined' ? 'bg-red-50 text-red-700'
                : req.status === 'partially_fulfill' ? 'bg-blue-50 text-blue-700'
                : req.status === 'in_preparation' ? 'bg-violet-50 text-violet-700'
                : 'bg-gray-100 text-gray-600';
              const label =
                req.status === 'confirmed' ? 'Confirmed'
                : req.status === 'pending' ? 'Pending'
                : req.status === 'declined' ? 'Declined'
                : req.status === 'partially_fulfill' ? 'Partial'
                : req.status === 'in_preparation' ? 'Preparing'
                : req.status;
              return (
                <div key={`${req.eventId}-${req.id}`} className="py-4 flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-gray-900">{req.name}</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{req.department}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{req.eventTitle}</p>

                    {/* Show quantity for physical requirements, notes for service requirements */}
                    {req.quantity ? (
                      (() => {
                        let displayTotal = req.totalQuantity;
                        if (req.availabilityNotes && req.availabilityNotes.startsWith('PAVILION_DEFAULT:')) {
                          const parts = req.availabilityNotes.split(':');
                          const parsed = parseInt(parts[1], 10);
                          if (!isNaN(parsed)) {
                            displayTotal = parsed;
                          }
                        }
                        return (
                          <p className="text-xs text-gray-500 mt-1.5">
                            Requested <span className="font-medium text-gray-700">{req.quantity}</span> of <span className="font-medium text-gray-700">{displayTotal || 'N/A'}</span> available
                          </p>
                        );
                      })()
                    ) : req.notes && (
                      <p className="text-xs text-gray-600 mt-1.5 break-words">
                        <span className="text-gray-400">Your notes: </span>{req.notes}
                      </p>
                    )}

                    {req.departmentNotes && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-medium text-gray-500 mb-0.5">Department notes</p>
                        <p className="text-xs text-gray-700 break-words">{req.departmentNotes}</p>
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pill}`}>{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      </div>
      
      {/* Separate Toaster for popup notifications only */}
      <Toaster 
        position="bottom-right" 
        richColors 
        closeButton 
        duration={5000}
        toastOptions={{
          style: {
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
        }}
      />
    </div>
  );
};

export default Dashboard;
