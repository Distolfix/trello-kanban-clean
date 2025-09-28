import { cn } from "@/lib/utils";

interface DiscordStatusProps {
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  online: {
    color: 'bg-green-500',
    label: 'Online'
  },
  idle: {
    color: 'bg-yellow-400',
    label: 'Assente'
  },
  dnd: {
    color: 'bg-red-600',
    label: 'Non disturbare'
  },
  offline: {
    color: 'bg-gray-800',
    label: 'Offline'
  }
};

const sizeConfig = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4'
};

export function DiscordStatus({ status = 'offline', className, size = 'sm' }: DiscordStatusProps) {
  const config = statusConfig[status];
  const sizeClass = sizeConfig[size];

  // Debug log

  return (
    <div
      className={cn(
        'rounded-full border-2 border-white',
        config.color,
        sizeClass,
        className
      )}
      title={`${config.label} (${status})`}
      style={{
        // Force visibility for debug - make it bigger and more visible
        minWidth: size === 'sm' ? '10px' : size === 'md' ? '14px' : '18px',
        minHeight: size === 'sm' ? '10px' : size === 'md' ? '14px' : '18px',
        // Force different backgrounds for debug
        backgroundColor: status === 'online' ? '#22c55e' :
                        status === 'idle' ? '#eab308' :
                        status === 'dnd' ? '#dc2626' : '#1f2937',
        border: '2px solid white',
        display: 'block',
        position: 'absolute',
        zIndex: 10
      }}
    />
  );
}