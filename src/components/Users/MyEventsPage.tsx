import React, { useState, useEffect, useMemo } from 'react';

import { motion } from 'framer-motion';

import axios from 'axios';

import { toast } from 'sonner';

import { format } from 'date-fns';
import { getPavilionSoundSystemMaxQuantity } from '@/lib/pavilionHelpers';
import { getGlobalSocket, useSocket } from '@/hooks/useSocket';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { Textarea } from '@/components/ui/textarea';

import { Checkbox } from '@/components/ui/checkbox';

import { Separator } from '@/components/ui/separator';

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from '@/components/ui/select';

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogHeader,

  DialogTitle,

} from '@/components/ui/dialog';

import {

  AlertDialog,

  AlertDialogAction,

  AlertDialogCancel,

  AlertDialogContent,

  AlertDialogDescription,

  AlertDialogFooter,

  AlertDialogHeader,

  AlertDialogTitle,

} from '@/components/ui/alert-dialog';

import { Calendar } from '@/components/ui/calendar';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

import { Label } from '@/components/ui/label';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Skeleton } from '@/components/ui/skeleton';

import {

  Calendar as CalendarIcon,

  Clock,

  MapPin,

  Users,

  Building2,

  FileText,

  Search,

  Filter,

  Eye,

  Trash2,

  Plus,

  RefreshCw,

  CheckCircle,

  XCircle,

  AlertCircle,

  Clock3,

  Download,

  Paperclip,

  Edit,

  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  MoreHorizontal,

  AlertTriangle,

  HelpCircle,

  Loader2,

  MessageSquare,

  Package,

  Settings,

  Check,

  X,
  Sparkles,
  Wand2,
  Info,
  Ban

} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';



interface Event {

  _id: string;

  eventTitle: string;

  requestor: string;

  location: string;

  locations?: string[]; // Array for multiple conference rooms

  multipleLocations?: boolean;

  roomType?: string; // Room type for the location

  description?: string;

  participants: number;

  vip?: number;

  vvip?: number;

  eventType?: 'simple-meeting' | 'simple' | 'complex'; // Event type for date restrictions

  startDate: string;

  startTime: string;

  endDate: string;

  endTime: string;

  dateTimeSlots?: Array<{

    startDate: string;

    startTime: string;

    endDate: string;

    endTime: string;

  }>; // Additional date/time slots for multi-day events

  contactNumber: string;

  contactEmail: string;

  attachments?: Array<{

    filename: string;

    originalName: string;

    mimetype: string;

    size: number;

  }>;

  govFiles?: {

    brieferTemplate?: {

      filename: string;

      originalName: string;

      mimetype: string;

      size: number;

    };

    programme?: {

      filename: string;

      originalName: string;

      mimetype: string;

      size: number;

    };

    availableForDL?: {

      filename: string;

      originalName: string;

      mimetype: string;

      size: number;

    };

  };

  taggedDepartments: string[];

  departmentRequirements: any;

  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'ongoing';

  reason?: string;

  cancelledBy?: {
    userId?: string;
    name: string;
    email: string;
    role: string;
  };

  cancelledAt?: string;

  bacApprovalStatus?: 'pending' | 'approved' | 'rejected';

  bacApprovedAt?: string;

  bacApprovedBy?: string;

  bacNotes?: string;

  submittedAt?: string;

  createdAt: string;

  updatedAt: string;

}

interface AutoSuggestedLocation {
  name: string;
  chairs: number;
  isMulti: boolean;
  rooms: string[];
  note?: string;
  isBooked: boolean;
  bookedOnDates: string[];
  seatsLabel?: string;
}

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;



const locations = [

  'Add Custom Location',

  'Atrium',

  'Grand Lobby Entrance',

  'Main Entrance Lobby',

  'Main Entrance Leasable Area',

  '4th Flr. Conference Room 1',

  '4th Flr. Conference Room 2',

  '4th Flr. Conference Room 3',

  '5th Flr. Training Room 1 (BAC)',

  '5th Flr. Training Room 2',

  '6th Flr. DPOD',

  'Bataan People\'s Center',

  'Capitol Quadrangle',

  '1BOSSCO',

  'Emiliana Hall',

  'Pavilion - Kagitingan Hall (Entire)',

  'Pavilion - Kagitingan Hall - Section A',

  'Pavilion - Kagitingan Hall - Section B',

  'Pavilion - Kagitingan Hall - Section C',

  'Pavilion - Kalayaan Ballroom (Entire)',

  'Pavilion - Kalayaan Ballroom'

];



