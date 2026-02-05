'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Flower2, 
  Trash2, 
  BrainCircuit, 
  Droplets, 
  Sun, 
  Scissors, 
  Zap, 
  Plus, 
  Sparkles,
  RefreshCw,
  Check,
  ClipboardList,
  AlertTriangle,
  CalendarCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPersonalizedGardenAdvice } from '@/ai/flows/garden-advice-flow';
import { getGardenSuggestions } from '@/ai/flows/garden-suggestions-flow';
import { refinePlantInput } from '@/ai/flows/refine-plant-flow';
import { getGardenGlobalSummary, type GardenGlobalSummaryOutput } from '@/ai/flows/garden-global-summary-flow';
import type { GardenAdviceOutput } from '@/ai/flows/garden-advice-flow';
import type { LocationData, GardenPlant } from '@/lib/types';
import { useLocation } from '@/context/location-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const CATEGORIES = ["Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre"] as const;

const COMMON_PLANTS = [
  { name: "Citronnier", category: "Arbre Fruitier" },
  { name: "Manguier", category: "Arbre Fruitier" },
  { name: "Avocatier", category: "Arbre Fruitier" },
  { name: "Mandarinier", category: "Arbre Fruitier" },
  { name: "Papayer", category: "Arbre Fruitier" },
  { name: "Bananier", category: "Arbre Fruitier" },
  { name: "Cocotier", category: "Arbre Fruitier" },
  { name: "Hibiscus", category: "Fleur" },
  { name: "Bougainvillier", category: "Fleur" },
  { name: "Frangipanier", category: "Fleur" },
  { name: "Tomate", category: "Potager" },
  { name: "Piment", category: "Potager" },
  { name: "Manioc", category: "Potager" },
  { name: "Basilic", category: "Aromatique" },
  { name: "Menthe", category: "Aromatique" },
];

