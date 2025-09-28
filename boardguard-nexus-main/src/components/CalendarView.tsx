import React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { KanbanListData, KanbanCardData } from "@/db/types";

interface CalendarViewProps {
  lists: KanbanListData[];
  onCardClick?: (cardId: string) => void;
  onCardContextMenu?: (event: React.MouseEvent, cardId: string) => void;
}

export function CalendarView({ lists, onCardClick, onCardContextMenu }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Get all cards with due dates
  const cardsWithDueDates = lists.flatMap(list =>
    list.cards.filter(card => card.dueDate)
  );

  // Get current month details
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Generate calendar days
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get cards for a specific day
  const getCardsForDay = (day: number | null) => {
    if (!day) return [];

    const targetDate = new Date(year, month, day);
    return cardsWithDueDates.filter(card => {
      if (!card.dueDate) return false;
      const cardDate = new Date(card.dueDate);
      return (
        cardDate.getDate() === targetDate.getDate() &&
        cardDate.getMonth() === targetDate.getMonth() &&
        cardDate.getFullYear() === targetDate.getFullYear()
      );
    });
  };

  // Check if a date is today
  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Check if a date is overdue
  const isOverdue = (card: KanbanCardData) => {
    if (!card.dueDate) return false;
    return new Date(card.dueDate) < new Date();
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Calendar Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Vista Calendario</h2>
          </div>

          <Button onClick={goToToday} variant="outline" size="sm">
            Oggi
          </Button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button onClick={goToPreviousMonth} variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-xl font-semibold min-w-[200px] text-center">
              {monthNames[month]} {year}
            </h3>
            <Button onClick={goToNextMonth} variant="ghost" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-7 gap-2 h-full">
          {/* Day Headers */}
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            const dayCards = getCardsForDay(day);
            const isEmpty = !day;
            const todayClass = isToday(day) ? "bg-primary/10 border-primary" : "";

            return (
              <div
                key={index}
                className={`min-h-[120px] border border-border rounded-md p-2 ${isEmpty ? 'opacity-50' : ''} ${todayClass} hover:bg-surface-hover transition-colors`}
              >
                {day && (
                  <>
                    <div className="text-sm font-medium text-foreground mb-2">
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayCards.map(card => (
                        <Card
                          key={card.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isOverdue(card) ? 'border-destructive bg-destructive/10' : 'border-border'
                          }`}
                          onClick={() => onCardClick?.(card.id)}
                          onContextMenu={(e) => onCardContextMenu?.(e, card.id)}
                        >
                          <CardContent className="p-2">
                            <div className="text-xs font-medium truncate">
                              {card.title}
                            </div>
                            {card.labels && Array.isArray(card.labels) && card.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {card.labels.slice(0, 2).map((label, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="text-xs px-1 py-0 h-4"
                                  >
                                    {label.length > 6 ? `${label.substring(0, 6)}...` : label}
                                  </Badge>
                                ))}
                                {card.labels.length > 2 && (
                                  <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                                    +{card.labels.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}