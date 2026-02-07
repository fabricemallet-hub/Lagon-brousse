'use client';

import { useState, useMemo, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { semisData } from '@/lib/semis-data';
import {
  Sun,
  Droplets,
  Flower,
  Bug,
  BookHeart,
  Calendar,
  Wheat,
  MapPin,
  BookText,
  Plus,
  BrainCircuit,
  Search,
  Sprout,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Shovel,
  Info,
  Camera,
  X,
  Zap,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getGardeningAdvice } from '@/ai/flows/gardening-flow';
import { identifyPlant } from '@/ai/flows/identify-plant-flow';
import { useLocation } from '@/context/location-context';
import { generateProceduralData, getDataForDate } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { GardeningAdviceOutput } from '@/ai/schemas';
import type { IdentifyPlantOutput } from '@/ai/flows/identify-plant-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoonPhaseIcon } from '@/components/ui/lunar-calendar';

function AdviceDetail({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ElementType;
  title: string;
  content: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-5 text-primary mt-1 flex-shrink-0" />
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

export default function SemisPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedLocation } = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState<string | null>(null);
  const [customVeg, setCustomVeg] = useState('');
  const [sowingDate, setSowingDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<GardeningAdviceOutput | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [idResult, setIdResult] = useState<IdentifyPlantOutput | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const todayData = useMemo(() => getDataForDate(selectedLocation, new Date()), [selectedLocation]);
  
  const topSeedsForToday = useMemo(() => {
    const { lunarPhase, zodiac } = todayData.farming;
    return semisData.filter(veg => {
      if (zodiac === 'Fruits') return lunarPhase === 'Lune Montante';
      if (zodiac === 'Racines') return lunarPhase === 'Lune Descendante';
      if (zodiac === 'Fleurs') return lunarPhase === 'Lune Montante';
      if (zodiac === 'Feuilles') return lunarPhase === 'Lune Montante';
      return false;
    }).slice(0, 3);
  }, [todayData]);

  const filteredData = semisData.filter(veg => 
    veg.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsIdentifying(true);
    setIdResult(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await identifyPlant({ photoDataUri: base64 });
        setIdResult(result);
      } catch (error) {
        toast({ variant: 'destructive', title: "Erreur d'analyse", description: "L'IA n'a pas pu identifier la photo." });
      } finally {
        setIsIdentifying(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const getUpcomingGardeningCalendar = (location: string, startDate: Date, days: number = 30) => {
    const schedule = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const data = generateProceduralData(location, d);
      schedule.push({
        date: format(d, 'yyyy-MM-dd'),
        phase: data.farming.lunarPhase,
        zodiac: data.farming.zodiac
      });
    }
    return schedule.map(s => `- ${s.date} : ${s.phase}, Jour ${s.zodiac}`).join('\n');
  };

  const handleStartAnalysis = async () => {
    const plantName = selectedVeg === 'CUSTOM' ? customVeg : selectedVeg;
    if (!plantName) return;
    setIsAnalyzing(true);
    setAiAdvice(null);
    try {
      const dateObj = new Date(sowingDate);
      const locationData = getDataForDate(selectedLocation, dateObj);
      const upcomingCalendar = getUpcomingGardeningCalendar(selectedLocation, dateObj);
      const advice = await getGardeningAdvice({
        seedName: plantName,
        sowingDate: dateObj.toISOString(),
        lunarPhase: locationData.farming.lunarPhase,
        zodiacSign: locationData.farming.zodiac,
        upcomingCalendar
      });
      setAiAdvice(advice);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer les conseils IA.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmSowing = async () => {
    if (!user || !firestore || !aiAdvice) return;
    const plantName = selectedVeg === 'CUSTOM' ? customVeg : selectedVeg;
    if (!plantName) return;
    setIsSaving(true);
    try {
      const dateObj = new Date(sowingDate);
      const locationData = getDataForDate(selectedLocation, dateObj);
      await addDoc(collection(firestore, 'users', user.uid, 'sowings'), {
        userId: user.uid,
        seedName: plantName,
        sowingDate: dateObj.toISOString(),
        plantType: aiAdvice.plantType,
        cultureAdvice: aiAdvice.cultureAdvice,
        estimatedHarvestDate: aiAdvice.harvestDate,
        transplantingAdvice: aiAdvice.transplantingAdvice,
        moonWarning: aiAdvice.moonWarning,
        isValidForMoon: aiAdvice.isValidForMoon,
        lunarContext: {
          phase: locationData.farming.lunarPhase,
          zodiac: locationData.farming.zodiac
        },
        createdAt: serverTimestamp()
      });
      toast({ title: 'Semis enregistré !' });
      setIsPlanningOpen(false);
      setSelectedVeg(null);
      setCustomVeg('');
      setAiAdvice(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-32 w-full max-w-full overflow-x-hidden px-1">
      <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-black uppercase flex items-center gap-2 tracking-tighter"><Sprout className="size-6" /> Guide Culture IA</CardTitle>
          <CardDescription className="text-green-50/80 text-[10px] font-bold uppercase">Planification et identification intelligente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="flex flex-col flex-1 border-r border-white/10 pr-2">
              <span className="text-[8px] font-black uppercase opacity-60">Lune du jour</span>
              <div className="flex items-center gap-1.5">
                <MoonPhaseIcon phase={todayData.weather.moon.phase} className="size-3" />
                <span className="text-[10px] font-black">{todayData.weather.moon.phase}</span>
              </div>
            </div>
            <div className="flex flex-col flex-1 pl-2">
              <span className="text-[8px] font-black uppercase opacity-60">Influence</span>
              <div className="flex items-center gap-1.5">
                {todayData.farming.lunarPhase === 'Lune Montante' ? <TrendingUp className="size-3 text-emerald-300" /> : <TrendingDown className="size-3 text-emerald-200" />}
                <span className="text-[10px] font-black">Jour {todayData.farming.zodiac}</span>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-200" />
            <Input 
              placeholder="Rechercher une plante..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-emerald-100/50 pl-10 h-11 text-sm border-2"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button 
          variant="secondary" 
          className="w-full font-black uppercase h-14 text-sm tracking-tight shadow-md border-2 border-primary/20 gap-3"
          onClick={() => {
            if (topSeedsForToday.length > 0) {
              setSearchQuery(topSeedsForToday[0].name);
              toast({ title: "Analyse en cours", description: `Focus sur : ${topSeedsForToday[0].name}` });
            }
          }}
        >
          <BrainCircuit className="size-6 text-primary" />
          Que semer aujourd'hui ? (IA)
        </Button>

        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="h-14 text-base font-black uppercase tracking-widest shadow-lg gap-3 bg-primary hover:bg-primary/90"
          disabled={isIdentifying}
        >
          {isIdentifying ? <BrainCircuit className="size-6 animate-pulse" /> : <Camera className="size-6" />}
          {isIdentifying ? "Analyse..." : "Scanner via Gemini AI"}
        </Button>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>

      {idResult && (
        <Card className="border-2 border-primary bg-primary/5 animate-in fade-in slide-in-from-top-4 overflow-hidden relative shadow-xl">
          <button onClick={() => setIdResult(null)} className="absolute top-2 right-2 p-1 bg-primary/10 rounded-full text-primary z-10"><X className="size-4" /></button>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="size-4 text-primary" /><Badge variant="default" className="text-[10px] font-black uppercase">Résultat Scan IA</Badge></div>
            <CardTitle className="text-xl font-black uppercase text-primary leading-none">{idResult.name}</CardTitle>
            <CardDescription className="italic font-medium">{idResult.category}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {idResult.isActionRequired && (
              <div className="p-3 bg-red-100 border-2 border-red-200 rounded-xl flex gap-3 text-red-800 animate-pulse">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <p className="text-[10px] font-black uppercase leading-tight">Attention : Action urgente conseillée (Nuisible ou carence détectée).</p>
              </div>
            )}
            <div className="bg-white/80 p-4 rounded-xl border-2 space-y-3">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1"><Info className="size-3" /> Description</p>
                <p className="text-xs font-medium leading-relaxed italic">"{idResult.description}"</p>
              </div>
              <div className="space-y-1 pt-2 border-t border-dashed">
                <p className="text-[9px] font-black uppercase text-primary flex items-center gap-1"><Zap className="size-3" /> Conseil Expert NC</p>
                <p className="text-xs font-bold leading-relaxed">{idResult.advice}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full h-10 font-black uppercase text-[10px] border-2" onClick={() => { setSearchQuery(idResult.name); setIdResult(null); }}>Chercher dans le guide</Button>
          </CardContent>
        </Card>
      )}

      {!searchQuery && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
            <TrendingUp className="size-3 text-primary" /> Idéal pour aujourd'hui
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {topSeedsForToday.map(seed => (
              <Card key={seed.name} className="border-2 border-emerald-100 bg-emerald-50/30 overflow-hidden active:scale-[0.98] transition-all cursor-pointer" onClick={() => setSearchQuery(seed.name)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{seed.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-black uppercase text-xs tracking-tight">{seed.name}</span>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase">Période optimale</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-emerald-300" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {searchQuery && filteredData.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-4">
              <div className="p-4 bg-primary/10 rounded-full text-primary"><Sparkles className="size-8" /></div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg">Plante non répertoriée ?</h3>
                <p className="text-sm text-muted-foreground italic">L'IA peut créer une fiche personnalisée pour "{searchQuery}".</p>
              </div>
              <Button onClick={() => { setSelectedVeg('CUSTOM'); setCustomVeg(searchQuery); setIsPlanningOpen(true); }} className="font-black uppercase tracking-widest h-12 shadow-lg">Planifier avec l'IA</Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {filteredData.map((veg) => (
              <AccordionItem value={veg.name} key={veg.name} className="border-2 rounded-xl bg-card overflow-hidden shadow-sm">
                <AccordionTrigger className="text-lg hover:no-underline py-4 px-4">
                  <div className="flex items-center gap-4 text-left">
                    <span className="text-2xl">{veg.icon}</span>
                    <span className="font-black uppercase tracking-tight text-sm">{veg.name}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4 px-4 border-t border-dashed bg-muted/5">
                  <Button 
                    className="w-full font-black uppercase h-12 shadow-md gap-2" 
                    onClick={() => { setSelectedVeg(veg.name); setIsPlanningOpen(true); }}
                  >
                    <Plus className="size-4" /> Planifier ce semis
                  </Button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white border-2">
                    <AdviceDetail icon={Calendar} title="Saisons de Semis" content={`Chaud: ${veg.sowingSeasonWarm} | Frais: ${veg.sowingSeasonCool}`} />
                    <AdviceDetail icon={Wheat} title="Récolte" content={`Chaud: ${veg.harvestWarm} | Frais: ${veg.harvestCool}`} />
                  </div>

                  <div className="space-y-4 pt-2">
                    <AdviceDetail icon={MapPin} title="Plantation" content={veg.advice.plantingLocation} />
                    <AdviceDetail icon={Sun} title="Exposition" content={veg.advice.sunlight} />
                    <AdviceDetail icon={Droplets} title="Arrosage" content={veg.advice.watering} />
                    <AdviceDetail icon={BookHeart} title="Astuce du guide" content={veg.advice.grandmaRecipe} />
                  </div>
                </AccordionContent>
              </Accordion>
            ))}
          </Accordion>
        )}
      </div>

      <Card className="border-2 bg-muted/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><BookText className="size-4 text-primary" /> Lexique du Jardinier</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] text-accent">Engrais Vert</h4>
            <p className="text-[11px] font-medium leading-relaxed">Cultures comme la phacélie ou le trèfle, fauchées avant montée en graine pour enrichir le sol naturellement.</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPlanningOpen} onOpenChange={(open) => !open && setIsPlanningOpen(false)}>
        <DialogContent className="max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-lg rounded-2xl border-none">
          <DialogHeader className="p-6 pb-2 shrink-0 bg-slate-50 border-b">
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tighter">
              <Sprout className="text-primary shrink-0" /> Planifier : {selectedVeg === 'CUSTOM' ? customVeg : selectedVeg}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto min-h-0 touch-pan-y scrollbar-hide bg-slate-50/50">
            <div className="p-6 pt-4 space-y-6 pb-32">
              {!aiAdvice ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Date prévue</label>
                    <Input type="date" value={sowingDate} onChange={(e) => setSowingDate(e.target.value)} className="h-14 text-base border-2 font-black" />
                  </div>
                  <Button onClick={handleStartAnalysis} className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg" disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <><BrainCircuit className="mr-2 animate-pulse" /> Analyse en cours...</>
                    ) : (
                      <><BrainCircuit className="mr-2" /> Calculer la fiche IA</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in zoom-in-95 pb-10">
                  <div className={cn("p-4 rounded-2xl border-2 flex gap-3 shadow-sm", aiAdvice.isValidForMoon ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800")}>
                    {aiAdvice.isValidForMoon ? <CheckCircle2 className="size-6 text-green-600 shrink-0" /> : <AlertTriangle className="size-6 text-amber-600 shrink-0" />}
                    <div className="space-y-1">
                      <p className="font-black uppercase text-xs">{aiAdvice.isValidForMoon ? "Période idéale !" : "Date déconseillée"}</p>
                      <p className="text-[11px] leading-relaxed font-bold italic">"{aiAdvice.moonWarning}"</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border-2"><p className="text-[8px] font-black uppercase opacity-40">Catégorie</p><Badge variant="outline" className="mt-1 font-black text-[10px]">{aiAdvice.plantType}</Badge></div>
                    <div className="bg-white p-3 rounded-xl border-2"><p className="text-[8px] font-black uppercase opacity-40">Récolte prévue</p><p className="font-black text-xs mt-1 text-emerald-700">{aiAdvice.harvestDate}</p></div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border-2 space-y-4 shadow-inner">
                    <AdviceDetail icon={Sun} title="Culture & Exposition" content={aiAdvice.cultureAdvice} />
                    <AdviceDetail icon={Shovel} title="Repiquage" content={aiAdvice.transplantingAdvice} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-white border-t shrink-0 flex flex-row gap-2">
            {aiAdvice ? (
              <><Button variant="ghost" onClick={() => setAiAdvice(null)} className="flex-1 font-bold uppercase text-[10px] border-2">Modifier</Button><Button onClick={handleConfirmSowing} disabled={isSaving} className="flex-[2] font-black uppercase h-12 shadow-md">Enregistrer</Button></>
            ) : (
              <Button variant="outline" onClick={() => setIsPlanningOpen(false)} className="w-full font-black uppercase h-12 border-2">Annuler</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
