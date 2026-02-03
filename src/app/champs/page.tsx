
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
  CalendarDays
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { MoonPhaseIcon } from '@/components/ui/lunar-calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { GardeningManager } from '@/components/gardening-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    setIsLoading(true);
    const fetchedData = getDataForDate(selectedLocation, selectedDate);
    setData(fetchedData);
    setIsLoading(false);
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
    <div className="space-y-6 pb-12 w-full max-w-full overflow-x-hidden">
      <Card>
        <CardHeader>
          <CardTitle>Conseils du Jour</CardTitle>
          <CardDescription>
            Que faire au jardin à {selectedLocation} le {dateString} ?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-1">
              <h3 className="font-bold text-xs uppercase text-muted-foreground">Phase Lunaire</h3>
              <p className="flex items-center gap-2 text-primary font-bold text-lg">
                <MoonPhaseIcon
                  phase={weather.moon.phase}
                  className="size-5"
                />
                {weather.moon.phase}
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-xs uppercase text-muted-foreground">Tendance</h3>
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
              <h3 className="font-bold text-xs uppercase text-muted-foreground">Zodiaque</h3>
              <p className="text-lg font-bold">Jour {farming.zodiac}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <div className="p-2 rounded-full bg-accent/10 h-fit">
              <Info className="size-5 text-accent" />
            </div>
            <p className="text-sm sm:text-base leading-relaxed font-medium">{farming.recommendation}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="tasks" className="text-base font-bold">Tâches</TabsTrigger>
          <TabsTrigger value="manager" className="text-base font-bold">Mes Semis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {farming.details.map((item, index) => {
              const Icon = icons[item.icon];
              return (
                <Card key={index} className="shadow-sm">
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                    <div className="p-3 rounded-full bg-primary/10 text-primary">
                      {Icon && <Icon className="size-6" />}
                    </div>
                    <CardTitle className="text-lg">{item.task}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="manager" className="pt-4">
          <GardeningManager locationData={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
