
'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getDataForDate, LocationData } from '@/lib/data';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { WindMap } from '@/components/ui/wind-map';
import {
  AlertTriangle,
  Wind,
  Droplets,
  Clock,
  Sunrise,
  Sunset,
  Info,
  Package,
  Crosshair,
  Users
} from 'lucide-react';
import { ShootingTableCard } from '@/components/ui/shooting-table-card';
import { GunRackManager } from '@/components/gun-rack-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { translateWindDirection } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import dynamique pour économiser la mémoire au démarrage
const HuntingSessionCard = dynamic(() => import('@/components/hunting-session').then(mod => mod.HuntingSessionCard), { 
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />
});

function ChasseSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function ChassePage() {
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
    return <ChasseSkeleton />;
  }

  const { hunting, weather } = data;

  return (
    <div className="space-y-6 pb-24 px-1">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-2 pb-4">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Chasse & Tactique</CardTitle>
          <CardDescription className="text-xs font-bold uppercase opacity-60">
            Prévisions brousse et outils de tir à {selectedLocation} le {dateString}.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="shooting" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-2 h-auto mb-8 bg-transparent p-0 border-none">
          <TabsTrigger 
            value="shooting" 
            className="group flex flex-col items-center justify-center gap-2 py-4 rounded-[2rem] border-2 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-slate-900 data-[state=active]:shadow-xl data-[state=inactive]:bg-white data-[state=inactive]:border-slate-100 active:scale-95"
          >
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white transition-colors">
              <Crosshair className="size-5" />
            </div>
            <span className="font-black uppercase text-[9px] tracking-widest leading-none">Balistique</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="forecast" 
            className="group flex flex-col items-center justify-center gap-2 py-4 rounded-[2rem] border-2 transition-all data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-orange-600 data-[state=active]:shadow-xl data-[state=inactive]:bg-white data-[state=inactive]:border-orange-50 active:scale-95"
          >
            <div className="p-2 rounded-xl bg-orange-50 text-orange-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white transition-colors">
              <Wind className="size-5" />
            </div>
            <span className="font-black uppercase text-[9px] tracking-widest leading-none">Météo</span>
          </TabsTrigger>

          <TabsTrigger 
            value="group" 
            className="group flex flex-col items-center justify-center gap-2 py-4 rounded-[2rem] border-2 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 data-[state=active]:shadow-xl data-[state=inactive]:bg-white data-[state=inactive]:border-blue-50 active:scale-95"
          >
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white transition-colors">
              <Users className="size-5" />
            </div>
            <span className="font-black uppercase text-[9px] tracking-widest leading-none">Session</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shooting" className="space-y-8 animate-in fade-in duration-300">
          <ShootingTableCard />
          <GunRackManager />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6 animate-in fade-in duration-300">
          {hunting.period.name === 'Brame' && (
            <Alert className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="font-bold uppercase text-xs">Période de Brame : Activité maximale</AlertTitle>
              <AlertDescription className="text-xs">{hunting.period.description}</AlertDescription>
            </Alert>
          )}

          {hunting.period.name === 'Chute des bois' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle className="uppercase text-xs font-black">{`Période de ${hunting.period.name}`}</AlertTitle>
              <AlertDescription className="text-xs">{hunting.period.description}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-2 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm">
                  <Wind className="size-5 text-primary" /> Prévisions de Vent
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {weather.wind.map((forecast, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl border-2 p-3 gap-3 bg-muted/5">
                    <div className='flex-1'>
                      <p className="font-black text-xs uppercase text-muted-foreground">{forecast.time}</p>
                      <p className="text-lg font-black text-primary">{forecast.speed} nœuds</p>
                      <p className="text-[10px] font-bold uppercase opacity-60">{translateWindDirection(forecast.direction)} - {forecast.stability}</p>
                    </div>
                    <WindMap direction={forecast.direction} className="w-16 h-20" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-2 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm">
                  <Clock className="size-5 text-primary" /> Éphéméride & Horaires
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="space-y-2 rounded-xl border-2 p-4 bg-primary/5 border-primary/10">
                  <h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-primary">
                    <Droplets className="size-3" /> Humidité / Pluie
                  </h3>
                  <p className="text-xl font-black">{weather.rain}</p>
                  <p className="text-[10px] font-medium text-muted-foreground italic leading-relaxed">
                    {hunting.advice.rain}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border-2 rounded-xl bg-muted/5 flex flex-col items-center text-center gap-1">
                    <Sunrise className="size-5 text-accent" />
                    <span className="text-[9px] font-black uppercase opacity-40">Aube</span>
                    <span className="text-sm font-black">{weather.sun.sunrise}</span>
                  </div>
                  <div className="p-3 border-2 rounded-xl bg-muted/5 flex flex-col items-center text-center gap-1">
                    <Sunset className="size-5 text-accent" />
                    <span className="text-[9px] font-black uppercase opacity-40">Crépuscule</span>
                    <span className="text-sm font-black">{weather.sun.sunset}</span>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl space-y-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conseil Tactique</h3>
                  <p className="text-[11px] font-medium leading-relaxed italic">"{hunting.advice.scent}"</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="group" className="animate-in fade-in duration-300">
          <HuntingSessionCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
