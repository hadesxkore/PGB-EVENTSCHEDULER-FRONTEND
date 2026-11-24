import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Cable, CalendarOff, CalendarRange, CheckCircle2, Monitor, PanelTop, Plus,
  RefreshCw, Search, Settings, Shield, Trash2, Tv, Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle,
} from '@/components/ui/item';
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from '@/components/ui/empty';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('authToken')}` });
const errorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

// ─── Types & helpers ─────────────────────────────────────────────────────────

interface Equipment {
  id: string;
  name: string;
  type: string;
}

interface Schedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  reason: string;
  setBy?: { name: string; email: string };
}

type Status = 'available' | 'scheduled' | 'unavailable';
type Phase = 'active' | 'upcoming' | 'past';

const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  'LED Wall with Operator': Monitor,
  'LED Wall': PanelTop,
  'Projector with VGA': Monitor,
  'Internet Connection': Wifi,
  'TV': Tv,
  '10-meter HDMI Cable': Cable,
};
const iconFor = (name: string) => EQUIPMENT_ICONS[name] ?? Settings;

const REASON_PRESETS = [
  'Under Maintenance',
  'Borrowed Outside the System',
  'Reserved for Internal Use',
  'Currently in Use',
  'Hardware Repair',
  'Software Update',
];

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> = {
  available: { label: 'Available', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  scheduled: { label: 'Scheduled', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  unavailable: { label: 'Unavailable', dot: 'bg-destructive', text: 'text-destructive' },
};

const todayKey = () => format(new Date(), 'yyyy-MM-dd');

const phaseOf = (s: Schedule, today: string): Phase =>
  s.endDate < today ? 'past' : s.startDate > today ? 'upcoming' : 'active';

const belongsTo = (s: Schedule, eq: Equipment) => s.equipmentId === eq.id || s.equipmentName === eq.name;

const dayCount = (s: Schedule) =>
  differenceInCalendarDays(parseISO(s.endDate), parseISO(s.startDate)) + 1;

const formatRange = (start: string, end: string) => {
  const a = parseISO(start);
  const b = parseISO(end);
  if (start === end) return format(a, 'MMM d, yyyy');
  if (a.getFullYear() === b.getFullYear()) return `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}`;
  return `${format(a, 'MMM d, yyyy')} – ${format(b, 'MMM d, yyyy')}`;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const statusFor = (items: Schedule[], today: string): Status => {
  if (items.some(s => phaseOf(s, today) === 'active')) return 'unavailable';
  if (items.some(s => phaseOf(s, today) === 'upcoming')) return 'scheduled';
  return 'available';
};

const statusLine = (items: Schedule[], status: Status, today: string) => {
  if (status === 'unavailable') {
    const active = items.find(s => phaseOf(s, today) === 'active')!;
    return `Blocked until ${format(parseISO(active.endDate), 'MMM d')}${active.reason ? ` · ${active.reason}` : ''}`;
  }
  if (status === 'scheduled') {
    const next = items
      .filter(s => phaseOf(s, today) === 'upcoming')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    return `Next block ${formatRange(next.startDate, next.endDate)}`;
  }
  return 'Open for event requests';
};

const toRanges = (items: Schedule[]) =>
  items.map(s => ({ from: parseISO(s.startDate), to: parseISO(s.endDate) }));

const BLOCKED_DAY_CLASS =
  'rounded-md bg-destructive/10 font-medium text-destructive';

// ─── Small pieces ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-normal', meta.text)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-destructive/15" /> Blocked
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-accent ring-1 ring-border" /> Today
      </span>
    </div>
  );
}

interface ScheduleRowProps {
  schedule: Schedule;
  showEquipment?: boolean;
  muted?: boolean;
  onDelete: (s: Schedule) => void;
}

function ScheduleRow({ schedule: s, showEquipment, muted, onDelete }: ScheduleRowProps) {
  const Icon = iconFor(s.equipmentName);
  const meta = [
    showEquipment ? formatRange(s.startDate, s.endDate) : null,
    plural(dayCount(s), 'day'),
    s.reason || null,
    s.setBy?.name ? `by ${s.setBy.name}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Item variant="outline" size="sm" className={cn('bg-card', muted && 'opacity-60')}>
      {showEquipment && (
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
      )}
      <ItemContent className="min-w-0">
        <ItemTitle className="truncate">
          {showEquipment ? s.equipmentName : formatRange(s.startDate, s.endDate)}
        </ItemTitle>
        <ItemDescription className="line-clamp-2">{meta}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label="Remove schedule"
              onClick={() => onDelete(s)}
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove block</TooltipContent>
        </Tooltip>
      </ItemActions>
    </Item>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

// ─── Add schedule dialog ─────────────────────────────────────────────────────

interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
  schedules: Schedule[];
  defaultEquipmentId: string;
  onSaved: () => Promise<void>;
}

