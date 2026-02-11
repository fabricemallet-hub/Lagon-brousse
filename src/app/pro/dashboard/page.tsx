
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, getDocs } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Plus, Trash2, Send, DollarSign, Users, ShoppingBag, Store, Camera, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // --- BUSINESS DATA ---
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !profile?.businessId) return null;
    return doc(firestore, 'businesses', profile.businessId);
  }, [firestore, profile?.businessId]);
  const { data: business, isLoading: isBusinessLoading } = useDoc<Business>(businessRef);

  // --- REACH CALCULATION ---
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [isCalculatingReach, setIsCalculatingReach] = useState(false);

  useEffect(() => {
    if (!firestore || !business) return;
    
    const calculateReach = async () => {
      setIsCalculatingReach(true);
      try {
        const usersRef = collection(firestore, 'users');
        const q = query(
          usersRef, 
          where('lastSelectedLocation', '==', business.commune),
          where('favoriteCategory', '==', business.category)
        );
        const snap = await getDocs(q);
        setTargetCount(snap.size);
      } catch (e) {
        console.error(e);
      } finally {
        setIsCalculatingReach(false);
      }
    };
    calculateReach();
  }, [firestore, business]);

  // --- FORM STATES ---
  const [promoTitle, setPromoTitle] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddPromotion = async () => {
    if (!firestore || !business || !promoTitle) return;
    setIsSaving(true);
    try {
      const promoData = {
        businessId: business.id,
        title: promoTitle,
        price: parseFloat(promoPrice) || 0,
        promoType,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), promoData);
      toast({ title: "Produit ajouté !" });
      setPromoTitle('');
      setPromoPrice('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiffuse = async () => {
    if (!firestore || !business || targetCount === null) return;
    setIsSaving(true);
    try {
      const campaignData: Omit<Campaign, 'id'> = {
        ownerId: user!.uid,
        businessId: business.id,
        businessName: business.name,
        title: `${business.name} : ${promoTitle || 'Nouvelle offre !'}`,
        message: `Découvrez nos offres à ${business.commune} en ${business.category}.`,
        targetCommune: business.commune,
        targetCategory: business.category,
        reach: targetCount,
        cost: targetCount * 10,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      await addDoc(collection(firestore, 'campaigns'), campaignData);
      toast({ title: "Demande de diffusion envoyée", description: `Coût : ${campaignData.cost} FCFP` });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isBusinessLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Store className="size-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-black uppercase">Espace Professionnel</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">Vous n'avez pas encore de compte pro activé. Contactez l'admin pour lier votre boutique.</p>
        <Button onClick={() => router.push('/compte')} variant="outline">Retour au compte</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <Card className="border-2 border-primary shadow-xl overflow-hidden">
        <CardHeader className="bg-primary text-white">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tighter">{business.name}</CardTitle>
              <CardDescription className="text-white/80 font-bold uppercase text-[10px]">Espace Professionnel • {business.commune}</CardDescription>
            </div>
            <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black">{business.category}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase flex items-center gap-2 text-primary"><ShoppingBag className="size-4" /> Ajouter une Offre</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase opacity-60">Nom du produit</Label>
                  <Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ex: Moulinet Shimano..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-60">Prix (FCFP)</Label>
                    <Input type="number" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-60">Type</Label>
                    <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Promo">Promo</SelectItem>
                        <SelectItem value="Nouvel Arrivage">Nouvel Arrivage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddPromotion} disabled={isSaving || !promoTitle} className="w-full h-12 font-black uppercase gap-2">
                  <Plus className="size-4" /> Enregistrer le produit
                </Button>
              </div>
            </div>

            <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6 relative overflow-hidden">
              <Megaphone className="absolute -right-4 -bottom-4 size-32 opacity-5 rotate-12" />
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Send className="size-4" /> Diffusion Flash</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Notification Push ciblée</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded-xl shadow-sm border">
                  <div className="flex items-center gap-3">
                    <Users className="size-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Audience Cible</p>
                      <p className="text-lg font-black">{isCalculatingReach ? <RefreshCw className="size-4 animate-spin" /> : `${targetCount || 0} abonnés`}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[8px] font-black uppercase">{business.commune}</Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-accent/10 rounded-xl border border-accent/20">
                  <div className="flex items-center gap-3">
                    <DollarSign className="size-5 text-accent" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Coût de Campagne</p>
                      <p className="text-lg font-black text-accent">{targetCount !== null ? `${targetCount * 10} FCFP` : "..."}</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-muted-foreground italic">10 F / abonné</span>
                </div>

                <Button 
                  onClick={handleDiffuse} 
                  disabled={isSaving || !targetCount} 
                  className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest shadow-lg gap-2"
                >
                  <Megaphone className="size-5" /> Diffuser Maintenant
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
