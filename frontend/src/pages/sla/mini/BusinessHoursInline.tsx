import React, { useState, useEffect } from 'react';
import { Clock, Save } from 'lucide-react';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';

type WeekSchedule = {
  monday_enabled: boolean;
  monday_start: string;
  monday_end: string;
  tuesday_enabled: boolean;
  tuesday_start: string;
  tuesday_end: string;
  wednesday_enabled: boolean;
  wednesday_start: string;
  wednesday_end: string;
  thursday_enabled: boolean;
  thursday_start: string;
  thursday_end: string;
  friday_enabled: boolean;
  friday_start: string;
  friday_end: string;
  saturday_enabled: boolean;
  saturday_start: string;
  saturday_end: string;
  sunday_enabled: boolean;
  sunday_start: string;
  sunday_end: string;
  pause_outside_hours: boolean;
  exclude_holidays: boolean;
};

const BusinessHoursInline: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>({
    monday_enabled: true,
    monday_start: '09:00',
    monday_end: '17:00',
    tuesday_enabled: true,
    tuesday_start: '09:00',
    tuesday_end: '17:00',
    wednesday_enabled: true,
    wednesday_start: '09:00',
    wednesday_end: '17:00',
    thursday_enabled: true,
    thursday_start: '09:00',
    thursday_end: '17:00',
    friday_enabled: true,
    friday_start: '09:00',
    friday_end: '17:00',
    saturday_enabled: false,
    saturday_start: '09:00',
    saturday_end: '17:00',
    sunday_enabled: false,
    sunday_start: '09:00',
    sunday_end: '17:00',
    pause_outside_hours: false,
    exclude_holidays: true,
  });

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  useEffect(() => {
    loadBusinessHours();
  }, []);

  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      const response = await http.get(APIS.SLA_CONFIG);
      
      if (response.data && response.data.data) {
        const config = response.data.data;
        
        // Map backend data to schedule state
        setSchedule({
          monday_enabled: config.monday_enabled ?? true,
          monday_start: config.monday_start || '09:00',
          monday_end: config.monday_end || '17:00',
          tuesday_enabled: config.tuesday_enabled ?? true,
          tuesday_start: config.tuesday_start || '09:00',
          tuesday_end: config.tuesday_end || '17:00',
          wednesday_enabled: config.wednesday_enabled ?? true,
          wednesday_start: config.wednesday_start || '09:00',
          wednesday_end: config.wednesday_end || '17:00',
          thursday_enabled: config.thursday_enabled ?? true,
          thursday_start: config.thursday_start || '09:00',
          thursday_end: config.thursday_end || '17:00',
          friday_enabled: config.friday_enabled ?? true,
          friday_start: config.friday_start || '09:00',
          friday_end: config.friday_end || '17:00',
          saturday_enabled: config.saturday_enabled ?? false,
          saturday_start: config.saturday_start || '09:00',
          saturday_end: config.saturday_end || '17:00',
          sunday_enabled: config.sunday_enabled ?? false,
          sunday_start: config.sunday_start || '09:00',
          sunday_end: config.sunday_end || '17:00',
          pause_outside_hours: config.pause_outside_hours ?? false,
          exclude_holidays: config.exclude_holidays ?? true,
        });
      }
    } catch (error: any) {
      console.error('Error loading business hours:', error);
      errorNotification('Failed to load business hours');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await http.patch(APIS.SLA_CONFIG, schedule);
      successNotification('Business hours updated successfully');
    } catch (error: any) {
      console.error('Error saving business hours:', error);
      errorNotification('Failed to save business hours');
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setSchedule({
      ...schedule,
      [`${day}_enabled`]: !schedule[`${day}_enabled` as keyof WeekSchedule],
    });
  };

  const handleTimeChange = (day: string, type: 'start' | 'end', value: string) => {
    setSchedule({
      ...schedule,
      [`${day}_${type}`]: value,
    });
  };

  const formatTimeForInput = (time: string) => {
    // Convert HH:MM:SS or HH:MM to HH:MM format
    if (!time) return '09:00';
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock size={18} className="text-gray-500" />
          Weekly Schedule
        </h3>
        
        <div className="space-y-3">
          {days.map(({ key, label }) => {
            const enabled = schedule[`${key}_enabled` as keyof WeekSchedule] as boolean;
            const startTime = formatTimeForInput(schedule[`${key}_start` as keyof WeekSchedule] as string);
            const endTime = formatTimeForInput(schedule[`${key}_end` as keyof WeekSchedule] as string);

            return (
              <div key={key} className="flex items-center gap-4 py-2">
                {/* Checkbox and Day Name */}
                <div className="flex items-center gap-2 w-32">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => handleDayToggle(key)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    {label}
                  </label>
                </div>

                {/* Start Time */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Start:</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                    disabled={!enabled}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* End Time */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">End:</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                    disabled={!enabled}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Additional Options
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={schedule.pause_outside_hours}
              onChange={(e) => setSchedule({ ...schedule, pause_outside_hours: e.target.checked })}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Pause SLA timer outside business hours
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={schedule.exclude_holidays}
              onChange={(e) => setSchedule({ ...schedule, exclude_holidays: e.target.checked })}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Exclude holidays from SLA calculations
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BusinessHoursInline;
