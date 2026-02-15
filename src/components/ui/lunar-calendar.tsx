
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Moon,
  Fish,
  Waves,
  Star,
  Clock,
  Info
} from 'lucide-react';
import { Button } from './button';
import { cn, getRegionalNow } from '@/lib/utils';
import { useCalendarView } from '@/context/calendar-view-context';
import type { Tide } from '@/lib/types';
import { CrabIcon, LobsterIcon } from '../icons';
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
  const { selectedLocation, selectedRegion } = useLocation();
  const { calendarView } = useCalendarView();
  
  const data = useMemo(() => generateProceduralData(selectedLocation, day), [selectedLocation, day]);

  // Use regional today instead of local browser date
  const today = useMemo(() => startOfDay(getRegionalNow(selectedRegion)), [selectedRegion]);
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

  // Calcul du score de pêche maximal pour la journée
  const maxFishRating = useMemo(() => {
    return Math.max(...data.fishing.flatMap(slot => slot.fish.map(f => f.rating)));
  }, [data.fishing]);

  // Détection de l'activité pélagique (Tazard, Wahoo, Thon)
  const hasHighPelagicActivity = useMemo(() => {
    if (!data.pelagicInfo?.inSeason) return false;
    const pelagicNames = ['Wahoo', 'Tazard', 'Thon Jaune'];
    return data.fishing.some(slot => 
      slot.fish.some(f => pelagicNames.includes(f.name) && f.rating >= 8)
    );
  }, [data.fishing, data.pelagicInfo]);

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
          {/* Notation par nombre de poissons */}
          <div className="flex items-center justify-center gap-0.5 h-4 mb-1">
            <div className="flex gap-0.5">
                {maxFishRating >= 5 && (
                <Fish className={cn("size-3 text-primary", maxFishRating >= 9 && "fill-primary")} />
                )}
                {maxFishRating >= 7 && (
                <Fish className={cn("size-3 text-primary", maxFishRating >= 9 && "fill-primary")} />
                )}
                {maxFishRating >= 9 && (
                <Fish className={cn("size-3 text-primary fill-primary animate-pulse")} />
                )}
            </div>
            
            {/* Indicateur Pélagiques (Orange) */}
            {hasHighPelagicActivity && (
                <div className="border-l border-primary/20 ml-1 pl-1">
                    <Fish className="size-3 text-orange-500 fill-orange-500 drop-shadow-sm" />
                </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-0.5 h-3 overflow-hidden flex-nowrap whitespace-nowrap w-full border-t border-dashed border-primary/10 pt-1">
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
  const { selectedLocation, selectedRegion } = useLocation();
  const [displayDate, setDisplayDate] = useState(startOfMonth(selectedDate));
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const initialDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  // Sync calendar month when region changes (which updates selectedDate via getRegionalNow)
  useEffect(() => {
    setDisplayDate(startOfMonth(selectedDate));
  }, [selectedRegion]);

  const [detailedDay, setDetailedDay] = useState<Date | null>(null);

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
  }, [displayDate, selectedRegion]);

  const detailedDayData = useMemo(() => {
    if (!detailedDay) return null;
    return getDataForDate(selectedLocation, detailedDay);
  }, [selectedLocation, detailedDay]);

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
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800">
              {detailedDay ? format(detailedDay, 'eeee d MMMM', { locale: fr }).toUpperCase() : ''}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase opacity-60">
              Fiche Tactique Journalière • {selectedRegion}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 bg-slate-50/50">
            {detailedDay && detailedDayData && (
              <div className="space-y-8">
                {calendarView === 'champs' ? (
                  <div className="space-y-6">
                    {/* SECTION 1: LUNE & ZODIAQUE CARDS */}
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between p-4 bg-white border-2 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
                            <MoonPhaseIcon phase={detailedDayData.weather.moon.phase} className="size-5 text-primary" />
                          </div>
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Lune</span>
                        </div>
                        <span className="font-black text-xs uppercase text-slate-800">{detailedDayData.weather.moon.phase}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white border-2 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-accent/5 rounded-xl border border-accent/10">
                            {React.createElement({ Fruits: Spade, Racines: Carrot, Fleurs: Flower, Feuilles: Leaf }[detailedDayData.farming.zodiac] || Spade, { className: "size-5 text-accent" })}
                          </div>
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Zodiaque</span>
                        </div>
                        <span className="font-black text-xs uppercase text-slate-800">Jour {detailedDayData.farming.zodiac}</span>
                      </div>
                    </div>

                    {/* SECTION 2: RECOMMENDATION BOX */}
                    <div className="p-5 bg-white border-2 border-dashed border-accent/20 rounded-2xl">
                      <p className="text-sm font-bold leading-relaxed text-slate-700 text-center italic">
                        "{detailedDayData.farming.recommendation}"
                      </p>
                    </div>

                    {/* SECTION 3: TRAVAUX RECOMMANDÉS */}
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center gap-2">
                        <Info className="size-3" /> Travaux recommandés
                      </h3>
                      <div className="grid gap-3">
                        {detailedDayData.farming.details.map((item, idx) => {
                          const Icon = { Spade, Carrot, Flower, Leaf, Scissors, RefreshCw }[item.icon] || Leaf;
                          return (
                            <div key={idx} className="flex items-center gap-4 p-4 bg-white border-2 rounded-2xl shadow-sm">
                              <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 shrink-0">
                                <Icon className="size-6 text-primary" />
                              </div>
                              <div className="space-y-1 min-w-0">
                                <h4 className="font-black uppercase text-xs tracking-tight text-slate-800">{item.task}</h4>
                                <p className="text-[10px] font-medium text-muted-foreground leading-tight">{item.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* SECTION 1: MARÉES DU JOUR */}
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center gap-2">
                        <Waves className="size-3" /> Marées du jour
                      </h3>
                      <div className="bg-blue-50/50 border rounded-2xl p-4">
                        <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground/60 mb-2 px-2">
                          <span>Heure</span>
                          <span>Hauteur</span>
                        </div>
                        <div className="space-y-1">
                          {detailedDayData.tides
                            .sort((a, b) => {
                              const timeA = a.time.split(':').map(Number).reduce((h, m) => h * 60 + m);
                              const timeB = b.time.split(':').map(Number).reduce((h, m) => h * 60 + m);
                              return timeA - timeB;
                            })
                            .map((tide, i) => (
                              <div key={i} className="flex justify-between items-center py-2 px-2 border-b border-blue-100/50 last:border-0">
                                <span className="font-black text-primary text-sm">{tide.time}</span>
                                <span className="font-black text-slate-800 text-sm">{tide.height.toFixed(2)}m</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: CRUSTACÉS & MOLLUSQUES */}
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center gap-2">
                        <CrabIcon className="size-3" /> Crustacés & Mollusques
                      </h3>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between p-3 bg-white border-2 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-xl"><CrabIcon className="size-5 text-red-500" /></div>
                            <div>
                              <p className="font-black text-xs uppercase">Crabe</p>
                              <p className="text-[9px] font-medium text-muted-foreground leading-tight">{detailedDayData.crabAndLobster.crabMessage}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary h-5 px-1.5">{detailedDayData.crabAndLobster.crabStatus}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white border-2 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-xl"><LobsterIcon className="size-5 text-blue-500" /></div>
                            <div>
                              <p className="font-black text-xs uppercase">Langouste</p>
                              <p className="text-[9px] font-medium text-muted-foreground leading-tight">{detailedDayData.crabAndLobster.lobsterMessage}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary h-5 px-1.5">{detailedDayData.crabAndLobster.lobsterActivity}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: PRÉVISIONS PAR ESPÈCES */}
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center gap-2">
                        <Fish className="size-3" /> Prévisions par espèces
                      </h3>
                      {detailedDayData.fishing.map((slot, sIdx) => (
                        <div key={sIdx} className="space-y-3">
                          <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground/60 px-1 border-l-2 border-primary/20 ml-1 pl-2">
                            <Clock className="size-3" /> {slot.timeOfDay}
                          </div>
                          <div className="grid gap-3">
                            {slot.fish.map((f, fIdx) => (
                              <div key={fIdx} className="bg-white border-2 rounded-2xl p-4 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/5 rounded-xl"><Fish className="size-5 text-primary" /></div>
                                    <div>
                                      <h4 className="font-black text-sm uppercase leading-none">{f.name}</h4>
                                      <span className="text-[8px] font-bold text-muted-foreground uppercase">{f.location}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <div className="flex gap-0.5">
                                      {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={cn("size-3", i < Math.floor(f.rating / 2) ? "fill-yellow-400 text-yellow-400" : "text-slate-200")} />
                                      ))}
                                    </div>
                                    <span className="text-[9px] font-black opacity-40">{f.rating}/10</span>
                                  </div>
                                </div>
                                <div className="grid gap-2 pt-3 border-t border-dashed">
                                  <div className="flex gap-2">
                                    <span className="text-[8px] font-black uppercase text-muted-foreground min-w-[75px]">Activité:</span>
                                    <span className="text-[10px] font-medium leading-relaxed">{f.advice.activity}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-[8px] font-black uppercase text-muted-foreground min-w-[75px]">Profondeur:</span>
                                    <span className="text-[10px] font-black text-primary uppercase">{f.advice.depth}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-[8px] font-black uppercase text-muted-foreground min-w-[75px]">Spot:</span>
                                    <span className="text-[10px] font-medium leading-relaxed italic">"{f.advice.location_specific}"</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-muted/10">
            <DialogClose asChild>
              <Button variant="outline" className="w-full h-14 font-black uppercase shadow-xl bg-white hover:bg-slate-50 transition-all border-2 text-slate-800">FERMER</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
