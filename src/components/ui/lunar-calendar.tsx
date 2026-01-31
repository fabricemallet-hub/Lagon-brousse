'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  getDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDate } from '@/context/date-context';
import { useLocation } from '@/context/location-context';
import { getDataForDate } from '@/lib/data';
import { Fish, Moon, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from './card';
import type { FishRating } from '@/lib/types';

export const MoonPhaseIcon = ({
  phase,
  className,
}: {
  phase: string;
  className?: string;
}) => {
  const baseClassName = cn('size-4', className);
  switch (phase) {
    case 'Nouvelle lune':
      return <Circle className={baseClassName} strokeWidth={1.5} />;
    case 'Premier croissant':
      return <Moon className={baseClassName} />;
    case 'Premier quartier':
      return (
        <Circle
          className={cn(baseClassName, 'fill-current')}
          style={{ clipPath: 'inset(0 50% 0 0)' }}
        />
      );
    case 'Lune gibbeuse croissante':
      return (
        <Circle
          className={cn(baseClassName, 'fill-current')}
          style={{ clipPath: 'inset(0 25% 0 0)' }}
        />
      );
    case 'Pleine lune':
      return <Circle className={cn(baseClassName, 'fill-current')} />;
    case 'Lune gibbeuse décroissante':
      return (
        <Circle
          className={cn(baseClassName, 'fill-current')}
          style={{ clipPath: 'inset(0 0 0 25%)' }}
        />
      );
    case 'Dernier quartier':
      return (
        <Circle
          className={cn(baseClassName, 'fill-current')}
          style={{ clipPath: 'inset(0 0 0 50%)' }}
        />
      );
    case 'Dernier croissant':
      return <Moon className={cn(baseClassName, 'scale-x-[-1]')} />;
    default:
      return <Circle className={baseClassName} strokeWidth={1} />;
  }
};

function DayCell({
  day,
  isCurrentMonth,
  isSelected,
  onDateSelect,
}: {
  day: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  onDateSelect: (d: Date) => void;
}) {
  const { selectedLocation } = useLocation();
  const data = getDataForDate(selectedLocation, day);

  const allFishRatings: FishRating[] = data.fishing.flatMap(
    (slot) => slot.fish
  );
  const totalRating = allFishRatings.reduce((acc, f) => acc + f.rating, 0);
  const averageRating =
    allFishRatings.length > 0 ? totalRating / allFishRatings.length : 0;
  const fishIconCount = Math.min(5, Math.max(0, Math.round(averageRating / 2)));

  const fishIcons = Array.from({ length: fishIconCount }).map((_, i) => (
    <Fish key={i} className="size-3 text-primary" />
  ));

  const tides = data.tides.slice(0, 4);

  const prevDate = new Date(day);
  prevDate.setDate(day.getDate() - 1);
  const prevData = getDataForDate(selectedLocation, prevDate);

  const eventTexts = [];

  const currentPhase = data.weather.moon.phase;
  if (currentPhase !== prevData.weather.moon.phase) {
    if (currentPhase === 'Premier quartier' || currentPhase === 'Dernier quartier') {
      eventTexts.push(currentPhase);
    }
  }
  
  const currentTrend = data.farming.lunarPhase;
  if (currentTrend !== prevData.farming.lunarPhase) {
    eventTexts.push(currentTrend);
  }

  return (
    <div
      onClick={() => onDateSelect(day)}
      className={cn(
        'h-28 border-t border-l p-1 flex flex-col cursor-pointer hover:bg-accent/50 relative group',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        isSelected && 'ring-2 ring-primary z-10',
        (getDay(day) + 6) % 7 === 0 && 'border-l-0' // No left border for Mondays
      )}
    >
      <div className="flex justify-between items-center">
        <div className="text-muted-foreground">
          <MoonPhaseIcon phase={data.weather.moon.phase} />
        </div>
        <div className="font-semibold text-sm">{format(day, 'd')}</div>
      </div>
      
      {eventTexts.length > 0 && (
        <div className="text-[10px] text-center text-accent font-semibold truncate leading-tight my-0.5">
          {eventTexts.join(' / ')}
        </div>
      )}

      <div className="flex-grow flex items-center justify-center gap-0.5">
        {fishIcons}
      </div>
      <div className="grid grid-cols-2 gap-x-1 text-[10px] font-mono text-muted-foreground">
        {tides.map((tide, i) => (
          <span key={i} className="text-center">
            {tide.type === 'haute' ? 'H' : 'B'}: {tide.height.toFixed(1)}m
          </span>
        ))}
      </div>
    </div>
  );
}

export function LunarCalendar() {
  const { selectedDate, setSelectedDate } = useDate();
  const [displayDate, setDisplayDate] = useState(startOfMonth(selectedDate));

  const handlePrevMonth = () => {
    setDisplayDate((d) => subMonths(d, 1));
  };
  const handleNextMonth = () => {
    setDisplayDate((d) => addMonths(d, 1));
  };

  const monthStart = startOfMonth(displayDate);
  const monthEnd = endOfMonth(displayDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekdays = [
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
    'Dimanche',
  ];

  return (
    <div className="border rounded-lg">
      <div className="flex justify-between items-center p-2">
        <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-semibold capitalize tracking-wide">
          {format(displayDate, 'MMMM yyyy', { locale: fr })}
        </h2>
        <Button variant="ghost" size="icon" onClick={handleNextMonth}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-t">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground p-2 border-l first:border-l-0"
          >
            {day.substring(0, 3)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <DayCell
            key={day.toString()}
            day={day}
            isCurrentMonth={isSameMonth(day, displayDate)}
            isSelected={isSameDay(day, selectedDate)}
            onDateSelect={setSelectedDate}
          />
        ))}
      </div>
    </div>
  );
}
