'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDate } from '@/context/date-context';
import { useLocation } from '@/context/location-context';
import { generateProceduralData, getDataForDate } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Circle,
  ChevronLeft,
  ChevronRight,
  Spade,
  Carrot,
  Flower,
  Leaf,
  Scissors,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Moon,
  X
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useCalendarView } from '@/context/calendar-view-context';
import type { Tide } from '@/lib/types';
import { CrabIcon, LobsterIcon } from '../icons';

export const MoonPhaseIcon = ({
  phase,
  className,
}: {
  phase: string;
  className?: string;
}) => {
  const baseClassName = cn('size-4', className);
  switch (phase) {
    case 'Nouvelle lune': return <Circle className={baseClassName} strokeWidth={1.5} />;
    case 'Premier quartier': return <Circle className={cn(baseClassName, 'fill-current')} style={{ clipPath: 'inset(0 50% 0 0)' }} />;
    case 'Pleine lune': return <Circle className={cn(baseClassName, 'fill-current')} />;
    case 'Dernier quartier': return <Circle className={cn(baseClassName, 'fill-current')} style={{ clipPath: 'inset(0 0 0 50%)' }} />;
    case 'Premier croissant':
    case 'Dernier croissant': return <Moon className={baseClassName} />;
    default: return <Circle className={baseClassName} strokeWidth={1} />;
  }
};

