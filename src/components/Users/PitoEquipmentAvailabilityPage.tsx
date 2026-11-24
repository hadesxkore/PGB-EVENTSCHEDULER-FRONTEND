import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays, isBefore, isAfter, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Monitor, Wifi, Tv, Cable, PanelTop, Settings,
  Plus, Trash2, CalendarX, ChevronLeft, ChevronRight,
  Search, AlertTriangle, CheckCircle2, XCircle, Info,
  RefreshCw, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Equipment {
  id: string;
  name: string;
  type: string;
}

interface UnavailabilitySchedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  startDate: string;
  endDate: string;
  reason: string;
  setBy?: { name: string; email: string };
}

const EQUIPMENT_ICONS: Record<string, React.ReactNode> = {
  'LED Wall with Operator': <Monitor className="w-4 h-4" />,
  'LED Wall': <PanelTop className="w-4 h-4" />,
  'Projector with VGA': <Monitor className="w-4 h-4" />,
  'Internet Connection': <Wifi className="w-4 h-4" />,
  'TV': <Tv className="w-4 h-4" />,
  '10-meter HDMI Cable': <Cable className="w-4 h-4" />,
};

const REASON_PRESETS = [
  'Under Maintenance',
  'Borrowed Outside the System',
  'Reserved for Internal Use',
  'Currently in Use',
  'Hardware Repair',
  'Software Update',
];

// ─── Mini Calendar ───────────────────────────────────────────────────────────

