'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Crosshair,
  Pencil,
  ArrowDown
} from 'lucide-react';
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
  // .222 Remington
  { id: '222-rem-50-vmax', caliber: '.222 Rem', model: 'Hornady V-MAX', weight: 50, v0: 950, bc: 0.242, usage: 'Précision redoutable sur petits nuisibles et biche à l\'approche.', color: 'bg-emerald-500' },
  { id: '222-rem-55-vmax', caliber: '.222 Rem', model: 'Hornady V-MAX', weight: 55, v0: 920, bc: 0.255, usage: 'Plus de stabilité au vent pour l\'approche.', color: 'bg-emerald-500' },
  { id: '222-rem-50-pp', caliber: '.222 Rem', model: 'Winchester Power-Point', weight: 50, v0: 950, bc: 0.176, usage: 'Standard polyvalent pour petit gibier.', color: 'bg-emerald-500' },

  // .243 Winchester
  { id: '243-win-80-fed', caliber: '.243 Win', model: 'Federal Soft Point', weight: 80, v0: 1000, bc: 0.288, usage: 'Vitesse très élevée, idéal nuisibles.', color: 'bg-yellow-600' },
  { id: '243-win-100-pp', caliber: '.243 Win', model: 'Winchester Power-Point', weight: 100, v0: 900, bc: 0.356, usage: 'Approche biche et petit cerf, recul faible.', color: 'bg-yellow-600' },
  { id: '243-win-95-sst', caliber: '.243 Win', model: 'Hornady SST', weight: 95, v0: 970, bc: 0.355, usage: 'Expansion rapide, tir tendu.', color: 'bg-yellow-600' },

  // .25-06 Remington
  { id: '25-06-100-cl', caliber: '.25-06 Rem', model: 'Remington Core-Lokt', weight: 100, v0: 980, bc: 0.323, usage: 'Un laser pour la biche en savane.', color: 'bg-cyan-500' },
  { id: '25-06-115-bt', caliber: '.25-06 Rem', model: 'Nosler Ballistic Tip', weight: 115, v0: 910, bc: 0.453, usage: 'Précision laser longue distance.', color: 'bg-cyan-500' },
  { id: '25-06-120-fus', caliber: '.25-06 Rem', model: 'Federal Fusion', weight: 120, v0: 910, bc: 0.468, usage: 'Balle soudée, excellente rétention.', color: 'bg-cyan-500' },

  // 6.5 Creedmoor
  { id: '65-cm-143-eldx', caliber: '6.5 Creedmoor', model: 'Hornady ELD-X', weight: 143, v0: 820, bc: 0.625, usage: 'Précision extrême à longue distance.', color: 'bg-teal-600' },

  // .270 Winchester
  { id: '270-win-130-sst', caliber: '.270 Win', model: 'Hornady SST', weight: 130, v0: 930, bc: 0.460, usage: 'Expansion rapide pour la savane.', color: 'bg-orange-500' },
  { id: '270-win-140-sst', caliber: '.270 Win', model: 'Hornady SST', weight: 140, v0: 900, bc: 0.485, usage: 'Bon compromis vitesse/énergie.', color: 'bg-orange-500' },
  { id: '270-win-130-ds', caliber: '.270 Win', model: 'Winchester Deer Season', weight: 130, v0: 930, bc: 0.392, usage: 'Choc immédiat sur cervidés.', color: 'bg-orange-500' },
  { id: '270-win-150-ab', caliber: '.270 Win', model: 'Nosler AccuBond', weight: 150, v0: 870, bc: 0.500, usage: 'Pénétration profonde, gros cerf.', color: 'bg-orange-500' },
  
  // .270 WSM
  { id: '270-wsm-130-bst', caliber: '.270 WSM', model: 'Winchester Ballistic Silvertip', weight: 130, v0: 990, bc: 0.433, usage: 'Magnum ultra-rapide, trajectoire extrêmement tendue.', color: 'bg-orange-700' },
  { id: '270-wsm-150-fus', caliber: '.270 WSM', model: 'Federal Fusion', weight: 150, v0: 940, bc: 0.470, usage: 'Puissance Magnum pour gros cervidés.', color: 'bg-orange-700' },

  // .308 Winchester
  { id: '308-win-150-pp', caliber: '.308 Win', model: 'Winchester Power-Point', weight: 150, v0: 860, bc: 0.294, usage: 'Standard polyvalent, brousse.', color: 'bg-blue-500' },
  { id: '308-win-180-pp', caliber: '.308 Win', model: 'Winchester Power-Point', weight: 180, v0: 800, bc: 0.382, usage: 'Poids lourd pour stopper net.', color: 'bg-blue-500' },
  { id: '308-win-150-sst', caliber: '.308 Win', model: 'Hornady SST', weight: 150, v0: 860, bc: 0.415, usage: 'Vitesse et expansion rapide.', color: 'bg-blue-500' },
  { id: '308-win-180-np', caliber: '.308 Win', model: 'Nosler Partition', weight: 180, v0: 790, bc: 0.474, usage: 'Puissance d\'arrêt, gros spécimens.', color: 'bg-blue-500' },

  // .30-06 Springfield
  { id: '30-06-150-cl', caliber: '.30-06', model: 'Remington Core-Lokt', weight: 150, v0: 880, bc: 0.314, usage: 'Vitesse accrue pour tir de savane.', color: 'bg-green-600' },
  { id: '30-06-180-cl', caliber: '.30-06', model: 'Remington Core-Lokt', weight: 180, v0: 820, bc: 0.383, usage: 'La référence brousse depuis 1939.', color: 'bg-green-600' },
  { id: '30-06-180-oryx', caliber: '.30-06', model: 'Norma Oryx', weight: 180, v0: 820, bc: 0.354, usage: 'Balle soudée, pénétration maximale.', color: 'bg-green-600' },

  // 7mm-08 Remington
  { id: '7mm08-140-eldx', caliber: '7mm-08 Rem', model: 'Hornady ELD-X', weight: 140, v0: 850, bc: 0.623, usage: 'Précision chirurgicale longue distance.', color: 'bg-indigo-600' },

  // 7mm Rem Mag
  { id: '7mm-rm-162-eldx', caliber: '7mm Rem Mag', model: 'Hornady ELD-X', weight: 162, v0: 896, bc: 0.631, usage: 'Magnum polyvalent, tir longue distance.', color: 'bg-rose-700' },

  // .300 Win Mag
  { id: '300-wm-180-pp', caliber: '.300 Win Mag', model: 'Winchester Power-Point', weight: 180, v0: 900, bc: 0.382, usage: 'Puissance d\'arrêt massive.', color: 'bg-red-800' },

  // Calibres Lisses
  { id: '12-b-28', caliber: 'Calibre 12', model: 'Balle Brenneke', weight: 28, v0: 430, bc: 0.075, usage: 'Référence pour le gros cochon en battue.', color: 'bg-red-600' },
  { id: '12-b-31', caliber: 'Calibre 12', model: 'Balle Brenneke', weight: 31, v0: 415, bc: 0.080, usage: 'Plus lourde pour traverser les fourrés.', color: 'bg-red-600' },
  { id: '12-b-39', caliber: 'Calibre 12', model: 'Balle Brenneke (Magnum)', weight: 39, v0: 440, bc: 0.090, usage: 'Puissance d\'arrêt maximale en Magnum.', color: 'bg-red-600' },
  { id: '16-b-21', caliber: 'Calibre 16', model: 'Balle Brenneke', weight: 21, v0: 415, bc: 0.060, usage: 'Ancien standard, recul modéré.', color: 'bg-orange-800' },
  { id: '20-b-18', caliber: 'Calibre 20', model: 'Balle Brenneke', weight: 18, v0: 425, bc: 0.055, usage: 'Idéal pour fusils légers, très précis.', color: 'bg-yellow-800' },
  { id: '410-b-7', caliber: 'Calibre .410', model: 'Balle Brenneke', weight: 7, v0: 530, bc: 0.065, usage: 'Petit calibre pour le cochon à courte distance.', color: 'bg-slate-700' },

  // 22mm
  { id: '22mm-lr-40', caliber: '22mm', model: '.22 LR Standard', weight: 40, v0: 330, bc: 0.125, usage: 'Petits nuisibles et tir de loisir.', color: 'bg-zinc-500' },
  { id: '22mm-wmr-40', caliber: '22mm', model: '.22 WMR (Magnum)', weight: 40, v0: 570, bc: 0.145, usage: 'Vitesse élevée pour renard et nuisibles.', color: 'bg-zinc-500' },
];

