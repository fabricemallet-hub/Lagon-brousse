'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate } from '@/lib/data';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { Clock, Waves, TrendingUp, TrendingDown, Fish, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CrabIcon, LobsterIcon } from '@/components/icons';

export default function PechePage() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const { fishing, pelagicInfo, crabAndLobster } = getDataForDate(selectedLocation, selectedDate);
  const dateString = selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

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
          <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
        {halfStar && <Star key="half" className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Prévisions de Pêche à la Ligne</CardTitle>
          <CardDescription>
            Meilleurs moments et espèces à cibler pour la pêche à {selectedLocation} le {dateString}.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {pelagicInfo && pelagicInfo.inSeason && (
        <Alert>
          <Star className="h-4 w-4" />
          <AlertTitle>Saison des Pélagiques Ouverte !</AlertTitle>
          <AlertDescription>{pelagicInfo.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Crabes & Langoustes</CardTitle>
          <CardDescription>
            Prévisions basées sur le cycle lunaire pour le {dateString}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex items-start gap-4">
            <CrabIcon className="h-8 w-8 text-primary mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">Crabe de palétuvier</h4>
                <Badge variant={crabAndLobster.crabStatus === 'Plein' ? 'default' : crabAndLobster.crabStatus === 'Mout' ? 'destructive' : 'secondary'}>
                  {crabAndLobster.crabStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{crabAndLobster.crabMessage}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <LobsterIcon className="h-8 w-8 text-primary mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">Langouste</h4>
                  <Badge variant={crabAndLobster.lobsterActivity === 'Élevée' ? 'default' : 'secondary'}>
                  {crabAndLobster.lobsterActivity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{crabAndLobster.lobsterMessage}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
        {fishing.map((slot, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5" />
                {slot.timeOfDay}
              </CardTitle>
              <div className="text-sm text-muted-foreground flex items-center gap-4 pt-1">
                  <div className="flex items-center gap-1">
                    <Waves className="h-4 w-4" />
                    <span>{slot.tide} à {slot.tideTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getTideIcon(slot.tideMovement)}
                    <span className="capitalize">{slot.tideMovement}</span>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Fish className="h-5 w-5 text-primary" />
                Potentiel par espèce
              </h4>
              <div className="space-y-3">
                {slot.fish.map((f, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      {f.location && <Badge variant={f.location === 'Large' ? 'destructive' : 'secondary'} className="text-xs font-semibold">{f.location}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        <RatingStars rating={f.rating} />
                        <Badge variant="outline" className="w-12 justify-center">{f.rating}/10</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
