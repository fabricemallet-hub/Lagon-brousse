'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  ArrowUp, 
  ArrowLeft, 
  ArrowRight, 
  Wind, 
  Settings2, 
  Info,
  Maximize2,
  AlertCircle
} from 'lucide-react';
import type { WindDirection } from '@/lib/types';
import { cn } from '@/lib/utils';

type MunitionData = {
  id: string;
  caliber: string;
  model: string;
  weight: number; // grains
  v0: number; // m/s
  bc: number; // G1 Ballistic Coefficient
  color: string;
};

const BALLISTIC_DATABASE: MunitionData[] = [
  { id: '308-win-150', caliber: '.308 Win', model: 'Winchester Power-Point', weight: 150, v0: 860, bc: 0.294, color: 'bg-blue-500' },
  { id: '308-win-180', caliber: '.308 Win', model: 'Nosler Partition', weight: 180, v0: 790, bc: 0.474, color: 'bg-blue-700' },
  { id: '30-06-180', caliber: '.30-06', model: 'Remington Core-Lokt', weight: 180, v0: 820, bc: 0.383, color: 'bg-green-600' },
  { id: '270-win-130', caliber: '.270 Win', model: 'Hornady SST', weight: 130, v0: 930, bc: 0.460, color: 'bg-orange-500' },
  { id: '7mm-08-140', caliber: '7mm-08', model: 'Nosler Ballistic Tip', weight: 140, v0: 850, bc: 0.485, color: 'bg-purple-500' },
];

const CALIBERS = Array.from(new Set(BALLISTIC_DATABASE.map(m => m.caliber)));

