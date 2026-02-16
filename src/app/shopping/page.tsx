'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';
import type { Promotion, Business, UserAccount, Region } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Carousel, 
    CarouselContent, 
    CarouselItem 
} from '@/components/ui/carousel';
import { 
    Search, 
    ShoppingBag, 
    Store, 
    MapPin, 
    Filter, 
    X,
    Globe,
    ImageIcon,
    Trash2,
    AlertCircle,
    Plus
} from 'lucide-react';
import { locations, locationsByRegion, regions } from '@/lib/locations';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ShoppingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const businessesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'businesses'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: businesses, isLoading: isBusinessesLoading } = useCollection<Business>(businessesRef);

  const promosRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'promotions');
  }, [firestore]);
  
  const { data: allPromotions, isLoading: isPromosLoading } = useCollection<Promotion>(promosRef);

  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('USER_DEFAULT');
  const [filterCommune, setFilterCommune] = useState<string>('USER_DEFAULT');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const [selectedProduct, setSelectedProduct] = useState<Promotion & { business?: Business } | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactBusiness, setContactBusiness] = useState<Business | null>(null);
  const [productToDelete, setProductToDelete] = useState<{id: string, bid: string} | null>(null);

  const userRegion = profile?.selectedRegion || 'CALEDONIE';
  const userCommune = profile?.lastSelectedLocation || 'Nouméa';

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com'];
    const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2'];
    return masterEmails.includes(user.email?.toLowerCase() || '') || masterUids.includes(user.uid);
  }, [user]);

  const filteredProducts = useMemo(() => {
    if (!allPromotions) return [];
    const bizMap = new Map(businesses?.map(b => [b.id, b]) || []);
    const currentFRegion = filterRegion === 'USER_DEFAULT' ? userRegion : filterRegion;
    const currentFCommune = filterCommune === 'USER_DEFAULT' ? userCommune : filterCommune;

    return allPromotions
      .map(p => ({ ...p, business: bizMap.get(p.businessId) }))
      .filter(p => {
        const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (currentFRegion !== 'ALL' && p.business?.commune) {
            const isTahiti = Object.keys(locationsByRegion['TAHITI']).includes(p.business.commune);
            const itemRegion = isTahiti ? 'TAHITI' : 'CALEDONIE';
            if (itemRegion !== currentFRegion) return false;
        }
        if (currentFCommune !== 'ALL' && p.business?.commune !== currentFCommune) return false;
        if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;
        if (filterType !== 'ALL' && p.promoType !== filterType) return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
  }, [allPromotions, businesses, search, filterRegion, filterCommune, filterCategory, filterType, userRegion, userCommune]);

  const availableCommunes = useMemo(() => {
    const r = filterRegion === 'USER_DEFAULT' ? userRegion : filterRegion;
    if (r === 'ALL') return Object.keys(locations).sort();
    return Object.keys(locationsByRegion[r as Region] || {}).sort();
  }, [filterRegion, userRegion]);

  const handleDeleteProduct = async () => {
    if (!firestore || !productToDelete) return;
    try {
        await deleteDoc(doc(firestore, 'businesses', productToDelete.bid, 'promotions', productToDelete.id));
        toast({ title: "Annonce supprimée" });
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur suppression" });
    } finally {
        productToDelete && setProductToDelete(null);
    }
  };

  const handleOpenContact = async (bid: string) => {
    if (!firestore) return;
    try {
        const snap = await getDoc(doc(firestore, 'businesses', bid));
        if (snap.exists()) {
            const b = snap.data() as Business;
            const oSnap = await getDoc(doc(firestore, 'users', b.ownerId));
            const o = oSnap.exists() ? oSnap.data() as UserAccount : {};
            setContactBusiness({ ...b, phoneNumber: b.phoneNumber || o.phoneNumber, address: b.address || o.address });
            setIsContactOpen(true);
        }
    } catch (e) {}
  };

  const isLoading = isBusinessesLoading || isPromosLoading;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">
            <ShoppingBag className="text-primary size-7" /> Le Shopping NC
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase opacity-60">Catalogue des offres locales.</CardDescription>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <Input placeholder="Chercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 h-14 border-2 shadow-sm font-black text-base" />
      </div>

      <Card className="border-2 shadow-md bg-muted/10">
        <CardContent className="p-4 space-y-4">
          <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Filter className="size-3" /> Filtres</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Région</Label>
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                    <SelectTrigger className="h-10 border-2 bg-white font-black text-xs"><Globe className="size-3 mr-2" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="USER_DEFAULT">Focus : {userRegion}</SelectItem>
                        <SelectItem value="ALL">Tout</SelectItem>
                        {regions.map(reg => <SelectItem key={reg} value={reg}>{reg}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Commune</Label>
                <Select value={filterCommune} onValueChange={setFilterCommune}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs"><MapPin className="size-3 mr-2" /><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="USER_DEFAULT">Focus : {userCommune}</SelectItem>
                        <SelectItem value="ALL">Tout</SelectItem>
                        {availableCommunes.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((p) => (
                <Card key={p.id} className={cn("overflow-hidden border-2 shadow-sm flex flex-col cursor-pointer transition-all hover:border-primary/30", p.promoType === 'Promo' && "border-red-100 bg-red-50/10", p.isOutOfStock && "opacity-75")} onClick={() => setSelectedProduct(p)}>
                    <div className="px-3 py-2 bg-muted/20 border-b flex justify-between items-center"><div className="flex items-center gap-2 min-w-0"><Store className="size-3 text-primary" /><span className="text-[9px] font-black uppercase truncate">{p.business?.name}</span></div>{isAdmin && <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={(e) => { e.stopPropagation(); setProductToDelete({id: p.id, bid: p.businessId}); }}><Trash2 className="size-3" /></Button>}</div>
                    <div className="flex h-36 relative">
                        <div className="w-32 bg-white shrink-0 flex items-center justify-center border-r p-2">{p.imageUrl ? <img src={p.imageUrl} className="max-w-full max-h-full object-contain" alt="" /> : <ImageIcon className="size-8 opacity-10" />}<Badge className={cn("absolute top-1 left-1 font-black text-[8px] uppercase h-5", p.promoType === 'Promo' ? "bg-red-600" : "bg-primary")}>{p.promoType}</Badge></div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <h4 className={cn("font-black uppercase text-xs truncate", p.isOutOfStock && "line-through decoration-red-600")}>{p.title}</h4>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 italic">{p.description}</p>
                            <div className="flex items-baseline gap-1"><span className={cn("text-base font-black", p.isOutOfStock ? "line-through opacity-40" : (p.promoType === 'Promo' ? "text-red-600" : "text-primary"))}>{(p.price || 0).toLocaleString('fr-FR')}</span><span className="text-[9px] font-black uppercase opacity-60">CFP</span></div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
      ) : (
        <div className="text-center py-20 border-4 border-dashed rounded-[2.5rem] opacity-30">
            <ShoppingBag className="size-12 mb-2 mx-auto" />
            <p className="font-black uppercase text-sm">Aucune offre trouvée</p>
        </div>
      )}

      {/* DETAIL DIALOGS */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
            {selectedProduct && (
                <>
                    <div className="h-64 sm:h-80 bg-white relative shrink-0">
                        <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-[160] p-2 bg-black/20 rounded-full text-white"><X className="size-5" /></button>
                        {selectedProduct.images && selectedProduct.images.length > 0 ? (
                            <Carousel className="w-full h-full">
                                <CarouselContent className="h-full ml-0">
                                    {selectedProduct.images.map((img, idx) => (
                                        <CarouselItem key={idx} className="h-full pl-0"><img src={img} className="w-full h-full object-contain p-4" alt="" /></CarouselItem>
                                    ))}
                                </CarouselContent>
                            </Carousel>
                        ) : <div className="w-full h-full flex items-center justify-center opacity-20"><ImageIcon className="size-16" /></div>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                        <h2 className={cn("text-2xl font-black uppercase text-slate-800", selectedProduct.isOutOfStock && "line-through decoration-red-600")}>{selectedProduct.title}</h2>
                        <div className="flex items-center gap-2 text-primary font-black uppercase text-xs"><Store className="size-4" />{selectedProduct.business?.name} <MapPin className="size-3" />{selectedProduct.business?.commune}</div>
                        {selectedProduct.isOutOfStock && <Alert variant="destructive" className="bg-red-50 border-red-200 border-2"><AlertCircle className="size-4" /><AlertDescription className="text-sm font-black text-red-700">RUPTURE - Retour le {selectedProduct.restockDate}</AlertDescription></Alert>}
                        <div className="p-5 bg-muted/10 rounded-2xl border-2 border-dashed flex items-baseline gap-2">
                            <span className={cn("text-4xl font-black", selectedProduct.isOutOfStock ? "line-through opacity-40" : (selectedProduct.promoType === 'Promo' ? "text-red-600" : "text-primary"))}>{(selectedProduct.price || 0).toLocaleString('fr-FR')}</span>
                            <span className="text-xs font-black uppercase opacity-60">CFP</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-slate-600 italic">"{selectedProduct.description || "Pas de description."}"</p>
                    </div>
                    <div className="p-4 bg-slate-50 border-t shrink-0"><Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl" onClick={() => { const id = selectedProduct.businessId; setSelectedProduct(null); handleOpenContact(id); }}>Contacter le magasin</Button></div>
                </>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle className="font-black uppercase flex items-center gap-2"><Store className="size-5" /> Contact Pro</DialogTitle></DialogHeader>
            <div className="p-6 space-y-4">
                {contactBusiness && (
                    <div className="space-y-4">
                        <Button asChild className="w-full h-14 font-black uppercase shadow-lg gap-3"><a href={`tel:${contactBusiness.phoneNumber}`}><Smartphone className="size-5" /> Appeler le mobile</a></Button>
                        <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed flex items-start gap-3"><Home className="size-4 text-primary" /><div><p className="text-[10px] font-black uppercase opacity-40">Adresse</p><p className="text-xs font-bold">{contactBusiness.address || "Non renseignée"}</p></div></div>
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToDelete} onOpenChange={(o) => !o && setProductToDelete(null)}><AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Supprimer ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="h-12 font-black uppercase text-[10px] border-2">Non</AlertDialogCancel><AlertDialogAction onClick={handleDeleteProduct} className="h-12 font-black uppercase text-[10px] bg-destructive">Oui, supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}