const MyEventsPage: React.FC = () => {

  const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');

  const userId = currentUser._id || currentUser.id || 'unknown';



  const [events, setEvents] = useState<Event[]>([]);

  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [sortBy, setSortBy] = useState<string>('newest');

  const [activeTab, setActiveTab] = useState<string>('All');

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (eventId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const [selectedEventDepartments, setSelectedEventDepartments] = useState<any>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditEvent, setSelectedEditEvent] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    location: '',
    locations: [] as string[],
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    dateTimeSlots: [] as { id?: string; date: Date; startTime: string; endTime: string }[],
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [venueConflictingEvents, setVenueConflictingEvents] = useState<any[]>([]);
  const [conflictingEvents, setConflictingEvents] = useState<any[]>([]);
  const [showCustomLocationInput, setShowCustomLocationInput] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  const [showAutoSuggestModal, setShowAutoSuggestModal] = useState(false);
  const [autoSuggestParticipants, setAutoSuggestParticipants] = useState('');
  const [autoSuggestStartDate, setAutoSuggestStartDate] = useState<Date | undefined>(undefined);
  const [autoSuggestEndDate, setAutoSuggestEndDate] = useState<Date | undefined>(undefined);
  const [autoSuggestStartTime, setAutoSuggestStartTime] = useState('');
  const [autoSuggestEndTime, setAutoSuggestEndTime] = useState('');
  const [suggestedLocations, setSuggestedLocations] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [viewedTaggedRequirementsEvents, setViewedTaggedRequirementsEvents] = useState<Set<string>>(

    new Set(JSON.parse(localStorage.getItem('viewedTaggedRequirementsEvents') || '[]'))

  );



  // Track when each event was last viewed (timestamp)

  const [lastViewedTimestamps, setLastViewedTimestamps] = useState<{ [eventId: string]: number }>(

    JSON.parse(localStorage.getItem('lastViewedTimestamps') || '{}')

  );



  // Socket helpers for status updates

  const { onStatusUpdate, offStatusUpdate } = useSocket(userId);



  // Mark My Events badge as viewed when events are loaded

  useEffect(() => {

    if (events.length > 0 && !loading) {

      // Set flag in localStorage to indicate user has viewed My Events

      localStorage.setItem('myEventsBadgeViewed', 'true');



      // Dispatch custom event to notify sidebar to hide badge

      window.dispatchEvent(new CustomEvent('myEventsBadgeViewed'));

    }

  }, [events, loading]);



  useEffect(() => {

    const id = setTimeout(() => {

      setDebouncedSearchTerm(searchTerm);

    }, 200);

    return () => clearTimeout(id);

  }, [searchTerm]);



  useEffect(() => {

    setVisibleCount(20);

  }, [debouncedSearchTerm, statusFilter, sortBy]);



  // Realtime reply updates via Socket.IO (for requirement conversations)

  useEffect(() => {

    const socket = getGlobalSocket();

    if (!socket) return;



    const handleReplyUpdate = async (data: any) => {

      if (!data || !data.eventId) return;



      try {

        const token = localStorage.getItem('authToken');

        const response = await axios.get(`${API_BASE_URL}/events/${data.eventId}`, {

          headers: {

            'Authorization': token ? `Bearer ${token}` : '',

            'Content-Type': 'application/json'

          }

        });



        if (response.data?.success && response.data.data) {

          const updatedEvent = response.data.data as Event;



          // Reset viewed status FIRST so badge shows again with new updates

          setViewedTaggedRequirementsEvents(prev => {

            const newSet = new Set(prev);

            newSet.delete(data.eventId);

            localStorage.setItem('viewedTaggedRequirementsEvents', JSON.stringify(Array.from(newSet)));

            return newSet;

          });



          // Update main events list with new object reference

          setEvents(prev => prev.map(ev => (ev._id === updatedEvent._id ? { ...updatedEvent } : ev)));



          // Update currently open Tagged Departments modal event, if matches

          setSelectedEventDepartments(prev => (prev && prev._id === updatedEvent._id ? updatedEvent : prev));

        }

      } catch (error) {

      }

    };



    const handleRequirementNoteUpdate = async (data: any) => {

      if (!data || !data.eventId) return;



      try {

        const token = localStorage.getItem('authToken');

        const response = await axios.get(`${API_BASE_URL}/events/${data.eventId}`, {

          headers: {

            'Authorization': token ? `Bearer ${token}` : '',

            'Content-Type': 'application/json'

          }

        });



        if (response.data?.success && response.data.data) {

          const updatedEvent = response.data.data as Event;



          // Reset viewed status FIRST so badge shows again with new updates

          setViewedTaggedRequirementsEvents(prev => {

            const newSet = new Set(prev);

            newSet.delete(data.eventId);

            localStorage.setItem('viewedTaggedRequirementsEvents', JSON.stringify(Array.from(newSet)));

            return newSet;

          });



          // Update main events list with new object reference - this will trigger re-render and update badge

          setEvents(prev => prev.map(ev => (ev._id === updatedEvent._id ? { ...updatedEvent } : ev)));



          // IMPORTANT: Always update the modal with fresh data

          // This ensures the modal shows the latest department notes in real-time

          setSelectedEventDepartments(prev => (prev && prev._id === updatedEvent._id ? { ...updatedEvent } : prev));

        }

      } catch (error) {

      }

    };



    if (socket.connected) {

      socket.on('reply-update', handleReplyUpdate);

      socket.on('requirement-note-update', handleRequirementNoteUpdate);

    } else {

      socket.once('connect', () => {

        socket.on('reply-update', handleReplyUpdate);

        socket.on('requirement-note-update', handleRequirementNoteUpdate);

      });

    }



    return () => {

      socket.off('reply-update', handleReplyUpdate);

      socket.off('requirement-note-update', handleRequirementNoteUpdate);

    };

  }, [selectedEventDepartments]);



  // Realtime requirement status updates via Socket.IO

  useEffect(() => {

    if (typeof onStatusUpdate !== 'function') {

      return;

    }



    const handleStatusUpdate = async (data: any) => {

      if (!data || !data.eventId) return;



      try {

        const token = localStorage.getItem('authToken');

        const response = await axios.get(`${API_BASE_URL}/events/${data.eventId}`, {

          headers: {

            'Authorization': token ? `Bearer ${token}` : '',

            'Content-Type': 'application/json'

          }

        });



        if (response.data?.success && response.data.data) {

          const updatedEvent = response.data.data as Event;



          // Update main events list

          setEvents(prev => prev.map(ev => (ev._id === updatedEvent._id ? updatedEvent : ev)));



          // Update currently open Tagged Departments modal event, if matches

          setSelectedEventDepartments(prev => (prev && prev._id === updatedEvent._id ? updatedEvent : prev));



          // Reset viewed flag for this event's badge if there are new updates

          if (getTaggedUpdatesCount(updatedEvent) > 0) {

            const newViewedSet = new Set(viewedTaggedRequirementsEvents);

            newViewedSet.delete(updatedEvent._id);

            setViewedTaggedRequirementsEvents(newViewedSet);

            localStorage.setItem('viewedTaggedRequirementsEvents', JSON.stringify(Array.from(newViewedSet)));

          }

        }

      } catch (error) {

      }

    };



    onStatusUpdate(handleStatusUpdate);



    return () => {

      if (typeof offStatusUpdate === 'function') {

        offStatusUpdate();

      }

    };

  }, [onStatusUpdate, offStatusUpdate]);



  // Edit Event Details Modal State (for on-hold events)

  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);

  const [editDetailsData, setEditDetailsData] = useState({

    eventTitle: '',

    requestor: '',

    participants: 0,

    vip: 0,

    vvip: 0,

    contactNumber: '',

    contactEmail: '',

    description: ''

  });



  // File upload state for edit details modal

  const [editAttachments, setEditAttachments] = useState<File[]>([]);

  const [editBrieferTemplate, setEditBrieferTemplate] = useState<File[]>([]);

  const [editProgramme, setEditProgramme] = useState<File[]>([]);



  const [pendingFileDelete, setPendingFileDelete] = useState<null | {

    kind: 'attachment' | 'gov';

    eventId: string;

    filename: string;

    label: string;

    fileKey?: 'brieferTemplate' | 'programme' | 'availableForDL';

  }>(null);

  const [deletingFile, setDeletingFile] = useState(false);



  const handleConfirmDeleteFile = async () => {

    if (!pendingFileDelete) return;

    try {

      setDeletingFile(true);

      const token = localStorage.getItem('authToken');



      const url = pendingFileDelete.kind === 'attachment'

        ? `${API_BASE_URL}/events/${pendingFileDelete.eventId}/attachment/${encodeURIComponent(pendingFileDelete.filename)}`

        : `${API_BASE_URL}/events/${pendingFileDelete.eventId}/govfile/${pendingFileDelete.fileKey}/${encodeURIComponent(pendingFileDelete.filename)}`;



      const response = await axios.delete(url, {

        headers: {

          'Authorization': token ? `Bearer ${token}` : '',

          'Content-Type': 'application/json'

        }

      });



      const updatedEvent = response.data?.data || response.data?.event;

      if (updatedEvent?._id) {

        setEvents(prev => prev.map(ev => (ev._id === updatedEvent._id ? updatedEvent : ev)));

        setSelectedEditEvent(prev => (prev && prev._id === updatedEvent._id ? updatedEvent : prev));

      } else {

        fetchMyEvents();

      }



      toast.success('File deleted successfully');

    } catch (error: any) {

      toast.error(error.response?.data?.message || 'Failed to delete file');

    } finally {

      setDeletingFile(false);

      setPendingFileDelete(null);

    }

  };



  // Change Department Modal State

  const [showChangeDepartmentModal, setShowChangeDepartmentModal] = useState(false);

  const [changingRequirement, setChangingRequirement] = useState<any>(null);

  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');



  // Add More Departments Modal State

  const [showAddDepartmentsModal, setShowAddDepartmentsModal] = useState(false);

  const [addingToEvent, setAddingToEvent] = useState<any>(null);

  const [showDepartmentRequirementsModal, setShowDepartmentRequirementsModal] = useState(false);

  const [selectedDepartmentData, setSelectedDepartmentData] = useState<any>(null);

  const [departmentRequirements, setDepartmentRequirements] = useState<any[]>([]);

  const [addDepartmentSearchQuery, setAddDepartmentSearchQuery] = useState('');



  const [customRequirement, setCustomRequirement] = useState<string>('');

  const [customRequirementType, setCustomRequirementType] = useState<'physical' | 'service'>('service');

  const [pendingCustomQuantity, setPendingCustomQuantity] = useState<string>('1');

  const [showCustomInput, setShowCustomInput] = useState(false);

  const [visibleCount, setVisibleCount] = useState(20);
  const [showCancelEventModal, setShowCancelEventModal] = useState(false);
  const [showEditRequirementModal, setShowEditRequirementModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showDepartmentsModal, setShowDepartmentsModal] = useState(false);
  const [cancelEventReason, setCancelEventReason] = useState('');
  const [cancellingEvent, setCancellingEvent] = useState<any>(null);
  const [isCancellingEvent, setIsCancellingEvent] = useState(false);
  const [selectedEventFiles, setSelectedEventFiles] = useState<any>(null);
  const [editingRequirement, setEditingRequirement] = useState<any>(null);
  const [editRequirementData, setEditRequirementData] = useState({ quantity: 0, notes: '' });
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [requirementReplyDrafts, setRequirementReplyDrafts] = useState<{ [reqId: string]: string }>({});
  const [loadingAutoSuggest, setLoadingAutoSuggest] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [allEventsOnDate, setAllEventsOnDate] = useState<any[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const fetchLocationRequirementsForEvent = async (event: any) => {

    try {

      const token = localStorage.getItem('authToken');

      if (!token) return [] as Array<{ name: string; quantity: number }>;



      const response = await fetch(`${API_BASE_URL}/location-requirements`, {

        headers: { 'Authorization': `Bearer ${token}` }

      });

      if (!response.ok) return [];



      const raw = await response.json();



      const unwrapArray = (value: any): any[] => {

        if (Array.isArray(value)) return value;

        if (value && typeof value === 'object') {

          if (Array.isArray(value.data)) return value.data;

          if (value.data && typeof value.data === 'object' && Array.isArray(value.data.data)) return value.data.data;

          if (Array.isArray(value.requirements)) return value.requirements;

        }

        return [];

      };



      const allDocs: any[] = unwrapArray(raw);



      const normalizeLocation = (s: any) =>

        String(s || '')

          .toLowerCase()

          .trim()

          .replace(/\s+/g, ' ')

          .replace(/[’']/g, "'");



      const selectedLocationsRaw: string[] = Array.isArray(event?.locations) && event.locations.length > 0

        ? event.locations

        : (event?.location ? [event.location] : []);



      const selectedLocations = selectedLocationsRaw

        .map((l) => String(l))

        .filter((l) => l.trim().length > 0);



      const selectedLocationsNorm = selectedLocations.map(normalizeLocation);



      if (selectedLocations.length === 0) return [];



      const pickMostSpecific = (docs: any[]) => {

        if (!docs.length) return null;

        return docs.reduce((best, doc) => {

          if (!best) return doc;

          const bestLen = best.locationNames && Array.isArray(best.locationNames) && best.locationNames.length > 0

            ? best.locationNames.length

            : 1;

          const len = doc.locationNames && Array.isArray(doc.locationNames) && doc.locationNames.length > 0

            ? doc.locationNames.length

            : 1;

          return len < bestLen ? doc : best;

        }, null as any);

      };



      const getRequirementsForSingleLocation = (locNorm: string) => {

        const exactMatch = allDocs.find((doc: any) => {

          const docLocations: string[] = doc.locationNames && Array.isArray(doc.locationNames)

            ? doc.locationNames

            : (doc.locationName ? [doc.locationName] : []);

          const docNorm = docLocations.map(normalizeLocation);

          return docNorm.length === 1 && docNorm[0] === locNorm;

        });



        const groupMatches = allDocs.filter((doc: any) => {

          if (doc.locationNames && Array.isArray(doc.locationNames)) {

            const docNorm = doc.locationNames.map(normalizeLocation);

            return docNorm.length > 1 && docNorm.includes(locNorm);

          }

          return false;

        });



        const candidateDocs: any[] = [];

        if (exactMatch) candidateDocs.push(exactMatch);

        candidateDocs.push(...groupMatches);

        if (candidateDocs.length === 0) return [] as any[];



        const requirementDocs = candidateDocs.filter((doc) => Array.isArray(doc.requirements) && doc.requirements.length > 0);

        const requirementsSource = requirementDocs.length > 0

          ? pickMostSpecific(requirementDocs)

          : exactMatch || groupMatches[0] || null;



        const reqs = requirementsSource && Array.isArray(requirementsSource.requirements)

          ? requirementsSource.requirements

          : [];



        return Array.isArray(reqs) ? reqs : [];

      };



      // Multi-location events: merge defaults per location (sum quantities by name)

      if (selectedLocationsNorm.length > 1) {

        const merged = new Map<string, number>();

        selectedLocationsNorm.forEach((locNorm) => {

          const reqs = getRequirementsForSingleLocation(locNorm);

          reqs.forEach((r: any) => {

            const name = r?.name;

            const qtyRaw = r?.quantity;

            const qty = typeof qtyRaw === 'number'

              ? qtyRaw

              : typeof qtyRaw === 'string'

                ? parseInt(qtyRaw, 10)

                : 0;

            if (typeof name === 'string' && name.trim().length > 0) {

              merged.set(name, (merged.get(name) || 0) + (Number.isFinite(qty) ? qty : 0));

            }

          });

        });



        const mergedReqs = Array.from(merged.entries()).map(([name, quantity]) => ({ name, quantity }));
        return mergedReqs.map((r) => {
          if (/sound system/i.test(r.name)) {
            const maxSoundQty = getPavilionSoundSystemMaxQuantity(event?.location, event?.locations, r.quantity);
            return { ...r, quantity: maxSoundQty };
          }
          return r;
        });

      }



      // Single location: keep original behavior (most specific doc)

      const singleReqs = getRequirementsForSingleLocation(selectedLocationsNorm[0]);
      return singleReqs.map((r: any) => {
        if (/sound system/i.test(r.name)) {
          const maxSoundQty = getPavilionSoundSystemMaxQuantity(event?.location, event?.locations, r.quantity);
          return { ...r, quantity: maxSoundQty };
        }
        return r;
      });

    } catch (error) {

      return [];

    }

  };



  // Compute real-time badge count for Tagged/Requirements button

  const getTaggedUpdatesCount = (event: Event): number => {

    if (!event.departmentRequirements) return 0;



    const lastViewedTime = lastViewedTimestamps[event._id] || 0;

    let count = 0;



    Object.values(event.departmentRequirements).forEach((reqs: any) => {

      if (!Array.isArray(reqs)) return;

      reqs.forEach((req: any) => {

        // Get the last update time for this requirement

        const lastUpdated = req.lastUpdated ? new Date(req.lastUpdated).getTime() : 0;



        // Only count if there are updates after last view

        if (lastUpdated > lastViewedTime) {

          // Count status change as 1

          const status = (req.status || 'pending').toLowerCase();

          if (status !== 'pending') {

            count += 1;

          }



          // Count department note as 1 (if it exists and was updated after last view)

          if (req.departmentNotes) {

            count += 1;

          }



          // Count each unread department reply as 1

          if (Array.isArray(req.replies)) {

            const unreadDeptReplies = req.replies.filter((r: any) => {

              if (r.role !== 'department') return false;

              return !r.isRead; // Only count unread replies

            });

            count += unreadDeptReplies.length;

          }

        }

      });

    });



    return count;

  };



  // Fetch available dates for selected location

  const fetchAvailableDates = async (locationName: string) => {

    try {

      if (!locationName || locationName === 'Add Custom Location') {

        setAvailableDates([]);

        return;

      }



      const token = localStorage.getItem('authToken');

      const headers = {

        'Authorization': `Bearer ${token}`,

        'Content-Type': 'application/json'

      };



      const response = await axios.get(`${API_BASE_URL}/location-availability`, { headers });



      if (response.data.success) {

        // Filter availability records for the selected location

        const locationAvailabilities = response.data.data.filter(

          (item: any) => item.locationName === locationName && item.status === 'available'

        );



        // Convert date strings to Date objects (timezone-safe)

        const dates = locationAvailabilities.map((item: any) => {

          // Parse date as local date to avoid timezone issues

          const dateParts = item.date.split('-');

          const year = parseInt(dateParts[0]);

          const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed

          const day = parseInt(dateParts[2]);

          return new Date(year, month, day);

        });

        setAvailableDates(dates);

      } else {

        setAvailableDates([]);

      }

    } catch (error) {

      setAvailableDates([]);

    }

  };



  // Calculate working days between two dates (excluding weekends)

  const calculateWorkingDays = (startDate: Date, endDate: Date): number => {

    let count = 0;

    const current = new Date(startDate);



    while (current <= endDate) {

      const dayOfWeek = current.getDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)

        count++;

      }

      current.setDate(current.getDate() + 1);

    }



    return count;

  };



  // Check if a date should be disabled (not available for the selected location)

  const isDateDisabled = (date: Date) => {

    const today = new Date();

    today.setHours(0, 0, 0, 0);



    // Disable past dates

    if (date < today) {

      return true;

    }



    // Get event type from selectedEditEvent

    const eventType = selectedEditEvent?.eventType;



    // Simple Meeting: NO restrictions - allow ALL future dates

    if (eventType === 'simple-meeting') {

      return false;

    }



    // For Simple Event (7 days) and Complex Event (30 days)

    // Allow any date that meets the lead time requirement

    if (eventType === 'simple' || eventType === 'complex') {

      const daysRequired = eventType === 'simple' ? 7 : 30;

      const days = calculateWorkingDays(today, date);



      // Only check if date meets minimum lead time requirement

      return days < daysRequired;

    }



    // If no event type specified (old events), use old logic

    if (availableDates.length === 0) {

      return false; // If no available dates loaded yet, don't disable any dates

    }



    // Use timezone-safe date comparison by comparing year, month, day only

    const clickedYear = date.getFullYear();

    const clickedMonth = date.getMonth();

    const clickedDay = date.getDate();



    const matchFound = availableDates.some(availableDate => {

      const availableYear = availableDate.getFullYear();

      const availableMonth = availableDate.getMonth();

      const availableDay = availableDate.getDate();



      return clickedYear === availableYear &&

        clickedMonth === availableMonth &&

        clickedDay === availableDay;

    });



    return !matchFound;

  };



  // Fetch available dates when edit modal opens and location is already set

  useEffect(() => {

    if (showEditModal && editFormData.location && editFormData.location !== 'Add Custom Location') {

      fetchAvailableDates(editFormData.location);

    }

  }, [showEditModal, editFormData.location]);



  // Auto-check for conflicts when date or location changes

  useEffect(() => {

    const checkConflicts = async () => {

      if (editFormData.startDate && editFormData.location && showEditModal) {

        const response = await fetch(`${API_BASE_URL}/events`, {

          headers: {

            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,

            'Content-Type': 'application/json'

          }

        });



        if (response.ok) {

          const eventsData = await response.json();

          const events = eventsData.data || [];



          // Collect all dates we need to check (Day 1 + all additional days)

          const datesToCheck = [new Date(editFormData.startDate)];

          editFormData.dateTimeSlots.forEach(slot => {

            datesToCheck.push(slot.date);

          });



          // Store ALL events on ANY of the dates (for REQ label checking)

          const eventsOnDate = events.filter((event: any) => {

            if (!event.startDate) return false;

            if (selectedEditEvent && event._id === selectedEditEvent._id) return false;

            if (event.status !== 'submitted' && event.status !== 'approved') return false;



            const eventStartDate = new Date(event.startDate);



            // Check if event is on any of our dates

            return datesToCheck.some(checkDate =>

              eventStartDate.toDateString() === checkDate.toDateString()

            );

          });

          setAllEventsOnDate(eventsOnDate);



          // Filter events that are on the same location, excluding the current event being edited

          const conflicts = eventsOnDate.filter((event: any) => {

            if (!event.location) return false;

            // Only check conflicts for the SAME location

            return event.location === editFormData.location;

          });



          setConflictingEvents(conflicts);

          setVenueConflictingEvents(conflicts);

        }

      } else if (!showEditModal) {

        // Clear conflicts when modal is closed

        setConflictingEvents([]);

        setVenueConflictingEvents([]);

      }

    };



    // Debounce the conflict checking to avoid too many API calls

    const timeoutId = setTimeout(checkConflicts, 300);

    return () => clearTimeout(timeoutId);

  }, [editFormData.startDate, editFormData.location, editFormData.dateTimeSlots, showEditModal, selectedEditEvent]);



  // Fetch user's events

  const fetchMyEvents = async () => {

    try {

      setLoading(true);

      const token = localStorage.getItem('authToken');

      const headers = {

        'Authorization': `Bearer ${token}`,

        'Content-Type': 'application/json'

      };



      const response = await axios.get(`${API_BASE_URL}/events/my?recalcAvailability=false`, { headers });



      if (response.data.success) {

        setEvents(response.data.data);

      }

    } catch (error) {

      toast.error('Failed to load events', {

        description: 'Please try again later.'

      });

    } finally {

      setLoading(false);

    }

  };



  // Fetch all departments

  const fetchAllDepartments = async () => {

    try {

      const token = localStorage.getItem('authToken');

      // Fetch visible departments from the public endpoint

      const response = await axios.get(`${API_BASE_URL}/departments/visible`, {

        headers: { 'Authorization': `Bearer ${token}` }

      });



      if (response.data.success && Array.isArray(response.data.data)) {

        // Extract department names

        const deptNames = response.data.data

          .map((dept: any) => dept.name)

          .filter(Boolean)

          .sort(); // Sort alphabetically





        if (deptNames.length > 0) {

          setAllDepartments(deptNames as string[]);

          return;

        }

      }

    } catch (error) {

    }



    // Fallback to hardcoded departments

    setAllDepartments([

      'PGSO', 'ODH', 'PTO', 'PACCO', 'PESO', 'PSWDO',

      'DILG', 'HRMO', 'ACCOUNTING', 'BUDGET', 'TREASURY',

      'ENGINEERING', 'PLANNING', 'LEGAL', 'INFORMATION'

    ]);

  };



  useEffect(() => {

    fetchMyEvents();

    fetchAllDepartments();

  }, []);



  const getRequirementStatus = (req: any): 'pending' | 'confirmed' | 'declined' | string => {

    return req?.status || 'pending';

  };



  const getTaggedRequirementsSummary = (event: Event) => {

    const deptReqs = event.departmentRequirements || {};

    const allReqs: any[] = [];



    Object.values(deptReqs).forEach((reqs: any) => {

      if (Array.isArray(reqs)) allReqs.push(...reqs);

    });



    const total = allReqs.length;

    const pending = allReqs.filter(r => getRequirementStatus(r) === 'pending').length;

    const confirmed = allReqs.filter(r => getRequirementStatus(r) === 'confirmed').length;

    const declined = allReqs.filter(r => getRequirementStatus(r) === 'declined').length;



    return {

      total,

      pending,

      confirmed,

      declined,

      anyPending: pending > 0,

      anyDeclined: declined > 0,

      allConfirmed: total > 0 && confirmed === total,

    };

  };



  // WebSocket listener for automatic event status updates

  useEffect(() => {

    const socket = getGlobalSocket();



    if (!socket) {

      return;

    }



    // Listen for event status updates (including automatic completion)

    const handleEventStatusUpdated = (data: any) => {



      // Check if this is an automatic completion

      if (data.status === 'completed' && data.autoCompleted) {

        toast.success(`Event "${data.eventTitle}" has been automatically marked as completed`);

      }



      // Refresh events list to show updated status

      fetchMyEvents();

    };



    // Listen for general event updates

    const handleEventUpdated = (data: any) => {

      fetchMyEvents();

    };



    // Remove any existing listeners first to prevent duplicates

    socket.off('event-status-updated', handleEventStatusUpdated);

    socket.off('event-updated', handleEventUpdated);



    // Add listeners

    socket.on('event-status-updated', handleEventStatusUpdated);

    socket.on('event-updated', handleEventUpdated);



    // Cleanup on unmount

    return () => {

      socket.off('event-status-updated', handleEventStatusUpdated);

      socket.off('event-updated', handleEventUpdated);

    };

  }, []);



  // Get dynamic status based on dates

  const getDynamicStatus = (event: Event) => {

    const currentDate = new Date();

    currentDate.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison



    const endDate = new Date(event.endDate);

    endDate.setHours(23, 59, 59, 999); // Set to end of day



    const startDate = new Date(event.startDate);

    startDate.setHours(0, 0, 0, 0); // Set to start of day



    // If event has ended, mark as completed (unless it's rejected or cancelled)

    if (currentDate > endDate && event.status !== 'rejected' && event.status !== 'cancelled') {

      return 'completed';

    }



    // If event is approved/submitted and starts in the future, mark as incoming

    if ((event.status === 'approved' || event.status === 'submitted') && startDate > currentDate) {

      return 'incoming';

    }



    // If event is happening today or ongoing (approved/submitted), mark as ongoing

    if ((event.status === 'approved' || event.status === 'submitted') && startDate <= currentDate && currentDate <= endDate) {

      return 'ongoing';

    }

    return event.status;

  };



  const eventsByStatus = useMemo(() => {
    const counts: { [key: string]: number } = {
      All: events.length,
      Submitted: 0,
      Approved: 0,
      Incoming: 0,
      Ongoing: 0,
      Completed: 0,
      Rejected: 0,
      Draft: 0,
      Cancelled: 0,
    };
    events.forEach(event => {
      const ds = getDynamicStatus(event);
      if (ds === 'submitted') counts.Submitted++;
      else if (ds === 'approved') counts.Approved++;
      else if (ds === 'incoming') counts.Incoming++;
      else if (ds === 'ongoing') counts.Ongoing++;
      else if (ds === 'completed') counts.Completed++;
      else if (ds === 'rejected') counts.Rejected++;
      else if (ds === 'draft') counts.Draft++;
      else if (ds === 'cancelled') counts.Cancelled++;
    });
    return counts;
  }, [events]);

  // Filter and sort events

  const filteredAndSortedEvents = useMemo(() => {

    const q = debouncedSearchTerm.trim().toLowerCase();

    const list = events

      .map(event => ({

        ...event,

        dynamicStatus: getDynamicStatus(event)

      }))

      .filter(event => {

        const matchesSearch = !q ||

          event.eventTitle.toLowerCase().includes(q) ||

          event.location.toLowerCase().includes(q) ||

          event.requestor.toLowerCase().includes(q);



        // Match by either dynamic status OR actual status

        const matchesStatus = statusFilter === 'all' ||

          event.dynamicStatus === statusFilter ||

          event.status === statusFilter;



        return matchesSearch && matchesStatus;

      })

      .sort((a, b) => {

        // Smart default sorting: incoming first, then ongoing, then completed last

        if (sortBy === 'newest') {

          // First sort by status priority

          const statusPriority: { [key: string]: number } = {

            'incoming': 0,

            'ongoing': 1,

            'approved': 2,

            'submitted': 3,

            'draft': 4,

            'completed': 5,

            'rejected': 6,

            'cancelled': 7

          };



          const priorityA = statusPriority[a.dynamicStatus] ?? 99;

          const priorityB = statusPriority[b.dynamicStatus] ?? 99;



          if (priorityA !== priorityB) {

            return priorityA - priorityB;

          }



          // Then sort by date (earliest first for incoming/ongoing, latest first for completed)

          if (a.dynamicStatus === 'completed' && b.dynamicStatus === 'completed') {

            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

          }

          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

        }



        switch (sortBy) {

          case 'oldest':

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

          case 'date-asc':

            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

          case 'date-desc':

            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();

          case 'title':

            return a.eventTitle.localeCompare(b.eventTitle);

          default:

            return 0;

        }

      });



    return list;

  }, [events, debouncedSearchTerm, statusFilter, sortBy]);



  const visibleEvents = useMemo(() => {

    return filteredAndSortedEvents.slice(0, visibleCount);

  }, [filteredAndSortedEvents, visibleCount]);



  // Get status badge variant and icon

  const getStatusInfo = (status: string) => {

    switch (status) {

      case 'draft':

        return {

          variant: 'secondary' as const,

          icon: <FileText className="w-3 h-3" />,

          label: 'Draft'

        };

      case 'submitted':

        return {

          variant: 'default' as const,

          icon: <Clock3 className="w-3 h-3" />,

          label: 'Submitted'

        };

      case 'approved':

        return {

          variant: 'default' as const,

          icon: <CheckCircle className="w-3 h-3" />,

          label: 'Approved',

          className: 'bg-green-100 text-green-800 border-green-200'

        };

      case 'rejected':

        return {

          variant: 'destructive' as const,

          icon: <XCircle className="w-3 h-3" />,

          label: 'Rejected'

        };

      case 'completed':

        return {

          variant: 'default' as const,

          icon: <CheckCircle className="w-3 h-3" />,

          label: 'Completed',

          className: 'bg-blue-100 text-blue-800 border-blue-200'

        };

      case 'incoming':

        return {

          variant: 'default' as const,

          icon: <CalendarIcon className="w-3 h-3" />,

          label: 'Incoming',

          className: 'bg-purple-100 text-purple-800 border-purple-200'

        };

      case 'cancelled':

        return {

          variant: 'destructive' as const,

          icon: <XCircle className="w-3 h-3" />,

          label: 'Cancelled'

        };

      case 'ongoing':

        return {

          variant: 'default' as const,

          icon: <Clock className="w-3 h-3" />,

          label: 'Ongoing',

          className: 'bg-orange-100 text-orange-800 border-orange-200'

        };

      default:

        return {

          variant: 'secondary' as const,

          icon: <AlertCircle className="w-3 h-3" />,

          label: status

        };

    }

  };



  // Format time helper

  const formatTime = (time: string) => {

    if (!time) return '';

    const [hours, minutes] = time.split(':');

    const hour = parseInt(hours, 10);

    const ampm = hour >= 12 ? 'PM' : 'AM';

    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${displayHour}:${minutes} ${ampm}`;

  };



  // Generate time options with 30-minute intervals from 7:00 AM to 10:00 PM

  const generateTimeOptions = () => {

    const times = [];

    for (let hour = 7; hour <= 22; hour++) {

      for (let minute = 0; minute < 60; minute += 30) {

        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        const displayTime = formatTime(timeString);

        times.push({ value: timeString, label: displayTime });

      }

    }

    return times;

  };



  // ── Auto Suggest: helpers & logic ─────────────────────────────────────────

  // Build every calendar date between start and end (inclusive)
  const buildDateRange = (start: Date, end: Date): Date[] => {
    const result: Date[] = [];
    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    const fin = new Date(end); fin.setHours(0, 0, 0, 0);
    while (cur <= fin) { result.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return result;
  };

  // Helper to check if two locations conflict (same location or overlapping conference rooms)
  const locationsConflict = (loc1: string, loc2: string): boolean => {
    if (loc1 === loc2) return true;

    // Check Pavilion hierarchy
    const isPavilion1 = loc1.includes('Pavilion');
    const isPavilion2 = loc2.includes('Pavilion');
    if (isPavilion1 && isPavilion2) {
      const getHall = (loc: string) => {
        if (loc.includes('Kagitingan')) return 'Kagitingan';
        if (loc.includes('Kalayaan')) return 'Kalayaan';
        return null;
      };
      const hall1 = getHall(loc1);
      const hall2 = getHall(loc2);
      if (hall1 !== hall2) return false;
      const isEntire1 = loc1.includes('(Entire)');
      const isEntire2 = loc2.includes('(Entire)');
      if (isEntire1 || isEntire2) return true;
      return loc1 === loc2;
    }

    // Conference room logic
    const isCR1 = /4th Flr\. Conference Room/.test(loc1);
    const isCR2 = /4th Flr\. Conference Room/.test(loc2);
    if (isCR1 && isCR2) {
      if (loc1.includes('(Entire)') || loc2.includes('(Entire)')) return true;
      return loc1 === loc2;
    }
    return false;
  };

  // Returns which of the given dates have a time-overlap conflict for locationName
  const getBookedDatesForLocation = (
    locationName: string,
    datesToCheck: Date[],
    allEvents: any[],
    selStartTime: string,
    selEndTime: string
  ): string[] => {
    const toMin = (t: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const selStart = selStartTime ? toMin(selStartTime) : null;
    const selEnd = selEndTime ? toMin(selEndTime) : null;

    return datesToCheck
      .filter((d) => {
        const dayStr = d.toDateString();
        return allEvents.some((ev) => {
          if (ev.status !== 'approved' && ev.status !== 'submitted') return false;
          // Skip the current event being edited so the owner can re-select their own venue
          if (selectedEditEvent && ev._id === selectedEditEvent._id) return false;

          const evLocs =
            ev.locations && Array.isArray(ev.locations) && ev.locations.length > 0
              ? ev.locations : [ev.location];
          if (!evLocs.some((l: string) => locationsConflict(l, locationName))) return false;

          let evStart: string | null = null;
          let evEnd: string | null = null;
          const mainDay = ev.startDate ? new Date(ev.startDate).toDateString() : '';
          if (mainDay === dayStr) {
            evStart = ev.startTime || null;
            evEnd = ev.endTime || null;
          } else if (Array.isArray(ev.dateTimeSlots)) {
            const slot = ev.dateTimeSlots.find(
              (s: any) => s.startDate && new Date(s.startDate).toDateString() === dayStr
            );
            if (slot) { evStart = slot.startTime || null; evEnd = slot.endTime || null; }
          }

          if (selStart !== null && selEnd !== null && evStart && evEnd) {
            return selStart < toMin(evEnd) && selEnd > toMin(evStart);
          }
          return !!evStart || mainDay === dayStr;
        });
      })
      .map((d) => d.toDateString());
  };

  // Fetch events from API then build suggestion list with booking status
  const runAutoSuggest = async () => {
    if (!autoSuggestParticipants || !autoSuggestStartDate || !autoSuggestEndDate) return;
    const count = parseInt(autoSuggestParticipants) || 0;
    if (count <= 0) { toast.error('Please enter a valid number of participants'); return; }

    setLoadingAutoSuggest(true);
    setShowSuggestions(false);
    setSuggestedLocations([]);
    setSelectedSuggestion(null);

    try {
      const token = localStorage.getItem('authToken');

      // Fetch all location-requirements docs
      const locReqRes = await fetch(`${API_BASE_URL}/location-requirements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allLocReqs: any[] = locReqRes.ok ? await locReqRes.json() : [];

      // Fetch all events for booking conflict checks
      const evRes = await fetch(`${API_BASE_URL}/events`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const allEvents: any[] = evRes.ok ? (await evRes.json()).data || [] : [];

      const dateRange = buildDateRange(autoSuggestStartDate, autoSuggestEndDate);

      const VENUE_MAX_CAPACITY: Record<string, number> = {
        "Bataan People's Center": 5000,
      };

      const extractChairs = (locName: string): { total: number; capacity: number; breakdown: string } => {
        const exactDoc = allLocReqs.find((doc: any) => {
          if (doc.locationNames && Array.isArray(doc.locationNames)) {
            return doc.locationNames.length === 1 && doc.locationNames[0] === locName;
          }
          return doc.locationName === locName;
        });
        const groupDocs = allLocReqs.filter((doc: any) => {
          if (doc.locationNames && Array.isArray(doc.locationNames)) {
            return doc.locationNames.length > 1 && doc.locationNames.includes(locName);
          }
          return false;
        });
        const candidates = [...(exactDoc ? [exactDoc] : []), ...groupDocs];
        const maxCapacityOverride = VENUE_MAX_CAPACITY[locName];
        if (candidates.length === 0) {
          return { total: maxCapacityOverride ?? 0, capacity: maxCapacityOverride ?? 0, breakdown: '' };
        }
        const best = candidates.reduce((prev, cur) => {
          const pLen = prev.locationNames?.length ?? 1;
          const cLen = cur.locationNames?.length ?? 1;
          return cLen < pLen ? cur : prev;
        });
        if (!Array.isArray(best.requirements)) {
          return { total: maxCapacityOverride ?? 0, capacity: maxCapacityOverride ?? 0, breakdown: '' };
        }
        const chairReqs = best.requirements.filter(
          (r: any) => typeof r.name === 'string' && /chair/i.test(r.name)
        );
        if (chairReqs.length === 0) {
          return { total: maxCapacityOverride ?? 0, capacity: maxCapacityOverride ?? 0, breakdown: '' };
        }
        const total = chairReqs.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
        const capacity = maxCapacityOverride ? Math.max(total, maxCapacityOverride) : total;
        const breakdown = chairReqs.length > 1
          ? chairReqs.map((r: any) => `${Number(r.quantity)} ${r.name}`).join(' + ')
          : '';
        return { total, capacity, breakdown };
      };

      // ── Shared Pavilion pool ───────────────────────────────────────────────
      // ALL Pavilion locations (Kalayaan Entire + all Kagitingan sections) draw
      // from a single shared inventory pool of chairs/tables.
      const ALL_PAVILION_LOCATIONS = [
        'Pavilion - Kagitingan Hall - Section A',
        'Pavilion - Kagitingan Hall - Section B',
        'Pavilion - Kagitingan Hall - Section C',
        'Pavilion - Kalayaan Ballroom',
      ];

      const pavilionOverallDoc = allLocReqs.find((doc: any) => {
        if (!doc.locationNames || !Array.isArray(doc.locationNames)) return false;
        return ALL_PAVILION_LOCATIONS.every((l) => doc.locationNames.includes(l));
      }) || allLocReqs.find((doc: any) => {
        if (!doc.locationNames || !Array.isArray(doc.locationNames)) return false;
        const KAGITINGAN_SECTIONS = [
          'Pavilion - Kagitingan Hall - Section A',
          'Pavilion - Kagitingan Hall - Section B',
          'Pavilion - Kagitingan Hall - Section C',
        ];
        return KAGITINGAN_SECTIONS.every((s) => doc.locationNames.includes(s));
      });

      const pavilionPoolChairs = (() => {
        if (!pavilionOverallDoc || !Array.isArray(pavilionOverallDoc.requirements)) return 0;
        const chairReqs = pavilionOverallDoc.requirements.filter(
          (r: any) => typeof r.name === 'string' && /chair/i.test(r.name)
        );
        return chairReqs.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
      })();

      const getPavilionChairsBookedOnDate = (dayStr: string): number => {
        let booked = 0;
        allEvents.forEach((ev: any) => {
          if (ev.status !== 'approved' && ev.status !== 'submitted') return;
          if (selectedEditEvent && ev._id === selectedEditEvent._id) return;
          const evLocs: string[] =
            ev.locations && Array.isArray(ev.locations) && ev.locations.length > 0
              ? ev.locations : [ev.location || ''];
          const isPavilion = evLocs.some((l: string) => /Pavilion/i.test(l));
          if (!isPavilion) return;

          const mainDay = ev.startDate ? new Date(ev.startDate).toDateString() : '';
          const onThisDay =
            mainDay === dayStr ||
            (Array.isArray(ev.dateTimeSlots) &&
              ev.dateTimeSlots.some(
                (s: any) => s.startDate && new Date(s.startDate).toDateString() === dayStr
              ));
          if (!onThisDay) return;

          if (ev.taggedDepartments && ev.departmentRequirements) {
            ev.taggedDepartments.forEach((dept: string) => {
              const reqs = ev.departmentRequirements[dept];
              if (!Array.isArray(reqs)) return;
              reqs.forEach((req: any) => {
                if (req.selected && typeof req.name === 'string' && /chair/i.test(req.name)) {
                  booked += Number(req.quantity) || 0;
                }
              });
            });
          }
        });
        return booked;
      };

      const getPavilionRemainingChairs = (): number => {
        if (pavilionPoolChairs <= 0) return 0;
        if (dateRange.length === 0) return pavilionPoolChairs;
        const perDay = dateRange.map((d) => {
          const booked = getPavilionChairsBookedOnDate(d.toDateString());
          return Math.max(0, pavilionPoolChairs - booked);
        });
        return Math.min(...perDay);
      };

      const pavilionRemainingChairs = getPavilionRemainingChairs();
      // ──────────────────────────────────────────────────────────────────────

      const results: AutoSuggestedLocation[] = [];

      // 1) All PGB non-conference, non-Kagitingan-section locations
      const isBacRejected = selectedEditEvent?.bacApprovalStatus === 'rejected';
      locations.filter((l) => l !== 'Add Custom Location' && !/4th Flr\. Conference Room/.test(l) && !(isBacRejected && l === '5th Flr. Training Room 1 (BAC)')).forEach((loc) => {
        if (/Pavilion.*Kagitingan.*Section [ABC]$/i.test(loc)) return;
        if (/Pavilion.*Kalayaan.*Section [ABC]$/i.test(loc)) return;

        const isPavilionLoc = /Pavilion/i.test(loc);

        let chairs: number;
        let breakdown: string;
        if (isPavilionLoc) {
          chairs = pavilionRemainingChairs;
          breakdown = pavilionRemainingChairs < pavilionPoolChairs
            ? `${pavilionRemainingChairs} of ${pavilionPoolChairs} chairs available (shared pool)`
            : '';
        } else {
          const extracted = extractChairs(loc);
          chairs = extracted.capacity;
          breakdown = extracted.capacity > extracted.total && extracted.total > 0
            ? `${extracted.total} default chairs · up to ${extracted.capacity.toLocaleString()} pax capacity`
            : extracted.capacity > extracted.total && extracted.total === 0
              ? `up to ${extracted.capacity.toLocaleString()} pax capacity`
              : extracted.breakdown;
        }

        if (!isPavilionLoc && chairs <= 0) return;
        if (!isPavilionLoc && chairs < count) return;
        const bookedOnDates = getBookedDatesForLocation(
          loc, dateRange, allEvents, autoSuggestStartTime, autoSuggestEndTime
        );
        results.push({
          name: loc, chairs, isMulti: false, rooms: [loc],
          note: breakdown || undefined,
          isBooked: bookedOnDates.length > 0, bookedOnDates,
        });
      });

      // Conference room combos
      const CR = [
        '4th Flr. Conference Room 1',
        '4th Flr. Conference Room 2',
        '4th Flr. Conference Room 3',
      ];
      const crChairs: Record<string, number> = {};
      CR.forEach((room) => { crChairs[room] = extractChairs(room).total; });
      const availableCRs = CR.filter((r) => crChairs[r] > 0);

      if (availableCRs.length > 0) {
        for (let mask = 1; mask < (1 << availableCRs.length); mask++) {
          const combo: string[] = [];
          availableCRs.forEach((r, i) => { if (mask & (1 << i)) combo.push(r); });
          const totalChairs = combo.reduce((sum, r) => sum + crChairs[r], 0);
          if (totalChairs < count) continue;
          const isAllThree = combo.length === availableCRs.length && availableCRs.length === 3;
          const label = isAllThree
            ? '4th Flr. Conference Room (Entire)'
            : combo.length === 1 ? combo[0] : combo.join(' + ');
          if (results.some((r) => r.name === label)) continue;
          const allBookedDates: string[] = [];
          combo.forEach((room) => {
            getBookedDatesForLocation(room, dateRange, allEvents, autoSuggestStartTime, autoSuggestEndTime)
              .forEach((d) => { if (!allBookedDates.includes(d)) allBookedDates.push(d); });
          });
          results.push({
            name: label, chairs: totalChairs, isMulti: combo.length > 1, rooms: combo,
            note: combo.length > 1
              ? `${combo.map((r) => r.replace('4th Flr. Conference Room ', 'CR')).join(' + ')} · ${totalChairs} chairs`
              : undefined,
            isBooked: allBookedDates.length > 0, bookedOnDates: allBookedDates,
          });
        }
      }

      // 3) Pavilion - Kagitingan Hall sections (A, B, C — individually bookable)
      if (pavilionPoolChairs > 0) {
        const KAGITINGAN_SECTIONS = [
          'Pavilion - Kagitingan Hall - Section A',
          'Pavilion - Kagitingan Hall - Section B',
          'Pavilion - Kagitingan Hall - Section C',
        ];

        {
          for (let mask = 1; mask < (1 << KAGITINGAN_SECTIONS.length); mask++) {
            const combo: string[] = [];
            KAGITINGAN_SECTIONS.forEach((s, i) => { if (mask & (1 << i)) combo.push(s); });

            const allBookedDates: string[] = [];
            combo.forEach((sec) => {
              getBookedDatesForLocation(sec, dateRange, allEvents, autoSuggestStartTime, autoSuggestEndTime)
                .forEach((d) => { if (!allBookedDates.includes(d)) allBookedDates.push(d); });
            });

            const isAllSections = combo.length === KAGITINGAN_SECTIONS.length;
            const label = isAllSections
              ? 'Pavilion - Kagitingan Hall (Entire)'
              : combo.length === 1
                ? combo[0]
                : combo.map((s) => s.replace('Pavilion - Kagitingan Hall - ', '')).join(' + ') + ' (Kagitingan Hall)';

            if (results.some((r) => r.name === label)) continue;

            const sectionCount = combo.length;
            const seatsLabel = sectionCount === 1
              ? 'approx 50–100 seats'
              : sectionCount === 2
                ? 'approx 100–200 seats'
                : 'approx 150–300 seats';

            results.push({
              name: label,
              chairs: pavilionRemainingChairs,
              seatsLabel,
              isMulti: combo.length > 1,
              rooms: combo,
              note: combo.length > 1
                ? `${combo.map((s) => s.replace('Pavilion - Kagitingan Hall - ', '')).join(' + ')}`
                : undefined,
              isBooked: allBookedDates.length > 0,
              bookedOnDates: allBookedDates,
            });
          }
        }
      }

      if (results.length === 0) {
        setShowSuggestions(true);
        setSuggestedLocations([]);
        return;
      }

      results.sort((a, b) => {
        if (a.isBooked !== b.isBooked) return a.isBooked ? 1 : -1;
        return a.chairs - b.chairs;
      });

      setSuggestedLocations(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Auto suggest error:', error);
      toast.error('Failed to check venue availability. Please try again.');
    } finally {
      setLoadingAutoSuggest(false);
    }
  };

  // Apply chosen suggestion to edit form
  const applyAutoSuggestion = (sug: AutoSuggestedLocation) => {
    console.log('[applyAutoSuggestion] sug.name:', sug.name, '| sug.rooms:', sug.rooms, '| sug.isMulti:', sug.isMulti);
    setSelectedSuggestion(sug.name);
    setShowAutoSuggestModal(false);

    const isKagitinganCombo = sug.rooms.every((r: string) => /Pavilion.*Kagitingan.*Section [ABC]$/i.test(r));

    let primaryLocation: string;
    if (isKagitinganCombo) {
      primaryLocation = sug.rooms.length === 3
        ? 'Pavilion - Kagitingan Hall (Entire)'
        : sug.rooms[0];
    } else {
      primaryLocation = sug.isMulti && sug.rooms.length === 3
        ? '4th Flr. Conference Room (Entire)' : sug.rooms[0];
    }

    const allLocations = sug.isMulti && sug.rooms.length > 1 ? sug.rooms : [primaryLocation];

    console.log('[applyAutoSuggestion] setting location:', primaryLocation, '| locations:', allLocations);

    setEditFormData(prev => ({
      ...prev,
      location: primaryLocation,
      locations: allLocations,
      startDate: autoSuggestStartDate ? format(autoSuggestStartDate, 'yyyy-MM-dd') : prev.startDate,
      endDate: autoSuggestEndDate ? format(autoSuggestEndDate, 'yyyy-MM-dd') : prev.endDate,
      startTime: autoSuggestStartTime || prev.startTime,
      endTime: autoSuggestEndTime || prev.endTime,
    }));

    // Fetch available dates for the selected location
    if (primaryLocation) {
      fetchAvailableDates(primaryLocation);
    }

    toast.success(`Applied suggestion: ${sug.name}`);
  };

  // ──────────────────────────────────────────────────────────────────────────

  const timeToMinutes = (time: string) => {

    const [hours, minutes] = String(time || '').split(':').map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

    return hours * 60 + minutes;

  };



  const getBookedVenueIntervals = (checkDate?: Date) => {

    const dateToCheck = checkDate || (editFormData.startDate ? new Date(editFormData.startDate) : null);

    if (!dateToCheck || !editFormData.location || venueConflictingEvents.length === 0) {

      return [] as Array<[number, number]>;

    }



    const checkDateStr = dateToCheck.toDateString();

    const intervals: Array<[number, number]> = [];



    venueConflictingEvents.forEach((event) => {

      // Ignore the event being edited

      if (selectedEditEvent && (event._id === selectedEditEvent._id || event.id === selectedEditEvent._id)) return;

      if (event.location !== editFormData.location) return;



      const pushInterval = (start: string, end: string) => {

        if (!start || !end) return;

        const s = timeToMinutes(start);

        const e = timeToMinutes(end);

        if (e > s) intervals.push([s, e]);

      };



      // Main event date

      if (event.startDate && new Date(event.startDate).toDateString() === checkDateStr) {

        pushInterval(event.startTime, event.endTime);

      }



      // Multi-day time slots (if present)

      const slots = Array.isArray(event.dateTimeSlots) ? event.dateTimeSlots : [];

      slots.forEach((slot: any) => {

        if (!slot?.startDate) return;

        const slotDateStr = new Date(slot.startDate).toDateString();

        if (slotDateStr !== checkDateStr) return;

        pushInterval(slot.startTime, slot.endTime);

      });

    });



    return intervals;

  };



  const isVenueRangeBooked = (startTime: string, endTime: string, checkDate?: Date) => {

    if (!startTime || !endTime) return false;

    const startMinutes = timeToMinutes(startTime);

    const endMinutes = timeToMinutes(endTime);

    if (endMinutes <= startMinutes) return true;



    const intervals = getBookedVenueIntervals(checkDate);

    if (intervals.length === 0) return false;



    return intervals.some(([s, e]) => startMinutes < e && endMinutes > s);

  };



  // Check if a specific time slot is booked for the selected location and date

  const isTimeSlotBooked = (timeSlot: string, checkDate?: Date) => {

    const dateToCheck = checkDate || (editFormData.startDate ? new Date(editFormData.startDate) : null);



    if (!dateToCheck || !editFormData.location || venueConflictingEvents.length === 0) {

      return false;

    }



    return venueConflictingEvents.some(event => {

      if (event.location !== editFormData.location) return false;



      // Check if event is on the same date

      const eventDate = new Date(event.startDate);

      if (eventDate.toDateString() !== dateToCheck.toDateString()) {

        return false;

      }



      const eventStartTime = event.startTime;

      const eventEndTime = event.endTime;



      // Convert times to minutes for easier comparison

      const timeToMinutes = (time: string) => {

        const [hours, minutes] = time.split(':').map(Number);

        return hours * 60 + minutes;

      };



      const slotMinutes = timeToMinutes(timeSlot);

      const eventStartMinutes = timeToMinutes(eventStartTime);

      const eventEndMinutes = timeToMinutes(eventEndTime);



      // For both start and end time: check if slot falls within existing event time range

      // If existing event is 8:00-10:00, then 8:00, 8:30, 9:00, 9:30, 10:00 should all be blocked

      // This prevents any overlap with existing bookings

      return slotMinutes >= eventStartMinutes && slotMinutes <= eventEndMinutes;

    });

  };



  // Get available end times based on selected start time

  const getAvailableEndTimes = () => {

    if (!editFormData.startTime) return generateTimeOptions();



    const startMinutes = timeToMinutes(editFormData.startTime);

    const dateToCheck = editFormData.startDate ? new Date(editFormData.startDate) : undefined;



    return generateTimeOptions().filter(timeOption => {

      const optionMinutes = timeToMinutes(timeOption.value);

      // End time must be after start time

      if (optionMinutes <= startMinutes) return false;

      // Must not overlap/bridge across any booked venue interval

      return !isVenueRangeBooked(editFormData.startTime, timeOption.value, dateToCheck);

    });

  };



  // Format MIME type helper - truncate long MIME types

  const formatMimeType = (mimetype: string) => {

    if (!mimetype) return '';



    // Common MIME type mappings for better display

    const mimeTypeMap: { [key: string]: string } = {

      'application/pdf': 'PDF',

      'application/msword': 'DOC',

      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',

      'application/vnd.ms-excel': 'XLS',

      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',

      'application/vnd.ms-powerpoint': 'PPT',

      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',

      'image/jpeg': 'JPEG',

      'image/jpg': 'JPG',

      'image/png': 'PNG',

      'image/gif': 'GIF',

      'text/plain': 'TXT',

      'text/csv': 'CSV'

    };



    // Return mapped type if available

    if (mimeTypeMap[mimetype]) {

      return mimeTypeMap[mimetype];

    }



    // If MIME type is longer than 25 characters, truncate with ellipsis

    if (mimetype.length > 25) {

      return mimetype.substring(0, 22) + '...';

    }



    return mimetype;

  };



  // Format file name helper - truncate long file names

  const formatFileName = (fileName: string, maxLength: number = 20) => {

    if (!fileName) return '';



    // If file name is longer than maxLength, truncate with ellipsis

    if (fileName.length > maxLength) {

      // Try to preserve file extension

      const lastDotIndex = fileName.lastIndexOf('.');

      if (lastDotIndex > 0 && lastDotIndex > fileName.length - 10) {

        const extension = fileName.substring(lastDotIndex);

        const nameWithoutExt = fileName.substring(0, lastDotIndex);

        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3);

        return truncatedName + '...' + extension;

      } else {

        return fileName.substring(0, maxLength - 3) + '...';

      }

    }



    return fileName;

  };



  // Get requirement status icon (similar to Tagged Department page)

  const getRequirementStatusIcon = (status: string) => {

    switch (status?.toLowerCase()) {

      case 'confirmed': return <CheckCircle className="w-4 h-4 text-green-500" />;

      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;

      case 'declined': return <XCircle className="w-4 h-4 text-red-500" />;

      case 'partially_fulfill': return <HelpCircle className="w-4 h-4 text-blue-500" />;

      case 'in_preparation': return <Loader2 className="w-4 h-4 text-purple-500" />;

      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;

    }

  };



  // Get requirement status badge

  const getRequirementStatusBadge = (status: string) => {

    const statusLower = status?.toLowerCase() || 'pending';

    switch (statusLower) {

      case 'confirmed':

        return { className: 'bg-green-100 text-green-800 border-green-200', label: 'Confirmed' };

      case 'pending':

        return { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' };

      case 'declined':

        return { className: 'bg-red-100 text-red-800 border-red-200', label: 'Declined' };

      case 'partially_fulfill':

        return { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Partially Fulfilled' };

      case 'in_preparation':

        return { className: 'bg-purple-100 text-purple-800 border-purple-200', label: 'In Preparation' };

      default:

        return { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Pending' };

    }

  };



  // View event details

  const handleViewEvent = (event: Event) => {

    setSelectedEvent(event);

    setShowEventModal(true);

  };



  // Delete event

  const handleDeleteEvent = async (eventId: string) => {

    if (!confirm('Are you sure you want to delete this event?')) return;



    try {

      const token = localStorage.getItem('authToken');

      const headers = {

        'Authorization': `Bearer ${token}`,

        'Content-Type': 'application/json'

      };



      await axios.delete(`${API_BASE_URL}/events/${eventId}`, { headers });



      toast.success('Event deleted successfully');

      fetchMyEvents(); // Refresh the list

    } catch (error) {

      toast.error('Failed to delete event');

    }

  };



  const handleOpenCancelEvent = (event: Event) => {

    setCancellingEvent(event);

    setCancelEventReason('');

    setShowCancelEventModal(true);

  };



  const handleConfirmCancelEvent = async () => {

    if (!cancellingEvent) return;



    setIsCancellingEvent(true);

    try {

      const token = localStorage.getItem('authToken');

      const headers = {

        'Authorization': `Bearer ${token}`,

        'Content-Type': 'application/json'

      };



      const payload: any = { status: 'cancelled' };

      if (cancelEventReason && cancelEventReason.trim()) {

        payload.reason = cancelEventReason.trim();

      }



      const response = await axios.patch(

        `${API_BASE_URL}/events/${cancellingEvent._id}/status`,

        payload,

        { headers }

      );



      if (response.data?.success) {

        toast.success('Event cancelled successfully');

        setShowCancelEventModal(false);

        setCancellingEvent(null);

        setCancelEventReason('');

        fetchMyEvents();

      } else {

        toast.error('Failed to cancel event');

      }

    } catch (error: any) {

      toast.error(error?.response?.data?.message || 'Failed to cancel event');

    } finally {

      setIsCancellingEvent(false);

    }

  };





  // Handle files modal

  const handleShowFiles = (event: Event) => {

    setSelectedEventFiles(event);

    setShowFilesModal(true);

  };



  // Handle departments modal

  const handleShowDepartments = (event: Event) => {

    setSelectedEventDepartments(event);

    setSelectedStatusFilter('all'); // Reset filter when opening modal

    setShowDepartmentsModal(true);



    // Mark this event's Tagged/Requirements badge as viewed

    const newViewedSet = new Set(viewedTaggedRequirementsEvents);

    newViewedSet.add(event._id);

    setViewedTaggedRequirementsEvents(newViewedSet);

    localStorage.setItem('viewedTaggedRequirementsEvents', JSON.stringify(Array.from(newViewedSet)));



    // Record the timestamp when this event was last viewed

    const newTimestamps = { ...lastViewedTimestamps };

    newTimestamps[event._id] = Date.now();

    setLastViewedTimestamps(newTimestamps);

    localStorage.setItem('lastViewedTimestamps', JSON.stringify(newTimestamps));



    // Mark all unread replies as read for this event

    markAllRepliesAsRead(event._id);

  };



  // Mark all unread replies as read for an event

  const markAllRepliesAsRead = async (eventId: string) => {

    try {

      const token = localStorage.getItem('authToken');

      await axios.put(

        `${API_BASE_URL}/events/${eventId}/mark-replies-read`,

        {},

        {

          headers: {

            'Authorization': token ? `Bearer ${token}` : '',

            'Content-Type': 'application/json'

          }

        }

      );



      // Update local state to reflect the changes

      setEvents(prev => prev.map(ev => {

        if (ev._id === eventId && ev.departmentRequirements) {

          const updatedEvent = { ...ev };

          Object.keys(updatedEvent.departmentRequirements).forEach(dept => {

            updatedEvent.departmentRequirements[dept] = updatedEvent.departmentRequirements[dept].map((req: any) => ({

              ...req,

              replies: req.replies?.map((r: any) => ({

                ...r,

                isRead: true

              })) || []

            }));

          });

          return updatedEvent;

        }

        return ev;

      }));

    } catch (error) {

      // Silently fail - not critical if marking as read fails

    }

  };



  // Check if a time slot has requirement conflicts

  const hasRequirementConflictsAtTime = (time: string): boolean => {

    if (!editFormData.startDate || !selectedEditEvent || allEventsOnDate.length === 0) return false;



    // Parse the time to check

    const [hours, minutes] = time.split(':').map(Number);

    const checkTime = new Date(editFormData.startDate);

    checkTime.setHours(hours, minutes, 0, 0);



    // Check if this time falls within any event that has shared departments

    return allEventsOnDate.some((event: any) => {

      if (!event.startTime || !event.endTime || !event.taggedDepartments) return false;



      // Check if events share any departments

      const hasSharedDepts = event.taggedDepartments.some((dept: string) =>

        selectedEditEvent.taggedDepartments?.includes(dept)

      );

      if (!hasSharedDepts) return false;



      // Parse event times

      const eventStartDate = event.startDate.includes('T') ? event.startDate.split('T')[0] : event.startDate;

      const [eventStartHours, eventStartMinutes] = event.startTime.split(':').map(Number);

      const [eventEndHours, eventEndMinutes] = event.endTime.split(':').map(Number);



      const eventStart = new Date(eventStartDate);

      eventStart.setHours(eventStartHours, eventStartMinutes, 0, 0);



      const eventEnd = new Date(eventStartDate);

      eventEnd.setHours(eventEndHours, eventEndMinutes, 0, 0);



      // Check if this time falls within the event's time range

      return checkTime >= eventStart && checkTime < eventEnd;

    });

  };



  // Handle edit event

  const handleEditEvent = (event: Event) => {

    setSelectedEditEvent(event);



    // Convert dateTimeSlots from event to editFormData format

    // Filter out slots that are outside the event's date range (clean up old data)

    const startDateObj = new Date(event.startDate);

    const endDateObj = new Date(event.endDate);

    startDateObj.setHours(0, 0, 0, 0);

    endDateObj.setHours(0, 0, 0, 0);



    const convertedSlots = (event.dateTimeSlots || [])

      .filter(slot => {

        const slotDate = new Date(slot.startDate);

        slotDate.setHours(0, 0, 0, 0);

        // Only include slots that are AFTER startDate and <= endDate

        return slotDate > startDateObj && slotDate <= endDateObj;

      })

      .map((slot, index) => ({

        id: `slot-${index}`,

        date: new Date(slot.startDate),

        startTime: slot.startTime,

        endTime: slot.endTime

      }));



    setEditFormData({

      location: event.location,

      locations: Array.isArray(event.locations) && event.locations.length > 0 ? event.locations : (event.location ? [event.location] : []),

      startDate: event.startDate,

      startTime: event.startTime,

      endDate: event.endDate,

      endTime: event.endTime,

      dateTimeSlots: convertedSlots

    });

    setShowCustomLocationInput(false);

    setCustomLocation('');

    setShowEditModal(true);

  };



  // Handle edit event details (for on-hold/submitted events)

  const handleEditEventDetails = (event: Event) => {

    setSelectedEditEvent(event);

    setEditDetailsData({

      eventTitle: event.eventTitle,

      requestor: event.requestor,

      participants: event.participants,

      vip: event.vip || 0,

      vvip: event.vvip || 0,

      contactNumber: event.contactNumber,

      contactEmail: event.contactEmail,

      description: event.description || ''

    });

    // Reset file upload states

    setEditAttachments([]);

    setEditBrieferTemplate([]);

    setEditProgramme([]);

    setShowEditDetailsModal(true);

  };



  // Handle save edited event details

  const handleSaveEditedDetails = async () => {

    if (!selectedEditEvent) return;



    // Basic validation

    if (!editDetailsData.eventTitle.trim()) {

      toast.error('Event title is required');

      return;

    }

    if (!editDetailsData.requestor.trim()) {

      toast.error('Requestor name is required');

      return;

    }

    if (editDetailsData.participants < 1) {

      toast.error('Number of participants must be at least 1');

      return;

    }

    if (!editDetailsData.contactNumber.trim()) {

      toast.error('Contact number is required');

      return;

    }

    if (editDetailsData.contactNumber.length !== 11) {

      toast.error('Contact number must be exactly 11 digits');

      return;

    }

    if (!/^\d+$/.test(editDetailsData.contactNumber)) {

      toast.error('Contact number must contain only numbers');

      return;

    }

    if (!editDetailsData.contactEmail.trim()) {

      toast.error('Contact email is required');

      return;

    }



    try {

      const token = localStorage.getItem('authToken');



      // Create FormData for file uploads

      const formData = new FormData();

      formData.append('eventTitle', editDetailsData.eventTitle);

      formData.append('requestor', editDetailsData.requestor);

      formData.append('participants', editDetailsData.participants.toString());

      formData.append('vip', editDetailsData.vip.toString());

      formData.append('vvip', editDetailsData.vvip.toString());

      formData.append('contactNumber', editDetailsData.contactNumber);

      formData.append('contactEmail', editDetailsData.contactEmail);

      formData.append('description', editDetailsData.description);



      // Add attachments

      editAttachments.forEach((file) => {

        formData.append('attachments', file);

      });



      // Add government files

      if (editBrieferTemplate.length > 0) {

        editBrieferTemplate.forEach((file) => {

          formData.append('brieferTemplate', file);

        });

      }

      if (editProgramme.length > 0) {

        editProgramme.forEach((file) => {

          formData.append('programme', file);

        });

      }



      const response = await axios.patch(

        `${API_BASE_URL}/events/${selectedEditEvent._id}/details`,

        formData,

        {

          headers: {

            'Authorization': `Bearer ${token}`,

            'Content-Type': 'multipart/form-data'

          }

        }

      );



      if (response.data.success) {

        toast.success('Event details updated successfully');

        setShowEditDetailsModal(false);

        setSelectedEditEvent(null);

        // Reset file states

        setEditAttachments([]);

        setEditBrieferTemplate([]);

        setEditProgramme([]);

        fetchMyEvents(); // Refresh the events list

      } else {

        toast.error('Failed to update event details');

      }

    } catch (error: any) {

      toast.error(error.response?.data?.message || 'Failed to update event details');

    }

  };



  // Open edit requirement modal

  const handleEditRequirement = (requirement: any, eventId: string, department: string) => {

    setEditingRequirement({ ...requirement, eventId, department });

    setEditRequirementData({

      quantity: requirement.quantity || 0,

      notes: requirement.notes || ''

    });

    setShowEditRequirementModal(true);

  };



  // Handle save edited requirement

  const handleSaveEditedRequirement = async () => {

    if (!editingRequirement) return;



    // Compute effective available quantity, respecting pavilion/location defaults when present

    let effectiveTotal = editingRequirement.totalQuantity;

    if (

      editingRequirement.availabilityNotes &&

      typeof editingRequirement.availabilityNotes === 'string' &&

      editingRequirement.availabilityNotes.startsWith('PAVILION_DEFAULT:')

    ) {

      const parts = editingRequirement.availabilityNotes.split(':');

      const parsed = parseInt(parts[1] || '0', 10);

      if (!isNaN(parsed) && parsed > 0) {

        effectiveTotal = parsed;

      }

    }



    // Validate based on requirement type

    if (editingRequirement.type === 'physical') {

      // Validate quantity for physical requirements

      if (effectiveTotal && editRequirementData.quantity > effectiveTotal) {

        toast.error(`Quantity cannot exceed ${effectiveTotal} (available)`);

        return;

      }



      if (editRequirementData.quantity < 1) {

        toast.error('Quantity must be at least 1');

        return;

      }

    } else {

      // Validate notes for service requirements

      if (!editRequirementData.notes.trim()) {

        toast.error('Notes are required for service requirements');

        return;

      }

    }



    try {

      const token = localStorage.getItem('authToken');



      // First, get the current event data

      const eventResponse = await axios.get(`${API_BASE_URL}/events/${editingRequirement.eventId}`, {

        headers: { 'Authorization': `Bearer ${token}` }

      });



      if (!eventResponse.data.success) {

        toast.error('Failed to fetch event data');

        return;

      }



      const event = eventResponse.data.data;

      const updatedDepartmentRequirements = { ...event.departmentRequirements };



      // Find and update the specific requirement

      if (updatedDepartmentRequirements[editingRequirement.department]) {

        const deptReqs = updatedDepartmentRequirements[editingRequirement.department];

        const reqIndex = deptReqs.findIndex((r: any) => r.id === editingRequirement.id);



        if (reqIndex !== -1) {

          deptReqs[reqIndex] = {

            ...deptReqs[reqIndex],

            quantity: editRequirementData.quantity,

            // DON'T update totalQuantity - that's the system's total availability!

            notes: editRequirementData.notes

          };

        }

      }



      // Update the event with the modified departmentRequirements

      const response = await axios.put(

        `${API_BASE_URL}/events/${editingRequirement.eventId}`,

        {

          departmentRequirements: updatedDepartmentRequirements

        },

        {

          headers: {

            'Authorization': `Bearer ${token}`,

            'Content-Type': 'application/json'

          }

        }

      );



      if (response.data.success) {

        toast.success('Requirement updated successfully');

        setShowEditRequirementModal(false);

        setEditingRequirement(null);



        // Refresh events to show updated data

        fetchMyEvents();



        // If the departments modal is open, refresh that event too

        if (selectedEventDepartments) {

          const updatedEvent = await axios.get(`${API_BASE_URL}/events/${selectedEventDepartments._id}`, {

            headers: { 'Authorization': `Bearer ${token}` }

          });

          if (updatedEvent.data.success) {

            setSelectedEventDepartments(updatedEvent.data.data);

          }

        }

      }

    } catch (error: any) {

      toast.error(error.response?.data?.message || 'Failed to update requirement');

    }

  };



  // Handle change department

  const handleChangeDepartment = (requirement: any, eventId: string, currentDepartment: string) => {

    setChangingRequirement({ ...requirement, eventId, currentDepartment });

    setSelectedDepartments([]); // Start with NO selection - user must choose

    setDepartmentSearchQuery(''); // Reset search query

    setShowChangeDepartmentModal(true);

  };



  // Handle save department change

  const handleSaveDepartmentChange = async () => {

    if (!changingRequirement || selectedDepartments.length === 0) {

      toast.error('Please select at least one department');

      return;

    }



    try {

      const token = localStorage.getItem('authToken');

      const response = await axios.patch(

        `${API_BASE_URL}/events/${changingRequirement.eventId}/requirements/${changingRequirement.id}/departments`,

        {

          departments: selectedDepartments

        },

        {

          headers: {

            'Authorization': `Bearer ${token}`,

            'Content-Type': 'application/json'

          }

        }

      );



      if (response.data.success) {

        toast.success('Department tags updated successfully');

        setShowChangeDepartmentModal(false);

        setChangingRequirement(null);

        setSelectedDepartments([]);



        // Refresh events

        fetchMyEvents();



        // Refresh departments modal if open

        if (selectedEventDepartments) {

          const updatedEvent = await axios.get(`${API_BASE_URL}/events/${selectedEventDepartments._id}`, {

            headers: { 'Authorization': `Bearer ${token}` }

          });

          if (updatedEvent.data.success) {

            setSelectedEventDepartments(updatedEvent.data.data);

          }

        }

      }

    } catch (error: any) {

      toast.error(error.response?.data?.message || 'Failed to update departments');

    }

  };



  // Toggle department selection

  const toggleDepartmentSelection = (department: string) => {

    setSelectedDepartments(prev => {

      if (prev.includes(department)) {

        return prev.filter(d => d !== department);

      } else {

        return [...prev, department];

      }

    });

  };



  // Open add departments modal

  const handleOpenAddDepartments = (event: any) => {

    const availableDepts = allDepartments.filter(dept => !event.taggedDepartments?.includes(dept));



    setAddingToEvent(event);

    setAddDepartmentSearchQuery(''); // Reset search

    setShowAddDepartmentsModal(true);

  };



  // Handle department selection for adding

  const handleSelectDepartmentToAdd = async (deptName: string) => {

    try {

      const token = localStorage.getItem('authToken');

      const response = await axios.get(`${API_BASE_URL}/departments/visible`, {

        headers: { 'Authorization': `Bearer ${token}` }

      });



      if (response.data.success) {

        const dept = response.data.data.find((d: any) => d.name === deptName);

        if (dept && addingToEvent) {

          setSelectedDepartmentData(dept);



          // PGSO special: show default requirements for the event's selected location

          // (matches Request Event page behavior).

          const isPgso = deptName.toLowerCase() === 'pgso' || deptName.toLowerCase().includes('pgso');

          if (isPgso) {
            const locationReqs = await fetchLocationRequirementsForEvent(addingToEvent);

            if (Array.isArray(locationReqs) && locationReqs.length > 0) {
              const basePoolByName = new Map<string, number>();
              locationReqs.forEach((lr: any) => {
                const name = lr?.name;
                const qtyRaw = lr?.quantity;
                const qty = typeof qtyRaw === 'number'
                  ? qtyRaw
                  : typeof qtyRaw === 'string'
                    ? parseInt(qtyRaw, 10)
                    : 0;
                if (name && Number.isFinite(qty) && qty > 0) {
                  basePoolByName.set(name, (basePoolByName.get(name) || 0) + qty);
                }
              });

              // Fetch all events for conflict checking across all event dates
              const eventsResponse = await axios.get(`${API_BASE_URL}/events`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });

              const allEvents = Array.isArray(eventsResponse.data)
                ? eventsResponse.data
                : Array.isArray(eventsResponse.data?.data)
                  ? eventsResponse.data.data
                  : [];

              const normalizeLocation = (s: any) =>
                String(s || '')
                  .toLowerCase()
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/[’']/g, "'");

              const locationsSharePavilionPool = (a: any, b: any): boolean => {
                const aRaw = String(a || '');
                const bRaw = String(b || '');
                if (!aRaw || !bRaw) return false;
                if (aRaw.includes('Pavilion') && bRaw.includes('Pavilion')) return true;
                return normalizeLocation(aRaw) === normalizeLocation(bRaw);
              };

              const selectedLocationsRaw: string[] = Array.isArray(addingToEvent?.locations) && addingToEvent.locations.length > 0
                ? addingToEvent.locations
                : (addingToEvent?.location ? [addingToEvent.location] : []);
              const selectedLocationsNorm = selectedLocationsRaw.map(normalizeLocation).filter((l) => l.length > 0);
              const isSelectedPavilionPool = selectedLocationsRaw.some((l) => String(l || '').includes('Pavilion'));

              // Build all dates for the current event (multi-day support)
              const normalizeDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const buildEventDates = (ev: any): Date[] => {
                const dates: Date[] = [];
                if (ev.startDate) {
                  const start = normalizeDay(new Date(ev.startDate));
                  const end = ev.endDate ? normalizeDay(new Date(ev.endDate)) : start;
                  const cursor = new Date(start);
                  while (cursor <= end) {
                    dates.push(new Date(cursor));
                    cursor.setDate(cursor.getDate() + 1);
                  }
                }
                if (Array.isArray(ev.dateTimeSlots)) {
                  ev.dateTimeSlots.forEach((slot: any) => {
                    if (slot?.startDate) {
                      const slotDay = normalizeDay(new Date(slot.startDate));
                      if (!dates.some(d => d.toDateString() === slotDay.toDateString())) {
                        dates.push(slotDay);
                      }
                    }
                  });
                }
                return dates;
              };

              const currentEventDates = buildEventDates(addingToEvent);

              // Helper: check if another event occupies a specific day
              const otherEventUsesDay = (event: any, checkDateStr: string): boolean => {
                if (Array.isArray(event?.dateTimeSlots) && event.dateTimeSlots.length > 0) {
                  return event.dateTimeSlots.some((s: any) =>
                    s?.startDate && normalizeDay(new Date(s.startDate)).toDateString() === checkDateStr
                  );
                }
                if (!event?.startDate) return false;
                const start = normalizeDay(new Date(event.startDate));
                const end = event?.endDate ? normalizeDay(new Date(event.endDate)) : start;
                const day = new Date(checkDateStr);
                return day >= start && day <= end;
              };

              // Helper: check if another event has location overlap with current event
              const hasLocationOverlap = (event: any): boolean => {
                const eventLocationsRaw: string[] = Array.isArray(event?.locations) && event.locations.length > 0
                  ? event.locations
                  : (event?.location ? [event.location] : []);
                const eventLocationsNorm = eventLocationsRaw.map(normalizeLocation).filter((l) => l.length > 0);

                return selectedLocationsNorm.length === 0
                  ? true
                  : isSelectedPavilionPool
                    ? eventLocationsRaw.some((l) => locationsSharePavilionPool(selectedLocationsRaw[0], l))
                    : eventLocationsNorm.some((l) => selectedLocationsNorm.includes(l));
              };

              // Filter to events that overlap on ANY of current event's dates + have location overlap
              const conflictingEvents = allEvents.filter((event: any) => {
                if (event._id === addingToEvent._id) return false;
                if (event.status === 'cancelled') return false;
                if (event.status !== 'approved' && event.status !== 'submitted') return false;

                const hasDateOverlap = currentEventDates.some(d =>
                  otherEventUsesDay(event, d.toDateString())
                );
                if (!hasDateOverlap) return false;

                if (!hasLocationOverlap(event)) return false;

                return true;
              });

              const selectedLocationLabel = Array.isArray(addingToEvent?.locations) && addingToEvent.locations.length > 0
                ? addingToEvent.locations.join(' + ')
                : (addingToEvent.location || 'selected location');

              // Compute per-day availability and take MINIMUM across all event days
              const reqs = Array.from(basePoolByName.entries()).map(([name, baseQuantity]) => {
                const getBookedOnDay = (dayStr: string): number => {
                  let booked = 0;
                  if (addingToEvent.departmentRequirements) {
                    Object.keys(addingToEvent.departmentRequirements).forEach((deptKey: string) => {
                      const deptReqs = addingToEvent.departmentRequirements[deptKey];
                      if (Array.isArray(deptReqs)) {
                        const match = deptReqs.find((r: any) => r.name === name && r.selected);
                        if (match && match.quantity) {
                          booked += match.quantity;
                        }
                      }
                    });
                  }

                  conflictingEvents.forEach((event: any) => {
                    if (!otherEventUsesDay(event, dayStr)) return;

                    if (event.taggedDepartments && event.departmentRequirements) {
                      event.taggedDepartments.forEach((deptKey: string) => {
                        const deptReqs = event.departmentRequirements[deptKey];
                        if (Array.isArray(deptReqs)) {
                          const matchingReq = deptReqs.find((r: any) => r.name === name && r.selected);
                          if (matchingReq && matchingReq.quantity) {
                            booked += matchingReq.quantity;
                          }
                        }
                      });
                    }
                  });

                  return booked;
                };

                const perDayAvail = currentEventDates.map(d => {
                  const booked = getBookedOnDay(d.toDateString());
                  return Math.max(0, (baseQuantity || 0) - booked);
                });
                const actualAvailable = perDayAvail.length > 0 ? Math.min(...perDayAvail) : Math.max(0, baseQuantity || 0);
                const worstDayBooked = (baseQuantity || 0) - actualAvailable;

                return {
                  id: `pgso-location-${name}`,
                  name,
                  type: 'physical',
                  selected: false,
                  quantity: 1,
                  notes: '',
                  totalQuantity: actualAvailable,
                  baseQuantity,
                  bookedQuantity: worstDayBooked,
                  isAvailable: actualAvailable > 0,
                  availabilityNotes: `PAVILION_DEFAULT:${baseQuantity}:${selectedLocationLabel}`
                };
              });

              setDepartmentRequirements(reqs);
              setShowDepartmentRequirementsModal(true);
              return;
            }
          }

          // Fetch resource availability and calculate multi-day availability for non-PGSO / regular departments
          const normalizeDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const buildEventDates = (ev: any): Date[] => {
            const dates: Date[] = [];
            if (ev.startDate) {
              const start = normalizeDay(new Date(ev.startDate));
              const end = ev.endDate ? normalizeDay(new Date(ev.endDate)) : start;
              const cursor = new Date(start);
              while (cursor <= end) {
                dates.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 1);
              }
            }
            if (Array.isArray(ev.dateTimeSlots)) {
              ev.dateTimeSlots.forEach((slot: any) => {
                if (slot?.startDate) {
                  const slotDay = normalizeDay(new Date(slot.startDate));
                  if (!dates.some(d => d.toDateString() === slotDay.toDateString())) {
                    dates.push(slotDay);
                  }
                }
              });
            }
            return dates;
          };

          const currentEventDates = buildEventDates(addingToEvent);
          const eventDate = new Date(addingToEvent.startDate);
          const year = eventDate.getFullYear();
          const month = String(eventDate.getMonth() + 1).padStart(2, '0');
          const day = String(eventDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const availResponse = await axios.get(
            `${API_BASE_URL}/resource-availability/department/${dept._id}/availability?startDate=${dateStr}&endDate=${dateStr}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          const availabilities = Array.isArray(availResponse.data)
            ? availResponse.data
            : Array.isArray(availResponse.data?.data)
              ? availResponse.data.data
              : [];

          const eventsResponse = await axios.get(`${API_BASE_URL}/events`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          const allEvents = Array.isArray(eventsResponse.data)
            ? eventsResponse.data
            : Array.isArray(eventsResponse.data?.data)
              ? eventsResponse.data.data
              : [];

          const normalizeLocation = (s: any) =>
            String(s || '')
              .toLowerCase()
              .trim()
              .replace(/\s+/g, ' ')
              .replace(/[’']/g, "'");

          const locationsSharePavilionPool = (a: any, b: any): boolean => {
            const aRaw = String(a || '');
            const bRaw = String(b || '');
            if (!aRaw || !bRaw) return false;
            if (aRaw.includes('Pavilion') && bRaw.includes('Pavilion')) return true;
            return normalizeLocation(aRaw) === normalizeLocation(bRaw);
          };

          const selectedLocationsRaw: string[] = Array.isArray(addingToEvent?.locations) && addingToEvent.locations.length > 0
            ? addingToEvent.locations
            : (addingToEvent?.location ? [addingToEvent.location] : []);
          const selectedLocationsNorm = selectedLocationsRaw.map(normalizeLocation).filter((l) => l.length > 0);
          const isSelectedPavilionPool = selectedLocationsRaw.some((l) => String(l || '').includes('Pavilion'));

          const otherEventUsesDay = (event: any, checkDateStr: string): boolean => {
            if (Array.isArray(event?.dateTimeSlots) && event.dateTimeSlots.length > 0) {
              return event.dateTimeSlots.some((s: any) =>
                s?.startDate && normalizeDay(new Date(s.startDate)).toDateString() === checkDateStr
              );
            }
            if (!event?.startDate) return false;
            const start = normalizeDay(new Date(event.startDate));
            const end = event?.endDate ? normalizeDay(new Date(event.endDate)) : start;
            const dayObj = new Date(checkDateStr);
            return dayObj >= start && dayObj <= end;
          };

          const hasLocationOverlap = (event: any): boolean => {
            const eventLocationsRaw: string[] = Array.isArray(event?.locations) && event.locations.length > 0
              ? event.locations
              : (event?.location ? [event.location] : []);
            const eventLocationsNorm = eventLocationsRaw.map(normalizeLocation).filter((l) => l.length > 0);

            return selectedLocationsNorm.length === 0
              ? true
              : isSelectedPavilionPool
                ? eventLocationsRaw.some((l) => locationsSharePavilionPool(selectedLocationsRaw[0], l))
                : eventLocationsNorm.some((l) => selectedLocationsNorm.includes(l));
          };

          const conflictingEvents = allEvents.filter((event: any) => {
            if (event._id === addingToEvent._id) return false;
            if (event.status === 'cancelled') return false;
            if (event.status !== 'approved' && event.status !== 'submitted') return false;

            const hasDateOverlap = currentEventDates.some(d =>
              otherEventUsesDay(event, d.toDateString())
            );
            if (!hasDateOverlap) return false;

            if (!hasLocationOverlap(event)) return false;

            return true;
          });

          const reqs = (dept.requirements || []).map((req: any) => {
            const avail = availabilities.find((a: any) => a.requirementId === req._id);

            let baseQuantity: number = 0;
            if (dept.name === 'PGSO' && avail?.notes && typeof avail.notes === 'string' && avail.notes.startsWith('PAVILION_DEFAULT:')) {
              const parts = avail.notes.split(':');
              const pavilionQty = parseInt(parts[1] || '0', 10);
              if (!isNaN(pavilionQty) && pavilionQty > 0) {
                baseQuantity = pavilionQty;
              } else {
                baseQuantity = (avail?.quantity || req.totalQuantity || 0);
              }
            } else {
              baseQuantity = (avail?.quantity ?? req.totalQuantity ?? 0);
            }

            // Compute per-day booked quantity and take MINIMUM availability across all event days
            const perDayAvail = currentEventDates.map((checkDay) => {
              const dayStr = checkDay.toDateString();
              let bookedOnDay = 0;

              // Check what THIS event has already booked
              if (addingToEvent.departmentRequirements && addingToEvent.departmentRequirements[deptName]) {
                const currentEventReqs = addingToEvent.departmentRequirements[deptName];
                const alreadyBooked = currentEventReqs.find((r: any) => r.name === req.text);
                if (alreadyBooked && alreadyBooked.quantity) {
                  bookedOnDay += alreadyBooked.quantity;
                }
              }

              // Check what conflicting events have booked on this day
              conflictingEvents.forEach((event: any) => {
                if (!otherEventUsesDay(event, dayStr)) return;
                if (event.departmentRequirements && event.departmentRequirements[deptName]) {
                  const deptReqs = event.departmentRequirements[deptName];
                  const matchingReq = deptReqs.find((r: any) => r.name === req.text);
                  if (matchingReq && matchingReq.quantity) {
                    bookedOnDay += matchingReq.quantity;
                  }
                }
              });

              return Math.max(0, baseQuantity - bookedOnDay);
            });

            const actualAvailable = perDayAvail.length > 0 ? Math.min(...perDayAvail) : Math.max(0, baseQuantity);
            const worstDayBooked = baseQuantity - actualAvailable;

            return {
              id: req._id,
              name: req.text,
              type: req.type,
              selected: false,
              quantity: req.type === 'physical' ? 1 : undefined,
              notes: '',
              totalQuantity: actualAvailable,
              baseQuantity: baseQuantity,
              bookedQuantity: worstDayBooked,
              isAvailable: (avail?.isAvailable ?? true) && actualAvailable > 0,
              availabilityNotes: avail?.notes || ''
            };
          });

          setDepartmentRequirements(reqs);
          setShowDepartmentRequirementsModal(true);
        }
      }
    } catch (error) {

      toast.error('Failed to load department requirements');

    }

  };



  // Toggle requirement selection

  const toggleRequirementSelection = (reqId: string) => {

    setDepartmentRequirements(prev => {

      const target = prev.find((r) => r.id === reqId);

      if (target?.isCustom && target.selected) {

        // For custom requirements, unchecking removes it (matches Request Event behavior)

        return prev.filter((r) => r.id !== reqId);

      }

      return prev.map(req => req.id === reqId ? { ...req, selected: !req.selected } : req);

    });

  };



  // Update requirement quantity

  const updateRequirementQuantity = (reqId: string, quantity: number) => {

    setDepartmentRequirements(prev =>

      prev.map(req => req.id === reqId ? { ...req, quantity } : req)

    );

  };



  // Update requirement notes

  const updateRequirementNotes = (reqId: string, notes: string) => {

    setDepartmentRequirements(prev =>

      prev.map(req => req.id === reqId ? { ...req, notes } : req)

    );

  };



  const handleAddCustomRequirement = () => {

    if (!selectedDepartmentData?.name) return;

    if (selectedDepartmentData.name.toLowerCase().includes('pgso')) {

      toast.error('Custom requirements are not available for PGSO');

      return;

    }

    if (!customRequirement.trim()) {

      toast.error('Please enter a custom requirement name');

      return;

    }



    const isPhysical = customRequirementType === 'physical';

    const quantityValue = isPhysical ? parseInt(pendingCustomQuantity, 10) : undefined;



    if (isPhysical && (!quantityValue || quantityValue <= 0)) {

      toast.error('Please enter a valid quantity greater than 0');

      return;

    }



    const deptName = selectedDepartmentData.name;

    const newId = `${deptName.toLowerCase().replace(/\s+/g, '-')}-custom-${Date.now()}`;



    const newRequirement = {

      id: newId,

      name: customRequirement.trim(),

      selected: true,

      type: customRequirementType,

      quantity: isPhysical ? quantityValue : undefined,

      totalQuantity: isPhysical ? quantityValue : undefined,

      isAvailable: true,

      isCustom: true,

      notes: ''

    };



    setDepartmentRequirements((prev) => [...prev, newRequirement]);



    setCustomRequirement('');

    setCustomRequirementType('service');

    setPendingCustomQuantity('1');

    setShowCustomInput(false);



    toast.success(`Custom ${isPhysical ? 'quantity-based' : 'service'} requirement added`);

  };



  // Save department with requirements

  const handleSaveDepartmentRequirements = async () => {

    const selectedReqs = departmentRequirements.filter(r => r.selected);



    if (selectedReqs.length === 0) {

      toast.error('Please select at least one requirement');

      return;

    }



    try {

      const token = localStorage.getItem('authToken');

      const response = await axios.post(

        `${API_BASE_URL}/events/${addingToEvent._id}/add-department`,

        {

          departmentName: selectedDepartmentData.name,

          requirements: selectedReqs

        },

        {

          headers: {

            'Authorization': `Bearer ${token}`,

            'Content-Type': 'application/json'

          }

        }

      );



      if (response.data.success) {

        toast.success(`Added ${selectedDepartmentData.name} with ${selectedReqs.length} requirement(s)`);

        setShowDepartmentRequirementsModal(false);

        setShowAddDepartmentsModal(false);

        setSelectedDepartmentData(null);

        setDepartmentRequirements([]);

        setCustomRequirement('');

        setCustomRequirementType('service');

        setPendingCustomQuantity('1');

        setShowCustomInput(false);

        setAddingToEvent(null);

        fetchMyEvents();

      }

    } catch (error: any) {

      toast.error(error.response?.data?.message || 'Failed to add department');

    }

  };



  // Handle save edited event

  const handleSaveEditedEvent = async () => {

    if (!selectedEditEvent) return;



    const dateTimeToLocalDate = (dateStr: string, timeStr: string) => {

      const safeDate = String(dateStr || '').split('T')[0];

      const safeTime = String(timeStr || '').trim();

      return new Date(`${safeDate}T${safeTime}:00`);

    };



    const normalizeSlots = (slots: Array<{ startDate: string; startTime: string; endDate: string; endTime: string }>) => {

      return [...slots]

        .map((s) => ({

          startDate: String(s.startDate || '').split('T')[0],

          startTime: String(s.startTime || ''),

          endDate: String(s.endDate || '').split('T')[0],

          endTime: String(s.endTime || '')

        }))

        .sort((a, b) => {

          const aKey = `${a.startDate} ${a.startTime} ${a.endTime}`;

          const bKey = `${b.startDate} ${b.startTime} ${b.endTime}`;

          return aKey.localeCompare(bKey);

        });

    };



    if (selectedEditEvent.startDate && selectedEditEvent.startTime) {

      const now = new Date();

      const currentStart = dateTimeToLocalDate(selectedEditEvent.startDate, selectedEditEvent.startTime);

      if (!Number.isNaN(currentStart.getTime()) && now >= currentStart) {

        toast.error('Reschedule blocked: event is already ongoing', {

          description: 'You cannot reschedule an event that has already started.'

        });

        return;

      }

    }



    const convertedSlotsForComparison = editFormData.dateTimeSlots

      .filter(slot => {

        if (!slot.startTime || !slot.endTime) return false;

        const slotDate = new Date(slot.date);

        const startDateObj = new Date(editFormData.startDate);

        const endDateObj = new Date(editFormData.endDate);

        slotDate.setHours(0, 0, 0, 0);

        startDateObj.setHours(0, 0, 0, 0);

        endDateObj.setHours(0, 0, 0, 0);

        return slotDate > startDateObj && slotDate <= endDateObj;

      })

      .map(slot => ({

        startDate: slot.date.toISOString().split('T')[0],

        startTime: slot.startTime,

        endDate: slot.date.toISOString().split('T')[0],

        endTime: slot.endTime

      }));



    const currentSlotsForComparison = (selectedEditEvent.dateTimeSlots || [])

      .filter((slot: any) => {

        if (!slot?.startDate || !slot?.startTime || !slot?.endTime) return false;

        const slotDate = new Date(slot.startDate);

        const startDateObj = new Date(selectedEditEvent.startDate);

        const endDateObj = new Date(selectedEditEvent.endDate);

        slotDate.setHours(0, 0, 0, 0);

        startDateObj.setHours(0, 0, 0, 0);

        endDateObj.setHours(0, 0, 0, 0);

        return slotDate > startDateObj && slotDate <= endDateObj;

      })

      .map((slot: any) => ({

        startDate: String(slot.startDate).split('T')[0],

        startTime: String(slot.startTime),

        endDate: String(slot.endDate || slot.startDate).split('T')[0],

        endTime: String(slot.endTime)

      }));



    const isSameSchedule = (

      String(editFormData.location || '') === String(selectedEditEvent.location || '') &&

      JSON.stringify((editFormData.locations || []).slice().sort()) === JSON.stringify((Array.isArray(selectedEditEvent.locations) ? selectedEditEvent.locations : [selectedEditEvent.location]).slice().sort()) &&

      String(editFormData.startDate || '').split('T')[0] === String(selectedEditEvent.startDate || '').split('T')[0] &&

      String(editFormData.startTime || '') === String(selectedEditEvent.startTime || '') &&

      String(editFormData.endDate || '').split('T')[0] === String(selectedEditEvent.endDate || '').split('T')[0] &&

      String(editFormData.endTime || '') === String(selectedEditEvent.endTime || '') &&

      JSON.stringify(normalizeSlots(convertedSlotsForComparison)) === JSON.stringify(normalizeSlots(currentSlotsForComparison))

    );



    if (isSameSchedule) {

      toast.error('No changes detected', {

        description: 'Your selected schedule is the same as your current schedule. Please pick a different date/time.'

      });

      return;

    }



    // Check for time conflicts before saving

    if (editFormData.startDate && editFormData.startTime && editFormData.endTime && editFormData.location) {

      const hasConflict = venueConflictingEvents.some(event => {

        if (event.location !== editFormData.location) return false;



        // Convert times to minutes for easier comparison

        const timeToMinutes = (time: string) => {

          const [hours, minutes] = time.split(':').map(Number);

          return hours * 60 + minutes;

        };



        const newStartMinutes = timeToMinutes(editFormData.startTime);

        const newEndMinutes = timeToMinutes(editFormData.endTime);

        const eventStartMinutes = timeToMinutes(event.startTime);

        const eventEndMinutes = timeToMinutes(event.endTime);



        // Check if the new time range overlaps with existing event

        return (newStartMinutes < eventEndMinutes && newEndMinutes > eventStartMinutes);

      });



      if (hasConflict) {

        const conflictDetails = conflictingEvents

          .filter(event => {

            if (event.location !== editFormData.location) return false;



            const timeToMinutes = (time: string) => {

              const [hours, minutes] = time.split(':').map(Number);

              return hours * 60 + minutes;

            };



            const newStartMinutes = timeToMinutes(editFormData.startTime);

            const newEndMinutes = timeToMinutes(editFormData.endTime);

            const eventStartMinutes = timeToMinutes(event.startTime);

            const eventEndMinutes = timeToMinutes(event.endTime);



            return (newStartMinutes < eventEndMinutes && newEndMinutes > eventStartMinutes);

          })

          .map((event: any) =>

            `"${event.eventTitle}" (${formatTime(event.startTime)}-${formatTime(event.endTime)})`

          ).join(', ');



        toast.error(`Cannot save! Time conflict detected at ${editFormData.location}`, {

          description: `Your selected time (${formatTime(editFormData.startTime)}-${formatTime(editFormData.endTime)}) conflicts with: ${conflictDetails}`,

          duration: 8000,

        });

        return; // Don't save if there are conflicts

      }

    }



    try {

      const token = localStorage.getItem('authToken');



      // Convert dateTimeSlots back to API format (only include slots with both start and end times)

      // AND only include slots that are between startDate and endDate (exclude old/invalid dates)

      const convertedSlots = editFormData.dateTimeSlots

        .filter(slot => {

          // Must have both times

          if (!slot.startTime || !slot.endTime) return false;



          // Must be between startDate and endDate (not before startDate, not after endDate)

          // Create fresh date objects for comparison to avoid mutation issues

          const slotDate = new Date(slot.date);

          const startDateObj = new Date(editFormData.startDate);

          const endDateObj = new Date(editFormData.endDate);



          // Normalize to midnight for date-only comparison

          slotDate.setHours(0, 0, 0, 0);

          startDateObj.setHours(0, 0, 0, 0);

          endDateObj.setHours(0, 0, 0, 0);



          // Slot must be AFTER startDate (Day 2+, not Day 1)

          return slotDate > startDateObj && slotDate <= endDateObj;

        })

        .map(slot => ({

          startDate: slot.date.toISOString().split('T')[0],

          startTime: slot.startTime,

          endDate: slot.date.toISOString().split('T')[0],

          endTime: slot.endTime

        }));

      console.log('[handleSaveEditedEvent] editFormData.location:', editFormData.location, '| editFormData.locations:', editFormData.locations);

      const updateData = {

        location: editFormData.location,

        locations: editFormData.locations && editFormData.locations.length > 1 ? editFormData.locations : undefined,

        multipleLocations: editFormData.locations && editFormData.locations.length > 1,

        startDate: editFormData.startDate,

        startTime: editFormData.startTime,

        endDate: editFormData.endDate,

        endTime: editFormData.endTime,

        dateTimeSlots: convertedSlots, // Include multi-day slots

        previousLocation: selectedEditEvent.location, // Store previous location for reschedule log

        previousStartDate: selectedEditEvent.startDate,

        previousStartTime: selectedEditEvent.startTime,

        previousEndDate: selectedEditEvent.endDate,

        previousEndTime: selectedEditEvent.endTime

      };



      const headers = {

        'Authorization': `Bearer ${token}`,

        'Content-Type': 'application/json'

      };



      const response = await axios.put(

        `${API_BASE_URL}/events/${selectedEditEvent._id}`,

        updateData,

        { headers }

      );



      if (response.data.success) {

        toast.success('Event updated successfully!');

        setShowEditModal(false);

        fetchMyEvents(); // Refresh the events list

      } else {

        toast.error('Failed to update event');

      }

    } catch (error) {

      toast.error('Failed to update event');

    }

  };



  return (

    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">

      {/* Status Tabs Filter */}

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          const filterMap: { [key: string]: string } = {
            All: 'all',
            Submitted: 'submitted',
            Approved: 'approved',
            Incoming: 'incoming',
            Ongoing: 'ongoing',
            Completed: 'completed',
            Rejected: 'rejected',
            Draft: 'draft',
            Cancelled: 'cancelled',
          };
          setStatusFilter(filterMap[val] || 'all');
        }}
        className="w-full"
      >
        <TabsList className="w-full bg-blue-50/50 p-1 rounded-lg flex-wrap h-auto">
          {[
            { key: 'All', label: 'All' },
            { key: 'Submitted', label: 'Submitted' },
            { key: 'Approved', label: 'Approved' },
            { key: 'Incoming', label: 'Incoming' },
            { key: 'Ongoing', label: 'Ongoing' },
            { key: 'Completed', label: 'Completed' },
            { key: 'Rejected', label: 'Rejected' },
            { key: 'Draft', label: 'Draft' },
            { key: 'Cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-xs md:text-sm px-3 py-1.5`}
            >
              {tab.label} ({eventsByStatus[tab.key]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Compact Header Row */}

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">My Events</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage and track your event requests
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={fetchMyEvents}
            variant="outline"
            size="sm"
            className="gap-2 flex-1 sm:flex-none"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs">Refresh</span>
          </Button>
          <Button
            onClick={() => window.location.href = '/users/request-event'}
            size="sm"
            className="gap-2 flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs">New Event</span>
          </Button>
        </div>
      </motion.div>

      {/* Search + Sort Bar */}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[170px] text-sm border border-gray-300 rounded-lg">
              <ArrowUpDown className="w-4 h-4 text-gray-500 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Smart (Incoming ? Ongoing ? Completed)</SelectItem>
              <SelectItem value="date-asc">Event Date (Earliest First)</SelectItem>
              <SelectItem value="date-desc">Event Date (Latest First)</SelectItem>
              <SelectItem value="oldest">Created Date (Oldest First)</SelectItem>
              <SelectItem value="title">Title (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events List */}

      <div className="relative space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Card key={idx} className="border">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedEvents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No events found' : 'No events yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'You haven\'t created any event requests yet.'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => window.location.href = '/users/request-event'}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Event
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((event) => {
              const statusInfo = getStatusInfo(event.dynamicStatus);
              const isExpanded = expandedCards.has(event._id);

              const borderColorMap: { [key: string]: string } = {
                rejected: 'border-red-500',
                cancelled: 'border-gray-400',
                approved: 'border-emerald-500',
                incoming: 'border-emerald-500',
                submitted: 'border-amber-500',
                draft: 'border-blue-400',
                completed: 'border-blue-600',
                ongoing: 'border-green-500',
              };
              const borderClass = borderColorMap[event.dynamicStatus] || 'border-gray-200';

              return (
                <Collapsible
                  key={event._id}
                  open={isExpanded}
                  onOpenChange={() => toggleCard(event._id)}
                >
                  <Card className={`border-l-4 ${borderClass} hover:shadow-sm transition-shadow`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <CollapsibleTrigger asChild>
                          <div className="flex-1 space-y-2 cursor-pointer">
                            {/* Status Badges Row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {event.status === 'rejected' || event.dynamicStatus === 'rejected' ? (
                                <HoverCard openDelay={150}>
                                  <HoverCardTrigger asChild>
                                    <div 
                                      className="inline-block"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Badge
                                        variant={statusInfo.variant}
                                        className={`gap-1 text-xs cursor-help ${statusInfo.className || ''}`}
                                      >
                                        {statusInfo.icon}
                                        {statusInfo.label}
                                      </Badge>
                                    </div>
                                  </HoverCardTrigger>
                                  <HoverCardContent 
                                    className="w-80 bg-white text-gray-900 border shadow-lg z-50" 
                                    side="top" 
                                    align="start" 
                                    sideOffset={5}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-2 text-left">
                                      <h4 className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                                        Rejection Details
                                      </h4>
                                      <div className="bg-red-50/70 rounded-md p-2.5 border border-red-100">
                                        <p className="text-xs text-red-950 font-medium">
                                          <span className="text-red-700 font-semibold">Reason: </span>
                                          {event.reason || (event.bacApprovalStatus === 'rejected' && event.bacNotes ? event.bacNotes : 'No reason provided.')}
                                        </p>
                                      </div>
                                      {event.bacApprovalStatus === 'rejected' && event.bacNotes && event.reason && (
                                        <p className="text-[11px] text-amber-800">
                                          <span className="font-semibold">BAC Department Note: </span>
                                          {event.bacNotes}
                                        </p>
                                      )}
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              ) : (event.status === 'cancelled' || event.dynamicStatus === 'cancelled') ? (
                                <HoverCard openDelay={150}>
                                  <HoverCardTrigger asChild>
                                    <div 
                                      className="inline-block"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Badge
                                        variant={statusInfo.variant}
                                        className={`gap-1 text-xs cursor-help ${statusInfo.className || ''}`}
                                      >
                                        {statusInfo.icon}
                                        {statusInfo.label}
                                      </Badge>
                                    </div>
                                  </HoverCardTrigger>
                                  <HoverCardContent 
                                    className="w-80 bg-white text-gray-900 border shadow-lg z-50" 
                                    side="top" 
                                    align="start" 
                                    sideOffset={5}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-2 text-left">
                                      <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                        <XCircle className="w-3.5 h-3.5 text-slate-600" />
                                        Cancellation Details
                                      </h4>
                                      <div className="bg-slate-50 rounded-md p-2.5 border border-slate-200">
                                        <p className="text-xs text-slate-800">
                                          <span className="font-semibold text-slate-700">Reason: </span>
                                          {event.reason || 'No reason provided.'}
                                        </p>
                                      </div>
                                      {event.cancelledAt && (
                                        <p className="text-[11px] text-slate-500">
                                          <span className="font-medium">Date: </span>
                                          {new Date(event.cancelledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      )}
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              ) : (
                                <Badge
                                  variant={statusInfo.variant}
                                  className={`gap-1 text-xs ${statusInfo.className || ''}`}
                                >
                                  {statusInfo.icon}
                                  {statusInfo.label}
                                </Badge>
                              )}
                              {event.bacApprovalStatus === 'rejected' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="gap-1 text-xs bg-amber-100 text-amber-800 border-amber-300 cursor-help">
                                      <Info className="w-3 h-3" />
                                      BAC
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs bg-white text-gray-900 border shadow-lg">
                                    <p className="text-xs font-semibold text-amber-800">BAC Department Rejection:</p>
                                    <p className="text-xs text-gray-700 mt-1">{event.bacNotes || 'No notes provided'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {event.dynamicStatus !== event.status && event.status !== 'rejected' && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 text-xs bg-green-100 text-green-800 border-green-200"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                                </Badge>
                              )}
                              {event.status === 'rejected' && (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditEvent(event);
                                  }}
                                  className="gap-1 h-6 px-2 text-[11px] bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Suggest Venue
                                </Button>
                              )}
                            </div>
                            {/* Title */}
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {event.eventTitle}
                            </h3>
                            {/* Requestor */}
                            <p className="text-xs text-gray-500">
                              Requested by {event.requestor}
                            </p>
                            {/* Compact Detail Row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3" />
                                {format(new Date(event.startDate), 'MMM dd, yyyy')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {event.locations && event.locations.length > 1 ? event.locations.join(' + ') : event.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {event.participants}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {event.taggedDepartments.length} dept{event.taggedDepartments.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {/* Toggle indicator */}
                            <div className="flex items-center gap-1 text-xs text-blue-600 pt-1">
                              {isExpanded ? (
                                <><ChevronUp className="w-3.5 h-3.5" /> Less</>
                              ) : (
                                <><ChevronDown className="w-3.5 h-3.5" /> More details</>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs shrink-0">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem onClick={() => handleEditEvent(event)} disabled={event.status === 'completed' || event.dynamicStatus === 'completed'}>
                              <Edit className="w-3.5 h-3.5 mr-2" />
                              Edit Schedule
                            </DropdownMenuItem>
                            {(event.status === 'submitted' || event.status === 'approved') && event.dynamicStatus !== 'completed' && (
                              <DropdownMenuItem onClick={() => handleEditEventDetails(event)}>
                                <Edit className="w-3.5 h-3.5 mr-2" />
                                Edit Details / Files
                              </DropdownMenuItem>
                            )}
                            {(event.status === 'submitted' || event.status === 'approved') && (
                              <DropdownMenuItem onClick={() => handleOpenAddDepartments(event)}>
                                <Plus className="w-3.5 h-3.5 mr-2" />
                                Add More Departments
                              </DropdownMenuItem>
                            )}
                            {(event.status === 'submitted' || event.status === 'approved' || event.status === 'incoming' || event.status === 'ongoing') && (
                              <DropdownMenuItem onClick={() => handleOpenCancelEvent(event)}>
                                <XCircle className="w-3.5 h-3.5 mr-2" />
                                Cancel Event
                              </DropdownMenuItem>
                            )}
                            {(event.status === 'draft' || event.status === 'rejected' || event.status === 'cancelled') && (
                              <DropdownMenuItem onClick={() => handleDeleteEvent(event._id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete Event
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <CollapsibleContent className="space-y-3 pt-3">
                        {/* Expanded Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-gray-400" />
                            <span>
                              {format(new Date(event.startDate), 'MMM dd, yyyy')}
                              {event.startDate !== event.endDate && ` - ${format(new Date(event.endDate), 'MMM dd, yyyy')}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            {event.locations && event.locations.length > 1 ? (
                              <span>{event.locations.join(', ')}</span>
                            ) : (
                              <span>{event.location}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span>{event.participants} participants</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>{event.taggedDepartments.length} department{event.taggedDepartments.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        {/* Expanded Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewEvent(event)}
                            className="gap-1 h-8 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details / Requirements
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowDepartments(event)}
                            className="gap-1 h-8 text-xs relative"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            Tagged / Requirements
                            {getTaggedUpdatesCount(event) > 0 && !viewedTaggedRequirementsEvents.has(event._id) && (
                              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] min-w-[16px] h-[16px] px-1">
                                {getTaggedUpdatesCount(event) > 99 ? '99+' : getTaggedUpdatesCount(event)}
                              </span>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowFiles(event)}
                            className="gap-1 h-8 text-xs"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            Files
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              );
            })}

            {filteredAndSortedEvents.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((c) => c + 20)}
                  className="w-full sm:w-auto"
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>



      {/* Event Details Modal */}

      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>

        <DialogContent className="w-[calc(100vw-2rem)] sm:w-[95vw] md:w-[90vw] lg:w-[85vw] xl:w-[80vw] max-w-7xl max-h-[90vh] overflow-y-auto p-4 md:p-6 lg:p-8">

          <DialogHeader>

            <DialogTitle className="text-lg md:text-xl">Event Details</DialogTitle>

            <DialogDescription className="text-xs md:text-sm">

              Complete information about your event request

            </DialogDescription>

          </DialogHeader>



          {selectedEvent && (

            <div className="space-y-4 md:space-y-6 py-3 md:py-4">

              {/* Basic Info */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">

                <div className="space-y-3 md:space-y-4">

                  <div>

                    <label className="text-xs md:text-sm font-medium text-gray-700">Event Title</label>

                    <p className="text-xs md:text-sm text-gray-900 mt-1 truncate" title={selectedEvent.eventTitle}>{selectedEvent.eventTitle}</p>

                  </div>

                  <div>

                    <label className="text-xs md:text-sm font-medium text-gray-700">Requestor</label>

                    <p className="text-xs md:text-sm text-gray-900 mt-1">{selectedEvent.requestor}</p>

                  </div>

                  <div>

                    <label className="text-xs md:text-sm font-medium text-gray-700">

                      Location{selectedEvent.locations && selectedEvent.locations.length > 1 ? 's' : ''}

                    </label>

                    {selectedEvent.locations && selectedEvent.locations.length > 1 ? (

                      <div className="flex flex-wrap gap-1 mt-1">

                        {selectedEvent.locations.map((loc, idx) => (

                          <Badge key={idx} variant="secondary" className="text-xs">

                            {loc}

                          </Badge>

                        ))}

                      </div>

                    ) : (

                      <p className="text-xs md:text-sm text-gray-900 mt-1">{selectedEvent.location}</p>

                    )}

                  </div>

                  {selectedEvent.roomType && (

                    <div>

                      <label className="text-xs md:text-sm font-medium text-gray-700">Room Type</label>

                      <p className="text-xs md:text-sm text-gray-900 mt-1">{selectedEvent.roomType}</p>

                    </div>

                  )}

                </div>



                <div className="space-y-4">

                  <div>

                    <label className="text-sm font-medium text-gray-700">Status</label>

                    <div className="mt-1">

                      {selectedEvent.status === 'cancelled' ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="inline-block cursor-help">
                              <Badge 
                                variant={getStatusInfo(selectedEvent.status).variant}
                                className={`gap-1 ${getStatusInfo(selectedEvent.status).className || ''}`}
                              >
                                {getStatusInfo(selectedEvent.status).icon}
                                {getStatusInfo(selectedEvent.status).label}
                              </Badge>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 bg-white text-gray-900 border shadow-lg">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4 text-slate-600" />
                                Cancellation Details
                              </h4>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Reason: </span>
                                {selectedEvent.reason || 'No reason provided.'}
                              </p>
                              {selectedEvent.cancelledAt && (
                                <p className="text-xs text-gray-500">
                                  Date: {new Date(selectedEvent.cancelledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : selectedEvent.status === 'rejected' ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="inline-block cursor-help">
                              <Badge 
                                variant={getStatusInfo(selectedEvent.status).variant}
                                className={`gap-1 ${getStatusInfo(selectedEvent.status).className || ''}`}
                              >
                                {getStatusInfo(selectedEvent.status).icon}
                                {getStatusInfo(selectedEvent.status).label}
                              </Badge>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 bg-white text-gray-900 border shadow-lg">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-red-600 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4 text-red-600" />
                                Rejection Reason
                              </h4>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium text-gray-900">Reason: </span>
                                {selectedEvent.reason || (selectedEvent.bacApprovalStatus === 'rejected' && selectedEvent.bacNotes ? selectedEvent.bacNotes : 'No reason provided.')}
                              </p>
                              {selectedEvent.bacApprovalStatus === 'rejected' && selectedEvent.bacNotes && selectedEvent.reason && (
                                <p className="text-xs text-amber-800 pt-1">
                                  <span className="font-semibold">BAC Department Note: </span>
                                  {selectedEvent.bacNotes}
                                </p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Badge 
                          variant={getStatusInfo(selectedEvent.status).variant}

                          className={`gap-1 ${getStatusInfo(selectedEvent.status).className || ''}`}

                        >

                          {getStatusInfo(selectedEvent.status).icon}

                          {getStatusInfo(selectedEvent.status).label}

                        </Badge>

                      )}

                    </div>

                  </div>

                  <div>

                    <label className="text-sm font-medium text-gray-700">Participants</label>

                    <p className="text-sm text-gray-900 mt-1">

                      {selectedEvent.participants} total

                      {selectedEvent.vip && selectedEvent.vip > 0 && ` (${selectedEvent.vip} VIP)`}

                      {selectedEvent.vvip && selectedEvent.vvip > 0 && ` (${selectedEvent.vvip} VVIP)`}

                    </p>

                  </div>

                  <div>

                    <label className="text-sm font-medium text-gray-700">Contact Number</label>

                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.contactNumber}</p>

                  </div>

                </div>



                <div className="space-y-4">

                  <div>

                    <label className="text-sm font-medium text-gray-700">Contact Email</label>

                    <p className="text-sm text-gray-900 mt-1">{selectedEvent.contactEmail}</p>

                  </div>

                  <div>

                    <label className="text-sm font-medium text-gray-700">Created</label>

                    <p className="text-sm text-gray-900 mt-1">{format(new Date(selectedEvent.createdAt), 'PPp')}</p>

                  </div>

                </div>

              </div>

              {/* Rejection Details Callout for Rejected Event */}
              {(selectedEvent.status === 'rejected' || (selectedEvent as any).dynamicStatus === 'rejected') && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Reason for Rejection</span>
                  </div>
                  <div className="bg-white/90 rounded-lg p-3 border border-red-100 shadow-xs">
                    <p className="text-sm text-red-950 leading-relaxed font-medium">
                      {selectedEvent.reason || (selectedEvent.bacApprovalStatus === 'rejected' && selectedEvent.bacNotes ? selectedEvent.bacNotes : 'No specific reason provided.')}
                    </p>
                  </div>
                  {selectedEvent.bacApprovalStatus === 'rejected' && selectedEvent.bacNotes && selectedEvent.reason && (
                    <div className="text-xs text-amber-800 pt-1">
                      <span className="font-semibold">BAC Department Note: </span>
                      {selectedEvent.bacNotes}
                    </div>
                  )}
                </div>
              )}

              {/* Cancellation Details Callout for Cancelled Event */}
              {(selectedEvent.status === 'cancelled' || (selectedEvent as any).dynamicStatus === 'cancelled') && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                    <XCircle className="w-4 h-4 text-slate-600" />
                    <span>Cancellation Details</span>
                  </div>
                  <div className="bg-white/90 rounded-lg p-3 border border-slate-200 shadow-xs">
                    <p className="text-sm text-slate-800 leading-relaxed">
                      <span className="font-semibold text-slate-700">Reason: </span>
                      {selectedEvent.reason || 'No specific reason provided.'}
                    </p>
                  </div>
                  {selectedEvent.cancelledAt && (
                    <p className="text-xs text-slate-500">
                      Cancelled on: {new Date(selectedEvent.cancelledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}

              <Separator />



              {/* Description */}

              {selectedEvent.description && (

                <div>

                  <h4 className="text-sm font-medium text-gray-700 mb-3">Description</h4>

                  <div className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${selectedEvent.description.length > 800 ? 'max-h-48 overflow-y-auto scroll-smooth' : ''}`}>

                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">

                      {selectedEvent.description}

                    </p>

                  </div>

                </div>

              )}



              <Separator />



              {/* Schedule */}

              <div>

                <h4 className="text-sm font-medium text-gray-700 mb-3">Schedule</h4>

                <div className="space-y-4">

                  {/* Primary Schedule - Day 1 */}

                  <div>

                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Day 1</p>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">

                      <div className="flex items-center justify-between">

                        <div className="flex items-center gap-3">

                          <CalendarIcon className="w-5 h-5 text-blue-600" />

                          <div>

                            <p className="text-xs font-medium text-gray-500">Date</p>

                            <p className="text-sm font-semibold text-gray-900">

                              {format(new Date(selectedEvent.startDate), 'EEEE, MMMM dd, yyyy')}

                            </p>

                          </div>

                        </div>

                        <div className="flex items-center gap-2">

                          <Clock className="w-4 h-4 text-gray-600" />

                          <p className="text-sm font-medium text-gray-900">

                            {formatTime(selectedEvent.startTime)} - {formatTime(selectedEvent.endTime)}

                          </p>

                        </div>

                      </div>

                    </div>

                  </div>



                  {/* Additional Date/Time Slots */}

                  {selectedEvent.dateTimeSlots && selectedEvent.dateTimeSlots.length > 0 && (

                    <div className="pt-3 border-t">

                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">

                        Additional Date Slots ({selectedEvent.dateTimeSlots.length})

                      </p>

                      <div className="space-y-2">

                        {selectedEvent.dateTimeSlots.map((slot, index) => (

                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">

                            <div className="flex items-center justify-between">

                              <div className="flex items-center gap-3">

                                <CalendarIcon className="w-5 h-5 text-blue-600" />

                                <div>

                                  <p className="text-xs font-medium text-blue-900">Day #{index + 2}</p>

                                  <p className="text-sm text-blue-800">

                                    {format(new Date(slot.startDate), 'EEEE, MMMM dd, yyyy')}

                                  </p>

                                </div>

                              </div>

                              <div className="flex items-center gap-2">

                                <Clock className="w-4 h-4 text-blue-600" />

                                <p className="text-sm font-medium text-blue-900">

                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}

                                </p>

                              </div>

                            </div>

                          </div>

                        ))}

                      </div>

                    </div>

                  )}

                </div>

              </div>



              <Separator />



              {/* Timestamps - Bottom Right */}

              <div className="flex justify-end">

                {selectedEvent.submittedAt && (

                  <div className="text-sm text-gray-600">

                    <span className="font-medium">Submitted:</span> {format(new Date(selectedEvent.submittedAt), 'PPpp')}

                  </div>

                )}

              </div>

            </div>

          )}

        </DialogContent>

      </Dialog>



      <AlertDialog open={!!pendingFileDelete} onOpenChange={(open) => {

        if (!open) setPendingFileDelete(null);

      }}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Delete file?</AlertDialogTitle>

            <AlertDialogDescription>

              This will permanently delete{pendingFileDelete?.label ? ` "${pendingFileDelete.label}"` : ' this file'} from your event.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel disabled={deletingFile}>Cancel</AlertDialogCancel>

            <AlertDialogAction onClick={handleConfirmDeleteFile} disabled={deletingFile}>

              {deletingFile ? 'Deleting...' : 'Delete'}

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>



      {/* Cancel Event Modal */}

      <Dialog open={showCancelEventModal} onOpenChange={setShowCancelEventModal}>

        <DialogContent className="sm:max-w-lg">

          <DialogHeader>

            <DialogTitle>Cancel Event</DialogTitle>

            <DialogDescription>

              This will cancel your event request. This action cannot be undone.

            </DialogDescription>

          </DialogHeader>



          <div className="space-y-3">

            <div className="rounded-md border p-3 bg-muted/30">

              <p className="text-sm font-medium text-gray-900">

                {cancellingEvent?.eventTitle || 'Event'}

              </p>

              <p className="text-xs text-muted-foreground">

                {cancellingEvent?.location}

              </p>

            </div>



            <div className="space-y-1">

              <Label className="text-sm">Reason (optional)</Label>

              <Textarea

                value={cancelEventReason}

                onChange={(e) => setCancelEventReason(e.target.value)}

                placeholder="e.g., Schedule conflict, venue change, etc."

                className="min-h-[90px]"

              />

            </div>

          </div>



          <div className="flex justify-end gap-2 pt-2">

            <Button

              variant="outline"

              onClick={() => setShowCancelEventModal(false)}

              disabled={isCancellingEvent}

            >

              Close

            </Button>

            <Button

              variant="destructive"

              onClick={handleConfirmCancelEvent}

              disabled={isCancellingEvent}

            >

              {isCancellingEvent ? 'Cancelling...' : 'Confirm Cancel'}

            </Button>

          </div>

        </DialogContent>

      </Dialog>





      {/* Tagged Departments Modal */}

      <Dialog open={showDepartmentsModal} onOpenChange={setShowDepartmentsModal}>

        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-6xl max-h-[90vh] overflow-hidden p-0">

          <div className="flex flex-col max-h-[90vh]">

            {/* Modern Header */}

            <div className="px-4 md:px-6 py-3 md:py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">

              <DialogTitle className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">

                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">

                  <Building2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />

                </div>

                <span className="truncate">Tagged Departments & Requirements</span>

              </DialogTitle>

              <DialogDescription className="text-xs md:text-sm text-gray-600 mt-1 md:mt-2">

                Real-time status and coordination details for all involved departments

              </DialogDescription>

            </div>



            {/* Scrollable Content */}

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>

              {selectedEventDepartments && (

                <div key={selectedEventDepartments._id} className="p-3 md:p-4 lg:p-6 space-y-4 md:space-y-6 lg:space-y-8">

                  {/* Quick Status Overview */}

                  <div className="bg-white rounded-xl border shadow-sm p-4 md:p-6">

                    <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">

                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">

                        <CheckCircle className="w-4 h-4 text-green-600" />

                      </div>

                      Requirements Overview

                    </h3>

                    {(() => {

                      const allRequirements = Object.values(selectedEventDepartments.departmentRequirements || {}).flat();

                      const statusCounts = {

                        confirmed: 0,

                        pending: 0,

                        declined: 0,

                        partially_fulfill: 0,

                        in_preparation: 0

                      };



                      allRequirements.forEach((req: any) => {

                        const status = req.status?.toLowerCase() || 'pending';

                        if (statusCounts.hasOwnProperty(status)) {

                          statusCounts[status as keyof typeof statusCounts]++;

                        }

                      });



                      return (

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">

                          <button

                            onClick={() => setSelectedStatusFilter('all')}

                            className={`text-center p-2 md:p-3 lg:p-4 rounded-lg border transition-all hover:shadow-md ${selectedStatusFilter === 'all'

                                ? 'bg-gray-100 border-gray-400 ring-2 ring-gray-300'

                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'

                              }`}

                          >

                            <div className="text-lg md:text-xl lg:text-2xl font-bold text-gray-600">{statusCounts.confirmed + statusCounts.pending + statusCounts.declined + statusCounts.partially_fulfill + statusCounts.in_preparation}</div>

                            <div className="text-xs md:text-sm text-gray-700 font-medium">All</div>

                          </button>

                          <button

                            onClick={() => setSelectedStatusFilter('confirmed')}

                            className={`text-center p-4 rounded-lg border transition-all hover:shadow-md ${selectedStatusFilter === 'confirmed'

                                ? 'bg-green-100 border-green-400 ring-2 ring-green-300'

                                : 'bg-green-50 border-green-200 hover:bg-green-100'

                              }`}

                          >

                            <div className="text-2xl font-bold text-green-600">{statusCounts.confirmed}</div>

                            <div className="text-sm text-green-700 font-medium">Confirmed</div>

                          </button>

                          <button

                            onClick={() => setSelectedStatusFilter('pending')}

                            className={`text-center p-4 rounded-lg border transition-all hover:shadow-md ${selectedStatusFilter === 'pending'

                                ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-300'

                                : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'

                              }`}

                          >

                            <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>

                            <div className="text-sm text-yellow-700 font-medium">Pending</div>

                          </button>

                          <button

                            onClick={() => setSelectedStatusFilter('declined')}

                            className={`text-center p-4 rounded-lg border transition-all hover:shadow-md ${selectedStatusFilter === 'declined'

                                ? 'bg-red-100 border-red-400 ring-2 ring-red-300'

                                : 'bg-red-50 border-red-200 hover:bg-red-100'

                              }`}

                          >

                            <div className="text-2xl font-bold text-red-600">{statusCounts.declined}</div>

                            <div className="text-sm text-red-700 font-medium">Declined</div>

                          </button>

                        </div>

                      );

                    })()}

                  </div>



                  {/* Department Requirements by Department */}

                  {selectedEventDepartments.departmentRequirements && Object.keys(selectedEventDepartments.departmentRequirements).length > 0 && (

                    <div className="space-y-6">

                      {Object.entries(selectedEventDepartments.departmentRequirements).map(([dept, requirements]: [string, any], index) => {

                        // Parse requirements

                        let parsedRequirements = requirements;

                        if (typeof requirements === 'string') {

                          const lines = requirements.split('\n').filter(line => line.trim());

                          if (lines.length > 0 && lines[0].match(/^\d+:/)) {

                            parsedRequirements = lines.map(line => {

                              const match = line.match(/^\d+:(.+)$/);

                              if (match) {

                                try {

                                  return JSON.parse(match[1]);

                                } catch {

                                  return { name: line };

                                }

                              }

                              return { name: line };

                            });

                          }

                        }



                        return (

                          <div key={index} className="bg-white rounded-xl border shadow-sm overflow-hidden">

                            {/* Department Header */}

                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-3 md:px-4 lg:px-6 py-3 md:py-4 border-b">

                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">

                                <div className="flex items-center gap-2 md:gap-3">

                                  <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">

                                    <Building2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />

                                  </div>

                                  <div>

                                    <h4 className="text-base md:text-lg font-semibold text-gray-900">{dept}</h4>

                                    <p className="text-xs md:text-sm text-gray-600">

                                      {Array.isArray(parsedRequirements) ? parsedRequirements.length : 0} Requirements

                                    </p>

                                  </div>

                                </div>

                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">

                                  Department

                                </Badge>

                              </div>

                            </div>



                            {/* Requirements Grid */}

                            <div className="p-3 md:p-4 lg:p-6">

                              {Array.isArray(parsedRequirements) ? (

                                (() => {

                                  const filteredRequirements = parsedRequirements.filter((req: any) => {

                                    // Filter out yesno requirements with 'no' answer

                                    if (req.type === 'yesno' && req.yesNoAnswer === 'no') {

                                      return false;

                                    }

                                    if (selectedStatusFilter === 'all') return true;

                                    const reqStatus = req.status?.toLowerCase() || 'pending';

                                    return reqStatus === selectedStatusFilter;

                                  });



                                  return filteredRequirements.length > 0 ? (

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                      {filteredRequirements.map((req: any, reqIndex: number) => {

                                        const statusBadge = getRequirementStatusBadge(req.status);

                                        return (

                                          <div key={`${dept}-${req.id}-${req.name}`} className="bg-gray-50 rounded-lg border p-3 md:p-4 hover:shadow-md transition-all">

                                            {/* Requirement Header */}

                                            <div className="flex flex-col gap-3 mb-3">

                                              <div className="flex-1">

                                                <h5 className="text-sm md:text-base font-medium text-gray-900 mb-1">

                                                  {req.name || `Requirement ${reqIndex + 1}`}

                                                </h5>

                                                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">

                                                  {req.type && (

                                                    <Badge variant="outline" className="text-[10px] md:text-xs">

                                                      {req.type === 'physical' ? 'Physical' : req.type === 'yesno' ? 'Service - Yes/No' : 'Service'}

                                                    </Badge>

                                                  )}

                                                  <Badge variant="secondary" className="text-[10px] md:text-xs">

                                                    {dept}

                                                  </Badge>

                                                </div>

                                              </div>

                                              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">

                                                <Button

                                                  variant="outline"

                                                  size="sm"

                                                  onClick={() => handleChangeDepartment(req, selectedEventDepartments._id, dept)}

                                                  disabled={req.status?.toLowerCase() === 'confirmed'}

                                                  className="h-7 px-2 gap-1 bg-white text-black border-gray-300 hover:bg-gray-100 hover:border-gray-400 text-[10px] md:text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"

                                                  title={req.status?.toLowerCase() === 'confirmed' ? "Cannot change department for confirmed requirements" : "Change Department"}

                                                >

                                                  <Building2 className="w-3 h-3 md:w-3.5 md:h-3.5" />

                                                  <span className="hidden sm:inline">Change Dept</span>

                                                  <span className="sm:hidden">Change</span>

                                                </Button>

                                                <Button

                                                  variant="outline"

                                                  size="sm"

                                                  onClick={() => handleEditRequirement(req, selectedEventDepartments._id, dept)}

                                                  disabled={req.status?.toLowerCase() === 'confirmed'}

                                                  className="h-7 px-2 gap-1 bg-black text-white border-gray-700 hover:bg-gray-800 hover:border-gray-600 hover:text-white text-[10px] md:text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"

                                                  title={req.status?.toLowerCase() === 'confirmed' ? "Cannot edit confirmed requirements" : "Edit Quantity/Notes"}

                                                >

                                                  <Edit className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />

                                                  <span className="hidden sm:inline text-white">Quantity/Notes</span>

                                                  <span className="sm:hidden text-white">Edit</span>

                                                </Button>

                                                {getRequirementStatusIcon(req.status)}

                                                <Badge className={`text-[10px] md:text-xs ${statusBadge.className}`}>

                                                  {statusBadge.label}

                                                </Badge>

                                              </div>

                                            </div>



                                            {/* Requirement Details */}

                                            <div className="space-y-3">

                                              {/* Quantity/Notes */}

                                              {req.type === 'physical' && req.quantity ? (

                                                <div className="text-sm text-gray-600 bg-white rounded p-2">

                                                  {(() => {

                                                    // Prefer baseQuantity (location/default pool) if present, otherwise fall back to totalQuantity.

                                                    let displayTotal = (typeof req.baseQuantity === 'number' && req.baseQuantity > 0)

                                                      ? req.baseQuantity

                                                      : req.totalQuantity;



                                                    // If availabilityNotes encodes a PAVILION/LOCATION default, override with that quantity.

                                                    if (req.availabilityNotes && req.availabilityNotes.startsWith('PAVILION_DEFAULT:')) {

                                                      const parts = req.availabilityNotes.split(':');

                                                      const parsed = parseInt(parts[1], 10);

                                                      if (!isNaN(parsed) && parsed > 0) {

                                                        displayTotal = parsed;

                                                      }

                                                    }



                                                    return (

                                                      <>

                                                        <span className="font-medium">Requested:</span> {req.quantity}

                                                        {displayTotal && (

                                                          <span className="text-gray-500"> of {displayTotal} available</span>

                                                        )}

                                                      </>

                                                    );

                                                  })()}

                                                </div>

                                              ) : req.type === 'yesno' && req.yesNoAnswer ? (

                                                <div className="text-sm text-gray-600 bg-white rounded p-2">

                                                  <span className="font-medium">Answer:</span> <span className="text-green-600 font-semibold">✓ Yes</span>

                                                </div>

                                              ) : req.notes ? (

                                                <div className="text-sm text-gray-600 bg-white rounded p-2">

                                                  <span className="font-medium">Notes:</span> {req.notes}

                                                </div>

                                              ) : null}



                                              {/* Department Notes (show department name) */}

                                              {req.departmentNotes && (

                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">

                                                  <div className="text-xs font-medium text-blue-800 flex items-center gap-1">

                                                    <FileText className="w-3 h-3" />

                                                    <span>{dept} Notes</span>

                                                  </div>

                                                  <div className="text-sm text-blue-900 whitespace-pre-wrap">

                                                    {req.departmentNotes}

                                                  </div>



                                                  {/* Replies Thread */}

                                                  <div className="pt-2 border-t border-blue-100 space-y-2">

                                                    <Label className="text-[11px] font-medium text-blue-900 flex items-center gap-1">

                                                      <MessageSquare className="w-3 h-3" />

                                                      <span>Replies</span>

                                                    </Label>



                                                    {/* Conversation card with messages + input */}

                                                    <div className="bg-white/80 rounded-md border border-blue-100 min-h-[180px] max-h-60 flex flex-col px-2 py-2 text-xs">

                                                      {/* Scrollable messages */}

                                                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">

                                                        {req.replies && req.replies.length > 0 ? (

                                                          req.replies.map((reply: any, idx: number) => (

                                                            <div

                                                              key={idx}

                                                              className={`flex ${reply.role === 'requestor' ? 'justify-end' : 'justify-start'}`}

                                                            >

                                                              <div

                                                                className={`max-w-[80%] rounded-lg px-2 py-1.5 shadow-sm border text-[11px] whitespace-pre-wrap ${reply.role === 'requestor'

                                                                    ? 'bg-blue-600 text-white border-blue-700'

                                                                    : 'bg-gray-100 text-gray-900 border-gray-200'

                                                                  }`}

                                                              >

                                                                <div className="flex items-center justify-between gap-2 mb-0.5">

                                                                  <span className="font-semibold truncate max-w-[140px]">

                                                                    {reply.role === 'requestor' ? 'You' : reply.userName || 'Department'}

                                                                  </span>

                                                                  <span className="text-[9px] opacity-80">

                                                                    {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}

                                                                  </span>

                                                                </div>

                                                                <p className="leading-snug">

                                                                  {reply.message}

                                                                </p>

                                                              </div>

                                                            </div>

                                                          ))

                                                        ) : (

                                                          <p className="text-[11px] text-gray-400 italic">

                                                            No replies yet.

                                                          </p>

                                                        )}

                                                      </div>



                                                      {/* Reply input inside card */}

                                                      <div className="mt-2 border-t pt-2 space-y-1.5">

                                                        <Label className="text-[11px] text-gray-700">

                                                          Your reply as <span className="font-semibold">Requestor</span>

                                                        </Label>

                                                        <div className="flex items-center gap-2">

                                                          <Input

                                                            className="text-xs bg-white/90 border-blue-200 focus-visible:ring-blue-500 flex-1 h-8"

                                                            placeholder="Type your reply to this department..."

                                                            value={requirementReplyDrafts[req.id] || ''}

                                                            onChange={(e) =>

                                                              setRequirementReplyDrafts(prev => ({

                                                                ...prev,

                                                                [req.id]: e.target.value

                                                              }))

                                                            }

                                                          />

                                                          <Button

                                                            type="button"

                                                            size="sm"

                                                            className="h-8 px-3 text-[11px] bg-blue-600 hover:bg-blue-700 whitespace-nowrap"

                                                            disabled={!requirementReplyDrafts[req.id]?.trim()}

                                                            onClick={async () => {

                                                              const message = requirementReplyDrafts[req.id]?.trim();

                                                              if (!message || !selectedEventDepartments) return;



                                                              try {

                                                                const token = localStorage.getItem('authToken');

                                                                const response = await axios.patch(

                                                                  `${API_BASE_URL}/events/${selectedEventDepartments._id}/requirements/${req.id}/replies`,

                                                                  {

                                                                    message,

                                                                    role: 'requestor'

                                                                  },

                                                                  {

                                                                    headers: {

                                                                      'Authorization': token ? `Bearer ${token}` : '',

                                                                      'Content-Type': 'application/json'

                                                                    }

                                                                  }

                                                                );



                                                                if (response.data?.success && response.data.data) {

                                                                  const updatedEvent = response.data.data;



                                                                  // Update events list so cards stay in sync

                                                                  setEvents(prev =>

                                                                    prev.map(ev => ev._id === updatedEvent._id ? updatedEvent : ev)

                                                                  );



                                                                  // Update the currently open departments modal event

                                                                  setSelectedEventDepartments(updatedEvent);



                                                                  // Clear draft for this requirement

                                                                  setRequirementReplyDrafts(prev => ({

                                                                    ...prev,

                                                                    [req.id]: ''

                                                                  }));



                                                                  toast.success('Reply sent');

                                                                } else {

                                                                  toast.error('Failed to send reply');

                                                                }

                                                              } catch (error) {

                                                                toast.error('Failed to send reply');

                                                              }

                                                            }}

                                                          >

                                                            Send Reply

                                                          </Button>

                                                        </div>

                                                      </div>

                                                    </div>

                                                  </div>

                                                </div>

                                              )}



                                              {/* Decline Reason */}

                                              {req.status?.toLowerCase() === 'declined' && req.declineReason && (

                                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">

                                                  <div className="flex items-start gap-2">

                                                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />

                                                    <div className="flex-1">

                                                      <p className="text-xs font-medium text-red-900 mb-1">Decline Reason:</p>

                                                      <p className="text-sm text-red-800">{req.declineReason}</p>

                                                    </div>

                                                  </div>

                                                </div>

                                              )}



                                              {/* Availability & Updates */}

                                              <div className="flex items-center justify-between text-xs text-gray-500 mt-3">

                                                {req.isAvailable !== undefined && (

                                                  <div className="flex items-center gap-1">

                                                    {req.isAvailable ? (

                                                      <>

                                                        <CheckCircle className="w-3 h-3 text-green-500" />

                                                        <span className="text-green-600">Available</span>

                                                      </>

                                                    ) : (

                                                      <>

                                                        <XCircle className="w-3 h-3 text-red-500" />

                                                        <span className="text-red-600">Not Available</span>

                                                      </>

                                                    )}

                                                  </div>

                                                )}

                                                {req.lastUpdated && (

                                                  <div className="flex items-center gap-1">

                                                    <Clock className="w-3 h-3" />

                                                    <span>Updated: {new Date(req.lastUpdated).toLocaleDateString()}</span>

                                                  </div>

                                                )}

                                              </div>

                                            </div>

                                          </div>

                                        );

                                      })}

                                    </div>

                                  ) : (

                                    <div className="text-center py-8 text-gray-500">

                                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />

                                      <p>No requirements found for "{selectedStatusFilter === 'all' ? 'all statuses' : selectedStatusFilter}" status</p>

                                      <button

                                        onClick={() => setSelectedStatusFilter('all')}

                                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"

                                      >

                                        Show all requirements

                                      </button>

                                    </div>

                                  );

                                })()

                              ) : (

                                <div className="text-center py-8 text-gray-500">

                                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />

                                  <p>No detailed requirements available</p>

                                </div>

                              )}

                            </div>

                          </div>

                        );

                      })}

                    </div>

                  )}



                  {/* No Departments Message */}

                  {selectedEventDepartments.taggedDepartments.length === 0 && (

                    <div className="text-center py-12">

                      <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />

                      <h3 className="text-xl font-medium text-gray-900 mb-2">No Departments Tagged</h3>

                      <p className="text-gray-500">This event doesn't have any departments tagged yet.</p>

                    </div>

                  )}

                </div>

              )}

            </div>



            {/* Footer */}

            <div className="border-t bg-gray-50 px-6 py-4">

              <div className="flex justify-end">

                <Button

                  onClick={() => setShowDepartmentsModal(false)}

                  className="px-6"

                >

                  Close

                </Button>

              </div>

            </div>

          </div>

        </DialogContent>

      </Dialog>





      {/* Files Modal */}

      <Dialog open={showFilesModal} onOpenChange={setShowFilesModal}>

        <DialogContent className="max-w-3xl w-[75vw] max-h-[80vh] overflow-y-auto p-5">

          <DialogHeader className="pb-4">

            <DialogTitle className="text-xl font-medium text-gray-900">

              Event Files

            </DialogTitle>

            <DialogDescription className="text-sm text-gray-600">

              All attachments and government files for this event

            </DialogDescription>

          </DialogHeader>



          {selectedEventFiles && (

            <div className="space-y-6">

              {/* Regular Attachments */}

              {selectedEventFiles.attachments && selectedEventFiles.attachments.length > 0 && (

                <div>

                  <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">

                    <Paperclip className="w-4 h-4" />

                    Attachments ({selectedEventFiles.attachments.length})

                  </h4>

                  <div className="grid grid-cols-1 gap-3">

                    {selectedEventFiles.attachments.map((attachment, index) => (

                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">

                        <div className="flex items-center gap-3 min-w-0 pr-4">

                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">

                            <FileText className="w-5 h-5 text-blue-600" />

                          </div>

                          <div className="flex-1 min-w-0">

                            <p

                              className="text-sm font-medium text-gray-900 truncate max-w-[150px] sm:max-w-[180px] lg:max-w-[220px]"

                              title={attachment.originalName}

                            >

                              {attachment.originalName}

                            </p>

                            <p className="text-xs text-gray-500">

                              {formatMimeType(attachment.mimetype)}  {(attachment.size / 1024).toFixed(1)} KB

                            </p>

                          </div>

                        </div>

                        <div className="flex items-center gap-2">

                          <Button

                            variant="outline"

                            size="sm"

                            onClick={() => {

                              window.open(`${API_BASE_URL}/events/attachment/${attachment.filename}`, '_blank');

                            }}

                            className="gap-1"

                          >

                            <Eye className="w-3 h-3" />

                            View

                          </Button>

                          <Button

                            variant="outline"

                            size="sm"

                            onClick={() => {

                              window.open(`${API_BASE_URL}/events/attachment/${attachment.filename}?download=true`, '_blank');

                            }}

                            className="gap-1"

                          >

                            <Download className="w-3 h-3" />

                            Download

                          </Button>

                        </div>

                      </div>

                    ))}

                  </div>

                </div>

              )}



              {/* Government Files */}

              {selectedEventFiles.govFiles && (

                selectedEventFiles.govFiles.brieferTemplate ||

                selectedEventFiles.govFiles.programme

              ) && (

                  <div>

                    <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">

                      <Building2 className="w-4 h-4" />

                      Government Files

                    </h4>

                    <div className="grid grid-cols-1 gap-3">

                      {/* Briefer Template */}

                      {selectedEventFiles.govFiles.brieferTemplate && (

                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">

                          <div className="flex items-center gap-3 min-w-0 pr-4">

                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">

                              <FileText className="w-5 h-5 text-green-600" />

                            </div>

                            <div className="flex-1 min-w-0">

                              <p

                                className="text-sm font-medium text-gray-900 truncate max-w-[190px] sm:max-w-[220px] lg:max-w-[260px]"

                                title={selectedEventFiles.govFiles.brieferTemplate.originalName}

                              >

                                {selectedEventFiles.govFiles.brieferTemplate.originalName}

                              </p>

                              <p className="text-xs text-gray-500">

                                {formatMimeType(selectedEventFiles.govFiles.brieferTemplate.mimetype)}  {(selectedEventFiles.govFiles.brieferTemplate.size / 1024).toFixed(1)} KB

                              </p>

                              <p className="text-xs text-green-600 font-medium">Event Briefer</p>

                            </div>

                          </div>

                          <div className="flex items-center gap-2">

                            <Button

                              variant="outline"

                              size="sm"

                              onClick={async () => {

                                try {

                                  const url = `${API_BASE_URL}/events/govfile/${selectedEventFiles.govFiles!.brieferTemplate!.filename}`;

                                  const response = await fetch(url, { method: 'HEAD' });

                                  if (response.ok) {

                                    window.open(url, '_blank');

                                  } else {

                                    toast.error('File not available', {

                                      description: 'This file may not exist in your local environment. It works in production.'

                                    });

                                  }

                                } catch (error) {

                                  toast.error('Cannot access file', {

                                    description: 'File may not exist in localhost. Check production or upload files to test.'

                                  });

                                }

                              }}

                              className="gap-1"

                            >

                              <Eye className="w-3 h-3" />

                              View

                            </Button>

                            <Button

                              variant="outline"

                              size="sm"

                              onClick={async () => {

                                try {

                                  const url = `${API_BASE_URL}/events/govfile/${selectedEventFiles.govFiles!.brieferTemplate!.filename}`;

                                  const response = await fetch(url, { method: 'HEAD' });

                                  if (response.ok) {

                                    window.open(`${url}?download=true`, '_blank');

                                  } else {

                                    toast.error('File not available', {

                                      description: 'This file may not exist in your local environment. It works in production.'

                                    });

                                  }

                                } catch (error) {

                                  toast.error('Cannot download file', {

                                    description: 'File may not exist in localhost. Check production or upload files to test.'

                                  });

                                }

                              }}

                              className="gap-1"

                            >

                              <Download className="w-3 h-3" />

                              Download

                            </Button>

                          </div>

                        </div>

                      )}



                      {/* Programme */}

                      {selectedEventFiles.govFiles.programme && (

                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">

                          <div className="flex items-center gap-3 min-w-0">

                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">

                              <FileText className="w-5 h-5 text-green-600" />

                            </div>

                            <div className="flex-1 min-w-0">

                              <p

                                className="text-sm font-medium text-gray-900 truncate max-w-[190px] sm:max-w-[220px] lg:max-w-[260px]"

                                title={selectedEventFiles.govFiles.programme.originalName}

                              >

                                {selectedEventFiles.govFiles.programme.originalName}

                              </p>

                              <p className="text-xs text-gray-500">

                                {formatMimeType(selectedEventFiles.govFiles.programme.mimetype)}  {(selectedEventFiles.govFiles.programme.size / 1024).toFixed(1)} KB

                              </p>

                              <p className="text-xs text-green-600 font-medium">Program Flow</p>

                            </div>

                          </div>

                          <div className="flex items-center gap-2">

                            <Button

                              variant="outline"

                              size="sm"

                              onClick={() => {

                                window.open(`${API_BASE_URL}/events/govfile/${selectedEventFiles.govFiles!.programme!.filename}`, '_blank');

                              }}

                              className="gap-1"

                            >

                              <Eye className="w-3 h-3" />

                              View

                            </Button>

                            <Button

                              variant="outline"

                              size="sm"

                              onClick={() => {

                                window.open(`${API_BASE_URL}/events/govfile/${selectedEventFiles.govFiles!.programme!.filename}?download=true`, '_blank');

                              }}

                              className="gap-1"

                            >

                              <Download className="w-3 h-3" />

                              Download

                            </Button>

                          </div>

                        </div>

                      )}

                    </div>

                  </div>

                )}



              {/* No Files Message */}

              {(!selectedEventFiles.attachments || selectedEventFiles.attachments.length === 0) &&

                (!selectedEventFiles.govFiles ||

                  (!selectedEventFiles.govFiles.brieferTemplate &&

                    !selectedEventFiles.govFiles.programme)) && (

                  <div className="text-center py-8">

                    <Paperclip className="w-12 h-12 text-gray-400 mx-auto mb-4" />

                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Files Attached</h3>

                    <p className="text-gray-500">This event doesn't have any attachments or government files.</p>

                  </div>

                )}

            </div>

          )}



          <div className="flex justify-center pt-4 mt-6">

            <Button

              onClick={() => setShowFilesModal(false)}

              variant="outline"

              className="px-6 py-2"

            >

              Close

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      {/* Edit Event Sheet */}

      <Sheet open={showEditModal} onOpenChange={setShowEditModal}>

        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">

          {selectedEditEvent && (

            <div className="flex flex-col flex-1 min-h-0">

              <SheetHeader className="px-6 pt-6 pb-0">

                <SheetTitle className="text-xl">

                  Schedule Event at {
                    (editFormData.locations && editFormData.locations.length > 1)
                      ? editFormData.locations.join(' + ')
                      : (editFormData.location || selectedEditEvent?.location || 'Selected Location')
                  }

                </SheetTitle>

                <SheetDescription>

                  Use Find Venue to automatically suggest available locations.

                </SheetDescription>

              </SheetHeader>

              <div className="flex-1 overflow-y-auto space-y-6 px-6 py-4">

                {/* Event Title (Read-only) */}

                <div className="bg-gray-50 rounded-lg p-4 border">

                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Event Title</Label>

                  <p className="text-base font-semibold text-gray-900 mt-1">{selectedEditEvent.eventTitle}</p>

                </div>



                {/* Find Venue Button */}

                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-4">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-3">

                      <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">

                        <Wand2 className="w-5 h-5 text-violet-600" />

                      </div>

                      <div>

                        <h3 className="text-sm font-semibold text-gray-900">Need help finding a venue?</h3>

                        <p className="text-xs text-gray-600 mt-0.5">Let us suggest available locations based on your event details</p>

                      </div>

                    </div>

                    <Button

                      type="button"

                      onClick={() => {

                        if (selectedEditEvent) {

                          setAutoSuggestParticipants(selectedEditEvent.participants.toString());

                          setAutoSuggestStartDate((() => { const d = new Date(editFormData.startDate || selectedEditEvent.startDate); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })());

                          setAutoSuggestEndDate((() => { const d = new Date(editFormData.endDate || selectedEditEvent.endDate); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })());

                          setAutoSuggestStartTime(editFormData.startTime || selectedEditEvent.startTime);

                          setAutoSuggestEndTime(editFormData.endTime || selectedEditEvent.endTime);

                        }

                        setShowAutoSuggestModal(true);

                      }}

                      className="bg-violet-600 hover:bg-violet-700 text-white gap-2 whitespace-nowrap"

                    >

                      <Sparkles className="w-4 h-4" />

                      Find Venue

                    </Button>

                  </div>

                </div>

              </div>

            </div>

          )}

          <SheetFooter className="border-t bg-gray-50 px-6 py-4">

            <Button

              variant="outline"

              onClick={() => setShowEditModal(false)}

            >

              Cancel

            </Button>

            <Button

              onClick={handleSaveEditedEvent}

            >

              Save Changes

            </Button>

          </SheetFooter>

        </SheetContent>

      </Sheet>



      {/* Edit Requirement Modal */}

      <Dialog open={showEditRequirementModal} onOpenChange={setShowEditRequirementModal}>

        <DialogContent className="sm:max-w-[500px]">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <Edit className="w-5 h-5 text-blue-600" />

              Edit Requirement

            </DialogTitle>

            <DialogDescription>

              Update the quantity and notes for this requirement

            </DialogDescription>

          </DialogHeader>



          {editingRequirement && (

            <div className="space-y-4 py-4">

              {/* Requirement Info */}

              <div className="bg-gray-50 rounded-lg p-3 border">

                <p className="text-sm font-medium text-gray-900">{editingRequirement.name}</p>

                <p className="text-xs text-gray-600 mt-1">

                  Department: {editingRequirement.department}

                </p>

                {editingRequirement.type && (

                  <Badge variant="outline" className="text-xs mt-2">

                    {editingRequirement.type}

                  </Badge>

                )}

              </div>



              {/* Conditional: Quantity for Physical, Notes for Service */}

              {editingRequirement.type === 'physical' ? (

                <>

                  {/* Quantity Input - Physical Requirements */}

                  <div className="space-y-2">

                    <Label htmlFor="edit-quantity">

                      Quantity <span className="text-red-500">*</span>

                    </Label>

                    {(() => {

                      // Compute the same effective total used in validation

                      let effectiveTotal = editingRequirement.totalQuantity;

                      if (

                        editingRequirement.availabilityNotes &&

                        typeof editingRequirement.availabilityNotes === 'string' &&

                        editingRequirement.availabilityNotes.startsWith('PAVILION_DEFAULT:')

                      ) {

                        const parts = editingRequirement.availabilityNotes.split(':');

                        const parsed = parseInt(parts[1] || '0', 10);

                        if (!isNaN(parsed) && parsed > 0) {

                          effectiveTotal = parsed;

                        }

                      }



                      return (

                        <>

                          <Input

                            id="edit-quantity"

                            type="number"

                            min="1"

                            max={effectiveTotal}

                            value={editRequirementData.quantity}

                            onChange={(e) => setEditRequirementData(prev => ({

                              ...prev,

                              quantity: parseInt(e.target.value) || 0

                            }))}

                            placeholder="Enter quantity"

                          />

                          <p className="text-xs text-gray-500">

                            Current Available: <span className="font-medium text-gray-700">{effectiveTotal}</span>

                          </p>

                          {effectiveTotal && editRequirementData.quantity > effectiveTotal && (

                            <p className="text-xs text-red-600 flex items-center gap-1">

                              <AlertTriangle className="w-3 h-3" />

                              Quantity cannot exceed available amount

                            </p>

                          )}

                        </>

                      );

                    })()}

                  </div>



                  {/* Notes Input (Optional for Physical) */}

                  <div className="space-y-2">

                    <Label htmlFor="edit-notes">Notes (Optional)</Label>

                    <Textarea

                      id="edit-notes"

                      value={editRequirementData.notes}

                      onChange={(e) => setEditRequirementData(prev => ({

                        ...prev,

                        notes: e.target.value

                      }))}

                      placeholder="Add any additional notes..."

                      rows={4}

                      className="resize-none"

                    />

                    <p className="text-xs text-gray-500">

                      {editRequirementData.notes.length}/500 characters

                    </p>

                  </div>

                </>

              ) : (

                <>

                  {/* Notes Input - Service Requirements */}

                  <div className="space-y-2">

                    <Label htmlFor="edit-notes">

                      Notes <span className="text-red-500">*</span>

                    </Label>

                    <Textarea

                      id="edit-notes"

                      value={editRequirementData.notes}

                      onChange={(e) => setEditRequirementData(prev => ({

                        ...prev,

                        notes: e.target.value

                      }))}

                      placeholder="Enter service details and requirements..."

                      rows={6}

                      className="resize-none"

                    />

                    <p className="text-xs text-gray-500">

                      {editRequirementData.notes.length}/500 characters

                    </p>

                  </div>

                </>

              )}

            </div>

          )}



          {/* Action Buttons */}

          <div className="flex justify-end gap-3 pt-4 border-t">

            <Button

              variant="outline"

              onClick={() => {

                setShowEditRequirementModal(false);

                setEditingRequirement(null);

              }}

            >

              Cancel

            </Button>

            <Button

              onClick={handleSaveEditedRequirement}

              disabled={

                editingRequirement?.type === 'physical'

                  ? (!editRequirementData.quantity ||

                    editRequirementData.quantity < 1 ||

                    editRequirementData.quantity > editingRequirement?.totalQuantity)

                  : !editRequirementData.notes.trim()

              }

            >

              Save Changes

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      {/* Change Department Modal */}

      <Dialog open={showChangeDepartmentModal} onOpenChange={setShowChangeDepartmentModal}>

        <DialogContent className="sm:max-w-[500px]">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <Building2 className="w-5 h-5 text-blue-600" />

              Change Department Tags

            </DialogTitle>

            <DialogDescription>

              Select the correct department(s) for this requirement

            </DialogDescription>

          </DialogHeader>



          {changingRequirement && (

            <div className="space-y-4 py-4">

              {/* Requirement Info */}

              <div className="bg-gray-50 rounded-lg p-3 border">

                <p className="text-sm font-medium text-gray-900">{changingRequirement.name}</p>

                <p className="text-xs text-gray-600 mt-1">

                  Current Department: <span className="font-medium">{changingRequirement.currentDepartment}</span>

                </p>

              </div>



              {/* Department Selection */}

              <div className="space-y-3">

                <Label className="text-sm font-medium">Select Department(s)</Label>



                {/* Search Input */}

                <div className="relative">

                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />

                  <Input

                    placeholder="Search departments..."

                    value={departmentSearchQuery}

                    onChange={(e) => setDepartmentSearchQuery(e.target.value)}

                    className="pl-10"

                  />

                </div>



                {/* Department List */}

                <div className="max-h-[300px] overflow-y-auto border rounded-lg p-3 space-y-2">

                  {allDepartments

                    .filter((dept) =>

                      dept.toLowerCase().includes(departmentSearchQuery.toLowerCase())

                    )

                    .sort((a, b) => {

                      // Sort current department first

                      if (a === changingRequirement.currentDepartment) return -1;

                      if (b === changingRequirement.currentDepartment) return 1;

                      // Then alphabetically

                      return a.localeCompare(b);

                    })

                    .map((dept) => (

                      <div

                        key={dept}

                        className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50"

                      >

                        <Checkbox

                          id={`dept-${dept}`}

                          checked={selectedDepartments.includes(dept)}

                          onCheckedChange={() => toggleDepartmentSelection(dept)}

                          className="cursor-pointer"

                        />

                        <label

                          htmlFor={`dept-${dept}`}

                          className="text-sm flex-1 cursor-pointer"

                          onClick={() => toggleDepartmentSelection(dept)}

                        >

                          {dept}

                        </label>

                      </div>

                    ))}



                  {/* No Results Message */}

                  {allDepartments.filter((dept) =>

                    dept.toLowerCase().includes(departmentSearchQuery.toLowerCase())

                  ).length === 0 && (

                      <div className="text-center py-8 text-gray-500">

                        <p className="text-sm">No departments found</p>

                        <p className="text-xs mt-1">Try a different search term</p>

                      </div>

                    )}

                </div>



                <p className="text-xs text-gray-500">

                  {selectedDepartments.length} department(s) selected

                </p>

              </div>

            </div>

          )}



          {/* Action Buttons */}

          <div className="flex justify-end gap-3 pt-4 border-t">

            <Button

              variant="outline"

              onClick={() => {

                setShowChangeDepartmentModal(false);

                setChangingRequirement(null);

                setSelectedDepartments([]);

                setDepartmentSearchQuery('');

              }}

            >

              Cancel

            </Button>

            <Button

              onClick={handleSaveDepartmentChange}

              disabled={selectedDepartments.length === 0}

            >

              Save Changes

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      {/* Add Departments Modal - Select Department */}

      <Dialog open={showAddDepartmentsModal} onOpenChange={setShowAddDepartmentsModal}>

        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">

              <Plus className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />

              Add Department to Event

            </DialogTitle>

            <DialogDescription className="text-xs md:text-sm">

              Select a department to tag to this event

            </DialogDescription>

          </DialogHeader>



          <div className="space-y-3 md:space-y-4 py-3 md:py-4">

            {/* Event Info */}

            {addingToEvent && (

              <div className="bg-gray-50 rounded-lg p-3 border">

                <p className="text-sm font-medium text-gray-900">{addingToEvent.eventTitle}</p>

                <p className="text-xs text-gray-600 mt-1">

                  {new Date(addingToEvent.startDate).toLocaleDateString()} • {addingToEvent.location}

                </p>

              </div>

            )}



            {/* Department List */}

            <div className="space-y-2">

              <Label className="text-sm font-medium">Select Department</Label>



              {/* Search Input */}

              <div className="relative">

                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />

                <Input

                  placeholder="Search departments..."

                  value={addDepartmentSearchQuery}

                  onChange={(e) => setAddDepartmentSearchQuery(e.target.value)}

                  className="pl-10"

                />

              </div>



              <div className="max-h-[400px] overflow-y-auto border rounded-lg p-3 space-y-2">

                {allDepartments

                  .filter(dept => dept.toLowerCase().includes(addDepartmentSearchQuery.toLowerCase()))

                  .map((dept) => {

                    const isAlreadyTagged = addingToEvent?.taggedDepartments?.includes(dept);

                    return (

                      <div

                        key={dept}

                        onClick={() => handleSelectDepartmentToAdd(dept)}

                        className="flex items-center justify-between p-3 rounded hover:bg-gray-50 cursor-pointer border border-transparent hover:border-blue-200 transition-all"

                      >

                        <div className="flex items-center gap-2">

                          <span className="text-sm font-medium">{dept}</span>

                          {isAlreadyTagged && (

                            <Badge variant="secondary" className="text-xs">

                              Already Tagged

                            </Badge>

                          )}

                        </div>

                        <ChevronRight className="w-4 h-4 text-gray-400" />

                      </div>

                    );

                  })}



                {allDepartments

                  .filter(dept => dept.toLowerCase().includes(addDepartmentSearchQuery.toLowerCase()))

                  .length === 0 && (

                    <div className="text-center py-8 text-gray-500">

                      <p className="text-sm">No departments found</p>

                    </div>

                  )}

              </div>

            </div>

          </div>



          <div className="flex justify-end gap-3 pt-4 border-t">

            <Button

              variant="outline"

              onClick={() => {

                setShowAddDepartmentsModal(false);

                setAddingToEvent(null);

                setAddDepartmentSearchQuery('');

              }}

            >

              Cancel

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      {/* Department Requirements Modal */}

      <Dialog open={showDepartmentRequirementsModal} onOpenChange={setShowDepartmentRequirementsModal}>

        <DialogContent className="sm:max-w-2xl">

          <DialogHeader>

            <div className="flex items-center justify-between">

              <div className="flex-1">

                <DialogTitle className="text-lg font-medium">

                  Requirements - {selectedDepartmentData?.name}

                </DialogTitle>

                <DialogDescription className="text-sm text-muted-foreground">

                  Select requirements for this department

                </DialogDescription>

                {addingToEvent?.startDate && (

                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-xs">

                    📅 Showing availability for {new Date(addingToEvent.startDate).toDateString()}

                  </div>

                )}

              </div>

            </div>

          </DialogHeader>



          <div className="space-y-4 py-4">

            <div className="space-y-3">

              <h4 className="text-sm font-medium text-foreground">Available Requirements</h4>



              <div className="space-y-3 max-h-96 overflow-y-auto">

                {departmentRequirements.length > 0 ? (

                  departmentRequirements.map((req) => (

                    <div

                      key={req.id}

                      className={`p-3 border rounded-lg transition-all ${!req.isAvailable

                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'

                          : req.selected

                            ? 'bg-blue-50 border-blue-200 shadow-sm cursor-pointer'

                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'

                        }`}

                      onClick={() => req.isAvailable && toggleRequirementSelection(req.id)}

                    >

                      <div className="flex items-start justify-between">

                        <div className="flex-1">

                          <div className="flex items-center gap-2 mb-2">

                            <Checkbox

                              checked={req.selected}

                              disabled={!req.isAvailable}

                              onCheckedChange={() => req.isAvailable && toggleRequirementSelection(req.id)}

                              className="mt-0.5"

                            />

                            <h5 className={`font-medium text-sm ${req.isAvailable ? 'text-gray-900' : 'text-gray-500'}`}>

                              {req.name}

                            </h5>

                            <Badge

                              variant={req.type === 'physical' ? 'secondary' : 'outline'}

                              className="text-xs"

                            >

                              <div className="flex items-center gap-1">

                                {req.type === 'physical' ? (

                                  <><Package className="w-3 h-3" /> Physical</>

                                ) : (

                                  <><Settings className="w-3 h-3" /> Service</>

                                )}

                              </div>

                            </Badge>

                            {req.isCustom && (

                              <Badge variant="secondary" className="text-xs bg-orange-600 text-white">Custom</Badge>

                            )}

                          </div>



                          <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">

                            <div className="flex items-center gap-1">

                              <span className="font-medium">Available Quantity:</span>

                              <span className={req.totalQuantity !== undefined && req.totalQuantity !== null ? 'text-gray-900' : 'text-gray-400'}>

                                {req.totalQuantity ?? 'N/A'}

                              </span>

                            </div>

                            <div className="flex items-center gap-1">

                              <span className="font-medium">Status:</span>

                              {req.isCustom ? (

                                <span className="flex items-center gap-1 text-orange-600">

                                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>

                                  Pending

                                </span>

                              ) : (

                                <span className={`flex items-center gap-1 ${req.isAvailable ? 'text-green-600' : 'text-red-600'}`}>

                                  <div className={`w-2 h-2 rounded-full ${req.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>

                                  {req.isAvailable ? 'Available' : 'Unavailable'}

                                </span>

                              )}

                            </div>

                          </div>



                          {req.type === 'physical' && req.selected && (

                            <div className="mt-3">

                              <Label className="text-xs">Quantity</Label>

                              <Input

                                type="number"

                                min={0}

                                max={req.totalQuantity}

                                value={req.quantity || ''}

                                onChange={(e) => updateRequirementQuantity(req.id, parseInt(e.target.value) || 0)}

                                className="mt-1"

                                placeholder="Enter quantity"

                                onClick={(e) => e.stopPropagation()}

                              />

                            </div>

                          )}

                        </div>

                      </div>

                    </div>

                  ))

                ) : (

                  <div className="text-center py-8 px-4">

                    <div className="flex flex-col items-center gap-3">

                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">

                        <Building2 className="w-8 h-8 text-gray-400" />

                      </div>

                      <div className="space-y-1 text-center">

                        <h5 className="font-medium text-gray-900 text-center">No Requirements Available</h5>

                        <p className="text-sm text-gray-600 max-w-md text-center mx-auto">

                          The <strong>{selectedDepartmentData?.name}</strong> department has no default requirements.

                        </p>

                        {!selectedDepartmentData?.name?.toLowerCase().includes('pgso') && (

                          <p className="text-xs text-gray-500 mt-2 text-center">

                            Use <strong>Add Custom Requirement</strong> below.

                          </p>

                        )}

                      </div>

                    </div>

                  </div>

                )}



                {!selectedDepartmentData?.name?.toLowerCase().includes('pgso') && (

                  <div

                    className={`p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${showCustomInput

                        ? 'bg-blue-50 border-blue-300'

                        : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'

                      }`}

                    onClick={() => setShowCustomInput(true)}

                  >

                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">

                      <Plus className="w-4 h-4" />

                      Add Custom Requirement

                    </div>

                  </div>

                )}

              </div>

            </div>

          </div>



          {!selectedDepartmentData?.name?.toLowerCase().includes('pgso') && (

            <Dialog open={showCustomInput} onOpenChange={setShowCustomInput}>

              <DialogContent className="sm:max-w-md">

                <DialogHeader>

                  <DialogTitle>Add Custom Requirement</DialogTitle>

                  <DialogDescription>

                    Define a new requirement for {selectedDepartmentData?.name || 'this department'}.

                  </DialogDescription>

                </DialogHeader>

                <div className="space-y-4 pt-2">

                  <div className="space-y-2">

                    <Label className="text-xs font-medium text-gray-900">Requirement Name</Label>

                    <Input

                      placeholder="Enter custom requirement name..."

                      value={customRequirement}

                      onChange={(e) => setCustomRequirement(e.target.value)}

                    />

                  </div>

                  <div className="space-y-2">

                    <Label className="text-xs font-medium text-gray-900">Type</Label>

                    <Select

                      value={customRequirementType || 'service'}

                      onValueChange={(value: 'physical' | 'service') => setCustomRequirementType(value)}

                    >

                      <SelectTrigger className="w-full">

                        <SelectValue placeholder="Select type" />

                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="physical">

                          <div className="flex items-center gap-2">

                            <Package className="w-3 h-3" />

                            Quantity (Physical Item)

                          </div>

                        </SelectItem>

                        <SelectItem value="service">

                          <div className="flex items-center gap-2">

                            <Settings className="w-3 h-3" />

                            Service

                          </div>

                        </SelectItem>

                      </SelectContent>

                    </Select>

                  </div>



                  {customRequirementType === 'physical' && (

                    <div className="space-y-2">

                      <Label className="text-xs font-medium text-gray-900">Quantity Needed</Label>

                      <Input

                        type="number"

                        min="1"

                        value={pendingCustomQuantity}

                        onChange={(e) => setPendingCustomQuantity(e.target.value)}

                      />

                    </div>

                  )}

                </div>

                <div className="mt-4 flex justify-end gap-2">

                  <Button variant="outline" onClick={() => setShowCustomInput(false)} className="text-xs">

                    Cancel

                  </Button>

                  <Button onClick={handleAddCustomRequirement} disabled={!customRequirement.trim()} className="text-xs">

                    Add

                  </Button>

                </div>

              </DialogContent>

            </Dialog>

          )}



          <div className="flex justify-end gap-2 pt-4 border-t">

            <Button

              variant="outline"

              onClick={() => {

                setShowDepartmentRequirementsModal(false);

                setSelectedDepartmentData(null);

                setDepartmentRequirements([]);

                setCustomRequirement('');

                setShowCustomInput(false);

              }}

              className="text-xs"

            >

              Cancel

            </Button>

            <Button

              onClick={handleSaveDepartmentRequirements}

              disabled={!departmentRequirements.some((r) => r.selected)}

              className="text-xs"

            >

              Add Department

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      {/* Edit Event Details Modal */}

      <Dialog open={showEditDetailsModal} onOpenChange={setShowEditDetailsModal}>

        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <Edit className="w-5 h-5 text-blue-600" />

              Edit Event Details

            </DialogTitle>

            <DialogDescription>

              Update event information and upload additional files

            </DialogDescription>

          </DialogHeader>



          {selectedEditEvent && (

            <Tabs defaultValue="details" className="w-full">

              <TabsList className="grid w-full grid-cols-2">

                <TabsTrigger value="details">Event Details</TabsTrigger>

                <TabsTrigger value="files">File Uploads</TabsTrigger>

              </TabsList>



              {/* Event Details Tab */}

              <TabsContent value="details" className="space-y-4 mt-4">

                <div>

                  <Label htmlFor="edit-title">Event Title</Label>

                  <Input

                    id="edit-title"

                    value={editDetailsData.eventTitle}

                    onChange={(e) => setEditDetailsData({ ...editDetailsData, eventTitle: e.target.value })}

                    placeholder="Enter event title"

                  />

                </div>



                <div>

                  <Label htmlFor="edit-requestor">Requestor</Label>

                  <Input

                    id="edit-requestor"

                    value={editDetailsData.requestor}

                    onChange={(e) => setEditDetailsData({ ...editDetailsData, requestor: e.target.value })}

                    placeholder="Enter requestor name"

                  />

                </div>



                <div className="grid grid-cols-3 gap-4">

                  <div>

                    <Label htmlFor="edit-participants">Participants</Label>

                    <Input

                      id="edit-participants"

                      type="number"

                      min="0"

                      value={editDetailsData.participants}

                      onChange={(e) => setEditDetailsData({ ...editDetailsData, participants: parseInt(e.target.value) || 0 })}

                    />

                  </div>

                  <div>

                    <Label htmlFor="edit-vip">VIP</Label>

                    <Input

                      id="edit-vip"

                      type="number"

                      min="0"

                      value={editDetailsData.vip}

                      onChange={(e) => setEditDetailsData({ ...editDetailsData, vip: parseInt(e.target.value) || 0 })}

                    />

                  </div>

                  <div>

                    <Label htmlFor="edit-vvip">VVIP</Label>

                    <Input

                      id="edit-vvip"

                      type="number"

                      min="0"

                      value={editDetailsData.vvip}

                      onChange={(e) => setEditDetailsData({ ...editDetailsData, vvip: parseInt(e.target.value) || 0 })}

                    />

                  </div>

                </div>



                <div>

                  <Label htmlFor="edit-contact-number">Contact Number (11 digits)</Label>

                  <Input

                    id="edit-contact-number"

                    type="tel"

                    value={editDetailsData.contactNumber}

                    onChange={(e) => {

                      const value = e.target.value.replace(/\D/g, ''); // Remove non-digits

                      if (value.length <= 11) {

                        setEditDetailsData({ ...editDetailsData, contactNumber: value });

                      }

                    }}

                    placeholder="09123456789"

                    maxLength={11}

                  />

                </div>



                <div>

                  <Label htmlFor="edit-contact-email">Contact Email</Label>

                  <Input

                    id="edit-contact-email"

                    type="email"

                    value={editDetailsData.contactEmail}

                    onChange={(e) => setEditDetailsData({ ...editDetailsData, contactEmail: e.target.value })}

                    placeholder="Enter contact email"

                  />

                </div>



                <div>

                  <Label htmlFor="edit-description">Description</Label>

                  <Textarea

                    id="edit-description"

                    value={editDetailsData.description}

                    onChange={(e) => setEditDetailsData({ ...editDetailsData, description: e.target.value })}

                    placeholder="Enter event description"

                    rows={4}

                  />

                </div>

              </TabsContent>



              {/* File Uploads Tab */}

              <TabsContent value="files" className="space-y-4 mt-4">

                <div className="space-y-4">

                  {/* Existing Files Section */}

                  {selectedEditEvent && ((selectedEditEvent.attachments && selectedEditEvent.attachments.length > 0) || selectedEditEvent.govFiles) && (

                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">

                      <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700">

                        <FileText className="w-4 h-4" />

                        Currently Uploaded Files

                      </h3>



                      {/* Existing Attachments */}

                      {selectedEditEvent.attachments && selectedEditEvent.attachments.length > 0 && (

                        <div>

                          <p className="text-xs font-medium text-gray-600 mb-2">Attachments ({selectedEditEvent.attachments.length})</p>

                          <div className="space-y-1">

                            {selectedEditEvent.attachments.map((file: any, index: number) => (

                              <div key={index} className="flex items-center gap-2 text-xs text-gray-600 bg-white px-2 py-1 rounded">

                                <Paperclip className="w-3 h-3" />

                                <span className="flex-1 truncate">{file.originalName}</span>

                                <span className="text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>

                                <Button

                                  type="button"

                                  variant="ghost"

                                  size="icon"

                                  className="h-6 w-6 text-red-600 hover:text-red-700"

                                  onClick={() => setPendingFileDelete({

                                    kind: 'attachment',

                                    eventId: selectedEditEvent._id,

                                    filename: file.filename,

                                    label: file.originalName

                                  })}

                                >

                                  <Trash2 className="w-3.5 h-3.5" />

                                </Button>

                              </div>

                            ))}

                          </div>

                        </div>

                      )}



                      {/* Existing Government Files */}

                      {selectedEditEvent.govFiles && (

                        <div>

                          <p className="text-xs font-medium text-gray-600 mb-2">Government Files</p>

                          <div className="space-y-1">

                            {selectedEditEvent.govFiles.brieferTemplate && (

                              <div className="flex items-center gap-2 text-xs text-gray-600 bg-white px-2 py-1 rounded">

                                <FileText className="w-3 h-3" />

                                <span className="flex-1 truncate">Event Briefer: {selectedEditEvent.govFiles.brieferTemplate.originalName}</span>

                                <span className="text-gray-400">{(selectedEditEvent.govFiles.brieferTemplate.size / 1024).toFixed(1)} KB</span>

                                <Button

                                  type="button"

                                  variant="ghost"

                                  size="icon"

                                  className="h-6 w-6 text-red-600 hover:text-red-700"

                                  onClick={() => setPendingFileDelete({

                                    kind: 'gov',

                                    eventId: selectedEditEvent._id,

                                    filename: selectedEditEvent.govFiles!.brieferTemplate!.filename,

                                    fileKey: 'brieferTemplate',

                                    label: selectedEditEvent.govFiles!.brieferTemplate!.originalName

                                  })}

                                >

                                  <Trash2 className="w-3.5 h-3.5" />

                                </Button>

                              </div>

                            )}

                            {selectedEditEvent.govFiles.programme && (

                              <div className="flex items-center gap-2 text-xs text-gray-600 bg-white px-2 py-1 rounded">

                                <FileText className="w-3 h-3" />

                                <span className="flex-1 truncate">Program Flow: {selectedEditEvent.govFiles.programme.originalName}</span>

                                <span className="text-gray-400">{(selectedEditEvent.govFiles.programme.size / 1024).toFixed(1)} KB</span>

                                <Button

                                  type="button"

                                  variant="ghost"

                                  size="icon"

                                  className="h-6 w-6 text-red-600 hover:text-red-700"

                                  onClick={() => setPendingFileDelete({

                                    kind: 'gov',

                                    eventId: selectedEditEvent._id,

                                    filename: selectedEditEvent.govFiles!.programme!.filename,

                                    fileKey: 'programme',

                                    label: selectedEditEvent.govFiles!.programme!.originalName

                                  })}

                                >

                                  <Trash2 className="w-3.5 h-3.5" />

                                </Button>

                              </div>

                            )}

                            {selectedEditEvent.govFiles.availableForDL && (

                              <div className="flex items-center gap-2 text-xs text-gray-600 bg-white px-2 py-1 rounded">

                                <FileText className="w-3 h-3" />

                                <span className="flex-1 truncate">Available For DL: {selectedEditEvent.govFiles.availableForDL.originalName}</span>

                                <span className="text-gray-400">{(selectedEditEvent.govFiles.availableForDL.size / 1024).toFixed(1)} KB</span>

                                <Button

                                  type="button"

                                  variant="ghost"

                                  size="icon"

                                  className="h-6 w-6 text-red-600 hover:text-red-700"

                                  onClick={() => setPendingFileDelete({

                                    kind: 'gov',

                                    eventId: selectedEditEvent._id,

                                    filename: selectedEditEvent.govFiles!.availableForDL!.filename,

                                    fileKey: 'availableForDL',

                                    label: selectedEditEvent.govFiles!.availableForDL!.originalName

                                  })}

                                >

                                  <Trash2 className="w-3.5 h-3.5" />

                                </Button>

                              </div>

                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  )}



                  <div className="flex items-center gap-2 pb-2 border-b">

                    <Paperclip className="w-4 h-4 text-blue-600" />

                    <h3 className="font-semibold text-sm">Add New Files (Optional)</h3>

                  </div>



                  {/* Attachments */}

                  <div>

                    <Label htmlFor="edit-attachments" className="text-sm font-medium">

                      Attachments (Multiple files allowed)

                    </Label>

                    <Input

                      id="edit-attachments"

                      type="file"

                      multiple

                      onChange={(e) => {

                        const files = e.target.files;

                        if (files) {

                          setEditAttachments(prev => [...prev, ...Array.from(files)]);

                        }

                      }}

                      className="mt-2"

                    />

                    {editAttachments.length > 0 && (

                      <div className="mt-2 space-y-1">

                        <p className="text-xs text-green-600 flex items-center gap-1">

                          <CheckCircle className="w-3 h-3" />

                          {editAttachments.length} file(s) selected

                        </p>

                        <div className="flex flex-wrap gap-1">

                          {editAttachments.map((file, idx) => (

                            <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">

                              {file.name}

                              <button

                                type="button"

                                onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))}

                                className="hover:text-red-600"

                              >

                                ×

                              </button>

                            </span>

                          ))}

                        </div>

                      </div>

                    )}

                  </div>



                  <Separator />



                  {/* Government Files */}

                  <div className="space-y-4">

                    <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">

                      <FileText className="w-4 h-4" />

                      Government Files

                    </h4>



                    <div>

                      <Label htmlFor="edit-briefer" className="text-sm">

                        Event Briefer (Multiple files allowed)

                      </Label>

                      <Input

                        id="edit-briefer"

                        type="file"

                        multiple

                        onChange={(e) => {

                          const files = e.target.files;

                          if (files) {

                            setEditBrieferTemplate(prev => [...prev, ...Array.from(files)]);

                          }

                        }}

                        className="mt-2"

                      />

                      {editBrieferTemplate && editBrieferTemplate.length > 0 && (

                        <div className="mt-2 space-y-1">

                          <p className="text-xs text-green-600 flex items-center gap-1">

                            <CheckCircle className="w-3 h-3" />

                            {editBrieferTemplate.length} file(s) selected

                          </p>

                          <div className="flex flex-wrap gap-1">

                            {editBrieferTemplate.map((file, idx) => (

                              <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">

                                {file.name}

                                <button

                                  type="button"

                                  onClick={() => setEditBrieferTemplate(prev => prev.filter((_, i) => i !== idx))}

                                  className="hover:text-red-600"

                                >

                                  ×

                                </button>

                              </span>

                            ))}

                          </div>

                        </div>

                      )}

                    </div>



                    <div>

                      <Label htmlFor="edit-programme" className="text-sm">

                        Program Flow (Multiple files allowed)

                      </Label>

                      <Input

                        id="edit-programme"

                        type="file"

                        multiple

                        onChange={(e) => {

                          const files = e.target.files;

                          if (files) {

                            setEditProgramme(prev => [...prev, ...Array.from(files)]);

                          }

                        }}

                        className="mt-2"

                      />

                      {editProgramme && editProgramme.length > 0 && (

                        <div className="mt-2 space-y-1">

                          <p className="text-xs text-green-600 flex items-center gap-1">

                            <CheckCircle className="w-3 h-3" />

                            {editProgramme.length} file(s) selected

                          </p>

                          <div className="flex flex-wrap gap-1">

                            {editProgramme.map((file, idx) => (

                              <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">

                                {file.name}

                                <button

                                  type="button"

                                  onClick={() => setEditProgramme(prev => prev.filter((_, i) => i !== idx))}

                                  className="hover:text-red-600"

                                >

                                  ×

                                </button>

                              </span>

                            ))}

                          </div>

                        </div>

                      )}

                    </div>

                  </div>

                </div>

              </TabsContent>

            </Tabs>

          )}



          <div className="flex justify-end gap-2 pt-4">

            <Button

              variant="outline"

              onClick={() => {

                setShowEditDetailsModal(false);

                setSelectedEditEvent(null);

                // Reset file states

                setEditAttachments([]);

                setEditBrieferTemplate([]);

                setEditProgramme([]);

              }}

            >

              Cancel

            </Button>

            <Button onClick={handleSaveEditedDetails}>

              Save Changes

            </Button>

          </div>

        </DialogContent>

      </Dialog>

      {/* Auto Suggest Modal - Simplified Version */}
      <Dialog open={showAutoSuggestModal} onOpenChange={setShowAutoSuggestModal}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">

          {/* Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 leading-tight">Find a Venue</h2>
                <p className="text-xs text-gray-400 leading-tight">We'll suggest locations that fit your needs</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoSuggestModal(false)}
                className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">

            {/* Inputs section */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">

              {/* Participants */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Participants <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                </label>
                <Input
                  type="number" min="1" placeholder="How many people?"
                  value={autoSuggestParticipants}
                  onChange={(e) => setAutoSuggestParticipants(e.target.value)}
                  className="h-9 bg-white border-gray-200 text-sm rounded-lg"
                />
              </div>

              {/* Date row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> Start <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm bg-white border-gray-200 rounded-lg">
                        <CalendarIcon className="mr-1.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                        {autoSuggestStartDate ? format(autoSuggestStartDate, 'MMM dd, yyyy') : <span className="text-gray-400">Pick date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={autoSuggestStartDate}
                        onSelect={(d) => {
                          setAutoSuggestStartDate(d ?? undefined);
                          if (!autoSuggestEndDate || (d && d > autoSuggestEndDate)) setAutoSuggestEndDate(d ?? undefined);
                        }}
                        initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> End <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm bg-white border-gray-200 rounded-lg"
                        disabled={!autoSuggestStartDate}>
                        <CalendarIcon className="mr-1.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                        {autoSuggestEndDate ? format(autoSuggestEndDate, 'MMM dd, yyyy') : <span className="text-gray-400">Pick date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={autoSuggestEndDate}
                        onSelect={(d) => setAutoSuggestEndDate(d ?? undefined)}
                        disabled={(d) => !!autoSuggestStartDate && d < autoSuggestStartDate}
                        initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Time row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Start time
                    <span className="text-gray-400 normal-case tracking-normal font-normal">(optional)</span>
                  </label>
                  <Select value={autoSuggestStartTime} onValueChange={(v) => setAutoSuggestStartTime(v)}>
                    <SelectTrigger className="h-9 text-sm bg-white border-gray-200 rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {generateTimeOptions().map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> End time
                    <span className="text-gray-400 normal-case tracking-normal font-normal">(optional)</span>
                  </label>
                  <Select value={autoSuggestEndTime} onValueChange={(v) => setAutoSuggestEndTime(v)} disabled={!autoSuggestStartTime}>
                    <SelectTrigger className="h-9 text-sm bg-white border-gray-200 rounded-lg" disabled={!autoSuggestStartTime}>
                      <SelectValue placeholder={autoSuggestStartTime ? 'Select' : '—'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {generateTimeOptions()
                        .filter((t) => {
                          if (!autoSuggestStartTime) return false;
                          const toMin = (x: string) => { const [h, m] = x.split(':').map(Number); return h * 60 + m; };
                          return toMin(t.value) > toMin(autoSuggestStartTime);
                        })
                        .map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Find button */}
            <button
              type="button"
              disabled={!autoSuggestParticipants || !autoSuggestStartDate || !autoSuggestEndDate || loadingAutoSuggest}
              onClick={runAutoSuggest}
              className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {loadingAutoSuggest
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…</>
                : <><Sparkles className="w-3.5 h-3.5" /> Find Suitable Venues</>}
            </button>

            {/* Results */}
            {showSuggestions && (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {suggestedLocations.filter(s => !s.isBooked).length} available
                    </span>
                    {suggestedLocations.filter(s => s.isBooked).length > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1 text-red-500">
                          <Ban className="w-3.5 h-3.5" />
                          {suggestedLocations.filter(s => s.isBooked).length} booked
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-gray-400">for {autoSuggestParticipants} participants</span>
                </div>

                {/* No results empty state */}
                {suggestedLocations.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No venues found for this size</p>
                    <p className="text-xs mt-1">Try reducing the participant count or selecting a location manually</p>
                  </div>
                )}

                {/* Venue cards */}
                <div className="space-y-2">
                  {suggestedLocations.map((sug) => (
                    <button
                      key={sug.name}
                      type="button"
                      disabled={sug.isBooked}
                      onClick={() => !sug.isBooked && applyAutoSuggestion(sug)}
                      className={`w-full text-left rounded-xl border transition-all duration-150 group ${sug.isBooked
                          ? 'border-gray-200 bg-gray-50 opacity-55 cursor-not-allowed'
                          : selectedSuggestion === sug.name
                            ? 'border-violet-400 bg-violet-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-sm cursor-pointer'
                        }`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">

                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sug.isBooked ? 'bg-gray-100' : 'bg-violet-50 group-hover:bg-violet-100'
                          }`}>
                          <MapPin className={`w-4 h-4 ${sug.isBooked ? 'text-gray-400' : 'text-violet-500'}`} />
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight truncate ${sug.isBooked ? 'text-gray-400' : 'text-gray-800'}`}>
                            {sug.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-xs ${sug.isBooked ? 'text-gray-400' : 'text-gray-500'}`}>
                              {sug.seatsLabel || `${sug.chairs} seats`}
                            </span>
                            {sug.isMulti && (
                              <>
                                <span className="text-gray-300 text-xs">·</span>
                                <span className="text-xs text-violet-500 font-medium">Multi-room</span>
                              </>
                            )}
                            {sug.note && (
                              <>
                                <span className="text-gray-300 text-xs">·</span>
                                <span className="text-xs text-gray-400 truncate">{sug.note}</span>
                              </>
                            )}
                          </div>

                          {/* Booked dates */}
                          {sug.isBooked && sug.bookedOnDates.length > 0 && (
                            <p className="text-[11px] text-red-400 mt-0.5 leading-tight">
                              Booked: {sug.bookedOnDates.slice(0, 2).join(', ')}
                              {sug.bookedOnDates.length > 2 && ` +${sug.bookedOnDates.length - 2} more`}
                            </p>
                          )}

                          {/* Date/time preview for available */}
                          {!sug.isBooked && autoSuggestStartDate && (
                            <p className="text-[11px] text-violet-500 mt-0.5 flex items-center gap-1">
                              <CalendarIcon className="w-2.5 h-2.5 flex-shrink-0" />
                              {format(autoSuggestStartDate, 'MMM dd')}
                              {autoSuggestEndDate && autoSuggestEndDate.getTime() !== autoSuggestStartDate.getTime()
                                ? ` – ${format(autoSuggestEndDate, 'MMM dd, yyyy')}`
                                : `, ${format(autoSuggestStartDate, 'yyyy')}`}
                              {autoSuggestStartTime && ` · ${formatTime(autoSuggestStartTime)}${autoSuggestEndTime ? ` – ${formatTime(autoSuggestEndTime)}` : ''}`}
                            </p>
                          )}
                        </div>

                        {/* Right indicator */}
                        <div className="flex-shrink-0 ml-1">
                          {sug.isBooked ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                              <Ban className="w-2.5 h-2.5" /> Booked
                            </span>
                          ) : selectedSuggestion === sug.name ? (
                            <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Hint */}
                {suggestedLocations.some(s => !s.isBooked) && (
                  <p className="text-center text-[11px] text-gray-400 pt-1">
                    Select a venue to auto-fill your schedule
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>

  );

};



export default MyEventsPage;