function ScheduleFormDialog({
  open, onOpenChange, equipment, schedules, defaultEquipmentId, onSaved,
}: ScheduleFormDialogProps) {
  const [equipmentId, setEquipmentId] = useState('');
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEquipmentId(defaultEquipmentId);
    setRange(undefined);
    setReason('');
  }, [open, defaultEquipmentId]);

  const selected = equipment.find(e => e.id === equipmentId);
  const existing = useMemo(
    () => (selected ? schedules.filter(s => belongsTo(s, selected)) : []),
    [selected, schedules],
  );

  const from = range?.from;
  const to = range?.to ?? range?.from;
  const startStr = from ? format(from, 'yyyy-MM-dd') : '';
  const endStr = to ? format(to, 'yyyy-MM-dd') : '';
  // `open` guard: the refetch after saving lands while the dialog fades out.
  const overlaps = open && !!from && existing.some(s => s.startDate <= endStr && s.endDate >= startStr);
  const canSubmit = !!selected && !!from && !saving;

  const submit = async () => {
    if (!selected || !from || !to) return;
    setSaving(true);
    try {
      await axios.post(
        `${API_BASE_URL}/resource-availability/pito/schedules`,
        { equipmentId: selected.id, equipmentName: selected.name, startDate: startStr, endDate: endStr, reason },
        { headers: authHeaders() },
      );
      toast.success(`${selected.name} blocked for ${formatRange(startStr, endStr)}`);
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save schedule'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as unavailable</DialogTitle>
          <DialogDescription>
            Users won't be able to request this equipment on the selected dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pito-equipment">Equipment</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger id="pito-equipment" className="w-full">
                <SelectValue placeholder="Choose equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map(eq => {
                  const Icon = iconFor(eq.name);
                  return (
                    <SelectItem key={eq.id} value={eq.id}>
                      <Icon className="text-muted-foreground" />
                      {eq.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Dates</Label>
              <span className="text-xs text-muted-foreground">
                {from
                  ? `${formatRange(startStr, endStr)} · ${plural(differenceInCalendarDays(to!, from) + 1, 'day')}`
                  : 'Pick a start and end date'}
              </span>
            </div>
            <div className="flex justify-center rounded-lg border">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                defaultMonth={from ?? new Date()}
                disabled={{ before: startOfToday() }}
                modifiers={{ blocked: toRanges(existing) }}
                modifiersClassNames={{ blocked: BLOCKED_DAY_CLASS }}
                className="bg-transparent"
              />
            </div>
            <AnimatePresence initial={false}>
              {overlaps && (
                <motion.p {...fadeUp} className="text-xs text-destructive">
                  This range overlaps an existing block for {selected?.name}.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pito-reason">
              Reason <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {REASON_PRESETS.map(r => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={reason === r ? 'default' : 'outline'}
                  className="h-7 rounded-full px-3 text-xs font-normal"
                  onClick={() => setReason(reason === r ? '' : r)}
                >
                  {r}
                </Button>
              ))}
            </div>
            <Textarea
              id="pito-reason"
              placeholder="Or write your own…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving ? <Spinner /> : <CalendarOff />}
            {saving ? 'Saving…' : 'Mark unavailable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PitoEquipmentAvailabilityPage() {
  const canManage = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('userData') || '{}');
      const dept = (u.department || u.departmentName || '').trim().toUpperCase();
      const role = (u.role || '').trim().toLowerCase();
      return dept === 'PITO' || role === 'admin' || role === 'superadmin';
    } catch {
      return false;
    }
  }, []);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState('equipment');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [scheduleEquipment, setScheduleEquipment] = useState('all');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formEquipmentId, setFormEquipmentId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Data ──
  const fetchEquipment = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/resource-availability/pito/equipment`, { headers: authHeaders() });
      if (res.data.success) setEquipment(res.data.data);
    } catch {
      toast.error('Failed to load PITO equipment list');
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/resource-availability/pito/schedules`, { headers: authHeaders() });
      if (res.data.success) setSchedules(res.data.data);
    } catch {
      toast.error('Failed to load unavailability schedules');
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    Promise.all([fetchEquipment(), fetchSchedules()]).finally(() => setLoading(false));
  }, [canManage, fetchEquipment, fetchSchedules]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEquipment(), fetchSchedules()]);
    setRefreshing(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/resource-availability/pito/schedules`, {
        headers: authHeaders(),
        data: { scheduleId: deleteTarget.id },
      });
      toast.success(`${deleteTarget.equipmentName} is available again for those dates`);
      setDeleteOpen(false);
      await fetchSchedules();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to remove schedule'));
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived ──
  const today = todayKey();

  const rows = useMemo(() => equipment.map(eq => {
    const items = schedules.filter(s => belongsTo(s, eq));
    const status = statusFor(items, today);
    return { eq, items, status, line: statusLine(items, status, today) };
  }), [equipment, schedules, today]);

  const counts = useMemo(() => ({
    total: rows.length,
    unavailable: rows.filter(r => r.status === 'unavailable').length,
    upcoming: schedules.filter(s => phaseOf(s, today) === 'upcoming').length,
    active: schedules.filter(s => phaseOf(s, today) !== 'past').length,
  }), [rows, schedules, today]);

  const visibleRows = rows.filter(r =>
    r.eq.name.toLowerCase().includes(query.trim().toLowerCase()) &&
    (statusFilter === 'all' || r.status === statusFilter),
  );

  const scheduleGroups = useMemo(() => {
    const eq = equipment.find(e => e.id === scheduleEquipment);
    const list = eq ? schedules.filter(s => belongsTo(s, eq)) : schedules;
    const byStart = (a: Schedule, b: Schedule) => a.startDate.localeCompare(b.startDate);
    return [
      { key: 'active', label: 'Happening now', items: list.filter(s => phaseOf(s, today) === 'active').sort(byStart) },
      { key: 'upcoming', label: 'Upcoming', items: list.filter(s => phaseOf(s, today) === 'upcoming').sort(byStart) },
      {
        key: 'past', label: 'Ended',
        items: list.filter(s => phaseOf(s, today) === 'past').sort((a, b) => b.endDate.localeCompare(a.endDate)),
      },
    ];
  }, [equipment, schedules, scheduleEquipment, today]);

  const detail = rows.find(r => r.eq.id === detailId);

  const requestDelete = (s: Schedule) => { setDeleteTarget(s); setDeleteOpen(true); };
  const openDetail = (id: string) => { setDetailId(id); setDetailOpen(true); };
  const openForm = (eqId = '') => { setFormEquipmentId(eqId); setFormOpen(true); };
  const jumpTo = (filter: 'all' | Status) => { setTab('equipment'); setStatusFilter(filter); };

  // ── Access guard ──
  if (!canManage) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Shield /></EmptyMedia>
          <EmptyTitle>Access restricted</EmptyTitle>
          <EmptyDescription>This page is only available to PITO department users.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const stats = [
    { label: 'Equipment', value: counts.total, onClick: () => jumpTo('all') },
    { label: 'Unavailable today', value: counts.unavailable, onClick: () => jumpTo('unavailable'), tone: 'text-destructive' },
    { label: 'Upcoming blocks', value: counts.upcoming, onClick: () => setTab('schedules') },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6"
        >
          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Equipment Availability</h1>
              <p className="max-w-prose text-sm text-muted-foreground">
                Block PITO equipment for specific dates. Blocked dates can't be requested on the
                Request Event page and reopen automatically when the period ends.
              </p>
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={refresh} disabled={refreshing} aria-label="Refresh">
                    <RefreshCw className={cn(refreshing && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Button className="flex-1 sm:flex-none" onClick={() => openForm()}>
                <Plus /> Mark unavailable
              </Button>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {stats.map((s, i) => (
              <motion.button
                key={s.label}
                type="button"
                onClick={s.onClick}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.05 * i } }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col gap-1 rounded-xl border bg-card px-3 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5 sm:py-4"
              >
                <span className="text-xs text-muted-foreground sm:text-sm">{s.label}</span>
                {loading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <span className={cn('text-xl font-semibold tabular-nums sm:text-2xl', s.value > 0 && s.tone)}>
                    {s.value}
                  </span>
                )}
              </motion.button>
            ))}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="gap-4">
            <TabsList className="w-full sm:w-fit sm:self-start">
              <TabsTrigger value="equipment" className="flex-1 sm:flex-none">Equipment</TabsTrigger>
              <TabsTrigger value="schedules" className="flex-1 sm:flex-none">
                Schedules
                {counts.active > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                    {counts.active}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Equipment tab */}
            <TabsContent value="equipment" className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <InputGroup className="sm:max-w-xs">
                  <InputGroupInput
                    placeholder="Search equipment"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                  <InputGroupAddon><Search /></InputGroupAddon>
                </InputGroup>
                <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={statusFilter}
                    onValueChange={v => v && setStatusFilter(v as 'all' | Status)}
                    className="w-max"
                  >
                    <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
                    <ToggleGroupItem value="available" className="px-3">Available</ToggleGroupItem>
                    <ToggleGroupItem value="scheduled" className="px-3">Scheduled</ToggleGroupItem>
                    <ToggleGroupItem value="unavailable" className="px-3">Unavailable</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-md" />)}
                </div>
              ) : visibleRows.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Search /></EmptyMedia>
                    <EmptyTitle>No equipment found</EmptyTitle>
                    <EmptyDescription>Try a different search or filter.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {visibleRows.map(({ eq, status, line }, i) => {
                      const Icon = iconFor(eq.name);
                      return (
                        <motion.div
                          key={eq.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.03, 0.25) } }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <Item variant="outline" asChild className="h-full bg-card hover:bg-accent/50">
                            <button type="button" onClick={() => openDetail(eq.id)} className="w-full cursor-pointer text-left">
                              <ItemMedia variant="icon" className="size-10 rounded-lg">
                                <Icon className="size-5" />
                              </ItemMedia>
                              <ItemContent className="min-w-0">
                                <ItemTitle className="w-full truncate">{eq.name}</ItemTitle>
                                <span className="min-[400px]:hidden"><StatusBadge status={status} /></span>
                                <ItemDescription className="line-clamp-1 text-pretty">{line}</ItemDescription>
                              </ItemContent>
                              <ItemActions className="hidden self-start min-[400px]:flex">
                                <StatusBadge status={status} />
                              </ItemActions>
                            </button>
                          </Item>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
            </TabsContent>

            {/* Schedules tab */}
            <TabsContent value="schedules" className="space-y-4">
              <Select value={scheduleEquipment} onValueChange={setScheduleEquipment}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All equipment</SelectItem>
                  {equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
                </div>
              ) : scheduleGroups.every(g => g.items.length === 0) ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><CheckCircle2 /></EmptyMedia>
                    <EmptyTitle>Everything is available</EmptyTitle>
                    <EmptyDescription>No unavailability has been scheduled.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-6">
                  {scheduleGroups.filter(g => g.items.length > 0).map(g => (
                    <section key={g.key} className="space-y-2">
                      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {g.label} · {g.items.length}
                      </h2>
                      <ItemGroup className="gap-2">
                        <AnimatePresence initial={false}>
                          {g.items.map(s => (
                            <motion.div key={s.id} layout {...fadeUp}>
                              <ScheduleRow
                                schedule={s}
                                showEquipment
                                muted={g.key === 'past'}
                                onDelete={requestDelete}
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </ItemGroup>
                    </section>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Equipment detail */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
            {detail && (() => {
              const Icon = iconFor(detail.eq.name);
              const sorted = [...detail.items].sort((a, b) => a.startDate.localeCompare(b.startDate));
              return (
                <>
                  <SheetHeader className="gap-3 border-b p-4 sm:p-6">
                    <div className="flex items-center gap-3 pr-8">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <SheetTitle className="truncate">{detail.eq.name}</SheetTitle>
                        <SheetDescription className="capitalize">{detail.eq.type} equipment</SheetDescription>
                      </div>
                    </div>
                    <StatusBadge status={detail.status} />
                  </SheetHeader>

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-6 p-4 sm:p-6">
                      <div className="space-y-3">
                        <div className="rounded-lg border">
                          <Calendar
                            defaultMonth={new Date()}
                            modifiers={{ blocked: toRanges(detail.items) }}
                            modifiersClassNames={{ blocked: BLOCKED_DAY_CLASS }}
                            className="w-full bg-transparent"
                            classNames={{ root: 'w-full' }}
                          />
                        </div>
                        <CalendarLegend />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">Blocked dates</h3>
                        {sorted.length === 0 ? (
                          <Empty className="border p-6 md:p-6">
                            <EmptyHeader>
                              <EmptyMedia variant="icon"><CalendarRange /></EmptyMedia>
                              <EmptyTitle className="text-base">No blocks</EmptyTitle>
                              <EmptyDescription>Available for all event requests.</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        ) : (
                          <ItemGroup className="gap-2">
                            <AnimatePresence initial={false}>
                              {sorted.map(s => (
                                <motion.div key={s.id} layout {...fadeUp}>
                                  <ScheduleRow
                                    schedule={s}
                                    muted={phaseOf(s, today) === 'past'}
                                    onDelete={requestDelete}
                                  />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </ItemGroup>
                        )}
                      </div>
                    </div>
                  </ScrollArea>

                  <SheetFooter className="border-t p-4">
                    <Button onClick={() => openForm(detail.eq.id)}>
                      <Plus /> Block dates
                    </Button>
                  </SheetFooter>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        <ScheduleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          equipment={equipment}
          schedules={schedules}
          defaultEquipmentId={formEquipmentId}
          onSaved={fetchSchedules}
        />

        {/* Delete confirm */}
        <AlertDialog open={deleteOpen} onOpenChange={open => !deleting && setDeleteOpen(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this block?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && (
                  <>
                    <span className="font-medium text-foreground">{deleteTarget.equipmentName}</span> will be
                    available again for {formatRange(deleteTarget.startDate, deleteTarget.endDate)}.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={e => { e.preventDefault(); confirmDelete(); }}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting && <Spinner />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </MotionConfig>
  );
}
