import { useState } from "react";
import http from "../../../services/http";
import { APIS } from "../../../services/apis";
import { successNotification, errorNotification } from "../../../components/ui/Toast";
import Select from "../../../components/ui/Select";

type Props = {
    taskId: number,
    close: () => void, 
    reload: () => void,
}

const TaskStatusUpdate: React.FC<Props> = ({ taskId, close, reload }) => {
    const [selectedOption, setSelectedOption] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleStatusUpdate = async () => {
        try {
            if (selectedOption === '') {
                errorNotification("Please select a status");
                return;
            }
            
            setIsSubmitting(true);
            const response = await http.post(`${APIS.UPDATE_TASK_STATUS}${taskId}/`, {
                status: selectedOption
            });
            
            successNotification(response.data?.message || "Status updated successfully");
            setSelectedOption('');
            close();
            reload();
        } catch (error: any) {
            errorNotification(error?.response?.data?.message || "Failed to update status");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                </div>
                
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-4">
                        Update Task Status
                    </h3>
                    
                    <div className="space-y-4">
                        <Select
                            id="status"
                            label="Select New Status"
                            value={selectedOption}
                            onChange={setSelectedOption}
                            options={[
                                { value: "", label: "Choose status...", disabled: true },
                                { value: "open", label: "Open" },
                                { value: "in_progress", label: "In Progress" },
                                { value: "hold", label: "Hold" },
                                { value: "completed", label: "Completed" },
                            ]}
                            placeholder="Choose status..."
                            size="md"
                            required={true}
                        />
                        
                        {selectedOption === 'in_progress' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <span className="text-amber-800 font-medium">Note:</span>
                                </div>
                                <p className="text-amber-700 mt-1">
                                    Setting status to "In Progress" will start the time tracking counter automatically.
                                </p>
                            </div>
                        )}
                        {selectedOption === 'completed' && (
                            <div className="bg-primary-50 border border-primary-200 rounded-md p-3">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-primary-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-primary-800 font-medium">Info:</span>
                                </div>
                                <p className="text-primary-700 mt-1">
                                    This will mark the task as resolved and stop time tracking.
                                </p>
                            </div>
                        )}
                        {selectedOption === 'hold' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-yellow-800 font-medium">Info:</span>
                                </div>
                                <p className="text-yellow-700 mt-1">
                                    This will put the task on hold and pause time tracking.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                    onClick={handleStatusUpdate}
                    disabled={!selectedOption || isSubmitting}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? "Updating..." : "Update Status"}
                </button>
            </div>
        </div>
    );
};

export default TaskStatusUpdate;
