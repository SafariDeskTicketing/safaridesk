import React, { useEffect, useState } from 'react';
import { Edit, X, Clock, Save, Lock } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import Spinner from '../../../components/ui/DataLoader';
import { EmptyState } from '../../../components/ui/NoItems';

type BusinessHour = {
  id: string | number;
  name: string;
  day_of_week: number; // 0=Monday, 1=Tuesday... 6=Sunday
  start_time: string;
  end_time: string;
  is_working_day: boolean;
};

type BusinessHoursComponentProps = {
  onEdit?: () => void;
  onUpdateHours?: (updatedHour: BusinessHour) => void;
  reload: number;
  setBusinessHoursCount: React.Dispatch<React.SetStateAction<number>>;
  includeWeekends?: boolean;
};

const BusinessHoursComponent: React.FC<BusinessHoursComponentProps> = ({
  onEdit,
  onUpdateHours,
  reload,
  setBusinessHoursCount,
  includeWeekends = true

}) => {
  console.log('BusinessHoursComponent received includeWeekends:', includeWeekends);
  const [selectedHour, setSelectedHour] = useState<BusinessHour | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState<BusinessHour | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHour[] | [] >([]);
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const loadBusinessHours = async () => {
      try{
        setLoading(true)

        const response = await http.get(APIS.LOAD_BUSINESS_HOURS);
        console.log('🔍 BUSINESS HOURS API RESPONSE:');
        console.log('Full response:', JSON.stringify(response.data, null, 2));
        console.log('Is Array?', Array.isArray(response.data));
        console.log('Has results?', 'results' in (response.data || {}));
        
        // Handle both direct array and paginated response
        let businessHoursData: BusinessHour[] = [];
        
        if (Array.isArray(response.data)) {
          businessHoursData = response.data;
          console.log('✅ Direct array response');
        } else if (response.data && Array.isArray(response.data.results)) {
          businessHoursData = response.data.results;
          console.log('✅ Paginated response with results array');
        } else {
          console.log('❌ Unexpected response format:', typeof response.data);
        }
        
        console.log('📋 Business hours data:', businessHoursData);
        console.log('📊 Count:', businessHoursData.length);
        
        setBusinessHours(businessHoursData);
        setBusinessHoursCount(businessHoursData.filter((day: BusinessHour) => day.is_working_day).length);
        
        if (businessHoursData.length === 0) {
          console.log('⚠️ No business hours found - backend should have auto-created defaults');
          errorNotification("No business hours configured. Please contact support.");
        } else {
          console.log(`✅ Loaded ${businessHoursData.length} business hours`);
        }
      }catch(error: any){
          console.error('Failed to load business hours:', error);
          errorNotification(error?.response?.data?.message || "Failed to load business hours");
          setBusinessHours([]);
          setBusinessHoursCount(0);
      }finally{
        setTimeout(() => setLoading(false), 100)
      }
    }

  useEffect(() => {
    loadBusinessHours()
  }, [reload])



  const handleCardClick = (hour: BusinessHour) => {
    setSelectedHour(hour);
    setEditForm({ ...hour }); // No need to map, use day_of_week directly
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedHour(null);
    setEditForm(null);
  };

  const handleSave = async () => {
    if (!editForm || timeValidationError) return;
    
    try {
      setLoading(true);
      await http.put(`${APIS.LOAD_BUSINESS_HOURS}${editForm.id}/`, {
        is_working_day: editForm.is_working_day,
        start_time: editForm.start_time,
        end_time: editForm.end_time
      });
      
      successNotification('Business hours updated successfully');
      handleCloseModal();
      await loadBusinessHours();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update business hours');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field: keyof BusinessHour, value: any) => {
    if (editForm) {
      const updatedForm = { ...editForm, [field]: value };
      setEditForm(updatedForm);
      
      // Validate times if both start and end times are set
      if (field === 'start_time' || field === 'end_time') {
        const startTime = field === 'start_time' ? value : updatedForm.start_time;
        const endTime = field === 'end_time' ? value : updatedForm.end_time;
        
        if (startTime && endTime && startTime >= endTime) {
          setTimeValidationError('End time must be after start time');
        } else {
          setTimeValidationError(null);
        }
      }
    }
  };

  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  if(loading) {
   return <Spinner/>
  }

  if (businessHours.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState title='No Business hours configured' />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-[var(--border-color)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-[#202020]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Day</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hours</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-[var(--border-color)]">
            {businessHours.map((schedule) => {
              const isWeekend = schedule.day_of_week === 5 || schedule.day_of_week === 6;
              const isDisabled = !includeWeekends && isWeekend;
              const dayName = weekdays[schedule.day_of_week];
              
              return (
                <tr key={schedule.id} className="bg-white dark:bg-[var(--app-bg)] hover:bg-gray-50 dark:hover:bg-[var(--hover-bg)]">
                  {/* Column 1: Day */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{dayName}</span>
                      {isWeekend && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 rounded uppercase font-semibold">
                          Weekend
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Column 2: Operating Hours */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {isDisabled
                      ? '—'
                      : schedule.is_working_day
                      ? `${schedule.start_time} - ${schedule.end_time}`
                      : '—'
                    }
                  </td>

                  {/* Column 3: Status */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {isDisabled ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Inactive</span>
                          <Lock size={14} className="text-gray-400" />
                        </>
                      ) : schedule.is_working_day ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-primary-500" />
                          <span className="text-sm text-gray-900 dark:text-white">Open</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-sm text-gray-900 dark:text-white">Closed</span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Column 4: Action */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    {isDisabled ? (
                      <button
                        disabled
                        className="text-gray-400 cursor-not-allowed"
                        title="Weekend hours locked"
                      >
                        <Lock size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCardClick(schedule)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        title="Edit hours"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>



      <Modal 
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)} 
      title={`Edit ${editForm ? weekdays[editForm.day_of_week] : ''} Hours`}> 
      {
        editForm && (
             <div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_working_day"
                  checked={editForm.is_working_day}
                  onChange={(e) => handleFormChange('is_working_day', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_working_day" className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                  Working Day
                </label>
              </div>
              {/* Add name field for consistency with API */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name" // Added name attribute
                  value={editForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-subtle rounded-md bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {editForm.is_working_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Start Time
                    </label>
                    <select
                      value={editForm.start_time}
                      onChange={(e) => handleFormChange('start_time', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-subtle rounded-md bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      End Time
                    </label>
                    <select
                      value={editForm.end_time}
                      onChange={(e) => handleFormChange('end_time', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-subtle rounded-md bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {timeValidationError && (
                <div className="text-red-500 dark:text-red-400 text-xs font-medium">
                  {timeValidationError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-subtle">
              <button
                onClick={handleSave}
                disabled={timeValidationError !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
        </div>
        )
      }
       
      </Modal>
    </div>
  );
};

export default BusinessHoursComponent;
