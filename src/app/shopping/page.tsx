
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
    Carousel, 
    CarouselContent, 
    CarouselItem, 
    type CarouselApi 
} from '@/components/ui/carousel';
import { 
    Search, 
    ShoppingBag, 
    Store, 
    MapPin, 
    Tag, 
    Percent, 
    Filter, 
    RefreshCw, 
    AlertTriangle,
    AlertCircle,
    ChevronRight, 
    ShieldCheck, 
    Phone, 
    Smartphone, 
    Home, 
    Navigation, 
    ExternalLink,
    X,
    Globe,
    ImageIcon,
    ChevronLeft,
    FileText,
    Trash2,
    Maximize2,
    Plus
} from 'lucide-react';
import { locations, locationsByRegion, regions } from '@/lib/locations';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

export default function ShoppingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- DATA FETCHING ---
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  const businessesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'businesses'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: businesses, isLoading: isBusinessesLoading } = useCollection<Business>(businessesRef);

  const promosRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'promotions');
  }, [firestore]);
  
  const { data: allPromotions, isLoading: isPromosLoading, error: promosError } = useCollection<Promotion>(promosRef);

  // --- DETAIL VIEW STATE ---
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Promotion & { business?: Business } | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  // --- LIGHTBOX STATE ---
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // --- CONTACT DIALOG STATE ---
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedBusinessContact, setSelectedBusinessContact] = useState<Business | null>(null);
  const [isLoadingContact, setIsLoadingContact] = useState(false);

  // --- DELETE STATE ---
  const [productToDelete, setProductToDelete] = useState<{id: string, businessId: string} | null>(null);

  // Sync Carousel with Dots
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveImageIdx(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => { api.off("select", onSelect); };
  }, [api]);

  useEffect(() => {
    if (selectedProductForDetail) {
        setActiveImageIdx(0);
        api?.scrollTo(0, true);
    }
  }, [selectedProductForDetail, api]);

  const handleOpenContact = async (businessId: string) => {
    setIsLoadingContact(true);
    setIsContactDialogOpen(true);
    if (!firestore) return;
    
    try {
        const bSnap = await getDoc(doc(firestore, 'businesses', businessId));
        if (bSnap.exists()) {
            const bData = bSnap.data() as Business;
            const ownerSnap = await getDoc(doc(firestore, 'users', bData.ownerId));
            if (ownerSnap.exists()) {
                const oData = ownerSnap.data() as UserAccount;
                setSelectedBusinessContact({
                    ...bData,
                    phoneNumber: bData.phoneNumber || oData.phoneNumber,
                    landline: bData.landline || oData.landline,
                    address: bData.address || oData.address,
                    location: bData.location || oData.contactLocation
                });
            } else {
                setSelectedBusinessContact(bData);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingContact(false);
    }
  };

  // --- FILTERS STATE ---
  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('USER_DEFAULT');
  const [filterCommune, setFilterCommune] = useState<string>('USER_DEFAULT');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterBusiness, setFilterBusiness] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const userRegion = profile?.selectedRegion || 'CALEDONIE';
  const userCommune = profile?.lastSelectedLocation || 'Nouméa';

  // --- MODERATION ---
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com', 'kledostyle@outlook.com'];
    const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2', 'koKj5ObSGXYeO1PLKU5bgo8Yaky1'];
    return masterEmails.includes(user.email?.toLowerCase() || '') || masterUids.includes(user.uid);
  }, [user]);

  const confirmDeleteProduct = async () => {
    if (!firestore || !isAdmin || !productToDelete) return;
    try {
        await deleteDoc(doc(firestore, 'businesses', productToDelete.businessId, 'promotions', productToDelete.id));
        toast({ title: "Annonce supprimée" });
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur suppression" });
    } finally {
        setProductToDelete(null);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!allPromotions) return [];
    const businessMap = new Map(businesses?.map(b => [b.id, b]) || []);
    const currentFRegion = filterRegion === 'USER_DEFAULT' ? userRegion : filterRegion;
    const currentFCommune = filterCommune === 'USER_DEFAULT' ? userCommune : filterCommune;

    return allPromotions
      .map(promo => ({ ...promo, business: businessMap.get(promo.businessId) }))
      .filter(item => {
        const matchesSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || (item.description?.toLowerCase() || '').includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (currentFRegion !== 'ALL') {
            const itemCommune = item.business?.commune;
            if (itemCommune) {
                const isTahiti = Object.keys(locationsByRegion['TAHITI']).includes(itemCommune);
                const itemRegion = isTahiti ? 'TAHITI' : 'CALEDONIE';
                if (itemRegion !== currentFRegion) return false;
            } else return false;
        }
        if (currentFCommune !== 'ALL' && item.business?.commune !== currentFCommune) return false;
        if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
        if (filterBusiness !== 'ALL' && item.businessId !== filterBusiness) return false;
        if (filterType !== 'ALL' && item.promoType !== filterType) return false;
        return true;
      })
      .sort((a, b) => {
        if (filterCommune === 'USER_DEFAULT') {
            const aInCommune = a.business?.commune === userCommune;
            const bInCommune = b.business?.commune === userCommune;
            if (aInCommune && !bInCommune) return -1;
            if (!aInCommune && bInCommune) return 1;
        }
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
  }, [allPromotions, businesses, search, filterRegion, filterCommune, filterCategory, filterBusiness, filterType, userRegion, userCommune]);

  const availableCommunes = useMemo(() => {
    const currentFRegion = filterRegion === 'USER_DEFAULT' ? userRegion : filterRegion;
    if (currentFRegion === 'ALL') return Object.keys(locations).sort();
    return Object.keys(locationsByRegion[currentFRegion as Region] || {}).sort();
  }, [filterRegion, userRegion]);

  const resetFilters = () => {
    setSearch(''); setFilterRegion('USER_DEFAULT'); setFilterCommune('USER_DEFAULT');
    setFilterCategory('ALL'); setFilterBusiness('ALL'); setFilterType('ALL');
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

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <Input 
          placeholder="Chercher un produit..." 
          value={search} onChange={(e) => setSearch(e.target.value)} 
          className="pl-12 h-14 border-2 shadow-sm font-black text-base bg-white" 
        />
      </div>

      <Card className="border-2 shadow-md bg-muted/10">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Filter className="size-3" /> Paramètres de tri</div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-6 text-[9px] font-black uppercase text-primary">Reset</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Région</Label>
                <Select value={filterRegion} onValueChange={(v) => { setFilterRegion(v); setFilterCommune('ALL'); }}>
                    <SelectTrigger className="h-10 border-2 bg-white font-black uppercase text-xs"><Globe className="size-3 mr-2" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="USER_DEFAULT" className="font-black text-xs text-primary uppercase italic">Focus : {userRegion}</SelectItem>
                        <SelectItem value="ALL" className="font-black text-xs uppercase">Tout</SelectItem>
                        {regions.map(reg => <SelectItem key={reg} value={reg} className="font-black text-xs uppercase">{reg}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Commune</Label>
                <Select value={filterCommune} onValueChange={setFilterCommune}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs"><MapPin className="size-3 mr-2" /><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="USER_DEFAULT" className="font-black text-xs text-primary uppercase italic">Focus : {userCommune}</SelectItem>
                        <SelectItem value="ALL" className="font-bold text-xs">Tout</SelectItem>
                        {availableCommunes.map(loc => <SelectItem key={loc} value={loc} className="text-xs font-bold">{loc}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {promosError && <Alert variant="destructive"><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger le catalogue.</AlertDescription></Alert>}
        {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
            </div>
        ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((item) => (
                    <ProductCard key={item.id} product={item} onContact={handleOpenContact} onViewDetail={() => setSelectedProductForDetail(item)} onDelete={(id, bid) => setProductToDelete({id, businessId: bid})} isAdmin={isAdmin} />
                ))}
            </div>
        ) : (
            <div className="text-center py-20 border-4 border-dashed rounded-[2.5rem] opacity-30">
                <ShoppingBag className="size-12 mb-2 mx-auto" />
                <p className="font-black uppercase text-sm">Aucun produit</p>
            </div>
        )}
      </div>

      {/* DETAIL DIALOGS & LIGHTBOX */}
      <Dialog open={!!selectedProductForDetail} onOpenChange={(open) => !open && setSelectedProductForDetail(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] flex flex-col">
            {selectedProductForDetail && (
                <>
                    <div className="h-64 sm:h-80 bg-white relative shrink-0">
                        <button onClick={() => setSelectedProductForDetail(null)} className="absolute top-4 right-4 z-[160] p-2 bg-black/20 rounded-full text-white"><X className="size-5" /></button>
                        {selectedProductForDetail.images && selectedProductForDetail.images.length > 0 ? (
                            <Carousel setApi={setApi} className="w-full h-full">
                                <CarouselContent className="h-full ml-0">
                                    {selectedProductForDetail.images.map((img, idx) => (
                                        <CarouselItem key={idx} className="h-full pl-0" onClick={() => setFullscreenImage(img)}>
                                            <img src={img} className="w-full h-full object-contain p-4" alt="" />
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                            </Carousel>
                        ) : <div className="w-full h-full flex items-center justify-center opacity-20"><ImageIcon className="size-16" /></div>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                        <h2 className={cn("text-2xl font-black uppercase text-slate-800", selectedProductForDetail.isOutOfStock && "line-through decoration-red-600")}>{selectedProductForDetail.title}</h2>
                        <div className="flex items-center gap-2 text-primary font-black uppercase text-xs"><Store className="size-4" />{selectedProductForDetail.business?.name} <MapPin className="size-3" />{selectedProductForDetail.business?.commune}</div>
                        {selectedProductForDetail.isOutOfStock && <Alert variant="destructive" className="bg-red-50 border-red-200 border-2"><AlertCircle className="size-4" /><AlertDescription className="text-sm font-black text-red-700">RUPTURE - Retour le {selectedProductForDetail.restockDate}</AlertDescription></Alert>}
                        <div className="p-5 bg-muted/10 rounded-2xl border-2 border-dashed flex justify-between items-center">
                            <div className="flex items-baseline gap-2">
                                <span className={cn("text-4xl font-black", selectedProductForDetail.isOutOfStock ? "line-through opacity-40" : (selectedProductForDetail.promoType === 'Promo' ? "text-red-600" : "text-primary"))}>{(selectedProductForDetail.price || 0).toLocaleString('fr-FR')}</span>
                                <span className="text-xs font-black uppercase opacity-60">CFP</span>
                            </div>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-slate-600 italic">"{selectedProductForDetail.description || "Pas de description."}"</p>
                    </div>
                    <div className="p-4 bg-slate-50 border-t shrink-0"><Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl" onClick={() => { const id = selectedProductForDetail.businessId; setSelectedProductForDetail(null); handleOpenContact(id); }}>Contacter le magasin</Button></div>
                </>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle className="font-black uppercase flex items-center gap-2"><Store className="size-5" /> Contact Pro</DialogTitle></DialogHeader>
            <div className="p-6 space-y-4">
                {isLoadingContact ? <Skeleton className="h-12 w-full" /> : selectedBusinessContact && (
                    <div className="space-y-4">
                        <Button asChild className="w-full h-14 font-black uppercase shadow-lg gap-3"><a href={`tel:${selectedBusinessContact.phoneNumber}`}><Smartphone className="size-5" /> Appeler le mobile</a></Button>
                        <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed flex items-start gap-3"><Home className="size-4 text-primary" /><div><p className="text-[10px] font-black uppercase opacity-40">Adresse</p><p className="text-xs font-bold">{selectedBusinessContact.address || "Non renseignée"}</p></div></div>
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToDelete} onOpenChange={(o) => !o && setProductToDelete(null)}><AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Supprimer ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="h-12 font-black uppercase text-[10px] border-2">Non</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteProduct} className="h-12 font-black uppercase text-[10px] bg-destructive">Oui, supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function ProductCard({ product, onContact, onViewDetail, onDelete, isAdmin }: any) {
    const isPromo = product.promoType === 'Promo';
    const image = product.images?.[0] || product.imageUrl;
    return (
        <Card className={cn("overflow-hidden border-2 shadow-sm flex flex-col transition-all cursor-pointer", isPromo && "border-red-100 bg-red-50/10", product.isOutOfStock && "opacity-75")} onClick={onViewDetail}>
            <div className="px-3 py-2 bg-muted/20 border-b flex justify-between items-center"><div className="flex items-center gap-2 min-w-0"><Store className="size-3 text-primary" /><span className="text-[9px] font-black uppercase truncate">{product.business?.name}</span></div>{isAdmin && <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(product.id, product.businessId); }}><Trash2 className="size-3" /></Button>}</div>
            <div className="flex h-36 relative">
                <div className="w-32 bg-white shrink-0 flex items-center justify-center border-r p-2">{image ? <img src={image} className="max-w-full max-h-full object-contain" alt="" /> : <ShoppingBag className="size-8 opacity-10" />}<Badge className={cn("absolute top-1 left-1 font-black text-[8px] uppercase h-5", isPromo ? "bg-red-600" : "bg-primary")}>{product.promoType}</Badge></div>
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <h4 className={cn("font-black uppercase text-xs truncate", product.isOutOfStock && "line-through decoration-red-600")}>{product.title}</h4>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 italic">{product.description}</p>
                    <div className="flex items-baseline gap-1"><span className={cn("text-base font-black", product.isOutOfStock ? "line-through opacity-40" : (isPromo ? "text-red-600" : "text-primary"))}>{(product.price || 0).toLocaleString('fr-FR')}</span><span className="text-[9px] font-black uppercase opacity-60">CFP</span></div>
                </div>
            </div>
        </Card>
    );
}
