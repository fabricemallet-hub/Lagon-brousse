'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Sprout,
  Wheat,
  Info,
  TrendingUp,
  TrendingDown,
  Star,
  Waves,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useCalendarView } from '@/context/calendar-view-context';
import type { FishRating } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { CrabIcon, LobsterIcon, OctopusIcon } from '../icons';
import { Separator } from './separator';
import { Skeleton } from './skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
    case 'Premier croissant': return <Moon className={baseClassName} />;
    case 'Premier quartier': return <Circle className={cn(baseClassName, 'fill-current')} style={{ clipPath: 'inset(0 50% 0 0)' }} />;
    case 'Lune gibbeuse croissante': return <Circle className={cn(baseClassName, 'fill-current')} style={{ clipPath: 'inset(0 25% 0 0)' }} />;
    case 'Pleine lune': return <Circle className={cn(baseClassName, 'fill-current')} />;
    case 'Lune gibbeuse décroissante': return <Circle className={cn(baseClassName, 'fill-current')} style={{ clipPath: 'inset(0 0 0 25%)' }} />;
    case 'Dernier quartier': return <Circle className={cn(baseClassName, 'fill-current')} style={{ clipPath: 'inset(0 0 0 50%)' }} />;
    case 'Dernier croissant': return <Moon className={cn(baseClassName, 'scale-x-[-1]')} />;
    default: return <Circle className={baseClassName} strokeWidth={1} />;
  }
};

const getTideIcon = (movement: 'montante' | 'descendante' | 'étale') => {
  switch (movement) {
    case 'montante': return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'descendante': return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return null;
  }
};

