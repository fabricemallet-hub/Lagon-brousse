'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getTodaysData } from '@/lib/data';
import { useLocation } from '@/context/location-context';
import { Clock, Waves, TrendingUp, TrendingDown, Fish, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PechePage() {
  const { selectedLocation } = useLocation();
  const { fishing } = getTodaysData(selectedLocation);

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
            Meilleurs moments et espèces à cibler pour la pêche à la ligne à {selectedLocation}.
          </CardDescription>
        </CardHeader>
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
                    <span className="font-medium">{f.name}</span>
                    <div className="flex items-center gap-2">
                        <RatingStars rating={f.rating} />
                        <Badge variant="outline" className="w-10 justify-center">{f.rating}/10</Badge>
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
