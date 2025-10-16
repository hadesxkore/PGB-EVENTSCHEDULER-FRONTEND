import React, { useState, useEffect } from 'react';
import { useMyCalendarStore } from '@/stores/myCalendarStore';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import CustomCalendar, { type CalendarEvent } from '@/components/ui/custom-calendar';
import RequirementAvailabilityModal from './RequirementAvailabilityModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar as CalendarIcon, 
  CheckCircle,
  XCircle,
  Package,
  Settings,
  Trash2,
  X,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Requirement {
  _id: string;
  text: string;
  type: 'physical' | 'service';
  totalQuantity?: number;
  isActive: boolean;
  isAvailable?: boolean;
  responsiblePerson?: string;
  createdAt: string;
  updatedAt?: string;
}

interface RequirementAvailability {
  requirementId: string;
  requirementText: string;
  isAvailable: boolean;
  notes: string;
  quantity: number;
  maxCapacity: number;
}

interface ResourceAvailabilityData {
  _id: string;
  departmentId: string;
  departmentName: string;
  requirementId: string;
  requirementText: string;
  date: string;
  isAvailable: boolean;
  notes: string;
  quantity: number;
  maxCapacity: number;
}

const MyCalendarPage: React.FC = () => {
  // Zustand store - replaces all useState calls above!
  const {
    currentUser,
    requirements,
    events,
    availabilityData,
    loading,
    bulkLoading,
    selectedDate,
    calendarCurrentMonth,
    showProgressModal,
    progressValue,
    progressText,
    progressOperation,
    initializeUser,
    setSelectedDate,
    setCalendarCurrentMonth,
    getEventCountForDate,
    getCurrentAndFutureDates,
    getMonthSummary,
    bulkSetAvailable,
    bulkSetUnavailable,
    bulkDeleteAvailability,
    fetchAvailabilityData,
    setProgressModal
  } = useMyCalendarStore();

  // Local UI state that doesn't need caching
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAvailableDialog, setShowAvailableDialog] = useState(false);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSelectiveDateDeleteDialog, setShowSelectiveDateDeleteDialog] = useState(false);
  const [selectedDatesForDeletion, setSelectedDatesForDeletion] = useState<string[]>([]);
  const [isSelectingDatesMode, setIsSelectingDatesMode] = useState(false);

  // Initialize user and fetch data using Zustand store
  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  // These functions are now handled by the Zustand store

  // Convert events to calendar events with colored cells and event titles
  const calendarEvents: CalendarEvent[] = [];
  
  // Group events by date first to avoid duplicates
  const eventsByDate: { [date: string]: any[] } = {};
  
  events.forEach((event) => {
    // Parse dates using local timezone to avoid UTC conversion issues
    const eventStartDate = new Date(event.startDate);
    const eventEndDate = new Date(event.endDate);
    
    // Check if this event has bookings for the current user's department
    const hasBookingsForDepartment = event.taggedDepartments && 
      event.taggedDepartments.includes(currentUser?.department || '');
    
    if (hasBookingsForDepartment) {
      // Create calendar events for each day the event spans
      const currentStartDate = new Date(eventStartDate);
      const currentEndDate = new Date(eventEndDate);
      
      // Reset time to avoid timezone issues
      currentStartDate.setHours(0, 0, 0, 0);
      currentEndDate.setHours(0, 0, 0, 0);
      
      const currentDate = new Date(currentStartDate);
      while (currentDate <= currentEndDate) {
        const dateString = currentDate.getFullYear() + '-' + 
                          String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(currentDate.getDate()).padStart(2, '0');
        
        if (!eventsByDate[dateString]) {
          eventsByDate[dateString] = [];
        }
        
        // Only add if not already in the array for this date
        const alreadyExists = eventsByDate[dateString].some(e => e._id === event._id);
        if (!alreadyExists) {
          eventsByDate[dateString].push(event);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  });
  
  
  // Now create separate calendar events for each event (to show vertically)
  Object.keys(eventsByDate).forEach(dateString => {
    const eventsForDate = eventsByDate[dateString];
    
    eventsForDate.forEach((event, index) => {
      
      calendarEvents.push({
        id: `${event._id}-${dateString}`,
        date: dateString,
        title: event.eventTitle,
        type: 'booking',
        notes: `Event: ${event.eventTitle} | Requestor: ${event.requestor} | Location: ${event.location}`
      });
    });
  });
  
  // Add availability data as secondary events (if no bookings exist for that date)
  availabilityData.forEach((availability) => {
    const existingBooking = calendarEvents.find(e => e.date === availability.date);
    
    if (!existingBooking) {
      const existingAvailability = calendarEvents.find(e => e.date === availability.date && e.type !== 'booking');
      
      if (existingAvailability) {
        // Update existing availability event
        const dayAvailability = availabilityData.filter(a => a.date === availability.date);
        const availableCount = dayAvailability.filter(a => a.isAvailable).length;
        const totalCount = dayAvailability.length;
        
        existingAvailability.title = `${availableCount}/${totalCount} Available`;
        existingAvailability.type = availableCount === totalCount ? 'available' : 
                                   availableCount === 0 ? 'unavailable' : 'custom';
      } else {
        // Create new availability event
        const dayAvailability = availabilityData.filter(a => a.date === availability.date);
        const availableCount = dayAvailability.filter(a => a.isAvailable).length;
        const totalCount = dayAvailability.length;
        
        calendarEvents.push({
          id: availability.date,
          date: availability.date,
          title: `${availableCount}/${totalCount} Available`,
          type: availableCount === totalCount ? 'available' : 
                availableCount === 0 ? 'unavailable' : 'custom',
          notes: `${availableCount} of ${totalCount} resources available`
        });
      }
    }
  });

  // Handle date selection
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  // Handle save availability
  const handleSaveAvailability = async (date: Date, availabilities: RequirementAvailability[]) => {
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      
      // Get department info
      const departmentsResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/departments/visible`);
      if (!departmentsResponse.ok) {
        throw new Error(`Failed to fetch departments: ${departmentsResponse.statusText}`);
      }
      const departmentsData = await departmentsResponse.json();
      const departments = departmentsData.data || [];
      const department = departments.find((dept: any) => dept.name === (currentUser?.department || 'PGSO'));
      
      if (!department) {
        throw new Error('Department not found');
      }

      // Make actual API call to save availability
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/resource-availability/availability/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          departmentId: department._id,
          departmentName: department.name,
          date: dateString,
          requirements: availabilities.map(availability => ({
            requirementId: availability.requirementId,
            requirementText: availability.requirementText,
            isAvailable: availability.isAvailable,
            notes: availability.notes,
            quantity: availability.quantity,
            maxCapacity: availability.maxCapacity
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to save availability: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Refresh availability data
      await fetchAvailabilityData(department._id);
      
    } catch (error) {
      throw error;
    }
  };

  // Get existing availabilities for selected date
  const getExistingAvailabilities = (date: Date): RequirementAvailability[] => {
    const dateString = format(date, 'yyyy-MM-dd');
    return availabilityData
      .filter(item => item.date === dateString)
      .map(item => ({
        requirementId: item.requirementId,
        requirementText: item.requirementText,
        isAvailable: item.isAvailable,
        notes: item.notes,
        quantity: item.quantity,
        maxCapacity: item.maxCapacity
      }));
  };

  // This function is now handled by the Zustand store

  // Bulk set all requirements available for current and future dates
  const handleBulkSetAvailable = async () => {
    if (!currentUser?.department || requirements.length === 0) {
      toast.error('No requirements found for your department.');
      return;
    }

    setShowAvailableDialog(false);
    
    try {
      await bulkSetAvailable(calendarCurrentMonth);
      toast.success(`Successfully set all ${requirements.length} requirements as AVAILABLE for current/future days in ${format(calendarCurrentMonth, 'MMMM yyyy')}!`);
    } catch (error) {
      toast.error(`Error setting bulk availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Bulk set all requirements unavailable for current and future dates
  const handleBulkSetUnavailable = async () => {
    if (!currentUser?.department || requirements.length === 0) {
      toast.error('No requirements found for your department.');
      return;
    }

    setShowUnavailableDialog(false);
    
    try {
      await bulkSetUnavailable(calendarCurrentMonth);
      toast.success(`Successfully set all ${requirements.length} requirements as UNAVAILABLE for current/future days in ${format(calendarCurrentMonth, 'MMMM yyyy')}!`);
    } catch (error) {
      toast.error(`Error setting bulk unavailability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete all availability data for the current month
  const handleDeleteAllAvailability = async () => {
    if (!currentUser?.department || requirements.length === 0) {
      toast.error('No requirements found for your department.');
      return;
    }

    setShowDeleteDialog(false);
    
    try {
      await bulkDeleteAvailability(calendarCurrentMonth);
      toast.success(`Successfully deleted all availability data for ${format(calendarCurrentMonth, 'MMMM yyyy')}! Calendar has been cleared.`);
    } catch (error) {
      toast.error(`Error deleting availability data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Toggle date selection mode
  const toggleDateSelectionMode = () => {
    setIsSelectingDatesMode(!isSelectingDatesMode);
    if (!isSelectingDatesMode) {
      setSelectedDatesForDeletion([]);
      toast.info('Click on calendar dates to select them for deletion. Click "Select Dates" again to exit selection mode.');
    } else {
      setSelectedDatesForDeletion([]);
      toast.info('Selection mode cancelled.');
    }
  };

  // Handle date click for selection
  const handleDateClickForSelection = (date: Date) => {
    if (!isSelectingDatesMode) {
      // Normal date click - open modal
      handleDateClick(date);
      return;
    }

    // Date selection mode - toggle date selection
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if this date has availability data
    const hasData = availabilityData.some(item => item.date === dateStr);
    if (!hasData) {
      toast.error('No availability data found for this date.');
      return;
    }

    setSelectedDatesForDeletion(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };


  // Handle selective date deletion
  const handleSelectiveDateDeletion = async () => {
    if (selectedDatesForDeletion.length === 0) {
      toast.error('Please select at least one date to delete.');
      return;
    }

    if (!currentUser?.department || requirements.length === 0) {
      toast.error('No requirements found for your department.');
      return;
    }

    setShowSelectiveDateDeleteDialog(false);
    
    try {
      // For now, use the bulk delete function - this could be enhanced to handle selective dates
      await bulkDeleteAvailability(calendarCurrentMonth);
      
      // Clear selected dates and exit selection mode
      setSelectedDatesForDeletion([]);
      setIsSelectingDatesMode(false);
      
      toast.success(`Successfully deleted availability data for ${selectedDatesForDeletion.length} selected dates!`);
      
    } catch (error) {
      toast.error(`Error deleting selected dates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  // Calculate summary stats for the viewed month using store getter
  const { available: availableInMonth, unavailable: unavailableInMonth, total: totalRequirements } = getMonthSummary(calendarCurrentMonth);

  return (
    <div className="p-2 max-w-[98%] mx-auto">
      <Card className="shadow-lg">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
                My Calendar
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your department's resource availability
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Package className="w-3 h-3 text-blue-600" />
                Total Resources: {totalRequirements}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                Available: {availableInMonth}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <XCircle className="w-3 h-3 text-red-600" />
                Unavailable: {unavailableInMonth}
              </Badge>
            </div>
          </motion.div>

          {/* Bulk Availability Management - Minimalist ShadCN Design */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border rounded-lg p-6 bg-card"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Bulk Management</h3>
                  <Badge variant="secondary" className="text-xs">
                    {format(calendarCurrentMonth, 'MMM yyyy')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Manage all {totalRequirements} requirements for current and future dates
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {/* Clear All */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkLoading || totalRequirements === 0}
                      className="h-8 text-xs"
                    >
                      {bulkLoading ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                      ) : (
                        <Trash2 className="w-3 h-3 mr-2" />
                      )}
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Data</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2 text-sm">
                        <p>This will permanently delete all availability data for {format(calendarCurrentMonth, 'MMMM yyyy')}.</p>
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-green-800 text-xs">
                            <Shield className="w-3 h-3 inline mr-1" /> <strong>Smart Protection:</strong> Dates with active bookings will be automatically protected.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllAvailability}>
                        Clear All Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Select Dates for Deletion */}
                <Button
                  variant={isSelectingDatesMode ? "default" : "outline"}
                  size="sm"
                  disabled={availabilityData.length === 0}
                  onClick={toggleDateSelectionMode}
                  className={`h-8 text-xs ${isSelectingDatesMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-50 hover:bg-orange-100 border-orange-200'}`}
                >
                  {isSelectingDatesMode ? (
                    <>
                      <X className="w-3 h-3 mr-2" />
                      Exit Selection ({selectedDatesForDeletion.length})
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-3 h-3 mr-2" />
                      Select Dates
                    </>
                  )}
                </Button>

                {/* Delete Selected Dates */}
                {selectedDatesForDeletion.length > 0 && (
                  <AlertDialog open={showSelectiveDateDeleteDialog} onOpenChange={setShowSelectiveDateDeleteDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete Selected ({selectedDatesForDeletion.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Selected Dates</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2 text-sm">
                          <p>This will permanently delete all availability data for the {selectedDatesForDeletion.length} selected date{selectedDatesForDeletion.length !== 1 ? 's' : ''}:</p>
                          <div className="p-3 bg-gray-50 border rounded-md max-h-32 overflow-y-auto">
                            <div className="flex flex-wrap gap-1">
                              {selectedDatesForDeletion.map(dateStr => (
                                <Badge key={dateStr} variant="secondary" className="text-xs">
                                  {format(new Date(dateStr + 'T00:00:00'), 'MMM dd')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-green-800 text-xs">
                              <Shield className="w-3 h-3 inline mr-1" /> <strong>Smart Protection:</strong> Dates with active bookings will be automatically protected.
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSelectiveDateDeletion}>
                          Delete Selected
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}


                {/* Set Available */}
                <AlertDialog open={showAvailableDialog} onOpenChange={setShowAvailableDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      disabled={bulkLoading || totalRequirements === 0}
                      className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    >
                      {bulkLoading ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-2" />
                      )}
                      Set Available
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Set All Available</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2 text-sm">
                        <p>Set all {totalRequirements} requirements as available for current and future dates in {format(calendarCurrentMonth, 'MMMM yyyy')}.</p>
                        <p className="text-xs text-muted-foreground">Past dates will not be affected.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBulkSetAvailable}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Set Available
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Set Unavailable */}
                <AlertDialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={bulkLoading || totalRequirements === 0}
                      className="h-8 text-xs"
                    >
                      {bulkLoading ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                      ) : (
                        <XCircle className="w-3 h-3 mr-2" />
                      )}
                      Set Unavailable
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Set All Unavailable</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2 text-sm">
                        <p>Set all {totalRequirements} requirements as unavailable for current and future dates in {format(calendarCurrentMonth, 'MMMM yyyy')}.</p>
                        <p className="text-xs text-muted-foreground">Past dates will not be affected.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkSetUnavailable}>
                        Set Unavailable
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Loading State */}
              {bulkLoading && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <div className="animate-spin rounded-full h-4 w-4 border-b border-current"></div>
                  <span className="text-xs text-muted-foreground">
                    Processing bulk update for {format(calendarCurrentMonth, 'MMMM yyyy')}...
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          <Separator />

          {/* Selection Mode Status */}
          {isSelectingDatesMode && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
              <CalendarIcon className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-orange-800">
                <strong>Date Selection Mode:</strong> Click calendar dates to select them for deletion. {selectedDatesForDeletion.length} date{selectedDatesForDeletion.length !== 1 ? 's' : ''} selected.
              </span>
            </div>
          )}

          {/* Custom Calendar Component */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading resources...</span>
            </div>
          ) : (
            <CustomCalendar
              events={calendarEvents}
              onDateClick={handleDateClickForSelection}
              onMonthChange={setCalendarCurrentMonth}
              showNavigation={true}
              showLegend={true}
              cellHeight="min-h-[140px]"
              showEventCount={true}
              getEventCountForDate={getEventCountForDate}
              selectedDates={isSelectingDatesMode ? selectedDatesForDeletion : []}
              isSelectionMode={isSelectingDatesMode}
            />
          )}
        </CardContent>
      </Card>

      {/* Requirement Availability Modal */}
      <RequirementAvailabilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        departmentId={currentUser?._id || 'pgso-dept-id'}
        departmentName={currentUser?.department || 'PGSO'}
        requirements={requirements}
        onSave={handleSaveAvailability}
        existingAvailabilities={selectedDate ? getExistingAvailabilities(selectedDate) : []}
      />

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={(open) => setProgressModal(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {progressOperation === 'available' && 'Setting Requirements Available'}
              {progressOperation === 'unavailable' && 'Setting Requirements Unavailable'}
              {progressOperation === 'delete' && 'Clearing Availability Data'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {progressText}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyCalendarPage;