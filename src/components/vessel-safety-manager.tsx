'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Ship, Plus, Trash2, Clock, AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { UserVesselSafety, SafetyItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export function VesselSafetyManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isAddingVessel, setIsAddingVessel] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Pour l'ajout d'équipement
  const [activeVesselId, setActiveVesselId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<'fusée' | 'extincteur' | 'autre'>('fusée');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemExpiry, setNewItemExpiry] = useState('');

  const vesselsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'vessels_safety');
  }, [user, firestore]);

  const { data: vessels, isLoading } = useCollection<UserVesselSafety>(vesselsRef);

  const handleAddVessel = async () => {
    if (!user || !firestore || !newVesselName.trim()) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'users', user.uid, 'vessels_safety'), {
        userId: user.uid,
        vesselName: newVesselName.trim().toUpperCase(),
        equipment: [],
        createdAt: serverTimestamp()
      });
      setNewVesselName('');
      setIsAddingVessel(false);
      toast({ title: "NAVIRE AJOUTÉ" });
    } catch (e) {
      toast({ variant: 'destructive', title: "ERREUR" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveVessel = async (vesselId: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'vessels_safety', vesselId));
      toast({ title: "NAVIRE SUPPRIMÉ" });
    } catch (e) {
      toast({ variant: 'destructive', title: "ERREUR" });
    }
  };

  const handleAddItem = async (vessel: UserVesselSafety) => {
    if (!user || !firestore || !newItemLabel.trim() || !newItemExpiry) return;
    setIsSaving(true);
    try {
      const item: SafetyItem = {
        id: Math.random().toString(36).substring(7),
        type: newItemType,
        label: newItemLabel.trim().toUpperCase(),
        expiryDate: newItemExpiry
      };
      
      const vesselRef = doc(firestore, 'users', user.uid, 'vessels_safety', vessel.id);
      await updateDoc(vesselRef, {
        equipment: arrayUnion(item)
      });
      
      setNewItemLabel('');
      setNewItemExpiry('');
      setActiveVesselId(null);
      toast({ title: "ÉQUIPEMENT AJOUTÉ" });
    } catch (e) {
      toast({ variant: 'destructive', title: "ERREUR" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItem = async (vessel: UserVesselSafety, item: SafetyItem) => {
    if (!user || !firestore) return;
    try {
      const vesselRef = doc(firestore, 'users', user.uid, 'vessels_safety', vessel.id);
      await updateDoc(vesselRef, {
        equipment: arrayRemove(item)
      });
      toast({ title: "ÉQUIPEMENT RETIRÉ" });
    } catch (e) {
      toast({ variant: 'destructive', title: "ERREUR" });
    }
  };

  const getExpiryStatus = (expiryDateStr: string) => {
    const expiryDate = parseISO(expiryDateStr);
    const today = new Date();
    const daysLeft = differenceInDays(expiryDate, today);
    
    if (daysLeft < 0) return { label: 'EXPIRÉ', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
    if (daysLeft < 90) return { label: `EXPIRE DANS ${daysLeft} J`, color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock };
    return { label: 'CONFORME', color: 'text-green-600', bg: 'bg-green-50', icon: Check };
  };

  if (!user) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30 overflow-hidden shadow-none">
      <CardHeader className="p-4 pb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-start text-center sm:text-left">
          <div className="p-2.5 bg-amber-100 rounded-xl h-fit border border-amber-200 shrink-0">
            <ShieldCheck className="size-6 text-amber-900" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-black uppercase leading-tight tracking-tighter text-amber-900">
              Mes Équipements de Sécurité
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-60 leading-tight text-amber-800/70">
              Suivez les dates de péremption de votre matériel.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-6">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : (
          <div className="grid gap-4">
            {vessels?.map((vessel) => (
              <div key={vessel.id} className="bg-white border-2 border-amber-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-amber-50/50 border-b border-amber-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Ship className="size-4 text-primary shrink-0" />
                    <span className="font-black uppercase text-xs tracking-tight text-slate-800 truncate max-w-[150px]">{vessel.vesselName}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive/30 hover:text-destructive hover:bg-red-50 rounded-full" onClick={() => handleRemoveVessel(vessel.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                
                <div className="p-3 space-y-3">
                  {vessel.equipment && vessel.equipment.length > 0 ? (
                    <div className="grid gap-2">
                      {vessel.equipment.map((item) => {
                        const status = getExpiryStatus(item.expiryDate);
                        const StatusIcon = status.icon;
                        return (
                          <div key={item.id} className="flex flex-col gap-2 p-3 rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/30">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black uppercase text-slate-800 tracking-tight">{item.label}</span>
                                <span className="text-[9px] font-bold opacity-40 uppercase">Périme le {format(parseISO(item.expiryDate), 'dd/MM/yyyy')}</span>
                              </div>
                              <button onClick={() => handleRemoveItem(vessel, item)} className="opacity-20 hover:opacity-100 transition-opacity p-1"><X className="size-3.5" /></button>
                            </div>
                            <div className={cn("flex items-center justify-center gap-2 py-1.5 rounded-lg w-full", status.bg)}>
                              <StatusIcon className={cn("size-3.5", status.color)} />
                              <span className={cn("text-[10px] font-black uppercase tracking-tighter", status.color)}>{status.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/20">
                      <p className="text-[9px] italic text-muted-foreground uppercase font-black opacity-30 tracking-widest">Aucun équipement</p>
                    </div>
                  )}

                  {activeVesselId === vessel.id ? (
                    <div className="pt-4 border-t border-dashed border-slate-200 mt-2 space-y-4 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Type d'objet</Label>
                          <Select value={newItemType} onValueChange={(v: any) => setNewItemType(v)}>
                            <SelectTrigger className="h-10 text-[10px] font-black uppercase border-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fusée" className="text-[10px] font-black uppercase">Fusée parachute</SelectItem>
                              <SelectItem value="extincteur" className="text-[10px] font-black uppercase">Extincteur</SelectItem>
                              <SelectItem value="autre" className="text-[10px] font-black uppercase">Autre matériel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Libellé</Label>
                          <Input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)} placeholder="EX: FUSÉE ROUGE" className="h-10 border-2 font-black text-xs uppercase" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Date péremption</Label>
                          <Input type="date" value={newItemExpiry} onChange={e => setNewItemExpiry(e.target.value)} className="h-10 border-2 font-black text-xs" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1 h-10 font-black uppercase text-[9px] border-2" onClick={() => setActiveVesselId(null)}>Annuler</Button>
                        <Button className="flex-[1.5] h-10 font-black uppercase text-[9px] shadow-md" onClick={() => handleAddItem(vessel)} disabled={isSaving || !newItemLabel || !newItemExpiry}>Enregistrer</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full h-10 border-2 border-dashed bg-white text-primary hover:bg-primary/5 font-black uppercase text-[9px] tracking-tight gap-2 rounded-xl mt-1" onClick={() => setActiveVesselId(vessel.id)}>
                      <Plus className="size-3.5" /> Ajouter un équipement
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {isAddingVessel ? (
              <div className="p-5 bg-white border-2 border-primary/30 rounded-[2rem] space-y-5 shadow-xl animate-in zoom-in-95 duration-200">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-wider">Nom du navire</Label>
                  <Input 
                    placeholder="EX: MON BATEAU" 
                    value={newVesselName} 
                    onChange={e => setNewVesselName(e.target.value)} 
                    className="h-12 border-2 font-black text-base uppercase tracking-tight shadow-inner" 
                  />
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Button className="w-full h-12 font-black uppercase text-[10px] tracking-tight shadow-lg bg-primary hover:bg-primary/90" onClick={handleAddVessel} disabled={isSaving || !newVesselName}>
                    Créer le profil navire
                  </Button>
                  <Button variant="ghost" className="w-full h-10 font-black uppercase text-[9px] tracking-widest text-slate-400 hover:bg-slate-50" onClick={() => setIsAddingVessel(false)}>
                    Annuler l'ajout
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setIsAddingVessel(true)} 
                className="w-full h-16 border-4 border-dashed border-primary/20 bg-background text-primary hover:bg-primary/5 font-black uppercase text-[10px] tracking-tight gap-3 rounded-[2rem] shadow-sm transition-all active:scale-95 px-4"
              >
                <Ship className="size-5 shrink-0" /> Ajouter un nouveau navire
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
