
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Plus, Trash2, Send, DollarSign, Users, ShoppingBag, Store, Camera, RefreshCw, Percent, Tag, FileText, Image as ImageIcon, X, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- BUSINESS DATA ---
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !profile?.businessId) return null;
    return doc(firestore, 'businesses', profile.businessId);
  }, [firestore, profile?.businessId]);
  const { data: business, isLoading: isBusinessLoading } = useDoc<Business>(businessRef);

  // --- PROMOTIONS LIST ---
  const promosRef = useMemoFirebase(() => {
    if (!firestore || !business?.id) return null;
    return query(collection(firestore, 'businesses', business.id, 'promotions'), orderBy('createdAt', 'desc'));
  }, [firestore, business?.id]);
  const { data: promotions, isLoading: isPromosLoading } = useCollection<Promotion>(promosRef);

  // --- REACH CALCULATION ---
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [isCalculatingReach, setIsCalculatingReach] = useState(false);

  // Initialize target category from business categories
  useEffect(() => {
    if (business && business.categories && business.categories.length > 0 && !targetCategory) {
      setTargetCategory(business.categories[0]);
    }
  }, [business, targetCategory]);

  useEffect(() => {
    if (!firestore || !business || !targetCategory) return;
    
    const calculateReach = async () => {
      setIsCalculatingReach(true);
      try {
        const usersRef = collection(firestore, 'users');
        const q = query(
          usersRef, 
          where('lastSelectedLocation', '==', business.commune),
          where('favoriteCategory', '==', targetCategory)
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
  }, [firestore, business, targetCategory]);

  // --- FORM STATES ---
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoImage, setPromoImage] = useState('');
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isSaving, setIsSaving] = useState(false);

  // Smart Promo States
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [standardPrice, setStandardPrice] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        setPromoImage(event.target?.result as string);
        toast({ title: "Photo chargée" });
    };
    reader.readAsDataURL(file);
  };

  const handleOriginalPriceChange = (val: string) => {
    setOriginalPrice(val);
    const p1 = parseFloat(val);
    const d = parseFloat(discountPercentage);
    const p2 = parseFloat(discountedPrice);

    if (!isNaN(p1)) {
        if (!isNaN(d)) {
            setDiscountedPrice((p1 * (1 - d / 100)).toFixed(0));
        } else if (!isNaN(p2) && p1 !== 0) {
            setDiscountPercentage(((1 - p2 / p1) * 100).toFixed(1));
        }
    }
  };

  const handleDiscountedPriceChange = (val: string) => {
    setDiscountedPrice(val);
    const p2 = parseFloat(val);
    const p1 = parseFloat(originalPrice);
    if (!isNaN(p2) && !isNaN(p1) && p1 !== 0) {
      setDiscountPercentage(((1 - p2 / p1) * 100).toFixed(1));
    }
  };

  const handlePercentageChange = (val: string) => {
    setDiscountPercentage(val);
    const d = parseFloat(val);
    const p1 = parseFloat(originalPrice);
    if (!isNaN(d) && !isNaN(p1)) {
      setDiscountedPrice((p1 * (1 - d / 100)).toFixed(0));
    }
  };

  const handleAddPromotion = async () => {
    if (!firestore || !business || !promoTitle) return;
    setIsSaving(true);
    try {
      const finalPrice = promoType === 'Promo' ? parseFloat(discountedPrice) : parseFloat(standardPrice);
      
      const promoData: Omit<Promotion, 'id'> = {
        businessId: business.id,
        title: promoTitle,
        description: promoDescription,
        price: finalPrice || 0,
        originalPrice: promoType === 'Promo' ? (parseFloat(originalPrice) || 0) : null,
        discountPercentage: promoType === 'Promo' ? (parseFloat(discountPercentage) || 0) : null,
        promoType,
        imageUrl: promoImage,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), promoData);
      toast({ title: "Produit ajouté au catalogue !" });
      
      // Reset form
      setPromoTitle('');
      setPromoDescription('');
      setPromoImage('');
      setOriginalPrice('');
      setDiscountedPrice('');
      setDiscountPercentage('');
      setStandardPrice('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePromotion = async (id: string) => {
    if (!firestore || !business) return;
    try {
        await deleteDoc(doc(firestore, 'businesses', business.id, 'promotions', id));
        toast({ title: "Produit supprimé" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  const handleDiffuse = async () => {
    if (!firestore || !business || targetCount === null || !targetCategory) return;
    setIsSaving(true);
    try {
      const campaignData: Omit<Campaign, 'id'> = {
        ownerId: user!.uid,
        businessId: business.id,
        businessName: business.name,
        title: `${business.name} : ${promoTitle || 'Nouvelle offre !'}`,
        message: promoDescription || `Découvrez nos offres à ${business.commune} en ${targetCategory}.`,
        targetCommune: business.commune,
        targetCategory: targetCategory,
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

  if (isUserLoading || isProfileLoading || isBusinessLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full text-primary shadow-inner">
            <Store className="size-16" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tighter">Espace Professionnel</h2>
        <div className="space-y-4 max-w-sm">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Votre compte n'est pas encore relié à un commerce. Pour lier votre boutique, veuillez contacter l'administrateur.
            </p>
            <div className="p-4 bg-muted/30 rounded-xl border-2 border-dashed space-y-1">
                <p className="text-[10px] font-black uppercase opacity-40">Votre identifiant unique à fournir :</p>
                <p className="font-mono font-black text-primary text-xs select-all">{user?.uid}</p>
            </div>
        </div>
        <Button onClick={() => router.push('/compte')} variant="outline" className="mt-4 font-black uppercase text-xs h-12 border-2">Retour au compte</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      <Card className="border-2 border-primary shadow-xl overflow-hidden">
        <CardHeader className="bg-primary text-white">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tighter">{business.name}</CardTitle>
              <CardDescription className="text-white/80 font-bold uppercase text-[10px]">Espace Professionnel • {business.commune}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                {(business.categories || [business.category]).map(cat => (
                    <Badge key={cat} variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black text-[8px]">{cat}</Badge>
                ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase flex items-center gap-2 text-primary border-b pb-2"><ShoppingBag className="size-4" /> Ajouter une Offre</h3>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nom du produit</Label>
                  <Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ex: Moulinet Shimano..." className="font-bold border-2 h-11" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Description</Label>
                  <Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} placeholder="Détails de l'offre, caractéristiques..." className="font-medium border-2 min-h-[80px]" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Type d'offre</Label>
                        <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}>
                        <SelectTrigger className="h-11 border-2 font-black uppercase text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Promo" className="font-black text-xs uppercase">Promotion</SelectItem>
                            <SelectItem value="Nouvel Arrivage" className="font-black text-xs uppercase">Nouvel Arrivage</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Photo</Label>
                        <div className="flex gap-2">
                            <Button variant="outline" className="w-full h-11 border-2 gap-2 font-black uppercase text-[10px]" onClick={() => fileInputRef.current?.click()}>
                                {promoImage ? <RefreshCw className="size-3" /> : <Camera className="size-3" />}
                                {promoImage ? "Changer" : "Photo"}
                            </Button>
                            {promoImage && (
                                <Button variant="destructive" size="icon" className="h-11 w-11 shrink-0" onClick={() => setPromoImage('')}><X className="size-4" /></Button>
                            )}
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    </div>
                </div>

                {promoImage && (
                    <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/30 bg-muted/30">
                        <img src={promoImage} className="w-full h-full object-contain" />
                    </div>
                )}

                {promoType === 'Promo' ? (
                    <div className="grid gap-4 p-4 bg-muted/30 rounded-2xl border-2 border-dashed animate-in fade-in zoom-in-95">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix avant promotion (F)</Label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input 
                                    type="number" 
                                    value={originalPrice} 
                                    onChange={e => handleOriginalPriceChange(e.target.value)} 
                                    placeholder="Prix d'origine" 
                                    className="pl-10 h-11 border-2 font-black"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Remise (%)</Label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary" />
                                    <Input 
                                        type="number" 
                                        value={discountPercentage} 
                                        onChange={e => handlePercentageChange(e.target.value)} 
                                        placeholder="%" 
                                        className="pl-10 h-11 border-2 border-primary/20 font-black text-primary"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix final (Promo)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-green-600" />
                                    <Input 
                                        type="number" 
                                        value={discountedPrice} 
                                        onChange={e => handleDiscountedPriceChange(e.target.value)} 
                                        placeholder="Prix final" 
                                        className="pl-10 h-11 border-2 border-green-200 font-black text-green-600 bg-green-50"
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="text-[8px] font-bold text-muted-foreground text-center italic uppercase">Calcul automatique activé</p>
                    </div>
                ) : (
                    <div className="space-y-1 animate-in fade-in zoom-in-95">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix de vente (F)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input 
                                type="number" 
                                value={standardPrice} 
                                onChange={e => setStandardPrice(e.target.value)} 
                                placeholder="0" 
                                className="pl-10 h-11 border-2 font-black"
                            />
                        </div>
                    </div>
                )}

                <Button onClick={handleAddPromotion} disabled={isSaving || !promoTitle} className="w-full h-14 font-black uppercase gap-2 shadow-lg text-sm tracking-widest">
                  <Plus className="size-5" /> Enregistrer au catalogue
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6 relative overflow-hidden">
                <Megaphone className="absolute -right-4 -bottom-4 size-32 opacity-5 rotate-12" />
                <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Send className="size-4" /> Diffusion Flash</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Notification Push ciblée</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Catégorie visée</Label>
                            <Select value={targetCategory} onValueChange={setTargetCategory}>
                                <SelectTrigger className="h-10 border-2 bg-background font-black uppercase text-[10px]">
                                    <SelectValue placeholder="Choisir cible..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(business.categories || [business.category]).map(cat => (
                                        <SelectItem key={cat} value={cat} className="font-black uppercase text-[10px]">{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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
                    disabled={isSaving || !targetCount || !targetCategory} 
                    className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest shadow-lg gap-2"
                    >
                    <Megaphone className="size-5" /> Diffuser Maintenant
                    </Button>
                </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                    <p className="text-[10px] font-black uppercase text-primary mb-2 flex items-center gap-2"><Info className="size-3" /> Note Technique</p>
                    <p className="text-[9px] font-medium leading-relaxed text-muted-foreground italic">
                        La diffusion flash envoie une notification immédiate aux utilisateurs ayant sélectionné <strong>{business.commune}</strong> comme localité et <strong>{targetCategory}</strong> comme catégorie favorite.
                    </p>
                </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
            <Store className="size-4" /> Mon Catalogue Actif ({promotions?.length || 0})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isPromosLoading ? (
                [1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
            ) : promotions && promotions.length > 0 ? (
                promotions.map(promo => (
                    <Card key={promo.id} className="overflow-hidden border-2 shadow-sm flex h-32 group">
                        <div className="w-32 bg-muted/20 shrink-0 border-r relative flex items-center justify-center">
                            {promo.imageUrl ? (
                                <img src={promo.imageUrl} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="size-8 text-muted-foreground/30" />
                            )}
                            <Badge className="absolute top-1 left-1 font-black text-[8px] uppercase">{promo.promoType}</Badge>
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                                <h4 className="font-black uppercase text-xs truncate leading-none">{promo.title}</h4>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{promo.description || "Aucune description."}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    {promo.promoType === 'Promo' && promo.originalPrice && (
                                        <span className="text-[8px] text-muted-foreground line-through font-bold">{promo.originalPrice} F</span>
                                    )}
                                    <span className="text-sm font-black text-primary leading-none">{promo.price} F</span>
                                </div>
                                <Button variant="ghost" size="icon" className="size-8 text-destructive/40 hover:text-destructive border-2" onClick={() => handleDeletePromotion(promo.id)}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))
            ) : (
                <div className="col-span-full py-12 border-2 border-dashed rounded-3xl flex flex-col items-center gap-3 opacity-30">
                    <ShoppingBag className="size-8" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Votre catalogue est vide</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
