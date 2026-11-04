import { Modal } from '../../../components/ui/Modal';

interface Department {
  id: number;
  name: string;
}

interface UpdateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (value: string) => void;
  onUpdate: () => void;
  isSubmitting: boolean;
}

export const UpdateDepartmentModal = ({
  isOpen,
  onClose,
  departments,
  selectedDepartmentId,
  setSelectedDepartmentId,
  onUpdate,
  isSubmitting,
}: UpdateDepartmentModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Department"
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="dept-select-modal" className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
            Select Department
          </label>
          <select
            id="dept-select-modal"
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-subtle rounded-lg bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Select a Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onUpdate(); onClose(); }}
            disabled={isSubmitting || !selectedDepartmentId}
            className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
