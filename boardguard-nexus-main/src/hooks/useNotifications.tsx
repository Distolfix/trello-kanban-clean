import * as React from "react";

export interface Notification {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning";
  timestamp: Date;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

interface NotificationContextType extends NotificationState {
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
  });

  const addNotification = React.useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false,
    };

    setState(prev => ({
      notifications: [newNotification, ...prev.notifications],
      unreadCount: prev.unreadCount + 1,
    }));
  }, []);

  const markAsRead = React.useCallback((id: string) => {
    setState(prev => ({
      notifications: prev.notifications.map(n =>
        n.id === id && !n.read ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - (prev.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
    }));
  }, []);

  const markAllAsRead = React.useCallback(() => {
    setState(prev => ({
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  }, []);

  const clearNotifications = React.useCallback(() => {
    setState({ notifications: [], unreadCount: 0 });
  }, []);

  const value = React.useMemo(() => ({
    ...state,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  }), [state, addNotification, markAsRead, markAllAsRead, clearNotifications]);

  // Listen for toast notifications to add them to the history
  React.useEffect(() => {
    const handleToastNotification = (event: CustomEvent) => {
      const { title, description, variant } = event.detail;
      if (title) {
        addNotification({ title, description, variant });
      }
    };

    window.addEventListener('toast-notification', handleToastNotification as EventListener);
    return () => {
      window.removeEventListener('toast-notification', handleToastNotification as EventListener);
    };
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}