interface MiniCalendarProps {
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  selectedStart: Date | null;
  selectedEnd: Date | null;
  onSelectDate: (d: Date) => void;
  unavailableDatesForEquipment: string[]; // YYYY-MM-DD strings
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  currentMonth, onMonthChange, selectedStart, selectedEnd,
  onSelectDate, unavailableDatesForEquipment,
}) => {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  const startPadding = start.getDay();

  const isInSelection = (d: Date) => {
    if (!selectedStart || !selectedEnd) return false;
    return !isBefore(d, selectedStart) && !isAfter(d, selectedEnd);
  };

  const isUnavailable = (d: Date) =>
    unavailableDatesForEquipment.includes(format(d, 'yyyy-MM-dd'));

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array(startPadding).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(d => {
          const isStart = selectedStart && isSameDay(d, selectedStart);
          const isEnd = selectedEnd && isSameDay(d, selectedEnd);
          const inSel = isInSelection(d);
          const unav = isUnavailable(d);
          const past = isBefore(d, new Date()) && !isToday(d);
          const today = isToday(d);

          return (
            <button
              key={d.toISOString()}
              onClick={() => !past && onSelectDate(d)}
              disabled={past}
              className={[
                'text-xs py-1.5 rounded-md font-medium transition-all',
                past ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
                (isStart || isEnd) ? 'bg-purple-600 text-white' :
                  inSel ? 'bg-purple-100 text-purple-800' :
                    unav ? 'bg-red-100 text-red-700 font-semibold' :
                      today ? 'ring-1 ring-purple-400 text-purple-700' :
                        'hover:bg-gray-100 text-gray-700',
              ].join(' ')}
            >
              {format(d, 'd')}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-100 inline-block" />
          Unavailable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-purple-600 inline-block" />
          Selected
        </span>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const PitoEquipmentAvailabilityPage: React.FC = () => {
  // Auth / permission guard
  const [isPito, setIsPito] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Data
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [schedules, setSchedules] = useState<UnavailabilitySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Add schedule modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEquipmentId, setAddEquipmentId] = useState('');
  const [addStart, setAddStart] = useState<Date | null>(null);
  const [addEnd, setAddEnd] = useState<Date | null>(null);
  const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');
  const [addReason, setAddReason] = useState('');
  const [addCalMonth, setAddCalMonth] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UnavailabilitySchedule | null>(null);

  // Per-equipment calendar unavailability dates (for calendar highlight)
  const [unavailDates, setUnavailDates] = useState<string[]>([]);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const u = JSON.parse(userData);
        const dept = (u.department || u.departmentName || '').trim().toUpperCase();
        const role = (u.role || '').trim().toLowerCase();
        if (dept === 'PITO' || role === 'admin' || role === 'superadmin') {
          setIsPito(true);
        }
      } catch { }
    }
    setCheckingAuth(false);
  }, []);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchEquipment = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get(`${API_BASE_URL}/resource-availability/pito/equipment`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setEquipment(res.data.data);
    } catch {
      toast.error('Failed to load PITO equipment list');
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get(`${API_BASE_URL}/resource-availability/pito/schedules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setSchedules(res.data.data);
    } catch {
      toast.error('Failed to load unavailability schedules');
    }
  }, []);

  useEffect(() => {
    if (!isPito) return;
    setLoading(true);
    Promise.all([fetchEquipment(), fetchSchedules()]).finally(() => setLoading(false));
  }, [isPito, fetchEquipment, fetchSchedules]);

  // ── Compute per-equipment calendar dates ─────────────────────────────────
  useEffect(() => {
    if (!selectedEquipment) { setUnavailDates([]); return; }
    const eq = selectedEquipment;
    // Collect all dates from schedules for this equipment
    const dates: string[] = [];
    schedules
      .filter(s => s.equipmentId === eq.id || s.equipmentName === eq.name)
      .forEach(s => {
        const cursor = new Date(s.startDate + 'T00:00:00');
        const last = new Date(s.endDate + 'T00:00:00');
        while (cursor <= last) {
          dates.push(format(cursor, 'yyyy-MM-dd'));
          cursor.setDate(cursor.getDate() + 1);
        }
      });
    setUnavailDates([...new Set(dates)]);
  }, [selectedEquipment, schedules]);

  // ── Calendar selection ───────────────────────────────────────────────────
  const handleCalendarSelect = (d: Date) => {
    if (selectionStep === 'start') {
      setAddStart(d);
      setAddEnd(null);
      setSelectionStep('end');
    } else {
      if (addStart && isBefore(d, addStart)) {
        // clicked before start → reset
        setAddStart(d);
        setAddEnd(null);
        setSelectionStep('end');
      } else {
        setAddEnd(d);
        setSelectionStep('start');
      }
    }
  };

  const openAddModal = (eq?: Equipment) => {
    setAddEquipmentId(eq?.id || '');
    setAddStart(null);
    setAddEnd(null);
    setAddReason('');
    setSelectionStep('start');
    setAddCalMonth(new Date());
    setShowAddModal(true);
  };

  // ── Submit schedule ───────────────────────────────────────────────────────
  const handleSubmitSchedule = async () => {
    if (!addEquipmentId || !addStart || !addEnd) {
      toast.error('Please select equipment and a date range');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const eq = equipment.find(e => e.id === addEquipmentId);
      await axios.post(
        `${API_BASE_URL}/resource-availability/pito/schedules`,
        {
          equipmentId: addEquipmentId,
          equipmentName: eq?.name || addEquipmentId,
          startDate: format(addStart, 'yyyy-MM-dd'),
          endDate: format(addEnd, 'yyyy-MM-dd'),
          reason: addReason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Marked as unavailable from ${format(addStart, 'MMM d')} to ${format(addEnd, 'MMM d, yyyy')}`);
      setShowAddModal(false);
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete schedule ───────────────────────────────────────────────────────
  const handleDeleteSchedule = async () => {
    if (!deleteTarget) return;
    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(`${API_BASE_URL}/resource-availability/pito/schedules`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          scheduleId: deleteTarget.id,
        },
      });
      toast.success('Unavailability schedule removed — equipment is available again');
      setDeleteTarget(null);
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove schedule');
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredEquipment = equipment.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const schedulesForSelected = selectedEquipment
    ? schedules.filter(s => s.equipmentId === selectedEquipment.id || s.equipmentName === selectedEquipment.name)
    : [];

  const allSchedulesSorted = [...schedules].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  const unavailableEquipmentIds = new Set(schedules.map(s => s.equipmentId));

  // ── Render ────────────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!isPito) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Shield className="w-12 h-12 text-gray-300" />
        <p className="text-lg font-semibold text-gray-700">Access Restricted</p>
        <p className="text-sm text-gray-500">This page is only accessible to PITO department users.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Monitor className="w-6 h-6 text-purple-600" />
              Equipment Availability Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage ICT equipment availability for event requests · PITO Department
            </p>
          </div>
          <Button
            onClick={() => openAddModal()}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Mark Unavailable
          </Button>
        </div>

        {/* ── Info banner ── */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 mb-6">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Equipment marked as <strong>unavailable</strong> will be automatically disabled in the
            Request Event page for users whose event dates overlap with the unavailability period.
            Availability is restored automatically once the period expires or when you remove a schedule.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Equipment List ── */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search equipment..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                ))
              ) : filteredEquipment.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No equipment found</div>
              ) : filteredEquipment.map(eq => {
                const isUnavailNow = unavailableEquipmentIds.has(eq.id);
                const isSelected = selectedEquipment?.id === eq.id;
                const eqSchedules = schedules.filter(s => s.equipmentId === eq.id || s.equipmentName === eq.name);

                return (
                  <div
                    key={eq.id}
                    onClick={() => setSelectedEquipment(isSelected ? null : eq)}
                    className={[
                      'p-3 rounded-lg border cursor-pointer transition-all',
                      isSelected
                        ? 'border-purple-400 bg-purple-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={isUnavailNow ? 'text-red-500' : 'text-gray-500'}>
                          {EQUIPMENT_ICONS[eq.name] || <Settings className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{eq.name}</p>
                          {eqSchedules.length > 0 && (
                            <p className="text-xs text-red-500">{eqSchedules.length} schedule(s)</p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          isUnavailNow
                            ? 'bg-red-50 text-red-700 border-red-200 text-xs'
                            : 'bg-green-50 text-green-700 border-green-200 text-xs'
                        }
                      >
                        {isUnavailNow ? (
                          <><XCircle className="w-3 h-3 mr-1" />Scheduled</>
                        ) : (
                          <><CheckCircle2 className="w-3 h-3 mr-1" />Available</>
                        )}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Calendar + Schedules ── */}
          <div className="lg:col-span-2 space-y-4">
            {selectedEquipment ? (
              <>
                {/* Equipment detail header */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">
                        {EQUIPMENT_ICONS[selectedEquipment.name] || <Settings className="w-5 h-5" />}
                      </span>
                      <div>
                        <h2 className="font-semibold text-gray-900">{selectedEquipment.name}</h2>
                        <p className="text-xs text-gray-500 capitalize">{selectedEquipment.type} equipment</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openAddModal(selectedEquipment)}
                      className="bg-purple-600 hover:bg-purple-700 text-white gap-1 text-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Add Schedule
                    </Button>
                  </div>

                  {/* Mini calendar */}
                  <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <MiniCalendar
                      currentMonth={addCalMonth}
                      onMonthChange={setAddCalMonth}
                      selectedStart={null}
                      selectedEnd={null}
                      onSelectDate={() => { }}
                      unavailableDatesForEquipment={unavailDates}
                    />
                  </div>
                </div>

                {/* Schedules list */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CalendarX className="w-4 h-4 text-red-500" />
                    Unavailability Schedules
                    {schedulesForSelected.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{schedulesForSelected.length}</Badge>
                    )}
                  </h3>

                  {schedulesForSelected.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-300" />
                      <p className="text-sm">No scheduled unavailability</p>
                      <p className="text-xs mt-1">This equipment is available for all event requests.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {schedulesForSelected.map(sch => (
                        <div
                          key={sch.id}
                          className="flex items-start justify-between p-3 rounded-lg bg-red-50 border border-red-100"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-red-800">
                                {format(parseISO(sch.startDate), 'MMM d')}
                                {sch.startDate !== sch.endDate && ` – ${format(parseISO(sch.endDate), 'MMM d, yyyy')}`}
                                {sch.startDate === sch.endDate && `, ${format(parseISO(sch.startDate), 'yyyy')}`}
                              </span>
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                                {sch.startDate === sch.endDate ? '1 day' : (
                                  `${Math.round((new Date(sch.endDate).getTime() - new Date(sch.startDate).getTime()) / 86400000) + 1} days`
                                )}
                              </Badge>
                            </div>
                            {sch.reason && (
                              <p className="text-xs text-red-600 mt-0.5 truncate">{sch.reason}</p>
                            )}
                            {sch.setBy && (
                              <p className="text-xs text-gray-400 mt-0.5">by {sch.setBy.name}</p>
                            )}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDeleteTarget(sch)}
                                className="ml-2 p-1.5 hover:bg-red-200 rounded-md text-red-500 transition-colors shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove this schedule</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── All schedules overview ── */
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-800 mb-1">All Unavailability Schedules</h3>
                <p className="text-sm text-gray-500 mb-4">Select an equipment item on the left to view its calendar, or see all schedules below.</p>

                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse mb-2" />
                  ))
                ) : allSchedulesSorted.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-300" />
                    <p className="font-medium">All equipment is available</p>
                    <p className="text-sm mt-1">No unavailability schedules have been set.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allSchedulesSorted.map(sch => (
                      <div
                        key={sch.id}
                        className="flex items-start justify-between p-3 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-colors group"
                      >
                        <div className="flex gap-3 flex-1 min-w-0">
                          <span className="text-gray-400 mt-0.5 shrink-0">
                            {EQUIPMENT_ICONS[sch.equipmentName] || <Settings className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{sch.equipmentName}</p>
                            <p className="text-xs text-gray-500">
                              {format(parseISO(sch.startDate), 'MMM d, yyyy')}
                              {sch.startDate !== sch.endDate && ` – ${format(parseISO(sch.endDate), 'MMM d, yyyy')}`}
                            </p>
                            {sch.reason && <p className="text-xs text-red-500 truncate">{sch.reason}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteTarget(sch)}
                          className="ml-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded-md text-red-400 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Add Schedule Modal ── */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarX className="w-5 h-5 text-red-500" />
                Schedule Equipment Unavailability
              </DialogTitle>
              <DialogDescription>
                Select equipment and pick the unavailable date range. Users will not be able to request this equipment for the selected dates.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Equipment select */}
              <div>
                <Label className="text-sm font-medium">Equipment Item *</Label>
                <Select value={addEquipmentId} onValueChange={setAddEquipmentId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select equipment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map(eq => (
                      <SelectItem key={eq.id} value={eq.id}>
                        <span className="flex items-center gap-2">
                          {EQUIPMENT_ICONS[eq.name] || <Settings className="w-3.5 h-3.5" />}
                          {eq.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Calendar */}
              <div>
                <Label className="text-sm font-medium">
                  Date Range *
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    {selectionStep === 'start' ? '— Click a start date' : '— Click an end date'}
                  </span>
                </Label>
                <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <MiniCalendar
                    currentMonth={addCalMonth}
                    onMonthChange={setAddCalMonth}
                    selectedStart={addStart}
                    selectedEnd={addEnd}
                    onSelectDate={handleCalendarSelect}
                    unavailableDatesForEquipment={
                      addEquipmentId
                        ? (equipment.find(e => e.id === addEquipmentId) ? unavailDates : [])
                        : []
                    }
                  />
                </div>
                {addStart && addEnd && (
                  <p className="text-xs text-purple-700 mt-1 font-medium">
                    Selected: {format(addStart, 'MMM d')} – {format(addEnd, 'MMM d, yyyy')}
                    {' '}({Math.round((addEnd.getTime() - addStart.getTime()) / 86400000) + 1} day(s))
                  </p>
                )}
                {addStart && !addEnd && (
                  <p className="text-xs text-gray-500 mt-1">
                    Start: {format(addStart, 'MMM d, yyyy')} — now click an end date
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <Label className="text-sm font-medium">Reason / Remarks (optional)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {REASON_PRESETS.map(r => (
                    <button
                      key={r}
                      onClick={() => setAddReason(r)}
                      className={[
                        'text-xs px-2 py-1 rounded-full border transition-colors',
                        addReason === r
                          ? 'bg-purple-100 border-purple-300 text-purple-700'
                          : 'border-gray-200 text-gray-600 hover:border-purple-200',
                      ].join(' ')}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Or type a custom reason..."
                  value={addReason}
                  onChange={e => setAddReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitSchedule}
                disabled={submitting || !addEquipmentId || !addStart || !addEnd}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                {submitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Saving...</>
                ) : (
                  <><CalendarX className="w-4 h-4" />Mark Unavailable</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirm Modal ── */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                Remove Schedule
              </DialogTitle>
              <DialogDescription>
                This will restore availability for <strong>{deleteTarget?.equipmentName}</strong> from{' '}
                {deleteTarget && format(parseISO(deleteTarget.startDate), 'MMM d')} to{' '}
                {deleteTarget && format(parseISO(deleteTarget.endDate), 'MMM d, yyyy')}.
                Users will be able to request this equipment again for those dates.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                onClick={handleDeleteSchedule}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Remove Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default PitoEquipmentAvailabilityPage;