export function GardenManager({ locationData }: { locationData: LocationData }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedLocation } = useLocation();
  
  const [isAdding, setIsAdding] = useState(false);
  const [plantName, setPlantName] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number] | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [correctedName, setCorrectedName] = useState<string | null>(null);
  
  const [adviceCache, setAdviceCache] = useState<Record<string, GardenAdviceOutput>>({});
  const [loadingAdvice, setLoadingAdvice] = useState<Record<string, boolean>>({});

  const [globalSummary, setGlobalSummary] = useState<GardenGlobalSummaryOutput | null>(null);
  const [isGeneratingGlobal, setIsGeneratingGlobal] = useState(false);

  // Charger le cache du téléphone au démarrage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lb_garden_advice_cache_v3');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setAdviceCache(parsed.individual || {});
          setGlobalSummary(parsed.global || null);
        } catch (e) {
          console.error("Failed to parse garden cache", e);
        }
      }
    }
  }, []);

  // Sauvegarder le cache quand il change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lb_garden_advice_cache_v3', JSON.stringify({
        individual: adviceCache,
        global: globalSummary
      }));
    }
  }, [adviceCache, globalSummary]);

  useEffect(() => {
    const found = COMMON_PLANTS.find(p => p.name.toLowerCase() === plantName.toLowerCase());
    if (found && !category) {
      setCategory(found.category as any);
    }
  }, [plantName, category]);

  const plantsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'garden_plants'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: plants, isLoading: arePlantsLoading } = useCollection<GardenPlant>(plantsRef);

  const handleAiSuggest = async () => {
    if (!plantName.trim() || plantName.trim().length < 2) {
        setIsSuggesting(true);
        setAiSuggestions([]);
        setCorrectedName(null);
        try {
            const month = format(new Date(), 'MMMM', { locale: fr });
            const suggestions = await getGardenSuggestions(month);
            setAiSuggestions(suggestions.map(s => s.name));
            toast({ title: "Suggestions du mois" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur IA" });
        } finally {
            setIsSuggesting(false);
        }
        return;
    }

    setIsSuggesting(true);
    setAiSuggestions([]);
    setCorrectedName(null);
    try {
      const result = await refinePlantInput({ query: plantName });
      
      if (result.correctedName.toLowerCase() !== plantName.toLowerCase()) {
        setCorrectedName(result.correctedName);
      }
      
      setCategory(result.category);
      setAiSuggestions(result.varieties);
      toast({ title: "Analyse terminée" });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur IA" });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSelectSuggestion = (name: string) => {
    setPlantName(name);
    setAiSuggestions([]);
    setCorrectedName(null);
  };

  const handleApplyCorrection = () => {
    if (correctedName) {
      setPlantName(correctedName);
      setCorrectedName(null);
    }
  };

  const handleAddPlant = async () => {
    if (!user || !firestore || !plantName || !category) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'users', user.uid, 'garden_plants'), {
        userId: user.uid,
        name: plantName,
        category,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Plante ajoutée !' });
      setPlantName('');
      setCategory("");
      setAiSuggestions([]);
      setCorrectedName(null);
      setIsAdding(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'garden_plants', id));
      
      // Nettoyer le cache local
      const newCache = { ...adviceCache };
      delete newCache[id];
      setAdviceCache(newCache);
      
      toast({ title: 'Plante retirée' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur' });
    }
  };

  const fetchAdvice = async (plant: GardenPlant, forceRefresh = false) => {
    if (!forceRefresh && adviceCache[plant.id]) return;

    setLoadingAdvice(prev => ({ ...prev, [plant.id]: true }));
    try {
      const advice = await getPersonalizedGardenAdvice({
        plantName: plant.name,
        category: plant.category,
        location: selectedLocation,
        temperature: locationData.weather.temp,
        rain: locationData.weather.rain,
        lunarPhase: locationData.farming.lunarPhase,
        zodiac: locationData.farming.zodiac
      });
      
      setAdviceCache(prev => ({ ...prev, [plant.id]: advice }));
      
      if (forceRefresh) {
        toast({ title: "Conseils mis à jour" });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur IA" });
    } finally {
      setLoadingAdvice(prev => ({ ...prev, [plant.id]: false }));
    }
  };

  const handleGenerateGlobalSummary = async () => {
    if (!plants || plants.length === 0) return;
    setIsGeneratingGlobal(true);
    try {
      const summary = await getGardenGlobalSummary({
        location: selectedLocation,
        date: format(new Date(), 'eeee d MMMM yyyy', { locale: fr }),
        weather: {
          temp: locationData.weather.temp,
          rain: locationData.weather.rain,
        },
        lunarContext: {
          phase: locationData.farming.lunarPhase,
          zodiac: locationData.farming.zodiac,
        },
        plants: plants.map(p => ({
          name: p.name,
          category: p.category,
          individualAdvice: adviceCache[p.id]
        })),
      });
      setGlobalSummary(summary);
      toast({ title: "Bilan généré !" });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur génération bilan" });
    } finally {
      setIsGeneratingGlobal(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><Flower2 className="size-5" /></div>
              <div>
                <CardTitle className="text-lg font-black uppercase">Mon Jardin</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Inventaire et entretien</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setIsAdding(!isAdding)} className="font-black h-8 uppercase text-[10px] tracking-widest">
              {isAdding ? 'Annuler' : <><Plus className="mr-1 size-3" /> Ajouter</>}
            </Button>
          </div>
        </CardHeader>
        {isAdding && (
          <CardContent className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase opacity-60">Saisir le nom de la plante</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ex: Citronier, Manguier..." 
                    value={plantName} 
                    onChange={e => setPlantName(e.target.value)} 
                    className="h-12 border-2 font-bold" 
                  />
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-12 w-12 shrink-0 border-2" 
                    onClick={handleAiSuggest}
                    disabled={isSuggesting}
                  >
                    <BrainCircuit className={cn("size-5", isSuggesting && "animate-pulse text-primary")} />
                  </Button>
                </div>
              </div>

              {correctedName && (
                <div className="p-3 bg-blue-50 border-2 border-blue-100 rounded-xl flex items-center justify-between animate-in zoom-in-95">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase text-blue-600">Correction suggérée :</p>
                    <p className="text-sm font-black">{correctedName}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-[10px] font-black uppercase border-blue-200" 
                    onClick={handleApplyCorrection}
                  >
                    <Check className="size-3 mr-1" /> Appliquer
                  </Button>
                </div>
              )}

              {aiSuggestions.length > 0 && (
                <div className="space-y-2 p-4 bg-white border-2 rounded-2xl animate-in slide-in-from-right-2">
                  <p className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                    <Sparkles className="size-3" /> Variétés conseillées (NC) :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.map((name, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary hover:text-white transition-all py-1.5 px-3 text-[10px] font-bold uppercase border-2 border-transparent hover:scale-105"
                        onClick={() => handleSelectSuggestion(name)}
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase opacity-60">Catégorie</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger className="h-12 border-2"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPlant} disabled={isSaving || !plantName || !category} className="w-full font-black uppercase h-14 shadow-lg text-sm tracking-widest">
                {isSaving ? "Enregistrement..." : "Enregistrer au jardin"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* BILAN DU JOUR - GLOBAL SUMMARY SECTION */}
      {plants && plants.length > 0 && (
        <Card className="border-2 border-accent/20 bg-accent/5 overflow-hidden">
          <CardHeader className="p-4 bg-accent/10 border-b border-accent/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent text-white rounded-lg shadow-sm"><ClipboardList className="size-5" /></div>
                <div>
                  <CardTitle className="text-base font-black uppercase tracking-tight">Bilan Stratégique du Jour</CardTitle>
                  <CardDescription className="text-[9px] font-bold uppercase opacity-60">Synthèse intelligente de votre jardin</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleGenerateGlobalSummary} 
                disabled={isGeneratingGlobal}
                className="h-10 px-4 font-black uppercase text-[10px] tracking-widest bg-white border-2 border-accent/20 hover:bg-accent hover:text-white transition-all shadow-sm"
              >
                {isGeneratingGlobal ? <RefreshCw className="size-4 animate-spin" /> : <><Sparkles className="mr-2 size-4" /> Générer le bilan</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!globalSummary ? (
              <div className="p-8 text-center space-y-3">
                <BrainCircuit className="size-10 mx-auto text-accent/30" />
                <p className="text-[11px] font-bold text-muted-foreground uppercase leading-relaxed max-w-[200px] mx-auto">
                  L'IA peut analyser l'ensemble de votre jardin pour vous donner un plan d'action aujourd'hui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-accent/10 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 space-y-2 bg-white/50">
                  <p className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2"><Zap className="size-3" /> Plan d'action prioritaires</p>
                  <p className="text-sm font-bold leading-relaxed text-slate-700 italic">"{globalSummary.globalPlan}"</p>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><Droplets className="size-3" /> Arrosage par groupes</p>
                  <div className="grid gap-2">
                    {globalSummary.wateringGroups.map((group, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 p-2 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-black text-[9px] uppercase">{group.type}</Badge>
                        <span className="text-[11px] font-medium text-slate-600">{group.plantNames.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {globalSummary.maintenanceAlerts.length > 0 && (
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-2"><Scissors className="size-3" /> Alertes Maintenance</p>
                    <div className="space-y-2">
                      {globalSummary.maintenanceAlerts.map((alert, idx) => (
                        <div key={idx} className={cn(
                          "p-3 rounded-xl border flex gap-3 shadow-sm",
                          alert.priority === 'Haute' ? "bg-red-50 border-red-100" : "bg-white border-orange-100"
                        )}>
                          <AlertTriangle className={cn("size-4 shrink-0", alert.priority === 'Haute' ? "text-red-600" : "text-orange-500")} />
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-black uppercase tracking-tight">{alert.action}</p>
                            <p className="text-[10px] font-medium text-muted-foreground">{alert.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {globalSummary.milestones.length > 0 && (
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase text-green-600 tracking-widest flex items-center gap-2"><CalendarCheck className="size-3" /> Événements à venir</p>
                    <ul className="grid gap-1.5">
                      {globalSummary.milestones.map((m, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[11px] font-bold text-green-800 bg-green-50/50 p-2 rounded-lg">
                          <Check className="size-3 mt-0.5 text-green-600 shrink-0" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PLANTS LIST */}
      <div className="space-y-3">
        {arePlantsLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : plants && plants.length > 0 ? (
          <div className="grid gap-3">
            {plants.map((plant) => (
              <Card key={plant.id} className="overflow-hidden border-2 shadow-sm">
                <Accordion type="single" collapsible onValueChange={(val) => val === plant.id && fetchAdvice(plant)}>
                  <AccordionItem value={plant.id} className="border-none">
                    <div className="flex items-center w-full">
                      <AccordionTrigger className="flex-1 p-4 hover:no-underline [&[data-state=open]]:bg-muted/30">
                        <div className="flex items-center gap-4 text-left">
                          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10">
                            <Flower2 className="size-6 text-primary" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-black uppercase tracking-tight text-sm truncate">{plant.name}</h4>
                            <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4 mt-1 opacity-60">{plant.category}</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center pr-3 gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => fetchAdvice(plant, true)} 
                          className="size-8 text-primary/40 hover:text-primary hover:bg-primary/10 rounded-full"
                          title="Rafraîchir les conseils"
                        >
                          <RefreshCw className={cn("size-4", loadingAdvice[plant.id] && "animate-spin")} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(plant.id)} 
                          className="size-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-full"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <AccordionContent className="p-0 border-t border-dashed">
                      <div className="p-4 space-y-6 bg-muted/5">
                        {loadingAdvice[plant.id] ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <BrainCircuit className="size-8 text-primary animate-pulse" />
                            <p className="text-[10px] font-black uppercase animate-pulse">L'IA analyse votre jardin...</p>
                          </div>
                        ) : adviceCache[plant.id] ? (
                          <div className="space-y-6 animate-in fade-in">
                            <div className="flex gap-4 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl shadow-sm">
                              <div className="p-2 bg-blue-600 text-white rounded-xl h-fit shadow-md"><Droplets className="size-5" /></div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Arrosage du jour</p>
                                <p className="text-sm font-black text-blue-900">{adviceCache[plant.id].watering.quantity}</p>
                                <p className="text-xs font-medium leading-relaxed text-blue-800/80 italic">"{adviceCache[plant.id].watering.advice}"</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                                <Scissors className="size-3 text-orange-500" /> Guide de Taille & Entretien
                              </h5>
                              <div className="p-4 bg-white border-2 rounded-2xl space-y-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant={adviceCache[plant.id].maintenance.shouldPrune ? 'default' : 'secondary'} className="text-[9px] font-black h-5 uppercase">
                                    {adviceCache[plant.id].maintenance.shouldPrune ? 'Taille Recommandée' : 'Taille déconseillée'}
                                  </Badge>
                                  <span className="text-[9px] font-bold text-muted-foreground">Lune {locationData.farming.lunarPhase === 'Lune Descendante' ? '↘' : '↗'}</span>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-medium leading-relaxed text-slate-700 bg-muted/30 p-3 rounded-xl border border-dashed">
                                    {adviceCache[plant.id].maintenance.pruningGuide}
                                  </p>
                                </div>
                                <div className="flex items-start gap-3 pt-2 border-t border-dashed">
                                  <Zap className="size-4 text-yellow-500 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground">Nutrition & Boost</p>
                                    <p className="text-xs font-medium leading-relaxed">{adviceCache[plant.id].maintenance.boosterAdvice}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-indigo-800"><Sparkles className="size-4" /><span className="text-[9px] font-black uppercase">Rendement NC</span></div>
                                <p className="text-[11px] font-medium leading-relaxed text-indigo-900">{adviceCache[plant.id].milestones.yieldTips}</p>
                              </div>
                              <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-green-800"><Sun className="size-4" /><span className="text-[9px] font-black uppercase">Étape Suivante</span></div>
                                <p className="text-[11px] font-black text-green-900 uppercase tracking-tighter">{adviceCache[plant.id].milestones.flowering}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-xs italic opacity-40 py-4">Cliquez pour analyser...</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-3xl opacity-40">
            <Flower2 className="size-12 mx-auto mb-3" />
            <p className="font-black uppercase tracking-widest text-xs">Votre jardin est vide</p>
            <Button variant="link" onClick={() => setIsAdding(true)} className="text-[10px] font-bold uppercase mt-2">Enregistrer ma première plante</Button>
          </div>
        )}
      </div>
    </div>
  );
}
