'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
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
  Save,
  Package,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import type { UserAccount, BallisticsPrefs, Weapon } from '@/lib/types';
import { BALLISTIC_DATABASE, CALIBERS, type MunitionData } from '@/lib/ballistics-db';

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
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile } = useDoc<UserAccount>(userDocRef);

  const weaponsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'weapons'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  const { data: myWeapons } = useCollection<Weapon>(weaponsRef);

  const [selectedCaliber, setSelectedCaliber] = useState(CALIBERS[0]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedWeight, setSelectedWeight] = useState<number>(0);
  const [zeroDistance, setZeroDistance] = useState('100');
  const [customTargetDist, setCustomTargetDist] = useState('150');
  
  const [windKmh, setWindKmh] = useState('10');
  const [windAngle, setWindAngle] = useState('90'); 

  const [hasSilencer, setHasSilencer] = useState(false);
  const [hasMuzzleBrake, setHasMuzzleBrake] = useState(false);

  const [selectedChoke, setSelectedChoke] = useState(CHOKES[2].label);
  const [shotDistance, setShotDistance] = useState(20);

  const [manualWeight, setManualWeight] = useState('150');
  const [manualV0, setManualV0] = useState('860');
  const [manualBC, setManualBC] = useState('0.400');

  const isInitialSyncDone = useRef(false);

  const handleLoadWeapon = (weaponId: string) => {
    const weapon = myWeapons?.find(w => w.id === weaponId);
    if (!weapon) return;

    setSelectedCaliber(weapon.caliber);
    setZeroDistance(weapon.zeroDistance);
    
    // Find munition to match
    const munition = BALLISTIC_DATABASE.find(m => m.id === weapon.munitionId);
    if (munition) {
        setSelectedModel(munition.model);
        setSelectedWeight(munition.weight);
    } else {
        setSelectedModel("PERSONNALISÉ");
        setManualWeight(weapon.weight.toString());
    }
    
    toast({ title: "Arme chargée !", description: weapon.customName });
  };

  useEffect(() => {
    if (userProfile?.ballisticsPrefs && !isInitialSyncDone.current) {
      const prefs = userProfile.ballisticsPrefs;
      setSelectedCaliber(prefs.caliber || CALIBERS[0]);
      setSelectedModel(prefs.model || '');
      setSelectedWeight(prefs.weight || 0);
      setZeroDistance(prefs.zeroDistance || '100');
      setCustomTargetDist(prefs.customTargetDist || '150');
      setWindKmh(prefs.windKmh || '10');
      setWindAngle(prefs.windAngle || '90');
      setHasSilencer(prefs.hasSilencer ?? false);
      setHasMuzzleBrake(prefs.hasMuzzleBrake ?? false);
      setSelectedChoke(prefs.choke || CHOKES[2].label);
      setShotDistance(prefs.shotDistance || 20);
      setManualWeight(prefs.manualWeight || '150');
      setManualV0(prefs.manualV0 || '860');
      setManualBC(prefs.manualBC || '0.400');
      isInitialSyncDone.current = true;
    }
  }, [userProfile]);

  useEffect(() => {
    if (!user || !firestore || !isInitialSyncDone.current) return;

    const timer = setTimeout(() => {
      const prefs: BallisticsPrefs = {
        caliber: selectedCaliber,
        model: selectedModel,
        weight: selectedWeight,
        zeroDistance,
        customTargetDist,
        windKmh,
        windAngle,
        hasSilencer,
        hasMuzzleBrake,
        choke: selectedChoke,
        shotDistance,
        manualWeight,
        manualV0,
        manualBC
      };
      updateDoc(doc(firestore, 'users', user.uid), { ballisticsPrefs: prefs })
        .catch(err => console.warn("Failed to auto-save ballistics prefs", err));
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    selectedCaliber, selectedModel, selectedWeight, zeroDistance, customTargetDist,
    windKmh, windAngle, hasSilencer, hasMuzzleBrake, 
    selectedChoke, shotDistance, manualWeight, manualV0, manualBC,
    user, firestore
  ]);

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
    const is410 = selectedCaliber.includes('.410');
    const silencerBonus = (is410 && hasSilencer) ? 1.03 : (hasSilencer ? 1.02 : 1.0);
    const v0 = baseV0 * silencerBonus;
    const { bc } = selectedMunition;

    if (v0 <= 0 || bc <= 0) return { dist, dropCm: 0, clicks: 0, driftCm: 0, driftClicks: 0, elevationDir: 'HAUT', driftDir: 'DROITE' };

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
    let distances = [];
    if (selectedCaliber.includes('.410')) {
        if (selectedMunition.type === 'shot' || selectedMunition.type === 'buckshot') distances = [10, 20, 30];
        else distances = [25, 50, 75];
    } else if (selectedCaliber.startsWith('Calibre')) {
        distances = [50, 75, 100];
    } else {
        distances = [100, 200, 300];
    }
    
    const dCustom = parseFloat(customTargetDist);
    if (!isNaN(dCustom) && dCustom > 0 && !distances.includes(dCustom)) {
        distances.push(dCustom);
    }
    
    return distances.sort((a, b) => a - b).map(d => calculateBallistics(d));
  }, [selectedCaliber, selectedMunition.type, calculateBallistics, customTargetDist]);

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
              <div className="flex flex-col items-end gap-2">
                {myWeapons && myWeapons.length > 0 ? (
                    <Select onValueChange={handleLoadWeapon}>
                        <SelectTrigger className="h-10 border-white/20 font-black uppercase text-[10px] bg-white/10 text-white w-48 shadow-lg ring-2 ring-primary/20">
                            <Package className="size-4 mr-2 text-primary" />
                            <SelectValue placeholder="Charger une arme..." />
                        </SelectTrigger>
                        <SelectContent>
                            {myWeapons.map(w => (
                                <SelectItem key={w.id} value={w.id} className="font-black text-[10px] uppercase">
                                    {w.customName} ({w.caliber})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant="outline" className="h-8 border-white/10 text-white/40 font-bold uppercase text-[8px] italic">
                        Râtelier vide : enregistrez vos armes ci-dessous
                    </Badge>
                )}
                <Badge className={cn("font-black uppercase text-[10px] px-3 h-7 border-none shadow-md", selectedMunition.color)}>
                    {selectedMunition.caliber}
                </Badge>
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
                  <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Modèle d'ogive / Plomb</Label>
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

          {(isSubsonic || isCustomMode) && (
            <Alert className={cn(isSubsonic ? "bg-blue-50 border-blue-200" : "bg-primary/5 border-primary/20", "border-2 animate-pulse")}>
                <AlertTriangle className={cn("size-4", isSubsonic ? "text-blue-600" : "text-primary")} />
                <AlertTitle className="text-xs font-black uppercase">Avertissement Tactique</AlertTitle>
                <AlertDescription className="text-[10px] font-bold leading-tight">
                    {isSubsonic ? "Portée limitée à 100m. Chute de balle massive. Vérifiez vos clics de réglage ci-dessous." : "Vérifiez vos paramètres personnalisés avant de vous fier à ces calculs théoriques."}
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
                    <div className="rounded-full border-4 border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.2)] flex items-center justify-center transition-all duration-500 ease-out"
                        style={{ width: `${patternDiameter}%`, height: `${patternDiameter}%` }}>
                        <div className="flex flex-col items-center">
                            <Focus className="size-4 text-primary opacity-40 animate-pulse" />
                            <span className="text-[10px] font-black text-primary mt-1">{patternDiameter} cm</span>
                        </div>
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
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-primary/10 border-2 border-primary/30 rounded-xl px-3 py-1.5 h-11 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20">
                            <Label className="text-[10px] font-black uppercase text-primary whitespace-nowrap leading-none">Cible :</Label>
                            <div className="flex items-center gap-1">
                                <Input 
                                    type="number" 
                                    inputMode="decimal"
                                    value={customTargetDist} 
                                    onChange={e => setCustomTargetDist(e.target.value)} 
                                    className="w-16 h-8 border-none bg-white rounded-lg p-0 font-black text-base text-center focus-visible:ring-0 shadow-inner" 
                                />
                                <span className="text-[10px] font-black text-primary/60">m</span>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black uppercase h-11 border-blue-200 text-blue-600 px-3 bg-white/50">1 clic = 1cm à 100m</Badge>
                    </div>
                </div>

                <div className="border-2 rounded-2xl overflow-hidden bg-white shadow-md">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="hover:bg-transparent border-b-2">
                                <TableHead className="font-black uppercase text-[9px] text-center">Distance</TableHead>
                                <TableHead className="font-black uppercase text-[9px] text-center">Chute (cm)</TableHead>
                                <TableHead className="font-black uppercase text-[9px] text-center">Dérive (cm)</TableHead>
                                <TableHead className="font-black uppercase text-[9px] text-center text-primary">Élévation</TableHead>
                                <TableHead className="font-black uppercase text-[9px] text-center text-accent">Dérive</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {resultsTable.map((res, idx) => (
                                <TableRow key={idx} className="hover:bg-primary/5 transition-colors h-14">
                                    <TableCell className="font-black text-center text-sm">{res.dist}m</TableCell>
                                    <TableCell className="font-bold text-center text-slate-600">{res.dropCm} cm</TableCell>
                                    <TableCell className="font-bold text-center text-accent/70">{res.driftCm} cm</TableCell>
                                    <TableCell className="text-center">
                                        <div className={cn("inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[70px] justify-center", res.clicks > 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                                            <div className="flex items-center gap-1 font-black text-[10px]">{res.elevationDir === 'HAUT' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />} {res.clicks} CLICS</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className={cn("inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[70px] justify-center", res.driftClicks > 0 ? "bg-accent text-white" : "bg-slate-100 text-slate-400")}>
                                            <div className="flex items-center gap-1 font-black text-[10px]">{res.driftDir === 'GAUCHE' ? <ArrowLeft className="size-2.5" /> : <ArrowRight className="size-2.5" />} {res.driftClicks} CLICS</div>
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
              <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert className="size-10 text-primary" /></div>
              <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-1">Sécurité & Balistique</AlertTitle>
              <AlertDescription className="text-[9px] leading-relaxed italic text-slate-300 font-medium">Simulation théorique G1. Les conditions réelles (altitude, humidité) influent sur la précision. {selectedCaliber.includes('.410') ? 'Le .410 demande une grande précision due à sa faible charge.' : 'Vérifiez toujours votre réglage sur cible avant de chasser.'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
