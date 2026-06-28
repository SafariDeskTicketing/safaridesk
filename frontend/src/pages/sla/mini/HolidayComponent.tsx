import React, { useState, useEffect } from 'react';
import { Calendar, Edit, Trash2, Plus, RefreshCw, AlertCircle, Save, Repeat } from 'lucide-react';
import { APIS } from '../../../services/apis';
import http from '../../../services/http';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/NoItems';

// Define the Holiday type locally
interface Holiday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  description: string;
  is_active: boolean;
}

type Props = {
    reload: number
}

const HolidaySkeleton = () => (
    <div className="group relative bg-white dark:bg-surface-elevated rounded-2xl p-6 border border-gray-200 dark:border-subtle animate-pulse">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-surface-hover" />
        <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-surface-hover" />
      </div>
      <div className="pr-12 mb-4">
        <div className="h-6 w-3/4 bg-gray-300 dark:bg-surface-hover rounded mb-2"></div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 bg-gray-300 dark:bg-surface-hover rounded"></div>
          <div className="h-4 w-1/2 bg-gray-300 dark:bg-surface-hover rounded"></div>
        </div>
        <div className="h-4 w-full bg-gray-300 dark:bg-surface-hover rounded mb-1"></div>
        <div className="h-4 w-5/6 bg-gray-300 dark:bg-surface-hover rounded"></div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-subtle">
        <div className="h-6 w-20 bg-gray-300 dark:bg-surface-hover rounded-full"></div>
      </div>
    </div>
  );

const HolidayComponent: React.FC<Props> = ({
    reload
}) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null as string | null,
    previous: null as string | null
  });
  
  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    is_recurring: false,
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchHolidays();
  }, [reload, activeFilter]);

  const fetchHolidays = async (url?: string) => {
    setLoading(true);
    try {
      setError(null);
      let apiUrl = new URL(url || APIS.HOLIDAYS, window.location.origin);
      
      if (url) {
        const urlParams = new URLSearchParams(new URL(url).search);
        if (urlParams.has('is_active')) {
            apiUrl.searchParams.delete('is_active');
        }
      }
      
      if (activeFilter !== null) {
        apiUrl.searchParams.set('is_active', String(activeFilter));
      }
      
      const response = await http.get(apiUrl.toString());
      const data = response.data;

      setHolidays(data.results);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous
      });
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Failed to fetch holidays');
      errorNotification(error?.response?.data?.message || 'Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: holiday.date,
      is_recurring: holiday.is_recurring,
      description: holiday.description,
      is_active: holiday.is_active
    });
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setIsCreateModalOpen(false);
    setEditingHoliday(null);
    setFormData({
      name: '',
      date: '',
      is_recurring: false,
      description: '',
      is_active: true
    });
  };

  const handleUpdateHoliday = async () => {
    if (!editingHoliday) return;
    
    try {
      setIsUpdating(true);
      const response = await http.patch(`${APIS.HOLIDAYS}${editingHoliday.id}/`, formData);
      
      if (response.status === 200) {
        successNotification('Holiday updated successfully');
        handleCloseModal();
        fetchHolidays();
      }
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update holiday');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateHoliday = async () => {
    try {
      setIsCreating(true);
      const response = await http.post(APIS.HOLIDAYS, formData);
      
      if (response.status === 201) {
        successNotification('Holiday created successfully');
        handleCloseModal();
        fetchHolidays();
      }
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to create holiday');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (holidayId: string) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await http.delete(`${APIS.HOLIDAYS}${holidayId}/`);
        successNotification('Holiday deleted successfully');
        fetchHolidays();
      } catch (error: any) {
        errorNotification(error?.response?.data?.message || 'Failed to delete holiday');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-red-600 dark:text-red-400">
            <AlertCircle className="h-12 w-12 mb-4" />
            <span className="text-lg font-medium mb-2">Something went wrong</span>
            <span className="text-sm text-center mb-6">{error}</span>
            <button 
              onClick={() => fetchHolidays()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : holidays.length === 0 ? (
          <EmptyState title='No holidays configured'/>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-[var(--border-color)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#202020]">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Recurring
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-[var(--border-color)]">
                {holidays.map((holiday) => (
                  <tr key={holiday.id} className="bg-white dark:bg-[var(--app-bg)] hover:bg-gray-50 dark:hover:bg-[var(--hover-bg)]">
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {holiday.name}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(holiday.date)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        holiday.is_active
                          ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {holiday.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        holiday.is_recurring
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {holiday.is_recurring ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(holiday)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit holiday"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(holiday.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete holiday"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {(!loading && (pagination.next || pagination.previous)) && (
          <div className="flex items-center justify-between pt-8">
            <button 
              onClick={() => fetchHolidays(pagination.previous!)}
              disabled={!pagination.previous}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] bg-white dark:bg-surface-elevated border border-gray-300 dark:border-subtle rounded-xl hover:bg-gray-50 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            >
              Previous
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-500 dark:text-[var(--text-primary)]">
                Showing {holidays.length} of {pagination.count} holidays
              </span>
            </div>
            <button 
              onClick={() => fetchHolidays(pagination.next!)}
              disabled={!pagination.next}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] bg-white dark:bg-surface-elevated border border-gray-300 dark:border-subtle rounded-xl hover:bg-gray-50 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isEditModalOpen} onClose={handleCloseModal} title='Edit Holiday'> 
        <>
         <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-hover border border-gray-300 dark:border-subtle rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-[var(--text-primary)]"
                  placeholder="Enter holiday name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-hover border border-gray-300 dark:border-subtle rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)]">
                      Recurring Holiday
                    </label>
                    <p className="text-xs text-gray-500 dark:text-[var(--text-primary)]">
                      Repeat this holiday annually
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-surface-hover peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-subtle peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)]">
                      Active Holiday
                    </label>
                    <p className="text-xs text-gray-500 dark:text-[var(--text-primary)]">
                      Is this holiday active
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-surface-hover peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-subtle peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-hover border border-gray-300 dark:border-subtle rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-[var(--text-primary)] resize-none"
                  placeholder="Add a description (optional)"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 ">
              <button
                onClick={handleUpdateHoliday}
                disabled={isUpdating || !formData.name || !formData.date}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Update 
                  </>
                )}
              </button>
            </div>
        </>
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={handleCloseModal} title='Create Holiday'> 
        <>
         <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-hover border border-gray-300 dark:border-subtle rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-[var(--text-primary)]"
                  placeholder="Enter holiday name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-hover border border-gray-300 dark:border-subtle rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-hover-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)]">
                      Recurring Holiday
                    </label>
                    <p className="text-xs text-gray-500 dark:text-[var(--text-primary)]">
                      Repeat this holiday annually
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-surface-hover peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-subtle peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-hover border border-gray-300 dark:border-subtle rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-[var(--text-primary)] resize-none"
                  placeholder="Add a description (optional)"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 ">
              <button
                onClick={handleCreateHoliday}
                disabled={isCreating || !formData.name || !formData.date}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create
                  </>
                )}
              </button>
            </div>
        </>
      </Modal>
     
    </>
  );
};

export default HolidayComponent;
