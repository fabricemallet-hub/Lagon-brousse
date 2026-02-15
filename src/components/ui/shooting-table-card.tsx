'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Target, 
  ArrowUp, 
  ArrowLeft, 
  ArrowRight, 
  Wind, 
  Settings2, 
  Info,
  Maximize2,
  AlertCircle,
  Zap,
  Crosshair
} from 'lucide-react';
import type { WindDirection } from '@/lib/types';
import { cn } from '@/lib/utils';

type MunitionData = {
  id: string;
  caliber: string;
  model: string;
  weight: number; // grains or grams
  v0: number; // m/s
  bc: number; // G1 Ballistic Coefficient
  usage: string;
  color: string;
};

const BALLISTIC_DATABASE: MunitionData[] = [
  // .243 Winchester
  { id: '243-win-100-pp', caliber: '.243 Win', model: 'Winchester Power-Point', weight: 100, v0: 900, bc: 0.356, usage: 'Approche biche et petit cerf, recul faible.', color: 'bg-yellow-600' },
  { id: '243-win-95-sst', caliber: '.243 Win', model: 'Hornady SST', weight: 95, v0: 970, bc: 0.355, usage: 'Expansion rapide, tir tendu.', color: 'bg-yellow-600' },

  // .25-06 Remington
  { id: '25-06-100-cl', caliber: '.25-06 Rem', model: 'Remington Core-Lokt', weight: 100, v0: 980, bc: 0.323, usage: 'Polyvalent, biche et approche.', color: 'bg-cyan-500' },
  { id: '25-06-115-bt', caliber: '.25-06 Rem', model: 'Nosler Ballistic Tip', weight: 115, v0: 910, bc: 0.453, usage: 'Précision laser longue distance.', color: 'bg-cyan-500' },
  { id: '25-06-120-fus', caliber: '.25-06 Rem', model: 'Federal Fusion', weight: 120, v0: 910, bc: 0.468, usage: 'Balle soudée, excellente rétention.', color: 'bg-cyan-500' },

  // 6.5 Creedmoor
  { id: '65-cm-143-eldx', caliber: '6.5 Creedmoor', model: 'Hornady ELD-X', weight: 143, v0: 820, bc: 0.625, usage: 'Précision extrême à longue distance.', color: 'bg-teal-600' },

  // .270 Winchester
  { id: '270-win-130-sst', caliber: '.270 Win', model: 'Hornady SST', weight: 130, v0: 930, bc: 0.460, usage: 'Expansion rapide pour la savane.', color: 'bg-orange-500' },
  { id: '270-win-130-ds', caliber: '.270 Win', model: 'Winchester Deer Season', weight: 130, v0: 930, bc: 0.392, usage: 'Choc immédiat sur cervidés.', color: 'bg-orange-500' },
  { id: '270-win-130-tc', caliber: '.270 Win', model: 'Federal Trophy Copper', weight: 130, v0: 930, bc: 0.459, usage: 'Sans plomb, pénétration maximale.', color: 'bg-orange-500' },
  { id: '270-win-150-ab', caliber: '.270 Win', model: 'Nosler AccuBond', weight: 150, v0: 870, bc: 0.500, usage: 'Pénétration profonde, gros cerf.', color: 'bg-orange-500' },
  { id: '270-win-150-np', caliber: '.270 Win', model: 'Nosler Partition', weight: 150, v0: 870, bc: 0.465, usage: 'Référence pour gros gibier.', color: 'bg-orange-500' },
  
  // .308 Winchester
  { id: '308-win-150-pp', caliber: '.308 Win', model: 'Winchester Power-Point', weight: 150, v0: 860, bc: 0.294, usage: 'Standard polyvalent, brousse.', color: 'bg-blue-500' },
  { id: '308-win-150-sst', caliber: '.308 Win', model: 'Hornady SST', weight: 150, v0: 860, bc: 0.415, usage: 'Vitesse et expansion rapide.', color: 'bg-blue-500' },
  { id: '308-win-165-gk', caliber: '.308 Win', model: 'Sierra GameKing', weight: 165, v0: 820, bc: 0.446, usage: 'Précision exceptionnelle.', color: 'bg-blue-500' },
  { id: '308-win-180-np', caliber: '.308 Win', model: 'Nosler Partition', weight: 180, v0: 790, bc: 0.474, usage: 'Puissance d\'arrêt, gros spécimens.', color: 'bg-blue-500' },
  { id: '308-win-180-shh', caliber: '.308 Win', model: 'Sako Hammerhead', weight: 180, v0: 820, bc: 0.410, usage: 'Balle lourde, cerf et cochon.', color: 'bg-blue-500' },

  // .30-06 Springfield
  { id: '30-06-150-sst', caliber: '.30-06', model: 'Hornady SST', weight: 150, v0: 910, bc: 0.415, usage: 'Vitesse élevée pour tir tendu.', color: 'bg-green-600' },
  { id: '30-06-180-cl', caliber: '.30-06', model: 'Remington Core-Lokt', weight: 180, v0: 820, bc: 0.383, usage: 'La référence brousse depuis 1939.', color: 'bg-green-600' },
  { id: '30-06-180-oryx', caliber: '.30-06', model: 'Norma Oryx', weight: 180, v0: 820, bc: 0.354, usage: 'Balle soudée, pénétration maximale.', color: 'bg-green-600' },
  { id: '30-06-178-ph', caliber: '.30-06', model: 'Hornady Precision Hunter', weight: 178, v0: 840, bc: 0.552, usage: 'Trajectoire tendue, tir lointain.', color: 'bg-green-600' },
  { id: '30-06-200-np', caliber: '.30-06', model: 'Nosler Partition', weight: 200, v0: 780, bc: 0.481, usage: 'Stop tout ce qui bouge.', color: 'bg-green-600' },

  // 7mm-08 Remington
  { id: '7mm08-140-eldx', caliber: '7mm-08 Rem', model: 'Hornady ELD-X', weight: 143, v0: 850, bc: 0.623, usage: 'Précision chirurgicale longue distance.', color: 'bg-indigo-600' },
  { id: '7mm08-140-ttsx', caliber: '7mm-08 Rem', model: 'Barnes TTSX', weight: 140, v0: 850, bc: 0.412, usage: 'Monolithique, pas de plomb.', color: 'bg-indigo-600' },
  { id: '7mm08-140-fus', caliber: '7mm-08 Rem', model: 'Federal Fusion', weight: 140, v0: 850, bc: 0.410, usage: 'Efficacité prouvée sur cerf.', color: 'bg-indigo-600' },

  // --- CATEGORIES MAGNUM ---
  // 7mm Rem Mag
  { id: '7mm-rm-162-eldx', caliber: '7mm Rem Mag', model: 'Hornady ELD-X', weight: 162, v0: 896, bc: 0.631, usage: 'Magnum polyvalent, tir longue distance.', color: 'bg-rose-700' },
  { id: '7mm-rm-150-tc', caliber: '7mm Rem Mag', model: 'Federal Trophy Copper', weight: 150, v0: 930, bc: 0.450, usage: 'Vitesse et pénétration sans plomb.', color: 'bg-rose-700' },

  // .300 Win Mag
  { id: '300-wm-180-pp', caliber: '.300 Win Mag', model: 'Winchester Power-Point', weight: 180, v0: 900, bc: 0.382, usage: 'Puissance d\'arrêt massive.', color: 'bg-red-800' },
  { id: '300-wm-200-eldx', caliber: '.300 Win Mag', model: 'Hornady ELD-X', weight: 200, v0: 870, bc: 0.626, usage: 'Le roi de la savane à longue distance.', color: 'bg-red-800' },
  { id: '300-wm-180-np', caliber: '.300 Win Mag', model: 'Nosler Partition', weight: 180, v0: 900, bc: 0.474, usage: 'Référence mondiale pour gros gibier.', color: 'bg-red-800' },

  // .338 Win Mag
  { id: '338-wm-210-np', caliber: '.338 Win Mag', model: 'Nosler Partition', weight: 210, v0: 860, bc: 0.400, usage: 'Pour les spécimens les plus massifs.', color: 'bg-stone-800' },

  // Calibre 12
  { id: '12-brenneke', caliber: 'Calibre 12', model: 'Balle Brenneke', weight: 28, v0: 430, bc: 0.075, usage: 'Référence pour le gros cochon.', color: 'bg-red-600' },
  { id: '12-sauvestre', caliber: 'Calibre 12', model: 'Balle Sauvestre', weight: 26, v0: 480, bc: 0.120, usage: 'Flèche haute vitesse, tir précis.', color: 'bg-red-600' },
  { id: '12-buck-9', caliber: 'Calibre 12', model: 'Chevrotine 9 grains', weight: 31, v0: 400, bc: 0.050, usage: 'Battue en fourré dense.', color: 'bg-red-600' },
  { id: '12-lead-4', caliber: 'Calibre 12', model: 'Plomb n°4', weight: 35, v0: 390, bc: 0.030, usage: 'Notou et Pigeon vert.', color: 'bg-red-600' },

  // Calibre 16
  { id: '16-brenneke', caliber: 'Calibre 16', model: 'Balle Brenneke', weight: 21, v0: 415, bc: 0.060, usage: 'Ancien standard, recul modéré.', color: 'bg-orange-800' },
  { id: '16-lead-4', caliber: 'Calibre 16', model: 'Plomb n°4', weight: 28, v0: 380, bc: 0.025, usage: 'Plume en forêt.', color: 'bg-orange-800' },

  // Calibre 20
  { id: '20-brenneke', caliber: 'Calibre 20', model: 'Balle Brenneke', weight: 18, v0: 425, bc: 0.055, usage: 'Idéal pour fusils légers, très précis.', color: 'bg-yellow-800' },
  { id: '20-lead-4', caliber: 'Calibre 20', model: 'Plomb n°4', weight: 24, v0: 390, bc: 0.025, usage: 'Plume et petit gibier.', color: 'bg-yellow-800' },

  // 22mm
  { id: '22mm-lr-40', caliber: '22mm', model: '.22 LR Standard', weight: 40, v0: 330, bc: 0.125, usage: 'Petits nuisibles et tir de loisir.', color: 'bg-zinc-500' },
  { id: '22mm-wmr-40', caliber: '22mm', model: '.22 WMR (Magnum)', weight: 40, v0: 580, bc: 0.110, usage: 'Portée accrue pour petits nuisibles.', color: 'bg-zinc-500' },
];

