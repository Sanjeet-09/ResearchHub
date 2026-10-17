import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { equipmentApi, projectApi } from '../services/api';
import {
  PageHeader,
  Tabs,
  Card,
  Button,
  Input,
  Textarea,
  Badge,
  Skeleton,
  EmptyState,
  Dialog,
  ConfirmDialog,
  StatusDot,
} from '../components/ui';
import {
  CalendarClock,
  Plus,
  Search,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Edit3,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Check,
  XCircle,
  Wrench,
  User,
  FolderKanban,
  X,
  Layers,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';

// ─── Local Date Helpers (Prevent Timezone Offset Shifts) ─────────────────────
const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
};

const formatLocalDate = (d) => {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ─── Typeahead / Searchable Dropdown Component ───────────────────────────────
const SearchableSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Type to search or select...',
  emptyMessage = 'No options available',
  isLoading = false,
  onRetry = null,
  required = false,
  disabled = false,
  icon: Icon = null,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Sync displayed query with current value
  useEffect(() => {
    if (selectedOption) {
      setSearchQuery(selectedOption.label);
    } else if (!value) {
      setSearchQuery('');
    }
  }, [value, selectedOption]);

  // Close when clicking outside and reset text if nothing chosen
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (selectedOption) {
          setSearchQuery(selectedOption.label);
        } else if (!value) {
          setSearchQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, value]);

  // Filter options based on user typing
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    if (selectedOption && searchQuery === selectedOption.label) return true;
    const q = searchQuery.toLowerCase();
    const matchLabel = opt.label?.toLowerCase().includes(q);
    const matchSublabel = opt.sublabel?.toLowerCase().includes(q);
    return matchLabel || matchSublabel;
  });

  const handleSelect = (option) => {
    if (option.disabled) return;
    onChange(option.value, option);
    setSearchQuery(option.label);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-txt uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-danger">*</span>}
          </span>
          {options.length > 0 && (
            <span className="text-[10px] text-txt-faint font-normal lowercase">
              {options.length} {options.length === 1 ? 'choice' : 'choices'}
            </span>
          )}
        </label>
      )}

      {/* Input / Combobox Box */}
      <div
        className={`relative flex items-center bg-surface border rounded-input transition-all ${
          isOpen ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-border-strong'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            if (inputRef.current) inputRef.current.select();
          }
        }}
      >
        {Icon && (
          <div className="pl-3 text-txt-faint shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-transparent px-3 py-2 text-xs text-txt placeholder-txt-faint focus:outline-none ${
            Icon ? 'pl-2' : ''
          }`}
        />

        {/* Clear & Chevron actions */}
        <div className="flex items-center pr-2 gap-1 shrink-0">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-txt-faint hover:text-txt rounded hover:bg-surface-3 transition-colors"
              title="Clear text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen(!isOpen);
            }}
            className="p-1 text-txt-muted hover:text-txt rounded transition-colors"
            title="Toggle dropdown"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Filtered Options List */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-surface-2 border border-border rounded-lg shadow-xl py-1 text-xs divide-y divide-border/40 backdrop-blur-md">
          {isLoading ? (
            <div className="p-3 text-center text-txt-muted flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
              <span>Loading choices...</span>
            </div>
          ) : options.length === 0 ? (
            <div className="p-3 text-center space-y-2">
              <p className="text-txt-muted">{emptyMessage}</p>
              {onRetry && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                  }}
                  className="mx-auto text-[11px] py-1"
                >
                  Retry Loading
                </Button>
              )}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-txt-muted space-y-1">
              <p>No matches for "{searchQuery}"</p>
              <p className="text-[10px] text-txt-faint">Try a different name, room, or search term</p>
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={opt.value || 'none'}
                  onClick={() => handleSelect(opt)}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed bg-surface/20'
                      : isSelected
                      ? 'bg-accent/15 text-txt font-semibold'
                      : 'hover:bg-surface-3 text-txt'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate block font-medium">{opt.label}</span>
                      {opt.badge && (
                        <Badge
                          variant={opt.badge.toLowerCase().includes('inactive') ? 'danger' : 'secondary'}
                          className="text-[9px] px-1 py-0 shrink-0"
                        >
                          {opt.badge}
                        </Badge>
                      )}
                    </div>
                    {opt.sublabel && (
                      <span className="text-[11px] text-txt-faint truncate block mt-0.5">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const EquipmentPage = () => {
  const { user } = useAuth();
  const isProfessor = user?.role === 'professor' || user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('catalogue');

  // ─── Catalogue State ────────────────────────────────────────────────────────
  const [equipmentList, setEquipmentList] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [equipmentError, setEquipmentError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all', 'active', 'inactive'

  // ─── Calendar State ─────────────────────────────────────────────────────────
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    return formatLocalDate(new Date());
  });
  const [calendarReservations, setCalendarReservations] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // ─── My Reservations State ──────────────────────────────────────────────────
  const [myReservations, setMyReservations] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [mineError, setMineError] = useState(null);

  // ─── History State ──────────────────────────────────────────────────────────
  const [historyReservations, setHistoryReservations] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ─── Modal States ───────────────────────────────────────────────────────────
  // Book Reservation Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookEquipmentId, setBookEquipmentId] = useState('');
  const [bookProjectId, setBookProjectId] = useState('');
  const [bookDate, setBookDate] = useState(() => formatLocalDate(new Date()));
  const [bookStartTime, setBookStartTime] = useState('09:00');
  const [bookEndTime, setBookEndTime] = useState('11:00');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingConflictError, setBookingConflictError] = useState(null);

  // User projects for booking form
  const [userProjects, setUserProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Add / Edit Equipment Modal (Professor only)
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [formEqName, setFormEqName] = useState('');
  const [formEqLocation, setFormEqLocation] = useState('');
  const [formEqDescription, setFormEqDescription] = useState('');
  const [formEqIsActive, setFormEqIsActive] = useState(true);
  const [equipmentFormLoading, setEquipmentFormLoading] = useState(false);

  // Delete Confirm Dialog
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Cancel Reservation Confirm Dialog
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ─── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchEquipment = async () => {
    try {
      setLoadingEquipment(true);
      setEquipmentError(null);
      const data = await equipmentApi.getEquipment();
      setEquipmentList(data || []);
      if (data && data.length > 0) {
        setSelectedEquipmentId((prev) => prev || data[0].id);
      }
    } catch (err) {
      setEquipmentError(err.response?.data?.error?.message || 'Failed to load equipment catalogue');
    } finally {
      setLoadingEquipment(false);
    }
  };

  const fetchCalendar = async (equipmentId, weekStart) => {
    if (!equipmentId) return;
    try {
      setLoadingCalendar(true);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const data = await equipmentApi.getCalendar(
        equipmentId,
        weekStart.toISOString(),
        weekEnd.toISOString()
      );
      setCalendarReservations(data.reservations || []);
    } catch (err) {
      console.error('Failed to load calendar', err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const fetchMyReservations = async () => {
    try {
      setLoadingMine(true);
      setMineError(null);
      const data = await equipmentApi.getMyReservations();
      setMyReservations(data || []);
    } catch (err) {
      setMineError(err.response?.data?.error?.message || 'Failed to load your reservations');
    } finally {
      setLoadingMine(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await equipmentApi.getReservationHistory({ limit: 50 });
      setHistoryReservations(data.reservations || []);
      setHistoryTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await projectApi.getProjects();
      setUserProjects(data || []);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && selectedEquipmentId) {
      fetchCalendar(selectedEquipmentId, currentWeekStart);
    } else if (activeTab === 'mine') {
      fetchMyReservations();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, selectedEquipmentId, currentWeekStart]);

  // ─── Calendar Navigation & Date Selection ───────────────────────────────────
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);

    const sel = parseLocalDate(selectedCalendarDate);
    sel.setDate(sel.getDate() - 7);
    setSelectedCalendarDate(formatLocalDate(sel));
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);

    const sel = parseLocalDate(selectedCalendarDate);
    sel.setDate(sel.getDate() + 7);
    setSelectedCalendarDate(formatLocalDate(sel));
  };

  const handleTodayWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
    setSelectedCalendarDate(formatLocalDate(new Date()));
  };

  const handleJumpToDate = (dateStr) => {
    if (!dateStr) return;
    const d = parseLocalDate(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
    setSelectedCalendarDate(dateStr);
  };

  const getDaysOfWeek = (start) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getDaysOfWeek(currentWeekStart);

  // Format week range label
  const formatWeekLabel = () => {
    const startMonth = currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const end = new Date(currentWeekStart);
    end.setDate(currentWeekStart.getDate() + 6);
    const endMonth = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startMonth} – ${endMonth}`;
  };

  // ─── Booking Handlers ───────────────────────────────────────────────────────
  const handleOpenBookingModal = (equipmentId = null, prefillDate = null, prefillStart = '09:00', prefillEnd = '11:00') => {
    setBookingConflictError(null);
    setBookEquipmentId(equipmentId || selectedEquipmentId || (equipmentList[0]?.id || ''));
    if (prefillDate) {
      setBookDate(prefillDate);
    } else if (selectedCalendarDate) {
      setBookDate(selectedCalendarDate);
    } else {
      setBookDate(formatLocalDate(new Date()));
    }
    setBookStartTime(prefillStart);
    setBookEndTime(prefillEnd);
    setIsBookModalOpen(true);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingConflictError(null);

    const startDateTime = new Date(`${bookDate}T${bookStartTime}:00`);
    const endDateTime = new Date(`${bookDate}T${bookEndTime}:00`);

    if (startDateTime >= endDateTime) {
      setBookingConflictError('End time must be later than start time.');
      return;
    }

    const now = new Date();
    if (endDateTime <= now || startDateTime < new Date(now.getTime() - 2 * 60 * 1000)) {
      setBookingConflictError('Cannot book a reservation in the past. Please select a future time slot.');
      return;
    }

    try {
      setBookingLoading(true);
      await equipmentApi.createReservation({
        equipmentId: bookEquipmentId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        projectId: bookProjectId || null,
      });

      setIsBookModalOpen(false);
      // Refresh current active view
      if (activeTab === 'calendar') {
        fetchCalendar(bookEquipmentId, currentWeekStart);
      } else if (activeTab === 'mine') {
        fetchMyReservations();
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to create reservation.';
      setBookingConflictError(msg);
    } finally {
      setBookingLoading(false);
    }
  };

  // ─── Equipment Create / Edit Handlers ───────────────────────────────────────
  const handleOpenAddEquipment = () => {
    setEditingEquipment(null);
    setFormEqName('');
    setFormEqLocation('');
    setFormEqDescription('');
    setFormEqIsActive(true);
    setIsEquipmentModalOpen(true);
  };

  const handleOpenEditEquipment = (eq) => {
    setEditingEquipment(eq);
    setFormEqName(eq.name || '');
    setFormEqLocation(eq.location || '');
    setFormEqDescription(eq.description || '');
    setFormEqIsActive(eq.is_active);
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (e) => {
    e.preventDefault();
    if (!formEqName.trim()) return;

    try {
      setEquipmentFormLoading(true);
      if (editingEquipment) {
        await equipmentApi.updateEquipment(editingEquipment.id, {
          name: formEqName.trim(),
          location: formEqLocation.trim() || null,
          description: formEqDescription.trim() || null,
          isActive: formEqIsActive,
        });
      } else {
        await equipmentApi.createEquipment({
          name: formEqName.trim(),
          location: formEqLocation.trim() || null,
          description: formEqDescription.trim() || null,
          isActive: formEqIsActive,
        });
      }

      setIsEquipmentModalOpen(false);
      fetchEquipment();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to save equipment');
    } finally {
      setEquipmentFormLoading(false);
    }
  };

  // ─── Equipment Delete Handlers ──────────────────────────────────────────────
  const handleOpenDeleteEquipment = (eq) => {
    setEquipmentToDelete(eq);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteEquipmentConfirm = async () => {
    if (!equipmentToDelete) return;
    try {
      setDeleteLoading(true);
      await equipmentApi.deleteEquipment(equipmentToDelete.id);
      setIsDeleteModalOpen(false);
      setEquipmentToDelete(null);
      fetchEquipment();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete equipment');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Cancel Reservation Handlers ────────────────────────────────────────────
  const handleOpenCancelReservation = (resItem) => {
    setReservationToCancel(resItem);
    setIsCancelModalOpen(true);
  };

  const handleCancelReservationConfirm = async () => {
    if (!reservationToCancel) return;
    try {
      setCancelLoading(true);
      await equipmentApi.cancelReservation(reservationToCancel.id);
      setIsCancelModalOpen(false);
      setReservationToCancel(null);

      if (activeTab === 'mine') fetchMyReservations();
      if (activeTab === 'calendar') fetchCalendar(selectedEquipmentId, currentWeekStart);
      if (activeTab === 'history') fetchHistory();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to cancel reservation');
    } finally {
      setCancelLoading(false);
    }
  };

  // ─── Filter Catalogue ───────────────────────────────────────────────────────
  const filteredEquipment = equipmentList.filter((eq) => {
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && eq.is_active) ||
      (filterActive === 'inactive' && !eq.is_active);

    const matchesSearch =
      !searchQuery.trim() ||
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (eq.location && eq.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (eq.description && eq.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  // Catalogue shows only user-added equipment (people add their own instruments)
  const isSampleEquipment = (eq) => eq.id && eq.id.startsWith('c0000000-');
  const catalogueEquipment = filteredEquipment.filter((eq) => !isSampleEquipment(eq));

  const selectedEquipment = equipmentList.find((e) => e.id === selectedEquipmentId) || equipmentList[0];

  const tabs = [
    { id: 'catalogue', label: 'Equipment Catalogue' },
    { id: 'calendar', label: 'Weekly Calendar' },
    { id: 'mine', label: 'My Reservations' },
    { id: 'history', label: 'Booking History' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Equipment Reservation"
        description="Schedule laboratory instruments, check weekly availability, and prevent reservation conflicts."
        action={
          <div className="flex items-center gap-3">
            {isProfessor && (
              <Button variant="secondary" icon={Wrench} onClick={handleOpenAddEquipment}>
                Add Equipment
              </Button>
            )}
            <Button variant="primary" icon={Plus} onClick={() => handleOpenBookingModal()}>
              Book Reservation
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ─── TAB 1: EQUIPMENT CATALOGUE ────────────────────────────────────────── */}
      {activeTab === 'catalogue' && (
        <div className="space-y-6">
          {/* Action & Filter Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
              <input
                type="text"
                placeholder="Search equipment by name, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border rounded-input pl-9 pr-8 py-2 text-xs text-txt placeholder-txt-faint focus:outline-none focus:border-accent transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-faint hover:text-txt"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-surface-2 rounded-lg border border-border">
              {['all', 'active', 'inactive'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterActive(f)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    filterActive === f
                      ? 'bg-surface text-txt font-semibold shadow-sm'
                      : 'text-txt-muted hover:text-txt'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {equipmentError && (
            <Card className="p-4 border-danger/40 bg-danger/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-danger">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{equipmentError}</span>
              </div>
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchEquipment}>
                Retry
              </Button>
            </Card>
          )}

          {/* Skeleton Loaders */}
          {loadingEquipment && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-5 space-y-3">
                  <Skeleton className="w-3/4 h-5" />
                  <Skeleton className="w-1/2 h-4" />
                  <Skeleton className="w-full h-12" />
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingEquipment && !equipmentError && catalogueEquipment.length === 0 && (
            <EmptyState
              icon={Wrench}
              title={searchQuery ? 'No matching instruments' : 'No equipment in catalogue'}
              description={
                searchQuery
                  ? `No instruments matched "${searchQuery}". Try clearing your search.`
                  : 'Get started by registering laboratory equipment for students and researchers to book.'
              }
              action={
                isProfessor && (
                  <Button variant="primary" icon={Plus} onClick={handleOpenAddEquipment}>
                    Add First Instrument
                  </Button>
                )
              }
            />
          )}

          {/* Equipment Grid */}
          {!loadingEquipment && !equipmentError && catalogueEquipment.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogueEquipment.map((eq) => (
                <Card
                  key={eq.id}
                  className="p-5 flex flex-col justify-between hover:border-border-strong transition-all duration-200 group relative"
                >
                  <div className="space-y-3">
                    {/* Header: Name & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusDot status={eq.is_active ? 'active' : 'inactive'} />
                          <h3 className="font-semibold text-sm text-txt group-hover:text-accent transition-colors">
                            {eq.name}
                          </h3>
                        </div>
                        {eq.location && (
                          <p className="text-xs text-txt-muted flex items-center gap-1 mt-1 pl-4">
                            <MapPin className="w-3 h-3 text-txt-faint" />
                            {eq.location}
                          </p>
                        )}
                      </div>

                      {/* Professor Actions Menu */}
                      {isProfessor && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditEquipment(eq)}
                            className="p-1 text-txt-faint hover:text-txt rounded hover:bg-surface-2 transition-colors"
                            title="Edit Equipment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteEquipment(eq)}
                            className="p-1 text-txt-faint hover:text-danger rounded hover:bg-danger/10 transition-colors"
                            title="Delete Equipment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-txt-muted line-clamp-3 pl-4">
                      {eq.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Card Footer: Quick Actions */}
                  <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between gap-2">
                    <Badge variant={eq.is_active ? 'success' : 'secondary'} className="text-[10px]">
                      {eq.is_active ? 'Available' : 'Maintenance / Inactive'}
                    </Badge>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setSelectedEquipmentId(eq.id);
                          setActiveTab('calendar');
                        }}
                      >
                        Calendar
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!eq.is_active}
                        onClick={() => handleOpenBookingModal(eq.id)}
                      >
                        Book
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: WEEKLY CALENDAR & AVAILABILITY ──────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Controls: Typeable Instrument Picker & Date / Week Navigator */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Typeahead Instrument Selector Dropdown */}
              <div className="w-full lg:w-96">
                <SearchableSelect
                  label="Select Laboratory Instrument"
                  value={selectedEquipmentId}
                  onChange={(val) => setSelectedEquipmentId(val)}
                  options={equipmentList.map((eq) => ({
                    value: eq.id,
                    label: eq.name,
                    sublabel: eq.location ? `${eq.location} ${eq.description ? '• ' + eq.description : ''}` : eq.description,
                    badge: eq.is_active ? null : 'Inactive',
                    disabled: false,
                  }))}
                  placeholder="Type instrument name or room..."
                  emptyMessage="No equipment available"
                  isLoading={loadingEquipment}
                  onRetry={fetchEquipment}
                  icon={Wrench}
                />
              </div>

              {/* Date Selection: Jump to Date Picker & Week Navigation */}
              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0">
                {/* Direct Date Picker */}
                <div className="flex items-center gap-2 bg-surface border border-border rounded-input px-3 py-1.5 hover:border-border-strong transition-colors">
                  <CalendarDays className="w-4 h-4 text-accent shrink-0" />
                  <label htmlFor="jump-to-date-input" className="text-xs font-semibold text-txt uppercase tracking-wider shrink-0 cursor-pointer">
                    Jump to Date:
                  </label>
                  <input
                    id="jump-to-date-input"
                    type="date"
                    value={selectedCalendarDate}
                    onChange={(e) => handleJumpToDate(e.target.value)}
                    className="bg-transparent text-xs text-txt font-mono focus:outline-none cursor-pointer"
                    title="Select any date to view its week and schedule"
                  />
                </div>

                {/* Week Navigator Buttons */}
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={handlePrevWeek} title="Previous Week" />
                  <Button variant="secondary" size="sm" onClick={handleTodayWeek} title="Jump to Current Week">
                    Today
                  </Button>
                  <Button variant="secondary" size="sm" icon={ChevronRight} onClick={handleNextWeek} title="Next Week" />
                </div>
              </div>
            </div>

            {/* Active Selected Day Bar & Quick Book */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border/60 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-txt-muted">Week:</span>
                <span className="font-semibold text-txt font-mono">{formatWeekLabel()}</span>
                <span className="text-txt-faint">•</span>
                <span className="text-txt-muted">Selected Day:</span>
                <span className="font-semibold text-accent font-mono bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                  {parseLocalDate(selectedCalendarDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {selectedEquipment && (
                  <>
                    <span className="text-txt-faint">•</span>
                    <span className="text-txt-muted truncate">
                      Viewing: <strong className="text-txt">{selectedEquipment.name}</strong>
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  disabled={selectedCalendarDate < formatLocalDate(new Date())}
                  title={selectedCalendarDate < formatLocalDate(new Date()) ? 'Cannot book for a past date' : ''}
                  onClick={() => handleOpenBookingModal(selectedEquipmentId, selectedCalendarDate)}
                >
                  Book for Selected Date
                </Button>
              </div>
            </div>
          </div>

          {/* Weekly Calendar Grid */}
          <Card className="p-4 overflow-x-auto">
            <div className="min-w-[850px]">
              {/* Day Header Row (Interactive Buttons for Date Selection) */}
              <div className="grid grid-cols-7 gap-2 mb-3 border-b border-border pb-3 text-center">
                {weekDays.map((day, idx) => {
                  const dayStr = formatLocalDate(day);
                  const isSelected = dayStr === selectedCalendarDate;
                  const isToday = formatLocalDate(new Date()) === dayStr;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedCalendarDate(dayStr)}
                      className={`p-2 rounded-lg text-center transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-accent/15 border border-accent/60 shadow-sm'
                          : 'hover:bg-surface-3 border border-transparent'
                      }`}
                      title={`Click to select ${dayStr}`}
                    >
                      <span
                        className={`text-[11px] uppercase tracking-wider font-semibold block transition-colors ${
                          isSelected ? 'text-accent' : 'text-txt-muted group-hover:text-txt'
                        }`}
                      >
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <div
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold mt-1 transition-all ${
                          isSelected
                            ? 'bg-accent text-white ring-2 ring-accent/40 ring-offset-1 ring-offset-surface-2'
                            : isToday
                            ? 'bg-surface-3 text-accent font-extrabold border border-accent/30'
                            : 'text-txt group-hover:bg-surface-2'
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      {isSelected && (
                        <span className="text-[9px] text-accent font-semibold block mt-1 tracking-tight">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Day Columns Content */}
              {loadingCalendar ? (
                <div className="grid grid-cols-7 gap-2 h-72">
                  {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                    <Skeleton key={col} className="h-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2 min-h-[320px]">
                  {weekDays.map((day, colIdx) => {
                    const dayStart = new Date(day);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(day);
                    dayEnd.setHours(23, 59, 59, 999);

                    // Filter reservations for this specific day
                    const dayReservations = calendarReservations.filter((res) => {
                      const resStart = new Date(res.start_time);
                      const resEnd = new Date(res.end_time);
                      return resStart <= dayEnd && resEnd >= dayStart;
                    });

                    const dateString = formatLocalDate(day);
                    const isSelected = dateString === selectedCalendarDate;

                    return (
                      <div
                        key={colIdx}
                        onClick={() => setSelectedCalendarDate(dateString)}
                        className={`border rounded-lg p-2 flex flex-col justify-between space-y-2 group transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-accent/[0.06] border-accent/70 ring-1 ring-accent/30 shadow-md'
                            : 'bg-surface-2/40 border-border/50 hover:border-border'
                        }`}
                      >
                        {/* Bookings for the day */}
                        <div className="space-y-2">
                          {dayReservations.length === 0 ? (
                            <div className="py-8 text-center space-y-1">
                              <p className="text-[11px] text-txt-faint font-medium">Available</p>
                              <span className="text-[10px] text-txt-faint opacity-50 block">No bookings</span>
                            </div>
                          ) : (
                            dayReservations.map((res) => {
                              const s = new Date(res.start_time);
                              const e = new Date(res.end_time);
                              const timeStr = `${s.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })} - ${e.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}`;

                              const isMyBooking = res.user_id === user?.id;

                              return (
                                <div
                                  key={res.id}
                                  className={`p-2 rounded border text-xs space-y-1 transition-all ${
                                    isMyBooking
                                      ? 'bg-accent/15 border-accent/40 text-txt shadow-sm'
                                      : 'bg-surface-3 border-border/80 text-txt-muted'
                                  }`}
                                  title={`Booked by: ${res.user_name || 'Member'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] text-accent font-semibold flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {timeStr}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-txt block truncate">
                                    {res.user_name || 'Member'}
                                  </span>
                                  {res.project_title && (
                                    <span className="text-[10px] text-txt-faint truncate block">
                                      {res.project_title}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Quick Book Button for this Day */}
                        {dateString < formatLocalDate(new Date()) ? (
                          <div className="w-full text-[10px] py-1 text-center text-txt-faint font-mono border border-border/40 rounded bg-surface-2/30 select-none">
                            Past
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`w-full text-[11px] py-1 border border-dashed transition-all ${
                              isSelected
                                ? 'border-accent text-accent bg-accent/10 opacity-100 font-semibold'
                                : 'border-border/60 hover:border-accent text-txt-muted hover:text-accent opacity-70 group-hover:opacity-100'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBookingModal(selectedEquipmentId, dateString);
                            }}
                          >
                            + Book {day.toLocaleDateString(undefined, { weekday: 'short' })}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB 3: MY RESERVATIONS ────────────────────────────────────────────── */}
      {activeTab === 'mine' && (
        <div className="space-y-4">
          {mineError && (
            <Card className="p-4 border-danger/40 bg-danger/5 flex items-center justify-between">
              <span className="text-xs text-danger">{mineError}</span>
              <Button variant="secondary" size="sm" onClick={fetchMyReservations}>
                Retry
              </Button>
            </Card>
          )}

          {loadingMine && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 space-y-2">
                  <Skeleton className="w-1/3 h-5" />
                  <Skeleton className="w-1/4 h-4" />
                </Card>
              ))}
            </div>
          )}

          {!loadingMine && !mineError && myReservations.length === 0 && (
            <EmptyState
              icon={CalendarClock}
              title="No reservations booked yet"
              description="You have not booked any laboratory instruments yet. Reserve an instrument from the catalogue or weekly calendar."
              action={
                <Button variant="primary" icon={Plus} onClick={() => handleOpenBookingModal()}>
                  Book Equipment
                </Button>
              }
            />
          )}

          {!loadingMine && !mineError && myReservations.length > 0 && (
            <div className="space-y-3">
              {myReservations.map((res) => {
                const s = new Date(res.start_time);
                const e = new Date(res.end_time);
                const dateStr = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                const isPast = e < new Date();
                const isBooked = res.status === 'booked';

                return (
                  <Card
                    key={res.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-border-strong transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isBooked ? (isPast ? 'secondary' : 'success') : 'danger'}
                          className="capitalize text-[10px]"
                        >
                          {isBooked ? (isPast ? 'Completed' : 'Booked') : 'Cancelled'}
                        </Badge>
                        <h4 className="text-sm font-semibold text-txt">{res.equipment_name}</h4>
                        {res.equipment_location && (
                          <span className="text-xs text-txt-muted flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-accent" />
                            {res.equipment_location}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-txt-muted">
                        <span className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-txt-faint" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1.5 text-accent font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          {timeStr}
                        </span>
                        {res.project_title && (
                          <span className="flex items-center gap-1.5 font-sans text-txt-faint">
                            <FolderKanban className="w-3.5 h-3.5" />
                            {res.project_title}
                          </span>
                        )}
                      </div>
                    </div>

                    {isBooked && !isPast && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/10 border border-danger/30 text-xs shrink-0"
                        onClick={() => handleOpenCancelReservation(res)}
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: BOOKING HISTORY ────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">
              System Reservation History ({historyTotal})
            </h3>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchHistory} disabled={loadingHistory}>
              Refresh
            </Button>
          </div>

          {loadingHistory && (
            <div className="space-y-3 py-4">
              <Skeleton className="w-full h-8" />
              <Skeleton className="w-full h-8" />
              <Skeleton className="w-full h-8" />
            </div>
          )}

          {!loadingHistory && historyReservations.length === 0 && (
            <p className="text-xs text-txt-muted py-8 text-center">No reservation records found.</p>
          )}

          {!loadingHistory && historyReservations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-txt-muted uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Instrument</th>
                    <th className="py-2.5 px-3">Reserved By</th>
                    <th className="py-2.5 px-3">Start Time</th>
                    <th className="py-2.5 px-3">End Time</th>
                    <th className="py-2.5 px-3">Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-txt font-mono">
                  {historyReservations.map((h) => (
                    <tr key={h.id} className="hover:bg-surface-2 transition-colors">
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={h.status === 'booked' ? 'success' : 'secondary'}
                          className="capitalize text-[9px] py-0"
                        >
                          {h.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-txt">
                        {h.equipment_name}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-txt-muted">
                        {h.user_name || 'Member'}
                      </td>
                      <td className="py-2.5 px-3 text-txt-faint">
                        {new Date(h.start_time).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-txt-faint">
                        {new Date(h.end_time).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-txt-muted">
                        {h.project_title || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── MODAL: BOOK RESERVATION ───────────────────────────────────────────── */}
      <Dialog
        isOpen={isBookModalOpen}
        onClose={() => !bookingLoading && setIsBookModalOpen(false)}
        title="Book Equipment Reservation"
      >
        <form onSubmit={handleBookingSubmit} className="space-y-4">
          {/* Conflict Error Alert (409) */}
          {bookingConflictError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/40 flex items-start gap-2.5 text-xs text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Booking Conflict (409)</span>
                <span>{bookingConflictError}</span>
              </div>
            </div>
          )}

          {/* Typeable Equipment Picker */}
          <SearchableSelect
            label="Equipment Instrument"
            value={bookEquipmentId}
            onChange={(val) => setBookEquipmentId(val)}
            options={equipmentList.map((eq) => ({
              value: eq.id,
              label: eq.name,
              sublabel: eq.location || 'No location specified',
              badge: eq.is_active ? 'Active' : 'Inactive (Unavailable)',
              disabled: !eq.is_active,
            }))}
            placeholder="Type to search equipment or room..."
            emptyMessage="No equipment available"
            isLoading={loadingEquipment}
            onRetry={fetchEquipment}
            required
            icon={Wrench}
          />

          {/* Date Picker with Quick Date Chips */}
          <div>
            <label className="block text-xs font-semibold text-txt uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>
                Reservation Date <span className="text-danger">*</span>
              </span>
              <span className="text-[10px] text-accent font-mono font-normal">
                {bookDate
                  ? parseLocalDate(bookDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : ''}
              </span>
            </label>
            <div className="relative">
              <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint pointer-events-none" />
              <input
                type="date"
                min={formatLocalDate(new Date())}
                value={bookDate}
                onChange={(e) => setBookDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-input pl-9 pr-3 py-2 text-xs text-txt font-mono focus:outline-none focus:border-accent"
                required
              />
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 pt-2 flex-wrap">
              <span className="text-[10px] text-txt-faint uppercase tracking-wider font-semibold mr-1">
                Quick Select:
              </span>
              <button
                type="button"
                onClick={() => setBookDate(formatLocalDate(new Date()))}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  bookDate === formatLocalDate(new Date())
                    ? 'bg-accent/20 border-accent text-accent font-semibold'
                    : 'bg-surface-2 border-border text-txt-muted hover:text-txt'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setBookDate(formatLocalDate(d));
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  setBookDate(formatLocalDate(d));
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
              >
                +2 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setBookDate(formatLocalDate(d));
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* Time Pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-txt uppercase tracking-wider mb-1.5">
                Start Time <span className="text-danger">*</span>
              </label>
              <input
                type="time"
                value={bookStartTime}
                onChange={(e) => setBookStartTime(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt font-mono focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt uppercase tracking-wider mb-1.5">
                End Time <span className="text-danger">*</span>
              </label>
              <input
                type="time"
                value={bookEndTime}
                onChange={(e) => setBookEndTime(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt font-mono focus:outline-none focus:border-accent"
                required
              />
            </div>
          </div>

          {/* Quick Slot Presets */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <span className="text-[10px] text-txt-faint uppercase tracking-wider font-semibold mr-1">
              Time Slots:
            </span>
            <button
              type="button"
              onClick={() => {
                setBookStartTime('09:00');
                setBookEndTime('10:00');
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
            >
              1h (09-10)
            </button>
            <button
              type="button"
              onClick={() => {
                setBookStartTime('10:00');
                setBookEndTime('12:00');
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
            >
              2h (10-12)
            </button>
            <button
              type="button"
              onClick={() => {
                setBookStartTime('14:00');
                setBookEndTime('16:00');
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
            >
              2h (14-16)
            </button>
            <button
              type="button"
              onClick={() => {
                setBookStartTime('14:00');
                setBookEndTime('17:00');
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-txt-muted hover:text-txt"
            >
              3h (14-17)
            </button>
          </div>

          {/* Typeable Project Picker */}
          <SearchableSelect
            label="Associate Project (Optional)"
            value={bookProjectId}
            onChange={(val) => setBookProjectId(val)}
            options={[
              {
                value: '',
                label: 'No linked project (Personal)',
                sublabel: 'Personal lab work / independent study',
              },
              ...userProjects.map((p) => ({
                value: p.id,
                label: p.title,
                sublabel: `Status: ${p.status} ${p.owner_name ? '• ' + p.owner_name : ''}`,
              })),
            ]}
            placeholder="Type to search project or leave personal..."
            emptyMessage="No projects found"
            isLoading={loadingProjects}
            onRetry={fetchProjects}
            icon={FolderKanban}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBookModalOpen(false)}
              disabled={bookingLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={bookingLoading}>
              {bookingLoading ? 'Confirming...' : 'Confirm Reservation'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ─── MODAL: ADD / EDIT EQUIPMENT (Professor only) ──────────────────────── */}
      {isProfessor && (
        <Dialog
          isOpen={isEquipmentModalOpen}
          onClose={() => !equipmentFormLoading && setIsEquipmentModalOpen(false)}
          title={editingEquipment ? 'Edit Equipment' : 'Add Laboratory Equipment'}
        >
          <form onSubmit={handleSaveEquipment} className="space-y-4">
            <Input
              label="Equipment Name"
              placeholder="e.g. Scanning Electron Microscope (SEM-500)"
              value={formEqName}
              onChange={(e) => setFormEqName(e.target.value)}
              required
            />

            <Input
              label="Location / Room"
              placeholder="e.g. Building B - Room 102"
              value={formEqLocation}
              onChange={(e) => setFormEqLocation(e.target.value)}
            />

            <Textarea
              label="Description / Specifications"
              placeholder="Details on capabilities, usage policies, or prerequisites..."
              value={formEqDescription}
              onChange={(e) => setFormEqDescription(e.target.value)}
              rows={3}
            />

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active_toggle"
                checked={formEqIsActive}
                onChange={(e) => setFormEqIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <label htmlFor="is_active_toggle" className="text-xs text-txt font-medium cursor-pointer">
                Available for booking (Active status)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEquipmentModalOpen(false)}
                disabled={equipmentFormLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={equipmentFormLoading || !formEqName.trim()}>
                {equipmentFormLoading ? 'Saving...' : editingEquipment ? 'Update Equipment' : 'Create Equipment'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ─── CONFIRM: DELETE EQUIPMENT ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteEquipmentConfirm}
        title="Delete Equipment"
        message={`Are you sure you want to permanently delete "${equipmentToDelete?.name}"? All past and future reservations for this instrument will be deleted.`}
        confirmText="Delete Equipment"
        requiredText={equipmentToDelete?.name}
      />

      {/* ─── CONFIRM: CANCEL RESERVATION ──────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelReservationConfirm}
        title="Cancel Reservation"
        message={`Are you sure you want to cancel your reservation for "${reservationToCancel?.equipment_name}" on ${
          reservationToCancel ? new Date(reservationToCancel.start_time).toLocaleDateString() : ''
        }?`}
        confirmText="Cancel Reservation"
      />
    </div>
  );
};
