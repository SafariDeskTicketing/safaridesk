import React from "react"
import { Modal } from "./Modal"
import { AlertTriangle, X, Check } from "lucide-react"

type Props = {
    message: string,
    cancel: () => void,
    show: boolean,
    onConfirm?: () => void,
    confirmText?: string,
    cancelText?: string,
    variant?: 'warning' | 'danger' | 'info' | 'success',
    title?: string,
    state?: boolean,
}

const ConfirmDialog: React.FC<Props> = ({
    message,
    cancel,
    show,
    onConfirm,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = 'warning',
    title = "Confirm Action",
    state = false
}) => {

    const getIconAndColors = () => {
        switch (variant) {
            case 'danger':
                return {
                    icon: <X className="w-12 h-12 text-red-500" />,
                    bgColor: 'bg-red-50',
                    confirmBtnColor: 'bg-red-600 hover:bg-red-700 text-white'
                }
            case 'info':
                return {
                    icon: <Check className="w-12 h-12 text-blue-500" />,
                    bgColor: 'bg-blue-50',
                    confirmBtnColor: 'bg-blue-600 hover:bg-blue-700 text-white'
                }
            case 'success':
                return {
                    icon: <Check className="w-12 h-12 text-green-500" />,
                    bgColor: 'bg-green-50',
                    confirmBtnColor: 'bg-green-600 hover:bg-green-700 text-white'
                }
            default: // warning
                return {
                    icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
                    bgColor: 'bg-amber-50',
                    confirmBtnColor: 'bg-amber-600 hover:bg-amber-700 text-white'
                }
        }
    }

    const { icon, bgColor, confirmBtnColor } = getIconAndColors()

    return (
        <Modal
            isOpen={show}
            onClose={cancel}
            showCloseButton={false}
            closeOnBackdropClick={false}
            size="sm"
            closeOnEscape={false}
        >
            <div className="p-6">
                {/* Icon */}
                <div className={`mx-auto flex items-center justify-center w-16 h-16 rounded-full ${bgColor} mb-4`}>
                    {icon}
                </div>

                {/* Title */}
                <div className="text-center mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">
                        {title}
                    </h3>
                </div>

                {/* Message */}
                <div className="text-center mb-6">
                    <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
                        {message}
                    </p>
                </div>

                {/* Buttons */}
                <div className="flex flex-col-reverse sm:flex-row justify-center sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
                    <button
                        type="button"
                        onClick={cancel}
                        disabled={state}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-surface-elevated dark:text-[var(--text-primary)] dark:border-subtle dark:hover:bg-surface-hover"
                    >
                        {cancelText}
                    </button>
                    {onConfirm && (
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={state}
                            className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 ${confirmBtnColor}`}
                        >
                            {state ? "Please wait.." : confirmText}
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    )
}

export default ConfirmDialog
