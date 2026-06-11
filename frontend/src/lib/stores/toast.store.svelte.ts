// F-06: Toast notification store for user feedback (Svelte 5 runes)
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

class ToastStore {
  toasts: Toast[] = $state([]);

  private addToast(message: string, type: ToastType = 'info', duration: number = 4000) {
    const id = crypto.randomUUID();
    const newToast: Toast = { id, message, type, duration };
    this.toasts.push(newToast);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  success(message: string, duration?: number) {
    return this.addToast(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    return this.addToast(message, 'error', duration);
  }

  warning(message: string, duration?: number) {
    return this.addToast(message, 'warning', duration);
  }

  info(message: string, duration?: number) {
    return this.addToast(message, 'info', duration);
  }

  remove(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  clear() {
    this.toasts = [];
  }
}

export const toast = new ToastStore();
