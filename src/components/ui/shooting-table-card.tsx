'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Target, ArrowUp, ArrowRight } from 'lucide-react';
import type { WindDirection } from '@/lib/types';

export function ShootingTableCard() {
  const [distance, setDistance] = useState('100');
  const [windSpeed, setWindSpeed] = useState('10');
  const [windDirection, setWindDirection] = useState<WindDirection>('E');
  const [adjustment, setAdjustment] = useState<{ vertical: number; horizontal: number; driftDirection: 'gauche' | 'droite' } | null>(null);

  const calculateAdjustment = () => {
    const dist = parseInt(distance, 10);
    const wind = parseInt(windSpeed, 10);

    if (isNaN(dist) || isNaN(wind) || dist < 0 || wind < 0) {
      setAdjustment(null);
      return;
    }

    // Simplified ballistic calculation
    // Vertical drop: assuming zero at 100m, drops quadratically. 1 click = 1cm at 100m.
    const vertical = dist > 100 ? Math.pow((dist - 100) / 100, 2) * 10 : 0; 

    // Horizontal drift: simple linear model, only for cross-winds
    const isCrossWind = ['E', 'W'].includes(windDirection);
    const horizontal = isCrossWind ? (wind / 10) * (dist / 100) * 5 : 0; // 5cm drift for 10 knots wind at 100m

    const driftDirection = windDirection === 'E' ? 'gauche' : 'droite';

    setAdjustment({
      vertical: parseFloat(vertical.toFixed(1)),
      horizontal: parseFloat(horizontal.toFixed(1)),
      driftDirection: driftDirection,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5 text-primary" />
          Table de Tir
        </CardTitle>
        <CardDescription>
          Estimez la compensation de visée. Ceci est une simulation et ne remplace pas un réglage réel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="distance">Distance (m)</Label>
            <Input id="distance" type="number" placeholder="100" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wind-speed">Vent (nœuds)</Label>
            <Input id="wind-speed" type="number" placeholder="10" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wind-direction">Direction vent</Label>
            <Select value={windDirection} onValueChange={(v: WindDirection) => setWindDirection(v)}>
                <SelectTrigger id="wind-direction">
                    <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="E">De Droite</SelectItem>
                    <SelectItem value="W">De Gauche</SelectItem>
                    <SelectItem value="N">De Face</SelectItem>
                    <SelectItem value="S">De Dos</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={calculateAdjustment} className="w-full">Calculer la Compensation</Button>
        
        {adjustment && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center space-y-2">
            <h4 className="font-semibold">Ajustement Recommandé</h4>
            <div className="flex flex-col sm:flex-row justify-around items-center text-lg gap-2">
                 <div className="flex items-center gap-2">
                    <ArrowUp className="size-5" />
                    <p>Hausse: <span className="font-bold">{adjustment.vertical} cm</span></p>
                </div>
                {adjustment.horizontal > 0 && (
                    <div className="flex items-center gap-2">
                        <ArrowRight className="size-5" />
                        <p>Dérive: <span className="font-bold">{adjustment.horizontal} cm à {adjustment.driftDirection}</span></p>
                    </div>
                )}
                 {adjustment.horizontal === 0 && adjustment.vertical === 0 && (
                    <p>Aucun ajustement nécessaire.</p>
                 )}
            </div>
             <p className="text-xs text-muted-foreground pt-2">Basé sur un zérotage à 100m. La dérive est calculée pour un vent de travers.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