const RatingStars = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 === 1;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
      {halfStar && <Star key="half" className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />)}
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
    const pelagicRatings = allFishRatings.filter(f => f.location === 'Large' || f.location === 'Mixte');
    const totalLagonRating = lagonRatings.reduce((acc, f) => acc + f.rating, 0);
    const averageLagonRating = lagonRatings.length > 0 ? totalLagonRating / lagonRatings.length : 0;
    const lagonFishCount = Math.max(1, Math.round(averageLagonRating / 2));
    const totalPelagicRating = pelagicRatings.reduce((acc, f) => acc + f.rating, 0);
    const averagePelagicRating = pelagicRatings.length > 0 ? totalPelagicRating / pelagicRatings.length : 0;
    const pelagicFishCount = Math.max(1, Math.round(averagePelagicRating / 2));

    return {
      lagon: Array.from({ length: lagonFishCount }).map((_, i) => <Fish key={`lagon-${i}`} className="size-3 text-primary" />),
      pelagic: Array.from({ length: pelagicFishCount }).map((_, i) => <Fish key={`pelagic-${i}`} className="size-3 text-destructive" />)
    };
  }, [data, calendarView]);

  const { zodiac, isGoodForCuttings, isGoodForPruning, isGoodForMowing, sow, harvest } = data.farming;
  const GardeningIcon = { Fruits: Spade, Racines: Carrot, Fleurs: Flower, Feuilles: Leaf }[zodiac];

  const prevDate = useMemo(() => {
    const d = new Date(day);
    d.setDate(day.getDate() - 1);
    return d;
  }, [day]);
  const prevData = useMemo(() => generateProceduralData(selectedLocation, prevDate), [selectedLocation, prevDate]);

  const eventTexts = useMemo(() => {
    const texts = [];
    const currentPhase = data.weather.moon.phase;
    if (currentPhase !== prevData.weather.moon.phase) {
      if (['Premier quartier', 'Dernier quartier', 'Pleine lune', 'Nouvelle lune'].includes(currentPhase)) texts.push(currentPhase);
    }
    if (data.farming.lunarPhase !== prevData.farming.lunarPhase) texts.push(data.farming.lunarPhase);
    return texts;
  }, [data, prevData]);

  return (
    <div
      onClick={() => onDateSelect(day)}
      className={cn(
        'h-44 border-t border-l p-1 flex flex-col cursor-pointer hover:bg-accent/50 relative group min-w-24 transition-colors',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        isPastDay && 'opacity-40 bg-muted/10',
        isTodayDay && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
        isSelected && 'ring-2 ring-primary z-10 bg-background shadow-inner',
        (getDay(day) + 6) % 7 === 0 && 'border-l-0'
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <MoonPhaseIcon phase={data.weather.moon.phase} className="size-3"/>
          <span className="font-mono">{data.weather.moon.percentage}%</span>
        </div>
        <div className={cn(
          "font-bold text-sm text-right px-1.5 py-0.5 rounded-full transition-colors",
          isTodayDay ? "bg-primary text-primary-foreground" : "text-foreground"
        )}>{format(day, 'd')}</div>
      </div>

      {eventTexts.length > 0 && (
        <div className="text-[10px] text-center text-accent font-semibold truncate leading-tight my-0.5">
          {eventTexts.join(' / ')}
        </div>
      )}

      {calendarView === 'peche' ? (
        <div className="flex-grow flex flex-col justify-between pt-1">
          <div className="flex-grow flex flex-col items-center justify-center space-y-0.5">
            <div className="flex items-center justify-center gap-1.5 h-4">
              {data.crabAndLobster.crabStatus === 'Plein' && <CrabIcon className="size-3 text-green-600" title="Crabe plein" />}
              {data.crabAndLobster.crabStatus === 'Mout' && <CrabIcon className="size-3 text-orange-500" title="Crabe en mue" />}
              {data.crabAndLobster.lobsterActivity === 'Élevée' && <LobsterIcon className="size-3 text-blue-600" title="Activité langouste élevée" />}
              {data.crabAndLobster.octopusActivity === 'Élevée' && <OctopusIcon className="size-3 text-purple-600" title="Bonne période pour le poulpe" />}
            </div>
            <div className="flex items-center justify-center gap-0.5 h-3">
              {fishingIcons?.lagon}
            </div>
            <div className="flex items-center justify-center gap-0.5 h-3">
              {fishingIcons?.pelagic}
            </div>
          </div>
          <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground mt-1">
            {data.tides.map((tide, i) => {
              const isHighTideHighlight = tide.type === 'haute' && tide.height >= 1.7;
              const isLowTideHighlight = tide.type === 'basse' && tide.height <= 0.23;
              return (
                <div key={i} className={cn('flex justify-between px-1', isHighTideHighlight && 'text-purple-600 font-bold', isLowTideHighlight && 'text-red-600 font-bold')}>
                  <span>{tide.time}</span>
                  <span>{tide.type === 'haute' ? 'H' : 'B'}: {tide.height.toFixed(2)}m</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-start justify-start gap-1 w-full pt-1 overflow-y-auto">
          <div className="flex items-center gap-1.5">
            {GardeningIcon && <GardeningIcon className="size-3.5 text-primary" />}
            <p className="text-xs text-muted-foreground font-semibold">{zodiac}</p>
          </div>
          <div className="space-y-1 text-xs font-semibold self-stretch">
            {isGoodForPruning && <div className="flex items-center gap-1.5 text-orange-600"><Scissors className="size-3 shrink-0" /><span>Taille</span></div>}
            {isGoodForCuttings && <div className="flex items-center gap-1.5 text-pink-600"><RefreshCw className="size-3 shrink-0" /><span>Bouture</span></div>}
            {isGoodForMowing && <div className="flex items-center gap-1.5 text-green-600"><Scissors className="size-3 shrink-0" /><span>Tonte pelouse</span></div>}
            {sow.length > 0 && <div className="flex items-center gap-1.5 text-blue-600"><Sprout className="size-3 shrink-0" /><span className="truncate">Semis</span></div>}
            {harvest.length > 0 && <div className="flex items-center gap-1.5 text-purple-600"><Wheat className="size-3 shrink-0" /><span className="truncate">Récolte</span></div>}
          </div>
        </div>
      )}
    </div>
  );
});
DayCell.displayName = 'DayCell';

function GardeningLegend() {
  const legendItems = [
    { icon: Spade, label: 'Jours Fruits', color: 'text-primary' },
    { icon: Carrot, label: 'Jours Racines', color: 'text-primary' },
    { icon: Flower, label: 'Jours Fleurs', color: 'text-primary' },
    { icon: Leaf, label: 'Jours Feuilles', color: 'text-primary' },
    { icon: Scissors, label: 'Taille', color: 'text-orange-600' },
    { icon: RefreshCw, label: 'Bouturage', color: 'text-pink-600' },
    { icon: Scissors, label: 'Tonte pelouse', color: 'text-green-600' },
    { icon: Sprout, label: 'Semis', color: 'text-blue-600' },
    { icon: Wheat, label: 'Récolte', color: 'text-purple-600' },
  ];

  return (
    <div className="mt-4 p-2 border rounded-lg bg-muted/50">
      <h4 className="font-semibold mb-2 text-sm">Légende du Jardinier</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <item.icon className={cn('size-4', item.color)} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PecheLegend() {
  return (
    <div className="mt-4 p-3 border rounded-lg bg-muted/50 text-sm">
      <h4 className="font-semibold mb-2">Légende de Pêche</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        <div className="flex items-center gap-3"><Fish className="size-4 text-primary" /><span>Pêche en lagon</span></div>
        <div className="flex items-center gap-3"><Fish className="size-4 text-destructive" /><span>Pêche au large</span></div>
        <div className="flex items-center gap-3"><CrabIcon className="size-4 text-green-600" /><span>Crabe plein</span></div>
        <div className="flex items-center gap-3"><CrabIcon className="size-4 text-orange-500" /><span>Crabe en mue</span></div>
        <div className="flex items-center gap-3"><LobsterIcon className="size-4 text-blue-600" /><span>Forte activité langouste</span></div>
        <div className="flex items-center gap-3"><OctopusIcon className="size-4 text-purple-600" /><span>Bonne période poulpe</span></div>
      </div>
    </div>
  );
}

function DetailDialogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

function ChampsDetailDialogContent({ day, location }: { day: Date; location: string }) {
  const [data, setData] = useState<LocationData | null>(null);
  
  useEffect(() => {
    const fetchedData = getDataForDate(location, day);
    setData(fetchedData);
  }, [location, day]);

  if (!data) return <DetailDialogSkeleton />;

  const { farming, weather } = data;
  const GardeningIcon = { Fruits: Spade, Racines: Carrot, Fleurs: Flower, Feuilles: Leaf }[farming.zodiac];

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">Conseils Jardin du {format(day, 'eeee d MMMM yyyy', { locale: fr })}</DialogTitle>
        <DialogDescription>Recommandations basées sur le cycle lunaire et les traditions locales.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/50 border">
        <div className="space-y-1">
          <h3 className="font-bold text-[10px] uppercase text-muted-foreground">Lune</h3>
          <p className="flex items-center gap-2 text-primary font-bold text-sm">
            <MoonPhaseIcon phase={weather.moon.phase} className="size-4" />
            {weather.moon.phase}
          </p>
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-[10px] uppercase text-muted-foreground">Tendance</h3>
          <p className="flex items-center gap-2 font-bold text-sm">
            {farming.lunarPhase === 'Lune Montante' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            {farming.lunarPhase}
          </p>
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-[10px] uppercase text-muted-foreground">Signe</h3>
          <p className="flex items-center gap-2 font-bold text-sm">
            {GardeningIcon && <GardeningIcon className="size-4" />}
            Jour {farming.zodiac}
          </p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex gap-3">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm font-medium leading-relaxed">{farming.recommendation}</p>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" /> Travaux à prévoir
        </h4>
        <div className="grid gap-3">
          {farming.details.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-card border shadow-sm">
              <div className="p-2 rounded-full bg-muted">
                {item.icon === 'Leaf' && <Leaf className="size-4" />}
                {item.icon === 'Spade' && <Spade className="size-4" />}
                {item.icon === 'Flower' && <Flower className="size-4" />}
                {item.icon === 'RefreshCw' && <RefreshCw className="size-4" />}
                {item.icon === 'Scissors' && <Scissors className="size-4" />}
                {item.icon === 'Carrot' && <Carrot className="size-4" />}
              </div>
              <div>
                <p className="font-bold text-sm">{item.task}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PecheDetailDialogContent({ day, location }: { day: Date; location: string }) {
  const [data, setData] = useState<LocationData | null>(null);

  useEffect(() => {
    const fetchedData = getDataForDate(location, day);
    setData(fetchedData);
  }, [location, day]);

  if (!data) return <DetailDialogSkeleton />;

  const { fishing, weather, crabAndLobster } = data;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">Prévisions Pêche du {format(day, 'eeee d MMMM yyyy', { locale: fr })}</DialogTitle>
        <DialogDescription>Potentiel par espèce et conditions de marées.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-muted/50 border space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Moon className="size-4" />
            <span className="text-[10px] font-bold uppercase">Phase Lunaire</span>
          </div>
          <div className="flex items-center gap-2 font-bold text-sm">
            <MoonPhaseIcon phase={weather.moon.phase} className="size-5 text-primary" />
            {weather.moon.phase}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Waves className="size-4" />
            <span className="text-[10px] font-bold uppercase">Marées</span>
          </div>
          <div className="space-y-1">
            {data.tides.map((tide, i) => (
              <div key={i} className="flex justify-between text-xs font-mono">
                <span className={cn(tide.type === 'haute' ? 'text-primary' : 'text-destructive')}>
                  {tide.type === 'haute' ? 'H' : 'B'}
                </span>
                <span>{tide.time}</span>
                <span className="font-bold">{tide.height.toFixed(2)}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Fish className="size-4 text-primary" /> Potentiel de capture (Indices /10)
        </h4>
        <div className="space-y-3">
          {fishing.map((slot, sIdx) => (
            <div key={sIdx} className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="size-3" /> {slot.timeOfDay}
              </p>
              <div className="grid gap-2">
                {slot.fish.filter(f => f.rating >= 8).map((f, fIdx) => (
                  <div key={fIdx} className="flex items-center justify-between p-3 rounded-lg bg-card border shadow-sm">
                    <div className="flex items-center gap-3">
                      <Fish className={cn("size-4", f.location === 'Large' ? 'text-destructive' : 'text-primary')} />
                      <div>
                        <p className="font-bold text-sm">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{f.advice.depth} • {f.location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <RatingStars rating={f.rating} />
                      <span className="text-[10px] font-mono font-bold">{f.rating}/10</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-muted/30 border border-dashed space-y-3">
        <h4 className="font-bold text-xs uppercase text-muted-foreground">Autres ressources</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <CrabIcon className="size-5 text-green-600" />
            <div className="text-xs">
              <p className="font-bold">Crabe : {crabAndLobster.crabStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LobsterIcon className="size-5 text-blue-600" />
            <div className="text-xs">
              <p className="font-bold">Langouste : {crabAndLobster.lobsterActivity}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div>
      <div className="border rounded-lg bg-card">
        <div className="flex justify-between items-center p-2 border-b">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft /></Button>
          <h2 className="text-lg font-bold capitalize">{format(displayDate, 'MMMM yyyy', { locale: fr })}</h2>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight /></Button>
        </div>
        <div className="grid grid-cols-7 bg-muted/20">
          {weekdays.map((day) => <div key={day} className="text-center text-[10px] font-black uppercase text-muted-foreground p-2 border-l first:border-l-0">{day}</div>)}
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[672px]">
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
      
      {calendarView === 'champs' ? <GardeningLegend /> : <PecheLegend />}

      <Dialog open={!!detailedDay} onOpenChange={(isOpen) => !isOpen && setDetailedDay(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none bg-background shadow-2xl">
          <div className="p-6">
            {calendarView === 'peche' 
              ? (detailedDay && <PecheDetailDialogContent day={detailedDay} location={selectedLocation} />)
              : (detailedDay && <ChampsDetailDialogContent day={detailedDay} location={selectedLocation} />)
            }
          </div>
          <DialogFooter className="p-4 bg-muted/20 border-t flex-row justify-center sm:justify-center sticky bottom-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-32 font-bold">Retour</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}