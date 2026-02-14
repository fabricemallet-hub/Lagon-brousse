'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, getDocs, orderBy, deleteDoc, updateDoc, getCountFromServer } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Plus, Trash2, Send, DollarSign, Users, ShoppingBag, Store, Camera, RefreshCw, Percent, Tag, FileText, ImageIcon, X, Info, Pencil, Save, AlertCircle, LogOut, HelpCircle, Copy, Check, UserCircle, ShieldCheck, BrainCircuit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
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
  const [reachError, setReachError] = useState(false);

  // --- FORM STATES ---
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCategory, setPromoCategory] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoImage, setPromoImage] = useState('');
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCopiedUid, setHasCopiedUid] = useState(false);

  // Initialize target category from business categories
  useEffect(() => {
    if (business && (business.categories || [business.category]).length > 0) {
      const defaultCat = (business.categories || [business.category])[0];
      if (!targetCategory) setTargetCategory(defaultCat);
      if (!promoCategory) setPromoCategory(defaultCat);
    }
  }, [business, targetCategory, promoCategory]);

  useEffect(() => {
    if (!firestore || !business || !targetCategory || isUserLoading || !user) return;
    
    const calculateReach = async () => {
      setIsCalculatingReach(true);
      setReachError(false);
      try {
        const usersRef = collection(firestore, 'users');
        const q = query(
          usersRef, 
          where('lastSelectedLocation', '==', business.commune),
          where('favoriteCategory', '==', targetCategory)
        );
        const snap = await getCountFromServer(q);
        setTargetCount(snap.data().count);
      } catch (e) {
        console.error("Reach calculation error:", e);
        setReachError(true);
        setTargetCount(0);
      } finally {
        setIsCalculatingReach(false);
      }
    };
    calculateReach();
  }, [firestore, business, targetCategory, isUserLoading, user]);

  const handleCopyUid = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setHasCopiedUid(true);
    toast({ title: "UID Copié !", description: "Transmettez-le à l'administrateur." });
    setTimeout(() => setHasCopiedUid(false), 2000);
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.replace('/login');
  };

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

  const handleSavePromotion = async () => {
    if (!firestore || !business || !promoTitle || !promoCategory) return;
    setIsSaving(true);
    try {
      const promoData: any = {
        businessId: business.id,
        title: promoTitle,
        category: promoCategory,
        description: promoDescription,
        price: 0,
        promoType,
        imageUrl: promoImage,
        updatedAt: serverTimestamp(),
      };

      if (editingPromoId) {
        await updateDoc(doc(firestore, 'businesses', business.id, 'promotions', editingPromoId), promoData);
        toast({ title: "Produit mis à jour" });
      } else {
        promoData.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), promoData);
        toast({ title: "Produit ajouté" });
      }
      
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingPromoId(null);
    setPromoTitle('');
    setPromoDescription('');
    setPromoImage('');
    if (business && (business.categories || [business.category]).length > 0) {
        setPromoCategory((business.categories || [business.category])[0]);
    }
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromoId(promo.id);
    setPromoTitle(promo.title);
    setPromoCategory(promo.category || (business?.categories?.[0] || ''));
    setPromoDescription(promo.description || '');
    setPromoImage(promo.imageUrl || '');
    setPromoType(promo.promoType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePromotion = async (id: string) => {
    if (!firestore || !business) return;
    try {
        await deleteDoc(doc(firestore, 'businesses', business.id, 'promotions', id));
        toast({ title: "Produit supprimé" });
        if (editingPromoId === id) resetForm();
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-1">
      {/* IDENTITÉ PRO & STATUT EN HAUT */}
      <Card className="border-2 border-primary bg-primary/5 shadow-lg overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary text-white rounded-lg"><UserCircle className="size-5" /></div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-primary/60">Identifiant de partage (UID)</p>
                        <p className="font-mono font-black text-sm tracking-tight select-all">{user?.uid}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] h-10 gap-2 border-2 bg-white" onClick={handleCopyUid}>
                    {hasCopiedUid ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                    Copier
                </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/10">
                <Badge className="font-black uppercase text-[10px] bg-primary">Rôle: {profile?.role}</Badge>
                <Badge variant="outline" className="font-black uppercase text-[10px] border-primary text-primary bg-white">Statut: {profile?.subscriptionStatus}</Badge>
            </div>
        </CardContent>
      </Card>

      {!business ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-4 text-center">
            <div className="p-6 bg-muted rounded-full text-muted-foreground shadow-inner">
                <Store className="size-16" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Commerce non relié</h2>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-sm italic">
                "Comment relier le compte pro à un commerce ?"
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mt-2">
                Transmettez votre UID ci-dessus à l'administrateur pour qu'il puisse rattacher votre profil à votre boutique.
            </p>
            <Button onClick={() => router.push('/compte')} variant="ghost" className="mt-4 font-black uppercase text-[10px] tracking-widest border-2">Retour au profil</Button>
        </div>
      ) : (
        <>
          <Card className={cn("border-2 shadow-xl overflow-hidden transition-all", editingPromoId ? "border-accent ring-2 ring-accent/20" : "border-primary")}>
            <CardHeader className={cn(editingPromoId ? "bg-accent" : "bg-primary", "text-white")}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter">
                    {editingPromoId ? "Modifier la fiche" : business.name}
                  </CardTitle>
                  <CardDescription className="text-white/80 font-bold uppercase text-[10px]">
                    {editingPromoId ? `Produit ID : ${editingPromoId}` : `Dashboard Professionnel • ${business.commune}`}
                  </CardDescription>
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
                  <h3 className={cn("text-sm font-black uppercase flex items-center gap-2 border-b pb-2", editingPromoId ? "text-accent border-accent/20" : "text-primary border-primary/20")}>
                    {editingPromoId ? <Pencil className="size-4" /> : <ShoppingBag className="size-4" />} 
                    {editingPromoId ? "Mise à jour" : "Nouveau Produit"}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Titre</Label>
                      <Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ex: Moulinet..." className="font-bold border-2 h-11" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Catégorie</Label>
                      <Select value={promoCategory} onValueChange={setPromoCategory}>
                        <SelectTrigger className="h-11 border-2 font-black uppercase text-xs">
                            <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(business.categories || [business.category]).map(cat => (
                                <SelectItem key={cat} value={cat} className="font-black text-xs uppercase">{cat}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Description</Label>
                      <Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} placeholder="Détails..." className="font-medium border-2 min-h-[80px]" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Type</Label>
                            <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}>
                            <SelectTrigger className="h-11 border-2 font-black text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Promo">Promotion</SelectItem>
                                <SelectItem value="Nouvel Arrivage">Nouveauté</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Photo</Label>
                            <Button variant="outline" className="w-full h-11 border-2 gap-2 font-black uppercase text-[10px]" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="size-3" /> Image
                            </Button>
                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {editingPromoId && (
                            <Button variant="ghost" onClick={resetForm} className="flex-1 font-bold uppercase text-xs h-14 border-2">Annuler</Button>
                        )}
                        <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle} className={cn("flex-[2] h-14 font-black uppercase gap-2 shadow-lg text-sm tracking-widest", editingPromoId ? "bg-accent" : "bg-primary")}>
                            {isSaving ? <RefreshCw className="size-5 animate-spin" /> : <Plus className="size-5" />}
                            {editingPromoId ? "Sauver" : "Enregistrer"}
                        </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6">
                        <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Megaphone className="size-4" /> Reach & Diffusion</h3>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Catégorie cible</Label>
                                <Select value={targetCategory} onValueChange={setTargetCategory}>
                                    <SelectTrigger className="h-10 border-2 bg-background font-black uppercase text-[10px]">
                                        <SelectValue />
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
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Audience</p>
                                        <p className="text-lg font-black">
                                            {isCalculatingReach ? <RefreshCw className="size-4 animate-spin" /> : `${targetCount ?? '0'}`}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-[8px] font-black uppercase">{business.commune}</Badge>
                            </div>
                            
                            {reachError && (
                                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-xl space-y-2">
                                    <p className="text-[9px] text-red-600 font-bold uppercase flex items-center gap-2">
                                        <AlertCircle className="size-3" /> Aide technique
                                    </p>
                                    <div className="p-2 bg-white/50 rounded-lg text-[8px] font-bold text-red-800 leading-tight uppercase italic text-center">
                                        je n'ai pas d'audience qui s'affiche ce qui donne le message d'erreur sur le compte "pro". Veuillez utiliser le bouton ci-dessous pour rafraîchir vos droits.
                                    </div>
                                    <Button size="sm" variant="outline" className="w-full h-8 text-[8px] font-black uppercase border-red-200 text-red-600" onClick={handleLogout}>Déconnexion & Reconnexion</Button>
                                </div>
                            )}

                            <Button 
                                onClick={handleDiffuse} 
                                disabled={isSaving || !targetCount || reachError} 
                                className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest shadow-lg gap-2"
                            >
                                <Megaphone className="size-5" /> Lancer la campagne
                            </Button>
                        </div>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                <Store className="size-4" /> Catalogue ({promotions?.length || 0})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {promotions?.map(promo => (
                    <Card key={promo.id} className={cn("overflow-hidden border-2 shadow-sm flex h-32", editingPromoId === promo.id && "border-accent bg-accent/5")}>
                        <div className="w-24 bg-muted/20 shrink-0 relative flex items-center justify-center border-r">
                            {promo.imageUrl ? <img src={promo.imageUrl} className="w-full h-full object-cover" alt={promo.title} /> : <ImageIcon className="size-6 opacity-20" />}
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                                <h4 className="font-black uppercase text-xs truncate">{promo.title}</h4>
                                <p className="text-[10px] text-muted-foreground line-clamp-2">{promo.description || "Pas de description."}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-primary">{promo.price} F</span>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="size-7 border" onClick={() => handleEditPromotion(promo)}><Pencil className="size-3" /></Button>
                                    <Button variant="ghost" size="icon" className="size-7 text-destructive border" onClick={() => handleDeletePromotion(promo.id)}><Trash2 className="size-3" /></Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
