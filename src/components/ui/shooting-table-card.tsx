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
import { Switch } from '@/components/ui/switch';
import { 
  Target, 
  ArrowUp, 
  ArrowLeft, 
  ArrowRight, 
  Wind, 
  Info,
  AlertCircle,
  AlertTriangle,
  Zap,
  Crosshair,
  Pencil,
  ArrowDown,
  Scaling,
  Focus,
  Bird,
  Volume2,
  Waves,
  ShieldAlert,
  RefreshCw,
  Save
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
  type: 'bullet' | 'shot' | 'slug' | 'buckshot';
};

const BALLISTIC_DATABASE: MunitionData[] = [
  // .222 Remington
  { id: '222-rem-40-vmax', caliber: '.222 Rem', model: 'Hornady V-MAX', weight: 40, v0: 1100, bc: 0.200, usage: 'Nuisibles (très rapide)', color: 'bg-emerald-500', type: 'bullet' },
  { id: '222-rem-55-nbt', caliber: '.222 Rem', model: 'Nosler Ballistic Tip', weight: 55, v0: 980, bc: 0.267, usage: 'Précision / Tir biche', color: 'bg-emerald-500', type: 'bullet' },
  
  // .243 Winchester
  { id: '243-win-80-superx', caliber: '.243 Win', model: 'Winchester Super-X', weight: 80, v0: 1020, bc: 0.276, usage: 'Tir de plaine (tendu)', color: 'bg-yellow-600', type: 'bullet' },
  { id: '243-win-100-gk', caliber: '.243 Win', model: 'Sierra GameKing', weight: 100, v0: 900, bc: 0.430, usage: 'Cerf Rusa moyen', color: 'bg-yellow-600', type: 'bullet' },

  // .25-06 Remington
  { id: '25-06-rem-117-sst', caliber: '.25-06 Rem', model: 'Hornady SST', weight: 117, v0: 910, bc: 0.443, usage: 'Polyvalent longue dist.', color: 'bg-cyan-500', type: 'bullet' },

  // 6.5 Creedmoor
  { id: '65-cm-143-eldx', caliber: '6.5 Creedmoor', model: 'Hornady ELD-X', weight: 143, v0: 823, bc: 0.625, usage: 'Précision chirurgicale', color: 'bg-teal-600', type: 'bullet' },

  // .270 Winchester
  { id: '270-win-130-sst', caliber: '.270 Win', model: 'Hornady SST', weight: 130, v0: 930, bc: 0.460, usage: 'Expansion violente (Savane)', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-140-ab', caliber: '.270 Win', model: 'Nosler AccuBond', weight: 140, v0: 880, bc: 0.496, usage: 'Polyvalent Cerf Rusa', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-150-pt', caliber: '.270 Win', model: 'Nosler Partition', weight: 150, v0: 850, bc: 0.465, usage: 'Gros Cerf / Pénétration', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-110-ttsx', caliber: '.270 Win', model: 'Barnes TTSX', weight: 110, v0: 1000, bc: 0.323, usage: 'Vitesse pure / Sans plomb', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-145-eldx', caliber: '.270 Win', model: 'ELD-X (Precision)', weight: 145, v0: 870, bc: 0.536, usage: 'Tir de précision (> 300m)', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-subso', caliber: '.270 Win', model: 'Subsonic Custom', weight: 150, v0: 320, bc: 0.450, usage: 'Tir discret (80-100m max)', color: 'bg-orange-900', type: 'bullet' },

  // .270 Winchester Short Magnum (WSM)
  { id: '270-wsm-130-sst', caliber: '.270 WSM', model: 'Hornady SST', weight: 130, v0: 1000, bc: 0.460, usage: 'Vitesse Magnum / Savane', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-140-ab', caliber: '.270 WSM', model: 'Nosler AccuBond', weight: 140, v0: 960, bc: 0.496, usage: 'Puissance Magnum Polyvalente', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-150-pt', caliber: '.270 WSM', model: 'Nosler Partition', weight: 150, v0: 930, bc: 0.465, usage: 'Gros gibier / Pénétration Max', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-110-ttsx', caliber: '.270 WSM', model: 'Barnes TTSX', weight: 110, v0: 1060, bc: 0.323, usage: 'Vitesse extrême / Sans plomb', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-145-eldx', caliber: '.270 WSM', model: 'ELD-X (Precision)', weight: 145, v0: 950, bc: 0.536, usage: 'Tir de précision Magnum', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-subso', caliber: '.270 WSM', model: 'Subsonic Custom', weight: 160, v0: 325, bc: 0.480, usage: 'Tir discret Magnum (Proche)', color: 'bg-orange-950', type: 'bullet' },

  // 7mm-08
  { id: '7mm-08-120-ttsx', caliber: '7mm-08', model: 'Barnes TTSX (Sans plomb)', weight: 120, v0: 915, bc: 0.373, usage: 'Vitesse / Pénétration', color: 'bg-indigo-600', type: 'bullet' },
  { id: '7mm-08-150-ph', caliber: '7mm-08', model: 'Hornady Precision Hunter', weight: 150, v0: 845, bc: 0.574, usage: 'Tir de montagne / crêtes', color: 'bg-indigo-600', type: 'bullet' },

  // .308 Winchester
  { id: '308-win-150-pp', caliber: '.308 Win', model: 'Win. Power-Point', weight: 150, v0: 860, bc: 0.294, usage: 'Standard Brousse', color: 'bg-blue-500', type: 'bullet' },
  { id: '308-win-165-sst', caliber: '.308 Win', model: 'Hornady SST', weight: 165, v0: 840, bc: 0.447, usage: 'Équilibre Vitesse/Poids', color: 'bg-blue-500', type: 'bullet' },
  { id: '308-win-180-partition', caliber: '.308 Win', model: 'Nosler Partition', weight: 180, v0: 790, bc: 0.474, usage: 'Cochon / Cerf massif', color: 'bg-blue-500', type: 'bullet' },

  // .30-06 Sprg
  { id: '30-06-150-cl', caliber: '.30-06 Sprg', model: 'Remington Core-Lokt', weight: 150, v0: 880, bc: 0.314, usage: 'Tir rapide en forêt', color: 'bg-green-600', type: 'bullet' },
  { id: '30-06-180-shh', caliber: '.30-06 Sprg', model: 'Sako Hammerhead', weight: 180, v0: 820, bc: 0.383, usage: 'Arrêt net (classique)', color: 'bg-green-600', type: 'bullet' },
  { id: '30-06-200-oryx', caliber: '.30-06 Sprg', model: 'Norma Oryx (Lourde)', weight: 200, v0: 780, bc: 0.400, usage: 'Chasse en battue dense', color: 'bg-green-600', type: 'bullet' },

  // 7mm Rem Mag
  { id: '7mm-rm-160-ab', caliber: '7mm Rem Mag', model: 'Nosler AccuBond', weight: 160, v0: 900, bc: 0.531, usage: 'Très longue distance', color: 'bg-rose-700', type: 'bullet' },

  // .300 Win Mag
  { id: '300-wm-150-xp', caliber: '.300 Win Mag', model: 'Winchester XP', weight: 150, v0: 990, bc: 0.387, usage: 'Vitesse fulgurante', color: 'bg-red-800', type: 'bullet' },
  { id: '300-wm-200-eldx', caliber: '.300 Win Mag', model: 'Hornady ELD-X', weight: 200, v0: 870, bc: 0.626, usage: 'Puissance maximale', color: 'bg-red-800', type: 'bullet' },
  { id: '300-wm-215-hybrid', caliber: '.300 Win Mag', model: 'Berger Hybrid', weight: 215, v0: 850, bc: 0.691, usage: 'Tir de précision extrême', color: 'bg-red-800', type: 'bullet' },

  // --- Calibres Lisses ---
  { id: '12-bfs-26', caliber: 'Calibre 12', model: 'Balle Sauvestre (BFS)', weight: 26, v0: 500, bc: 0.170, usage: 'Battue (0-80m)', color: 'bg-red-600', type: 'slug' },
  { id: '12-brenn-31', caliber: 'Calibre 12', model: 'Balle Brenneke', weight: 31.5, v0: 430, bc: 0.120, usage: 'Forêt dense (0-50m)', color: 'bg-red-600', type: 'slug' },
  { id: '12-plomb-4', caliber: 'Calibre 12', model: 'Plomb n°4', weight: 36, v0: 400, bc: 0.015, usage: 'Gros canards, roussette, nuisibles.', color: 'bg-red-600', type: 'shot' },
  { id: '12-plomb-6', caliber: 'Calibre 12', model: 'Plomb n°6', weight: 36, v0: 400, bc: 0.015, usage: 'Notou, Pigeon vert, Collier blanc.', color: 'bg-red-600', type: 'shot' },
  { id: '12-chev-9', caliber: 'Calibre 12', model: 'Chevrotine 9 grains', weight: 32, v0: 400, bc: 0.045, usage: 'Cochon au fourré à très courte distance.', color: 'bg-red-600', type: 'buckshot' },

  { id: '16-slug-24', caliber: 'Calibre 16', model: 'Balle Type Slug', weight: 24.5, v0: 400, bc: 0.100, usage: 'Tradition / Forêt', color: 'bg-orange-800', type: 'slug' },
  { id: '16-plomb-6', caliber: 'Calibre 16', model: 'Plomb n°6', weight: 28, v0: 390, bc: 0.015, usage: 'Efficace pour Notou et Pigeon vert.', color: 'bg-orange-800', type: 'shot' },

  { id: '20-win-22', caliber: 'Calibre 20', model: 'Balle Winchester', weight: 22.5, v0: 420, bc: 0.110, usage: 'Léger / Précis', color: 'bg-yellow-800', type: 'slug' },
  { id: '20-plomb-6', caliber: 'Calibre 20', model: 'Plomb n°6', weight: 24, v0: 390, bc: 0.015, usage: 'Excellent pour la plume, recul très faible.', color: 'bg-yellow-800', type: 'shot' },

  { id: '410-brenn-7.5', caliber: 'Calibre .410', model: 'Balle Brenneke', weight: 7.5, v0: 530, bc: 0.090, usage: 'Jeune Cerf / Cochon', color: 'bg-stone-500', type: 'slug' },
  { id: '410-pdx1', caliber: 'Calibre .410', model: 'Winchester PDX1 (Défense)', weight: 19, v0: 350, bc: 0.040, usage: 'Hybride : 3 disques + 12 billes.', color: 'bg-stone-500', type: 'slug' },
  { id: '410-plomb-6', caliber: 'Calibre .410', model: 'Plomb n°6', weight: 12, v0: 370, bc: 0.015, usage: 'Tourterelles et petits oiseaux.', color: 'bg-stone-500', type: 'shot' },
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

const CHOKES = [
    { label: 'Lisse (Cyl)', factor: 3.5 },
    { label: '1/4 Choke', factor: 3.0 },
    { label: '1/2 Choke', factor: 2.5 },
    { label: '3/4 Choke', factor: 2.1 },
    { label: 'Full Choke', factor: 1.8 },
];

const SHOT_DISTANCES = [10, 20, 30, 40];

export function ShootingTableCard() {
  const [selectedCaliber, setSelectedCaliber] = useState(CALIBERS[0]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedWeight, setSelectedWeight] = useState<number>(0);
  const [zeroDistance, setZeroDistance] = useState('100');
  
  const [windKmh, setWindKmh] = useState('10');
  const [windAngle, setWindAngle] = useState('90'); 

  const [hasSilencer, setHasSilencer] = useState(false);
  const [hasMuzzleBrake, setHasMuzzleBrake] = useState(false);

  const [selectedChoke, setSelectedChoke] = useState(CHOKES[2].label);
  const [shotDistance, setShotDistance] = useState(20);

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
    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0]);
    }
  }, [availableModels, selectedModel]);

  const availableWeights = useMemo(() => 
    Array.from(new Set(munitionsForCaliber
      .filter(m => m.model === selectedModel)
      .map(m => m.weight)))
      .sort((a, b) => a - b)
  , [munitionsForCaliber, selectedModel]);

  useEffect(() => {
    if (availableWeights.length > 0 && !availableWeights.includes(selectedWeight)) {
      setSelectedWeight(availableWeights[0]);
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
            color: "bg-slate-700",
            type: selectedCaliber.startsWith('Calibre') ? 'slug' : 'bullet'
        } as MunitionData;
    }
    const found = munitionsForCaliber.find(m => m.model === selectedModel && m.weight === selectedWeight);
    return found || munitionsForCaliber[0] || BALLISTIC_DATABASE[0];
  }, [munitionsForCaliber, selectedModel, selectedWeight, isCustomMode, manualWeight, manualV0, manualBC, selectedCaliber]);

  const isPatternMode = selectedMunition.type === 'shot' || selectedMunition.type === 'buckshot';
  const isSubsonic = selectedMunition.model.toLowerCase().includes('subsonic');

  const calculateBallistics = useCallback((dist: number) => {
    const z = parseFloat(zeroDistance) || 100;
    const wSpeed = parseFloat(windKmh) || 0;
    const wAng = parseFloat(windAngle) || 0;
    const g = 9.81;
    
    const baseV0 = selectedMunition.v0;
    const silencerBonus = (selectedCaliber.includes('.410') && hasSilencer) ? 1.03 : (hasSilencer ? 1.02 : 1.0);
    const v0 = baseV0 * silencerBonus;
    const { bc } = selectedMunition;

    if (v0 <= 0 || bc <= 0) return { dist, dropCm: 0, clicks: 0, driftCm: 0, driftClicks: 0, elevationDir: 'HAUT', driftDir: 'DROITE' };

    const calculateDropAt = (d: number) => {
        // Simple drag model for calculation purposes
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
    const angleRad = (wAng * Math.PI) / 180;
    
    const windDriftFactor = hasSilencer ? 0.95 : 1.0;
    const crosswindMps = (wSpeed / 3.6) * Math.sin(angleRad) * windDriftFactor;
    
    const windDriftCm = crosswindMps * (timeTarget - dist / v0) * 100;
    const distFactor = dist / 100;

    return {
        dist,
        dropCm: parseFloat(Math.abs(correctionCm).toFixed(1)),
        clicks: Math.abs(Math.round(correctionCm / distFactor)),
        elevationDir: correctionCm > 0 ? 'HAUT' : 'BAS',
        driftCm: parseFloat(Math.abs(windDriftCm).toFixed(1)),
        driftClicks: Math.abs(Math.round(windDriftCm / distFactor)),
        driftDir: windDriftCm > 0 ? 'DROITE' : 'GAUCHE'
    };
  }, [selectedMunition, selectedCaliber, zeroDistance, windKmh, windAngle, hasSilencer]);

  const resultsTable = useMemo(() => {
    if (selectedCaliber.includes('.410')) {
        if (selectedMunition.type === 'shot' || selectedMunition.type === 'buckshot') return [calculateBallistics(10), calculateBallistics(20), calculateBallistics(30)];
        return [calculateBallistics(25), calculateBallistics(50), calculateBallistics(75)];
    }
    if (selectedCaliber.startsWith('Calibre')) {
        return [calculateBallistics(50), calculateBallistics(75), calculateBallistics(100)];
    }
    if (selectedCaliber === '22mm') {
        return [calculateBallistics(25), calculateBallistics(50), calculateBallistics(100)];
    }
    return [100, 200, 300].map(d => calculateBallistics(d));
  }, [selectedCaliber, selectedMunition.type, calculateBallistics]);

  const patternDiameter = useMemo(() => {
    const choke = CHOKES.find(c => c.label === selectedChoke) || CHOKES[2];
    const caliberFactor = selectedCaliber.includes('.410') ? 0.85 : 1.0;
    return Math.round(shotDistance * choke.factor * caliberFactor);
  }, [selectedChoke, shotDistance, selectedCaliber]);

  const patternWarning = useMemo(() => {
    if (!isPatternMode) return null;
    const maxDist = selectedCaliber.includes('.410') ? 25 : 40;
    if (shotDistance >= maxDist) {
        return `Attention : Gerbe trop large pour ce calibre. Risque de blesser le gibier sans le prélever à cette distance (> ${maxDist}m).`;
    }
    if (selectedMunition.type === 'buckshot' && shotDistance > 25) {
        return "Danger : La chevrotine perd son efficacité d'arrêt très rapidement au-delà de 25m.";
    }
    return null;
  }, [isPatternMode, selectedMunition, shotDistance, selectedCaliber]);

  const weightUnit = selectedMunition.caliber.startsWith('Calibre') || selectedCaliber.includes('.410') ? 'g' : 'gr';

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-900 text-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary rounded-xl shadow-lg">
                      <Target className="size-6 text-white" />
                  </div>
                  <div>
                      <CardTitle className="text-xl font-black uppercase tracking-tight">Table de Tir Tactique</CardTitle>
                      <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-0.5">
                        {isPatternMode ? 'Simulateur de Gerbe (Plombs)' : 'Calculateur Balistique (Balles)'}
                      </CardDescription>
                  </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={cn("font-black uppercase text-[10px] px-3 h-7 border-none shadow-md", selectedMunition.color)}>
                    {selectedMunition.caliber}
                </Badge>
                {selectedCaliber.includes('.410') && hasSilencer && (
                    <Badge variant="outline" className="text-[8px] h-4 border-green-500 text-green-400 font-black uppercase animate-pulse">
                        Bruit -60% (Roi du Silencieux)
                    </Badge>
                )}
                {isSubsonic && (
                    <Badge variant="outline" className="text-[8px] h-4 border-blue-400 text-blue-400 font-black uppercase animate-pulse">
                        Mode Subsonique (Tir Discret)
                    </Badge>
                )}
              </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5 bg-muted/20 rounded-3xl border-2 border-dashed border-primary/10">
              <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Calibre</Label>
                  <Select value={selectedCaliber} onValueChange={setSelectedCaliber}>
                      <SelectTrigger className="h-10 border-2 font-black uppercase text-xs bg-white shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{CALIBERS.map(c => <SelectItem key={c} value={c} className="font-black uppercase text-xs">{c}</SelectItem>)}</SelectContent>
                  </Select>
              </div>

              <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Modèle d'ogive / Marque</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="h-10 border-2 font-bold text-xs bg-white shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{availableModels.map(m => <SelectItem key={m} value={m} className={cn("text-xs", m === "PERSONNALISÉ" && "text-primary font-black")}>{m}</SelectItem>)}</SelectContent>
                  </Select>
              </div>

              <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Poids ({weightUnit})</Label>
                  {isCustomMode ? (
                      <div className="relative">
                          <Input type="number" value={manualWeight} onChange={e => setManualWeight(e.target.value)} className="h-10 border-2 font-black text-center text-xs bg-white pl-7" />
                          <Pencil className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-primary opacity-40" />
                      </div>
                  ) : (
                      <Select value={selectedWeight.toString()} onValueChange={(v) => setSelectedWeight(parseFloat(v))}>
                          <SelectTrigger className="h-10 border-2 font-black text-xs bg-white shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{availableWeights.map(w => <SelectItem key={w} value={w.toString()} className="font-black text-xs">{w} {weightUnit}</SelectItem>)}</SelectContent>
                      </Select>
                  )}
              </div>

              {isPatternMode ? (
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-primary ml-1">Choke du fusil</Label>
                    <Select value={selectedChoke} onValueChange={setSelectedChoke}>
                        <SelectTrigger className="h-10 border-2 border-primary/30 font-black uppercase text-[10px] bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHOKES.map(c => <SelectItem key={c.label} value={c.label} className="text-[10px] font-black uppercase">{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Distance de Zéro (m)</Label>
                    <Input type="number" value={zeroDistance} onChange={e => setZeroDistance(e.target.value)} className="h-10 border-2 font-black text-center text-sm bg-white shadow-sm" />
                </div>
              )}

              {!isPatternMode && (
                <>
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">Force du Vent (km/h)</Label>
                        <div className="relative">
                            <Input type="number" value={windKmh} onChange={e => setWindKmh(e.target.value)} className="h-10 border-2 border-blue-100 font-black text-center text-sm bg-white pl-8 shadow-sm" />
                            <Wind className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-blue-500" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">Direction du Vent</Label>
                        <Select value={windAngle} onValueChange={setWindAngle}>
                            <SelectTrigger className="h-10 border-2 border-blue-100 font-black uppercase text-[10px] bg-white shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{WIND_DIRECTIONS.map(dir => <SelectItem key={dir.angle} value={dir.angle.toString()} className="text-[10px] font-black uppercase">{dir.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </>
              )}

              {isCustomMode && (
                  <div className="md:col-span-4 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-primary ml-1">Vitesse Initiale V0 (m/s)</Label>
                          <Input type="number" value={manualV0} onChange={e => setManualV0(e.target.value)} className="h-10 border-2 border-primary/30 font-black text-center text-sm bg-white shadow-sm" />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-primary ml-1">Coef. Balistique (BC G1)</Label>
                          <Input type="number" step="0.001" value={manualBC} onChange={e => setManualBC(e.target.value)} className="h-10 border-2 border-primary/30 font-black text-center text-sm bg-white shadow-sm" />
                      </div>
                  </div>
              )}

              <div className="md:col-span-4 pt-2 border-t border-dashed border-primary/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Zap className="size-3" /> Usage spécifique</p>
                          <p className="text-xs font-medium text-slate-600 italic">"{selectedMunition.usage}"</p>
                      </div>
                      <div className="flex gap-4">
                          <div className="text-center">
                              <p className="text-[8px] font-black uppercase opacity-40">Poids</p>
                              <p className="font-black text-xs">{selectedMunition.weight} {weightUnit}</p>
                          </div>
                          {!isPatternMode && (
                            <>
                                <div className="text-center border-l pl-4">
                                    <p className="text-[8px] font-black uppercase opacity-40">BC</p>
                                    <p className="font-black text-xs text-primary">{selectedMunition.bc}</p>
                                </div>
                                <div className="text-center border-l pl-4">
                                    <p className="text-[8px] font-black uppercase opacity-40">V0</p>
                                    <p className="font-black text-xs">
                                        {hasSilencer 
                                            ? Math.round(selectedMunition.v0 * (selectedCaliber.includes('.410') ? 1.03 : 1.02)) 
                                            : selectedMunition.v0} m/s
                                    </p>
                                </div>
                            </>
                          )}
                      </div>
                  </div>
              </div>
          </div>

          {isSubsonic && (
            <Alert className="bg-blue-50 border-blue-200 border-2 animate-pulse">
                <AlertTriangle className="size-4 text-blue-600" />
                <AlertTitle className="text-xs font-black uppercase text-blue-800">Avertissement Subsonique</AlertTitle>
                <AlertDescription className="text-[10px] font-bold text-blue-700 leading-tight">
                    Portée limitée à 100m. Chute de balle massive. Vérifiez vos clics de réglage ci-dessous.
                </AlertDescription>
            </Alert>
          )}

          {!isPatternMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><Volume2 className="size-4" /></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase">Silencieux</span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">
                                {selectedCaliber.includes('.410') ? '+3% V0 | -60% Bruit' : '+2% V0 | -5% Dérive'}
                            </span>
                        </div>
                    </div>
                    <Switch checked={hasSilencer} onCheckedChange={setHasSilencer} />
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg text-accent"><Waves className="size-4" /></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase">Frein de bouche</span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">Réduit le relèvement</span>
                        </div>
                    </div>
                    <Switch checked={hasMuzzleBrake} onCheckedChange={setHasMuzzleBrake} />
                </div>

                {hasMuzzleBrake && (
                    <div className="sm:col-span-2 px-2 py-1 flex items-center gap-2 text-[9px] font-bold text-accent italic animate-in fade-in slide-in-from-left-2">
                        <Zap className="size-3" /> Note : Améliore la rapidité du second tir (stabilité du canon accrue).
                    </div>
                )}
            </div>
          )}

          {isPatternMode ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Scaling className="size-3 text-primary" /> Simulateur de Gerbe
                        </h3>
                        <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-primary/30 text-primary">Diamètre estimé : {patternDiameter} cm</Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {SHOT_DISTANCES.map(d => (
                            <Button 
                                key={d} 
                                variant={shotDistance === d ? 'default' : 'outline'} 
                                onClick={() => setShotDistance(d)}
                                className={cn("h-10 font-black text-xs uppercase border-2", shotDistance === d ? "shadow-md scale-105" : "bg-white")}
                            >
                                {d}m
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="relative aspect-square max-w-[300px] mx-auto bg-slate-50 border-2 rounded-[2.5rem] flex items-center justify-center overflow-hidden shadow-inner border-dashed border-primary/10">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        {selectedMunition.model.toLowerCase().includes('plomb') ? (
                            <Bird className="size-48" />
                        ) : (
                            <Zap className="size-48" />
                        )}
                    </div>
                    
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase opacity-20">Zone 1m x 1m</div>

                    <div 
                        className="rounded-full border-4 border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.2)] flex items-center justify-center transition-all duration-500 ease-out"
                        style={{ 
                            width: `${patternDiameter}%`, 
                            height: `${patternDiameter}%` 
                        }}
                    >
                        <div className="flex flex-col items-center">
                            <Focus className="size-4 text-primary opacity-40 animate-pulse" />
                            <span className="text-[10px] font-black text-primary mt-1">{patternDiameter} cm</span>
                        </div>
                    </div>

                    <div className="absolute flex flex-col items-center pointer-events-none">
                        {selectedMunition.model.toLowerCase().includes('plomb') ? (
                            <>
                                <Bird className="size-10 text-slate-800 opacity-80" />
                                <span className="text-[8px] font-black uppercase mt-1 bg-white/80 px-1 rounded">GIBIER PLUME</span>
                            </>
                        ) : (
                            <>
                                <Scaling className="size-20 text-slate-800 opacity-80" />
                                <span className="text-[8px] font-black uppercase mt-1 bg-white/80 px-1 rounded">CIBLAGE</span>
                            </>
                        )}
                    </div>
                </div>

                {patternWarning && (
                    <Alert variant="destructive" className="bg-red-50 border-2 animate-bounce">
                        <AlertTriangle className="size-4 text-red-600" />
                        <AlertTitle className="text-xs font-black uppercase">Risque éthique détecté</AlertTitle>
                        <AlertDescription className="text-[10px] font-bold mt-1 leading-tight">
                            {patternWarning}
                        </AlertDescription>
                    </Alert>
                )}
            </div>
          ) : (
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
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
                                <BlockHead label="Élévation" className="text-primary" />
                                <BlockHead label="Dérive" className="text-accent" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {resultsTable.map((res, idx) => (
                                <TableRow key={idx} className="hover:bg-primary/5 transition-colors h-14">
                                    <TableCell className="font-black text-center text-sm">{res.dist}m</TableCell>
                                    <TableCell className="font-bold text-center text-slate-600">{res.dropCm} cm</TableCell>
                                    <TableCell className="text-center">
                                        <div className={cn(
                                            "inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[70px] justify-center",
                                            res.clicks > 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                                        )}>
                                            <div className="flex items-center gap-1 font-black text-[10px]">
                                                {res.elevationDir === 'HAUT' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />} 
                                                {res.clicks} CLICS
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className={cn(
                                            "inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[70px] justify-center",
                                            res.driftClicks > 0 ? "bg-accent text-white" : "bg-slate-100 text-slate-400"
                                        )}>
                                            <div className="flex items-center gap-1 font-black text-[10px]">
                                                {res.driftDir === 'GAUCHE' ? <ArrowLeft className="size-2.5" /> : <ArrowRight className="size-2.5" />} 
                                                {res.driftClicks} CLICS
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
          )}

          <Alert className="bg-slate-900 text-white border-none rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldAlert className="size-10 text-primary" />
              </div>
              <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-1">
                  Sécurité & Balistique
              </AlertTitle>
              <AlertDescription className="text-[9px] leading-relaxed italic text-slate-300 font-medium">
                  Simulation théorique G1. Les conditions réelles (altitude, humidité) influent sur la précision. {selectedCaliber.includes('.410') ? 'Le .410 demande une grande précision due à sa faible charge.' : 'Vérifiez toujours votre réglage sur cible avant de chasser.'}
              </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

function BlockHead({ label, className }: { label: string, className?: string }) {
    return (
        <TableHead className={cn("font-black uppercase text-[9px] text-center", className)}>
            {label}
        </TableHead>
    );
}
