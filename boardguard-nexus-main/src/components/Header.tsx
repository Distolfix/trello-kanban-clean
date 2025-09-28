import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./ThemeToggle";
// NotificationDropdown import removed
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User, Shield, Crown, Search, Filter, X } from "lucide-react";


interface FilterState {
  assignees: string[];
  labels: string[];
  priority: string[];
  dueDateFilter: 'all' | 'overdue' | 'thisWeek' | 'noDate';
}

interface HeaderProps {
  isLoggedIn?: boolean;
  user?: {
    name: string;
    role: 'default' | 'mod' | 'admin';
    avatar?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  onLogin?: () => void;
  onLogout?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  filters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin': return <Crown className="h-3 w-3" />;
    case 'mod': return <Shield className="h-3 w-3" />;
    default: return <User className="h-3 w-3" />;
  }
};

const getRoleBadge = (role: string) => {
  const variants = {
    admin: "bg-kanban-list-hidden text-destructive-foreground",
    mod: "bg-kanban-list-closed text-warning-foreground", 
    default: "bg-kanban-list-open text-success-foreground"
  };
  
  const labels = {
    admin: "Admin",
    mod: "Moderatore",
    default: "Utente"
  };
  
  return (
    <Badge className={`${variants[role as keyof typeof variants]} capitalize text-xs`}>
      {getRoleIcon(role)}
      <span className="ml-1">{labels[role as keyof typeof labels]}</span>
    </Badge>
  );
};

export function Header({
  isLoggedIn = false,
  user,
  onLogin,
  onLogout,
  searchQuery = "",
  onSearchChange,
  filters,
  onFiltersChange
}: HeaderProps) {
  const hasActiveFilters = filters && (
    filters.assignees.length > 0 ||
    filters.labels.length > 0 ||
    filters.priority.length > 0 ||
    filters.dueDateFilter !== 'all'
  );

  const clearFilters = () => {
    if (onFiltersChange) {
      onFiltersChange({
        assignees: [],
        labels: [],
        priority: [],
        dueDateFilter: 'all'
      });
    }
  };
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full h-16 flex items-center pr-4">
        {/* Logo - Fixed to left */}
        <div className="flex items-center space-x-3 flex-shrink-0 pl-2">
          <div className="gradient-primary w-8 h-8 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-primary-foreground rounded-sm"></div>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            EngineMC
          </h1>
        </div>

        {/* Center - Search and Filters */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca card, etichette, assegnatari..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10 w-80"
              />
            </div>

            {/* Filters Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtri
                  {hasActiveFilters && (
                    <Badge className="ml-2 h-4 w-4 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                      !
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* Priority Filter */}
                <div className="px-2 py-1.5 text-sm font-medium">Priorità</div>
                <DropdownMenuCheckboxItem
                  checked={filters?.priority.includes('high') || false}
                  onCheckedChange={(checked) =>
                    onFiltersChange && filters && onFiltersChange({
                      ...filters,
                      priority: checked
                        ? [...filters.priority, 'high']
                        : filters.priority.filter(p => p !== 'high')
                    })
                  }
                >
                  Alta Priorità
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters?.priority.includes('medium') || false}
                  onCheckedChange={(checked) =>
                    onFiltersChange && filters && onFiltersChange({
                      ...filters,
                      priority: checked
                        ? [...filters.priority, 'medium']
                        : filters.priority.filter(p => p !== 'medium')
                    })
                  }
                >
                  Media Priorità
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters?.priority.includes('low') || false}
                  onCheckedChange={(checked) =>
                    onFiltersChange && filters && onFiltersChange({
                      ...filters,
                      priority: checked
                        ? [...filters.priority, 'low']
                        : filters.priority.filter(p => p !== 'low')
                    })
                  }
                >
                  Bassa Priorità
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />

                {/* Due Date Filter */}
                <div className="px-2 py-1.5 text-sm font-medium">Scadenze</div>
                <DropdownMenuCheckboxItem
                  checked={filters?.dueDateFilter === 'overdue'}
                  onCheckedChange={(checked) =>
                    onFiltersChange && filters && onFiltersChange({
                      ...filters,
                      dueDateFilter: checked ? 'overdue' : 'all'
                    })
                  }
                >
                  In ritardo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters?.dueDateFilter === 'thisWeek'}
                  onCheckedChange={(checked) =>
                    onFiltersChange && filters && onFiltersChange({
                      ...filters,
                      dueDateFilter: checked ? 'thisWeek' : 'all'
                    })
                  }
                >
                  Questa settimana
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters?.dueDateFilter === 'noDate'}
                  onCheckedChange={(checked) =>
                    onFiltersChange && filters && onFiltersChange({
                      ...filters,
                      dueDateFilter: checked ? 'noDate' : 'all'
                    })
                  }
                >
                  Senza scadenza
                </DropdownMenuCheckboxItem>

                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Rimuovi tutti i filtri
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right Section - Fixed to right */}
        <div className="flex items-center space-x-4 flex-shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {!isLoggedIn ? (
            <Button
              onClick={onLogin}
              variant="default"
              className="gradient-primary hover:glow-primary transition-all duration-300"
            >
              Accedi
            </Button>
          ) : (
            <div className="flex items-center space-x-3">
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 hover:bg-surface-hover">
                    <Avatar className="h-7 w-7">
                      {user?.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={user.displayName || user.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {(user?.displayName || user?.name)?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        {user?.displayName || user?.name || 'Utente'}
                      </span>
                      {user?.role && getRoleBadge(user.role)}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Impostazioni
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}