const CALIBERS = Array.from(new Set(BALLISTIC_DATABASE.map(m => m.caliber)));

const WIND_DIRECTIONS = [
    { label: 'De Face (12h)', angle: 0 },
    { label: '3/4 Avant Droite (1h30)', angle: 45 },
    { label: 'Plein Travers Droite (3h)', angle: 90 },
    { label: '3/4 Arrière Droite (4h30)', angle: 135 },
    { label: 'Arrière (6h)', angle: 180 },
    { label: '3/4 Arrière Gauche (7h30)', angle: 225 },
    { label: 'Plein Travers Gauche (9h)', angle: 270 },
    { label: '3/4 Avant Gauche (10h30)', angle: 315 },
];

export function ShootingTableCard() {
  const [selectedCaliber, setSelectedCaliber] = useState(CALIBERS[0]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedWeight, setSelectedWeight] = useState<number>(0);
  const [zeroDistance, setZeroDistance] = useState('100');
  
  // Paramètres environnementaux
  const [windKmh, setWindKmh] = useState('10');
  const [windAngle, setWindAngle] = useState('90'); // 90° = Travers droit

  // Manual input states
  const [manualWeight, setManualWeight] = useState('150');
  const [manualV0, setManualV0] = useState('860');
  const [manualBC, setManualBC] = useState('0.400');

  const munitionsForCaliber = useMemo(() => 
    BALLISTIC_DATABASE.filter(m => m.caliber === selectedCaliber)
  , [selectedCaliber]);

  const availableModels = useMemo(() => {
    const models = Array.from(new Set(munitionsForCaliber.map(m => m.model)));
    return [...models, "PERSONNALISÉ"];
  }, [munitionsForCaliber]);

  useEffect(() => {
    if (availableModels.length > 0) {
      if (!availableModels.includes(selectedModel)) {
        setSelectedModel(availableModels[0]);
      }
    }
  }, [availableModels, selectedModel]);

  const availableWeights = useMemo(() => 
    Array.from(new Set(munitionsForCaliber
      .filter(m => m.model === selectedModel)
      .map(m => m.weight)))
      .sort((a, b) => a - b)
  , [munitionsForCaliber, selectedModel]);

  useEffect(() => {
    if (availableWeights.length > 0) {
      if (!availableWeights.includes(selectedWeight)) {
        setSelectedWeight(availableWeights[0]);
      }
    }
  }, [availableWeights, selectedWeight]);

  const isCustomMode = selectedModel === "PERSONNALISÉ";

  const selectedMunition = useMemo(() => {
    if (isCustomMode) {
        return {
            caliber: selectedCaliber,
            model: "Personnalisé",
            weight: parseFloat(manualWeight) || 0,
            v0: parseFloat(manualV0) || 0,
            bc: parseFloat(manualBC) || 0,
            usage: "Paramètres personnalisés définis par l'utilisateur.",
            color: "bg-slate-700"
        } as MunitionData;
    }
    const found = munitionsForCaliber.find(m => m.model === selectedModel && m.weight === selectedWeight);
    return found || munitionsForCaliber[0] || BALLISTIC_DATABASE[0];
  }, [munitionsForCaliber, selectedModel, selectedWeight, isCustomMode, manualWeight, manualV0, manualBC, selectedCaliber]);

  const calculateBallistics = useCallback((dist: number) => {
    const z = parseFloat(zeroDistance) || 100;
    const wSpeed = parseFloat(windKmh) || 0;
    const wAng = parseFloat(windAngle) || 0;
    const g = 9.81;
    const { v0, bc } = selectedMunition;

    if (v0 <= 0 || bc <= 0) return { dist, dropCm: 0, clicks: 0, driftCm: 0, driftClicks: 0, elevationDir: 'UP', driftDir: 'RIGHT' };

    // Approximation de chute (simple simulation parabolique avec traînée G1 simplifiée)
    const calculateDropAt = (d: number) => {
        const vAvg = v0 * (1 - (0.00008 * d) / bc);
        const time = d / vAvg;
        return 0.5 * g * Math.pow(time, 2) * 100; 
    };

    const dropAtTarget = calculateDropAt(dist);
    const dropAtZero = calculateDropAt(z);
    const scopeHeight = 4.5;
    
    // Correction par rapport au zérotage
    const correctionCm = dropAtTarget - (dropAtZero + scopeHeight) * (dist / z) + scopeHeight;

    // Calcul de dérive au vent
    const vAvgTarget = v0 * (1 - (0.00008 * dist) / bc);
    const timeTarget = dist / vAvgTarget;
    
    // Composante latérale du vent (Full crosswind à 90°)
    const angleRad = (wAng * Math.PI) / 180;
    const crosswindMps = (wSpeed / 3.6) * Math.sin(angleRad);
    
    // Formule simplifiée de dérive au vent : Drift = W * (T - D/V0)
    const windDriftCm = crosswindMps * (timeTarget - dist / v0) * 100;

    const distFactor = dist / 100;

    return {
        dist,
        dropCm: parseFloat(Math.abs(correctionCm).toFixed(1)),
        // Si correctionCm > 0, la balle est en dessous de la ligne de visée -> on monte la lunette
        clicks: Math.abs(Math.round(correctionCm / distFactor)),
        elevationDir: correctionCm > 0 ? 'HAUT' : 'BAS',
        driftCm: parseFloat(Math.abs(windDriftCm).toFixed(1)),
        // Si windDriftCm > 0 (vent de droite), la balle part à gauche -> on clique à droite
        driftClicks: Math.abs(Math.round(windDriftCm / distFactor)),
        driftDir: windDriftCm > 0 ? 'DROITE' : 'GAUCHE'
    };
  }, [selectedMunition, zeroDistance, windKmh, windAngle]);

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

  const weightUnit = (selectedMunition.caliber.startsWith('Calibre') && selectedMunition.caliber !== 'Calibre .410') ? 'g' : 'gr';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5 bg-muted/20 rounded-3xl border-2 border-dashed border-primary/10">
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
                            <SelectItem key={m} value={m} className={cn("text-xs", m === "PERSONNALISÉ" && "text-primary font-black")}>
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Poids ({weightUnit})</Label>
                {isCustomMode ? (
                    <div className="relative">
                        <Input 
                            type="number" 
                            value={manualWeight} 
                            onChange={e => setManualWeight(e.target.value)} 
                            className="h-10 border-2 font-black text-center text-xs bg-white pl-7"
                        />
                        <Pencil className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-primary opacity-40" />
                    </div>
                ) : (
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
                )}
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

            {/* SECTION VENT */}
            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">Force du Vent (km/h)</Label>
                <div className="relative">
                    <Input 
                        type="number" 
                        value={windKmh} 
                        onChange={e => setWindKmh(e.target.value)}
                        className="h-10 border-2 border-blue-100 font-black text-center text-sm bg-white pl-8"
                    />
                    <Wind className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-blue-500" />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">Direction du Vent</Label>
                <Select value={windAngle} onValueChange={setWindAngle}>
                    <SelectTrigger className="h-10 border-2 border-blue-100 font-black uppercase text-[10px] bg-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {WIND_DIRECTIONS.map(dir => (
                            <SelectItem key={dir.angle} value={dir.angle.toString()} className="text-[10px] font-black uppercase">
                                {dir.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isCustomMode && (
                <div className="md:col-span-4 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-primary ml-1">Vitesse Initiale V0 (m/s)</Label>
                        <Input 
                            type="number" 
                            value={manualV0} 
                            onChange={e => setManualV0(e.target.value)} 
                            className="h-10 border-2 border-primary/30 font-black text-center text-sm bg-white"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-primary ml-1">Coef. Balistique (BC G1)</Label>
                        <Input 
                            type="number" 
                            step="0.001"
                            value={manualBC} 
                            onChange={e => setManualBC(e.target.value)} 
                            className="h-10 border-2 border-primary/30 font-black text-center text-sm bg-white"
                        />
                    </div>
                </div>
            )}

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
                    <Crosshair className="size-3 text-primary" /> Corrections (Zéroté à {zeroDistance}m)
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
                            <BlockHead label="Chute (cm)" />
                            <BlockHead label="Élévation (clics)" className="text-primary" />
                            <BlockHead label="Dérive (clics)" className="text-accent" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {resultsTable.map((res, idx) => (
                            <TableRow key={idx} className="hover:bg-primary/5 transition-colors h-14">
                                <TableCell className="font-black text-center text-sm">{res.dist}m</TableCell>
                                <TableCell className="font-bold text-center text-slate-600">{res.dropCm} cm</TableCell>
                                <TableCell className="text-center">
                                    <div className={cn(
                                        "inline-flex items-center gap-2 font-black text-xs px-3 py-1.5 rounded-lg shadow-sm min-w-[80px] justify-center",
                                        res.clicks > 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                                    )}>
                                        {res.elevationDir === 'HAUT' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />} 
                                        {res.clicks}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className={cn(
                                        "inline-flex items-center gap-2 font-black text-xs px-3 py-1.5 rounded-lg shadow-sm min-w-[80px] justify-center",
                                        res.driftClicks > 0 ? "bg-accent text-white" : "bg-slate-100 text-slate-400"
                                    )}>
                                        {res.driftDir === 'GAUCHE' ? <ArrowLeft className="size-3" /> : <ArrowRight className="size-3" />} 
                                        {res.driftClicks}
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
                Simulation théorique G1. Les calculs de dérive sont donnés pour une force de vent constante sur toute la trajectoire. Vérifiez toujours votre réglage sur cible avant de chasser.
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