const DayCell = React.memo(({
  day,
  isCurrentMonth,
  isSelected,
  onDateSelect,
}: {
  day: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  onDateSelect: (d: Date) => void;
}) => {
  const { selectedLocation } = useLocation();
  const { calendarView } = useCalendarView();
  
  const data = useMemo(() => generateProceduralData(selectedLocation, day), [selectedLocation, day]);

  const today = startOfDay(new Date());
  const cellDate = startOfDay(day);
  const isPastDay = cellDate < today;
  const isTodayDay = isSameDay(day, today);

  const sortedTides = useMemo(() => {
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    return [...data.tides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [data.tides]);

  const { zodiac, isGoodForCuttings, isGoodForPruning, isGoodForMowing } = data.farming;
  const GardeningIcon = { Fruits: Spade, Racines: Carrot, Fleurs: Flower, Feuilles: Leaf }[zodiac];

  return (
    <div
      onClick={() => onDateSelect(day)}
      className={cn(
        'h-32 border-t border-l p-1 flex flex-col cursor-pointer transition-colors',
        isTodayDay && 'calendar-today-cell',
        !isCurrentMonth && 'bg-muted/20 text-muted-foreground/50',
        isPastDay && 'bg-muted/5 opacity-60',
        isTodayDay && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
        isSelected && 'ring-2 ring-primary z-10 bg-background shadow-inner',
        (getDay(day) + 6) % 7 === 0 && 'border-l-0'
      )}
    >
      <div className="flex justify-between items-center px-0.5">
        <span className={cn(
          "font-black text-[10px] flex items-center justify-center size-4 rounded-full",
          isTodayDay ? "bg-primary text-primary-foreground" : "text-foreground"
        )}>{format(day, 'd')}</span>
        <MoonPhaseIcon phase={data.weather.moon.phase} className="size-2 opacity-60" />
      </div>

      {calendarView === 'peche' ? (
        <div className="flex-grow flex flex-col justify-center items-center gap-0.5 pt-1">
          <div className="flex items-center justify-center gap-0.5 h-3 overflow-hidden flex-nowrap whitespace-nowrap w-full">
            {data.crabAndLobster.crabStatus === 'Plein' && <CrabIcon className="size-3.5 text-green-600 shrink-0" />}
            {data.crabAndLobster.crabStatus === 'Mout' && <CrabIcon className="size-3.5 text-destructive shrink-0" />}
            {data.crabAndLobster.lobsterActivity === 'Élevée' && <LobsterIcon className="size-3.5 text-blue-600 shrink-0" />}
          </div>

          <div className="mt-auto w-full flex flex-col items-center gap-0 pb-0.5">
            {sortedTides.map((tide, idx) => {
              const isHighPeak = tide.type === 'haute' && tide.height >= data.tideThresholds.high;
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "text-[8px] font-black leading-tight flex items-center justify-between w-full px-1 rounded-[2px] transition-all my-0.5",
                    tide.type === 'haute' 
                      ? (isHighPeak ? "bg-primary text-white shadow-sm" : "text-primary")
                      : "text-blue-800"
                  )}
                >
                  <span>{tide.time}</span>
                  <span>{tide.height.toFixed(2)}m</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center gap-1.5">
          {GardeningIcon && <GardeningIcon className="size-5 text-primary opacity-80" />}
          <div className="flex flex-wrap justify-center gap-1.5 h-5">
            {isGoodForPruning && <Scissors className="size-3.5 text-orange-600" />}
            {isGoodForCuttings && <RefreshCw className="size-3.5 text-pink-600" />}
            {isGoodForMowing && <Leaf className="size-3.5 text-green-600" />}
          </div>
        </div>
      )}
    </div>
  );
});
DayCell.displayName = 'DayCell';

export function LunarCalendar() {
  const { selectedDate, setSelectedDate } = useDate();
  const { calendarView } = useCalendarView();
  const { selectedLocation } = useLocation();
  const [displayDate, setDisplayDate] = useState(startOfMonth(selectedDate));
  const [detailedDay, setDetailedDay] = useState<Date | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Zoom States
  const [zoom, setZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const initialDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  const handleDayClick = (day: Date) => { 
    setSelectedDate(day); 
    setDetailedDay(day); 
  };
  
  const handlePrevMonth = () => setDisplayDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setDisplayDate((d) => addMonths(d, 1));

  const monthStart = startOfMonth(displayDate);
  const monthEnd = endOfMonth(displayDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Pinch-to-zoom logic
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      initialDistRef.current = dist;
      initialZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const factor = dist / initialDistRef.current;
      const nextZoom = Math.min(Math.max(initialZoomRef.current * factor, 0.5), 1.5);
      setZoom(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    initialDistRef.current = null;
    setIsPinching(false);
  };

  // Auto-scroll to today
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const todayCell = scrollContainerRef.current.querySelector('.calendar-today-cell');
        if (todayCell) {
          todayCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [displayDate]);

  return (
    <div className="flex flex-col items-start py-2 w-full">
      <div className="sticky top-0 mb-4 px-1 w-full shrink-0 z-30 bg-background/95 backdrop-blur-md pb-2 border-b-2 border-primary/10">
        <div className="flex items-center justify-between p-2">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="size-6" /></Button>
          <h2 className="text-lg font-black uppercase tracking-tighter capitalize">{format(displayDate, 'MMMM yyyy', { locale: fr })}</h2>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="size-6" /></Button>
        </div>
      </div>

      <div 
        className="w-full overflow-x-auto pb-20 scrollbar-hide touch-pan-x touch-pan-y" 
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className={cn(
            "border-2 rounded-2xl bg-card shadow-lg overflow-hidden flex flex-col origin-top-left",
            !isPinching && "transition-transform duration-300"
          )}
          style={{ 
            width: `${1000 * zoom}px`, 
            transform: `scale(${zoom})`,
            // On laisse le conteneur parent overflow-x gérer le scroll horizontal
            marginBottom: `${(1 - zoom) * -100}%`
          }}
        >
          <div className="grid grid-cols-7 bg-muted/30 border-b">
            {weekdays.map((day) => (
              <div key={day} className="text-center text-[10px] font-black uppercase text-muted-foreground p-3">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 w-full">
            {days.map((day) => (
              <DayCell 
                key={day.toString()} 
                day={day} 
                isCurrentMonth={isSameMonth(day, displayDate)} 
                isSelected={isSameDay(day, selectedDate)} 
                onDateSelect={handleDayClick} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Zoom Floating Toolbar */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2">
        <Button 
          size="icon" 
          variant="secondary" 
          className="size-12 rounded-full shadow-xl border-2 border-primary/20 bg-white/90 backdrop-blur-md active:scale-90 transition-transform" 
          onClick={() => setZoom(prev => Math.min(prev + 0.1, 1.5))}
        >
          <ZoomIn className="size-6 text-primary" />
        </Button>
        <Button 
          size="icon" 
          variant="secondary" 
          className="size-12 rounded-full shadow-xl border-2 border-primary/20 bg-white/90 backdrop-blur-md active:scale-90 transition-transform" 
          onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
        >
          <ZoomOut className="size-6 text-primary" />
        </Button>
        <Button 
          size="icon" 
          variant="secondary" 
          className="size-12 rounded-full shadow-xl border-2 border-primary/20 bg-white/90 backdrop-blur-md active:scale-90 transition-transform" 
          onClick={() => setZoom(1)}
        >
          <Maximize2 className="size-6 text-primary" />
        </Button>
      </div>

      <Dialog open={!!detailedDay} onOpenChange={(isOpen) => !isOpen && setDetailedDay(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800">
              {detailedDay ? format(detailedDay, 'eeee d MMMM', { locale: fr }) : ''}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase opacity-60">Détails tactiques de la journée</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {detailedDay && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <p className="text-sm font-medium leading-relaxed">
                    {getDataForDate(selectedLocation, detailedDay).farming.recommendation}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Prochaines Marées</p>
                  {getDataForDate(selectedLocation, detailedDay).tides.map((tide, i) => (
                    <div key={i} className={cn(
                      "flex justify-between items-center p-3 border rounded-lg",
                      tide.type === 'haute' ? "bg-primary/5 border-primary/10" : "bg-destructive/5 border-destructive/10"
                    )}>
                      <span className={cn("text-[10px] font-black uppercase", tide.type === 'haute' ? "text-primary" : "text-destructive")}>
                        {tide.type === 'haute' ? 'Pleine Mer' : 'Basse Mer'}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black">{tide.time}</span>
                        <span className={cn("text-sm font-black", tide.type === 'haute' ? "text-primary" : "text-destructive")}>{tide.height.toFixed(2)}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="w-full h-12 font-black uppercase">Compris</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}