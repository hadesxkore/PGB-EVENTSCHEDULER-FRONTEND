import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { format as formatDate } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { getPavilionSoundSystemMaxQuantity } from '@/lib/pavilionHelpers';
import {
  FileText,
  Paperclip,
  Building2,
  CheckSquare,
  Calendar as CalendarIcon,
  ChevronRight,
  Send,
  StickyNote,
  X,
  Upload,
  Plus,
  Info,
  Check,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Package,
  Settings,
  Clock,
  Loader2,
  User,
  MapPin,
  Sparkles,
  Users,
  Wand2,
  Ban
} from 'lucide-react';

interface DepartmentRequirement {
  id: string;
  name: string;
  selected: boolean;
  notes: string;
  quantity?: number;  // For physical requirements
  quantitiesByDate?: Record<string, number>; // Per-day quantities for multi-day events
  type?: 'physical' | 'service' | 'yesno';
  serviceType?: 'notes' | 'yesno'; // Service type: notes or yesno
  totalQuantity?: number;
  isAvailable?: boolean;
  responsiblePerson?: string;
  availabilityNotes?: string; // Notes from resource availability
  isCustom?: boolean; // Flag for custom requirements added by user
  yesNoAnswer?: 'yes' | 'no'; // For yesno type requirements
}

interface DepartmentRequirements {
  [department: string]: DepartmentRequirement[];
}

interface DateTimeSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
}

interface EventFormData {
  eventTitle: string;
  requestor: string;
  location: string;
  locations: string[]; // Array for multiple conference rooms
  roomType?: string;
  participants: string;
  vip: string;
  vvip: string;
  withoutGov: boolean;
  multipleLocations: boolean;
  description: string;
  noAttachments: boolean;
  attachments: File[];
  taggedDepartments: string[];
  departmentRequirements: DepartmentRequirements;
  startDate: Date | undefined;
  startTime: string;
  endDate: Date | undefined;
  endTime: string;
  contactNumber: string;
  contactEmail: string;
  eventType: 'simple' | 'complex' | 'simple-meeting';
  dateTimeSlots: DateTimeSlot[]; // Additional date slots for multi-day events
  proceedWithoutPgsoChairs?: boolean;
}

interface Department {
  _id: string;
  name: string;
  isVisible: boolean;
  requirements: Array<{
    _id: string;
    text: string;
    type: 'physical' | 'service';
    serviceType?: 'notes' | 'yesno'; // Service type for services
    totalQuantity?: number;
    isActive: boolean;
    isAvailable?: boolean;
    responsiblePerson?: string;
    createdAt: string;
    updatedAt?: string;
  }>;
}

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

type AutoSuggestedLocation = {
  name: string;
  chairs: number;
  isMulti: boolean;
  rooms: string[];
  note?: string;
  isBooked: boolean;
  bookedOnDates: string[];
  seatsLabel?: string;
};
// ─────────────────────────────────────────────────────────────────────────────

const RequestEventPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [pgsoCustomLocationAck, setPgsoCustomLocationAck] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [requirementsRefreshKey, setRequirementsRefreshKey] = useState(0);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [customRequirement, setCustomRequirement] = useState<string>('');
  const [customRequirementType, setCustomRequirementType] = useState<'physical' | 'service'>('service');
  const [customRequirementNotes, setCustomRequirementNotes] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [pendingCustomQuantity, setPendingCustomQuantity] = useState<string>('1');
  const [showAvailableDatesModal, setShowAvailableDatesModal] = useState(false);
  const [departmentAvailableDates, setDepartmentAvailableDates] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showGovModal, setShowGovModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateType, setTemplateType] = useState<'briefer' | 'program'>('briefer');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
  const [brieferData, setBrieferData] = useState({
    eventTitle: '',
    proponentOffice: '',
    dateTime: '',
    venue: '',
    objectives: '',
    targetAudience: '',
    expectedParticipants: '',
    briefDescription: ''
  });
  const [programFlowRows, setProgramFlowRows] = useState([
    { time: '', activity: '', personResponsible: '', remarks: '' }
  ]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStep, setReviewStep] = useState(1);
  const [govFiles, setGovFiles] = useState<{
    [key: string]: File | null;
  }>({
    brieferTemplate: null,
    programme: null
  });
  const [conflictingEvents, setConflictingEvents] = useState<any[]>([]);
  const [venueConflictingEvents, setVenueConflictingEvents] = useState<any[]>([]);
  const [eventsByDate, setEventsByDate] = useState<Record<string, any[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noDepartmentsNeeded, setNoDepartmentsNeeded] = useState(false);
  const [showPgsoDefaultsDialog, setShowPgsoDefaultsDialog] = useState(false);
  const [autoSelectPgsoAfterStep3, setAutoSelectPgsoAfterStep3] = useState(false);
  const [showLocationRequirementsModal, setShowLocationRequirementsModal] = useState(false);
  const [locationRequirements, setLocationRequirements] = useState<Array<{ name: string; quantity: number }>>([]);
  const [showEventTypeAlert, setShowEventTypeAlert] = useState(false);
  const [pavilionChairWarning, setPavilionChairWarning] = useState<{ available: number; requested: number } | null>(null);
  const [pavilionZeroItems, setPavilionZeroItems] = useState<string[]>([]);
  const [showPavilionConfirm, setShowPavilionConfirm] = useState(false);
  const [showZeroQtyAlert, setShowZeroQtyAlert] = useState(false);
  const [zeroQtyAlertItem, setZeroQtyAlertItem] = useState('');
  const [showPitoBlockAlert, setShowPitoBlockAlert] = useState(false);
  const [pitoBlockMessage, setPitoBlockMessage] = useState('');

  // ── Auto Suggest Location state ────────────────────────────────────────────
  const [locationMode, setLocationMode] = useState<'manual' | 'auto-suggest'>('auto-suggest');
  const [showAutoSuggestModal, setShowAutoSuggestModal] = useState(false);
  const [autoSuggestParticipants, setAutoSuggestParticipants] = useState('');
  const [autoSuggestStartDate, setAutoSuggestStartDate] = useState<Date | undefined>(undefined);
  const [autoSuggestEndDate, setAutoSuggestEndDate] = useState<Date | undefined>(undefined);
  const [autoSuggestStartTime, setAutoSuggestStartTime] = useState('');
  const [autoSuggestEndTime, setAutoSuggestEndTime] = useState('');
  const [suggestedLocations, setSuggestedLocations] = useState<AutoSuggestedLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [loadingAutoSuggest, setLoadingAutoSuggest] = useState(false);
  // ──────────────────────────────────────────────────────────────────────────
  const [loadingLocationRequirements, setLoadingLocationRequirements] = useState(false);
  const [loadingDepartmentRequirements, setLoadingDepartmentRequirements] = useState(false);
  const [locationRoomTypes, setLocationRoomTypes] = useState<string[]>([]);

  // Dynamic data from database
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  // Remove unused state - we fetch availabilities directly when needed
  const [formData, setFormData] = useState<EventFormData>({
    eventTitle: '',
    requestor: '',
    location: '',
    locations: [], // Initialize empty array for multiple locations
    roomType: '',
    participants: '',
    vip: '',
    vvip: '',
    withoutGov: false,
    multipleLocations: false,
    description: '',
    noAttachments: false,
    attachments: [],
    taggedDepartments: [],
    departmentRequirements: {},
    startDate: undefined,
    startTime: '',
    endDate: undefined,
    endTime: '',
    contactNumber: '',
    contactEmail: '',
    eventType: '' as any,
    dateTimeSlots: [], // Initialize empty array for additional date slots
    proceedWithoutPgsoChairs: false
  });

  const steps = [
    { id: 1, title: 'Event Details', icon: FileText, description: 'Basic event information' },
    { id: 2, title: 'Attachments', icon: Paperclip, description: 'Upload supporting documents' },
    { id: 3, title: 'Tag Departments', icon: Building2, description: 'Select relevant departments' },
    { id: 4, title: 'Requirements', icon: CheckSquare, description: 'Specify event requirements' },
    { id: 5, title: 'Schedule', icon: CalendarIcon, description: 'Set date and time' },
    { id: 6, title: 'Ready to Submit', icon: Send, description: 'Review and submit' }
  ];

  // Check if attachments step is completed
  // For Simple Meeting: attachments only required if withGov is true
  // For other event types: attachments always required
  const isAttachmentsCompleted = formData.eventType === 'simple-meeting'
    ? (formData.withoutGov ? formData.attachments.length > 0 : true) // If withGov ON, require attachments; if OFF, no requirement
    : formData.attachments.length > 0; // Other event types always require attachments

  const [locations, setLocations] = useState<string[]>(['Add Custom Location']);
  const [locationData, setLocationData] = useState<{ name: string, isCustom: boolean }[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  const isCustomLocationSelected = React.useMemo(() => {
    const loc = (formData.location || '').trim();
    if (!loc) return false;

    if (!locationData.length) {
      return showCustomLocation;
    }

    const match = locationData.find((x) => x.name.toLowerCase() === loc.toLowerCase());
    if (match) return !!match.isCustom;

    // If it's not in the system list, treat it as a custom location.
    return true;
  }, [formData.location, locationData, showCustomLocation]);

  useEffect(() => {
    if (!isCustomLocationSelected && pgsoCustomLocationAck) {
      setPgsoCustomLocationAck(false);
    }
    // Auto-check the acknowledgment when custom location is selected
    if (isCustomLocationSelected && !pgsoCustomLocationAck) {
      setPgsoCustomLocationAck(true);
    }
  }, [isCustomLocationSelected, pgsoCustomLocationAck]);


  const defaultRequirements: DepartmentRequirements = {};

  // Compute list of dates currently selected for the event (for multi-day checks)
  const getDatesToCheck = () => {
    const dates: Date[] = [];
    if (!formData.startDate) return dates;
    dates.push(new Date(formData.startDate));
    if (formData.endDate && formData.endDate.getTime() !== formData.startDate.getTime()) {
      const cur = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return dates;
  };

  // Check if a named room is unavailable on any selected date (ignores time; date-level blocking)
  const isRoomUnavailableOnSelectedDates = (roomName: string) => {
    const dates = getDatesToCheck();
    if (dates.length === 0) return false;

    const isRelevantStatus = (status: any) => status === 'approved' || status === 'submitted';
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const selectionOverlapsEventOnDate = (event: any, d: Date) => {
      const dayStr = new Date(d).toDateString();
      const startDayStr = formData.startDate ? new Date(formData.startDate).toDateString() : '';

      // Determine selected time range for this day
      let selStart = '';
      let selEnd = '';
      if (dayStr === startDayStr) {
        selStart = formData.startTime;
        selEnd = formData.endTime;
      } else {
        const slot = (formData.dateTimeSlots || []).find((s) => new Date(s.date).toDateString() === dayStr);
        selStart = slot?.startTime || '';
        selEnd = slot?.endTime || '';
      }

      // If user hasn't chosen times yet, fall back to date-level blocking
      if (!selStart || !selEnd) return true;
      const selStartMin = toMinutes(selStart);
      const selEndMin = toMinutes(selEnd);
      if (selEndMin <= selStartMin) return true;

      // Determine event time range on this day
      let evStart = '';
      let evEnd = '';
      if (event?.startDate && new Date(event.startDate).toDateString() === dayStr) {
        evStart = event.startTime;
        evEnd = event.endTime;
      } else if (event?.dateTimeSlots && Array.isArray(event.dateTimeSlots)) {
        const matched = event.dateTimeSlots.find((s: any) => s?.startDate && new Date(s.startDate).toDateString() === dayStr);
        evStart = matched?.startTime;
        evEnd = matched?.endTime;
      }

      if (!evStart || !evEnd) return true;
      const evStartMin = toMinutes(evStart);
      const evEndMin = toMinutes(evEnd);
      if (evEndMin <= evStartMin) return true;

      // Overlap check (treat as [start, end))
      return selStartMin < evEndMin && selEndMin > evStartMin;
    };

    return dates.some((d) => {
      const dayEvents = eventsByDate[d.toDateString()] || [];
      return dayEvents.some((e: any) => {
        if (!isRelevantStatus(e?.status)) return false;
        const eventLocations = e.locations && Array.isArray(e.locations) && e.locations.length > 0 ? e.locations : [e.location];
        const hasLocationConflict = eventLocations.some((loc: string) => locationsConflict(loc, roomName));
        if (!hasLocationConflict) return false;
        return selectionOverlapsEventOnDate(e, d);
      });
    });
  };

  // Fetch departments from API on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const response = await axios.get(`${API_BASE_URL}/departments/visible`, { headers });

        if (response.data.success) {
          setDepartments(response.data.data);
        }
      } catch (error) {
        // Fallback to empty array if fetch fails
        setDepartments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch locations from locationAvailabilities API
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const response = await axios.get(`${API_BASE_URL}/location-availability`, { headers });

        if (response.data.success) {

          // Extract unique location objects with their properties
          const locationMap = new Map();
          response.data.data.forEach((item: any) => {
            // Remove "Bookings for " prefix if it exists
            let locationName = item.locationName;
            if (locationName.startsWith('Bookings for ')) {
              locationName = locationName.replace('Bookings for ', '');
            }

            // Store location with its properties
            if (!locationMap.has(locationName)) {
              // Check if location was added by PGSO account
              // If setBy.username is "event.pgso", it's a PGB location
              // If setBy.username is anything else, it's a custom location
              const isCustomLocation = item.setBy?.username !== 'event.pgso';

              locationMap.set(locationName, {
                name: locationName,
                isCustom: isCustomLocation
              });
            }
          });

          const uniqueLocations = Array.from(locationMap.values());
          // Remove Pavilion - Kalayaan Ballroom sections A/B/C from selectable locations
          const uniqueLocationsFiltered = uniqueLocations.filter(loc =>
            !/^Pavilion\s-\sKalayaan\sBallroom\s-\sSection\s[ABC]$/i.test(loc.name)
          );
          // Ensure a frontend-only option exists for Conference Room (Entire)
          // and force isCustom: false for it regardless of database value
          const withConferenceEntireData = uniqueLocationsFiltered.some((l: any) => l.name === '4th Flr. Conference Room (Entire)')
            ? uniqueLocationsFiltered.map((l: any) =>
              l.name === '4th Flr. Conference Room (Entire)' ? { ...l, isCustom: false } : l
            )
            : [...uniqueLocationsFiltered, { name: '4th Flr. Conference Room (Entire)', isCustom: false }];

          // Sort so "(Entire)" option appears before individual conference rooms
          const sortKey = (name: string) => {
            if (name === '4th Flr. Conference Room (Entire)') return 0;
            if (/^4th\s*Flr\.\s*Conference\s*Room\s*\d+$/i.test(name)) return 1;
            return 2;
          };

          const withConferenceEntireDataSorted = [...withConferenceEntireData].sort((a: any, b: any) => {
            const ka = sortKey(a.name);
            const kb = sortKey(b.name);
            if (ka !== kb) return ka - kb;
            return a.name.localeCompare(b.name);
          });

          setLocationData(withConferenceEntireDataSorted); // Store filtered location data

          // Extract just names for backward compatibility and filter out Kalayaan sections A/B/C
          const locationNames = withConferenceEntireDataSorted.map((loc: any) => loc.name);
          const filteredLocationNames = locationNames.filter(name => {
            // Remove Pavilion - Kalayaan Ballroom sections A/B/C; keep only (Entire)
            return !/^Pavilion\s-\sKalayaan\sBallroom\s-\sSection\s[ABC]$/i.test(name);
          });
          const withConferenceEntire = filteredLocationNames.includes('4th Flr. Conference Room (Entire)')
            ? filteredLocationNames
            : [...filteredLocationNames, '4th Flr. Conference Room (Entire)'];
          setLocations(['Add Custom Location', ...withConferenceEntire]);
        }
      } catch (error) {
        // Keep default "Add Custom Location" if fetch fails
        setLocations(['Add Custom Location']);
      }
    };

    fetchLocations();
  }, []);

  // Fetch available dates for a specific location
  const fetchAvailableDatesForLocation = async (locationName: string) => {
    try {
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

        // Convert date strings to Date objects
        const dates = locationAvailabilities.map((item: any) => new Date(item.date));

        // If no availability records found (custom location), set empty array
        // This will allow date selection based on event type rules only
        setAvailableDates(dates);
      }
    } catch (error) {
      // On error, set empty array to allow date selection based on event type rules
      setAvailableDates([]);
    }
  };

  const handleContinueToTagDepartments = async () => {
    setCurrentStep(3);
  };

  // Function to validate and clean up requirements before proceeding to schedule
  const handleContinueToSchedule = () => {
    // Check for any selected requirements with 0 availability and auto-remove them
    const updatedDeptReqs = { ...formData.departmentRequirements };
    const removedRequirements: string[] = [];
    
    Object.keys(updatedDeptReqs).forEach(deptName => {
      const requirements = updatedDeptReqs[deptName];
      const validRequirements = requirements.filter(req => {
        // Keep requirement if:
        // 1. It's not selected (so we don't lose unselected items)
        // 2. It's selected AND (is custom OR has availability OR has quantity > 0)
        if (!req.selected) return true;
        
        const hasZeroQuantity = req.type === 'physical' && 
                               req.totalQuantity != null && 
                               req.totalQuantity <= 0;
        const isUnavailable = !req.isAvailable;
        
        // If requirement has issues, record it and remove
        if ((hasZeroQuantity || isUnavailable) && !req.isCustom) {
          removedRequirements.push(`${req.name} (${deptName})`);
          return false; // Remove this requirement
        }
        
        return true; // Keep this requirement
      });
      
      updatedDeptReqs[deptName] = validRequirements;
    });
    
    // If we removed any requirements, update the form data and notify user
    if (removedRequirements.length > 0) {
      handleInputChange('departmentRequirements', updatedDeptReqs);
      
      toast.warning('Requirements with 0 availability removed', {
        description: `The following items were removed because they have 0 available quantity: ${removedRequirements.join(', ')}. Please coordinate directly with the respective departments if you need these items.`,
        duration: 8000
      });
    }
    
    // Proceed to schedule step
    setCurrentStep(5);
  };

  const handleNoDepartmentsNeededChange = async (checked: boolean) => {
    setNoDepartmentsNeeded(checked);

    if (checked) {
      // Clear any tagged departments if checking "no departments needed"
      handleInputChange('taggedDepartments', []);
      handleInputChange('departmentRequirements', {});

      // For Simple Meeting, if the location has default requirements, immediately
      // prompt and then auto-select PGSO after user confirms.
      if (formData.eventType === 'simple-meeting') {
        const locationName = typeof formData.location === 'string' ? formData.location : '';
        if (locationName) {
          let detected = locationRequirements;
          if (!detected || detected.length === 0) {
            const locationData = await fetchLocationRequirements(locationName);
            detected = locationData?.requirements || [];
            if (detected.length > 0) {
              setLocationRequirements(detected);
              setLocationRoomTypes(locationData?.roomTypes || []);
            }
          }

          if (detected.length > 0) {
            setAutoSelectPgsoAfterStep3(true);
            setShowPgsoDefaultsDialog(true);
          }
        }
      }
    }
  };

  // If Conference Room (Entire) is selected, auto-drop rooms that are unavailable
  // for the chosen date/time so users can't accidentally submit blocked rooms.
  useEffect(() => {
    if (!showScheduleModal) return;
    if (formData.location !== '4th Flr. Conference Room (Entire)') return;

    const allRooms = ['4th Flr. Conference Room 1', '4th Flr. Conference Room 2', '4th Flr. Conference Room 3'];
    if (!formData.locations || formData.locations.length === 0) return;

    const unavailableRooms = allRooms.filter((r) => formData.locations.includes(r) && isRoomUnavailableOnSelectedDates(r));
    if (unavailableRooms.length === 0) return;

    const nextLocations = formData.locations.filter((loc) => !unavailableRooms.includes(loc));
    if (nextLocations.length === formData.locations.length) return;

    handleInputChange('locations', nextLocations);
    if (nextLocations.length <= 1) {
      handleInputChange('multipleLocations', false);
    }
    toast.error('Some rooms are unavailable on your selected schedule', {
      description: `Removed: ${unavailableRooms.join(', ')}`,
      duration: 6000
    });
  }, [showScheduleModal, formData.location, formData.startDate, formData.endDate, formData.startTime, formData.endTime, formData.dateTimeSlots, eventsByDate]);

  // Check if a date should be disabled (not available for the selected location)
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Disable past dates
    if (date < today) {
      return true;
    }

    // Simple Meeting: NO restrictions - allow ALL future dates
    if (formData.eventType === 'simple-meeting') {
      return false;
    }

    // For Simple Event (7 days) and Complex Event (30 days)
    // Allow any date that meets the lead time requirement
    // Ignore location availability records - users can book any location
    const daysRequired = formData.eventType === 'simple' ? 7 : 30;
    const days = calculateWorkingDays(today, date);

    // Only check if date meets minimum lead time requirement
    return days < daysRequired;
  };

  // Helper function to check if two locations conflict (Pavilion & Conference Room hierarchy)
  const locationsConflict = (loc1: string, loc2: string): boolean => {
    // Exact match
    if (loc1 === loc2) return true;

    // Check Pavilion hierarchy
    const isPavilion1 = loc1.includes('Pavilion');
    const isPavilion2 = loc2.includes('Pavilion');

    if (isPavilion1 && isPavilion2) {
      // Extract hall name (Kagitingan or Kalayaan)
      const getHall = (loc: string) => {
        if (loc.includes('Kagitingan')) return 'Kagitingan';
        if (loc.includes('Kalayaan')) return 'Kalayaan';
        return null;
      };

      const hall1 = getHall(loc1);
      const hall2 = getHall(loc2);

      // Different halls don't conflict
      if (hall1 !== hall2) return false;

      // Same hall - check if one is "Entire" or both are sections
      const isEntire1 = loc1.includes('(Entire)');
      const isEntire2 = loc2.includes('(Entire)');

      // If either is "Entire", they conflict
      if (isEntire1 || isEntire2) return true;

      // Both are sections - only conflict if same section
      return loc1 === loc2;
    }

    // Check Conference Room hierarchy (e.g., "4th Flr. Conference Room 1/2/3" and optional "(Entire)")
    const isConferenceRoom1 = loc1.includes('Conference Room');
    const isConferenceRoom2 = loc2.includes('Conference Room');

    if (isConferenceRoom1 && isConferenceRoom2) {
      // Parse base, number, and entire flag
      const parseConfRoom = (loc: string) => {
        const entire = /\(\s*Entire\s*\)/i.test(loc);
        // Capture base like "4th Flr. Conference Room" and optional number
        const m = loc.match(/^(.*?Conference Room)(?:\s*(\d+))?(?:\s*\(\s*Entire\s*\))?$/i);
        const base = m ? m[1].trim() : loc.trim();
        const num = m && m[2] ? parseInt(m[2], 10) : undefined;
        return { base, num, entire };
      };

      const a = parseConfRoom(loc1);
      const b = parseConfRoom(loc2);

      // Different conference room groups do not conflict
      if (a.base !== b.base) return false;

      // If either is the Entire room, it conflicts with any room in the same base
      if (a.entire || b.entire) return true;

      // If both are numbered rooms, only same number conflicts
      if (a.num !== undefined && b.num !== undefined) {
        return a.num === b.num;
      }

      // If one has no number and is not marked Entire, be conservative: treat as exact mismatch (no conflict)
      return false;
    }

    return false;
  };

  // For location-default pooled requirements (PAVILION_DEFAULT), treat all Pavilion locations
  // as sharing the same inventory pool.
  // For Sound System, only share within the same hall (Kagitingan sections share, Kalayaan sections share).
  const getPavilionHall = (loc: string): string | null => {
    if (loc.includes('Kagitingan')) return 'Kagitingan';
    if (loc.includes('Kalayaan')) return 'Kalayaan';
    return null;
  };

  const locationsSharePavilionPool = (loc1: string, loc2: string, requirementName?: string): boolean => {
    if (!loc1 || !loc2) return false;
    const isPavilion1 = loc1.includes('Pavilion');
    const isPavilion2 = loc2.includes('Pavilion');

    // Sound System is per-hall, not shared across all Pavilion locations
    if (isPavilion1 && isPavilion2 && requirementName && /sound system/i.test(requirementName)) {
      const hall1 = getPavilionHall(loc1);
      const hall2 = getPavilionHall(loc2);
      return hall1 !== null && hall1 === hall2;
    }

    if (isPavilion1 && isPavilion2) return true;
    return locationsConflict(loc1, loc2);
  };

  // Sync PGSO Sound System max quantity if locations/sections change
  useEffect(() => {
    if (!formData.departmentRequirements || !formData.departmentRequirements['PGSO']) return;
    const pgsoReqs = formData.departmentRequirements['PGSO'];
    if (!Array.isArray(pgsoReqs) || pgsoReqs.length === 0) return;

    const targetLoc = selectedLocation || formData.location;
    const maxSoundQty = getPavilionSoundSystemMaxQuantity(targetLoc, formData.locations);

    let updated = false;
    const newPgsoReqs = pgsoReqs.map((req) => {
      if (/sound system/i.test(req.name) && req.availabilityNotes?.startsWith('PAVILION_DEFAULT:')) {
        if (req.totalQuantity !== maxSoundQty) {
          updated = true;
          const currentSelectedQty = req.quantity;
          return {
            ...req,
            totalQuantity: maxSoundQty,
            quantity: currentSelectedQty ? Math.min(currentSelectedQty, maxSoundQty) : currentSelectedQty,
            availabilityNotes: `PAVILION_DEFAULT:${maxSoundQty}:${targetLoc || 'selected location'}`
          };
        }
      }
      return req;
    });

    if (updated) {
      handleInputChange('departmentRequirements', {
        ...formData.departmentRequirements,
        PGSO: newPgsoReqs
      });
    }
  }, [formData.location, formData.locations, selectedLocation]);

  // Auto-check for venue conflicts when schedule changes in modal
  useEffect(() => {

    const checkConflicts = async () => {

      if (formData.startDate && formData.location && showScheduleModal) {

        // Check conflicts for the entire day at this location to show booked time slots
        const response = await fetch(`${API_BASE_URL}/events`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const eventsData = await response.json();
          const events = eventsData.data || [];

          // Build list of all dates to check (Day 1 + additional days for multi-day events)
          const datesToCheck: Date[] = [formData.startDate];

          // If multi-day event, add all additional days
          if (formData.endDate && formData.startDate && formData.endDate.getTime() !== formData.startDate.getTime()) {
            const currentDate = new Date(formData.startDate);
            const endDate = new Date(formData.endDate);

            // Skip the first day (already added)
            currentDate.setDate(currentDate.getDate() + 1);

            while (currentDate <= endDate) {
              datesToCheck.push(new Date(currentDate));
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }


          // Build a map of events by each date in the range (regardless of location)
          const map: Record<string, any[]> = {};
          datesToCheck.forEach((d) => {
            map[d.toDateString()] = [];
          });

          events.forEach((event: any) => {
            if (!event.startDate || !event.startTime || !event.endTime) return;

            // Only consider events that actually block availability
            if (event.status !== 'approved' && event.status !== 'submitted') return;
            const mainDateStr = new Date(event.startDate).toDateString();
            if (map[mainDateStr]) map[mainDateStr].push(event);
            if (event.dateTimeSlots && Array.isArray(event.dateTimeSlots)) {
              event.dateTimeSlots.forEach((slot: any) => {
                if (!slot.startDate || !slot.startTime || !slot.endTime) return;
                const slotDateStr = new Date(slot.startDate).toDateString();
                if (map[slotDateStr]) map[slotDateStr].push({ ...event, startDate: slot.startDate, startTime: slot.startTime, endTime: slot.endTime });
              });
            }
          });
          setEventsByDate(map);

          // Filter events that are on ANY of the dates in the range AND have location conflicts
          const conflicts = events.filter((event: any) => {
            if (!event.startDate || (!event.location && !(event.locations && Array.isArray(event.locations)))) return false;

            // Only check approved or submitted events
            if (event.status !== 'approved' && event.status !== 'submitted') return false;

            // Must have time information for requirement conflict checking
            if (!event.startTime || !event.endTime) return false;

            // Check if locations conflict (Entire vs Sections logic) against ANY of the event's locations
            const eventLocations = event.locations && Array.isArray(event.locations) && event.locations.length > 0
              ? event.locations
              : [event.location];
            const hasConflict = eventLocations.some((loc: string) => locationsConflict(formData.location, loc));
            if (!hasConflict) {
              return false; // No location conflict, skip this event
            }

            const eventStartDate = new Date(event.startDate);

            // Check if event's main date matches ANY of our dates
            const mainDateMatches = datesToCheck.some(checkDate =>
              eventStartDate.toDateString() === checkDate.toDateString()
            );

            // Also check if event has dateTimeSlots that match ANY of our dates
            let slotDateMatches = false;
            if (event.dateTimeSlots && Array.isArray(event.dateTimeSlots)) {
              slotDateMatches = event.dateTimeSlots.some((slot: any) => {
                if (!slot.startDate) return false;
                const slotDate = new Date(slot.startDate);
                return datesToCheck.some(checkDate =>
                  slotDate.toDateString() === checkDate.toDateString()
                );
              });
            }

            return mainDateMatches || slotDateMatches;
          });

          if (conflicts.length > 0) {
            setVenueConflictingEvents(conflicts);
          } else {
            setVenueConflictingEvents([]);
          }
        }
      } else {
        if (!showScheduleModal) {
          // Clear conflicts when modal is closed
          setVenueConflictingEvents([]);
          setEventsByDate({});
        }
      }
    };

    // Debounce the conflict checking to avoid too many API calls
    const timeoutId = setTimeout(checkConflicts, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.startDate, formData.endDate, formData.location, showScheduleModal]);

  // Check if event type is selected before allowing interactions
  const checkEventTypeSelected = () => {
    if (!formData.eventType) {
      setShowEventTypeAlert(true);
      return false;
    }
    return true;
  };

  const handleInputChange = (field: keyof EventFormData, value: string | boolean | File[] | string[] | DepartmentRequirements | Date | undefined | DateTimeSlot[]) => {
    // Block changes if event type not selected (except for eventType field itself)
    if (field !== 'eventType' && !checkEventTypeSelected()) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fetch location requirements (prioritize hierarchy/group match with roomTypes, then exact single-location match) and room types
  const fetchLocationRequirements = async (
    locationName: string
  ): Promise<{ requirements: Array<{ name: string; quantity: number }>; roomTypes: string[] } | null> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;

      // Check if this location has default requirements
      const response = await fetch(`${API_BASE_URL}/location-requirements`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const allRequirements = await response.json();

        const selectedLocs = locationName
          .split('+')
          .map((s) => s.trim())
          .filter(Boolean);

        // If multiple locations are selected (separated by +), check for exact group or aggregate
        if (selectedLocs.length > 1) {
          // 1. Check for exact full group match
          const exactGroupMatch = allRequirements.find((req: any) => {
            if (!req.locationNames || !Array.isArray(req.locationNames)) return false;
            const sortedReqLocs = [...req.locationNames].sort();
            const sortedSelectedLocs = [...selectedLocs].sort();
            return (
              sortedReqLocs.length === sortedSelectedLocs.length &&
              sortedReqLocs.every((loc, idx) => loc === sortedSelectedLocs[idx])
            );
          });

          if (exactGroupMatch && Array.isArray(exactGroupMatch.requirements) && exactGroupMatch.requirements.length > 0) {
            return {
              requirements: exactGroupMatch.requirements,
              roomTypes: exactGroupMatch.roomTypes || []
            };
          }

          // 2. If no exact full group match exists, aggregate/sum requirements dynamically
          const aggregatedMap: Map<string, number> = new Map();
          const roomTypesSet = new Set<string>();
          const processedLocations = new Set<string>();

          // Sort group docs by locationNames.length descending to prioritize larger sub-group matches first
          const groupDocsDesc = [...allRequirements]
            .filter((doc: any) => doc.locationNames && Array.isArray(doc.locationNames) && doc.locationNames.length > 1)
            .sort((a, b) => (b.locationNames?.length || 0) - (a.locationNames?.length || 0));

          for (const doc of groupDocsDesc) {
            const isSubset = doc.locationNames.every((loc: string) => selectedLocs.includes(loc));
            const notProcessed = doc.locationNames.every((loc: string) => !processedLocations.has(loc));
            if (isSubset && notProcessed && Array.isArray(doc.requirements)) {
              doc.requirements.forEach((req: any) => {
                const key = req.name.trim();
                const currentQty = aggregatedMap.get(key) || 0;
                aggregatedMap.set(key, currentQty + (req.quantity || 0));
              });
              if (Array.isArray(doc.roomTypes)) {
                doc.roomTypes.forEach((rt: string) => roomTypesSet.add(rt));
              }
              doc.locationNames.forEach((loc: string) => processedLocations.add(loc));
            }
          }

          // For remaining unprocessed locations, find their single-location requirement doc
          for (const loc of selectedLocs) {
            if (!processedLocations.has(loc)) {
              const singleDoc = allRequirements.find((doc: any) => {
                if (doc.locationNames && Array.isArray(doc.locationNames)) {
                  return doc.locationNames.length === 1 && doc.locationNames[0] === loc;
                }
                return doc.locationName === loc;
              });

              if (singleDoc && Array.isArray(singleDoc.requirements)) {
                singleDoc.requirements.forEach((req: any) => {
                  const key = req.name.trim();
                  const currentQty = aggregatedMap.get(key) || 0;
                  aggregatedMap.set(key, currentQty + (req.quantity || 0));
                });
                if (Array.isArray(singleDoc.roomTypes)) {
                  singleDoc.roomTypes.forEach((rt: string) => roomTypesSet.add(rt));
                }
              }
            }
          }

          if (aggregatedMap.size > 0) {
            const finalReqs = Array.from(aggregatedMap.entries()).map(([name, quantity]) => {
              if (/sound system/i.test(name)) {
                return { name, quantity: getPavilionSoundSystemMaxQuantity(locationName, selectedLocs, quantity) };
              }
              return { name, quantity };
            });
            return {
              requirements: finalReqs,
              roomTypes: Array.from(roomTypesSet)
            };
          }
        }

        // Single location resolution logic (exact match or group candidate fallback)
        const exactMatch = allRequirements.find((req: any) => {
          if (req.locationNames && Array.isArray(req.locationNames)) {
            return req.locationNames.length === 1 && req.locationNames[0] === locationName;
          }
          return req.locationName === locationName;
        });

        const groupMatches = allRequirements.filter((req: any) => {
          if (req.locationNames && Array.isArray(req.locationNames)) {
            return req.locationNames.length > 1 && req.locationNames.includes(locationName);
          }
          return false;
        });

        const candidateDocs: any[] = [];
        if (exactMatch) candidateDocs.push(exactMatch);
        candidateDocs.push(...groupMatches);

        if (candidateDocs.length === 0) {
          return null;
        }

        const pickMostSpecific = (docs: any[]) => {
          if (!docs.length) return null;
          return docs.reduce((best, doc) => {
            if (!best) return doc;
            const bestLen =
              best.locationNames && Array.isArray(best.locationNames) && best.locationNames.length > 0
                ? best.locationNames.length
                : 1;
            const len =
              doc.locationNames && Array.isArray(doc.locationNames) && doc.locationNames.length > 0
                ? doc.locationNames.length
                : 1;
            return len < bestLen ? doc : best;
          }, null as any);
        };

        const requirementDocs = candidateDocs.filter(
          (doc) => Array.isArray(doc.requirements) && doc.requirements.length > 0
        );
        const requirementsSource =
          requirementDocs.length > 0
            ? pickMostSpecific(requirementDocs)
            : exactMatch || groupMatches[0] || null;

        const roomTypeDocs = candidateDocs.filter(
          (doc) => Array.isArray(doc.roomTypes) && doc.roomTypes.length > 0
        );
        const roomTypesSource =
          roomTypeDocs.length > 0
            ? pickMostSpecific(roomTypeDocs)
            : exactMatch || groupMatches[0] || null;

        if (!requirementsSource && !roomTypesSource) {
          return null;
        }

        const requirements =
          requirementsSource && Array.isArray(requirementsSource.requirements)
            ? requirementsSource.requirements
            : [];
        const roomTypes =
          roomTypesSource && Array.isArray(roomTypesSource.roomTypes)
            ? roomTypesSource.roomTypes
            : [];

        const adjustedRequirements = requirements.map((req: any) => {
          if (/sound system/i.test(req.name)) {
            const maxSoundQty = getPavilionSoundSystemMaxQuantity(locationName, selectedLocs, req.quantity);
            return { ...req, quantity: maxSoundQty };
          }
          return req;
        });

        return {
          requirements: adjustedRequirements,
          roomTypes
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching location requirements:', error);
      return null;
    }
  };

  // Check Pavilion chair availability against participant count
  // Check Pavilion item availability against conflicting bookings
  const checkPavilionChairAvailability = async (locationName: string, participantCount: number, dateOverrideStart?: Date, dateOverrideEnd?: Date) => {
    setPavilionChairWarning(null);
    setPavilionZeroItems([]);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const [locReqRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/location-requirements`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/events`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      if (!locReqRes.ok || !eventsRes.ok) return;

      const allLocReqs: any[] = await locReqRes.json();
      const eventsData = await eventsRes.json();
      const allEvents: any[] = eventsData.data || [];

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
        return ALL_PAVILION_LOCATIONS.slice(0, 3).every((s) => doc.locationNames.includes(s));
      });

      if (!pavilionOverallDoc || !Array.isArray(pavilionOverallDoc.requirements)) return;
      const allRequirements = pavilionOverallDoc.requirements;

      const dates = dateOverrideStart
        ? (() => {
            const start = new Date(dateOverrideStart);
            const end = dateOverrideEnd ? new Date(dateOverrideEnd) : new Date(dateOverrideStart);
            const result: Date[] = [];
            const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            while (cursor <= endDay) {
              result.push(new Date(cursor));
              cursor.setDate(cursor.getDate() + 1);
            }
            return result;
          })()
        : getEventDatesInRange();
      if (dates.length === 0) return;

      const normalizeDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

      const getUsedQtyOnDate = (reqName: string, dayStr: string): number => {
        let used = 0;
        allEvents.forEach((ev: any) => {
          if (ev.status !== 'approved' && ev.status !== 'submitted') return;
          const evLocs: string[] =
            ev.locations && Array.isArray(ev.locations) && ev.locations.length > 0
              ? ev.locations : [ev.location || ''];
          if (!evLocs.some((l: string) => /Pavilion/i.test(l))) return;

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
                if (req.selected && typeof req.name === 'string' && req.name === reqName) {
                  used += Number(req.quantity) || 0;
                }
              });
            });
          }
        });
        return used;
      };

      // Check every physical item across the date range
      const zeroItems: string[] = [];
      let chairTotal = 0;
      let chairRemaining = 0;

      allRequirements.forEach((req: any) => {
        if (typeof req.name !== 'string') return;
        const totalQty = Number(req.quantity) || 0;
        if (totalQty <= 0) return;

        const perDayAvail = dates.map((d) => {
          const used = getUsedQtyOnDate(req.name, d.toDateString());
          return Math.max(0, totalQty - used);
        });
        const minAvail = Math.min(...perDayAvail);

        if (/chair/i.test(req.name)) {
          chairTotal = totalQty;
          chairRemaining = minAvail;
        }

        if (minAvail <= 0 && !/microphone/i.test(req.name)) {
          zeroItems.push(req.name);
        }
      });

      if (zeroItems.length > 0) {
        setPavilionZeroItems(zeroItems);
      }
      if (chairRemaining < participantCount) {
        setPavilionChairWarning({ available: chairRemaining, requested: participantCount });
      }
    } catch {
      // Silently fail - don't block the user from proceeding
    }
  };

  const handleLocationChange = async (value: string, participantCountOverride?: number, dateOverrideStart?: Date, dateOverrideEnd?: Date) => {
    if (value === 'Add Custom Location') {
      setShowCustomLocation(true);
      handleInputChange('location', '');
      handleInputChange('locations', []);
      handleInputChange('roomType', '');
      setAvailableDates([]); // Clear available dates
      setLocationRoomTypes([]);
    } else {
      setShowCustomLocation(false);
      handleInputChange('location', value);

      // Special case: Conference Room (Entire) should behave like multi-location selection
      if (value === '4th Flr. Conference Room (Entire)') {
        const allRooms = ['4th Flr. Conference Room 1', '4th Flr. Conference Room 2', '4th Flr. Conference Room 3'];
        handleInputChange('locations', allRooms);
        handleInputChange('multipleLocations', true);
      } else {
        // Initialize locations array with the selected location
        handleInputChange('locations', [value]);
        handleInputChange('multipleLocations', false);
      }
      handleInputChange('roomType', '');

      // Show loading state and modal IMMEDIATELY before any API calls
      setLoadingLocationRequirements(true);
      setShowLocationRequirementsModal(true);

      // Fetch available dates for the selected location
      await fetchAvailableDatesForLocation(
        value === '4th Flr. Conference Room (Entire)' ? '4th Flr. Conference Room 1' : value
      );

      // Conference Room (Entire): load the grouped requirements for Rooms 1+2+3.
      if (value === '4th Flr. Conference Room (Entire)') {
        try {
          const token = localStorage.getItem('authToken');
          if (token) {
            const response = await fetch(`${API_BASE_URL}/location-requirements`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
              const allRequirements = await response.json();
              const allRooms = ['4th Flr. Conference Room 1', '4th Flr. Conference Room 2', '4th Flr. Conference Room 3'];
              const groupedRequirement = allRequirements.find((req: any) => {
                if (!req.locationNames || !Array.isArray(req.locationNames)) return false;
                return allRooms.every((loc) => req.locationNames.includes(loc));
              });

              setLoadingLocationRequirements(false);

              if (groupedRequirement && Array.isArray(groupedRequirement.requirements) && groupedRequirement.requirements.length > 0) {
                setLocationRequirements(groupedRequirement.requirements);
                setLocationRoomTypes(groupedRequirement.roomTypes || []);
                setSelectedLocation(allRooms.join(' + '));
                return;
              }
            }
          }
        } catch (e) {
          // fall through
        }

        // No grouped requirements found: close modal and continue to schedule
        setLoadingLocationRequirements(false);
        setShowLocationRequirementsModal(false);
        setSelectedLocation('4th Flr. Conference Room 1 + 4th Flr. Conference Room 2 + 4th Flr. Conference Room 3');
        setShowScheduleModal(true);
        return;
      }

      // Other locations: behave as before
      const locationData = await fetchLocationRequirements(value);
      setLoadingLocationRequirements(false);

      if (locationData && locationData.requirements && locationData.requirements.length > 0) {
        // Show requirements modal for single location
        setLocationRequirements(locationData.requirements);
        setLocationRoomTypes(locationData.roomTypes || []);
        setSelectedLocation(value);

        // Pavilion chair availability check
        const pavilionParticipantCount = participantCountOverride ?? (formData.participants ? parseInt(formData.participants) || 0 : 0);
        if (/pavilion/i.test(value) && pavilionParticipantCount > 0) {
          await checkPavilionChairAvailability(value, pavilionParticipantCount, dateOverrideStart, dateOverrideEnd);
        } else {
          setPavilionChairWarning(null);
        }
      } else {
        // No requirements, close modal and open schedule modal directly
        setShowLocationRequirementsModal(false);
        setLocationRoomTypes(locationData?.roomTypes || []);
        setSelectedLocation(value);
        setShowScheduleModal(true);
      }
    }
  };

  // Add additional conference room to locations array
  const handleAddConferenceRoom = async (roomNumber: 1 | 2 | 3) => {
    const roomName = `4th Flr. Conference Room ${roomNumber}`;
    // Always fetch availability for context
    await fetchAvailableDatesForLocation(roomName);

    // Keep the user's primary dropdown location unchanged; only append rooms.
    // Ensure the primary location is part of the locations list.
    const primary = formData.location;
    let updatedLocations = [...formData.locations];
    if (primary && !updatedLocations.includes(primary)) {
      updatedLocations = [primary, ...updatedLocations];
    }

    // Ensure the new room is in selections (avoid duplicates)
    if (!updatedLocations.includes(roomName)) {
      updatedLocations.push(roomName);
    }

    handleInputChange('locations', updatedLocations);
    handleInputChange('multipleLocations', true);

    // Check if these multiple locations are grouped together or need aggregated requirements
    try {
      setLoadingLocationRequirements(true);
      setShowLocationRequirementsModal(true);

      const combinedLocationStr = updatedLocations.join(' + ');
      const locationData = await fetchLocationRequirements(combinedLocationStr);
      setLoadingLocationRequirements(false);

      if (locationData && locationData.requirements && locationData.requirements.length > 0) {
        setLocationRequirements(locationData.requirements);
        setLocationRoomTypes(locationData.roomTypes || []);
        setSelectedLocation(combinedLocationStr);
        toast.success(`${roomName} added - viewing requirements`);
      } else {
        setShowLocationRequirementsModal(false);
        toast.success(`${roomName} added to your booking`);
      }
    } catch (error) {
      console.error('Error checking grouped requirements:', error);
      setLoadingLocationRequirements(false);
      setShowLocationRequirementsModal(false);
      toast.success(`${roomName} added to your booking`);
    }
  };

  // Remove conference room from locations array
  const handleRemoveConferenceRoom = async (roomName: string) => {
    const updatedLocations = formData.locations.filter(loc => loc !== roomName);
    handleInputChange('locations', updatedLocations);
    if (updatedLocations.length > 0) {
      handleInputChange('location', updatedLocations[0]);
    } else {
      handleInputChange('location', '');
    }
    if (updatedLocations.length <= 1) {
      handleInputChange('multipleLocations', false);
    }

    if (updatedLocations.length > 0) {
      const combinedLocationStr = updatedLocations.join(' + ');
      const locationData = await fetchLocationRequirements(combinedLocationStr);
      if (locationData && locationData.requirements) {
        setLocationRequirements(locationData.requirements);
        setSelectedLocation(combinedLocationStr);
      }
    }
    toast.success(`${roomName} removed from your booking`);
  };

  const handleScheduleSave = async () => {

    // Check for venue conflicts before saving (location-specific)
    if (formData.startDate && formData.startTime && formData.endTime && formData.location) {
      const conflicts = await fetchVenueConflicts(
        formData.startDate,
        formData.startTime,
        formData.endTime,
        formData.location
      );

      if (conflicts.length > 0) {
        const conflictDetails = conflicts.map((event: any) =>
          `"${event.eventTitle}" (${new Date(event.startDate).toDateString()} ${formatTime(event.startTime)}-${formatTime(event.endTime)})`
        ).join(', ');

        toast.error(`Venue conflict detected! ${formData.location} is already booked during ${formData.startDate?.toDateString()} ${formatTime(formData.startTime)}-${formatTime(formData.endTime)}`, {
          description: `Conflicting events at this venue: ${conflictDetails}`,
          duration: 8000,
        });
        return; // Don't close modal if there are conflicts
      }

      // Extra guard: prevent bridging over booked venue intervals (e.g., 7AM -> 6PM when 8AM-5PM is booked)
      if (formData.startTime && formData.endTime && isVenueRangeBooked(formData.startTime, formData.endTime, formData.startDate || undefined)) {
        toast.error('Venue conflict detected!', {
          description: `Selected time overlaps an already booked venue time. Please pick a continuous available time range.`,
          duration: 8000,
        });
        return;
      }
    }

    // Refresh resource availabilities for selected department or all tagged departments
    if (formData.startDate && (selectedDepartment || formData.taggedDepartments.length > 0)) {
      const updatedRequirements = { ...formData.departmentRequirements };

      // Determine which departments to refresh
      const depsToRefresh = selectedDepartment
        ? [selectedDepartment]
        : formData.taggedDepartments;


      for (const deptName of depsToRefresh) {
        const availabilities = await fetchResourceAvailabilities(deptName, formData.startDate);

        const department = departments.find(dept => dept.name === deptName);

        if (department && department.requirements) {
          // If requirements don't exist yet, create them from department requirements
          if (!updatedRequirements[deptName] || updatedRequirements[deptName].length === 0) {
            updatedRequirements[deptName] = department.requirements
              .filter((req) => {
                const availability = availabilities.find((avail: any) => avail.requirementId === req._id);
                return availability !== undefined;
              })
              .map((req) => {
                const availability = availabilities.find((avail: any) => avail.requirementId === req._id);
                return {
                  id: req._id,
                  name: req.text,
                  selected: false,
                  notes: '',
                  type: req.type,
                  totalQuantity: availability?.quantity || req.totalQuantity || 1,
                  quantity: availability?.quantity || req.totalQuantity || 1,
                  isAvailable: availability?.isAvailable || false,
                  responsiblePerson: req.responsiblePerson || '',
                  availabilityNotes: availability?.notes || ''
                };
              });
          } else {
            // Update existing requirements
            updatedRequirements[deptName] = updatedRequirements[deptName].map(req => {
              const availability = availabilities.find((avail: any) => avail.requirementId === req.id);
              return {
                ...req,
                totalQuantity: availability ? availability.quantity : department.requirements.find(deptReq => deptReq._id === req.id)?.totalQuantity || req.totalQuantity,
                isAvailable: availability ? availability.isAvailable : department.requirements.find(deptReq => deptReq._id === req.id)?.isAvailable || req.isAvailable,
                availabilityNotes: availability ? availability.notes : ''
              };
            });
          }
        }
      }

      // Save the selected department before any modal operations
      const deptToRefresh = selectedDepartment;


      // Update form data with new requirements
      setFormData(prev => ({
        ...prev,
        departmentRequirements: updatedRequirements
      }));

      // If there's a selected department (from "Use This Date" flow), re-trigger department selection
      if (deptToRefresh) {

        // Close modal first
        setShowRequirementsModal(false);

        // Wait longer for state to fully update, then automatically "click" the department checkbox again
        setTimeout(async () => {
          await handleDepartmentToggle(deptToRefresh);
          toast.success('Schedule saved! Requirements updated with conflicts.');
        }, 800);
      }
    }

    setShowScheduleModal(false);
    setSelectedLocation('');
  };

  const handleWithoutGovChange = (checked: boolean) => {
    handleInputChange('withoutGov', checked);
    if (checked) {
      setShowGovModal(true);
    }
  };

  const handleGovFileUpload = (fileType: 'brieferTemplate' | 'availableForDL' | 'programme', file: File | null) => {
    setGovFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  // Fetch resource availabilities for a specific department and date
  const fetchResourceAvailabilities = async (departmentName: string, date: Date) => {
    if (!date) {
      return [];
    }

    try {
      const token = localStorage.getItem('authToken');
      const department = departments.find(dept => dept.name === departmentName);

      if (!department) {
        return [];
      }

      // Fix timezone issue - use local date instead of UTC
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const apiUrl = `${API_BASE_URL}/resource-availability/department/${department._id}/availability?startDate=${dateStr}&endDate=${dateStr}`;

      const response = await axios.get(apiUrl,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );


      return response.data || [];
    } catch (error) {
      return [];
    }
  };

  const handleDepartmentToggle = async (departmentName: string) => {
    try {

      // If department is being selected, check PITO restrictions first
      if (!formData.taggedDepartments.includes(departmentName) && departmentName.toLowerCase().includes('pito')) {
        // Lead time check: PITO needs at least 3 days preparation
        if (formData.startDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const eventDate = new Date(formData.startDate);
          eventDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 3) {
            setPitoBlockMessage(
              `PITO requires at least 3 working days preparation time. The event starts on ${format(eventDate, 'MMM dd, yyyy')}, which is only ${Math.max(diffDays, 0)} day(s) away. Please coordinate directly with PITO for assistance.`
            );
            setShowPitoBlockAlert(true);
            return;
          }
        }

        // **PITO Default Requirements Auto-Population**
        // When PITO is selected, auto-populate default requirements
        setSelectedDepartment(departmentName);
        setLoadingDepartmentRequirements(true);
        setShowRequirementsModal(true);

        // Reset conflicts
        setConflictingEvents([]);

        // Fetch conflicting events if date and time are set
        if (formData.startDate && formData.startTime && formData.endTime) {
          await fetchConflictingEvents(formData.startDate, formData.startTime, formData.endTime, formData.location);
        }

        // Check if location is ANY Kagitingan Hall variant
        const isKagitingan = typeof formData.location === 'string' && 
          formData.location.toLowerCase().includes('kagitingan');

        // Define PITO default requirements
        const pitoDefaultRequirements: DepartmentRequirement[] = [
          {
            id: `pito-led-wall-operator-${Date.now()}`,
            name: 'LED Wall with Operator',
            selected: false,
            notes: '',
            availabilityNotes: isKagitingan 
              ? 'LED Wall is not possible for Kagitingan Hall due to ceiling height.'
              : 'If used outside PGB, this needs dismantling — please coordinate with PGSO for transportation.',
            type: 'service',
            quantity: undefined,
            totalQuantity: undefined,
            isAvailable: !isKagitingan, // Disabled for ANY Kagitingan Hall location
            isCustom: true
          },
          {
            id: `pito-led-wall-${Date.now()}`,
            name: 'LED Wall',
            selected: false,
            notes: '',
            availabilityNotes: isKagitingan 
              ? 'LED Wall is not possible for Kagitingan Hall due to ceiling height.' 
              : 'If used outside PGB, this needs dismantling — please coordinate with PGSO for transportation.',
            type: 'service',
            quantity: undefined,
            totalQuantity: undefined,
            isAvailable: !isKagitingan, // Disabled for ANY Kagitingan Hall location
            isCustom: true
          },
          {
            id: `pito-projector-${Date.now()}`,
            name: 'Projector with HDMI',
            selected: false,
            notes: '',
            type: 'service',
            quantity: undefined,
            totalQuantity: undefined,
            isAvailable: true,
            isCustom: true
          },
          {
            id: `pito-internet-${Date.now()}`,
            name: 'Internet Connection',
            selected: false,
            notes: '',
            type: 'service',
            quantity: undefined,
            totalQuantity: undefined,
            isAvailable: true,
            isCustom: true,
            serviceType: 'yesno' // Special type to trigger input field for number of users
          },
          {
            id: `pito-tv-${Date.now()}`,
            name: 'TV',
            selected: false,
            notes: '',
            availabilityNotes: 'If used outside PGB, this needs dismantling — please coordinate with PGSO for transportation.',
            type: 'service',
            quantity: undefined,
            totalQuantity: undefined,
            isAvailable: true,
            isCustom: true
          },
          {
            id: `pito-hdmi-cable-${Date.now()}`,
            name: '10-meter HDMI Cable',
            selected: false,
            notes: '',
            type: 'service',
            quantity: undefined,
            totalQuantity: undefined,
            isAvailable: true,
            isCustom: true
          }
        ];

        // Initialize requirements for PITO department
        const newRequirements = { ...formData.departmentRequirements };
        newRequirements[departmentName] = pitoDefaultRequirements;
        handleInputChange('departmentRequirements', newRequirements);

        setLoadingDepartmentRequirements(false);
        return;
      }

      // If department is being selected, open requirements modal
      if (!formData.taggedDepartments.includes(departmentName)) {
        setSelectedDepartment(departmentName);

        // Show loading state and modal IMMEDIATELY
        setLoadingDepartmentRequirements(true);
        setShowRequirementsModal(true);

        // Reset conflicts when switching/opening a department to avoid stale conflict UI
        setConflictingEvents([]);

        // Fetch conflicting events if date and time are set (needed for accurate availability/conflict UI)
        if (formData.startDate && formData.startTime && formData.endTime) {
          await fetchConflictingEvents(formData.startDate, formData.startTime, formData.endTime, formData.location);
        }

        const isPgso = departmentName.toLowerCase().includes('pgso');
        const isPavilionLocation = typeof formData.location === 'string' && formData.location.toLowerCase().includes('pavilion');

        // PGSO + non-pavilion location that DOES have locationRequirements
        // (e.g., Conference Rooms, Meeting Rooms): use the locationRequirements
        // list directly as the PGSO defaults, bypassing the global PGSO master
        // list / availability API.
        if (isPgso && locationRequirements.length > 0) {
          // Pavilion-specific overrides: hide microphones, cap Sound System based on section count
          const pavilionFiltered = isPavilionLocation
            ? locationRequirements.filter((r) => !/microphone/i.test(r.name))
            : locationRequirements;
          const mappedRequirements: DepartmentRequirement[] = pavilionFiltered.map((locReq, idx) => {
            const isSoundSystem = /sound system/i.test(locReq.name);
            const effectiveQty = isSoundSystem
              ? getPavilionSoundSystemMaxQuantity(selectedLocation || formData.location, formData.locations, locReq.quantity)
              : locReq.quantity;

            return {
              id: `pgso-location-${idx}-${locReq.name}`,
              name: locReq.name,
              selected: false,
              notes: '',
              type: 'physical',
              quantity: undefined,
              totalQuantity: effectiveQty,
              isAvailable: true,
              availabilityNotes: `PAVILION_DEFAULT:${effectiveQty}:${selectedLocation || formData.location || 'selected location'}`,
              isCustom: false
            };
          });

          const newRequirements = { ...formData.departmentRequirements };
          newRequirements[departmentName] = mappedRequirements;
          handleInputChange('departmentRequirements', newRequirements);

          setLoadingDepartmentRequirements(false);
          return;
        }

        // Fetch resource availabilities for the selected date
        let availabilities: any[] = [];
        if (formData.startDate) {
          availabilities = await fetchResourceAvailabilities(departmentName, formData.startDate);
        }

        setLoadingDepartmentRequirements(false);

        // Find the department and use its requirements
        const department = departments.find(dept => dept.name === departmentName);
        if (department && department.requirements && availabilities.length > 0) {
          const isPgso = departmentName.toLowerCase().includes('pgso');

          // If PGSO is selected but the current location has NO default
          // locationRequirements (not a pavilion scenario), do not preload any
          // built-in PGSO items. The modal will show only the custom
          // requirement controls.
          if (isPgso && locationRequirements.length === 0) {
            const newRequirements = { ...formData.departmentRequirements };
            newRequirements[departmentName] = [];
            handleInputChange('departmentRequirements', newRequirements);
            return;
          }

          const pavilionFilteredReqs = isPavilionLocation
            ? locationRequirements.filter((r) => !/microphone/i.test(r.name))
            : locationRequirements;

          const pavilionNames = isPgso && locationRequirements.length > 0
            ? new Set(pavilionFilteredReqs.map((lr) => lr.name))
            : null;

          // Only show requirements that have availability data for this specific date
          // For PGSO + pavilion, further limit to pavilion default requirement names
          const dbRequirements = department.requirements
            .filter((req) => {
              // Only include requirements that have availability data for this date
              const availability = availabilities.find((avail: any) =>
                avail.requirementId === req._id
              );
              if (!availability) return false;

              if (pavilionNames) {
                // Only keep requirements whose text matches a pavilion default name
                return pavilionNames.has(req.text);
              }

              return true;
            })
            .map((req) => {
              // Find matching resource availability for this requirement and date
              const availability = availabilities.find((avail: any) =>
                avail.requirementId === req._id
              );
              const baseRequirement: DepartmentRequirement = {
                id: req._id,
                name: req.text,
                selected: false,
                notes: '',
                type: req.type,
                serviceType: req.serviceType, // Include serviceType for YESNO services
                totalQuantity: availability.quantity, // Use actual availability quantity
                isAvailable: availability.isAvailable,
                responsiblePerson: req.responsiblePerson,
                availabilityNotes: availability.notes || ''
              };

              // Pavilion override for PGSO: if this requirement name matches a
              // location-based default requirement, adjust totalQuantity to use
              // the pavilion pool (e.g., 300 chairs) instead of the global pool
              // (e.g., 2148), and embed a PAVILION_DEFAULT marker so other pages
              // can display the pavilion total consistently.
              if (isPgso && locationRequirements.length > 0) {
                const matchingLocationReq = locationRequirements.find((locReq) => locReq.name === req.text);
                if (matchingLocationReq) {
                  const isSoundSystem = /sound system/i.test(matchingLocationReq.name);
                  const effectiveQty = isSoundSystem
                    ? getPavilionSoundSystemMaxQuantity(selectedLocation || formData.location, formData.locations, matchingLocationReq.quantity)
                    : matchingLocationReq.quantity;

                  baseRequirement.totalQuantity = effectiveQty;
                  baseRequirement.availabilityNotes = `PAVILION_DEFAULT:${effectiveQty}:${selectedLocation || formData.location || 'selected location'}`;
                }
              }

              return baseRequirement;
            });

          // Initialize requirements for this department
          const newRequirements = { ...formData.departmentRequirements };
          newRequirements[departmentName] = dbRequirements;
          handleInputChange('departmentRequirements', newRequirements);

        } else {
          // No requirements found or no availability data for this date
          const newRequirements = { ...formData.departmentRequirements };
          newRequirements[departmentName] = [];
          handleInputChange('departmentRequirements', newRequirements);

        }
      } else {
        // If unchecking, remove from tagged departments
        const updatedDepartments = formData.taggedDepartments.filter(d => d !== departmentName);
        handleInputChange('taggedDepartments', updatedDepartments);
      }
    } catch (error) {
      // Handle error silently
    }
  };

  // Fetch available dates for a department
  const fetchAvailableDates = async (departmentName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const department = departments.find(dept => dept.name === departmentName);

      if (!department) {
        return [];
      }

      const response = await axios.get(
        `${API_BASE_URL}/resource-availability/department/${department._id}/all-dates`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data || [];
    } catch (error) {
      return [];
    }
  };

  const handleViewAvailableDates = async (departmentName: string) => {
    const dates = await fetchAvailableDates(departmentName);
    setDepartmentAvailableDates(dates);
    setShowAvailableDatesModal(true);
  };

  const handleRequirementToggle = (requirementId: string) => {
    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
    const req = currentReqs.find(r => r.id === requirementId);
    if (!req) return;

    // Prevent selecting requirements with 0 total quantity
    if (!req.selected && req.type === 'physical' && req.totalQuantity != null && req.totalQuantity <= 0) {
      toast.error('Cannot select this item', {
        description: `${req.name} has 0 available quantity. Please coordinate directly with ${selectedDepartment}.`,
        duration: 4000
      });
      return;
    }

    // Prevent selecting requirements that are fully booked for selected dates
    if (!req.selected && pavilionZeroItems.includes(req.name)) {
      setZeroQtyAlertItem(req.name);
      setShowZeroQtyAlert(true);
      return;
    }

    // If trying to deselect a requirement with 0 availability, allow it (so users can remove it)
    // But if trying to select and it has 0 availability, block it
    if (!req.selected && !req.isAvailable) {
      toast.error('Cannot select this item', {
        description: `${req.name} is currently unavailable. Please coordinate directly with ${selectedDepartment}.`,
        duration: 4000
      });
      return;
    }

    const updatedReqs = currentReqs.map(r =>
      r.id === requirementId ? { ...r, selected: !r.selected } : r
    );

    const newDeptReqs = { ...formData.departmentRequirements };
    newDeptReqs[selectedDepartment] = updatedReqs;
    handleInputChange('departmentRequirements', newDeptReqs);

    // If this requirement just became selected, immediately open the
    // details popup for quantity/notes.
    const newlySelected = updatedReqs.find(req => req.id === requirementId && req.selected);
    if (newlySelected) {
      setActiveRequirement(newlySelected);
      setShowRequirementMaxWarning(false);
      setShowRequirementDetailsModal(true);
    }
  };

  const handleSelectedRequirementRemove = (requirement: DepartmentRequirement) => {
    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
    let updatedReqs: DepartmentRequirement[];

    if (requirement.isCustom) {
      // Completely remove custom requirement from the list
      updatedReqs = currentReqs.filter(req => req.id !== requirement.id);
    } else {
      // For non-custom, just unselect it
      updatedReqs = currentReqs.map(req =>
        req.id === requirement.id ? { ...req, selected: false } : req
      );
    }

    const newDeptReqs = { ...formData.departmentRequirements };
    newDeptReqs[selectedDepartment] = updatedReqs;
    handleInputChange('departmentRequirements', newDeptReqs);
  };

  const handleRequirementQuantityForDate = (requirementId: string, dateKey: string, quantity: number) => {
    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
    const updatedReqs = currentReqs.map((req) => {
      if (req.id !== requirementId) return req;
      const currentMap = req.quantitiesByDate || {};
      const nextMap = { ...currentMap, [dateKey]: quantity };
      const maxForDisplay = Object.values(nextMap).reduce((m, v) => Math.max(m, v || 0), 0);
      return {
        ...req,
        quantitiesByDate: nextMap,
        quantity: maxForDisplay || undefined
      };
    });

    const newDeptReqs = { ...formData.departmentRequirements };
    newDeptReqs[selectedDepartment] = updatedReqs;
    handleInputChange('departmentRequirements', newDeptReqs);
  };

  const handleRequirementNotes = (requirementId: string, notes: string) => {
    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
    const updatedReqs = currentReqs.map(req =>
      req.id === requirementId ? { ...req, notes } : req
    );

    const newDeptReqs = { ...formData.departmentRequirements };
    newDeptReqs[selectedDepartment] = updatedReqs;
    handleInputChange('departmentRequirements', newDeptReqs);
  };

  const [activeRequirement, setActiveRequirement] = useState<DepartmentRequirement | null>(null);
  const [showRequirementDetailsModal, setShowRequirementDetailsModal] = useState(false);
  const [showRequirementMaxWarning, setShowRequirementMaxWarning] = useState(false);

  const handleRequirementQuantity = (requirementId: string, quantity: number) => {
    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
    const updatedReqs = currentReqs.map(req =>
      req.id === requirementId ? { ...req, quantity } : req
    );

    const newDeptReqs = { ...formData.departmentRequirements };
    newDeptReqs[selectedDepartment] = updatedReqs;
    handleInputChange('departmentRequirements', newDeptReqs);
  };

  const handleAddCustomRequirement = () => {
    if (!customRequirement.trim()) {
      return;
    }

    const isPhysical = customRequirementType === 'physical';
    const quantityValue = isPhysical ? parseInt(pendingCustomQuantity, 10) : undefined;

    if (isPhysical && (!quantityValue || quantityValue <= 0)) {
      toast.error('Please enter a valid quantity greater than 0');
      return;
    }

    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
    const newId = `${selectedDepartment.toLowerCase().replace(/\s+/g, '-')}-custom-${Date.now()}`;

    const newRequirement: DepartmentRequirement = {
      id: newId,
      name: customRequirement.trim(),
      selected: true,
      notes: !isPhysical ? (customRequirementNotes ?? '') : '',
      type: customRequirementType,
      quantity: isPhysical ? quantityValue : undefined,
      // Custom requirements are pending validation but should still be clickable
      // and show the user's entered quantity as "Available Quantity" when physical.
      totalQuantity: isPhysical ? quantityValue : undefined,
      isAvailable: true,
      isCustom: true
    };

    const updatedReqs = [...currentReqs, newRequirement];
    const newDeptReqs = { ...formData.departmentRequirements };
    newDeptReqs[selectedDepartment] = updatedReqs;
    handleInputChange('departmentRequirements', newDeptReqs);

    // Reset modal fields
    setCustomRequirement('');
    setCustomRequirementType('service');
    setCustomRequirementNotes('');
    setPendingCustomQuantity('1');
    setShowCustomInput(false);

    toast.success(
      `Custom ${isPhysical ? 'quantity-based' : 'service'} requirement added - awaiting department validation`
    );
  };

  const handleSaveRequirements = () => {
    // Check if at least one requirement is selected
    const selectedReqs = formData.departmentRequirements[selectedDepartment]?.filter(req => req.selected) || [];

    if (selectedReqs.length === 0) {
      toast.error('Please select at least one requirement for this department.');
      return;
    }

    const dates = getEventDatesInRange();
    const isMultiDay = dates.length > 1;
    const dateKeys = dates.map((d) => format(d, 'yyyy-MM-dd'));

    // If a physical requirement has 0 availability for a day (or for the whole single-day),
    // allow saving by auto-setting quantity to 0.
    if (selectedReqs.some((r) => r.type === 'physical')) {
      const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
      let didChange = false;

      const updatedReqs = currentReqs.map((req) => {
        if (!req.selected || req.type !== 'physical') return req;

        const hasConflicts =
          conflictingEvents.length > 0 &&
          formData.startDate &&
          formData.startTime &&
          hasRequirementConflict(req, selectedDepartment);

        if (!isMultiDay) {
          const maxAvailable = hasConflicts ? getAvailableQuantity(req, selectedDepartment) : (typeof req.totalQuantity === 'number' ? req.totalQuantity : undefined);
          if (maxAvailable === 0 && (req.quantity == null || req.quantity === 0) === false) {
            didChange = true;
            return { ...req, quantity: 0 };
          }
          if (maxAvailable === 0 && (req.quantity == null)) {
            didChange = true;
            return { ...req, quantity: 0 };
          }
          return req;
        }

        const map = req.quantitiesByDate || {};
        const nextMap: Record<string, number> = { ...map };
        let changedLocal = false;

        dates.forEach((d) => {
          const k = format(d, 'yyyy-MM-dd');
          const maxAvailable = hasConflicts ? getAvailableQuantityForDate(req, d) : (typeof req.totalQuantity === 'number' ? req.totalQuantity : undefined);
          if (maxAvailable === 0 && typeof nextMap[k] !== 'number') {
            nextMap[k] = 0;
            changedLocal = true;
          }
        });

        if (!changedLocal) return req;

        didChange = true;
        const maxForDisplay = Object.values(nextMap).reduce((m, v) => Math.max(m, v || 0), 0);
        return { ...req, quantitiesByDate: nextMap, quantity: maxForDisplay };
      });

      if (didChange) {
        const newDeptReqs = { ...formData.departmentRequirements };
        newDeptReqs[selectedDepartment] = updatedReqs;
        handleInputChange('departmentRequirements', newDeptReqs);
      }
    }

    // Check if physical requirements have quantity specified (except when max available is 0)
    const physicalReqsWithoutQuantity = selectedReqs.filter((req) => {
      if (req.type !== 'physical') return false;

      const hasConflicts =
        conflictingEvents.length > 0 &&
        formData.startDate &&
        formData.startTime &&
        hasRequirementConflict(req, selectedDepartment);

      if (!isMultiDay) {
        const maxAvailable = hasConflicts ? getAvailableQuantity(req, selectedDepartment) : (typeof req.totalQuantity === 'number' ? req.totalQuantity : undefined);
        if (maxAvailable === 0) return false;
        return req.quantity == null || req.quantity === 0;
      }

      const map = req.quantitiesByDate || {};
      return dates.some((d) => {
        const k = format(d, 'yyyy-MM-dd');
        const maxAvailable = hasConflicts ? getAvailableQuantityForDate(req, d) : (typeof req.totalQuantity === 'number' ? req.totalQuantity : undefined);
        if (maxAvailable === 0) return false;
        return map[k] == null;
      });
    });

    if (physicalReqsWithoutQuantity.length > 0) {
      const reqNames = physicalReqsWithoutQuantity.map(req => req.name).join(', ');
      toast.error('Missing Quantity!', {
        description: `Please specify quantity for: ${reqNames}`,
        duration: 5000
      });
      return;
    }

    // Check for quantity over-requests (considering conflicts) - SKIP custom requirements
    const overRequests = selectedReqs.filter((req) => {
      if (req.type !== 'physical') return false;
      if (req.isCustom) return false; // Skip validation for custom requirements - PGSO will verify

      if (!isMultiDay) {
        if (!req.quantity) return false;
        if (conflictingEvents.length > 0 && formData.startDate && formData.startTime && hasRequirementConflict(req, selectedDepartment)) {
          const availableQty = getAvailableQuantity(req, selectedDepartment);
          return req.quantity > availableQty;
        }
        return req.totalQuantity && req.quantity > req.totalQuantity;
      }

      const map = req.quantitiesByDate || {};
      // Validate each day independently
      return dates.some((d) => {
        const k = format(d, 'yyyy-MM-dd');
        const dayQty = map[k] || 0;
        if (!dayQty) return false;

        let dayAvail: number | undefined;
        if (conflictingEvents.length > 0 && formData.startDate && formData.startTime && hasRequirementConflict(req, selectedDepartment)) {
          dayAvail = getAvailableQuantityForDate(req, d);
        } else if (typeof req.totalQuantity === 'number') {
          dayAvail = req.totalQuantity;
        }

        if (typeof dayAvail !== 'number') return false;
        return dayQty > dayAvail;
      });
    });

    if (overRequests.length > 0) {
      const overRequestDetails = overRequests.map((req) => {
        if (!isMultiDay) {
          const availableQty = conflictingEvents.length > 0 && formData.startDate && formData.startTime && hasRequirementConflict(req, selectedDepartment)
            ? getAvailableQuantity(req, selectedDepartment)
            : req.totalQuantity || 0;
          return `${req.name} (requested: ${req.quantity}, available: ${availableQty})`;
        }

        const map = req.quantitiesByDate || {};
        const parts = dates.map((d) => {
          const k = format(d, 'yyyy-MM-dd');
          const dayQty = map[k] || 0;
          const dayAvail = conflictingEvents.length > 0 && formData.startDate && formData.startTime && hasRequirementConflict(req, selectedDepartment)
            ? getAvailableQuantityForDate(req, d)
            : (req.totalQuantity || 0);
          return `${format(d, 'MMM dd')}: requested ${dayQty}, available ${dayAvail}`;
        });
        return `${req.name} (${parts.join(' | ')})`;
      });

      toast.error(`Cannot save! Requested quantities exceed available resources:`, {
        description: overRequestDetails.join(', '),
        duration: 8000
      });
      return; // Prevent saving when quantities exceed available
    }

    // Add department to tagged list if not already added
    if (!formData.taggedDepartments.includes(selectedDepartment)) {
      const updatedDepartments = [...formData.taggedDepartments, selectedDepartment];
      handleInputChange('taggedDepartments', updatedDepartments);
    }

    // Close modal
    setShowRequirementsModal(false);

    const requirementCount = selectedReqs.length;
    const physicalCount = selectedReqs.filter(req => req.type === 'physical' && (req.quantity || req.quantitiesByDate)).length;
    const notesCount = selectedReqs.filter(req => req.type === 'service' && req.notes && req.notes.trim()).length;

    const details = [];
    if (physicalCount > 0) details.push(`${physicalCount} with quantities`);
    if (notesCount > 0) details.push(`${notesCount} with notes`);

    toast.success(`Requirements saved for ${selectedDepartment}!`, {
      description: `${requirementCount} requirement(s) selected${details.length > 0 ? ` (${details.join(', ')})` : ''}.`
    });
  };

  // Check if departments have requirements added
  const hasRequirementsForDepartments = () => {
    return formData.taggedDepartments.some(dept => {
      const deptReqs = formData.departmentRequirements[dept];
      return deptReqs && deptReqs.some(req => req.selected);
    });
  };

  // Check if any physical requirements exceed available quantity - SKIP custom requirements
  const hasQuantityOverRequests = () => {
    return formData.taggedDepartments.some(dept => {
      const deptReqs = formData.departmentRequirements[dept];
      return deptReqs && deptReqs.some(req =>
        req.selected &&
        req.type === 'physical' &&
        !req.isCustom && // Skip custom requirements - PGSO will verify
        req.quantity &&
        req.totalQuantity &&
        req.quantity > req.totalQuantity
      );
    });
  };

  // Check if two time ranges overlap
  const hasTimeConflict = (start1: string, end1: string, start2: string, end2: string, date1: Date, date2: Date) => {
    // First check if dates are the same
    if (date1.toDateString() !== date2.toDateString()) {
      return false;
    }
    // If times are missing, treat as full day conflict to early-warn user 
    if (!start1 || !end1 || !start2 || !end2) return true;

    // Convert time strings to minutes for easier comparison
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start1Minutes = timeToMinutes(start1);
    const end1Minutes = timeToMinutes(end1);
    const start2Minutes = timeToMinutes(start2);
    const end2Minutes = timeToMinutes(end2);

    // Check if time ranges overlap
    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  };

  // Fetch conflicting events for venue booking (location-specific conflicts)
  const fetchVenueConflicts = async (date: Date, startTime: string, endTime: string, location: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/events`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const eventsData = await response.json();
      const events = eventsData.data || [];

      const dayKey = (d: Date) => {
        const dd = new Date(d);
        return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()).toDateString();
      };

      const getSelectedTimeRangeForDate = (d: Date) => {
        const dayStr = dayKey(d);
        const startDayStr = formData.startDate ? dayKey(formData.startDate) : '';
        if (dayStr === startDayStr) {
          return { start: formData.startTime || startTime, end: formData.endTime || endTime };
        }
        const slot = (formData.dateTimeSlots || []).find((s) => s?.date && dayKey(new Date(s.date)) === dayStr);
        return { start: slot?.startTime || '', end: slot?.endTime || '' };
      };

      const getEventTimeRangeForDate = (event: any, d: Date) => {
        const dayStr = dayKey(d);

        const evStartDateStr = event?.startDate ? dayKey(new Date(event.startDate)) : '';
        if (evStartDateStr && evStartDateStr === dayStr) {
          return { start: String(event?.startTime || ''), end: String(event?.endTime || '') };
        }

        if (Array.isArray(event?.dateTimeSlots)) {
          const matched = event.dateTimeSlots.find((s: any) => s?.startDate && dayKey(new Date(s.startDate)) === dayStr);
          if (matched) {
            return { start: String(matched?.startTime || ''), end: String(matched?.endTime || '') };
          }
        }

        // Fallback: if event spans this day (multi-day) but has no slots, treat it as occupying the same time range.
        if (event?.startDate && event?.endDate) {
          const start = new Date(event.startDate);
          const end = new Date(event.endDate);
          const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
          const checkDay = new Date(new Date(d).getFullYear(), new Date(d).getMonth(), new Date(d).getDate());
          if (checkDay >= startDay && checkDay <= endDay) {
            return { start: String(event?.startTime || ''), end: String(event?.endTime || '') };
          }
        }

        return null;
      };


      // Filter events that conflict with the selected time AND location (for venue booking)
      const conflicts = events.filter((event: any) => {
        if (event.status === 'cancelled') {
          return false;
        }

        if (!event.startDate || !event.startTime || !event.endDate || !event.endTime) {
          return false;
        }

        // Check if locations conflict (handles Pavilion hierarchy)
        if (!locationsConflict(event.location, location)) {
          return false;
        }

        const eventStartDate = new Date(event.startDate);

        // Check if there's a time conflict at the same venue
        const hasConflict = hasTimeConflict(
          startTime, endTime,
          event.startTime, event.endTime,
          date, eventStartDate
        );


        return hasConflict;
      });

      return conflicts;
    } catch (error) {
      return [];
    }
  };

  // Fetch conflicting events for resource availability checking (across ALL locations)
  const fetchConflictingEvents = async (date: Date, startTime: string, endTime: string, location?: string) => {
    try {

      const response = await fetch(`${API_BASE_URL}/events`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const eventsData = await response.json();
      const events = eventsData.data || [];

      const dayKey = (d: Date) => {
        const dd = new Date(d);
        return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()).toDateString();
      };

      const getSelectedTimeRangeForDate = (d: Date) => {
        const dayStr = dayKey(d);
        const startDayStr = formData.startDate ? dayKey(formData.startDate) : '';
        if (dayStr === startDayStr) {
          return { start: formData.startTime || startTime, end: formData.endTime || endTime };
        }
        const slot = (formData.dateTimeSlots || []).find((s) => s?.date && dayKey(new Date(s.date)) === dayStr);
        return { start: slot?.startTime || '', end: slot?.endTime || '' };
      };

      const getEventTimeRangeForDate = (event: any, d: Date) => {
        const dayStr = dayKey(d);

        const evStartDateStr = event?.startDate ? dayKey(new Date(event.startDate)) : '';
        if (evStartDateStr && evStartDateStr === dayStr) {
          return { start: String(event?.startTime || ''), end: String(event?.endTime || '') };
        }

        if (Array.isArray(event?.dateTimeSlots)) {
          const matched = event.dateTimeSlots.find((s: any) => s?.startDate && dayKey(new Date(s.startDate)) === dayStr);
          if (matched) {
            return { start: String(matched?.startTime || ''), end: String(matched?.endTime || '') };
          }
        }

        if (event?.startDate && event?.endDate) {
          const start = new Date(event.startDate);
          const end = new Date(event.endDate);
          const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
          const checkDay = new Date(new Date(d).getFullYear(), new Date(d).getMonth(), new Date(d).getDate());
          if (checkDay >= startDay && checkDay <= endDay) {
            return { start: String(event?.startTime || ''), end: String(event?.endTime || '') };
          }
        }

        return null;
      };

      // Build list of all dates to check (Day 1 + additional days)
      const datesToCheck: Date[] = [date]; // Start with Day 1

      // If multi-day event, add all additional days
      if (formData.endDate && formData.startDate && formData.endDate.getTime() !== formData.startDate.getTime()) {
        const currentDate = new Date(formData.startDate);
        const endDate = new Date(formData.endDate);

        // Skip the first day (already added)
        currentDate.setDate(currentDate.getDate() + 1);

        while (currentDate <= endDate) {
          datesToCheck.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }


      // Filter events that conflict with ANY of the dates in the range
      const conflicts = events.filter((event: any) => {
        if (event.status === 'cancelled') {
          return false;
        }

        if (!event.startDate || !event.startTime || !event.endDate || !event.endTime) {
          return false;
        }

        // Check if event conflicts with ANY of our dates
        return datesToCheck.some((checkDate) => {
          const selectedRange = getSelectedTimeRangeForDate(checkDate);
          const eventRange = getEventTimeRangeForDate(event, checkDate);
          if (!eventRange) return false;

          const hasConflict = hasTimeConflict(
            selectedRange.start,
            selectedRange.end,
            eventRange.start,
            eventRange.end,
            checkDate,
            checkDate
          );
          return hasConflict;
        });
      });


      setConflictingEvents(conflicts);
      return conflicts;
    } catch (error) {
      setConflictingEvents([]);
      return [];
    }
  };

  const getEventDatesInRange = React.useCallback((): Date[] => {
    if (!formData.startDate) return [];

    const start = new Date(formData.startDate);
    const end = formData.endDate ? new Date(formData.endDate) : new Date(formData.startDate);
    const dates: Date[] = [];

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (cursor <= endDay) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }, [formData.startDate, formData.endDate]);

  // Calculate available quantity after subtracting conflicting bookings from ALL departments
  const getAvailableQuantityForDate = React.useCallback((requirement: any, checkDate: Date) => {
    let usedQuantity = 0;

    const notes = (requirement?.availabilityNotes || '').toString();
    const isLocationDefault = notes.startsWith('PAVILION_DEFAULT:');
    const locationDefaultTarget = isLocationDefault ? notes.split(':').slice(2).join(':') : '';

    const checkDateStr = new Date(checkDate).toDateString();

    const normalizeDay = (d: Date) => {
      const dd = new Date(d);
      return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate());
    };

    const eventUsesDay = (event: any) => {
      // If there are explicit slots, trust them
      if (Array.isArray(event?.dateTimeSlots)) {
        return event.dateTimeSlots.some((s: any) => s?.startDate && normalizeDay(new Date(s.startDate)).toDateString() === checkDateStr);
      }

      if (!event?.startDate || !event?.endDate) {
        return false;
      }

      const start = normalizeDay(new Date(event.startDate));
      const end = normalizeDay(new Date(event.endDate));
      const day = normalizeDay(new Date(checkDate));
      return day >= start && day <= end;
    };

    conflictingEvents.forEach((event: any) => {
      // Only subtract bookings that overlap the specific day we're checking
      if (!eventUsesDay(event)) return;

      if (isLocationDefault) {
        const eventLoc = (event?.location || '').toString();
        if (!locationDefaultTarget || !eventLoc) return;
        if (!locationsSharePavilionPool(locationDefaultTarget, eventLoc, requirement.name)) return;
      }

      // Check ALL departments in the event, not just the current department
      if (event.taggedDepartments && event.departmentRequirements) {
        event.taggedDepartments.forEach((taggedDept: string) => {
          const eventReqs = event.departmentRequirements[taggedDept];
          if (Array.isArray(eventReqs)) {
            const matchingReq = eventReqs.find((req: any) =>
              req.name === requirement.name && req.selected && req.quantity
            );
            if (matchingReq) {
              const k = format(new Date(checkDate), 'yyyy-MM-dd');
              const perDayQty = matchingReq?.quantitiesByDate && typeof matchingReq.quantitiesByDate[k] === 'number'
                ? matchingReq.quantitiesByDate[k]
                : undefined;
              usedQuantity += typeof perDayQty === 'number' ? perDayQty : (matchingReq.quantity || 0);
            }
          }
        });
      }
    });

    const totalAvailable = requirement.totalQuantity || 0;
    return Math.max(0, totalAvailable - usedQuantity);
  }, [conflictingEvents, locationsSharePavilionPool]);

  const getAvailableQuantity = React.useCallback((requirement: any, departmentName: string) => {
    const totalAvailable = requirement.totalQuantity || 0;

    const dates = getEventDatesInRange();
    const isMultiDay = dates.length > 1;

    // Single-day: behave as before (but still date-aware)
    if (!isMultiDay) {
      const day = dates[0] || formData.startDate;
      if (!day) return totalAvailable;
      return getAvailableQuantityForDate(requirement, day);
    }

    // Multi-day: equipment is booked per-day. Validate against the worst day.
    const perDayAvail = dates.map((d) => getAvailableQuantityForDate(requirement, d));
    return perDayAvail.length ? Math.min(...perDayAvail) : totalAvailable;
  }, [formData.startDate, getAvailableQuantityForDate, getEventDatesInRange]);

  // Check if a specific requirement has conflicts (is actually booked by other events from ANY department)
  const hasRequirementConflict = (requirement: any, departmentName: string) => {
    const notes = (requirement?.availabilityNotes || '').toString();
    const isLocationDefault = notes.startsWith('PAVILION_DEFAULT:');
    const locationDefaultTarget = isLocationDefault ? notes.split(':').slice(2).join(':') : '';

    return conflictingEvents.some(event => {
      if (isLocationDefault) {
        const eventLoc = (event?.location || '').toString();
        if (!locationDefaultTarget || !eventLoc) return false;
        if (!locationsSharePavilionPool(locationDefaultTarget, eventLoc, requirement.name)) return false;
      }

      // Check ALL departments in the event, not just the current department
      if (event.taggedDepartments && event.departmentRequirements) {
        return event.taggedDepartments.some((taggedDept: string) => {
          const eventReqs = event.departmentRequirements[taggedDept];
          if (Array.isArray(eventReqs)) {
            return eventReqs.some((req: any) =>
              req.name === requirement.name && req.selected && req.quantity
            );
          }
          return false;
        });
      }
      return false;
    });
  };

  // Check if form is ready to submit (all validation passes)
  const isFormReadyToSubmit = () => {
    // Basic required fields for all event types
    const basicFieldsValid = (
      formData.eventTitle &&
      formData.requestor &&
      formData.location &&
      formData.participants &&
      formData.startDate &&
      formData.startTime &&
      formData.endDate &&
      formData.endTime &&
      formData.contactNumber &&
      formData.contactEmail &&
      formData.contactNumber.length === 11 &&
      formData.contactEmail.includes('@')
    );

    // For custom locations: allow submission without tagging departments/requirements
    // as long as the user acknowledged the manual coordination step.
    if (isCustomLocationSelected) {
      return basicFieldsValid && pgsoCustomLocationAck && !hasQuantityOverRequests();
    }

    // For Simple Meeting: allow submission without departments if noDepartmentsNeeded is checked
    if (formData.eventType === 'simple-meeting') {
      if (noDepartmentsNeeded) {
        return basicFieldsValid; // No department requirements needed
      } else {
        // If departments are tagged, they must have requirements
        return basicFieldsValid &&
          formData.taggedDepartments.length > 0 &&
          hasRequirementsForDepartments() &&
          !hasQuantityOverRequests();
      }
    }

    // For Simple and Complex: departments are required
    return (
      basicFieldsValid &&
      formData.taggedDepartments.length > 0 &&
      hasRequirementsForDepartments() &&
      !hasQuantityOverRequests()
    );
  };

  const getSubmitBlockers = () => {
    const blockers: string[] = [];

    if (!formData.eventTitle) blockers.push('Event Title is required');
    if (!formData.requestor) blockers.push('Requestor is required');
    if (!formData.location) blockers.push('Location is required');
    if (!formData.participants) blockers.push('Participants is required');
    if (!formData.startDate) blockers.push('Start Date is required');
    if (!formData.startTime) blockers.push('Start Time is required');
    if (!formData.endDate) blockers.push('End Date is required');
    if (!formData.endTime) blockers.push('End Time is required');

    if (!formData.contactNumber) {
      blockers.push('Contact Number is required');
    } else if (formData.contactNumber.length !== 11) {
      blockers.push('Contact Number must be 11 digits');
    }

    if (!formData.contactEmail) {
      blockers.push('Email Address is required');
    } else if (!formData.contactEmail.includes('@')) {
      blockers.push('Email Address must be valid (must include @)');
    }

    if (isCustomLocationSelected && !pgsoCustomLocationAck) {
      blockers.push('Acknowledge custom location manual coordination');
    }

    if (isCustomLocationSelected && pgsoCustomLocationAck) {
      if (hasQuantityOverRequests()) {
        blockers.push('Some requested quantities exceed available resources');
      }
      return blockers;
    }

    if (formData.eventType === 'simple-meeting') {
      if (!noDepartmentsNeeded) {
        if (!formData.taggedDepartments.length) {
          blockers.push('Tag at least 1 department (or check “No departments needed”)');
        }
        if (formData.taggedDepartments.length > 0 && !hasRequirementsForDepartments()) {
          blockers.push('Select at least 1 requirement for your tagged department(s)');
        }
      }
    } else {
      if (!formData.taggedDepartments.length) {
        blockers.push('Tag at least 1 department');
      }
      if (formData.taggedDepartments.length > 0 && !hasRequirementsForDepartments()) {
        blockers.push('Select at least 1 requirement for your tagged department(s)');
      }
    }

    if (hasQuantityOverRequests()) {
      blockers.push('Some requested quantities exceed available resources');
    }

    return blockers;
  };

  const submitBlockers = React.useMemo(() => {
    return getSubmitBlockers();
  }, [
    formData.eventTitle,
    formData.requestor,
    formData.location,
    formData.participants,
    formData.startDate,
    formData.startTime,
    formData.endDate,
    formData.endTime,
    formData.contactNumber,
    formData.contactEmail,
    formData.taggedDepartments,
    formData.departmentRequirements,
    formData.eventType,
    noDepartmentsNeeded
  ]);

  // Calculate completed steps count
  const getCompletedStepsCount = () => {
    let completedCount = 0;

    // Step 1: Event Details
    if (formData.eventTitle && formData.requestor && formData.location && formData.participants) {
      completedCount++;
    }

    // Step 2: Attachments
    if (isAttachmentsCompleted) {
      completedCount++;
    }

    // Step 3: Tag Departments (can be skipped for Simple Meeting if noDepartmentsNeeded is checked)
    if (formData.taggedDepartments.length > 0 || (formData.eventType === 'simple-meeting' && noDepartmentsNeeded)) {
      completedCount++;
    }

    // Step 4: Requirements
    if (hasRequirementsForDepartments()) {
      completedCount++;
    }

    // Step 5: Schedule
    if (formData.startDate && formData.startTime && formData.endDate && formData.endTime &&
      formData.contactNumber && formData.contactEmail &&
      formData.contactNumber.length === 11 && formData.contactEmail.includes('@')) {
      completedCount++;
    }

    // Step 6: Ready to Submit
    if (isFormReadyToSubmit()) {
      completedCount++;
    }

    return completedCount;
  };

  // Handle final form submission
  const handleSubmitEventRequest = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    let uploadToastId: string | undefined = undefined;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Please login to submit an event request.');
        setIsSubmitting(false);
        return;
      }

      const formatDateOnly = (date: Date | null | undefined) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const selectedEventDates = getEventDatesInRange();
      const isMultiDay = selectedEventDates.length > 1;
      const dateKeys = selectedEventDates.map((d) => format(d, 'yyyy-MM-dd'));

      const shouldSplitByRequirements = (() => {
        if (!isMultiDay) return false;

        return formData.taggedDepartments.some((dept) => {
          const reqs = (formData.departmentRequirements[dept] || []).filter((r) => r.selected && r.type === 'physical');
          return reqs.some((r) => {
            const map = r.quantitiesByDate;
            if (!map) return false;
            const values = dateKeys.map((k) => map[k]).filter((v) => typeof v === 'number') as number[];
            if (values.length <= 1) return false;
            return values.some((v) => v !== values[0]);
          });
        });
      })();

      const getTimesForDate = (d: Date) => {
        const dayStr = new Date(d).toDateString();
        const startOfRange = formData.startDate ? new Date(formData.startDate).toDateString() : '';

        if (dayStr === startOfRange) {
          return { startTime: formData.startTime, endTime: formData.endTime };
        }

        const slot = (formData.dateTimeSlots || []).find((s) => new Date(s.date).toDateString() === dayStr);
        if (slot?.startTime && slot?.endTime) {
          return { startTime: slot.startTime, endTime: slot.endTime };
        }

        // Fallback: reuse Day 1 time if user didn't configure slot
        return { startTime: formData.startTime, endTime: formData.endTime };
      };

      const getRequestorDepartment = () => {
        const userData = localStorage.getItem('userData');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            return user.department || user.departmentName || 'Unknown';
          } catch (error) {
            return 'Unknown';
          }
        }
        return 'Unknown';
      };

      const buildSelectedRequirementsOnly = (dateKey?: string): DepartmentRequirements => {
        const selectedOnly: DepartmentRequirements = {};
        Object.keys(formData.departmentRequirements).forEach((deptName) => {
          const selectedReqs = formData.departmentRequirements[deptName]?.filter((req) => req.selected) || [];
          if (selectedReqs.length === 0) return;

          selectedOnly[deptName] = selectedReqs.map((req: any) => {
            // If we are splitting per-day, use that day's quantity when provided.
            let quantity = req.quantity;
            if (dateKey && req.type === 'physical' && req.quantitiesByDate && typeof req.quantitiesByDate[dateKey] === 'number') {
              quantity = req.quantitiesByDate[dateKey];
            }

            const { quantitiesByDate, ...rest } = req;
            return {
              ...rest,
              quantity,
              requirementsStatus: 'on-hold'
            };
          });
        });

        return selectedOnly;
      };

      const buildFormDataToSubmit = (opts?: {
        startDate: Date | undefined;
        endDate: Date | undefined;
        startTime: string;
        endTime: string;
        includeDateTimeSlots: boolean;
        requirementsDateKey?: string;
      }): globalThis.FormData => {
        const fd = new globalThis.FormData();

        // Basic event information
        fd.append('eventTitle', formData.eventTitle);
        fd.append('requestor', formData.requestor);

        // Location handling
        if (formData.locations.length > 1) {
          fd.append('locations', JSON.stringify(formData.locations));
          fd.append('location', formData.locations[0]);
          fd.append('multipleLocations', 'true');
        } else {
          fd.append('location', formData.location);
          fd.append('multipleLocations', 'false');
        }

        if (formData.roomType) {
          fd.append('roomType', formData.roomType);
        }

        fd.append('participants', formData.participants);
        fd.append('vip', formData.vip || '0');
        fd.append('vvip', formData.vvip || '0');
        fd.append('withoutGov', formData.withoutGov.toString());
        fd.append('description', formData.description || '');
        fd.append('eventType', formData.eventType);

        fd.append('startDate', formatDateOnly(opts?.startDate));
        fd.append('startTime', opts?.startTime || formData.startTime);
        fd.append('endDate', formatDateOnly(opts?.endDate));
        fd.append('endTime', opts?.endTime || formData.endTime);

        if (opts?.includeDateTimeSlots && formData.dateTimeSlots && formData.dateTimeSlots.length > 0) {
          const fullyConfiguredSlots = formData.dateTimeSlots.filter((slot) => slot.startTime && slot.endTime);
          if (fullyConfiguredSlots.length > 0) {
            const formattedSlots = fullyConfiguredSlots.map((slot) => ({
              startDate: formatDateOnly(slot.date),
              startTime: slot.startTime,
              endDate: formatDateOnly(slot.date),
              endTime: slot.endTime
            }));
            fd.append('dateTimeSlots', JSON.stringify(formattedSlots));
          }
        }

        fd.append('contactNumber', formData.contactNumber);
        fd.append('contactEmail', formData.contactEmail);
        fd.append('requestorDepartment', getRequestorDepartment());

        fd.append('taggedDepartments', JSON.stringify(formData.taggedDepartments));
        fd.append('departmentRequirements', JSON.stringify(buildSelectedRequirementsOnly(opts?.requirementsDateKey)));

        // Attachments
        fd.append('noAttachments', formData.noAttachments.toString());
        formData.attachments.forEach((file) => {
          fd.append('attachments', file);
        });

        // Government files (if w/o gov is true)
        if (formData.withoutGov && govFiles.brieferTemplate) {
          fd.append('brieferTemplate', govFiles.brieferTemplate);
        }
        if (formData.withoutGov && govFiles.programme) {
          fd.append('programme', govFiles.programme);
        }

        return fd;
      };

      const requestsToSubmit: { label: string; payload: globalThis.FormData }[] = [];
      if (shouldSplitByRequirements) {
        selectedEventDates.forEach((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const { startTime, endTime } = getTimesForDate(d);
          requestsToSubmit.push({
            label: format(d, 'MMM dd'),
            payload: buildFormDataToSubmit({
              startDate: d,
              endDate: d,
              startTime,
              endTime,
              includeDateTimeSlots: false,
              requirementsDateKey: key
            })
          });
        });
      } else {
        requestsToSubmit.push({
          label: 'event',
          payload: buildFormDataToSubmit({
            startDate: formData.startDate,
            endDate: formData.endDate,
            startTime: formData.startTime,
            endTime: formData.endTime,
            includeDateTimeSlots: true
          })
        });
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      };


      // Show initial loading toast with unique ID
      uploadToastId = `upload-${Date.now()}`;
      toast.loading('Submitting event request...', {
        id: uploadToastId,
        description: 'Preparing your submission... 0%',
        duration: Infinity, // Keep toast until we dismiss it
      });

      let lastResponse: any = null;
      for (let i = 0; i < requestsToSubmit.length; i++) {
        const req = requestsToSubmit[i];
        const currentLabel = requestsToSubmit.length > 1 ? `Submitting ${req.label} (${i + 1}/${requestsToSubmit.length})...` : 'Submitting event request...';

        toast.loading(currentLabel, {
          id: uploadToastId,
          description: `Preparing your submission...`,
          duration: Infinity
        });

        // Add timeout for large file uploads (10 minutes for production)
        lastResponse = await axios.post(`${API_BASE_URL}/events`, req.payload, {
          headers,
          timeout: 600000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
              const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
              toast.loading(currentLabel, {
                id: uploadToastId,
                description: `Upload progress: ${percentCompleted}% (${loadedMB}MB / ${totalMB}MB)`,
                duration: Infinity
              });
            }
          }
        });
      }

      // Dismiss loading toast after upload completes
      toast.dismiss(uploadToastId);


      if (lastResponse?.data?.success) {
        toast.success('Event request submitted successfully!', {
          description: requestsToSubmit.length > 1
            ? `Your multi-day request was submitted as ${requestsToSubmit.length} separate events (per-day requirements).`
            : 'Your event request has been sent for approval.'
        });

        // Navigate to My Events page after successful submission
        setTimeout(() => {
          navigate('/users/my-events');
        }, 1500); // Wait 1.5 seconds to show the success toast
      } else {
        throw new Error(lastResponse?.data?.message || 'Submission failed');
      }
    } catch (error: any) {
      console.error('❌ [EVENT SUBMISSION] Error:', error);
      console.error('❌ [EVENT SUBMISSION] Error code:', error.code);
      console.error('❌ [EVENT SUBMISSION] Error response:', error.response);
      console.error('❌ [EVENT SUBMISSION] Error message:', error.message);

      // Dismiss loading toast if it exists
      if (uploadToastId) {
        toast.dismiss(uploadToastId);
      }

      let errorMessage = 'Please try again later.';
      let errorTitle = 'Failed to submit event request';

      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorTitle = 'Request Timeout';
        errorMessage = 'The upload is taking too long. This might be due to slow internet or server issues. Please try again or contact support.';
      } else if (error.code === 'ERR_NETWORK') {
        errorTitle = 'Network Error';
        errorMessage = 'Cannot connect to the server. Please check your internet connection and try again.';
      } else if (error.response?.status === 413) {
        errorTitle = 'Files Too Large';
        errorMessage = 'The total file size exceeds the server limit. Please reduce file sizes and try again.';
      } else if (error.response?.status === 502 || error.response?.status === 504) {
        errorTitle = 'Gateway Timeout';
        errorMessage = 'The server is taking too long to respond. This might be a temporary issue. Please try again in a few moments.';
      } else if (error.response?.status === 500) {
        errorTitle = 'Submission Failed';
        // Prefer the detailed server-side error string, then the message, then a generic fallback
        const serverError = error.response?.data?.error || '';
        const serverMessage = error.response?.data?.message || '';
        if (serverError) {
          // Strip Mongoose "Event validation failed: " prefix
          const cleanError = serverError.replace(/^Event validation failed:\s*/i, '');
          // Prettify field names like "contactEmail" → "Contact Email"
          const prettifyField = (field: string) =>
            field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
          // Split multiple validation errors (separated by ", fieldName:")
          const parts = cleanError.split(/,\s*(?=[a-zA-Z]+:)/);
          const prettyParts = parts.map((part: string) => {
            const colonIdx = part.indexOf(':');
            if (colonIdx === -1) return part.trim();
            const field = part.substring(0, colonIdx).trim();
            const msg = part.substring(colonIdx + 1).trim();
            return `${prettifyField(field)}: ${msg}`;
          });
          errorMessage = prettyParts.join('\n');
        } else if (serverMessage && serverMessage !== 'Failed to create event request') {
          errorMessage = serverMessage;
        } else {
          errorMessage = 'An error occurred on the server. Please check your inputs and try again, or contact support if the issue persists.';
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorTitle, {
        description: errorMessage,
        duration: 10000 // Show error for 10 seconds
      });
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(departmentSearch.toLowerCase())
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    handleInputChange('attachments', [...formData.attachments, ...validFiles]);
  };

  const removeFile = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    handleInputChange('attachments', newAttachments);
  };


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

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getBookedVenueIntervals = (checkDate?: Date) => {
    const dateToCheck = checkDate || formData.startDate;
    if (!dateToCheck || !formData.location || venueConflictingEvents.length === 0) {
      return [] as Array<[number, number]>;
    }

    const checkDateStr = dateToCheck.toDateString();

    const intervals: Array<[number, number]> = [];

    venueConflictingEvents.forEach((event) => {
      // Check location conflict
      const eventLocations = event.locations && Array.isArray(event.locations) && event.locations.length > 0
        ? event.locations
        : [event.location];

      const hasLocationConflict = eventLocations.some((eventLoc: string) =>
        locationsConflict(eventLoc, formData.location)
      );

      if (!hasLocationConflict) return;

      // Main event date
      const eventDate = new Date(event.startDate);
      if (eventDate.toDateString() === checkDateStr && event.startTime && event.endTime) {
        intervals.push([timeToMinutes(event.startTime), timeToMinutes(event.endTime)]);
      }

      // Multi-day slots
      if (event.dateTimeSlots && Array.isArray(event.dateTimeSlots)) {
        event.dateTimeSlots.forEach((slot: any) => {
          if (!slot.startDate || !slot.startTime || !slot.endTime) return;
          const slotDate = new Date(slot.startDate);
          if (slotDate.toDateString() === checkDateStr) {
            intervals.push([timeToMinutes(slot.startTime), timeToMinutes(slot.endTime)]);
          }
        });
      }
    });

    // Sort for stability
    intervals.sort((a, b) => a[0] - b[0]);
    return intervals;
  };

  const isVenueRangeBooked = (startTime: string, endTime: string, checkDate?: Date) => {
    if (!startTime || !endTime) return false;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (endMinutes <= startMinutes) return true;

    const bookedIntervals = getBookedVenueIntervals(checkDate);

    // Overlap check (treat intervals as [start, end) so end==start is allowed)
    return bookedIntervals.some(([blockedStart, blockedEnd]) => {
      return startMinutes < blockedEnd && endMinutes > blockedStart;
    });
  };


  // Check if a specific time slot is booked for the selected location and date
  const isTimeSlotBooked = (timeSlot: string, checkDate?: Date) => {
    // Use checkDate if provided, otherwise use formData.startDate (Day 1)
    const dateToCheck = checkDate || formData.startDate;


    if (!dateToCheck || !formData.location || venueConflictingEvents.length === 0) {
      return false;
    }

    const result = venueConflictingEvents.some(event => {
      const checkDateStr = dateToCheck.toDateString();

      // Check if the main event date matches
      const eventDate = new Date(event.startDate);
      const eventDateStr = eventDate.toDateString();
      const mainDateMatches = checkDateStr === eventDateStr;

      // Check location conflict
      const eventLocations = event.locations && Array.isArray(event.locations) && event.locations.length > 0
        ? event.locations
        : [event.location];

      const hasLocationConflict = eventLocations.some((eventLoc: string) =>
        locationsConflict(eventLoc, formData.location)
      );

      if (!hasLocationConflict) return false;

      // Helper function to check time conflict
      const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const checkTimeConflict = (startTime: string, endTime: string) => {
        const slotMinutes = timeToMinutes(timeSlot);
        const eventStartMinutes = timeToMinutes(startTime);
        const eventEndMinutes = timeToMinutes(endTime);

        // A time slot conflicts if it falls within the event's time range
        // Include both start time AND end time (event is still happening at end time)
        const isConflict = slotMinutes >= eventStartMinutes && slotMinutes <= eventEndMinutes;


        return isConflict;
      };

      // If main date matches, check main time
      if (mainDateMatches) {
        const isBlocked = checkTimeConflict(event.startTime, event.endTime);
        if (isBlocked) {
          return true;
        }
      }

      // Check if any dateTimeSlots match the date we're checking
      if (event.dateTimeSlots && Array.isArray(event.dateTimeSlots)) {
        for (const slot of event.dateTimeSlots) {
          if (!slot.startDate || !slot.startTime || !slot.endTime) continue;

          const slotDate = new Date(slot.startDate);
          if (slotDate.toDateString() === checkDateStr) {
            const isBlocked = checkTimeConflict(slot.startTime, slot.endTime);
            if (isBlocked) {
              return true;
            }
          }
        }
      }

      return false;
    });

    return result;
  };

  // Check if a specific time slot has requirement conflicts (any requirements used by existing events)
  const hasRequirementConflictAtTime = (timeSlot: string, checkDate?: Date) => {
    // Use checkDate if provided, otherwise use formData.startDate (Day 1)
    const dateToCheck = checkDate || formData.startDate;

    if (!dateToCheck || conflictingEvents.length === 0) {
      return { hasConflict: false, conflictedRequirements: [] };
    }

    const conflictedRequirements: string[] = [];
    const checkDateStr = dateToCheck.toDateString();

    // Check each conflicting event to see if it uses any requirements at this time slot
    conflictingEvents.forEach(event => {
      // Helper function
      const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const checkRequirementsForTime = (startTime: string, endTime: string) => {
        const slotMinutes = timeToMinutes(timeSlot);
        const eventStartMinutes = timeToMinutes(startTime);
        const eventEndMinutes = timeToMinutes(endTime);

        // Check if this time slot overlaps with the event
        const timeOverlaps = slotMinutes >= eventStartMinutes && slotMinutes <= eventEndMinutes;

        if (!timeOverlaps) return;

        // Check if this event uses ANY requirements
        if (event.taggedDepartments && Array.isArray(event.taggedDepartments) && event.departmentRequirements) {
          event.taggedDepartments.forEach((dept: string) => {
            const deptReqs = event.departmentRequirements[dept] || [];
            if (Array.isArray(deptReqs)) {
              deptReqs.forEach((eventReq: any) => {
                // Check if requirement is selected and has quantity
                const isSelected = eventReq.selected === true;
                // Check both quantity and totalQuantity fields
                const quantity = eventReq.quantity || eventReq.totalQuantity || 0;
                const hasQuantity = quantity > 0;

                if (isSelected && hasQuantity && eventReq.name) {
                  const reqName = `${eventReq.name} (${dept})`;
                  if (!conflictedRequirements.includes(reqName)) {
                    conflictedRequirements.push(reqName);
                  }
                }
              });
            }
          });
        }
      };

      // Check main event date
      if (event.startTime && event.endTime) {
        const eventDate = new Date(event.startDate);
        if (eventDate.toDateString() === checkDateStr) {
          checkRequirementsForTime(event.startTime, event.endTime);
        }
      }

      // Check dateTimeSlots for multi-day events
      if (event.dateTimeSlots && Array.isArray(event.dateTimeSlots)) {
        event.dateTimeSlots.forEach((slot: any) => {
          if (!slot.startDate || !slot.startTime || !slot.endTime) return;

          const slotDate = new Date(slot.startDate);
          if (slotDate.toDateString() === checkDateStr) {
            checkRequirementsForTime(slot.startTime, slot.endTime);
          }
        });
      }
    });

    const result = {
      hasConflict: conflictedRequirements.length > 0,
      conflictedRequirements
    };

    return result;
  };

  // Get available end times based on selected start time
  const getAvailableEndTimes = () => {
    if (!formData.startTime) return generateTimeOptions();

    const startMinutes = timeToMinutes(formData.startTime);

    return generateTimeOptions().filter((timeOption) => {
      const optionMinutes = timeToMinutes(timeOption.value);
      // End time must be after start time
      if (optionMinutes <= startMinutes) return false;
      // Must not overlap/bridge across any booked venue interval
      return !isVenueRangeBooked(formData.startTime, timeOption.value, formData.startDate || undefined);
    });
  };

  const calculateDuration = (startDate: Date, startTime: string, endDate: Date, endTime: string): string => {
    if (!startDate || !startTime || !endDate || !endTime) return '';

    const start = new Date(startDate);
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    start.setHours(startHours, startMinutes);

    const end = new Date(endDate);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    end.setHours(endHours, endMinutes);

    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  // Calculate calendar days between two dates (including weekends)
  const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Validate minimum lead time based on event type
  const validateLeadTime = (selectedDate: Date): { isValid: boolean; message: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysRequired = formData.eventType === 'simple' ? 7 : 30;
    const days = calculateWorkingDays(today, selectedDate);

    if (days < daysRequired) {
      return {
        isValid: false,
        message: `${formData.eventType === 'simple' ? 'Simple' : 'Complex'} events require at least ${daysRequired} days lead time. You have ${days} days.`
      };
    }

    return { isValid: true, message: '' };
  };

  // Validate contact details
  const validateContactDetails = () => {
    const errors = [];

    if (!formData.contactNumber) {
      errors.push('Contact number is required');
    } else if (formData.contactNumber.length !== 11) {
      errors.push('Contact number must be 11 digits');
    } else if (!formData.contactNumber.startsWith('09')) {
      errors.push('Contact number must start with 09');
    }

    if (!formData.contactEmail) {
      errors.push('Email address is required');
    } else if (!formData.contactEmail.includes('@')) {
      errors.push('Please enter a valid email address');
    }

    return errors;
  };

  // ── Auto Suggest: helpers & logic ─────────────────────────────────────────

  // Build every calendar date between start and end (inclusive)
  const buildDateRange = (start: Date, end: Date): Date[] => {
    const result: Date[] = [];
    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    const fin = new Date(end);   fin.setHours(0, 0, 0, 0);
    while (cur <= fin) { result.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return result;
  };

  // Returns which of the given dates have a time-overlap conflict for locationName
  // against the list of all events fetched from the API.
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
    const selEnd   = selEndTime   ? toMin(selEndTime)   : null;

    return datesToCheck
      .filter((d) => {
        const dayStr = d.toDateString();
        return allEvents.some((ev) => {
          if (ev.status !== 'approved' && ev.status !== 'submitted') return false;
          // Location conflict check (uses existing locationsConflict function)
          const evLocs =
            ev.locations && Array.isArray(ev.locations) && ev.locations.length > 0
              ? ev.locations : [ev.location];
          if (!evLocs.some((l: string) => locationsConflict(l, locationName))) return false;

          // Find which time block this event occupies on `d`
          let evStart: string | null = null;
          let evEnd:   string | null = null;
          const mainDay = ev.startDate ? new Date(ev.startDate).toDateString() : '';
          if (mainDay === dayStr) {
            evStart = ev.startTime || null;
            evEnd   = ev.endTime   || null;
          } else if (Array.isArray(ev.dateTimeSlots)) {
            const slot = ev.dateTimeSlots.find(
              (s: any) => s.startDate && new Date(s.startDate).toDateString() === dayStr
            );
            if (slot) { evStart = slot.startTime || null; evEnd = slot.endTime || null; }
          }

          // If we have time info on both sides → time-overlap check
          if (selStart !== null && selEnd !== null && evStart && evEnd) {
            return selStart < toMin(evEnd) && selEnd > toMin(evStart);
          }
          // No time info → date-level block
          return !!evStart || mainDay === dayStr;
        });
      })
      .map((d) => d.toDateString());
  };

  // Fetch events from API then build suggestion list with booking status.
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

      // Fetch all location-requirements docs once
      const locReqRes = await fetch(`${API_BASE_URL}/location-requirements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allLocReqs: any[] = locReqRes.ok ? await locReqRes.json() : [];

      // Fetch all events once (for booking conflict checks)
      const evRes = await fetch(`${API_BASE_URL}/events`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const allEvents: any[] = evRes.ok ? (await evRes.json()).data || [] : [];

      const dateRange = buildDateRange(autoSuggestStartDate, autoSuggestEndDate);

      // Venue max-capacity overrides — for venues whose physical capacity exceeds
      // the default equipment quantity in requirements (e.g. BPC has ~750 default
      // chairs on-hand but can physically seat up to 5 000 pax).
      const VENUE_MAX_CAPACITY: Record<string, number> = {
        "Bataan People's Center": 5000,
      };

      // Helper: extract TOTAL chair count for a location by summing ALL
      // chair-type requirements (e.g. Monoblock chairs + Tiffany chairs + Chairs).
      // Returns { total, capacity, breakdown }
      //   total    — actual default chairs from requirements doc
      //   capacity — max pax the venue can hold (may be larger than total due to override)
      //   breakdown — human-readable note shown on the venue card
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
        // Sum ALL requirements whose name contains "chair" (Monoblock, Tiffany, plain Chairs...)
        const chairReqs = best.requirements.filter(
          (r: any) => typeof r.name === 'string' && /chair/i.test(r.name)
        );
        if (chairReqs.length === 0) {
          return { total: maxCapacityOverride ?? 0, capacity: maxCapacityOverride ?? 0, breakdown: '' };
        }
        const total = chairReqs.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
        // capacity = max of actual chairs OR the venue override (e.g. BPC can seat 5000 even if only 750 chairs are default)
        const capacity = maxCapacityOverride ? Math.max(total, maxCapacityOverride) : total;
        // Show breakdown only when there are multiple chair types (e.g. Pavilion)
        const breakdown = chairReqs.length > 1
          ? chairReqs.map((r: any) => `${Number(r.quantity)} ${r.name}`).join(' + ')
          : '';
        return { total, capacity, breakdown };
      };

      // ── Shared Pavilion pool ───────────────────────────────────────────────
      // ALL Pavilion locations (Kalayaan Entire + all Kagitingan sections) draw
      // from a single shared inventory pool of chairs/tables.
      // Find the overall Pavilion requirements doc — it should cover all Pavilion
      // location names (or at minimum the Kagitingan sections + Kalayaan).
      const ALL_PAVILION_LOCATIONS = [
        'Pavilion - Kagitingan Hall - Section A',
        'Pavilion - Kagitingan Hall - Section B',
        'Pavilion - Kagitingan Hall - Section C',
        'Pavilion - Kalayaan Ballroom',
      ];

      const pavilionOverallDoc = allLocReqs.find((doc: any) => {
        if (!doc.locationNames || !Array.isArray(doc.locationNames)) return false;
        // A doc that covers ALL Pavilion locations (the master pool doc)
        return ALL_PAVILION_LOCATIONS.every((l) => doc.locationNames.includes(l));
      }) || allLocReqs.find((doc: any) => {
        // Fallback: a doc that covers at least the 3 Kagitingan sections
        if (!doc.locationNames || !Array.isArray(doc.locationNames)) return false;
        const KAGITINGAN_SECTIONS = [
          'Pavilion - Kagitingan Hall - Section A',
          'Pavilion - Kagitingan Hall - Section B',
          'Pavilion - Kagitingan Hall - Section C',
        ];
        return KAGITINGAN_SECTIONS.every((s) => doc.locationNames.includes(s));
      });

      // Total shared chair pool
      const pavilionPoolChairs = (() => {
        if (!pavilionOverallDoc || !Array.isArray(pavilionOverallDoc.requirements)) return 0;
        const chairReqs = pavilionOverallDoc.requirements.filter(
          (r: any) => typeof r.name === 'string' && /chair/i.test(r.name)
        );
        return chairReqs.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
      })();

      // How many chairs are already consumed by ANY approved/submitted Pavilion booking on a given day
      const getPavilionChairsBookedOnDate = (dayStr: string): number => {
        let booked = 0;
        allEvents.forEach((ev: any) => {
          if (ev.status !== 'approved' && ev.status !== 'submitted') return;
          const evLocs: string[] =
            ev.locations && Array.isArray(ev.locations) && ev.locations.length > 0
              ? ev.locations : [ev.location || ''];
          // Any Pavilion location counts against the shared pool
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

      // Remaining shared pool across the full date range (worst day = minimum)
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

      // 1) All PGB non-conference, non-Kagitingan-section locations.
      // For Pavilion locations: use the shared remaining pool instead of the raw default count.
      // Skip Kagitingan sections (handled in step 3) and Kalayaan sections A/B/C (Entire-only).
      locationData.filter((l) => !l.isCustom).forEach((loc) => {
        if (/4th Flr\. Conference Room/.test(loc.name)) return;
        if (/Pavilion.*Kagitingan.*Section [ABC]$/i.test(loc.name)) return;
        if (/Pavilion.*Kalayaan.*Section [ABC]$/i.test(loc.name)) return;

        const isPavilionLoc = /Pavilion/i.test(loc.name);

        let chairs: number;
        let breakdown: string;
        if (isPavilionLoc) {
          // Use shared remaining pool for all Pavilion locations (Kalayaan Entire, Kagitingan Entire, etc.)
          chairs = pavilionRemainingChairs;
          breakdown = pavilionRemainingChairs < pavilionPoolChairs
            ? `${pavilionRemainingChairs} of ${pavilionPoolChairs} chairs available (shared pool)`
            : '';
        } else {
          const extracted = extractChairs(loc.name);
          // Use capacity (may be higher than total due to venue override e.g. BPC = 5000)
          // for filtering, but show total chairs + a capacity note on the card.
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
          loc.name, dateRange, allEvents, autoSuggestStartTime, autoSuggestEndTime
        );
        results.push({
          name: loc.name, chairs, isMulti: false, rooms: [loc.name],
          note: breakdown || undefined,
          isBooked: bookedOnDates.length > 0, bookedOnDates,
        });
      });

      // 2) Conference room combos — additive chairs per room from API
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
      // Chairs come from the SAME shared Pavilion pool as Kalayaan — already computed
      // above as `pavilionRemainingChairs`. We just need section-level booking checks
      // (to mark a specific section as "Booked" if the slot is taken) and filter by
      // the remaining shared pool vs. participant count.
      // Kalayaan has no sections — it is Entire-only and already handled in step 1.
      if (pavilionPoolChairs > 0) {
        const KAGITINGAN_SECTIONS = [
          'Pavilion - Kagitingan Hall - Section A',
          'Pavilion - Kagitingan Hall - Section B',
          'Pavilion - Kagitingan Hall - Section C',
        ];

        // Always show Kagitingan sections so users can book even if chairs are full / 0
        {
          for (let mask = 1; mask < (1 << KAGITINGAN_SECTIONS.length); mask++) {
            const combo: string[] = [];
            KAGITINGAN_SECTIONS.forEach((s, i) => { if (mask & (1 << i)) combo.push(s); });

            // Section booking check: is any section in this combo already time-blocked?
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

            // Approximate seat ranges for Kagitingan sections
            const sectionCount = combo.length;
            let seatsLabel: string;
            if (sectionCount === 1) {
              seatsLabel = 'approx 50–100 seats';
            } else if (sectionCount === 2) {
              seatsLabel = 'approx 100–200 seats';
            } else {
              seatsLabel = 'approx 150–300 seats';
            }

            results.push({
              name: label,
              chairs: pavilionRemainingChairs,
              isMulti: combo.length > 1,
              rooms: combo,
              seatsLabel,
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
    } catch {
      toast.error('Failed to check venue availability. Please try again.');
    } finally {
      setLoadingAutoSuggest(false);
    }
  };

  // Apply chosen suggestion -> pre-fills location + schedule -> opens Schedule Modal
  const applyAutoSuggestion = async (sug: AutoSuggestedLocation) => {
    if (!formData.eventType) { setShowEventTypeAlert(true); return; }
    setSelectedSuggestion(sug.name);
    setShowAutoSuggestModal(false);

    const isKagitinganCombo = sug.rooms.every((r) => /Pavilion.*Kagitingan.*Section [ABC]$/i.test(r));

    let primaryLocation: string;
    if (isKagitinganCombo) {
      // All three sections -> use Entire; otherwise first section directly
      primaryLocation = sug.rooms.length === 3
        ? 'Pavilion - Kagitingan Hall (Entire)'
        : sug.rooms[0];
    } else {
      primaryLocation = sug.isMulti && sug.rooms.length === 3
        ? '4th Flr. Conference Room (Entire)' : sug.rooms[0];
    }

    // Populate the participants field in Step 1 with the value entered in auto-suggest
    if (autoSuggestParticipants) {
      handleInputChange("participants", autoSuggestParticipants);
    }

    await handleLocationChange(
      primaryLocation,
      autoSuggestParticipants ? parseInt(autoSuggestParticipants) || 0 : undefined,
      autoSuggestStartDate ?? undefined,
      autoSuggestEndDate ?? undefined
    );

    // For multi-room combos (2 or more rooms) override the locations array and fetch requirements dynamically
    if (sug.isMulti && sug.rooms.length >= 2) {
      setTimeout(async () => {
        const combinedLocStr = sug.rooms.join(' + ');
        handleInputChange('locations', sug.rooms);
        handleInputChange('multipleLocations', true);
        try {
          const locationData = await fetchLocationRequirements(combinedLocStr);
          if (locationData && locationData.requirements && locationData.requirements.length > 0) {
            setLocationRequirements(locationData.requirements);
            setSelectedLocation(combinedLocStr);
          }
        } catch (error) {
          console.error('Error fetching combined requirements for auto-suggest:', error);
        }
      }, 50);
    }

    if (autoSuggestStartDate) {
      const endD = autoSuggestEndDate ?? autoSuggestStartDate;
      setTimeout(() => {
        handleInputChange('startDate', autoSuggestStartDate);
        handleInputChange('endDate', endD);
        if (autoSuggestStartTime) handleInputChange('startTime', autoSuggestStartTime);
        if (autoSuggestEndTime)   handleInputChange('endTime',   autoSuggestEndTime);

        // Build dateTimeSlots for multi-day events
        if (endD.getTime() !== autoSuggestStartDate.getTime() && autoSuggestStartTime && autoSuggestEndTime) {
          const slots: DateTimeSlot[] = [];
          const cur = new Date(autoSuggestStartDate);
          cur.setDate(cur.getDate() + 1);
          while (cur <= endD) {
            slots.push({ id: `auto-${cur.getTime()}`, date: new Date(cur),
              startTime: autoSuggestStartTime, endTime: autoSuggestEndTime });
            cur.setDate(cur.getDate() + 1);
          }
          handleInputChange('dateTimeSlots', slots);
        }
        // Show requirements modal first (if location has requirements), then schedule modal.
        // The requirements modal's "Continue" button already opens the schedule modal.
        setShowLocationRequirementsModal(true);
      }, 120);
    } else {
      // No dates pre-filled — go straight to requirements then schedule
      setShowLocationRequirementsModal(true);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Request Event</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Create a new event request</p>
        </div>
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          Step {currentStep} of {steps.length}
        </Badge>
      </motion.div>

      {/* Modern Progress Stepper */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-3 md:p-4 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max md:min-w-0">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep ||
                (step.id === 2 && isAttachmentsCompleted) ||
                (step.id === 5 && formData.startDate && formData.startTime && formData.endDate && formData.endTime &&
                  formData.contactNumber && formData.contactEmail &&
                  formData.contactNumber.length === 11 && formData.contactEmail.includes('@')) ||
                (step.id === 6 && isFormReadyToSubmit());

              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all flex-shrink-0 ${isCompleted
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : isActive
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                    <div className="hidden sm:block">
                      <p className={`text-sm font-medium ${isCompleted ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-gray-500'
                        }`}>
                        {step.title}
                      </p>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="flex-1 mx-2 md:mx-4 min-w-[20px] md:min-w-[40px]">
                      <div className="h-px bg-gray-200 relative">
                        <motion.div
                          className="h-full bg-green-400"
                          initial={{ width: '0%' }}
                          animate={{ width: step.id < currentStep ? '100%' : '0%' }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Step 1: Event Details */}
      {currentStep === 1 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6"
        >
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="p-4 md:p-6 pb-3 md:pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Event Information
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">Event Type:</span>
                    <div className="flex border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, eventType: 'simple-meeting' }));
                          setLocationMode('auto-suggest');
                          setShowAutoSuggestModal(true);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${formData.eventType === 'simple-meeting'
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        Simple Meeting
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, eventType: 'simple' }));
                          setLocationMode('auto-suggest');
                          setShowAutoSuggestModal(true);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${formData.eventType === 'simple'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        Simple Event
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, eventType: 'complex' }));
                          setLocationMode('auto-suggest');
                          setShowAutoSuggestModal(true);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${formData.eventType === 'complex'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        Complex Event
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                {/* Row 1: Title */}
                <div>
                  <Label htmlFor="eventTitle" className="text-sm font-medium">Event Title <span className="text-red-500">*</span></Label>
                  <Input
                    id="eventTitle"
                    placeholder="Enter event title"
                    value={formData.eventTitle}
                    onChange={(e) => handleInputChange('eventTitle', e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Row 2: Requestor & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="requestor" className="text-sm font-medium">Requestor <span className="text-red-500">*</span></Label>
                    <Input
                      id="requestor"
                      placeholder="Enter requestor name"
                      value={formData.requestor}
                      onChange={(e) => handleInputChange('requestor', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    {/* Location label — clean, no toggle here */}
                    <Label htmlFor="location" className="text-sm font-medium">
                      Location <span className="text-red-500">*</span>
                    </Label>

                    {/* Custom location match hint - COMMENTED OUT */}
                    {/* {showCustomLocation && formData.location.trim() && locations.filter(loc =>
                        loc.toLowerCase().includes(formData.location.trim().toLowerCase()) &&
                        loc !== 'Add Custom Location'
                      ).length > 0 && (
                        <div className="flex items-center gap-1.5 text-amber-600 text-xs mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Found {locations.filter(loc =>
                            loc.toLowerCase().includes(formData.location.trim().toLowerCase()) &&
                            loc !== 'Add Custom Location'
                          ).length} matching location(s). Click to select:</span>
                        </div>
                      )} */}

                    {/* Custom location input - COMMENTED OUT to force Auto Suggest */}
                    {/* {!showCustomLocation ? ( */}
                      <div className="flex gap-2">
                        {/* Location dropdown - COMMENTED OUT, replaced with Auto Suggest button */}
                        {/* <Select
                          value={formData.location}
                          onValueChange={handleLocationChange}
                        >
                          <SelectTrigger className="mt-1 h-9 flex-1 max-w-[calc(100%-3rem)]">
                            <div className="truncate w-full text-left">
                              <SelectValue placeholder="Select location" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {(() => {
                              const pgbLocs = locationData.filter(loc => !loc.isCustom);
                              const customLocs = locationData.filter(loc => loc.isCustom);

                              return (
                                <>
                                  {pgbLocs.length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                        PGB Locations
                                      </div>
                                      {pgbLocs.map((location) => {
                                        const isKagitinganSection = /Pavilion - Kagitingan Hall - Section [ABC]$/.test(location.name);
                                        return (
                                        <SelectItem
                                          key={location.name}
                                          value={location.name}
                                        >
                                          <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-blue-500" />
                                            {location.name}
                                            {isKagitinganSection && (
                                              <span className="text-[10px] text-gray-400 ml-1 whitespace-nowrap">~50–100 seats</span>
                                            )}
                                          </div>
                                        </SelectItem>
                                        );
                                      })}
                                    </>
                                  )}

                                  {customLocs.length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">
                                        Custom Locations
                                      </div>
                                      {customLocs.map((location) => (
                                        <SelectItem
                                          key={location.name}
                                          value={location.name}
                                        >
                                          <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-purple-500" />
                                            {location.name}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </>
                                  )}

                                  <SelectItem
                                    value="Add Custom Location"
                                    className="text-blue-600 font-medium mt-1 border-t"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Plus className="w-3 h-3" />
                                      Add Custom Location
                                    </div>
                                  </SelectItem>
                                </>
                              );
                            })()}
                          </SelectContent>
                        </Select> */}
                        
                        {/* Auto Suggest Button - Replaces the dropdown */}
                        <Button
                          type="button"
                          onClick={() => {
                            if (!checkEventTypeSelected()) return;
                            setLocationMode('auto-suggest');
                            setShowAutoSuggestModal(true);
                          }}
                          variant="outline"
                          className="mt-1 h-9 flex-1 justify-start text-left font-normal"
                        >
                          {formData.location ? (
                            <div className="flex items-center gap-2 truncate w-full">
                              <MapPin className="w-4 h-4 text-violet-500 shrink-0" />
                              <span className="truncate">{formData.location}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-500">
                              <Wand2 className="w-4 h-4 shrink-0" />
                              <span>Click to use Auto Suggest</span>
                            </div>
                          )}
                        </Button>
                        
                        {formData.location && formData.location !== 'Add Custom Location' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLocation(formData.location);
                              setShowScheduleModal(true);
                            }}
                            className="mt-1 h-9 px-3"
                            title="Edit schedule"
                          >
                            <CalendarIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    {/* ) : ( */}
                      {/* Custom location input section - COMMENTED OUT */}
                      {/* <div className="relative">
                        <Input
                          placeholder="Enter custom location"
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          className="mt-1"
                        />
                        {formData.location.trim() && locations.filter(loc =>
                          loc.toLowerCase().includes(formData.location.trim().toLowerCase()) &&
                          loc !== 'Add Custom Location'
                        ).length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-0.5 z-50">
                              <div className="border rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg">
                                {locations
                                  .filter(loc =>
                                    loc.toLowerCase().includes(formData.location.trim().toLowerCase()) &&
                                    loc !== 'Add Custom Location'
                                  )
                                  .map((location) => (
                                    <button
                                      key={location}
                                      type="button"
                                      onClick={async () => {
                                        await handleLocationChange(location);
                                        setShowCustomLocation(false);
                                        toast.success(`Selected: ${location}`);
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-b-0 flex items-center gap-2 text-sm transition-colors"
                                    >
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      <span className="font-medium">{location}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowCustomLocation(false);
                              handleInputChange('location', '');
                            }}
                            className="text-xs"
                          >
                            Choose from list instead
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const trimmedLocation = formData.location.trim();

                              const locationExists = locations.some(loc =>
                                loc.toLowerCase() === trimmedLocation.toLowerCase() &&
                                loc !== 'Add Custom Location'
                              );

                              if (!trimmedLocation) {
                                toast.error('Please enter a custom location first');
                              } else if (locationExists) {
                                toast.error('This location already exists! Please select it from the dropdown instead.');
                              } else {
                                setShowScheduleModal(true);
                              }
                            }}
                            className="text-xs"
                            disabled={!formData.location.trim() || locations.some(loc =>
                              loc.toLowerCase() === formData.location.trim().toLowerCase() &&
                              loc !== 'Add Custom Location'
                            )}
                          >
                            Save & Check Schedule
                          </Button>
                        </div>
                      </div> */}
                    {/* )} */}

                    {/* ── Manual / Auto Suggest toggle — below the dropdown ── */}
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Manual button - COMMENTED OUT to force users to use Auto Suggest */}
                        {/* <button
                          type="button"
                          onClick={() => {
                            setLocationMode('manual');
                            setShowSuggestions(false);
                            setSuggestedLocations([]);
                            setSelectedSuggestion(null);
                          }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all select-none font-medium ${
                            locationMode === 'manual'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          Manual
                        </button> */}

                        {/* OR divider - COMMENTED OUT since Manual button is hidden */}
                        {/* <div className="flex items-center gap-1.5">
                          <div className="h-px w-4 bg-gray-200" />
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">or</span>
                          <div className="h-px w-4 bg-gray-200" />
                        </div> */}

                        {/* Auto Suggest button - Now the only option */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!checkEventTypeSelected()) return;
                            setLocationMode('auto-suggest');
                            setShowAutoSuggestModal(true);
                          }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all select-none font-medium ${
                            locationMode === 'auto-suggest'
                              ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                          }`}
                        >
                          <Wand2 className="w-3 h-3" />
                          Auto Suggest
                        </button>
                        
                        {/* OR divider */}
                        <div className="flex items-center gap-1.5">
                          <div className="h-px w-4 bg-gray-200" />
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">or</span>
                          <div className="h-px w-4 bg-gray-200" />
                        </div>
                        
                        {/* Outside PGB button */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomLocation(true);
                            handleInputChange('location', '');
                            handleInputChange('locations', []);
                          }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all select-none font-medium bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                        >
                          <MapPin className="w-3 h-3" />
                          Outside PGB
                        </button>
                      </div>

                      {/* Auto-suggest selected badge */}
                      {locationMode === 'auto-suggest' && selectedSuggestion && !showCustomLocation && (
                        <div className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 w-fit max-w-full">
                          <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                          <span className="text-xs text-violet-800 font-medium truncate">{selectedSuggestion}</span>
                          <button
                            type="button"
                            onClick={() => setShowAutoSuggestModal(true)}
                            className="shrink-0 text-[11px] font-medium text-violet-600 hover:text-violet-800 hover:underline whitespace-nowrap ml-1"
                          >
                            Change
                          </button>
                        </div>
                      )}
                      
                      {/* Outside PGB input */}
                      {showCustomLocation && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-orange-800 text-xs font-medium">
                            <MapPin className="w-4 h-4" />
                            Enter location outside PGB
                          </div>
                          <Input
                            placeholder="Enter location (e.g., SM City Bataan, Limay Municipal Hall)"
                            value={formData.location}
                            onChange={(e) => handleInputChange('location', e.target.value)}
                            className="bg-white"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowCustomLocation(false);
                                handleInputChange('location', '');
                              }}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => {
                                const trimmedLocation = formData.location.trim();
                                if (!trimmedLocation) {
                                  toast.error('Please enter a location first');
                                } else {
                                  setShowScheduleModal(true);
                                }
                              }}
                              className="text-xs bg-orange-600 hover:bg-orange-700"
                              disabled={!formData.location.trim()}
                            >
                              Save & Continue
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 3: Participants / VIP / VVIP / Governor, with optional Room Type row below */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="participants" className="text-sm font-medium">Participants <span className="text-red-500">*</span></Label>
                    <Input
                      id="participants"
                      type="number"
                      placeholder="0"
                      min="0"
                      value={formData.participants}
                      onChange={(e) => handleInputChange('participants', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vip" className="text-sm font-medium">VIP (Local)</Label>
                    <Input
                      id="vip"
                      type="number"
                      placeholder="0"
                      min="0"
                      value={formData.vip}
                      onChange={(e) => handleInputChange('vip', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vvip" className="text-sm font-medium">VVIP (Foreign)</Label>
                    <Input
                      id="vvip"
                      type="number"
                      placeholder="0"
                      min="0"
                      value={formData.vvip}
                      onChange={(e) => handleInputChange('vvip', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex flex-col justify-between">
                    <div>
                      <Label htmlFor="withoutGovernor" className="text-sm font-medium">w/o Governor</Label>
                    </div>
                    <div className="mt-1 h-10 flex items-center border border-input rounded-md px-3 bg-background">
                      <Switch
                        id="withoutGov"
                        checked={formData.withoutGov}
                        onCheckedChange={handleWithoutGovChange}
                      />
                    </div>
                  </div>
                  {locationRoomTypes.length > 0 && (
                    <div className="md:col-span-4">
                      <Label htmlFor="roomType" className="text-sm font-medium">Room Type</Label>
                      <Select
                        value={formData.roomType || ''}
                        onValueChange={(value) => handleInputChange('roomType', value)}
                      >
                        <SelectTrigger id="roomType" className="mt-1">
                          <SelectValue placeholder="Select room type" />
                        </SelectTrigger>
                        <SelectContent>
                          {locationRoomTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Description <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="description"
                    placeholder="Enter event description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="mt-1 h-20"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Attachments Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-blue-600" />
                  Attachments {formData.eventType === 'simple-meeting' && formData.withoutGov && <span className="text-red-500">*</span>}
                  {formData.eventType !== 'simple-meeting' && <span className="text-red-500">*</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-2">
                  {formData.eventType === 'simple-meeting' ? (
                    formData.withoutGov ? (
                      <p className="text-sm text-gray-600">📎 <strong>Attachments are required</strong> - w/ Governor is enabled</p>
                    ) : (
                      <p className="text-sm text-gray-500">📎 Attachments are optional for Simple Meeting without Governor</p>
                    )
                  ) : (
                    <p className="text-sm text-gray-600">📎 <strong>Attachments are required</strong> - Please upload at least one file</p>
                  )}
                </div>

                {
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-gray-300 transition-colors">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-600 mb-2">Drop files or click to upload</p>
                      <p className="text-xs text-gray-400 mb-3">PDF, DOC, JPG, PNG (max 10MB)</p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="fileUpload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('fileUpload')?.click()}
                      >
                        Choose Files
                      </Button>
                    </div>

                    {formData.attachments.length > 0 && (
                      <div className="space-y-2">
                        {formData.attachments.map((file, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <span className="font-medium truncate">{file.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-5 w-5 p-0 flex-shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                }
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant="secondary" className="text-xs">Draft</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-medium">{getCompletedStepsCount()}/{steps.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Step 3: Tag Departments */}
      {currentStep === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Tag Departments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Simple Meeting - No Departments Option */}
                {formData.eventType === 'simple-meeting' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="noDepartmentsNeeded"
                        checked={noDepartmentsNeeded}
                        onCheckedChange={(checked) => {
                          handleNoDepartmentsNeededChange(checked as boolean);
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="noDepartmentsNeeded" className="text-sm font-medium text-green-900 cursor-pointer">
                          No departments needed for this simple meeting
                        </Label>
                        <p className="text-xs text-green-700 mt-1">
                          Check this if your simple meeting doesn't require any department support or resources.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Location PGSO Acknowledgment - Auto-checked */}
                {isCustomLocationSelected && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="pgsoCustomLocationAck"
                        checked={true}
                        disabled={true}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="pgsoCustomLocationAck" className="text-sm font-medium text-green-900">
                          ✓ Custom location acknowledged
                        </Label>
                        <p className="text-xs text-green-700 mt-1">
                          Since you selected a custom location (Outside PGB), please contact PGSO directly for any requirements needed at this venue.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* PGSO Chairs Availability & Bypass Banner */}
                {formData.taggedDepartments.some((d) => d.toLowerCase().includes('pgso')) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-sm font-semibold text-amber-900">
                          PGSO Chairs & Equipment Support
                        </Label>
                        <p className="text-xs text-amber-800 mt-1">
                          If PGSO chairs or equipment are already full for your selected date/venue, you can proceed without PGSO chairs. PMO will follow up directly on this event.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        type="button"
                        variant={formData.proceedWithoutPgsoChairs ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const nextVal = !formData.proceedWithoutPgsoChairs;
                          handleInputChange('proceedWithoutPgsoChairs', nextVal);
                          if (nextVal) {
                            toast.success('Set to proceed without PGSO chairs. PMO will follow up on this event directly.');
                          }
                        }}
                        className={formData.proceedWithoutPgsoChairs
                          ? "bg-amber-600 hover:bg-amber-700 text-white gap-1.5 font-medium"
                          : "border-amber-400 text-amber-900 hover:bg-amber-100 gap-1.5 font-medium"
                        }
                      >
                        {formData.proceedWithoutPgsoChairs ? "✓ Proceeding Without PGSO Chairs" : "Proceed Without PGSO Chairs"}
                      </Button>
                      {formData.proceedWithoutPgsoChairs && (
                        <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
                          (PMO will follow up directly)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Search Input */}
                <div>
                  <Label htmlFor="departmentSearch" className="text-sm font-medium">Search Departments</Label>
                  <Input
                    id="departmentSearch"
                    placeholder="Search for departments..."
                    value={departmentSearch}
                    onChange={(e) => setDepartmentSearch(e.target.value)}
                    className="mt-1"
                    disabled={noDepartmentsNeeded}
                  />
                </div>

                {/* Departments List */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Select Departments to Tag</Label>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-2 border rounded-lg ${noDepartmentsNeeded ? 'opacity-50 pointer-events-none' : ''
                    }`}>
                    {loading ? (
                      <div className="col-span-2 flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-500">Loading departments...</span>
                      </div>
                    ) : filteredDepartments.map((department) => (
                      <motion.div
                        key={department._id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded transition-colors"
                      >
                        <Checkbox
                          id={department._id}
                          checked={formData.taggedDepartments.includes(department.name)}
                          onCheckedChange={() => handleDepartmentToggle(department.name)}
                        />
                        <Label
                          htmlFor={department._id}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {department.name}
                        </Label>
                      </motion.div>
                    ))}
                  </div>

                  {!loading && filteredDepartments.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No departments found matching your search.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Departments */}
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-900">Selected Departments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {formData.taggedDepartments.length > 0 ? (
                  <div className={`space-y-2 ${formData.taggedDepartments.length >= 3 ? 'max-h-64 overflow-y-auto pr-2' : ''}`}>
                    {formData.taggedDepartments.map((dept) => {
                      const deptRequirements = formData.departmentRequirements[dept]?.filter(req => req.selected) || [];
                      const notesCount = deptRequirements.filter(req => req.notes && req.notes.trim()).length;
                      const zeroAvailabilityCount = deptRequirements.filter(req => 
                        req.type === 'physical' && req.totalQuantity != null && req.totalQuantity <= 0
                      ).length;

                      return (
                        <motion.div
                          key={dept}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="p-3 rounded-lg border border-gray-200 bg-white flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">{dept}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDepartmentToggle(dept)}
                                  className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-gray-100"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>

                              {deptRequirements.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs text-gray-600 flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-gray-500" />
                                    <span className="font-medium">{deptRequirements.length} requirement(s)</span>
                                    {notesCount > 0 && (
                                      <span className="text-gray-500">• {notesCount} with notes</span>
                                    )}
                                    {zeroAvailabilityCount > 0 && (
                                      <span className="text-red-600 font-medium flex items-center gap-1">
                                        • <AlertTriangle className="w-3 h-3" /> {zeroAvailabilityCount} with 0 qty
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    {deptRequirements.slice(0, 3).map((req) => {
                                      const hasZeroQuantity = req.type === 'physical' && 
                                                             req.totalQuantity != null && 
                                                             req.totalQuantity <= 0;
                                      
                                      return (
                                      <div
                                        key={req.id}
                                        className={`text-xs p-2 rounded-md border ${
                                          hasZeroQuantity 
                                            ? 'bg-red-50 text-red-900 border-red-300' 
                                            : 'bg-gray-50 text-gray-800 border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium">{req.name}</span>
                                          <div className="flex items-center gap-1">
                                            {hasZeroQuantity && (
                                              <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                <Ban className="w-2.5 h-2.5" />
                                                0 Available
                                              </span>
                                            )}
                                            {req.type && (
                                              <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                {req.type === 'physical' ? (
                                                  <Package className="w-2.5 h-2.5" />
                                                ) : req.type === 'yesno' ? (
                                                  <CheckSquare className="w-2.5 h-2.5" />
                                                ) : (
                                                  <Settings className="w-2.5 h-2.5" />
                                                )}
                                                <span className="capitalize">{req.type}</span>
                                              </span>
                                            )}
                                            {req.notes && req.notes.trim() && (
                                              <StickyNote className="w-3 h-3 text-gray-500" />
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                          {req.isCustom ? (
                                            <>
                                              <span>
                                                {req.type === 'physical' && req.quantity
                                                  ? `Quantity: ${req.quantity}`
                                                  : req.notes && req.notes.trim()
                                                    ? `Notes: ${req.notes.substring(0, 20)}${req.notes.length > 20 ? '...' : ''}`
                                                    : 'Custom requirement'}
                                              </span>
                                              <span className="flex items-center gap-1 text-orange-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                                Pending Validation
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <span>
                                                {req.type === 'physical' && req.quantity
                                                  ? `Requested: ${req.quantity}${req.totalQuantity !== undefined ? ` of ${req.totalQuantity}` : ''}`
                                                  : req.type === 'yesno' && req.yesNoAnswer
                                                    ? `Answer: ${req.yesNoAnswer === 'yes' ? '✓ Yes' : '✗ No'}`
                                                    : `Available: ${req.totalQuantity !== undefined ? req.totalQuantity : 'N/A'}`}
                                              </span>
                                              <span className={`flex items-center gap-1 ${
                                                hasZeroQuantity ? 'text-red-700 font-bold' :
                                                req.isAvailable ? 'text-emerald-700' : 'text-red-700'
                                              }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${
                                                  hasZeroQuantity ? 'bg-red-600' :
                                                  req.isAvailable ? 'bg-emerald-500' : 'bg-red-500'
                                                }`}></div>
                                                {hasZeroQuantity ? '0 Qty' : req.isAvailable ? 'Available' : 'Unavailable'}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        {hasZeroQuantity && (
                                          <div className="text-[10px] text-red-700 mt-1 font-medium">
                                            ⚠️ This item will be removed when you continue to schedule
                                          </div>
                                        )}
                                        {req.responsiblePerson && (
                                          <div className="text-[11px] text-gray-500 mt-1">
                                            Contact: {req.responsiblePerson}
                                          </div>
                                        )}
                                      </div>
                                    );
                                    })}
                                    {deptRequirements.length > 3 && (
                                      <div className="text-[11px] text-gray-500 text-center py-1">
                                        +{deptRequirements.length - 3} more requirement(s)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No departments selected yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant="secondary" className="text-xs">Draft</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-medium">{getCompletedStepsCount()}/{steps.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Step 5: Schedule & Contact Details */}
      {currentStep === 5 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Schedule Card - Display Only */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-blue-600" />
                      Event Schedule
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduleModal(true)}
                      className="text-xs flex items-center gap-1"
                    >
                      <CalendarIcon className="w-3 h-3" />
                      Edit Schedule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Schedule Display */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="text-sm text-gray-600 mb-3">
                      Schedule based on your location preferences
                    </div>

                    {formData.startDate && formData.startTime ? (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">Start</div>
                          <div className="text-sm text-gray-600">
                            {format(formData.startDate, "EEEE, MMMM dd, yyyy")} at {formatTime(formData.startTime)}
                          </div>
                          {formData.locations && formData.locations.length > 0 ? (
                            <div className="text-xs text-blue-600 mt-1 space-y-1">
                              {formData.locations.map((loc, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {loc}
                                </div>
                              ))}
                            </div>
                          ) : formData.location && (
                            <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {formData.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">Start Date & Time</div>
                          <div className="text-sm text-gray-400">Not selected yet</div>
                        </div>
                      </div>
                    )}

                    {formData.endDate && formData.endTime ? (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">End</div>
                          <div className="text-sm text-gray-600">
                            {format(formData.endDate, "EEEE, MMMM dd, yyyy")} at {formatTime(formData.endTime)}
                          </div>
                          {formData.locations && formData.locations.length > 0 ? (
                            <div className="text-xs text-blue-600 mt-1 space-y-1">
                              {formData.locations.map((loc, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {loc}
                                </div>
                              ))}
                            </div>
                          ) : formData.location && (
                            <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {formData.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">End Date & Time</div>
                          <div className="text-sm text-gray-400">Not selected yet</div>
                        </div>
                      </div>
                    )}

                    {formData.startDate && formData.endDate && formData.startTime && formData.endTime && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          Duration: {calculateDuration(formData.startDate, formData.startTime, formData.endDate, formData.endTime)}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                    <Info className="w-3 h-3" />
                    Schedule is set from your location preferences
                  </div>
                </CardContent>
              </Card>

              {/* Contact Details Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-blue-600" />
                    Contact Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactNumber" className="text-sm font-medium">Contact Number *</Label>
                      <Input
                        id="contactNumber"
                        type="tel"
                        placeholder="09XXXXXXXXX (11 digits)"
                        value={formData.contactNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, ''); // Only numbers
                          if (value.length <= 11) {
                            handleInputChange('contactNumber', value);
                          }
                        }}
                        className="mt-1"
                        maxLength={11}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter 11-digit mobile number (e.g., 09123456789)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="contactEmail" className="text-sm font-medium">Email Address *</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="your.email@example.com"
                        value={formData.contactEmail}
                        onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant="secondary" className="text-xs">Draft</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-medium">{getCompletedStepsCount()}/{steps.length}</span>
                </div>
                <Separator />
                {formData.startDate && formData.startTime && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Start:</span>
                      <span className="font-medium text-xs">
                        {format(formData.startDate, "MMM dd")} at {formatTime(formData.startTime)}
                      </span>
                    </div>
                    <Separator />
                  </>
                )}
                {formData.endDate && formData.endTime && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">End:</span>
                      <span className="font-medium text-xs">
                        {format(formData.endDate, "MMM dd")} at {formatTime(formData.endTime)}
                      </span>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Departments:</span>
                  <span className="font-medium">{formData.taggedDepartments.length}</span>
                </div>
              </CardContent>
            </Card>

            {!isFormReadyToSubmit() && submitBlockers.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-red-900">Cannot submit yet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-xs text-red-700">
                    Fill out the following to enable Review &amp; Submit:
                  </p>
                  <div className="space-y-1">
                    {submitBlockers.map((reason) => (
                      <div key={reason} className="flex items-start gap-2 text-xs text-red-800">
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full mt-1" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </motion.div>
      )}

      {/* Step 3 Navigation */}
      {currentStep === 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-between pt-4"
        >
          <Button
            variant="outline"
            onClick={() => setCurrentStep(1)}
          >
            Previous
          </Button>
          <Button
            onClick={handleContinueToSchedule}
            disabled={
              // For custom locations: checkbox acknowledgment is the only gate.
              isCustomLocationSelected
                ? !pgsoCustomLocationAck
                : (
                  formData.eventType === 'simple-meeting'
                    ? !(noDepartmentsNeeded || (formData.taggedDepartments.length > 0 && hasRequirementsForDepartments()))
                    : (!formData.taggedDepartments.length || !hasRequirementsForDepartments())
                )
            }
            className="gap-2"
          >
            Continue to Schedule
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {/* Step 5 Navigation */}
      {currentStep === 5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-between pt-4"
        >
          <Button
            variant="outline"
            onClick={() => setCurrentStep(3)}
          >
            Previous
          </Button>
          <Button
            onClick={() => {
              setShowReviewModal(true);
              setReviewStep(1);
            }}
            disabled={!isFormReadyToSubmit() || isSubmitting}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <Send className="w-4 h-4" />
            Review & Submit
          </Button>
        </motion.div>
      )}

      {/* Navigation for other steps */}
      {currentStep !== 3 && currentStep !== 5 && (
        <>
          {/* Missing Fields Alert - Only show if fields are missing */}
          {(!formData.eventTitle || !formData.requestor || !formData.location || !formData.participants || !formData.description || !isAttachmentsCompleted || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg"
            >
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-orange-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Missing Required Fields
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {!formData.eventTitle && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Event Title</span>
                    </div>
                  )}
                  {!formData.requestor && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Requestor</span>
                    </div>
                  )}
                  {!formData.location && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Location</span>
                    </div>
                  )}
                  {!formData.participants && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Participants</span>
                    </div>
                  )}
                  {!formData.description && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Description</span>
                    </div>
                  )}
                  {!isAttachmentsCompleted && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Attachments{formData.eventType === 'simple-meeting' && formData.withoutGov ? ' (required for w/ Gov)' : ''}</span>
                    </div>
                  )}
                  {!formData.startDate && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Start Date</span>
                    </div>
                  )}
                  {!formData.startTime && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>Start Time</span>
                    </div>
                  )}
                  {!formData.endDate && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>End Date</span>
                    </div>
                  )}
                  {!formData.endTime && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>End Time</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-between pt-4"
          >
            <Button variant="outline" disabled>
              Previous
            </Button>
            <Button
              onClick={handleContinueToTagDepartments}
              disabled={!formData.eventTitle || !formData.requestor || !formData.location || !formData.participants || !formData.description || !isAttachmentsCompleted || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime}
              className="gap-2"
            >
              Continue to Tag Departments
              <ChevronRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </>
      )}

      {/* Requirements Modal */}
      <Dialog
        key={`requirements-${selectedDepartment}-${requirementsRefreshKey}`}
        open={showRequirementsModal}
        onOpenChange={setShowRequirementsModal}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="text-lg font-medium">
                  Requirements - {selectedDepartment}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Select requirements for this department
                </DialogDescription>
                {!formData.startDate && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
                    ⚠️ No date selected - showing default quantities. Set schedule first for accurate availability.
                  </div>
                )}
                {formData.startDate && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-xs">
                    📅 Showing availability for {formData.startDate.toDateString()}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log(`\n🔄 === EDIT SCHEDULE BUTTON CLICKED ===`);
                  console.log(`📍 Current formData.location: ${formData.location}`);
                  console.log(`📍 Current selectedLocation: ${selectedLocation}`);
                  console.log(`🎯 Current showRequirementsModal: ${showRequirementsModal}`);
                  console.log(`🎯 Current showScheduleModal: ${showScheduleModal}`);

                  setShowRequirementsModal(false);
                  setShowScheduleModal(true);

                  console.log(`✅ Modals switched - Requirements: false, Schedule: true`);
                }}
                className="gap-2 ml-4"
              >
                <CalendarIcon className="w-4 h-4" />
                Edit Schedule
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Available Requirements */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Available Requirements</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loadingDepartmentRequirements ? (
                  // Skeleton loading state
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1">
                            <Skeleton className="w-4 h-4 rounded" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  formData.departmentRequirements[selectedDepartment]?.map((requirement) => {
                      const isPavilionZeroItem = pavilionZeroItems.includes(requirement.name);
                      // Check if requirement has 0 availability
                      const hasZeroQuantity = requirement.type === 'physical' && 
                                             requirement.totalQuantity != null && 
                                             requirement.totalQuantity <= 0;
                      const isDisabled = !requirement.isAvailable || isPavilionZeroItem || hasZeroQuantity;
                      
                      return (
                    <div
                      key={requirement.id}
                      className={`p-3 border rounded-lg transition-all ${isDisabled
                        ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                        : requirement.selected
                          ? 'bg-blue-50 border-blue-200 shadow-sm cursor-pointer'
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                        }`}
                      onClick={() => !isDisabled && handleRequirementToggle(requirement.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Checkbox
                              checked={requirement.selected}
                              disabled={isDisabled}
                              onChange={() => !isDisabled && handleRequirementToggle(requirement.id)}
                              className="mt-0.5"
                            />
                            <h5 className={`font-medium text-sm ${!isDisabled ? 'text-gray-900' : 'text-gray-400'
                              }`}>{requirement.name}</h5>
                            <Badge
                              variant={requirement.type === 'physical' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              <div className="flex items-center gap-1">
                                {requirement.type === 'physical' ? (
                                  <><Package className="w-3 h-3" /> Physical</>
                                ) : requirement.serviceType === 'yesno' ? (
                                  <><Settings className="w-3 h-3" /> Yes/No</>
                                ) : (
                                  <><Settings className="w-3 h-3" /> Service</>
                                )}
                              </div>
                            </Badge>
                            {requirement.serviceType === 'yesno' && requirement.yesNoAnswer && (
                              <Badge
                                variant="secondary"
                                className={`text-xs ${requirement.yesNoAnswer === 'yes' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                              >
                                {requirement.yesNoAnswer === 'yes' ? (
                                  <><Check className="w-3 h-3 mr-1" /> Yes</>
                                ) : (
                                  <><X className="w-3 h-3 mr-1" /> No</>
                                )}
                              </Badge>
                            )}
                            {/* Show a badge if requirement has 0 quantity */}
                            {hasZeroQuantity && (
                              <Badge variant="destructive" className="text-xs">
                                <div className="flex items-center gap-1">
                                  <Ban className="w-3 h-3" /> 0 Available
                                </div>
                              </Badge>
                            )}
                          </div>

                          {/* Conflict Warning - Only show if THIS requirement has conflicts AND it's NOT a custom requirement */}
                          {!requirement.isCustom && conflictingEvents.length > 0 && formData.startDate && formData.startTime &&
                            hasRequirementConflict(requirement, selectedDepartment) && (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                                <div className="flex items-center gap-2 text-orange-800 text-xs font-medium mb-1">
                                  <AlertTriangle className="w-4 h-4" />
                                  This Item is Already Booked
                                </div>
                                <div className="text-xs text-orange-700">
                                  {requirement.name} is requested by {conflictingEvents.length} overlapping event(s) on {formData.startDate.toDateString()} ({formatTime(formData.startTime)}-{formatTime(formData.endTime)})
                                </div>
                                <div className="text-xs text-orange-600 mt-1">
                                  Quantity shown is remaining after existing bookings
                                </div>
                              </div>
                            )}

                          <div className={`grid ${requirement.serviceType === 'yesno' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 text-xs text-gray-600`}>
                            {/* Quantity display: for custom physical show Requested Quantity, else Available Quantity */}
                            {requirement.serviceType !== 'yesno' && (
                              <div className="flex items-center gap-1">
                                {requirement.type === 'physical' && requirement.isCustom ? (
                                  <>
                                    <span className="font-medium">Requested Quantity:</span>
                                    <span className={requirement.quantity ? 'text-gray-900' : 'text-gray-400'}>
                                      {requirement.quantity || 'N/A'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium">Available Quantity:</span>
                                    {conflictingEvents.length > 0 && formData.startDate && formData.startTime &&
                                      hasRequirementConflict(requirement, selectedDepartment) ? (
                                      (() => {
                                          const dates = getEventDatesInRange();
                                        const isMultiDay = dates.length > 1;

                                        if (!isMultiDay) {
                                          return (
                                            <span className="text-blue-600 font-medium">
                                              {getAvailableQuantity(requirement, selectedDepartment)}
                                              <span className="text-gray-500 ml-1">(of {requirement.totalQuantity || 0})</span>
                                            </span>
                                          );
                                        }

                                        return (
                                          <div className="flex flex-col gap-0.5">
                                            {dates.map((d) => (
                                              <span key={d.toISOString()} className="text-blue-600 font-medium">
                                                {format(d, 'MMM dd')}: {getAvailableQuantityForDate(requirement, d)}
                                                <span className="text-gray-500 ml-1">(of {requirement.totalQuantity || 0})</span>
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <span className={requirement.totalQuantity ? 'text-gray-900' : 'text-gray-400'}>
                                        {requirement.totalQuantity || 'N/A'}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Status:</span>
                              {requirement.isCustom ? (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                  Pending Validation
                                </span>
                              ) : (
                                <span className={`flex items-center gap-1 ${requirement.isAvailable ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                  <div className={`w-2 h-2 rounded-full ${requirement.isAvailable ? 'bg-green-500' : 'bg-red-500'
                                    }`}></div>
                                  {requirement.isAvailable ? 'Available' : 'Unavailable'}
                                </span>
                              )}
                            </div>
                          </div>

                          {requirement.responsiblePerson && (
                            <div className="mt-2 text-xs text-gray-600">
                              <span className="font-medium">Contact:</span> {requirement.responsiblePerson}
                            </div>
                          )}

                          {requirement.availabilityNotes && (
                            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                              {requirement.availabilityNotes.startsWith('PAVILION_DEFAULT:') ? (() => {
                                const parts = requirement.availabilityNotes.split(':');
                                const pavilionLocation = parts.slice(2).join(':') || 'this location';
                                return (
                                  <>
                                    <span className="font-medium">Availability Notes:</span>{' '}
                                    Default requirement for {pavilionLocation}
                                  </>
                                );
                              })() : (
                                <>
                                  <span className="font-medium">Availability Notes:</span>{' '}
                                  {requirement.availabilityNotes}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
                )}

                {/* Empty State Message */}
                {!loadingDepartmentRequirements && (!formData.departmentRequirements[selectedDepartment] || formData.departmentRequirements[selectedDepartment].length === 0) && (
                  <div className="text-center py-8 px-4">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="space-y-1 text-center">
                        {selectedDepartment && selectedDepartment.toLowerCase().includes('pgso') && locationRequirements.length === 0 ? (
                          <>
                            <h5 className="font-medium text-gray-900 text-center">No Default Requirements for this Location</h5>
                            <p className="text-sm text-gray-600 max-w-md text-center mx-auto">
                              The <strong>PGSO</strong> department doesn't have pre-configured requirements for this location.
                            </p>
                            {/* PGSO: custom requirements intentionally disabled for now. Re-enable by removing the PGSO guard below. */}
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              Please coordinate directly with <strong>PGSO</strong> for the requirements needed for this event.
                            </p>
                          </>
                        ) : (
                          <>
                            <h5 className="font-medium text-gray-900 text-center">No Requirements Available</h5>
                            <p className="text-sm text-gray-600 max-w-md text-center mx-auto">
                              The <strong>{selectedDepartment}</strong> department hasn't set up resource availability for{' '}
                              {formData.startDate ? (
                                <strong>{formData.startDate.toDateString()}</strong>
                              ) : (
                                <strong>the selected date</strong>
                              )}.
                            </p>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              The department needs to configure their equipment and service availability in the Calendar page first.
                            </p>
                            <div className="mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewAvailableDates(selectedDepartment)}
                                className="gap-2"
                              >
                                <CalendarIcon className="w-4 h-4" />
                                View Available Dates
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Custom Requirement Button */}
                {/* Only show for PGSO and PITO when location is outside PGB (custom location) */}
                {(selectedDepartment?.toLowerCase().includes('pgso') || selectedDepartment?.toLowerCase().includes('pito')) && 
                 isCustomLocationSelected && (
                  <div
                    className={`p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${showCustomInput
                      ? 'bg-blue-50 border-blue-300'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    onClick={() => setShowCustomInput(true)}
                  >
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Plus className="w-4 h-4" />
                      Add Custom Requirement (Outside PGB)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Custom Requirement Modal (name, type, and quantity/notes in one place) */}
          {/* Only enable for PGSO and PITO when location is outside PGB */}
          {(selectedDepartment?.toLowerCase().includes('pgso') || selectedDepartment?.toLowerCase().includes('pito')) && 
           isCustomLocationSelected && (
            <Dialog open={showCustomInput} onOpenChange={setShowCustomInput}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Custom Requirement</DialogTitle>
                  <DialogDescription>
                    Define a new requirement for {selectedDepartment || 'this department'}.
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
                            <StickyNote className="w-3 h-3" />
                            Service (Notes)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-gray-500">
                      Choose <strong>Quantity</strong> if the department needs to allocate a number of items (e.g., chairs). Choose <strong>Service</strong> for notes/instructions.
                    </p>
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
                      <p className="text-[11px] text-gray-500">
                        Enter how many items you need.
                      </p>
                    </div>
                  )}

                  {customRequirementType === 'service' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-900">Notes / Special Instructions</Label>
                      <Textarea
                        placeholder="Enter notes for this custom requirement..."
                        value={customRequirementNotes}
                        onChange={(e) => setCustomRequirementNotes(e.target.value)}
                        className="text-sm min-h-24"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCustomInput(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddCustomRequirement}
                    disabled={!customRequirement.trim()}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {selectedDepartment?.toLowerCase().includes('pgso') && (
            <div className="px-1">
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs">
                <span className="font-semibold">Note:</span> If you need a list of materials/equipment not listed above, please coordinate manually with <span className="font-semibold">PGSO</span>.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRequirementsModal(false);
                setSelectedDepartment('');
                setCustomRequirement('');
                setShowCustomInput(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRequirements}
              disabled={!formData.departmentRequirements[selectedDepartment]?.some(req => req.selected)}
              className="text-xs"
            >
              Save Requirements
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Requirement Quantity / Notes Popup */}
      <Dialog open={showRequirementDetailsModal && !!activeRequirement} onOpenChange={setShowRequirementDetailsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeRequirement ? `Set Details - ${activeRequirement.name}` : 'Set Requirement Details'}
            </DialogTitle>
            <DialogDescription>
              {activeRequirement?.availabilityNotes 
                ? 'Please review the important notes below.' 
                : 'Specify quantity and notes for this requirement.'}
            </DialogDescription>
          </DialogHeader>

          {activeRequirement && (
            <div className="space-y-4 pt-2">
              {/* Display availability notes as prominent alert if they exist */}
              {activeRequirement.availabilityNotes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <span className="font-medium">Important:</span>{' '}
                      {activeRequirement.availabilityNotes.startsWith('PAVILION_DEFAULT:') ? (() => {
                        const parts = activeRequirement.availabilityNotes.split(':');
                        const pavilionLocation = parts.slice(2).join(':') || 'this location';
                        return `Default requirement for ${pavilionLocation}`;
                      })() : activeRequirement.availabilityNotes}
                    </div>
                  </div>
                </div>
              )}

              {/* Show availability context */}
              {activeRequirement.type === 'physical' && (
                <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
                  <span className="font-medium">Available:</span>{' '}
                  {(() => {
                    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
                    const current = currentReqs.find(r => r.id === activeRequirement.id) || activeRequirement;
                    if (
                      conflictingEvents.length > 0 &&
                      formData.startDate &&
                      formData.startTime &&
                      hasRequirementConflict(current, selectedDepartment)
                    ) {
                      return `${getAvailableQuantity(current, selectedDepartment)} (after conflicts)`;
                    }
                    return current.totalQuantity ?? 'N/A';
                  })()}
                </div>
              )}

              {/* Quantity for physical requirements */}
              {activeRequirement.type === 'physical' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-900">Quantity Needed</Label>
                  {(() => {
                    const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
                    const current = currentReqs.find(r => r.id === activeRequirement.id) || activeRequirement;

                    const dates = getEventDatesInRange();
                    const isMultiDay = dates.length > 1;

                    if (isMultiDay) {
                      return (
                        <div className="space-y-2">
                          {dates.map((d) => {
                            const k = format(d, 'yyyy-MM-dd');
                            const value = (current.quantitiesByDate?.[k] ?? '').toString();

                            let maxAvailable: number | undefined;
                            if (
                              conflictingEvents.length > 0 &&
                              formData.startDate &&
                              formData.startTime &&
                              hasRequirementConflict(current, selectedDepartment)
                            ) {
                              maxAvailable = getAvailableQuantityForDate(current, d);
                            } else if (typeof current.totalQuantity === 'number') {
                              maxAvailable = current.totalQuantity;
                            }

                            return (
                              <div key={k} className="flex items-center gap-2">
                                <div className="w-20 text-xs text-gray-700 font-medium">{format(d, 'MMM dd')}</div>
                                <Input
                                  type="number"
                                  placeholder="Qty"
                                  value={value}
                                  onChange={(e) => {
                                    const raw = parseInt(e.target.value) || 0;
                                    let qty = raw;
                                    const allowZero = typeof maxAvailable === 'number' && maxAvailable === 0;
                                    if (!allowZero && qty < 1) qty = 1;
                                    if (allowZero && qty < 0) qty = 0;
                                    if (typeof maxAvailable === 'number' && qty > maxAvailable) {
                                      qty = maxAvailable;
                                      setShowRequirementMaxWarning(true);
                                    } else {
                                      setShowRequirementMaxWarning(false);
                                    }
                                    handleRequirementQuantityForDate(activeRequirement.id, k, qty);
                                  }}
                                  className="text-sm"
                                  min={typeof maxAvailable === 'number' && maxAvailable === 0 ? 0 : 1}
                                  max={typeof maxAvailable === 'number' ? maxAvailable : undefined}
                                />
                                <div className="text-[11px] text-gray-500 whitespace-nowrap">
                                  of {typeof maxAvailable === 'number' ? maxAvailable : (current.totalQuantity ?? 'N/A')}
                                </div>
                              </div>
                            );
                          })}

                          {showRequirementMaxWarning && (
                            <p className="text-[11px] text-red-600">
                              One of the days reached the maximum available quantity. Please lower the quantity.
                            </p>
                          )}
                        </div>
                      );
                    }

                    const value = current.quantity ?? '';

                    // Determine the maximum available quantity for this requirement
                    let maxAvailable: number | undefined;
                    if (
                      conflictingEvents.length > 0 &&
                      formData.startDate &&
                      formData.startTime &&
                      hasRequirementConflict(current, selectedDepartment)
                    ) {
                      maxAvailable = getAvailableQuantity(current, selectedDepartment);
                    } else if (typeof current.totalQuantity === 'number') {
                      maxAvailable = current.totalQuantity;
                    }

                    return (
                      <>
                        <Input
                          type="number"
                          placeholder="Enter quantity..."
                          value={value}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value) || 0;
                            let qty = raw;
                            const allowZero = typeof maxAvailable === 'number' && maxAvailable === 0;
                            if (!allowZero && qty < 1) qty = 1;
                            if (allowZero && qty < 0) qty = 0;
                            if (typeof maxAvailable === 'number' && qty > maxAvailable) {
                              qty = maxAvailable;
                              // User tried to go beyond max
                              setShowRequirementMaxWarning(true);
                            } else {
                              setShowRequirementMaxWarning(false);
                            }
                            handleRequirementQuantity(activeRequirement.id, qty);
                          }}
                          className="text-sm"
                          min={typeof maxAvailable === 'number' && maxAvailable === 0 ? 0 : 1}
                          max={typeof maxAvailable === 'number' ? maxAvailable : undefined}
                        />
                        {typeof maxAvailable === 'number' && showRequirementMaxWarning && (
                          <p className="mt-1 text-[11px] text-red-600">
                            You reached the maximum available quantity for this item ({maxAvailable}). You cannot request more than this.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Notes only for custom, non-physical requirements */}
              {activeRequirement.type !== 'physical' && activeRequirement.isCustom && (
                <div className="space-y-2">
                  {/* Special handling for Internet Connection - show number input for user count */}
                  {activeRequirement.name === 'Internet Connection' ? (
                    <>
                      <Label className="text-xs font-medium text-gray-900">Number of Users</Label>
                      {(() => {
                        const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
                        const current = currentReqs.find(r => r.id === activeRequirement.id) || activeRequirement;
                        const value = current.quantity ?? '';
                        return (
                          <Input
                            type="number"
                            placeholder="Enter number of users..."
                            value={value}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 0;
                              handleRequirementQuantity(activeRequirement.id, qty);
                            }}
                            className="text-sm"
                            min={1}
                          />
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <Label className="text-xs font-medium text-gray-900">Notes / Special Instructions</Label>
                      {(() => {
                        const currentReqs = formData.departmentRequirements[selectedDepartment] || [];
                        const current = currentReqs.find(r => r.id === activeRequirement.id) || activeRequirement;
                        const value = current.notes || '';
                        return (
                          <Textarea
                            placeholder="Add specific notes or requirements..."
                            value={value}
                            onChange={(e) => handleRequirementNotes(activeRequirement.id, e.target.value)}
                            className="min-h-20 text-sm"
                          />
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRequirementDetailsModal(false);
                setActiveRequirement(null);
                setShowRequirementMaxWarning(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowRequirementDetailsModal(false);
                setActiveRequirement(null);
                setShowRequirementMaxWarning(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="!max-w-2xl !w-full max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Schedule Event at {formData.location || selectedLocation}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select your preferred start and end date/time for the event.
              </p>

              {/* Multi-Conference Room Selection - Clean White Design */}
              {(formData.location === '4th Flr. Conference Room 1' ||
                formData.location === '4th Flr. Conference Room 2' ||
                formData.location === '4th Flr. Conference Room 3' ||
                formData.location === '4th Flr. Conference Room (Entire)') && (
                  <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900">Need Multiple Conference Rooms?</p>
                    </div>

                    {/* Selected Rooms */}
                    {formData.locations.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {formData.locations.map((loc) => (
                          <Badge key={loc} variant="secondary" className="text-xs flex items-center gap-1.5 px-2.5 py-1">
                            {loc}
                            {formData.locations.length > 1 && (
                              <button
                                onClick={() => handleRemoveConferenceRoom(loc)}
                                className="hover:text-red-600 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Add Room Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {!formData.locations.includes('4th Flr. Conference Room 1') && (() => {
                        const roomName = '4th Flr. Conference Room 1';
                        const unavailable = isRoomUnavailableOnSelectedDates(roomName);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddConferenceRoom(1)}
                              disabled={unavailable}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              4th Flr. Conference Room 1
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {!formData.locations.includes('4th Flr. Conference Room 2') && (() => {
                        const roomName = '4th Flr. Conference Room 2';
                        const unavailable = isRoomUnavailableOnSelectedDates(roomName);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddConferenceRoom(2)}
                              disabled={unavailable}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              4th Flr. Conference Room 2
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {!formData.locations.includes('4th Flr. Conference Room 3') && (() => {
                        const roomName = '4th Flr. Conference Room 3';
                        const unavailable = isRoomUnavailableOnSelectedDates(roomName);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddConferenceRoom(3)}
                              disabled={unavailable}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              4th Flr. Conference Room 3
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {/* Multi-Pavilion Section Selection - Kagitingan Hall */}
              {(formData.location === 'Pavilion - Kagitingan Hall - Section A' ||
                formData.location === 'Pavilion - Kagitingan Hall - Section B' ||
                formData.location === 'Pavilion - Kagitingan Hall - Section C') && (
                  <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900">Need Multiple Kagitingan Hall Sections?</p>
                    </div>

                    {/* Selected Sections */}
                    {formData.locations.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {formData.locations.map((loc) => (
                          <Badge key={loc} variant="secondary" className="text-xs flex items-center gap-1.5 px-2.5 py-1">
                            {loc}
                            {formData.locations.length > 1 && (
                              <button
                                onClick={() => handleRemoveConferenceRoom(loc)}
                                className="hover:text-red-600 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Add Section Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {!formData.locations.includes('Pavilion - Kagitingan Hall - Section A') && (() => {
                        const section = 'Pavilion - Kagitingan Hall - Section A';
                        const unavailable = isRoomUnavailableOnSelectedDates(section);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unavailable}
                              onClick={async () => {
                                if (unavailable) return;
                                if (!formData.locations.includes(section)) {
                                  await fetchAvailableDatesForLocation(section);
                                  const kagitinganOnly = formData.locations.filter(l => l.includes('Kagitingan'));
                                  const nextLocs = [...kagitinganOnly, section];
                                  handleInputChange('locations', nextLocs);
                                  handleInputChange('multipleLocations', nextLocs.length > 1);
                                }
                              }}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Section A
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {!formData.locations.includes('Pavilion - Kagitingan Hall - Section B') && (() => {
                        const section = 'Pavilion - Kagitingan Hall - Section B';
                        const unavailable = isRoomUnavailableOnSelectedDates(section);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unavailable}
                              onClick={async () => {
                                if (unavailable) return;
                                if (!formData.locations.includes(section)) {
                                  await fetchAvailableDatesForLocation(section);
                                  const kagitinganOnly = formData.locations.filter(l => l.includes('Kagitingan'));
                                  const nextLocs = [...kagitinganOnly, section];
                                  handleInputChange('locations', nextLocs);
                                  handleInputChange('multipleLocations', nextLocs.length > 1);
                                }
                              }}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Section B
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {!formData.locations.includes('Pavilion - Kagitingan Hall - Section C') && (() => {
                        const section = 'Pavilion - Kagitingan Hall - Section C';
                        const unavailable = isRoomUnavailableOnSelectedDates(section);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unavailable}
                              onClick={async () => {
                                if (unavailable) return;
                                if (!formData.locations.includes(section)) {
                                  await fetchAvailableDatesForLocation(section);
                                  const kagitinganOnly = formData.locations.filter(l => l.includes('Kagitingan'));
                                  const nextLocs = [...kagitinganOnly, section];
                                  handleInputChange('locations', nextLocs);
                                  handleInputChange('multipleLocations', nextLocs.length > 1);
                                }
                              }}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Section C
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {/* Multi-Pavilion Section Selection - Kalayaan Ballroom */}
              {(formData.location === 'Pavilion - Kalayaan Ballroom - Section A' ||
                formData.location === 'Pavilion - Kalayaan Ballroom - Section B' ||
                formData.location === 'Pavilion - Kalayaan Ballroom - Section C') && (
                  <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900">Need Multiple Kalayaan Ballroom Sections?</p>
                    </div>

                    {/* Selected Sections */}
                    {formData.locations.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {formData.locations.map((loc) => (
                          <Badge key={loc} variant="secondary" className="text-xs flex items-center gap-1.5 px-2.5 py-1">
                            {loc}
                            {formData.locations.length > 1 && (
                              <button
                                onClick={() => handleRemoveConferenceRoom(loc)}
                                className="hover:text-red-600 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Add Section Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {!formData.locations.includes('Pavilion - Kalayaan Ballroom - Section A') && (() => {
                        const section = 'Pavilion - Kalayaan Ballroom - Section A';
                        const unavailable = isRoomUnavailableOnSelectedDates(section);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unavailable}
                              onClick={async () => {
                                if (unavailable) return;
                                if (!formData.locations.includes(section)) {
                                  await fetchAvailableDatesForLocation(section);
                                  handleInputChange('locations', [...formData.locations, section]);
                                }
                              }}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Section A
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {!formData.locations.includes('Pavilion - Kalayaan Ballroom - Section B') && (() => {
                        const section = 'Pavilion - Kalayaan Ballroom - Section B';
                        const unavailable = isRoomUnavailableOnSelectedDates(section);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unavailable}
                              onClick={async () => {
                                if (unavailable) return;
                                if (!formData.locations.includes(section)) {
                                  await fetchAvailableDatesForLocation(section);
                                  handleInputChange('locations', [...formData.locations, section]);
                                }
                              }}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Section B
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {!formData.locations.includes('Pavilion - Kalayaan Ballroom - Section C') && (() => {
                        const section = 'Pavilion - Kalayaan Ballroom - Section C';
                        const unavailable = isRoomUnavailableOnSelectedDates(section);
                        return (
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={unavailable}
                              onClick={async () => {
                                if (unavailable) return;
                                if (!formData.locations.includes(section)) {
                                  await fetchAvailableDatesForLocation(section);
                                  handleInputChange('locations', [...formData.locations, section]);
                                }
                              }}
                              className={`text-xs h-8 px-3 ${unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Section C
                            </Button>
                            {unavailable && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Unavailable on this date</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {availableDates.length > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  Only dates when {formData.location || selectedLocation} is available can be selected ({availableDates.length} available dates)
                </p>
              )}
              {formData.startDate && venueConflictingEvents.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  {(() => {
                    // Filter events that actually booked THIS venue/location using ANY of their locations
                    const currentLocation = formData.location || selectedLocation;
                    const venueBookers = venueConflictingEvents
                      .filter(e => {
                        if (!currentLocation) return false;
                        const eventLocations = e.locations && Array.isArray(e.locations) && e.locations.length > 0
                          ? e.locations
                          : [e.location].filter(Boolean);
                        return eventLocations.some((loc: string) => locationsConflict(currentLocation, loc));
                      })
                      .map(e => e.requestorDepartment || e.department || e.departmentName || 'Unknown Department')
                      .filter(Boolean);

                    // Remove duplicates
                    const uniqueBookers = Array.from(new Set(venueBookers));
                    const displayNames = uniqueBookers.length > 0 ? uniqueBookers : ['Another department'];

                    return (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-600 text-white text-xs px-2 py-0.5 h-5 flex-shrink-0 whitespace-nowrap">
                          VENUE
                        </Badge>
                        <p className="text-xs text-amber-900">
                          <strong>{displayNames.join(', ')}</strong> has booked this venue. Select a different time.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
              {formData.startDate && conflictingEvents.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 h-5 flex-shrink-0 whitespace-nowrap">
                      REQ
                    </Badge>
                    <p className="text-xs text-blue-900">
                      Requirements already booked by existing events.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Start Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Start Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => {
                        handleInputChange('startDate', date);
                        // Also update end date to same date by default
                        if (date) {
                          handleInputChange('endDate', date);
                        }
                        // Clear conflicting events when date changes so alert disappears
                        setConflictingEvents([]);
                        setVenueConflictingEvents([]);
                      }}
                      disabled={isDateDisabled}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="startTime" className="text-sm font-medium text-gray-700 mb-2 block">
                  Start Time
                </Label>
                <Select
                  value={formData.startTime}
                  onValueChange={(value) => {
                    handleInputChange('startTime', value);
                    // Clear end time if it's now invalid
                    if (formData.endTime) {
                      const timeToMinutes = (time: string) => {
                        const [hours, minutes] = time.split(':').map(Number);
                        return hours * 60 + minutes;
                      };
                      if (timeToMinutes(value) >= timeToMinutes(formData.endTime)) {
                        handleInputChange('endTime', '');
                      }
                    }
                  }}
                  disabled={!formData.startDate}
                >
                  <SelectTrigger className="w-full" disabled={!formData.startDate}>
                    <SelectValue placeholder={!formData.startDate ? "Select start date first" : "Select start time"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {generateTimeOptions().map((timeOption) => {
                      const isBooked = isTimeSlotBooked(timeOption.value);
                      const requirementConflict = hasRequirementConflictAtTime(timeOption.value);

                      // Only disable if VENUE is booked (physical conflict)
                      // REQ-only conflicts show warning but remain selectable
                      const isDisabled = isBooked;

                      return (
                        <SelectItem
                          key={timeOption.value}
                          value={timeOption.value}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          <div className={`flex items-center justify-between w-full ${isBooked ? 'line-through' : ''}`}>
                            <span className={isDisabled ? 'text-gray-400' : ''}>
                              {timeOption.label}
                            </span>
                            <div className="flex items-center gap-1">
                              {isBooked && (
                                <Badge variant="destructive" className="text-xs">
                                  VENUE
                                </Badge>
                              )}
                              {requirementConflict.hasConflict && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                  REQ
                                </Badge>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* End Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  End Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.endDate ? format(formData.endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.endDate}
                      onSelect={(date) => {
                        handleInputChange('endDate', date);
                        // Clear conflicting events when date changes so alert disappears
                        setConflictingEvents([]);
                        setVenueConflictingEvents([]);
                      }}
                      disabled={isDateDisabled}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="endTime" className="text-sm font-medium text-gray-700 mb-2 block">
                  End Time
                </Label>
                <Select
                  value={formData.endTime}
                  onValueChange={(value) => handleInputChange('endTime', value)}
                  disabled={!formData.startTime}
                >
                  <SelectTrigger className="w-full" disabled={!formData.startTime}>
                    <SelectValue placeholder={formData.startTime ? "Select end time" : "Select start time first"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {getAvailableEndTimes().map((timeOption) => {
                      const isBooked = isTimeSlotBooked(timeOption.value);
                      const requirementConflict = hasRequirementConflictAtTime(timeOption.value);

                      // Only disable if VENUE is booked (physical conflict)
                      // REQ-only conflicts show warning but remain selectable
                      const isDisabled = isBooked;

                      return (
                        <SelectItem
                          key={timeOption.value}
                          value={timeOption.value}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          <div className={`flex items-center justify-between w-full ${isBooked ? 'border-b border-red-200 pb-1 mb-1' : ''
                            }`}>
                            <span className={isDisabled ? 'text-gray-400' : ''}>
                              {timeOption.label}
                            </span>
                            <div className="flex items-center gap-1">
                              {isBooked && (
                                <Badge variant="destructive" className="text-xs">
                                  VENUE
                                </Badge>
                              )}
                              {requirementConflict.hasConflict && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                  REQ
                                </Badge>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-Day Event - Additional Date Slots */}
            {formData.startDate && formData.endDate && formData.startDate.getTime() !== formData.endDate.getTime() && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Additional Days for Multi-Day Event</h4>
                    <p className="text-sm text-gray-600">
                      Your event spans from {format(formData.startDate, "MMM dd")} to {format(formData.endDate, "MMM dd")}.
                      Add time slots for each additional day.
                    </p>
                  </div>
                </div>

                {/* Generate date slots for each day between start and end */}
                {(() => {
                  const days: Date[] = [];
                  const currentDate = new Date(formData.startDate);
                  const endDate = new Date(formData.endDate);

                  // Skip the first day (already covered by main start/end time)
                  currentDate.setDate(currentDate.getDate() + 1);

                  while (currentDate <= endDate) {
                    days.push(new Date(currentDate));
                    currentDate.setDate(currentDate.getDate() + 1);
                  }

                  return (
                    <div className="space-y-3">
                      {days.map((date, index) => {
                        const dateStr = date.toISOString();
                        const existingSlot = formData.dateTimeSlots.find(slot =>
                          slot.date.toDateString() === date.toDateString()
                        );

                        return (
                          <div key={dateStr} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-medium text-gray-900">
                                  Day {index + 2}: {format(date, "PPPP")}
                                </h5>
                                {existingSlot && existingSlot.startTime && existingSlot.endTime && (
                                  <Badge variant="default" className="text-xs bg-green-600">
                                    <Check className="w-3 h-3 mr-1" />
                                    Configured
                                  </Badge>
                                )}
                              </div>
                              {existingSlot && existingSlot.startTime && existingSlot.endTime && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updatedSlots = formData.dateTimeSlots.filter(s =>
                                      s.date.toDateString() !== date.toDateString()
                                    );
                                    handleInputChange('dateTimeSlots', updatedSlots);
                                    toast.success(`Time slot for ${format(date, "MMM dd")} removed`);
                                  }}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {existingSlot && existingSlot.startTime && existingSlot.endTime ? (
                              <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                                <p><strong>Start Time:</strong> {formatTime(existingSlot.startTime)}</p>
                                <p><strong>End Time:</strong> {formatTime(existingSlot.endTime)}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs font-medium text-gray-700 mb-1.5 block">
                                      Start Time
                                    </Label>
                                    <Select
                                      value={existingSlot?.startTime || ''}
                                      onValueChange={(value) => {
                                        const currentSlot = formData.dateTimeSlots.find(s =>
                                          s.date.toDateString() === date.toDateString()
                                        );
                                        const newSlot: DateTimeSlot = {
                                          id: currentSlot?.id || `slot-${date.getTime()}`,
                                          date: date,
                                          startTime: value,
                                          endTime: currentSlot?.endTime || ''
                                        };

                                        // Clear end time if it becomes invalid (end <= start or overlaps booked venue)
                                        if (newSlot.endTime) {
                                          const invalidEnd =
                                            timeToMinutes(newSlot.endTime) <= timeToMinutes(newSlot.startTime) ||
                                            isVenueRangeBooked(newSlot.startTime, newSlot.endTime, date);
                                          if (invalidEnd) {
                                            newSlot.endTime = '';
                                          }
                                        }

                                        const updatedSlots = formData.dateTimeSlots.filter(s =>
                                          s.date.toDateString() !== date.toDateString()
                                        );
                                        handleInputChange('dateTimeSlots', [...updatedSlots, newSlot]);
                                      }}
                                    >
                                      <SelectTrigger className="w-full h-9 text-sm">
                                        <SelectValue placeholder="Select start time" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60" position="popper" sideOffset={5}>
                                        {generateTimeOptions().map((timeOption) => {
                                          console.log('🎯 START TIME - date variable:', date?.toDateString(), 'timeOption:', timeOption.value);
                                          const isBooked = isTimeSlotBooked(timeOption.value, date);
                                          const requirementConflict = hasRequirementConflictAtTime(timeOption.value, date);

                                          // Only disable if VENUE is booked (physical conflict)
                                          const isDisabled = isBooked;

                                          return (
                                            <SelectItem
                                              key={timeOption.value}
                                              value={timeOption.value}
                                              disabled={isDisabled}
                                              className={`text-sm ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                              <div className={`flex items-center justify-between w-full ${isBooked ? 'line-through' : ''}`}>
                                                <span>{timeOption.label}</span>
                                                {(isBooked || requirementConflict.hasConflict) && (
                                                  <div className="flex items-center gap-1 ml-2">
                                                    {isBooked && (
                                                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                                        VENUE
                                                      </Badge>
                                                    )}
                                                    {requirementConflict.hasConflict && (
                                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-yellow-100 text-yellow-800">
                                                        REQ
                                                      </Badge>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs font-medium text-gray-700 mb-1.5 block">
                                      End Time
                                    </Label>
                                    <Select
                                      value={existingSlot?.endTime || ''}
                                      onValueChange={(value) => {
                                        const currentSlot = formData.dateTimeSlots.find(s =>
                                          s.date.toDateString() === date.toDateString()
                                        );
                                        if (currentSlot) {
                                          const newSlot: DateTimeSlot = {
                                            ...currentSlot,
                                            endTime: value
                                          };
                                          const updatedSlots = formData.dateTimeSlots.filter(s =>
                                            s.date.toDateString() !== date.toDateString()
                                          );
                                          handleInputChange('dateTimeSlots', [...updatedSlots, newSlot]);
                                        }
                                      }}
                                      disabled={!formData.dateTimeSlots.find(s => s.date.toDateString() === date.toDateString())?.startTime}
                                    >
                                      <SelectTrigger className="w-full h-9 text-sm">
                                        <SelectValue placeholder="Select end time" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60" position="popper" sideOffset={5}>
                                        {generateTimeOptions().filter(t => {
                                          const slot = formData.dateTimeSlots.find(s => s.date.toDateString() === date.toDateString());
                                          if (!slot?.startTime) return true;
                                          // must be after start time
                                          if (timeToMinutes(t.value) <= timeToMinutes(slot.startTime)) return false;

                                          // must not overlap/bridge across booked venue intervals
                                          return !isVenueRangeBooked(slot.startTime, t.value, date);
                                        }).map((timeOption) => {
                                          console.log('🎯 END TIME - date variable:', date?.toDateString(), 'timeOption:', timeOption.value);
                                          const isBooked = isTimeSlotBooked(timeOption.value, date);
                                          const requirementConflict = hasRequirementConflictAtTime(timeOption.value, date);

                                          // Only disable if VENUE is booked (physical conflict)
                                          const isDisabled = isBooked;

                                          return (
                                            <SelectItem
                                              key={timeOption.value}
                                              value={timeOption.value}
                                              disabled={isDisabled}
                                              className={`text-sm ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${isBooked ? 'border-b border-red-200 pb-1 mb-1' : ''}`}
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <span>{timeOption.label}</span>
                                                {(isBooked || requirementConflict.hasConflict) && (
                                                  <div className="flex items-center gap-1 ml-2">
                                                    {isBooked && (
                                                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                                        VENUE
                                                      </Badge>
                                                    )}
                                                    {requirementConflict.hasConflict && (
                                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-yellow-100 text-yellow-800">
                                                        REQ
                                                      </Badge>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {formData.dateTimeSlots.filter(slot => slot.startTime && slot.endTime).length === 0 && (
                  <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                    <Clock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">No additional days fully configured yet</p>
                    <p className="text-xs text-gray-500 mt-1">Set both start and end times for each day above</p>
                  </div>
                )}
              </div>
            )}

            {/* Schedule Summary */}
            {(formData.startDate || formData.startTime || formData.endDate || formData.endTime) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Event Schedule Summary</h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>Location:</strong> {formData.location || selectedLocation}</p>
                  {formData.startDate && formData.startTime && (
                    <p><strong>Day 1:</strong> {format(formData.startDate, "PPP")} at {formatTime(formData.startTime)} - {formatTime(formData.endTime)}</p>
                  )}
                  {formData.dateTimeSlots.filter(slot => slot.startTime && slot.endTime).length > 0 && (
                    <div className="pt-2 border-t border-blue-300">
                      <p className="font-medium mb-1">Additional Days ({formData.dateTimeSlots.filter(slot => slot.startTime && slot.endTime).length}):</p>
                      {formData.dateTimeSlots
                        .filter(slot => slot.startTime && slot.endTime)
                        .map((slot, idx) => (
                          <p key={slot.id} className="text-xs">
                            • Day {idx + 2}: {format(slot.date, "PPP")} at {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
          {/* End Scrollable Content Area */}

          {/* Fixed Footer Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setShowScheduleModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSave}
              disabled={(() => {
                // Check if it's a multi-day event
                if (formData.startDate && formData.endDate && formData.startDate.getTime() !== formData.endDate.getTime()) {
                  // Calculate how many additional days there should be
                  const days: Date[] = [];
                  const currentDate = new Date(formData.startDate);
                  const endDate = new Date(formData.endDate);
                  currentDate.setDate(currentDate.getDate() + 1);

                  while (currentDate <= endDate) {
                    days.push(new Date(currentDate));
                    currentDate.setDate(currentDate.getDate() + 1);
                  }

                  // Check if all additional days have both start and end times
                  const allDaysConfigured = days.every(date => {
                    const slot = formData.dateTimeSlots.find(s =>
                      s.date.toDateString() === date.toDateString()
                    );
                    return slot && slot.startTime && slot.endTime;
                  });

                  return !allDaysConfigured;
                }
                return false;
              })()}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* W/O Gov Files Modal - Redesigned */}
      <Dialog open={showGovModal} onOpenChange={setShowGovModal}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Government Files</DialogTitle>
            <DialogDescription>
              Upload at least one government file (Event Briefer or Program) to enable w/ Governor
            </DialogDescription>
          </DialogHeader>

          {/* Required Files Notice */}
          {!govFiles.brieferTemplate && !govFiles.programme && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
              <p className="text-xs text-orange-800">
                <strong>At least one file required:</strong> Please upload Event Briefer or Program to proceed.
              </p>
            </div>
          )}

          <div className="space-y-4 py-4">
            {/* Event Briefer Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Event Briefer</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTemplateType('briefer');

                    // Auto-populate briefer data from form
                    const userStr = localStorage.getItem('userData');
                    let currentUserDept = '';

                    if (userStr) {
                      try {
                        const currentUser = JSON.parse(userStr);
                        currentUserDept = currentUser.department || currentUser.departmentName || '';
                      } catch (e) {
                        console.error('Error parsing user from localStorage:', e);
                      }
                    }

                    // Format time to 12-hour format with AM/PM
                    const formatTime12Hour = (time24: string) => {
                      if (!time24) return '';
                      const [hours, minutes] = time24.split(':');
                      const hour = parseInt(hours);
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const hour12 = hour % 12 || 12;
                      return `${hour12}:${minutes} ${ampm}`;
                    };

                    const startDateTime = formData.startDate && formData.startTime
                      ? `${format(formData.startDate, 'MMMM dd, yyyy')} ${formatTime12Hour(formData.startTime)}`
                      : '';
                    const endDateTime = formData.endDate && formData.endTime
                      ? `${format(formData.endDate, 'MMMM dd, yyyy')} ${formatTime12Hour(formData.endTime)}`
                      : '';
                    const dateTimeRange = startDateTime && endDateTime
                      ? `${startDateTime} - ${endDateTime}`
                      : '';

                    const totalParticipants = (
                      parseInt(formData.participants || '0') +
                      parseInt(formData.vip || '0') +
                      parseInt(formData.vvip || '0')
                    ).toString();

                    setBrieferData({
                      eventTitle: formData.eventTitle || '',
                      proponentOffice: currentUserDept || '',
                      dateTime: dateTimeRange,
                      venue: formData.location || '',
                      objectives: formData.description || '',
                      targetAudience: '', // User fills this
                      expectedParticipants: totalParticipants !== '0' ? totalParticipants : '',
                      briefDescription: '' // User fills this
                    });

                    setShowTemplateModal(true);
                  }}
                  className="h-8 text-xs gap-1"
                >
                  <FileText className="w-3 h-3" />
                  View Template
                </Button>
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                {govFiles.brieferTemplate ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-gray-900">{govFiles.brieferTemplate.name}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGovFileUpload('brieferTemplate', null)}
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">Click to upload Event Briefer</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGovFileUpload('brieferTemplate', file);
                      }}
                      className="hidden"
                      id="brieferTemplate"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('brieferTemplate')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Program Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Program</Label>
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                {govFiles.programme ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-gray-900">{govFiles.programme.name}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGovFileUpload('programme', null)}
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">Click to upload Program</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGovFileUpload('programme', file);
                      }}
                      className="hidden"
                      id="programme"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('programme')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGovModal(false);
                if (!govFiles.brieferTemplate && !govFiles.programme) {
                  handleInputChange('withoutGov', false);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Check if at least one file is uploaded
                if (!govFiles.brieferTemplate && !govFiles.programme) {
                  toast.error('Please upload at least one government file');
                  handleInputChange('withoutGov', false);
                  setShowGovModal(false);
                  return;
                }
                setShowGovModal(false);
              }}
              disabled={!govFiles.brieferTemplate && !govFiles.programme}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {templateType === 'briefer' ? 'Event Briefer Template' : 'Program Template'}
            </DialogTitle>
            <DialogDescription>
              {templateType === 'briefer' ? 'Fill out the event briefer form' : 'Fill out the program'}
            </DialogDescription>
          </DialogHeader>

          {templateType === 'briefer' ? (
            <div className="space-y-4 py-4">
              {/* Event Briefer Form - Table Style */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {/* Event Title */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm w-1/3 border-r">
                        Event Title:
                      </td>
                      <td className="p-2">
                        <Input
                          value={brieferData.eventTitle}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, eventTitle: e.target.value }))}
                          placeholder="Enter event title"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </td>
                    </tr>

                    {/* Proponent Office/Department */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r">
                        Proponent Office/Department:
                      </td>
                      <td className="p-2">
                        <Input
                          value={brieferData.proponentOffice}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, proponentOffice: e.target.value }))}
                          placeholder="Enter office/department"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </td>
                    </tr>

                    {/* Date and Time */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r">
                        Date and Time:
                      </td>
                      <td className="p-2">
                        <Input
                          value={brieferData.dateTime}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, dateTime: e.target.value }))}
                          placeholder="Enter date and time"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </td>
                    </tr>

                    {/* Venue */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r">
                        Venue:
                      </td>
                      <td className="p-2">
                        <Input
                          value={brieferData.venue}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, venue: e.target.value }))}
                          placeholder="Enter venue"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </td>
                    </tr>

                    {/* Objectives */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r align-top">
                        Objectives:
                      </td>
                      <td className="p-2">
                        <Textarea
                          value={brieferData.objectives}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, objectives: e.target.value }))}
                          placeholder="Enter objectives"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[80px]"
                        />
                      </td>
                    </tr>

                    {/* Target Audience/Participants */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r">
                        Target Audience/Participants:
                      </td>
                      <td className="p-2">
                        <Input
                          value={brieferData.targetAudience}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, targetAudience: e.target.value }))}
                          placeholder="Enter target audience"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </td>
                    </tr>

                    {/* Expected Number of Participants */}
                    <tr className="border-b">
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r">
                        Expected Number of Participants:
                      </td>
                      <td className="p-2">
                        <Input
                          value={brieferData.expectedParticipants}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, expectedParticipants: e.target.value }))}
                          placeholder="Enter expected number"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </td>
                    </tr>

                    {/* Brief Description of the Activity */}
                    <tr>
                      <td className="bg-gray-50 p-3 font-medium text-sm border-r align-top">
                        Brief Description of the Activity:
                      </td>
                      <td className="p-2">
                        <Textarea
                          value={brieferData.briefDescription}
                          onChange={(e) => setBrieferData(prev => ({ ...prev, briefDescription: e.target.value }))}
                          placeholder="Enter brief description"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[100px]"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Program Flow Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="p-3 text-left text-sm font-medium border-r w-1/6">Time</th>
                      <th className="p-3 text-left text-sm font-medium border-r w-2/6">Activity/Segment</th>
                      <th className="p-3 text-left text-sm font-medium border-r w-1/6">Person Responsible</th>
                      <th className="p-3 text-left text-sm font-medium w-1/6">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programFlowRows.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 border-r">
                          <Input
                            value={row.time}
                            onChange={(e) => {
                              const newRows = [...programFlowRows];
                              newRows[index].time = e.target.value;
                              setProgramFlowRows(newRows);
                            }}
                            placeholder="e.g., 8:00 AM"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </td>
                        <td className="p-2 border-r">
                          <Input
                            value={row.activity}
                            onChange={(e) => {
                              const newRows = [...programFlowRows];
                              newRows[index].activity = e.target.value;
                              setProgramFlowRows(newRows);
                            }}
                            placeholder="Enter activity"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </td>
                        <td className="p-2 border-r">
                          <Input
                            value={row.personResponsible}
                            onChange={(e) => {
                              const newRows = [...programFlowRows];
                              newRows[index].personResponsible = e.target.value;
                              setProgramFlowRows(newRows);
                            }}
                            placeholder="Enter person"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={row.remarks}
                            onChange={(e) => {
                              const newRows = [...programFlowRows];
                              newRows[index].remarks = e.target.value;
                              setProgramFlowRows(newRows);
                            }}
                            placeholder="Enter remarks"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProgramFlowRows([...programFlowRows, { time: '', activity: '', personResponsible: '', remarks: '' }]);
                  }}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTemplateModal(false)}
            >
              Close
            </Button>
            {(templateType === 'briefer' || templateType === 'program') && (
              <Button
                onClick={async () => {
                  try {
                    // Create new PDF document
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const margin = 20;
                    const bottomMargin = 20;
                    let yPos = 10;
                    let logoImg: HTMLImageElement | null = null;

                    // Load logo
                    try {
                      logoImg = new Image();
                      logoImg.crossOrigin = 'anonymous';

                      await new Promise((resolve, reject) => {
                        logoImg!.onload = resolve;
                        logoImg!.onerror = reject;
                        logoImg!.src = '/images/bataanlogo.png';
                      });
                    } catch (error) {
                      console.warn('Could not load logo:', error);
                    }

                    // Function to add header with logo on each page
                    const addPageHeader = () => {
                      let headerY = 10;

                      // Add logo if available
                      if (logoImg) {
                        const logoWidth = 15;
                        const logoHeight = 15;
                        const logoX = (pageWidth - logoWidth) / 2;
                        pdf.addImage(logoImg, 'PNG', logoX, headerY, logoWidth, logoHeight);
                        headerY += logoHeight + 5;
                      } else {
                        headerY += 2;
                      }

                      // Header text
                      pdf.setFontSize(14);
                      pdf.setFont('helvetica', 'bold');
                      pdf.text('PROVINCIAL GOVERNMENT OF BATAAN', pageWidth / 2, headerY, { align: 'center' });

                      headerY += 5;
                      pdf.setFontSize(10);
                      pdf.setFont('helvetica', 'normal');
                      pdf.text('Event Management System', pageWidth / 2, headerY, { align: 'center' });

                      headerY += 6;
                      pdf.setFontSize(12);
                      pdf.setFont('helvetica', 'bold');
                      pdf.text(templateType === 'briefer' ? 'EVENT BRIEFER' : 'PROGRAM FLOW', pageWidth / 2, headerY, { align: 'center' });

                      headerY += 8;
                      pdf.setFontSize(9);
                      pdf.setFont('helvetica', 'normal');
                      pdf.text(`Generated on ${formatDate(new Date(), 'MMMM dd, yyyy')} at ${formatDate(new Date(), 'h:mm a')}`, pageWidth / 2, headerY, { align: 'center' });

                      headerY += 10;
                      return headerY;
                    };

                    // Function to check if we need a new page
                    const checkAndAddNewPage = (requiredHeight: number) => {
                      if (yPos + requiredHeight > pageHeight - bottomMargin) {
                        pdf.addPage();
                        yPos = addPageHeader();
                        return true;
                      }
                      return false;
                    };

                    // Add header to first page
                    yPos = addPageHeader();

                    if (templateType === 'briefer') {
                      // Event Briefer Table-style content with borders
                      const fields = [
                        { label: 'Event Title:', value: brieferData.eventTitle || 'N/A' },
                        { label: 'Proponent Office/Department:', value: brieferData.proponentOffice || 'N/A' },
                        { label: 'Date and Time:', value: brieferData.dateTime || 'N/A' },
                        { label: 'Venue:', value: brieferData.venue || 'N/A' },
                        { label: 'Objectives:', value: brieferData.objectives || 'N/A', multiline: true },
                        { label: 'Target Audience/Participants:', value: brieferData.targetAudience || 'N/A' },
                        { label: 'Expected Number of Participants:', value: brieferData.expectedParticipants || 'N/A' },
                        { label: 'Brief Description of the Activity:', value: brieferData.briefDescription || 'N/A', multiline: true }
                      ];

                      const tableStartY = yPos;
                      const labelColWidth = 60; // Width of label column
                      const valueColWidth = pageWidth - 2 * margin - labelColWidth; // Width of value column
                      const cellPadding = 3;

                      // Set border style once
                      pdf.setDrawColor(200, 200, 200); // Gray border
                      pdf.setLineWidth(0.1);

                      fields.forEach((field, index) => {
                        // Calculate row height based on content
                        pdf.setFontSize(9);
                        const wrappedValue = pdf.splitTextToSize(field.value, valueColWidth - 2 * cellPadding);
                        const rowHeight = Math.max(10, wrappedValue.length * 5 + 2 * cellPadding);

                        // Check if we need a new page
                        checkAndAddNewPage(rowHeight);

                        // Draw label cell (left column with gray background)
                        pdf.setFillColor(245, 245, 245); // Light gray background
                        pdf.rect(margin, yPos, labelColWidth, rowHeight, 'F'); // Fill only

                        // Draw value cell (right column)
                        pdf.setFillColor(255, 255, 255); // White background
                        pdf.rect(margin + labelColWidth, yPos, valueColWidth, rowHeight, 'F'); // Fill only

                        // Draw borders (stroke only, no fill)
                        pdf.rect(margin, yPos, labelColWidth, rowHeight, 'S'); // Label cell border
                        pdf.rect(margin + labelColWidth, yPos, valueColWidth, rowHeight, 'S'); // Value cell border

                        // Add label text
                        pdf.setFontSize(9);
                        pdf.setFont('helvetica', 'bold');
                        pdf.setTextColor(0, 0, 0);
                        const labelLines = pdf.splitTextToSize(field.label, labelColWidth - 2 * cellPadding);
                        pdf.text(labelLines, margin + cellPadding, yPos + cellPadding + 3);

                        // Add value text
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(wrappedValue, margin + labelColWidth + cellPadding, yPos + cellPadding + 3);

                        yPos += rowHeight;
                      });
                    } else {
                      // Program Flow Table
                      const colWidths = [30, 60, 40, 40]; // Time, Activity, Person, Remarks
                      const cellPadding = 2;
                      const rowHeight = 10;

                      // Set border style
                      pdf.setDrawColor(200, 200, 200);
                      pdf.setLineWidth(0.1);

                      // Draw header row
                      const headers = ['Time', 'Activity/Segment', 'Person Responsible', 'Remarks'];
                      let xPos = margin;

                      pdf.setFontSize(9);
                      pdf.setFont('helvetica', 'bold');

                      headers.forEach((header, i) => {
                        // Fill with gray background
                        pdf.setFillColor(240, 240, 240);
                        pdf.rect(xPos, yPos, colWidths[i], rowHeight, 'F');
                        // Draw border
                        pdf.rect(xPos, yPos, colWidths[i], rowHeight, 'S');
                        // Add text
                        pdf.text(header, xPos + cellPadding, yPos + 6);
                        xPos += colWidths[i];
                      });

                      yPos += rowHeight;

                      // Draw data rows
                      pdf.setFont('helvetica', 'normal');
                      pdf.setFontSize(8);

                      programFlowRows.forEach((row) => {
                        // Check if we need a new page
                        const wasNewPage = checkAndAddNewPage(rowHeight);

                        // If new page was added, redraw the header row
                        if (wasNewPage) {
                          let headerXPos = margin;
                          pdf.setFontSize(9);
                          pdf.setFont('helvetica', 'bold');

                          headers.forEach((header, i) => {
                            pdf.setFillColor(240, 240, 240);
                            pdf.rect(headerXPos, yPos, colWidths[i], rowHeight, 'F');
                            pdf.rect(headerXPos, yPos, colWidths[i], rowHeight, 'S');
                            pdf.text(header, headerXPos + cellPadding, yPos + 6);
                            headerXPos += colWidths[i];
                          });

                          yPos += rowHeight;
                          pdf.setFont('helvetica', 'normal');
                          pdf.setFontSize(8);
                        }

                        xPos = margin;

                        // Time
                        pdf.setFillColor(255, 255, 255);
                        pdf.rect(xPos, yPos, colWidths[0], rowHeight, 'F');
                        pdf.rect(xPos, yPos, colWidths[0], rowHeight, 'S');
                        pdf.text(row.time || '', xPos + cellPadding, yPos + 6);
                        xPos += colWidths[0];

                        // Activity
                        pdf.setFillColor(255, 255, 255);
                        pdf.rect(xPos, yPos, colWidths[1], rowHeight, 'F');
                        pdf.rect(xPos, yPos, colWidths[1], rowHeight, 'S');
                        const activityText = pdf.splitTextToSize(row.activity || '', colWidths[1] - 2 * cellPadding);
                        pdf.text(activityText[0] || '', xPos + cellPadding, yPos + 6);
                        xPos += colWidths[1];

                        // Person Responsible
                        pdf.setFillColor(255, 255, 255);
                        pdf.rect(xPos, yPos, colWidths[2], rowHeight, 'F');
                        pdf.rect(xPos, yPos, colWidths[2], rowHeight, 'S');
                        const personText = pdf.splitTextToSize(row.personResponsible || '', colWidths[2] - 2 * cellPadding);
                        pdf.text(personText[0] || '', xPos + cellPadding, yPos + 6);
                        xPos += colWidths[2];

                        // Remarks
                        pdf.setFillColor(255, 255, 255);
                        pdf.rect(xPos, yPos, colWidths[3], rowHeight, 'F');
                        pdf.rect(xPos, yPos, colWidths[3], rowHeight, 'S');
                        const remarksText = pdf.splitTextToSize(row.remarks || '', colWidths[3] - 2 * cellPadding);
                        pdf.text(remarksText[0] || '', xPos + cellPadding, yPos + 6);

                        yPos += rowHeight;
                      });
                    }

                    // Create blob URL for PDF preview
                    const pdfBlob = pdf.output('blob');
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    setPdfPreviewUrl(pdfUrl);
                    setShowPdfPreview(true);

                  } catch (error) {
                    console.error('Error generating PDF preview:', error);
                    toast.error('Failed to generate PDF preview');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <FileText className="w-4 h-4" />
                Preview PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Modal */}
      <Dialog open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              PDF Preview - Event Briefer
            </DialogTitle>
            <DialogDescription>
              This is exactly how your PDF will look when downloaded
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-gray-100 rounded-lg">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                style={{ minHeight: '600px' }}
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>Generating PDF preview...</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPdfPreview(false)}>
              Close Preview
            </Button>
            <Button
              onClick={() => {
                if (!pdfPreviewUrl) {
                  toast.error('No PDF preview available');
                  return;
                }

                // Download the PDF
                const link = document.createElement('a');
                link.href = pdfPreviewUrl;
                const fileName = templateType === 'briefer' ? 'Event-Briefer' : 'Program-Flow';
                link.download = `${fileName}-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`;
                link.click();
                toast.success('PDF downloaded successfully!');
              }}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Available Dates Modal */}
      <Dialog open={showAvailableDatesModal} onOpenChange={setShowAvailableDatesModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Available Dates - {selectedDepartment}
            </DialogTitle>
            <DialogDescription>
              Dates when {selectedDepartment} has configured resource availability
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {departmentAvailableDates.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Found {departmentAvailableDates.length} date{departmentAvailableDates.length !== 1 ? 's' : ''} with available resources:
                </p>

                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {departmentAvailableDates.map((dateEntry: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">
                          {format(new Date(dateEntry.date), 'EEEE, MMMM dd, yyyy')}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {dateEntry.availableCount || 0} resources
                        </Badge>
                      </div>

                      {dateEntry.timeRange && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          <span>Time Range: {dateEntry.timeRange.start} - {dateEntry.timeRange.end}</span>
                        </div>
                      )}

                      {dateEntry.resources && dateEntry.resources.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Available Resources:</p>
                          <div className="flex flex-wrap gap-1">
                            {dateEntry.resources.slice(0, 3).map((resource: any, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {resource.name}
                              </Badge>
                            ))}
                            {dateEntry.resources.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{dateEntry.resources.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // Set the date first
                            const selectedDateObj = new Date(dateEntry.date);
                            handleInputChange('startDate', selectedDateObj);
                            handleInputChange('endDate', selectedDateObj);

                            // Close ALL modals first
                            setShowAvailableDatesModal(false);
                            setShowRequirementsModal(false);

                            // Open Edit Schedule modal to set start/end times
                            setShowScheduleModal(true);

                            toast.info(`Date set to ${format(selectedDateObj, 'MMM dd, yyyy')} - Please set start and end times`);
                          }}
                          className="text-xs gap-1"
                        >
                          <CalendarIcon className="w-3 h-3" />
                          Use This Date
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <CalendarIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-medium text-gray-900">No Available Dates</h5>
                    <p className="text-sm text-gray-600">
                      {selectedDepartment} hasn't configured any resource availability yet.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAvailableDatesModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review & Submit Modal */}
      <Dialog open={showReviewModal} onOpenChange={(open) => {
        setShowReviewModal(open);
        if (!open) setReviewStep(1);
      }}>
        <DialogContent className="!max-w-4xl !w-[95vw] max-h-[90vh] overflow-hidden p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-8 py-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900">Review Your Request</h2>
                  <p className="text-sm text-gray-500 mt-1.5">
                    Please verify all details before submitting
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-2 w-12 rounded-full transition-all ${step === reviewStep
                        ? 'bg-blue-600'
                        : step < reviewStep
                          ? 'bg-blue-200'
                          : 'bg-gray-200'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Content with slide transitions */}
            <div className="flex-1 overflow-hidden relative min-h-[400px]">
              {/* Step 1: Event Details */}
              {reviewStep === 1 && (
                <motion.div
                  key="review-step-1"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 p-8 overflow-y-auto"
                >
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Event Details</h3>
                      <p className="text-sm text-gray-500">Basic information about your event</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Event Title</Label>
                        <p className="text-base font-medium text-gray-900">{formData.eventTitle}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requestor</Label>
                        <p className="text-base font-medium text-gray-900">{formData.requestor}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Event Type</Label>
                        <Badge className={`${formData.eventType === 'simple-meeting' ? 'bg-green-600 text-white' :
                          formData.eventType === 'simple' ? 'bg-blue-600 text-white' :
                            'bg-purple-600 text-white'
                          }`}>
                          {formData.eventType === 'simple-meeting' ? 'Simple Meeting' :
                            formData.eventType === 'simple' ? 'Simple Event' : 'Complex Event'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Location{formData.locations.length > 1 ? 's' : ''}
                        </Label>
                        {formData.locations.length > 1 ? (
                          <div className="space-y-1">
                            {formData.locations.map((loc, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-sm">
                                  {loc}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-base font-medium text-gray-900">{formData.location}</p>
                        )}
                      </div>
                      {formData.roomType && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Room Type</Label>
                          <p className="text-base font-medium text-gray-900">{formData.roomType}</p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Participants</Label>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-medium text-gray-900">{formData.participants} Regular</span>
                          {formData.vip && <span className="text-gray-600">{formData.vip} VIP</span>}
                          {formData.vvip && <span className="text-gray-600">{formData.vvip} VVIP</span>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</Label>
                      <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border">
                        {formData.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Attachments ({formData.attachments.length})
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {formData.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                            <Paperclip className="w-4 h-4 text-gray-400" />
                            <span className="truncate font-medium text-gray-700">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Tagged Departments */}
              {reviewStep === 2 && (
                <motion.div
                  key="review-step-2"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 p-8 overflow-y-auto"
                >
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Tagged Departments</h3>
                      <p className="text-sm text-gray-500">Requirements for each department</p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      {formData.taggedDepartments.map((dept) => {
                        const deptReqs = formData.departmentRequirements[dept]?.filter(req => req.selected) || [];
                        return (
                          <Card key={dept} className="overflow-hidden">
                            <CardHeader className="bg-gray-50 border-b py-4 px-6">
                              <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600" />
                                {dept}
                                <Badge variant="secondary" className="ml-auto text-xs">
                                  {deptReqs.length} {deptReqs.length === 1 ? 'Requirement' : 'Requirements'}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                              <div className="space-y-2">
                                {deptReqs.map((req) => (
                                  <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="flex-shrink-0">
                                        {req.type === 'physical' ? (
                                          <Package className="w-4 h-4 text-gray-400" />
                                        ) : req.serviceType === 'yesno' ? (
                                          <CheckSquare className="w-4 h-4 text-gray-400" />
                                        ) : (
                                          <Settings className="w-4 h-4 text-gray-400" />
                                        )}
                                      </div>
                                      <span className="font-medium text-sm text-gray-900 truncate">{req.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {req.type === 'physical' && req.quantity && (
                                        <Badge variant="secondary" className="text-xs">
                                          Qty: {req.quantity}
                                        </Badge>
                                      )}
                                      {req.serviceType === 'yesno' && req.yesNoAnswer && (
                                        <Badge
                                          variant="secondary"
                                          className={`text-xs flex items-center gap-1 ${req.yesNoAnswer === 'yes' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                            }`}
                                        >
                                          {req.yesNoAnswer === 'yes' ? (
                                            <><Check className="w-3 h-3" /> Yes</>
                                          ) : (
                                            <><X className="w-3 h-3" /> No</>
                                          )}
                                        </Badge>
                                      )}
                                      {req.notes && req.notes.trim() && (
                                        <StickyNote className="w-4 h-4 text-gray-400" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Schedule & Contact */}
              {reviewStep === 3 && (
                <motion.div
                  key="review-step-3"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 p-8 overflow-y-auto"
                >
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Schedule & Contact</h3>
                      <p className="text-sm text-gray-500">Event timing and contact information</p>
                    </div>

                    <Separator />

                    <Card>
                      <CardHeader className="bg-gray-50 border-b py-4 px-6">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-blue-600" />
                          Event Schedule
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="space-y-6">
                          <div>
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">Day 1 - Primary Schedule</Label>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <CalendarIcon className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">
                                  {formData.startDate && format(formData.startDate, "PPP")}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-500">Start:</span>
                                  <span className="font-medium text-gray-900">
                                    {formData.startTime && formatTime(formData.startTime)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-500">End:</span>
                                  <span className="font-medium text-gray-900">
                                    {formData.endTime && formatTime(formData.endTime)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Additional Date Slots */}
                          {formData.dateTimeSlots && formData.dateTimeSlots.length > 0 && (
                            <div className="pt-4 border-t">
                              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                                Additional Days ({formData.dateTimeSlots.length})
                              </Label>
                              <div className="space-y-3">
                                {formData.dateTimeSlots.map((slot, index) => (
                                  <div key={slot.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="space-y-2">
                                        <p className="text-xs font-medium text-blue-900">Day {index + 2}</p>
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-blue-900">
                                              {format(slot.date, "PPP")}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-blue-900">
                                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="bg-gray-50 border-b py-4 px-6">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <User className="w-5 h-5 text-blue-600" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Number</Label>
                            <p className="text-base font-medium text-gray-900">{formData.contactNumber}</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email Address</Label>
                            <p className="text-base font-medium text-gray-900">{formData.contactEmail}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  if (reviewStep > 1) {
                    setReviewStep(reviewStep - 1);
                  } else {
                    setShowReviewModal(false);
                    setReviewStep(1);
                  }
                }}
              >
                {reviewStep === 1 ? 'Cancel' : 'Previous'}
              </Button>

              {reviewStep < 3 ? (
                <Button
                  onClick={() => setReviewStep(reviewStep + 1)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewStep(1);
                    handleSubmitEventRequest();
                  }}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Requirements Modal */}
      <Dialog open={showLocationRequirementsModal} onOpenChange={setShowLocationRequirementsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Available Materials & Equipment
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block text-sm text-gray-600">The following items are available at:</span>
              {(() => {
                // Sort locations numerically if they are conference rooms
                const locations = selectedLocation.split(' + ');
                const sortedLocations = locations.sort((a, b) => {
                  const matchA = a.match(/Conference Room (\d+)/);
                  const matchB = b.match(/Conference Room (\d+)/);
                  if (matchA && matchB) {
                    return parseInt(matchA[1]) - parseInt(matchB[1]);
                  }
                  return a.localeCompare(b);
                });

                return sortedLocations.map((loc, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    <strong className="text-gray-800">{loc}</strong>
                  </div>
                ));
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {loadingLocationRequirements ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 flex-1">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : locationRequirements.length > 0 ? (
              <div className={`${locationRequirements.length > 4 ? 'grid grid-cols-2 gap-3' : 'space-y-2'}`}>
                {(/pavilion/i.test(selectedLocation ?? '')
                  ? locationRequirements.filter((r) => !/microphone/i.test(r.name))
                  : locationRequirements
                ).map((req, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">{req.name}</span>
                    </div>
                    <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
                      ×{req.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No default requirements for this location</p>
              )}
            </div>

          {(pavilionZeroItems.length > 0 || pavilionChairWarning) && (
            <div className="space-y-2">
              {pavilionZeroItems.length > 0 && (
                <div className="px-4 py-3 rounded-lg border text-sm bg-red-50 border-red-200 text-red-700">
                  <div className="flex items-start gap-2">
                    <Ban className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                    <div>
                      <p className="font-medium">No items available</p>
                      <p className="text-xs mt-0.5 opacity-80">
                        The following items are fully booked for your selected dates:
                      </p>
                      <ul className="text-xs mt-1 list-disc pl-4 space-y-0.5 opacity-80">
                        {pavilionZeroItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              {pavilionChairWarning && (
                <div className={`px-4 py-3 rounded-lg border text-sm ${
                  pavilionChairWarning.available === 0
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <div className="flex items-start gap-2">
                    {pavilionChairWarning.available === 0 ? (
                      <Ban className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {pavilionChairWarning.available === 0
                          ? 'No chairs available'
                          : 'Not enough chairs'}
                      </p>
                      <p className="text-xs mt-0.5 opacity-80">
                        {pavilionChairWarning.available === 0
                          ? `All chairs in the Pavilion are fully booked for your selected dates.`
                          : `Only ${pavilionChairWarning.available.toLocaleString()} of ${pavilionChairWarning.requested.toLocaleString()} required chairs are available. You may proceed and coordinate with PGSO.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                if (pavilionZeroItems.length > 0 || pavilionChairWarning?.available === 0) {
                  setShowPavilionConfirm(true);
                } else {
                  setPavilionChairWarning(null);
                  setShowLocationRequirementsModal(false);
                  setShowScheduleModal(true);
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Continue to Schedule
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPavilionConfirm} onOpenChange={setShowPavilionConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Limited Items Available
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 pt-2">
              {pavilionZeroItems.length > 0 && (
                <p>
                  The following items are fully booked for your selected dates. You may still proceed, but PGSO will need to coordinate these items separately:
                </p>
              )}
              {pavilionChairWarning && pavilionChairWarning.available === 0 && (
                <p className="mt-1">
                  All chairs in the Pavilion are fully booked for your selected dates.
                </p>
              )}
              {pavilionChairWarning && pavilionChairWarning.available > 0 && (
                <p className="mt-1">
                  Only {pavilionChairWarning.available.toLocaleString()} of {pavilionChairWarning.requested.toLocaleString()} required chairs are available.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          {pavilionZeroItems.length > 0 && (
            <div className="px-6">
              <ul className="text-sm space-y-1.5">
                {pavilionZeroItems.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-gray-700">
                    <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowPavilionConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPavilionConfirm(false);
                setPavilionChairWarning(null);
                setShowLocationRequirementsModal(false);
                setShowScheduleModal(true);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Proceed Anyway
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showZeroQtyAlert} onOpenChange={setShowZeroQtyAlert}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              Item Not Available
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 pt-2">
              <p>
                <strong>{zeroQtyAlertItem}</strong> is fully booked for your selected dates and cannot be selected.
              </p>
              <p className="mt-2">
                Please coordinate directly with PGSO if you need this item.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowZeroQtyAlert(false)} className="bg-blue-600 hover:bg-blue-700">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPitoBlockAlert} onOpenChange={setShowPitoBlockAlert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              PITO Department Unavailable
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-800">Cannot Tag PITO Department</p>
                  <p className="text-sm text-red-700">{pitoBlockMessage}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800">Need Assistance?</p>
                  <p className="text-sm text-blue-700">Please coordinate directly with the PITO department for scheduling and availability.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowPitoBlockAlert(false)} className="w-full bg-blue-600 hover:bg-blue-700">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPgsoDefaultsDialog} onOpenChange={setShowPgsoDefaultsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Default PGSO Requirements Detected
            </DialogTitle>
            <DialogDescription>
              The system detected that your selected location has default requirements under PGSO. Click Continue to automatically select PGSO and show the default requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-blue-50 p-3 text-sm text-blue-900">
            This helps avoid missing required items for the selected venue.
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPgsoDefaultsDialog(false);
                setAutoSelectPgsoAfterStep3(false);
                setNoDepartmentsNeeded(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={async () => {
                setShowPgsoDefaultsDialog(false);
                setNoDepartmentsNeeded(false);

                if (!autoSelectPgsoAfterStep3) return;
                setAutoSelectPgsoAfterStep3(false);

                const pgsoDept = departments.find((d) => d.name?.toLowerCase().includes('pgso'));
                if (!pgsoDept?.name) {
                  toast.error('PGSO department was not found in the departments list');
                  return;
                }

                await handleDepartmentToggle(pgsoDept.name);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Type Alert Modal */}
      <Dialog open={showEventTypeAlert} onOpenChange={setShowEventTypeAlert}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Select Event Type to Continue
            </DialogTitle>
            <DialogDescription className="text-sm">
              Please choose an event type to proceed with your booking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Simple Meeting */}
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, eventType: 'simple-meeting' }));
                setShowEventTypeAlert(false);
              }}
              className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-600 transition-colors">
                  <CalendarIcon className="w-5 h-5 text-green-600 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Simple Meeting</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    For quick meetings and sudden gatherings. Book any available date on the calendar with no advance notice required. Perfect for immediate scheduling needs.
                  </p>
                </div>
              </div>
            </button>

            {/* Simple Event */}
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, eventType: 'simple' }));
                setShowEventTypeAlert(false);
              }}
              className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                  <Clock className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Simple Event</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    For standard events and activities. Must be booked at least <strong>7 days in advance</strong>. Suitable for regular events with moderate planning requirements.
                  </p>
                </div>
              </div>
            </button>

            {/* Complex Event */}
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, eventType: 'complex' }));
                setShowEventTypeAlert(false);
              }}
              className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 transition-colors">
                  <Settings className="w-5 h-5 text-purple-600 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Complex Event</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    For large-scale events requiring extensive preparation. Must be booked at least <strong>30 days in advance</strong>. Ideal for major events with detailed coordination needs.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setShowEventTypeAlert(false)}
              className="text-gray-600"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Auto Suggest Location Modal ──────────────────────────────────────── */}
      <Dialog
        open={showAutoSuggestModal}
        onOpenChange={(open) => {
          setShowAutoSuggestModal(open);
          if (!open && !selectedSuggestion) setLocationMode('manual');
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">

          {/* ── Venue Search Loading Overlay (inside modal) ── */}
          {loadingAutoSuggest && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur-[2px]">
              {/* Spinner ring */}
              <div className="relative flex items-center justify-center w-20 h-20 mb-5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-20 animate-ping" />
                <svg className="absolute w-20 h-20 animate-spin" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="34" stroke="#ede9fe" strokeWidth="6" />
                  <path d="M40 6 A34 34 0 0 1 74 40" stroke="#7c3aed" strokeWidth="6" strokeLinecap="round" />
                </svg>
                <div className="w-11 h-11 rounded-full bg-violet-50 flex items-center justify-center z-10">
                  <MapPin className="w-5 h-5 text-violet-600" />
                </div>
              </div>

              {/* Text */}
              <p className="text-sm font-semibold text-gray-800 tracking-tight mb-1">
                Finding suitable venues…
              </p>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Scanning availability for{' '}
                <span className="font-medium text-violet-500">
                  {autoSuggestParticipants} participant{parseInt(autoSuggestParticipants) !== 1 ? 's' : ''}
                </span>
              </p>

              {/* Bouncing dots */}
              <div className="flex items-center gap-1.5 mt-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400"
                    style={{ animation: `venueDotsbounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>

              <style>{`
                @keyframes venueDotsbounce {
                  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                  40% { transform: scale(1); opacity: 1; }
                }
              `}</style>
            </div>
          )}

          {/* ── Header ── */}
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
                onClick={() => { setShowAutoSuggestModal(false); if (!selectedSuggestion) setLocationMode('manual'); }}
                className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">

            {/* ── Inputs section ── */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">

              {/* Participants */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Participants <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                </label>
                <Input
                  type="number" min="1" placeholder="How many people?"
                  value={autoSuggestParticipants}
                  onChange={(e) => {
                    setAutoSuggestParticipants(e.target.value);
                    setShowSuggestions(false); setSuggestedLocations([]); setSelectedSuggestion(null);
                  }}
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
                          setShowSuggestions(false); setSuggestedLocations([]);
                        }}
                        disabled={isDateDisabled} initialFocus />
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
                        onSelect={(d) => { setAutoSuggestEndDate(d ?? undefined); setShowSuggestions(false); setSuggestedLocations([]); }}
                        disabled={(d) => isDateDisabled(d) || (!!autoSuggestStartDate && d < autoSuggestStartDate)}
                        initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Multi-day notice */}
              {autoSuggestStartDate && autoSuggestEndDate && autoSuggestEndDate.getTime() !== autoSuggestStartDate.getTime() && (
                <div className="flex items-center gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  <span>
                    <strong>{buildDateRange(autoSuggestStartDate, autoSuggestEndDate).length}-day event</strong> — venues booked on any of those days will be marked unavailable.
                  </span>
                </div>
              )}

              {/* Time row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Start time
                    <span className="text-gray-400 normal-case tracking-normal font-normal">(optional)</span>
                  </label>
                  <Select value={autoSuggestStartTime} onValueChange={(v) => {
                    setAutoSuggestStartTime(v);
                    const toMin = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
                    if (autoSuggestEndTime && toMin(v) >= toMin(autoSuggestEndTime)) setAutoSuggestEndTime('');
                    setShowSuggestions(false); setSuggestedLocations([]);
                  }}>
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
                  <Select value={autoSuggestEndTime}
                    onValueChange={(v) => { setAutoSuggestEndTime(v); setShowSuggestions(false); setSuggestedLocations([]); }}
                    disabled={!autoSuggestStartTime}>
                    <SelectTrigger className="h-9 text-sm bg-white border-gray-200 rounded-lg" disabled={!autoSuggestStartTime}>
                      <SelectValue placeholder={autoSuggestStartTime ? 'Select' : '—'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {generateTimeOptions()
                        .filter((t) => {
                          if (!autoSuggestStartTime) return false;
                          const toMin = (x: string) => { const [h,m] = x.split(':').map(Number); return h*60+m; };
                          return toMin(t.value) > toMin(autoSuggestStartTime);
                        })
                        .map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Find button ── */}
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

            {/* ── Results ── */}
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
                      className={`w-full text-left rounded-xl border transition-all duration-150 group ${
                        sug.isBooked
                          ? 'border-gray-200 bg-gray-50 opacity-55 cursor-not-allowed'
                          : selectedSuggestion === sug.name
                          ? 'border-violet-400 bg-violet-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-sm cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">

                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          sug.isBooked ? 'bg-gray-100' : 'bg-violet-50 group-hover:bg-violet-100'
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
                    Select a venue to auto-fill your schedule and view available equipment
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* ── End Auto Suggest Modal ──────────────────────────────────────────── */}

    </div>
  );
};

export default RequestEventPage;