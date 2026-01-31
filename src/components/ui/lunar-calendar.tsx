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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useCalendarView } from '@/context/calendar-view-context';
import type { FishRating, LocationData } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { CrabIcon, LobsterIcon } from '../icons';
import { Separator } from './separator';

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

const getTideIcon = (movement: 'montante' | 'descendante' | 'étale') => {
  switch (movement) {
    case 'montante':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'descendante':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

const RatingStars = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 === 1;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => (
        <Star
          key={`full-${i}`}
          className="h-4 w-4 fill-yellow-400 text-yellow-400"
        />
      ))}
      {halfStar && (
        <Star
          key="half"
          className="h-4 w-4 fill-yellow-400 text-yellow-400"
          style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }}
        />
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
      ))}
    </div>
  );
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
  const { calendarView } = useCalendarView();
  const data = getDataForDate(selectedLocation, day);

  // Fishing data
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

  // Gardening data
  const {
    zodiac,
    isGoodForCuttings,
    isGoodForPruning,
    isGoodForMowing,
    sow,
    harvest,
  } = data.farming;

  const GardeningIcon = {
    Fruits: Spade,
    Racines: Carrot,
    Fleurs: Flower,
    Feuilles: Leaf,
  }[zodiac];

  const prevDate = new Date(day);
  prevDate.setDate(day.getDate() - 1);
  const prevData = getDataForDate(selectedLocation, prevDate);

  const eventTexts = [];

  const currentPhase = data.weather.moon.phase;
  if (currentPhase !== prevData.weather.moon.phase) {
    if (
      currentPhase === 'Premier quartier' ||
      currentPhase === 'Dernier quartier' ||
      currentPhase === 'Pleine lune' ||
      currentPhase === 'Nouvelle lune'
    ) {
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
        'h-32 md:h-36 border-t border-l p-1 flex flex-col cursor-pointer hover:bg-accent/50 relative group',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        isSelected && 'ring-2 ring-primary z-10',
        (getDay(day) + 6) % 7 === 0 && 'border-l-0'
      )}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1 text-muted-foreground">
          <MoonPhaseIcon phase={data.weather.moon.phase} />
          <span className="text-[10px] font-mono">
            {data.weather.moon.percentage}%
          </span>
        </div>
        <div className="font-semibold text-sm">{format(day, 'd')}</div>
      </div>

      {eventTexts.length > 0 && (
        <div className="text-[10px] text-center text-accent font-semibold truncate leading-tight my-0.5">
          {eventTexts.join(' / ')}
        </div>
      )}

      {calendarView === 'peche' ? (
        <>
          <div className="flex-grow flex items-center justify-center gap-0.5">
            {fishIcons}
            {data.pelagicInfo?.inSeason && (Math.sin(day.getDate()) + 1) / 2 > 0.7 && (
                <Fish className="size-3 text-blue-500 glow" title="Bon pour les pélagiques" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-1 text-[10px] font-mono text-muted-foreground">
            {tides.map((tide, i) => (
              <span key={i} className="text-center">
                {tide.type === 'haute' ? 'H' : 'B'}: {tide.height.toFixed(2)}m
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-grow flex flex-col items-start justify-start gap-0.5 overflow-hidden w-full pt-1 px-1">
          <div className="flex items-center gap-1">
            {GardeningIcon && <GardeningIcon className="size-4 text-primary" />}
            <p className="text-xs text-muted-foreground font-semibold">
              {zodiac}
            </p>
          </div>

          <div className="space-y-0.5 text-[10px] font-semibold leading-tight self-stretch mt-1">
            {isGoodForPruning && (
              <div
                className="flex items-center gap-1 text-orange-600"
                title="Taille des arbres et arbustes"
              >
                <Scissors className="size-3 shrink-0" />
                <span>Taille</span>
              </div>
            )}
            {isGoodForCuttings && (
              <div
                className="flex items-center gap-1 text-pink-600"
                title="Bouturage"
              >
                <RefreshCw className="size-3 shrink-0" />
                <span>Bouturage</span>
              </div>
            )}
            {isGoodForMowing && (
              <div
                className="flex items-center gap-1 text-green-600"
                title="Tonte du gazon"
              >
                <Scissors className="size-3 shrink-0" />
                <span>Tonte</span>
              </div>
            )}
            {sow.length > 0 && (
              <div
                className="flex items-center gap-1 text-blue-600"
                title={`Semer: ${sow.join(', ')}`}
              >
                <Sprout className="size-3 shrink-0" />
                <span className="truncate">Semis: {sow[0]}</span>
              </div>
            )}
            {harvest.length > 0 && (
              <div
                className="flex items-center gap-1 text-purple-600"
                title={`Récolter: ${harvest.join(', ')}`}
              >
                <Wheat className="size-3 shrink-0" />
                <span className="truncate">Récolte: {harvest[0]}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GardeningLegend() {
  const legendItems = [
    { icon: Spade, label: 'Jours Fruits', color: 'text-primary' },
    { icon: Carrot, label: 'Jours Racines', color: 'text-primary' },
    { icon: Flower, label: 'Jours Fleurs', color: 'text-primary' },
    { icon: Leaf, label: 'Jours Feuilles', color: 'text-primary' },
    { icon: Scissors, label: 'Taille', color: 'text-orange-600' },
    { icon: RefreshCw, label: 'Bouturage', color: 'text-pink-600' },
    { icon: Scissors, label: 'Tonte', color: 'text-green-600' },
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

function ChampsDetailDialogContent({
  day,
  location,
}: {
  day: Date;
  location: string;
}) {
  const data = getDataForDate(location, day);
  const dateString = format(day, 'eeee d MMMM yyyy', { locale: fr });
  const { farming, weather } = data;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Détails du {dateString}</DialogTitle>
        <DialogDescription>
          Tâches de jardinage recommandées selon la lune.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 text-sm max-h-[70vh] overflow-y-auto pr-4">
        <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg">
          <div className="flex items-center gap-2">
            <MoonPhaseIcon
              phase={weather.moon.phase}
              className="size-5 text-primary"
            />
            <div>
              <p className="font-semibold">{weather.moon.phase}</p>
              <p className="text-xs text-muted-foreground">
                Illumination à {weather.moon.percentage}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {farming.lunarPhase === 'Lune Montante' ? (
              <TrendingUp className="size-5 text-primary" />
            ) : (
              <TrendingDown className="size-5 text-primary" />
            )}
            <p className="font-semibold">{farming.lunarPhase}</p>
          </div>
        </div>

        <div className="text-center p-2 rounded-lg border">
          <p className="text-xs text-muted-foreground">
            Influence du zodiaque
          </p>
          <p className="font-bold text-lg">Jour {farming.zodiac}</p>
        </div>

        <div className="space-y-1">
          <h4 className="font-semibold flex items-center gap-2">
            <Info className="size-4 text-accent" />
            <span>Recommandation générale</span>
          </h4>
          <p className="text-muted-foreground">{farming.recommendation}</p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Tâches spécifiques</h4>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {farming.isGoodForPruning && (
              <li>
                <span className="text-orange-600 font-medium">Taille :</span>{' '}
                Période favorable pour la taille des arbres et arbustes afin de
                limiter la montée de sève.
              </li>
            )}
            {farming.isGoodForCuttings && (
              <li>
                <span className="text-pink-600 font-medium">Bouturage :</span>{' '}
                Les boutures ont plus de chances de prendre racine rapidement.
              </li>
            )}
            {farming.isGoodForMowing && (
              <li>
                <span className="text-green-600 font-medium">Tonte :</span>{' '}
                Idéal pour une repousse plus lente et un gazon plus dense.
              </li>
            )}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {farming.sow.length > 0 && (
            <div className="space-y-1">
              <h4 className="font-semibold flex items-center gap-2">
                <Sprout className="size-4 text-blue-600" />
                Semis du jour
              </h4>
              <p className="text-muted-foreground">{farming.sow.join(', ')}</p>
            </div>
          )}
          {farming.harvest.length > 0 && (
            <div className="space-y-1">
              <h4 className="font-semibold flex items-center gap-2">
                <Wheat className="size-4 text-purple-600" />
                Récolte du jour
              </h4>
              <p className="text-muted-foreground">
                {farming.harvest.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PecheDetailDialogContent({
  day,
  location,
}: {
  day: Date;
  location: string;
}) {
  const data = getDataForDate(location, day);
  const dateString = format(day, 'eeee d MMMM yyyy', { locale: fr });
  const { fishing, weather, tides, pelagicInfo, crabAndLobster } = data;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Détails de Pêche du {dateString}</DialogTitle>
        <DialogDescription>
          Prévisions détaillées, marées et potentiel par espèce.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6 py-4 text-sm max-h-[70vh] overflow-y-auto pr-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-muted-foreground">
              Phase Lunaire
            </h4>
            <div className="flex items-center gap-2 font-bold">
              <MoonPhaseIcon phase={weather.moon.phase} className="size-5" />
              <span>{weather.moon.phase}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Illumination à {weather.moon.percentage}%
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-muted-foreground">
              Marées du jour
            </h4>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              {tides.map((tide, i) => (
                <div key={i} className="flex justify-between">
                  <span className="capitalize text-muted-foreground">
                    {tide.type === 'haute' ? 'Haute' : 'Basse'}:
                  </span>
                  <span className="font-mono font-medium">
                    {tide.time} ({tide.height.toFixed(2)}m)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {pelagicInfo && pelagicInfo.inSeason && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              <h4 className="font-semibold flex items-center gap-2 mb-1">
                  <Star className="size-4" />
                  Saison des Pélagiques
              </h4>
              <p className="text-xs">{pelagicInfo.message}</p>
          </div>
        )}

        <div className="space-y-4">
          {fishing.map((slot, index) => (
            <div key={index} className="border-t pt-4">
              <h4 className="font-semibold flex items-center gap-2 text-base mb-2">
                <Clock className="size-4" />
                {slot.timeOfDay}
              </h4>
              <div className="text-xs text-muted-foreground flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1">
                  <Waves className="h-4 w-4" />
                  <span>
                    Marée {slot.tide} à {slot.tideTime}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {getTideIcon(slot.tideMovement)}
                  <span className="capitalize">{slot.tideMovement}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold flex items-center gap-2">
                  <Fish className="h-4 w-4 text-primary" />
                  Potentiel par espèce
                </h5>
                {slot.fish.map((f, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      {f.location && <Badge variant={f.location === 'Large' ? 'destructive' : 'secondary'} className="text-xs font-semibold">{f.location}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <RatingStars rating={f.rating} />
                      <Badge
                        variant="outline"
                        className="w-12 justify-center"
                      >
                        {f.rating}/10
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="space-y-4 pt-4">
            <h4 className="font-semibold">Crabes & Langoustes</h4>
            <div className="flex items-start gap-3">
                <CrabIcon className="h-6 w-6 text-primary mt-1" />
                <div>
                    <div className="flex items-center gap-2">
                        <h5 className="font-medium">Crabe</h5>
                        <Badge variant={crabAndLobster.crabStatus === 'Plein' ? 'default' : 'secondary'} className="text-xs">
                        {crabAndLobster.crabStatus}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{crabAndLobster.crabMessage}</p>
                </div>
            </div>
            <div className="flex items-start gap-3">
                <LobsterIcon className="h-6 w-6 text-primary mt-1" />
                <div>
                    <div className="flex items-center gap-2">
                        <h5 className="font-medium">Langouste</h5>
                        <Badge variant={crabAndLobster.lobsterActivity === 'Élevée' ? 'default' : 'secondary'} className="text-xs">
                        {crabAndLobster.lobsterActivity}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{crabAndLobster.lobsterMessage}</p>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}

export function LunarCalendar() {
  const { selectedDate, setSelectedDate } = useDate();
  const { calendarView } = useCalendarView();
  const { selectedLocation } = useLocation();
  const [displayDate, setDisplayDate] = useState(startOfMonth(selectedDate));
  const [detailedDay, setDetailedDay] = useState<Date | null>(null);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDetailedDay(day);
  };

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
    <div>
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
              className="text-center text-xs sm:text-sm font-medium text-muted-foreground p-1 sm:p-2 border-l first:border-l-0"
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
              onDateSelect={handleDayClick}
            />
          ))}
        </div>
      </div>
      {calendarView === 'champs' && <GardeningLegend />}

      {detailedDay && (
        <Dialog
          open={!!detailedDay}
          onOpenChange={(isOpen) => !isOpen && setDetailedDay(null)}
        >
          <DialogContent className="sm:max-w-lg">
            {calendarView === 'peche' ? (
              <PecheDetailDialogContent
                day={detailedDay}
                location={selectedLocation}
              />
            ) : (
              <ChampsDetailDialogContent
                day={detailedDay}
                location={selectedLocation}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
