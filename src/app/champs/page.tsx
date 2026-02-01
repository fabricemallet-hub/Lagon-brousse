'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate, LocationData } from '@/lib/data';
import {
  Spade,
  Scissors,
  Flower,
  Carrot,
  Leaf,
  RefreshCw,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { MoonPhaseIcon } from '@/components/ui/lunar-calendar';
import { Skeleton } from '@/components/ui/skeleton';

const icons: { [key: string]: React.FC<LucideProps> } = {
  Spade,
  Scissors,
  Flower,
  Carrot,
  Leaf,
  RefreshCw,
};

function ChampsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full" />
       <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function ChampsPage() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const [data, setData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const fetchedData = await getDataForDate(selectedLocation, selectedDate);
      setData(fetchedData);
      setIsLoading(false);
    }
    fetchData();
  }, [selectedLocation, selectedDate]);

  const dateString = selectedDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });

  if (isLoading || !data) {
    return <ChampsSkeleton />;
  }
  
  const { farming, weather } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendrier du Jardinier</CardTitle>
          <CardDescription>
            Que faire au jardin à {selectedLocation} le {dateString} selon la
            lune ?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <h3 className="font-semibold">Phase Lunaire</h3>
              <p className="flex items-center gap-2 text-primary font-bold text-lg">
                <MoonPhaseIcon
                  phase={weather.moon.phase}
                  className="size-5"
                />
                {weather.moon.phase}
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Tendance</h3>
              <p className="flex items-center gap-2 font-bold text-lg">
                {farming.lunarPhase === 'Lune Montante' ? (
                  <TrendingUp className="size-5" />
                ) : (
                  <TrendingDown className="size-5" />
                )}
                {farming.lunarPhase}
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Influence du Zodiaque</h3>
              <p className="text-lg font-bold">Jour {farming.zodiac}</p>
            </div>
          </div>
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Info className="size-5 text-accent" />
              <span>Recommandation générale</span>
            </div>
            <p className="text-muted-foreground">{farming.recommendation}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Tâches recommandées</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {farming.details.map((item, index) => {
            const Icon = icons[item.icon];
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    {Icon && <Icon className="size-6" />}
                  </div>
                  <CardTitle>{item.task}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
