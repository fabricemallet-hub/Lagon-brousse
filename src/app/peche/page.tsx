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
import { getDataForDate, LocationData } from '@/lib/data';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { Clock, Waves, TrendingUp, TrendingDown, Fish, Star, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VesselTracker } from '@/components/vessel-tracker';

// Import dynamique du carnet de pêche
const FishingLogCard = dynamic(() => import('@/components/ui/fishing-log-card').then(mod => mod.FishingLogCard), { 
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />
});

function PecheSkeleton() {
  return (
     <div className="space-y-6 w-full max-w-full">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function PechePage() {
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
  
  const dateString = selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  const getTideIcon = (movement: 'montante' | 'descendante' | 'étale') => {
    switch (movement) {
      case 'montante':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case 'descendante':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
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
          <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
        {halfStar && <Star key="half" className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
        ))}
      </div>
    );
  };

  if (isLoading || !data) {
    return <PecheSkeleton />;
  }

  const { fishing, pelagicInfo, crabAndLobster } = data;

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6 pb-8">
      <Card className="w-full border-none shadow-none bg-transparent">
        <CardHeader className="px-1 py-2">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Pêche & Sécurité</CardTitle>
          <CardDescription className="text-xs">Indices de pêche et Vessel Tracker à {selectedLocation}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="indices" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 rounded-none p-1 border-b">
          <TabsTrigger value="indices" className="text-sm font-black uppercase tracking-tighter">Indices & Carnet</TabsTrigger>
          <TabsTrigger value="tracker" className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
            <Navigation className="size-4" /> Vessel Tracker
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indices" className="space-y-6 pt-4 px-1">
          {pelagicInfo && pelagicInfo.inSeason && (
            <Alert className="w-full border-2 bg-primary/5 border-primary/20">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <AlertTitle className="font-black uppercase text-xs">Saison des Pélagiques</AlertTitle>
              <AlertDescription className="text-xs font-medium">{pelagicInfo.message}</AlertDescription>
            </Alert>
          )}

          <Card className="w-full border-2 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Clock className="size-4" /> Activité Crustacés
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-4 p-3 rounded-xl bg-muted/30 border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-black uppercase text-xs tracking-tight">Crabe de palétuvier</h4>
                    <Badge variant={crabAndLobster.crabStatus === 'Plein' ? 'default' : (crabAndLobster.crabStatus === 'Mout' ? 'destructive' : 'secondary')} className="text-[9px] font-black h-5 uppercase">
                      {crabAndLobster.crabStatus}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">{crabAndLobster.crabMessage}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-xl bg-muted/30 border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-black uppercase text-xs tracking-tight">Langouste</h4>
                      <Badge variant={crabAndLobster.lobsterActivity === 'Élevée' ? 'default' : 'secondary'} className="text-[9px] font-black h-5 uppercase">
                      {crabAndLobster.lobsterActivity}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">{crabAndLobster.lobsterMessage}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6 w-full">
            {fishing.map((slot, index) => (
              <Card key={index} className="w-full border-2 shadow-sm">
                <CardHeader className="pb-3 bg-muted/10 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter">
                    <Clock className="h-5 w-5 text-primary" />
                    {slot.timeOfDay}
                  </CardTitle>
                  <div className="text-[10px] font-black uppercase text-muted-foreground flex flex-wrap items-center gap-3 pt-1">
                      <div className="flex items-center gap-1">
                        <Waves className="h-3.5 w-3.5" />
                        <span>{slot.tide} à {slot.tideTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {slot.tideMovement === 'étale' ? (
                          <Badge variant={slot.tide.includes('haute') ? 'default' : 'destructive'} className="capitalize text-[9px] font-black px-2 h-5">
                              {slot.tide.includes('haute') ? 'Pleine Mer' : 'Basse Mer'}
                          </Badge>
                        ) : (
                          <>
                            {getTideIcon(slot.tideMovement)}
                            <span className={cn("capitalize font-black", slot.tideMovement === 'montante' ? 'text-primary' : 'text-destructive')}>
                              {slot.tideMovement}
                            </span>
                          </>
                        )}
                      </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <h4 className="font-black uppercase text-[10px] tracking-widest text-primary flex items-center gap-2 mb-2">
                    <Fish className="size-4" /> Potentiel par espèce
                  </h4>
                  <Accordion type="single" collapsible className="w-full space-y-3">
                    {slot.fish.filter(f => f.rating >= 8).map((f, i) => (
                      <AccordionItem value={`item-${i}`} key={i} className="border-none">
                        <div className="border-2 rounded-xl overflow-hidden bg-card shadow-sm">
                          <AccordionTrigger className="p-4 hover:no-underline text-sm [&[data-state=open]]:bg-muted/50 [&[data-state=open]]:border-b border-dashed">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex flex-col items-start gap-1 text-left">
                                <span className="font-black uppercase tracking-tight">{f.name}</span>
                                {f.location && <Badge variant={f.location === 'Large' ? 'destructive' : 'secondary'} className="text-[9px] font-black h-4 px-1.5 uppercase">{f.location}</Badge>}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <RatingStars rating={f.rating} />
                                <span className="text-[10px] font-black text-muted-foreground opacity-60">{f.rating}/10</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-4 text-xs bg-muted/10 space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="flex flex-col gap-1">
                                <strong className="font-black text-card-foreground/90 uppercase text-[9px] tracking-widest">Activité:</strong>
                                <span className="leading-relaxed font-medium">{f.advice.activity}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <strong className="font-black text-card-foreground/90 uppercase text-[9px] tracking-widest">Spot idéal:</strong>
                                <span className="leading-relaxed font-medium">{f.advice.location_specific}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <strong className="font-black text-card-foreground/90 uppercase text-[9px] tracking-widest">Profondeur:</strong>
                                <span className="leading-relaxed font-black text-primary">{f.advice.depth}</span>
                              </div>
                            </div>
                          </AccordionContent>
                        </div>
                      </AccordionItem>
                    ))}
                    {slot.fish.filter(f => f.rating >= 8).length === 0 && (
                      <p className="text-center text-[10px] font-bold text-muted-foreground py-4 italic uppercase opacity-40 tracking-widest">Calme plat prévu</p>
                    )}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="w-full">
            <FishingLogCard data={data} />
          </div>
        </TabsContent>

        <TabsContent value="tracker" className="pt-2 px-1">
          <VesselTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
