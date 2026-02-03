
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
import { generateProceduralData, getDataForDate, LocationData } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Fish,
  Moon,
  Circle,
  ChevronLeft,
  ChevronRight,
  Spade,
  Carrot,
  Flower,
  Leaf,
  Scissors,
  RefreshCw,
  Info,
  TrendingUp,
  TrendingDown,
  Star,
  Waves,
  Clock,
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useCalendarView } from '@/context/calendar-view-context';
import type { FishRating, Tide } from '@/lib/types';
import { CrabIcon, LobsterIcon, OctopusIcon } from '../icons';
import { Skeleton } from './skeleton';
import { Badge } from './badge';

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

const RatingStars = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 === 1;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}
      {halfStar && <Star key="half" className="h-3 w-3 fill-yellow-400 text-yellow-400" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300" />)}
    </div>
  );
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

  const fishingIcons = useMemo(() => {
    if (calendarView !== 'peche') return null;
    const allFishRatings: FishRating[] = data.fishing.flatMap((slot) => slot.fish);
    const targetLagonFish = ['Bossu doré', 'Bec de cane', 'Rouget'];
    const lagonRatings = allFishRatings.filter(f => targetLagonFish.includes(f.name));
    const lagonRating = lagonRatings.length > 0 ? lagonRatings.reduce((acc, f) => acc + f.rating, 0) / lagonRatings.length : 0;
    const fishCount = Math.max(1, Math.round(lagonRating / 2));

    const isPelagicSeason = data.pelagicInfo?.inSeason;

    return {
      lagon: Array.from({ length: fishCount }).map((_, i) => <Fish key={`lagon-${i}`} className="size-2.5 text-primary shrink-0" />),
      pelagic: isPelagicSeason ? <div className="flex items-center gap-0.5 ml-0.5 border-l pl-0.5 border-primary/20 shrink-0"><Star className="size-1.5 text-yellow-500 fill-yellow-500" /><Fish key="pelagic-icon" className="size-2.5 text-orange-500" /></div> : null
    };
  }, [data, calendarView]);

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
            {data.crabAndLobster.crabStatus === 'Plein' && <CrabIcon className="size-2.5 text-green-600 shrink-0" />}
            {data.crabAndLobster.crabStatus === 'Mout' && <CrabIcon className="size-2.5 text-destructive shrink-0" />}
            {data.crabAndLobster.lobsterActivity === 'Élevée' && <LobsterIcon className="size-2.5 text-blue-600 shrink-0" />}
            {data.crabAndLobster.octopusActivity === 'Élevée' && <OctopusIcon className="size-2.5 text-purple-600 shrink-0" />}
          </div>

          <div className="flex items-center justify-center gap-0.5 h-3 overflow-hidden flex-nowrap whitespace-nowrap w-full">
            {fishingIcons?.lagon}
            {fishingIcons?.pelagic}
          </div>

          <div className="mt-auto w-full flex flex-col items-center gap-0 pb-0.5">
            {sortedTides.map((tide, idx) => {
              const isHighPeak = tide.type === 'haute' && tide.height >= data.tideThresholds.high;
              const isLowPeak = tide.type === 'basse' && tide.height <= data.tideThresholds.low;
              
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "text-[8px] font-black leading-tight flex items-center justify-between w-full px-1 rounded-[2px] transition-all my-0.5",
                    tide.type === 'haute' 
                      ? (isHighPeak ? "bg-primary text-white shadow-sm" : "text-primary")
                      : (isLowPeak ? "bg-destructive text-white shadow-sm" : "text-blue-800")
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

  const handleDayClick = (day: Date) => { setSelectedDate(day); setDetailedDay(day); };
  const handlePrevMonth = () => setDisplayDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setDisplayDate((d) => addMonths(d, 1));

  const monthStart = startOfMonth(displayDate);
  const monthEnd = endOfMonth(displayDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  useEffect(() => {
    const timer = setTimeout(() => {
      const todayEl = document.querySelector('.calendar-today-cell');
      if (todayEl) {
        const rect = todayEl.getBoundingClientRect();
        const scrollX = rect.left + window.scrollX - (window.innerWidth / 2) + (rect.width / 2);
        window.scrollTo({
          left: scrollX,
          behavior: 'smooth'
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [displayDate]);

  return (
    <div className="flex flex-col items-start py-4">
      <div className="w-[1200px] border rounded-lg bg-card shadow-lg overflow-hidden flex flex-col shrink-0">
        <div className="flex justify-between items-center p-4 border-b bg-muted/10">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handlePrevMonth}><ChevronLeft className="size-6" /></Button>
          <h2 className="text-lg font-black uppercase tracking-tighter capitalize">{format(displayDate, 'MMMM yyyy', { locale: fr })}</h2>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleNextMonth}><ChevronRight className="size-6" /></Button>
        </div>
        
        <div className="grid grid-cols-7 bg-muted/30 border-b">
          {weekdays.map((day, idx) => (
            <div 
              key={day} 
              className="text-center text-[10px] font-black uppercase text-muted-foreground p-3 flex items-center justify-center border-l first:border-l-0 border-transparent"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="w-full">
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
      
      <div className="mt-6 px-1 w-[1200px] shrink-0">
        {calendarView === 'champs' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 p-4 bg-muted/20 border rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><Spade className="size-5 text-primary"/> Fruits</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><Carrot className="size-5 text-primary"/> Racines</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><Flower className="size-5 text-primary"/> Fleurs</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><Leaf className="size-5 text-primary"/> Feuilles</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 p-4 bg-muted/10 border border-dashed rounded-xl">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase text-muted-foreground"><Scissors className="size-5 text-orange-600"/> TAILLE</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase text-muted-foreground"><RefreshCw className="size-5 text-pink-600"/> BOUTURAGE</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase text-muted-foreground"><Leaf className="size-5 text-green-600"/> TONTE</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 p-4 bg-muted/20 border rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><Fish className="size-5 text-primary"/> Lagon (Indice)</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><Fish className="size-5 text-orange-500"/><Star className="size-3 text-yellow-500 -ml-1 mr-1" /> Pélagiques</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><CrabIcon className="size-5 text-green-600"/> Crabe (Plein)</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><CrabIcon className="size-5 text-destructive"/> Crabe (Mout)</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><LobsterIcon className="size-5 text-blue-600"/> Langouste (Activité)</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase"><OctopusIcon className="size-5 text-purple-600"/> Poulpe (Activité)</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase text-primary"><Waves className="size-5"/> Heure/Hauteur</div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase text-primary"><Star className="size-4 fill-primary" /> Grandes Marées</div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase"><span className="bg-primary text-white px-2 py-0.5 rounded-[2px]">Haute {'>'} Seuil</span></div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase"><span className="bg-destructive text-white px-2 py-0.5 rounded-[2px]">Basse {'<'} Seuil</span></div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!detailedDay} onOpenChange={(isOpen) => !isOpen && setDetailedDay(null)}>
        <DialogContent className="w-[95vw] max-w-lg h-[90vh] p-0 flex flex-col rounded-xl overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 shrink-0 bg-muted/10 border-b">
            <DialogTitle className="text-lg font-black uppercase tracking-tighter">
              {detailedDay ? format(detailedDay, 'eeee d MMMM', { locale: fr }) : ''}
            </DialogTitle>
          </DialogHeader>
          
          <div 
            className="flex-grow p-6 overflow-y-auto overscroll-contain" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}
          >
            {calendarView === 'peche' 
              ? (detailedDay && <PecheDetailDialogContent day={detailedDay} location={selectedLocation} />)
              : (detailedDay && <ChampsDetailDialogContent day={detailedDay} location={selectedLocation} />)
            }
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t shrink-0">
            <DialogClose asChild>
              <Button variant="outline" className="w-full h-12 font-black uppercase text-xs shadow-sm">Fermer</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChampsDetailDialogContent({ day, location }: { day: Date; location: string }) {
  const [data, setData] = useState<LocationData | null>(null);
  useEffect(() => { setData(getDataForDate(location, day)); }, [location, day]);
  if (!data) return <Skeleton className="h-64 w-full" />;
  const { farming, weather } = data;
  const GardeningIcon = { Fruits: Spade, Racines: Carrot, Fleurs: Flower, Feuilles: Leaf }[farming.zodiac];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3">
        <div className="p-4 bg-primary/5 border rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2"><MoonPhaseIcon phase={weather.moon.phase} className="text-primary"/><span className="text-xs font-bold uppercase">Lune</span></div>
          <span className="font-black text-xs">{weather.moon.phase}</span>
        </div>
        <div className="p-4 bg-accent/5 border rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2"><GardeningIcon className="size-4 text-accent"/><span className="text-xs font-bold uppercase">Zodiaque</span></div>
          <span className="font-black text-xs">Jour {farming.zodiac}</span>
        </div>
      </div>
      <div className="p-4 bg-muted/30 border-2 border-dashed rounded-lg">
        <p className="text-sm font-bold leading-relaxed">{farming.recommendation}</p>
      </div>
      <div className="space-y-3">
        {farming.details.map((item, i) => (
          <div key={i} className="p-3 border rounded-lg flex gap-3">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <Leaf className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-black text-xs uppercase">{item.task}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PecheDetailDialogContent({ day, location }: { day: Date; location: string }) {
  const [data, setData] = useState<LocationData | null>(null);
  useEffect(() => { setData(getDataForDate(location, day)); }, [location, day]);
  if (!data) return <Skeleton className="h-64 w-full" />;
  const { fishing, weather, crabAndLobster } = data;
  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Waves className="size-4" /> Marées du jour
        </h3>
        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Heure</span><span>Hauteur</span></div>
        {data.tides.map((t, i) => (
          <div key={i} className="flex justify-between font-black text-sm border-b border-blue-200/50 py-1 last:border-0">
            <span className={t.type === 'haute' ? 'text-primary' : 'text-blue-600'}>{t.time}</span>
            <span>{t.height.toFixed(2)}m</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CrabIcon className="size-4" /> Crustacés & Mollusques
        </h3>
        <div className="grid grid-cols-1 gap-2">
            <div className="p-3 bg-muted/20 border rounded-xl flex items-start gap-3">
                <div className={cn("p-2 rounded-lg shrink-0", crabAndLobster.crabStatus === 'Plein' ? 'bg-green-500/10' : 'bg-red-500/10')}>
                    <CrabIcon className={cn("size-5", crabAndLobster.crabStatus === 'Plein' ? 'text-green-600' : 'text-red-600')} />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Crabe de palétuvier</span>
                        <Badge variant={crabAndLobster.crabStatus === 'Plein' ? 'default' : (crabAndLobster.crabStatus === 'Mout' ? 'destructive' : 'secondary')} className="text-[9px] h-4">
                            {crabAndLobster.crabStatus}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{crabAndLobster.crabMessage}</p>
                </div>
            </div>
            <div className="p-3 bg-muted/20 border rounded-xl flex items-start gap-3">
                <div className={cn("p-2 rounded-lg shrink-0", crabAndLobster.lobsterActivity === 'Élevée' ? 'bg-blue-500/10' : 'bg-muted')}>
                    <LobsterIcon className={cn("size-5", crabAndLobster.lobsterActivity === 'Élevée' ? 'text-blue-600' : 'text-muted-foreground')} />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Langouste</span>
                        <Badge variant={crabAndLobster.lobsterActivity === 'Élevée' ? 'default' : 'secondary'} className="text-[9px] h-4">
                            {crabAndLobster.lobsterActivity}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{crabAndLobster.lobsterMessage}</p>
                </div>
            </div>
            <div className="p-3 bg-muted/20 border rounded-xl flex items-start gap-3">
                <div className={cn("p-2 rounded-lg shrink-0", crabAndLobster.octopusActivity === 'Élevée' ? 'bg-purple-500/10' : 'bg-muted')}>
                    <OctopusIcon className={cn("size-5", crabAndLobster.octopusActivity === 'Élevée' ? 'text-purple-600' : 'text-muted-foreground')} />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Poulpe (Ourite)</span>
                        <Badge variant={crabAndLobster.octopusActivity === 'Élevée' ? 'default' : 'secondary'} className="text-[9px] h-4">
                            {crabAndLobster.octopusActivity}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{crabAndLobster.octopusMessage}</p>
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Fish className="size-4" /> Prévisions par Espèces
        </h3>
        {fishing.map((slot, i) => (
          <div key={i} className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Clock className="size-3" /> {slot.timeOfDay}
            </p>
            <div className="space-y-2">
              {slot.fish.filter(f => f.rating >= 8).map((f, fi) => (
                <div key={fi} className="p-3 border rounded-lg bg-card shadow-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/5 flex items-center justify-center">
                            <Fish className="size-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm">{f.name}</span>
                            {f.location && <span className="text-[9px] font-black uppercase text-muted-foreground">{f.location}</span>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <RatingStars rating={f.rating} />
                        <span className="text-[9px] font-black opacity-60 mt-0.5">{f.rating}/10</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <p><span className="font-black uppercase text-[9px] text-foreground/70 mr-1">Activité:</span> {f.advice.activity}</p>
                    <p><span className="font-black uppercase text-[9px] text-foreground/70 mr-1">Profondeur:</span> <span className="text-primary font-bold">{f.advice.depth}</span></p>
                    <p><span className="font-black uppercase text-[9px] text-foreground/70 mr-1">Spot:</span> {f.advice.location_specific}</p>
                  </div>
                </div>
              ))}
              {slot.fish.filter(f => f.rating >= 8).length === 0 && (
                <p className="text-[10px] italic text-muted-foreground pl-2">Aucune activité majeure.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
