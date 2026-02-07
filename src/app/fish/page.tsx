
'use client';

import { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import type { FishSpeciesInfo, FishCommuneStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Camera, 
  Fish, 
  AlertTriangle, 
  ChefHat, 
  Target, 
  Sparkles, 
  BrainCircuit, 
  X, 
  ExternalLink, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Megaphone, 
  Info, 
  RefreshCw,
  Save,
  Navigation,
  LocateFixed,
  Ruler
} from 'lucide-react';
import { identifyFish } from '@/ai/flows/identify-fish-flow';
import type { IdentifyFishOutput } from '@/ai/schemas';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, orderBy, query, doc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from '@/context/location-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const CIGUATERA_GUIDE_URL = "https://coastfish.spc.int/fr/component/content/article/340-ciguatera-field-reference-guide.html";

export default function FishPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { selectedLocation } = useLocation();
  const [search, setSearch] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [aiResult, setAiResult] = useState<IdentifyFishOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats Reporting States
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedFishForReport, setSelectedFishForReport] = useState<FishSpeciesInfo | null>(null);
  const [userRiskValue, setUserRiskValue] = useState(50);
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Fetch dynamic fish species from Firestore
  const fishSpeciesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'fish_species'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: dbFishSpecies, isLoading } = useCollection<FishSpeciesInfo>(fishSpeciesRef);

  const filteredFish = dbFishSpecies?.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.scientificName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIdentifying(true);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await identifyFish({ photoDataUri: base64 });
        setAiResult(result);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        console.error(error);
        toast({ 
          variant: 'destructive', 
          title: "Erreur d'analyse", 
          description: "L'IA n'a pas pu traiter l'image." 
        });
      } finally {
        setIsIdentifying(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenReport = (fish: FishSpeciesInfo) => {
    if (!user) {
      toast({ variant: 'destructive', title: "Connexion requise", description: "Veuillez vous connecter pour signaler un cas." });
      return;
    }
    setSelectedFishForReport(fish);
    setIsReportDialogOpen(true);
  };

  const submitReport = async () => {
    if (!user || !firestore || !selectedFishForReport || !selectedLocation) return;
    setIsSubmittingReport(true);

    try {
      const statsRef = doc(firestore, 'fish_species', selectedFishForReport.id, 'commune_stats', selectedLocation);
      const statsSnap = await getDoc(statsRef);
      
      const currentStats = statsSnap.exists() ? statsSnap.data() as FishCommuneStats : { somme_des_notes: 0, nombre_de_votants: 0 };
      
      // Mise à jour globale
      const newVoterCount = currentStats.nombre_de_votants + 1;
      const newTotalScore = currentStats.somme_des_notes + userRiskValue;
      const newAverage = parseFloat((newTotalScore / newVoterCount).toFixed(1));

      // Mise à jour spécifique par taille
      const sizeSumKey = `${selectedSize}_sum` as keyof FishCommuneStats;
      const sizeCountKey = `${selectedSize}_count` as keyof FishCommuneStats;
      const newSizeSum = (currentStats[sizeSumKey] as number || 0) + userRiskValue;
      const newSizeCount = (currentStats[sizeCountKey] as number || 0) + 1;

      await setDoc(statsRef, {
        id: selectedLocation,
        somme_des_notes: newTotalScore,
        nombre_de_votants: newVoterCount,
        moyenne_calculee: newAverage,
        dernier_update: serverTimestamp(),
        [sizeSumKey]: newSizeSum,
        [sizeCountKey]: newSizeCount
      }, { merge: true });

      toast({ title: "Merci pour votre signalement !", description: "Les statistiques de la commune ont été mises à jour." });
      setIsReportDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible d'enregistrer le signalement." });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
            <Fish className="text-primary size-6" /> Guide des Poissons NC
          </CardTitle>
          <CardDescription className="text-[10px] font-medium leading-tight">
            Identifiez une prise par photo (IA) ou recherchez une espèce.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3">
        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="h-14 text-base font-black uppercase tracking-widest shadow-lg gap-3 bg-primary hover:bg-primary/90"
          disabled={isIdentifying}
        >
          {isIdentifying ? <BrainCircuit className="size-6 animate-pulse" /> : <Camera className="size-6" />}
          {isIdentifying ? "Analyse..." : "Prendre en Photo (IA)"}
        </Button>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par nom..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-10 h-11 border-2 text-sm" 
          />
        </div>
      </div>

      {aiResult && (
        <Card className="border-2 border-primary bg-primary/5 animate-in fade-in slide-in-from-top-4 overflow-hidden relative shadow-lg">
          <button onClick={() => setAiResult(null)} className="absolute top-2 right-2 p-1 bg-primary/10 rounded-full text-primary z-10"><X className="size-4" /></button>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="size-4 text-primary" /><Badge variant="default" className="text-[10px] font-black uppercase">Résultat IA</Badge></div>
            <CardTitle className="text-xl font-black uppercase text-primary leading-none">{aiResult.name}</CardTitle>
            <CardDescription className="italic font-medium">{aiResult.scientificName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-white/80 rounded-lg border space-y-2">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-muted-foreground">Risque de Gratte</span><span className={cn("text-xs font-black", aiResult.gratteRisk > 30 ? "text-red-600" : "text-green-600")}>{aiResult.gratteRisk}%</span></div>
              <Progress value={aiResult.gratteRisk} className={cn("h-2", aiResult.gratteRisk > 30 ? "bg-red-100" : "bg-green-100")} />
              <div className="pt-1 flex justify-center">
                <a 
                  href={CIGUATERA_GUIDE_URL} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[9px] font-black uppercase text-primary underline flex items-center gap-1 hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="size-2" /> lien vers guide_pratique_ciguatera
                </a>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3"><div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0"><Target className="size-4" /></div><div className="space-y-0.5"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pêche</p><p className="text-xs font-medium">{aiResult.fishingAdvice}</p></div></div>
              <div className="flex items-start gap-3"><div className="p-2 bg-accent/10 rounded-lg text-accent shrink-0"><ChefHat className="size-4" /></div><div className="space-y-0.5"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuisine</p><p className="text-xs font-medium">{aiResult.culinaryAdvice}</p></div></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Fish className="size-3" /> Espèces Répertoriées ({filteredFish.length})
        </h3>
        
        <div className="grid gap-2">
          {isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />) : filteredFish.map((fish) => (
            <FishCard key={fish.id} fish={fish} selectedLocation={selectedLocation} onReport={handleOpenReport} />
          ))}
        </div>
      </div>

      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2">
              <Megaphone className="size-5 text-accent" /> Signaler Gratte
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">
              {selectedFishForReport?.name} à {selectedLocation}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <Ruler className="size-3" /> Taille du spécimen
              </Label>
              <RadioGroup value={selectedSize} onValueChange={(v: any) => setSelectedSize(v)} className="grid grid-cols-3 gap-2">
                <div>
                  <RadioGroupItem value="small" id="size-small" className="peer sr-only" />
                  <Label htmlFor="size-small" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                    <span className="text-[10px] font-black uppercase">Petit</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="medium" id="size-medium" className="peer sr-only" />
                  <Label htmlFor="size-medium" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                    <span className="text-[10px] font-black uppercase">Moyen</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="large" id="size-large" className="peer sr-only" />
                  <Label htmlFor="size-large" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                    <span className="text-[10px] font-black uppercase">Grand</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase opacity-60">Risque constaté / ressenti</Label>
                <span className={cn("text-lg font-black", userRiskValue > 50 ? "text-red-600" : "text-green-600")}>{userRiskValue}%</span>
              </div>
              <Slider 
                value={[userRiskValue]} 
                min={0} max={100} step={1} 
                onValueChange={(v) => setUserRiskValue(v[0])} 
              />
              <div className="flex justify-between text-[8px] font-black uppercase opacity-40">
                <span>Faible</span>
                <span>Critique</span>
              </div>
            </div>
            <Alert className="bg-muted/30 border-dashed border-2">
              <Info className="size-4" />
              <AlertDescription className="text-[10px] leading-relaxed font-medium">
                Votre contribution aide la communauté à identifier les zones à risque en temps réel. Merci de votre honnêteté.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              className="w-full h-14 font-black uppercase tracking-widest shadow-lg gap-2"
              onClick={submitReport}
              disabled={isSubmittingReport}
            >
              {isSubmittingReport ? <RefreshCw className="size-5 animate-spin" /> : <Save className="size-5" />}
              Envoyer mon signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FishCard({ fish, selectedLocation, onReport }: { fish: FishSpeciesInfo, selectedLocation: string, onReport: (f: FishSpeciesInfo) => void }) {
  const firestore = useFirestore();
  const finalImageUrl = fish.imageUrl || (fish.imagePlaceholder ? `https://picsum.photos/seed/${fish.imagePlaceholder}/400/400` : '');

  const statsRef = useMemoFirebase(() => {
    if (!firestore || !selectedLocation) return null;
    return doc(firestore, 'fish_species', fish.id, 'commune_stats', selectedLocation);
  }, [firestore, fish.id, selectedLocation]);

  const { data: stats } = useDoc<FishCommuneStats>(statsRef);

  const getIndiceConfiance = (score: number) => {
    if (score <= 10) return { label: 'Élevé', color: 'text-green-600', dot: '🟢' };
    if (score <= 30) return { label: 'Modéré', color: 'text-orange-500', dot: '🟠' };
    return { label: 'Faible', color: 'text-red-600', dot: '🔴' };
  };

  const calculateFinalScore = (admin: number, sizeKey: 'small' | 'medium' | 'large') => {
    const sum = stats?.[`${sizeKey}_sum` as keyof FishCommuneStats] as number || 0;
    const count = stats?.[`${sizeKey}_count` as keyof FishCommuneStats] as number || 0;
    const localAvg = count > 0 ? sum / count : admin;
    return parseFloat(((admin + localAvg) / 2).toFixed(1));
  };

  const risksBySize = [
    { label: 'Petit', admin: fish.gratteRiskSmall || 0, final: calculateFinalScore(fish.gratteRiskSmall || 0, 'small') },
    { label: 'Moyen', admin: fish.gratteRiskMedium || 0, final: calculateFinalScore(fish.gratteRiskMedium || 0, 'medium') },
    { label: 'Grand', admin: fish.gratteRiskLarge || 0, final: calculateFinalScore(fish.gratteRiskLarge || 0, 'large') },
  ];

  // Le score affiché sur le badge principal est celui du spécimen "Moyen"
  const mainScore = risksBySize[1].final;
  const confidence = getIndiceConfiance(mainScore);

  return (
    <Card className="overflow-hidden border-2 hover:border-primary/30 transition-all shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value={fish.id} className="border-none">
          <AccordionTrigger className="p-3 hover:no-underline [&[data-state=open]]:bg-muted/30">
            <div className="flex items-center gap-3 text-left w-full overflow-hidden">
              <div className="size-16 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden border shadow-sm">
                {finalImageUrl ? (
                  <Image 
                    src={finalImageUrl} 
                    alt={fish.name} 
                    width={64} 
                    height={64} 
                    className="object-contain w-full h-full p-1"
                    data-ai-hint="fish photo"
                  />
                ) : <Fish className="size-6 text-primary/40" />}
              </div>
              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <h4 className="font-black uppercase tracking-tighter text-sm leading-none break-words pr-2">
                  {fish.name}
                </h4>
                <p className="text-[9px] text-muted-foreground italic truncate">
                  {fish.scientificName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={mainScore > 20 ? "destructive" : "outline"} 
                    className={cn(
                      "text-[7px] h-4 px-1.5 font-black uppercase tracking-tight", 
                      mainScore <= 20 && "border-green-500 text-green-600"
                    )}
                  >
                    Risque {mainScore}%
                  </Badge>
                  <Badge variant="outline" className="text-[7px] h-4 px-1.5 font-black uppercase opacity-60 border-muted-foreground/30">
                    {fish.category}
                  </Badge>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0 bg-muted/10 border-t border-dashed">
            <div className="p-4 space-y-6">
              <div className="bg-white border-2 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-muted-foreground">Indice de confiance (Moyen)</span>
                    <span className={cn("text-xs font-black uppercase", confidence.color)}>{confidence.dot} {confidence.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase text-muted-foreground">Moyenne Globale</span>
                    <p className="text-xl font-black text-slate-800 leading-none">{mainScore}%</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-center opacity-40">Analyse par taille de spécimen</p>
                  <div className="grid grid-cols-3 gap-2">
                    {risksBySize.map((risk) => (
                      <div key={risk.label} className="flex flex-col items-center gap-1.5 p-2 bg-muted/30 rounded-xl border">
                        <span className="text-[8px] font-black uppercase opacity-60">{risk.label}</span>
                        <div className="flex flex-col items-center">
                          <span className={cn("text-xs font-black", risk.final > 30 ? "text-red-600" : "text-green-600")}>{risk.final}%</span>
                          <span className="text-[7px] font-bold text-muted-foreground">Scien: {risk.admin}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[9px] leading-relaxed font-medium text-muted-foreground italic flex items-start gap-2">
                  <Megaphone className="size-3 shrink-0 mt-0.5 text-primary" />
                  <span>
                    Ce score a été ajusté par <strong>{stats?.nombre_de_votants || 0} pêcheur{ (stats?.nombre_de_votants || 0) > 1 ? 's' : ''}</strong> dans la commune de <strong>{selectedLocation}</strong>. Plus il y a de signalements par taille, plus la donnée est fiable.
                  </span>
                </p>

                <Button 
                  variant="outline" 
                  className="w-full h-10 border-2 font-black uppercase text-[9px] tracking-widest gap-2 bg-primary/5 hover:bg-primary/10"
                  onClick={() => onReport(fish)}
                >
                  <ThumbsDown className="size-3" /> Signaler un cas de gratte
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary"><Target className="size-3" /> Pêche</div>
                  <p className="text-xs font-medium leading-relaxed">{fish.fishingAdvice}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-accent"><ChefHat className="size-3" /> Cuisine</div>
                  <p className="text-xs font-medium leading-relaxed">{fish.culinaryAdvice}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/50 flex flex-col gap-3">
                <div className="flex justify-center">
                  <a 
                    href={CIGUATERA_GUIDE_URL} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[9px] font-black uppercase text-primary underline flex items-center gap-1 hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="size-2" /> lien vers guide_pratique_ciguatera
                  </a>
                </div>
                {mainScore > 30 && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-800">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold leading-tight">Attention : Risque de ciguatera élevé. La consommation de gros spécimens est déconseillée.</p>
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
