import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success' | 'primary';

export interface ConfirmOptions {
  title?: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface AlertOptions {
  title?: string;
  message: string | ReactNode;
  confirmText?: string;
  variant?: DialogVariant;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    isAlert: boolean;
    title: string;
    message: string | ReactNode;
    confirmText: string;
    cancelText: string;
    variant: DialogVariant;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        isAlert: false,
        title: opts.title || 'Confirm Action',
        message: opts.message,
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        variant: opts.variant || 'danger',
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>((resolve) => {
      setDialogState({
        isOpen: true,
        isAlert: true,
        title: opts.title || (opts.variant === 'danger' ? 'Error' : 'Notification'),
        message: opts.message,
        confirmText: opts.confirmText || 'OK',
        cancelText: '',
        variant: opts.variant || (opts.title?.toLowerCase().includes('error') || opts.title?.toLowerCase().includes('fail') ? 'danger' : 'info'),
        resolve: () => resolve(),
      });
    });
  }, []);

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true);
      setDialogState(null);
    }
  };

  const handleCancel = () => {
    if (dialogState) {
      dialogState.resolve(false);
      setDialogState(null);
    }
  };

  const renderIcon = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-full bg-[#B3432B]/10 border border-[#B3432B]/20 flex items-center justify-center shrink-0 text-[#B3432B]">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-full bg-[#B7791F]/10 border border-[#B7791F]/20 flex items-center justify-center shrink-0 text-[#B7791F]">
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case 'success':
        return (
          <div className="w-10 h-10 rounded-full bg-[#2E7D5B]/10 border border-[#2E7D5B]/20 flex items-center justify-center shrink-0 text-[#2E7D5B]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case 'primary':
      case 'info':
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-[#26415C]/10 border border-[#26415C]/20 flex items-center justify-center shrink-0 text-[#26415C]">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return 'bg-[#B3432B] hover:bg-[#973621] text-white';
      case 'warning':
        return 'bg-[#B7791F] hover:bg-[#9c6617] text-white';
      case 'success':
        return 'bg-[#2E7D5B] hover:bg-[#25664a] text-white';
      case 'primary':
      case 'info':
      default:
        return 'bg-[#26415C] hover:bg-[#1e344a] text-white';
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}

      {dialogState && dialogState.isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E4E1DA] rounded-xl shadow-2xl max-w-md w-full p-6 text-left space-y-4">
            <div className="flex items-start gap-3.5">
              {renderIcon(dialogState.variant)}
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-base font-semibold text-[#1C2430] leading-snug">
                  {dialogState.title}
                </h3>
                <div className="mt-1 text-xs text-[#5B6472] leading-relaxed break-words">
                  {dialogState.message}
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="text-[#5B6472] hover:text-[#1C2430] transition p-1 -mr-1 -mt-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4E1DA]">
              {!dialogState.isAlert && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-2 rounded-lg border border-[#E4E1DA] bg-white hover:bg-[#FAF9F6] text-[#1C2430] text-xs font-medium transition"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition shadow-sm ${getConfirmButtonClasses(
                  dialogState.variant
                )}`}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextType => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export default ConfirmProvider;