export function ShootingTableCard() {
  // States
  const [selectedCaliber, setSelectedCaliber] = useState(CALIBERS[0]);
  const [selectedMunitionId, setSelectedMunitionId] = useState(BALLISTIC_DATABASE.find(m => m.caliber === CALIBERS[0])?.id || '');
  const [distance, setDistance] = useState('200');
  const [zeroDistance, setZeroDistance] = useState('100');
  const [windSpeed, setWindSpeed] = useState('10');
  const [windDirection, setWindDirection] = useState<WindDirection>('E');

  // Filtered munitions based on caliber
  const availableMunitions = useMemo(() => 
    BALLISTIC_DATABASE.filter(m => m.caliber === selectedCaliber)
  , [selectedCaliber]);

  // Sync munition selection when caliber changes
  useEffect(() => {
    const stillValid = availableMunitions.find(m => m.id === selectedMunitionId);
    if (!stillValid && availableMunitions.length > 0) {
        setSelectedMunitionId(availableMunitions[0].id);
    }
  }, [selectedCaliber, availableMunitions, selectedMunitionId]);

  const selectedMunition = useMemo(() => 
    BALLISTIC_DATABASE.find(m => m.id === selectedMunitionId) || BALLISTIC_DATABASE[0]
  , [selectedMunitionId]);

  // Ballistics Logic: Simplified G1 Trajectory Simulation
  const results = useMemo(() => {
    const d = parseFloat(distance);
    const z = parseFloat(zeroDistance);
    const w = parseFloat(windSpeed);
    
    if (isNaN(d) || isNaN(z) || isNaN(w) || d <= 0 || z <= 0) return null;

    const g = 9.81;
    const { v0, bc } = selectedMunition;

    // Helper: calculate gravity drop in cm
    const calculateDropAt = (dist: number) => {
        // v_avg approximation based on BC
        const vAvg = v0 * (1 - (0.00008 * dist) / bc);
        const time = dist / vAvg;
        return 0.5 * g * Math.pow(time, 2) * 100; 
    };

    const dropAtTarget = calculateDropAt(d);
    const dropAtZero = calculateDropAt(z);

    // Line of sight geometric correction (standard scope height 4.5cm)
    const scopeHeight = 4.5; 
    const targetCorrection = dropAtTarget - (dropAtZero + scopeHeight) * (d / z) + scopeHeight;

    // Wind drift (Didion/Litz Formula)
    const vAvgTarget = v0 * (1 - (0.00008 * d) / bc);
    const timeTarget = d / vAvgTarget;
    const windMps = w * 0.514444; // Knots to m/s
    const isCrossWind = ['E', 'W'].includes(windDirection);
    
    let windDrift = 0;
    if (isCrossWind) {
        // Drift = crosswind * (time - distance / v0)
        windDrift = windMps * (timeTarget - d / v0) * 100;
    }

    // 1 click = 1cm at 100m (MRAD 0.1)
    // Clicks = total_cm / (dist / 100)
    const distFactor = d / 100;

    return {
        dropCm: parseFloat(targetCorrection.toFixed(1)),
        clicks: Math.round(targetCorrection / distFactor), 
        driftCm: Math.abs(parseFloat(windDrift.toFixed(1))),
        driftClicks: Math.round(Math.abs(windDrift) / distFactor),
        driftDir: windDirection === 'E' ? 'gauche' : 'droite'
    };
  }, [selectedMunition, distance, zeroDistance, windSpeed, windDirection]);

  return (
    <Card className="border-2 shadow-xl overflow-hidden rounded-2xl">
      <CardHeader className="bg-slate-900 text-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary rounded-xl shadow-lg">
                    <Target className="size-6 text-white" />
                </div>
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Table de Tir Tactique</CardTitle>
                    <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-0.5">Simulateur Balistique G1</CardDescription>
                </div>
            </div>
            <div className="flex gap-2">
                <Badge className={cn("font-black uppercase text-[10px] px-3 h-7 border-none shadow-md", selectedMunition.color)}>
                    {selectedMunition.caliber}
                </Badge>
                <Badge variant="outline" className="bg-white/5 border-white/20 text-white font-black text-[10px] px-3 h-7">
                    V0: {selectedMunition.v0} m/s
                </Badge>
            </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-8">
        {/* INPUTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* CONFIG MUNITION */}
            <div className="space-y-5 p-5 bg-muted/20 rounded-3xl border-2 border-dashed border-primary/10">
                <div className="flex items-center gap-2 text-primary">
                    <Settings2 className="size-4" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Configuration Arme</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Calibre</Label>
                        <Select value={selectedCaliber} onValueChange={setSelectedCaliber}>
                            <SelectTrigger className="h-11 border-2 font-black uppercase text-xs bg-white shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CALIBERS.map(c => <SelectItem key={c} value={c} className="font-black text-xs uppercase">{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Modèle / Munition</Label>
                        <Select value={selectedMunitionId} onValueChange={setSelectedMunitionId}>
                            <SelectTrigger className="h-11 border-2 font-bold text-xs bg-white shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMunitions.map(m => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                        {m.model} ({m.weight}gr)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Poids (Grains)</Label>
                        <div className="h-11 flex items-center justify-center bg-white border-2 rounded-lg font-black text-sm text-slate-700 shadow-sm">
                            {selectedMunition.weight} gr
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Distance Zéro (m)</Label>
                        <Input 
                            type="number" 
                            value={zeroDistance} 
                            onChange={e => setZeroDistance(e.target.value)}
                            className="h-11 border-2 font-black text-center text-lg bg-white shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* CONFIG ENVIRONNEMENT */}
            <div className="space-y-5 p-5 bg-muted/20 rounded-3xl border-2 border-dashed border-accent/10">
                <div className="flex items-center gap-2 text-accent">
                    <Wind className="size-4" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Cible & Environnement</h3>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1 text-accent">Distance de la cible (m)</Label>
                    <div className="relative">
                        <Input 
                            type="number" 
                            value={distance} 
                            onChange={e => setDistance(e.target.value)} 
                            className="h-16 border-2 border-accent/20 font-black text-3xl text-center text-accent bg-accent/5 rounded-2xl shadow-inner"
                        />
                        <Maximize2 className="absolute right-4 top-1/2 -translate-y-1/2 size-6 text-accent/20" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Vent (nœuds)</Label>
                        <Input 
                            type="number" 
                            value={windSpeed} 
                            onChange={e => setWindSpeed(e.target.value)} 
                            className="h-11 border-2 font-black text-center text-lg bg-white shadow-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Provenance</Label>
                        <Select value={windDirection} onValueChange={(v: any) => setWindDirection(v)}>
                            <SelectTrigger className="h-11 border-2 font-black text-[10px] uppercase bg-white shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="E" className="text-[10px] font-black uppercase">De Droite (9h)</SelectItem>
                                <SelectItem value="W" className="text-[10px] font-black uppercase">De Gauche (3h)</SelectItem>
                                <SelectItem value="N" className="text-[10px] font-black uppercase">De Face (12h)</SelectItem>
                                <SelectItem value="S" className="text-[10px] font-black uppercase">De Dos (6h)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>

        {/* RESULTS GRID */}
        {results ? (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-2 px-1 mb-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b border-dashed pb-2">
                    <Info className="size-3 text-primary" /> Correction de visée recommandée
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* DROP CARD */}
                    <div className="bg-white border-2 border-primary/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-primary/40 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ArrowUp className="size-20 text-primary" />
                        </div>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="p-4 bg-primary/10 rounded-2xl shadow-inner">
                                <ArrowUp className="size-10 text-primary animate-bounce" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">HAUSSE (ÉLÉVATION)</p>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-5xl font-black text-slate-800">+{results.dropCm}</span>
                                    <span className="text-sm font-black uppercase text-primary">cm</span>
                                </div>
                            </div>
                            <div className="w-full pt-4 border-t border-dashed">
                                <div className="flex items-center justify-center gap-2 bg-primary text-white font-black text-xs py-3.5 px-4 rounded-xl shadow-lg uppercase tracking-wider">
                                    Réglage : {results.clicks} clics HAUT
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* WIND CARD */}
                    <div className={cn(
                        "rounded-3xl p-6 shadow-xl relative overflow-hidden border-2 transition-all group",
                        results.driftCm !== 0 ? "bg-white border-accent/20 hover:border-accent/40" : "bg-muted/10 opacity-40 grayscale border-transparent"
                    )}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            {results.driftDir === 'gauche' ? <ArrowLeft className="size-20 text-accent" /> : <ArrowRight className="size-20 text-accent" />}
                        </div>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="p-4 bg-accent/10 rounded-2xl shadow-inner">
                                {results.driftDir === 'gauche' ? <ArrowLeft className="size-10 text-accent" /> : <ArrowRight className="size-10 text-accent" />}
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">DÉRIVE (VENT)</p>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-5xl font-black text-slate-800">{results.driftCm}</span>
                                    <span className="text-sm font-black uppercase text-accent">cm</span>
                                </div>
                            </div>
                            <div className="w-full pt-4 border-t border-dashed">
                                <div className={cn(
                                    "flex items-center justify-center gap-2 font-black text-xs py-3.5 px-4 rounded-xl shadow-lg uppercase tracking-wider",
                                    results.driftCm !== 0 ? "bg-accent text-white" : "bg-slate-200 text-slate-400"
                                )}>
                                    {results.driftCm !== 0 ? `${results.driftClicks} clics à ${results.driftDir.toUpperCase()}` : 'AUCUNE DÉRIVE'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Alert className="mt-6 bg-slate-900 text-white border-none rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <AlertCircle className="size-12 text-primary" />
                    </div>
                    <AlertTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 mb-2">
                        <AlertCircle className="size-4" /> Sécurité & Précision
                    </AlertTitle>
                    <AlertDescription className="text-[10px] leading-relaxed italic text-slate-300 font-medium max-w-md">
                        Les calculs sont des estimations basées sur le profil de traînée G1. 
                        <strong> Facteurs non simulés :</strong> Humidité, pression atmosphérique et angle de tir (cosinus).
                        Vérifiez toujours votre tir sur cible réelle avant de chasser.
                    </AlertDescription>
                </Alert>
            </div>
        ) : (
            <div className="py-20 text-center border-4 border-dashed rounded-[3rem] opacity-20 flex flex-col items-center justify-center gap-6">
                <Target className="size-16" />
                <div className="space-y-1">
                    <h3 className="font-black uppercase tracking-[0.2em] text-sm">Calculateur en attente</h3>
                    <p className="text-[10px] font-bold uppercase">Saisissez les paramètres de tir ci-dessus</p>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
