'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface DialogDetail {
  label: string;
  value: string;
}

export interface DialogOptions {
  title: string;
  description?: React.ReactNode;
  icon?: string; // material symbols icon name (기본: info)
  tone?: 'primary' | 'danger';
  confirmText?: string;
  cancelText?: string;
  details?: DialogDetail[];
}

interface DialogState extends DialogOptions {
  kind: 'alert' | 'confirm';
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  alert: (opts: DialogOptions) => Promise<void>;
  confirm: (opts: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<DialogState | null>(null);

  const close = useCallback((v: boolean) => {
    setState((prev) => {
      prev?.resolve(v);
      return null;
    });
  }, []);

  const alert = useCallback((opts: DialogOptions) => {
    return new Promise<void>((resolve) => {
      setState({ ...opts, kind: 'alert', resolve: () => resolve() });
    });
  }, []);

  const confirm = useCallback((opts: DialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, kind: 'confirm', resolve });
    });
  }, []);

  const value = useMemo<DialogContextValue>(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {state && (
        <DialogRoot state={state} onConfirm={() => close(true)} onCancel={() => close(false)} />
      )}
    </DialogContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useAlert는 <DialogProvider> 내부에서만 호출 가능합니다');
  return ctx.alert;
};

export const useConfirm = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm은 <DialogProvider> 내부에서만 호출 가능합니다');
  return ctx.confirm;
};

// ---------------------------------------------------------------------------
// 내부 컴포넌트
// ---------------------------------------------------------------------------
interface DialogRootProps {
  state: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
}

const DialogRoot = ({ state, onConfirm, onCancel }: DialogRootProps) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const tone = state.tone ?? 'primary';
  const isAlert = state.kind === 'alert';

  // ESC/Enter 키 지원 + autofocus
  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isAlert) onConfirm();
        else onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isAlert, onConfirm, onCancel]);

  const iconBgClass =
    tone === 'danger' ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary';
  const primaryBtnClass =
    tone === 'danger'
      ? 'bg-error text-on-error hover:bg-error/90'
      : 'bg-primary text-on-primary hover:bg-on-primary-fixed-variant';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={() => (isAlert ? onConfirm() : onCancel())}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest w-full max-w-md overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBgClass}`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {state.icon ?? (tone === 'danger' ? 'warning' : 'info')}
            </span>
          </div>
          <h2
            id="dialog-title"
            className="text-on-surface flex-1 pt-1.5 text-[18px] leading-tight font-semibold"
          >
            {state.title}
          </h2>
          <button
            type="button"
            onClick={() => (isAlert ? onConfirm() : onCancel())}
            aria-label="Close"
            className="text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        {(state.description || state.details) && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            {state.description && (
              <div className="text-on-surface-variant text-sm leading-relaxed">
                {state.description}
              </div>
            )}
            {state.details && state.details.length > 0 && (
              <div className="bg-primary-fixed/40 flex items-center justify-between gap-4 rounded-lg px-4 py-3">
                {state.details.map((d, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-0.5 ${
                      state.details!.length > 1 && i === state.details!.length - 1
                        ? 'items-end text-right'
                        : ''
                    }`}
                  >
                    <span className="text-on-surface-variant text-[11px] font-medium">
                      {d.label}
                    </span>
                    <span className="text-on-surface font-mono text-sm font-semibold tabular-nums">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-outline-variant/30 bg-surface-container-low/60 flex justify-end gap-2 border-t px-5 py-4">
          {!isAlert && (
            <button
              type="button"
              onClick={onCancel}
              className="border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low min-w-[100px] rounded-lg border px-5 py-2 text-sm font-semibold transition-colors"
            >
              {state.cancelText ?? 'Cancel'}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`min-w-[100px] rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${primaryBtnClass}`}
          >
            {state.confirmText ?? (isAlert ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
