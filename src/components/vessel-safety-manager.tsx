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
        vesselName: newVesselName.trim(),
        equipment: [],
        createdAt: serverTimestamp()
      });
      setNewVesselName('');
      setIsAddingVessel(false);
      toast({ title: "Navire ajouté" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveVessel = async (vesselId: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'vessels_safety', vesselId));
      toast({ title: "Navire supprimé" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  const handleAddItem = async (vessel: UserVesselSafety) => {
    if (!user || !firestore || !newItemLabel.trim() || !newItemExpiry) return;
    setIsSaving(true);
    try {
      const item: SafetyItem = {
        id: Math.random().toString(36).substring(7),
        type: newItemType,
        label: newItemLabel.trim(),
        expiryDate: newItemExpiry
      };
      
      const vesselRef = doc(firestore, 'users', user.uid, 'vessels_safety', vessel.id);
      await updateDoc(vesselRef, {
        equipment: arrayUnion(item)
      });
      
      setNewItemLabel('');
      setNewItemExpiry('');
      setActiveVesselId(null);
      toast({ title: "Équipement ajouté" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur" });
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
      toast({ title: "Équipement retiré" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  const getExpiryStatus = (expiryDateStr: string) => {
    const expiryDate = parseISO(expiryDateStr);
    const today = new Date();
    const daysLeft = differenceInDays(expiryDate, today);
    
    if (daysLeft < 0) return { label: 'EXPIRÉ', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
    if (daysLeft < 90) return { label: `Expire dans ${daysLeft} j`, color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock };
    return { label: 'Conforme', color: 'text-green-600', bg: 'bg-green-50', icon: Check };
  };

  if (!user) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-amber-900">
          <ShieldCheck className="size-4" /> Mes Équipements de Sécurité
        </CardTitle>
        <CardDescription className="text-[10px] font-bold uppercase opacity-60">
          Suivez les dates de péremption de votre matériel.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid gap-3">
            {vessels?.map((vessel) => (
              <div key={vessel.id} className="bg-white border-2 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 bg-muted/10 border-b flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Ship className="size-4 text-primary" />
                    <span className="font-black uppercase text-xs">{vessel.vesselName}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive/40" onClick={() => handleRemoveVessel(vessel.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                
                <div className="p-3 space-y-2">
                  {vessel.equipment && vessel.equipment.length > 0 ? (
                    <div className="grid gap-2">
                      {vessel.equipment.map((item) => {
                        const status = getExpiryStatus(item.expiryDate);
                        const StatusIcon = status.icon;
                        return (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border-2 border-dashed">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-slate-800">{item.label}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-bold opacity-40 uppercase">Périme le {format(parseISO(item.expiryDate), 'dd/MM/yyyy')}</span>
                              </div>
                            </div>
                            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md", status.bg)}>
                              <StatusIcon className={cn("size-3", status.color)} />
                              <span className={cn("text-[8px] font-black uppercase", status.color)}>{status.label}</span>
                              <button onClick={() => handleRemoveItem(vessel, item)} className="ml-1 opacity-20 hover:opacity-100"><X className="size-3" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[9px] italic text-muted-foreground text-center py-2 uppercase font-bold opacity-40">Aucun équipement enregistré</p>
                  )}

                  {activeVesselId === vessel.id ? (
                    <div className="pt-2 border-t mt-3 space-y-3 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black uppercase opacity-60">Type</Label>
                          <Select value={newItemType} onValueChange={(v: any) => setNewItemType(v)}>
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fusée">Fusée</SelectItem>
                              <SelectItem value="extincteur">Extincteur</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black uppercase opacity-60">Label</Label>
                          <Input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)} placeholder="Ex: Fusée parachute" className="h-8 text-[9px] font-bold" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase opacity-60">Date de péremption</Label>
                        <Input type="date" value={newItemExpiry} onChange={e => setNewItemExpiry(e.target.value)} className="h-8 text-[9px] font-bold" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1 h-8 text-[9px] font-black uppercase" onClick={() => setActiveVesselId(null)}>Annuler</Button>
                        <Button size="sm" className="flex-[2] h-8 text-[9px] font-black uppercase" onClick={() => handleAddItem(vessel)} disabled={isSaving || !newItemLabel || !newItemExpiry}>Enregistrer l'item</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full h-8 border-dashed text-[9px] font-black uppercase gap-2" onClick={() => setActiveVesselId(vessel.id)}>
                      <Plus className="size-3" /> Ajouter un équipement
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {isAddingVessel ? (
              <div className="p-4 bg-white border-2 border-primary/20 rounded-xl space-y-3 animate-in slide-in-from-top-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase opacity-60">Nom du navire</Label>
                  <Input 
                    placeholder="Ex: Mon Bateau" 
                    value={newVesselName} 
                    onChange={e => setNewVesselName(e.target.value)} 
                    className="h-10 border-2 font-bold text-sm uppercase" 
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1 h-10 font-black uppercase text-[10px]" onClick={() => setIsAddingVessel(false)}>Annuler</Button>
                  <Button className="flex-1 h-10 font-black uppercase text-[10px]" onClick={handleAddVessel} disabled={isSaving || !newVesselName}>Créer le profil</Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setIsAddingVessel(true)} className="w-full h-12 border-2 border-dashed bg-background text-primary hover:bg-primary/5 font-black uppercase text-[10px] tracking-widest gap-2">
                <Plus className="size-4" /> Ajouter un Navire
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}