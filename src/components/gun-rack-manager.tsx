
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Crosshair, Plus, Save, Trash2, Pencil, Target, ShieldCheck, RefreshCw, X, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Weapon } from '@/lib/types';
import { BALLISTIC_DATABASE, CALIBERS } from '@/lib/ballistics-db';

export function GunRackManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [customName, setCustomName] = useState('');
  const [brand, setBrand] = useState('');
  const [caliber, setCaliber] = useState(CALIBERS[0]);
  const [munitionId, setMunitionId] = useState('');
  const [weight, setWeight] = useState('');
  const [zeroDistance, setZeroDistance] = useState('100');
  const [clickValue, setClickValue] = useState<'1/4 MOA' | '0.1 MRAD'>('1/4 MOA');

  const weaponsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'weapons'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: weapons, isLoading } = useCollection<Weapon>(weaponsRef);

  const munitionsForCaliber = BALLISTIC_DATABASE.filter(m => m.caliber === caliber);

  // Auto-fill weight when munition is selected
  useEffect(() => {
    if (munitionId) {
      const munition = BALLISTIC_DATABASE.find(m => m.id === munitionId);
      if (munition) {
        setWeight(munition.weight.toString());
      }
    }
  }, [munitionId]);

  const resetForm = () => {
    setCustomName('');
    setBrand('');
    setCaliber(CALIBERS[0]);
    setMunitionId('');
    setWeight('');
    setZeroDistance('100');
    setClickValue('1/4 MOA');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEdit = (weapon: Weapon) => {
    setEditingId(weapon.id);
    setCustomName(weapon.customName);
    setBrand(weapon.brand);
    setCaliber(weapon.caliber);
    setMunitionId(weapon.munitionId);
    setWeight(weapon.weight.toString());
    setZeroDistance(weapon.zeroDistance);
    setClickValue(weapon.clickValue || '1/4 MOA');
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!user || !firestore || !customName || !caliber) return;
    setIsSaving(true);
    
    const data = {
      userId: user.uid,
      customName: customName.trim().toUpperCase(),
      brand: brand.trim().toUpperCase(),
      caliber,
      munitionId,
      weight: parseFloat(weight) || 0,
      zeroDistance,
      clickValue,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestore, 'users', user.uid, 'weapons', editingId), data);
        toast({ title: "Arme mise à jour !" });
      } else {
        await addDoc(collection(firestore, 'users', user.uid, 'weapons'), {
          ...data,
          createdAt: serverTimestamp()
        });
        toast({ title: "Arme ajoutée au râtelier !" });
      }
      resetForm();
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'weapons', id));
      toast({ title: "Arme retirée" });
    } catch (e) {}
  };

  if (!user) return null;

  const weightUnit = caliber.startsWith('Calibre') || caliber.includes('.410') ? 'g' : 'gr';

  return (
    <div className="space-y-6">
      <Card className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl overflow-hidden shadow-sm">
        <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-xl text-white shadow-md">
              <Crosshair className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">Mon Râtelier</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase opacity-60">Gérez vos armes et munitions favorites</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => setIsAdding(!isAdding)} className="font-black h-9 uppercase text-[10px] tracking-widest gap-2">
            {isAdding ? <X className="size-3" /> : <Plus className="size-3" />}
            {isAdding ? 'Annuler' : 'Ajouter'}
          </Button>
        </CardHeader>

        {isAdding && (
          <CardContent className="p-5 pt-0 space-y-5 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nom personnalisé (ex: Ma Savage)</Label>
                <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="NOM DE L'ARME" className="h-11 border-2 font-black uppercase text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Marque</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="EX: TIKKA, BROWNING..." className="h-11 border-2 font-black uppercase text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Calibre</Label>
                <Select value={caliber} onValueChange={setCaliber}>
                  <SelectTrigger className="h-11 border-2 font-black uppercase text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CALIBERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Munition favorite</Label>
                <Select value={munitionId} onValueChange={setMunitionId}>
                  <SelectTrigger className="h-11 border-2 font-bold text-xs"><SelectValue placeholder="Choisir munition..." /></SelectTrigger>
                  <SelectContent>
                    {munitionsForCaliber.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.model} ({m.weight}{m.caliber.includes('Calibre') ? 'g' : 'gr'})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Valeur Clic (Lunette)</Label>
                  <Select value={clickValue} onValueChange={(v: any) => setClickValue(v)}>
                      <SelectTrigger className="h-11 border-2 font-black uppercase text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="1/4 MOA" className="font-black text-xs">1/4 MOA (0.7cm à 100m)</SelectItem>
                          <SelectItem value="0.1 MRAD" className="font-black text-xs">0.1 MRAD (1cm à 100m)</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Poids ({weightUnit})</Label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={`Ex: ${weightUnit === 'g' ? '26' : '150'}`} className="h-11 border-2 font-black text-center" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Réglage Zéro (m)</Label>
                <Input type="number" value={zeroDistance} onChange={e => setZeroDistance(e.target.value)} className="h-11 border-2 font-black text-center" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving || !customName} className="w-full h-12 font-black uppercase tracking-widest shadow-lg gap-2">
              {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editingId ? "Mettre à jour" : "Ajouter au râtelier"}
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : weapons && weapons.length > 0 ? (
          weapons.map(w => {
            const munition = BALLISTIC_DATABASE.find(m => m.id === w.munitionId);
            const weaponWeightUnit = w.caliber.startsWith('Calibre') || w.caliber.includes('.410') ? 'g' : 'gr';
            return (
              <Card key={w.id} className="overflow-hidden border-2 shadow-md hover:border-primary/30 transition-all group">
                <CardHeader className="p-4 bg-muted/10 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white border-2 rounded-lg shadow-sm">
                      <Target className="size-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-tight truncate max-w-[150px]">{w.customName}</CardTitle>
                      <CardDescription className="text-[9px] font-bold uppercase">{w.brand || "Marque inconnue"}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => handleEdit(w)}><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full text-destructive" onClick={() => handleDelete(w.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-black uppercase text-[9px] border-primary/20 text-primary">{w.caliber}</Badge>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase text-muted-foreground">Zéro: {w.zeroDistance}m</span>
                        <span className="text-[8px] font-bold text-primary uppercase">Clic: {w.clickValue || '1/4 MOA'}</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-primary/5 rounded-xl border border-dashed border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("size-2 rounded-full", munition?.color || "bg-slate-400")} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase text-slate-700 truncate leading-none mb-1">{munition?.model || "Munition personnalisée"}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{w.weight}{weaponWeightUnit} {munition ? `• BC: ${munition.bc}` : ''}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="sm:col-span-2 text-center py-12 border-2 border-dashed rounded-[2.5rem] opacity-30">
            <Package className="size-12 mx-auto mb-3" />
            <p className="font-black uppercase tracking-[0.2em] text-xs">Râtelier vide</p>
          </div>
        )}
      </div>
    </div>
  );
}
