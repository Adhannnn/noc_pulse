// frontend/src/context/ToastContext.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastFunctions {
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  toast: ToastFunctions;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    ({ type, message, title, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, message, title, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  const toastFunctions: ToastFunctions = {
    success: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'success', message, title: title || 'Success', duration }),
      [addToast]
    ),
    error: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'error', message, title: title || 'Action Failed', duration }),
      [addToast]
    ),
    info: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'info', message, title: title || 'Information', duration }),
      [addToast]
    ),
    warning: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'warning', message, title: title || 'Warning', duration }),
      [addToast]
    ),
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast: toastFunctions }}>
      {children}
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((item) => {
          let borderColor = 'border-slate-800';
          let bgColor = 'bg-[#0B101E]/95';
          let textColor = 'text-slate-100';
          let IconComponent = Info;
          let iconColor = 'text-sky-400';
          let glowColor = 'shadow-sky-950/40';

          if (item.type === 'success') {
            borderColor = 'border-emerald-500/40';
            bgColor = 'bg-[#071912]/95';
            textColor = 'text-emerald-100';
            IconComponent = CheckCircle2;
            iconColor = 'text-emerald-400';
            glowColor = 'shadow-emerald-950/50';
          } else if (item.type === 'error') {
            borderColor = 'border-rose-500/40';
            bgColor = 'bg-[#1a080c]/95';
            textColor = 'text-rose-100';
            IconComponent = AlertCircle;
            iconColor = 'text-rose-400';
            glowColor = 'shadow-rose-950/50';
          } else if (item.type === 'warning') {
            borderColor = 'border-amber-500/40';
            bgColor = 'bg-[#1a1407]/95';
            textColor = 'text-amber-100';
            IconComponent = AlertTriangle;
            iconColor = 'text-amber-400';
            glowColor = 'shadow-amber-950/50';
          } else {
            borderColor = 'border-sky-500/40';
            bgColor = 'bg-[#0b1424]/95';
            textColor = 'text-sky-100';
            IconComponent = Info;
            iconColor = 'text-sky-400';
            glowColor = 'shadow-sky-950/50';
          }

          return (
            <div
              key={item.id}
              role="alert"
              className={`pointer-events-auto border ${borderColor} ${bgColor} ${glowColor} backdrop-blur-md rounded-xl p-3.5 shadow-2xl flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-top-2`}
            >
              <div className="mt-0.5 shrink-0">
                <IconComponent className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                {item.title && (
                  <h4 className="text-xs font-bold text-white tracking-tight leading-none mb-1 font-sans">
                    {item.title}
                  </h4>
                )}
                <p className={`text-xs ${textColor} break-words font-mono leading-relaxed`}>
                  {item.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFunctions {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}
