import React, { useState } from 'react';
import z from "zod";
import Button from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';

// Business Hours Schema
const businessHoursSchema = z.object({
  name: z.string().min(1, 'Business hours name is required'),
  day_of_week: z.number().min(0).max(6, 'Invalid day of week'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  is_working_day: z.boolean(),
});

type BusinessHours = z.infer<typeof businessHoursSchema>;

// Business Hours Form Component
type BusinessHoursFormProps = {
  onSucess: () => void;
};

const BusinessHoursForm: React.FC<BusinessHoursFormProps> = ({ onSucess }) => {
  const [ sending, setSending ] = useState<boolean>(false)
  
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([
    {
      name: "Default Business Hours",
      day_of_week: 0,
      start_time: "08:00",
      end_time: "17:00",
      is_working_day: true
    }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const validateBusinessHours = () => {
    const newErrors: Record<string, string> = {};
    
    businessHours.forEach((hour, index) => {
      try {
        businessHoursSchema.parse(hour);
        
        // Additional validation for time logic
        if (hour.is_working_day && hour.start_time >= hour.end_time) {
          newErrors[`time_${index}`] = 'End time must be after start time';
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(err => {
            newErrors[`${err.path.join('_')}_${index}`] = err.message;
          });
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateBusinessHours()) {
      // Build JSON and log it
      const data = businessHours.map(hour => ({
        name: hour.name,
        day_of_week: hour.day_of_week,
        start_time: hour.start_time,
        end_time: hour.end_time,
        is_working_day: hour.is_working_day
      }));
      const payload = {
        data: data
      }
      
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      
      try{
        setSending(true)
        const response = await http.post(APIS.CREATE_BUSINESS_HOURS, payload);
        console.log('Success response:', response.data);
        successNotification(response.data.message || 'Business hours created successfully')
        onSucess();
      }catch(error: any){
          console.error('Full error response:', error.response);
          
          // Handle specific error messages from backend
          if (error?.response?.data) {
            const errorData = error.response.data;
            
            // Check for duplicate day error
            if (errorData.error && errorData.error.includes('already exists')) {
              errorNotification('Business hours already exist for the selected days. All 7 days are pre-configured. Please edit existing schedules instead of adding new ones.');
              return;
            }
            
            // Check for skipped items
            if (errorData.skipped && errorData.skipped.length > 0) {
              const skipReasons = errorData.skipped.map((item: any) => 
                `${item.name || 'Day ' + item.day_of_week}: ${item.skip_reason}`
              ).join(', ');
              errorNotification(`Cannot add schedules: ${skipReasons}. All days are already configured.`);
              return;
            }
            
            // Generic backend error
            const errorMsg = errorData.message || 
                            errorData.error ||
                            errorData.detail ||
                            JSON.stringify(errorData);
            errorNotification(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
          } else {
            errorNotification(error?.message || "Failed to create business hours");
          }
      }finally{
        setSending(false)
      }
      
      
    }
  };

  const updateBusinessHour = (index: number, field: keyof BusinessHours, value: any) => {
    const updated = [...businessHours];
    updated[index] = { ...updated[index], [field]: value };
    setBusinessHours(updated);
  };

  const addBusinessHour = () => {
    setBusinessHours([...businessHours, {
      name: `Business Hours ${businessHours.length + 1}`,
      day_of_week: 0,
      start_time: "09:00",
      end_time: "17:00",
      is_working_day: true
    }]);
  };

  const removeBusinessHour = (index: number) => {
    if (businessHours.length > 1) {
      setBusinessHours(businessHours.filter((_, i) => i !== index));
    }
  };


  return (
    <div className=" rounded-lg w-full  overflow-y-auto">
            
            <div className="space-y-4">
              {businessHours.map((hour, index) => (
                <div key={index} className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                      Business Hours {index + 1}
                    </h3>
                    {businessHours.length > 1 && (
                      <Button 
                        onClick={() => removeBusinessHour(index)}
                        variant="outline"
                        size="sm"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Name"
                        value={hour.name}
                        onChange={(e) => updateBusinessHour(index, 'name', e.target.value)}
                        error={errors[`name_${index}`]}
                        fullWidth
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Day of Week
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        value={hour.day_of_week}
                        onChange={(e) => updateBusinessHour(index, 'day_of_week', parseInt(e.target.value))}
                      >
                        {weekdays.map((day, dayIndex) => (
                          <option key={dayIndex} value={dayIndex}>{day}</option>
                        ))}
                      </select>
                      {errors[`day_of_week_${index}`] && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors[`day_of_week_${index}`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <Input
                        label="Start Time"
                        type="time"
                        value={hour.start_time}
                        onChange={(e) => updateBusinessHour(index, 'start_time', e.target.value)}
                        error={errors[`start_time_${index}`] || errors[`time_${index}`]}
                        fullWidth
                        disabled={!hour.is_working_day}
                      />
                    </div>

                    <div>
                      <Input
                        label="End Time"
                        type="time"
                        value={hour.end_time}
                        onChange={(e) => updateBusinessHour(index, 'end_time', e.target.value)}
                        error={errors[`end_time_${index}`]}
                        fullWidth
                        disabled={!hour.is_working_day}
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={hour.is_working_day}
                          onChange={(e) => updateBusinessHour(index, 'is_working_day', e.target.checked)}
                          className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                          Working Day
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 mx-1">
              <Button onClick={addBusinessHour} variant="outline" className="w-full">
                Add Business Hours
              </Button>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-subtle mt-6">
              <Button onClick={handleSave} disabled={sending}>
                {
                  sending ? "Please wait..." : "Save Business Hours"
                }
              </Button>
            </div>
          </div>
  );
};

export default BusinessHoursForm;
