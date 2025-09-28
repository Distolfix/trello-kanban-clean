import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";


interface DueDateSelectorProps {
  cardId: string;
  currentDueDate?: Date | string | number;
  onDueDateChange: (date: Date | null) => void;
  canEdit: boolean;
}

export function DueDateSelector({ cardId, currentDueDate, onDueDateChange, canEdit }: DueDateSelectorProps) {
  const [date, setDate] = useState<Date | undefined>(
    currentDueDate ? new Date(currentDueDate) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const isOverdue = (checkDate?: Date) => {
    if (!checkDate) return false;
    return checkDate < new Date();
  };

  const overdue = isOverdue(date);

  const updateDueDate = async (newDate: Date | null) => {
    try {
      // Update database via API
      const { apiClient } = await import("@/api/client");

      await apiClient.updateCard(cardId, {
        due_date: newDate ? newDate.getTime() : null
      });

      setDate(newDate || undefined);
      onDueDateChange(newDate);
      setIsCalendarOpen(false);
    } catch (error) {
      console.error('Error updating due date:', error);
    }
  };

  const removeDueDate = () => {
    updateDueDate(null);
  };

  if (!date && !canEdit) return null;

  return (
    <div>
      {date && (
        <div>
          <h4 className="text-sm font-medium mb-2">Scadenza</h4>
          <div className={cn(
            "flex items-center justify-between space-x-2 p-2 rounded-lg",
            overdue ? "bg-destructive/10 text-destructive" : "bg-muted/50"
          )}>
            <div className="flex items-center space-x-2">
              {overdue ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CalendarIcon className="h-4 w-4" />
              )}
              <div>
                <div className="text-sm font-medium">
                  {format(date, 'EEEE, d MMMM yyyy', { locale: it })}
                </div>
                {overdue && (
                  <div className="text-xs">In ritardo</div>
                )}
              </div>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeDueDate}
                className="h-auto p-1"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <div className={cn(date ? "mt-2" : "")}>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start",
                  !date && "font-normal text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {date ? "Modifica scadenza" : "Aggiungi scadenza"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selectedDate) => {
                  if (selectedDate) {
                    updateDueDate(selectedDate);
                  }
                }}
                initialFocus
                locale={it}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}