const CALIBERS = Array.from(new Set(BALLISTIC_DATABASE.map(m => m.caliber)));

export function ShootingTableCard() {
  const [selectedCaliber, setSelectedCaliber] = useState(CALIBERS[0]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedWeight, setSelectedWeight] = useState<number>(0);
  const [zeroDistance, setZeroDistance] = useState('100');

  // Filtrer les munitions par calibre
  const munitionsForCaliber = useMemo(() => 
    BALLISTIC_DATABASE.filter(m => m.caliber === selectedCaliber)
  , [selectedCaliber]);

  // Modèles uniques pour ce calibre
  const availableModels = useMemo(() => 
    Array.from(new Set(munitionsForCaliber.map(m => m.model)))
  , [munitionsForCaliber]);

  // Mise à jour automatique du modèle lors du changement de calibre
  useEffect(() => {
    if (availableModels.length > 0) {
      setSelectedModel(availableModels[0]);
    }
  }, [availableModels]);

  // Poids disponibles pour ce modèle
  const availableWeights = useMemo(() => 
    munitionsForCaliber.filter(m => m.model === selectedModel).map(m => m.weight)
  , [munitionsForCaliber, selectedModel]);

  // Mise à jour automatique du poids lors du changement de modèle
  useEffect(() => {
    if (availableWeights.length > 0) {
      setSelectedWeight(availableWeights[0]);
    }
  }, [availableWeights]);

  // Munition finale sélectionnée
  const selectedMunition = useMemo(() => {
    const found = munitionsForCaliber.find(m => m.model === selectedModel && m.weight === selectedWeight);
    return found || munitionsForCaliber[0] || BALLISTIC_DATABASE[0];
  }, [munitionsForCaliber, selectedModel, selectedWeight]);

  const calculateBallistics = (dist: number) => {
    const z = parseFloat(zeroDistance) || 100;
    const windKmh = 15;
    const g = 9.81;
    const { v0, bc } = selectedMunition;

    const calculateDropAt = (d: number) => {
        const vAvg = v0 * (1 - (0.00008 * d) / bc);
        const time = d / vAvg;
        return 0.5 * g * Math.pow(time, 2) * 100; 
    };

    const dropAtTarget = calculateDropAt(dist);
    const dropAtZero = calculateDropAt(z);
    const scopeHeight = 4.5;
    const correctionCm = dropAtTarget - (dropAtZero + scopeHeight) * (dist / z) + scopeHeight;

    const vAvgTarget = v0 * (1 - (0.00008 * dist) / bc);
    const timeTarget = dist / vAvgTarget;
    const windMps = windKmh / 3.6;
    const windDriftCm = windMps * (timeTarget - dist / v0) * 100;

    const distFactor = dist / 100;

    return {
        dist,
        dropCm: parseFloat(correctionCm.toFixed(1)),
        clicks: Math.round(correctionCm / distFactor),
        driftCm: Math.abs(parseFloat(windDriftCm.toFixed(1))),
        driftClicks: Math.round(Math.abs(windDriftCm) / distFactor)
    };
  };

  const resultsTable = useMemo(() => {
    if (selectedMunition.caliber.startsWith('Calibre')) {
        return [calculateBallistics(50), calculateBallistics(75), calculateBallistics(100)];
    }
    if (selectedMunition.caliber === '22mm') {
        return [calculateBallistics(25), calculateBallistics(50), calculateBallistics(100)];
    }
    const distances = [100, 200, 300];
    return distances.map(d => calculateBallistics(d));
  }, [selectedMunition, zeroDistance, calculateBallistics]);

  const weightUnit = selectedMunition.caliber.startsWith('Calibre') ? 'g' : 'gr';

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
                    <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-0.5">Calculateur Balistique G1</CardDescription>
                </div>
            </div>
            <Badge className={cn("font-black uppercase text-[10px] px-3 h-7 border-none shadow-md", selectedMunition.color)}>
                {selectedMunition.caliber}
            </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-muted/20 rounded-3xl border-2 border-dashed border-primary/10">
            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Calibre</Label>
                <Select value={selectedCaliber} onValueChange={setSelectedCaliber}>
                    <SelectTrigger className="h-10 border-2 font-black uppercase text-xs bg-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CALIBERS.map(c => <SelectItem key={c} value={c} className="font-black text-xs uppercase">{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Modèle d'ogive</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-10 border-2 font-bold text-xs bg-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {availableModels.map(m => (
                            <SelectItem key={m} value={m} className="text-xs">
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Poids ({weightUnit})</Label>
                <Select value={selectedWeight.toString()} onValueChange={(v) => setSelectedWeight(parseFloat(v))}>
                    <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {availableWeights.map(w => (
                            <SelectItem key={w} value={w.toString()} className="font-black text-xs">
                                {w} {weightUnit}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Distance de Zéro (m)</Label>
                <Input 
                    type="number" 
                    value={zeroDistance} 
                    onChange={e => setZeroDistance(e.target.value)}
                    className="h-10 border-2 font-black text-center text-sm bg-white"
                />
            </div>

            <div className="md:col-span-4 pt-2 border-t border-dashed border-primary/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                            <Zap className="size-3" /> Usage recommandé
                        </p>
                        <p className="text-xs font-medium text-slate-600 italic">"{selectedMunition.usage}"</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-center">
                            <p className="text-[8px] font-black uppercase opacity-40">Poids</p>
                            <p className="font-black text-xs">{selectedMunition.weight} {weightUnit}</p>
                        </div>
                        <div className="text-center border-l pl-4">
                            <p className="text-[8px] font-black uppercase opacity-40">Coef (BC)</p>
                            <p className="font-black text-xs text-primary">{selectedMunition.bc}</p>
                        </div>
                        <div className="text-center border-l pl-4">
                            <p className="text-[8px] font-black uppercase opacity-40">V0</p>
                            <p className="font-black text-xs">{selectedMunition.v0} m/s</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Crosshair className="size-3 text-primary" /> Corrections (Vent 15 km/h)
                </h3>
                <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-blue-200 text-blue-600">
                    1 clic = 1cm à 100m
                </Badge>
            </div>

            <div className="border-2 rounded-2xl overflow-hidden bg-white shadow-md">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="hover:bg-transparent border-b-2">
                            <BlockHead label="Distance" />
                            <BlockHead label="Hausse (cm)" className="text-primary" />
                            <BlockHead label="Réglage (clics)" className="text-primary" />
                            <BlockHead label="Dérive (clics)" className="text-accent" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {resultsTable.map((res, idx) => (
                            <TableRow key={idx} className="hover:bg-primary/5 transition-colors h-14">
                                <TableCell className="font-black text-center text-sm">{res.dist}m</TableCell>
                                <TableCell className="font-bold text-center text-slate-600">{res.dropCm > 0 ? '+' : ''}{res.dropCm} cm</TableCell>
                                <TableCell className="text-center">
                                    <div className="inline-flex items-center gap-2 bg-primary text-white font-black text-xs px-3 py-1.5 rounded-lg shadow-sm">
                                        <ArrowUp className="size-3" /> {res.clicks}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className={cn(
                                        "inline-flex items-center gap-2 font-black text-xs px-3 py-1.5 rounded-lg shadow-sm",
                                        res.driftClicks > 0 ? "bg-accent text-white" : "bg-slate-100 text-slate-400"
                                    )}>
                                        <ArrowLeft className="size-3" /> {res.driftClicks}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>

        <Alert className="bg-slate-900 text-white border-none rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertCircle className="size-10 text-primary" />
            </div>
            <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-1">
                Avis de Sécurité
            </AlertTitle>
            <AlertDescription className="text-[9px] leading-relaxed italic text-slate-300 font-medium">
                Simulation théorique G1. Ne prend pas en compte l'inclinaison (cosinus) ni l'humidité. Vérifiez toujours votre réglage sur cible avant de chasser.
            </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function BlockHead({ label, className }: { label: string, className?: string }) {
    return (
        <TableHead className={cn("font-black uppercase text-[9px] text-center", className)}>
            {label}
        </TableHead>
    );
}
