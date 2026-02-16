
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
    Maximize2
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
    
    const onSelect = () => {
      setActiveImageIdx(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
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
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com'];
    const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2'];
    return masterEmails.includes(user.email?.toLowerCase() || '') || masterUids.includes(user.uid) || profile?.role === 'admin' || profile?.subscriptionStatus === 'admin';
  }, [user, profile]);

  const confirmDeleteProduct = async () => {
    if (!firestore || !isAdmin || !productToDelete) return;
    
    try {
        await deleteDoc(doc(firestore, 'businesses', productToDelete.businessId, 'promotions', productToDelete.id));
        toast({ title: "Annonce supprimée avec succès" });
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur suppression", description: "Vérifiez vos droits administrateur." });
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
      .map(promo => ({
        ...promo,
        business: businessMap.get(promo.businessId)
      }))
      .filter(item => {
        const matchesSearch = !search || 
                             item.title.toLowerCase().includes(search.toLowerCase()) || 
                             (item.description?.toLowerCase() || '').includes(search.toLowerCase());
        if (!matchesSearch) return false;

        if (currentFRegion !== 'ALL') {
            const itemCommune = item.business?.commune;
            if (itemCommune) {
                const isTahiti = Object.keys(locationsByRegion['TAHITI']).includes(itemCommune);
                const itemRegion = isTahiti ? 'TAHITI' : 'CALEDONIE';
                if (itemRegion !== currentFRegion) return false;
            } else {
                return false; 
            }
        }

        if (currentFCommune !== 'ALL') {
            if (item.business && item.business.commune !== currentFCommune) return false;
            if (!item.business) return false; 
        }

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
        
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
  }, [allPromotions, businesses, search, filterRegion, filterCommune, filterCategory, filterBusiness, filterType, userRegion, userCommune]);

  const availableCommunes = useMemo(() => {
    const currentFRegion = filterRegion === 'USER_DEFAULT' ? userRegion : filterRegion;
    if (currentFRegion === 'ALL') return Object.keys(locations).sort();
    return Object.keys(locationsByRegion[currentFRegion as Region] || {}).sort();
  }, [filterRegion, userRegion]);

  const resetFilters = () => {
    setSearch('');
    setFilterRegion('USER_DEFAULT');
    setFilterCommune('USER_DEFAULT');
    setFilterCategory('ALL');
    setFilterBusiness('ALL');
    setFilterType('ALL');
  };

  const isLoading = isBusinessesLoading || isPromosLoading;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">
            <ShoppingBag className="text-primary size-7" /> Le Shopping NC
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase opacity-60">
            Découvrez les offres et nouveautés de vos magasins locaux.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input 
          placeholder="Chercher un produit (ex: Moulinet, terreau...)" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-12 h-14 border-2 shadow-sm font-black text-base bg-white" 
        />
      </div>

      <Card className="border-2 shadow-md bg-muted/10">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                <Filter className="size-3" /> Paramètres de tri
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-6 text-[9px] font-black uppercase text-primary">Réinitialiser</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Région</Label>
                <Select value={filterRegion} onValueChange={(v) => { setFilterRegion(v); setFilterCommune('ALL'); }}>
                    <SelectTrigger className="h-10 border-2 bg-white font-black uppercase text-xs">
                        <Globe className="size-3 mr-2 text-primary" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="USER_DEFAULT" className="font-black text-xs text-primary uppercase italic">Mise en avant : {userRegion}</SelectItem>
                        <SelectItem value="ALL" className="font-black text-xs uppercase">Toutes les régions</SelectItem>
                        {regions.map(reg => (
                            <SelectItem key={reg} value={reg} className="font-black text-xs uppercase">{reg}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Commune</Label>
                <Select value={filterCommune} onValueChange={setFilterCommune}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs">
                        <MapPin className="size-3 mr-2 text-primary" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="USER_DEFAULT" className="font-black text-xs text-primary uppercase italic">Mise en avant : {userCommune}</SelectItem>
                        <SelectItem value="ALL" className="font-bold text-xs">Toutes les communes</SelectItem>
                        {availableCommunes.map(loc => (
                            <SelectItem key={loc} value={loc} className="text-xs font-bold">{loc}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Magasin</Label>
                <Select value={filterBusiness} onValueChange={setFilterBusiness}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs">
                        <SelectValue placeholder="Tous les magasins" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="ALL" className="font-bold text-xs">Tous les magasins</SelectItem>
                        {businesses?.map(b => (
                            <SelectItem key={b.id} value={b.id} className="text-xs font-bold">{b.name} ({b.commune})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Catégorie</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs">
                        <SelectValue placeholder="Toutes les catégories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL" className="font-bold text-xs">Toutes les catégories</SelectItem>
                        <SelectItem value="Pêche" className="text-xs font-bold text-blue-600">Pêche</SelectItem>
                        <SelectItem value="Chasse" className="text-xs font-bold text-orange-600">Chasse</SelectItem>
                        <SelectItem value="Jardinage" className="text-xs font-bold text-green-600">Jardinage</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Type d'offre</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs">
                        <SelectValue placeholder="Toutes les offres" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL" className="font-bold text-xs">Tous types</SelectItem>
                        <SelectItem value="Promo" className="text-xs font-bold text-red-600">Promotions</SelectItem>
                        <SelectItem value="Nouvel Arrivage" className="text-xs font-bold text-primary">Nouveautés</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {promosError && (
            <Alert variant="destructive" className="border-2 animate-in fade-in bg-red-50 text-red-900 border-red-200">
                <AlertTriangle className="size-4 text-red-600" />
                <AlertTitle className="text-xs font-black uppercase">ERREUR DE PERMISSIONS</AlertTitle>
                <AlertDescription className="text-[10px] font-bold leading-tight mt-1">
                    Firestore bloque l'accès au catalogue global. Rafraîchissez la page ou vérifiez les règles Master Admin.
                </AlertDescription>
            </Alert>
        )}

        <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Tag className="size-3" /> {filteredProducts.length} Article{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
            </h3>
            {filterCommune === 'USER_DEFAULT' && (
                <Badge variant="outline" className="text-[8px] h-4 font-black border-primary/30 text-primary uppercase">Priorité {userCommune}</Badge>
            )}
        </div>

        {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
            </div>
        ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((item) => (
                    <ProductCard 
                        key={item.id} 
                        product={item} 
                        onContact={handleOpenContact} 
                        onViewDetail={() => setSelectedProductForDetail(item)}
                        onDelete={(id, bid) => setProductToDelete({id, businessId: bid})}
                        isAdmin={isAdmin}
                    />
                ))}
            </div>
        ) : (
            <div className="text-center py-20 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 opacity-30">
                <ShoppingBag className="size-12 mb-2" />
                <div className="space-y-1">
                    <h3 className="font-black uppercase tracking-widest text-sm">Aucun produit visible</h3>
                    <p className="text-[10px] font-bold uppercase">Vérifiez vos filtres ou tentez de rafraîchir la page.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-10 font-black uppercase text-[10px] mt-2 border-2 gap-2">
                    <RefreshCw className="size-3" /> Rafraîchir
                </Button>
            </div>
        )}
      </div>

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight text-destructive flex items-center gap-2">
              <AlertCircle className="size-5" /> Supprimer l'annonce ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed">
              Êtes-vous sûr de vouloir supprimer cette annonce définitivement ? Cette action est irréversible et l'annonce disparaîtra pour tous les utilisateurs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12 font-black uppercase text-[10px] border-2">Annuler</AlertDialogCancel>
            <AlertDialogAction 
                onClick={confirmDeleteProduct} 
                className="h-12 font-black uppercase text-[10px] bg-destructive hover:bg-destructive/90"
            >
                Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* LIGHTBOX POUR ZOOM TACTILE */}
      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-[100vw] w-full h-[100dvh] p-0 bg-black/95 border-none rounded-none overflow-hidden flex flex-col z-[200]">
            <DialogHeader className="sr-only">
                <DialogTitle>Zoom produit</DialogTitle>
                <DialogDescription>Agrandissement de la photo pour visualisation détaillée.</DialogDescription>
            </DialogHeader>
            <div className="relative flex-1 flex items-center justify-center">
                <button 
                    onClick={() => setFullscreenImage(null)}
                    className="absolute top-6 right-6 z-[210] p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                >
                    <X className="size-6" />
                </button>
                {fullscreenImage && (
                    <img 
                        src={fullscreenImage} 
                        className="max-w-full max-h-full object-contain animate-in zoom-in-95 duration-300" 
                        alt="Zoom produit" 
                    />
                )}
            </div>
            <div className="p-6 bg-black/40 backdrop-blur-md text-white/60 text-center font-black uppercase text-[10px] tracking-[0.2em]">
                Pincez pour zoomer
            </div>
        </DialogContent>
      </Dialog>

      {/* VUE DÉTAILLÉE DU PRODUIT */}
      <Dialog open={!!selectedProductForDetail} onOpenChange={(open) => !open && setSelectedProductForDetail(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] flex flex-col">
            {selectedProductForDetail && (
                <>
                    <DialogHeader className="p-0 relative shrink-0">
                        <DialogTitle className="sr-only">{selectedProductForDetail.title}</DialogTitle>
                        <DialogDescription className="sr-only">Détails de l'offre publicitaire du magasin {selectedProductForDetail.business?.name}</DialogDescription>
                        
                        <button 
                            onClick={() => setSelectedProductForDetail(null)}
                            className="absolute top-4 right-4 z-[160] p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-colors shadow-lg"
                        >
                            <X className="size-5" />
                        </button>
                        
                        <div className="h-64 sm:h-80 bg-white relative overflow-hidden group border-b shrink-0">
                            {selectedProductForDetail.images && selectedProductForDetail.images.length > 0 ? (
                                <Carousel setApi={setApi} className="w-full h-full">
                                    <CarouselContent className="h-full ml-0">
                                        {selectedProductForDetail.images.map((img, idx) => (
                                            <CarouselItem key={idx} className="h-full pl-0">
                                                <div 
                                                    className="w-full h-full flex items-center justify-center bg-white p-6 cursor-zoom-in"
                                                    onClick={() => setFullscreenImage(img)}
                                                >
                                                    <img 
                                                        src={img} 
                                                        className="max-w-full max-h-full object-contain" 
                                                        alt={`${selectedProductForDetail.title} - ${idx + 1}`} 
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <div className="p-3 bg-white/90 rounded-full shadow-xl text-primary flex items-center gap-2 font-black uppercase text-[10px]">
                                                            <Maximize2 className="size-4" /> Agrandir
                                                        </div>
                                                    </div>
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    {selectedProductForDetail.images.length > 1 && (
                                        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 px-4 z-[160]">
                                            {selectedProductForDetail.images.map((_, idx) => (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => api?.scrollTo(idx)}
                                                    className={cn(
                                                        "size-2 rounded-full transition-all shadow-md",
                                                        activeImageIdx === idx ? "bg-primary w-6" : "bg-black/20 hover:bg-black/40"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </Carousel>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30 bg-white">
                                    <ImageIcon className="size-16" />
                                    <span className="font-black uppercase text-[10px] mt-2">Aucun visuel</span>
                                </div>
                            )}
                            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                                <Badge className={cn(
                                    "font-black text-[10px] uppercase border-none shadow-lg px-3 h-7",
                                    selectedProductForDetail.promoType === 'Promo' ? "bg-red-600 animate-pulse" : "bg-primary"
                                )}>
                                    {selectedProductForDetail.promoType}
                                </Badge>
                                <Badge variant="outline" className="bg-white/90 backdrop-blur-md border-none text-slate-800 font-black text-[9px] uppercase shadow-lg">
                                    {selectedProductForDetail.category}
                                </Badge>
                            </div>
                            {selectedProductForDetail.isOutOfStock && (
                                <div className="absolute inset-0 bg-red-600/40 flex items-center justify-center z-30">
                                    <Badge className="bg-red-600 text-white font-black text-lg py-2 px-6 shadow-2xl border-2 border-white/20">STOCK ÉPUISÉ</Badge>
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto bg-white p-6 space-y-6 scrollbar-hide">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black uppercase tracking-tighter leading-tight text-slate-800">
                                {selectedProductForDetail.title}
                            </h2>
                            <div className="flex items-center gap-2 text-primary">
                                <Store className="size-4" />
                                <span className="text-xs font-black uppercase">{selectedProductForDetail.business?.name}</span>
                                <span className="text-slate-300">•</span>
                                <MapPin className="size-3" />
                                <span className="text-[10px] font-bold uppercase">{selectedProductForDetail.business?.commune}</span>
                            </div>
                        </div>

                        {selectedProductForDetail.isOutOfStock && (
                            <Alert variant="destructive" className="bg-red-50 border-red-200 border-2">
                                <AlertCircle className="size-4 text-red-600" />
                                <AlertTitle className="text-xs font-black uppercase">Article indisponible</AlertTitle>
                                <AlertDescription className="text-sm font-black text-red-700 mt-1">
                                    STOCK ÉPUISÉ - Commande prévue le : {selectedProductForDetail.nextArrival || "Prochainement"}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="p-5 bg-muted/10 rounded-2xl border-2 border-dashed border-primary/10 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Prix de vente</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                        "text-4xl font-black tracking-tighter",
                                        selectedProductForDetail.promoType === 'Promo' ? "text-red-600" : "text-primary"
                                    )}>
                                        {(selectedProductForDetail.price || 0).toLocaleString('fr-FR').replace(/\s/g, ' ')}
                                    </span>
                                    <span className="text-xs font-black uppercase opacity-60">CFP</span>
                                </div>
                            </div>
                            
                            {selectedProductForDetail.promoType === 'Promo' && selectedProductForDetail.originalPrice && (
                                <div className="text-right flex flex-col items-end gap-1">
                                    <span className="text-sm text-muted-foreground line-through font-bold">{selectedProductForDetail.originalPrice.toLocaleString('fr-FR').replace(/\s/g, ' ')} F</span>
                                    {selectedProductForDetail.discountPercentage && (
                                        <Badge className="bg-red-600 text-white font-black text-sm px-2 py-1 rounded-lg shadow-lg border-none">
                                            -{Math.round(selectedProductForDetail.discountPercentage)}%
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pb-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <FileText className="size-3" /> Description de l'offre
                            </h3>
                            <p className="text-sm font-medium leading-relaxed text-slate-600 whitespace-pre-wrap italic">
                                {selectedProductForDetail.description || "Aucun détail complémentaire fourni pour cet article."}
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col gap-2 shrink-0">
                        <Button 
                            className="w-full h-14 font-black uppercase tracking-widest shadow-xl gap-2 text-base"
                            onClick={() => {
                                const id = selectedProductForDetail.businessId;
                                setSelectedProductForDetail(null);
                                handleOpenContact(id);
                            }}
                        >
                            Contacter le magasin <ChevronRight className="size-5" />
                        </Button>
                        {isAdmin && (
                            <Button 
                                variant="ghost"
                                className="w-full text-destructive font-black uppercase text-[10px]"
                                onClick={() => {
                                    const pid = selectedProductForDetail.id;
                                    const bid = selectedProductForDetail.businessId;
                                    setSelectedProductForDetail(null);
                                    setProductToDelete({id: pid, businessId: bid});
                                }}
                            >
                                <Trash2 className="size-3 mr-2" /> Supprimer cette annonce (Admin)
                            </Button>
                        )}
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>

      {/* MODAL CONTACT MAGASIN */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-slate-50 border-b">
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                    <Store className="size-5 text-primary" /> Contact Magasin
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase">
                    {selectedBusinessContact?.name}
                </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-6">
                {isLoadingContact ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                ) : selectedBusinessContact ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                            <Button asChild className="h-14 font-black uppercase tracking-widest shadow-lg gap-3 text-base">
                                <a href={`tel:${selectedBusinessContact.phoneNumber}`}>
                                    <Smartphone className="size-5" /> Appeler le mobile
                                </a>
                            </Button>
                            {selectedBusinessContact.landline && (
                                <Button asChild variant="outline" className="h-12 font-black uppercase tracking-widest border-2 gap-3">
                                    <a href={`tel:${selectedBusinessContact.landline}`}>
                                        <Phone className="size-4" /> Ligne Fixe
                                    </a>
                                </Button>
                            )}
                        </div>

                        <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-3">
                            <div className="flex items-start gap-3">
                                <Home className="size-4 text-primary shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground">Adresse physique</p>
                                    <p className="text-xs font-bold leading-tight">{selectedBusinessContact.address || "Non renseignée"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground">Commune</p>
                                    <p className="text-xs font-bold">{selectedBusinessContact.commune}</p>
                                </div>
                            </div>
                        </div>

                        {selectedBusinessContact.location && (
                            <Button asChild variant="secondary" className="w-full h-12 font-black uppercase tracking-widest gap-2">
                                <a 
                                    href={`https://www.google.com/maps?q=${selectedBusinessContact.location.latitude},${selectedBusinessContact.location.longitude}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                >
                                    <Navigation className="size-4" /> Itinéraire GPS
                                </a>
                            </Button>
                        )}
                    </div>
                ) : (
                    <p className="text-center text-sm italic opacity-60">Impossible de charger les coordonnées.</p>
                )}
            </div>
            <DialogFooter className="p-4 bg-muted/5 border-t">
                <Button variant="ghost" className="w-full font-black uppercase text-[10px]" onClick={() => setIsContactDialogOpen(false)}>Fermer</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ 
    product, 
    onContact, 
    onViewDetail,
    onDelete,
    isAdmin
}: { 
    product: Promotion & { business?: Business }, 
    onContact: (id: string) => void,
    onViewDetail: () => void,
    onDelete: (id: string, businessId: string) => void,
    isAdmin: boolean
}) {
    const isPromo = product.promoType === 'Promo';
    const images = product.images || (product.imageUrl ? [product.imageUrl] : []);
    const isOutOfStock = product.isOutOfStock;
    
    return (
        <Card 
            className={cn(
                "overflow-hidden border-2 shadow-sm flex flex-col group transition-all hover:border-primary/40 cursor-pointer active:scale-[0.98]",
                isPromo && "border-red-100 bg-red-50/10",
                isOutOfStock && "opacity-75 border-red-200 grayscale-[0.3]"
            )}
            onClick={onViewDetail}
        >
            <div className="px-3 py-2 bg-muted/20 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="size-6 rounded-lg bg-white flex items-center justify-center border shadow-sm shrink-0">
                        <Store className="size-3 text-primary" />
                    </div>
                    <span className="text-[9px] font-black uppercase truncate text-slate-700">
                        {product.business?.name || "Magasin NC"}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-6 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(product.id, product.businessId);
                            }}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    )}
                    <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground shrink-0 bg-white/50 px-1.5 py-0.5 rounded border">
                        <MapPin className="size-2 text-primary" />
                        {product.business?.commune || "NC"}
                    </div>
                </div>
            </div>

            <div className="flex min-h-[140px] h-auto relative">
                {isOutOfStock && (
                    <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[8px] font-black uppercase text-center py-1 z-30 shadow-lg animate-in slide-in-from-top duration-300">
                        STOCK ÉPUISÉ
                    </div>
                )}
                
                <div className="w-32 bg-white shrink-0 relative flex items-center justify-center border-r overflow-hidden p-3">
                    {images.length > 0 ? (
                        <>
                            <img src={images[0]} className="max-w-full max-h-full object-contain transition-transform group-hover:scale-105" alt={product.title} />
                            {images.length > 1 && (
                                <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md text-white font-black text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg border border-white/10">
                                    <ImageIcon className="size-2" />
                                    {images.length}
                                </div>
                            )}
                        </>
                    ) : (
                        <ShoppingBag className="size-10 text-muted-foreground/20" />
                    )}
                    <Badge className={cn(
                        "absolute top-1 left-1 font-black text-[8px] uppercase border-none shadow-md px-2 h-5",
                        isPromo ? "bg-red-600 animate-pulse" : "bg-primary"
                    )}>
                        {product.promoType}
                    </Badge>
                </div>

                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div className="space-y-1">
                        <div className="flex justify-between items-start gap-2">
                            <h4 className="font-black uppercase text-xs leading-none break-words flex-1">{product.title}</h4>
                            <Badge variant="outline" className="text-[7px] h-3.5 px-1 font-black uppercase border-muted-foreground/30 shrink-0">{product.category}</Badge>
                        </div>
                        
                        {isOutOfStock ? (
                            <p className="text-[10px] font-black text-red-600 uppercase mt-1 leading-tight animate-pulse">
                                STOCK ÉPUISÉ - Commande prévue le : {product.nextArrival || "Prochainement"}
                            </p>
                        ) : (
                            <p className="text-[10px] text-muted-foreground leading-tight break-words italic line-clamp-3">
                                {product.description || "Aucune description disponible."}
                            </p>
                        )}
                    </div>

                    <div className="flex items-end justify-between mt-3">
                        <div className="flex flex-col">
                            {isPromo && product.originalPrice && (
                                <span className="text-[9px] text-muted-foreground line-through font-bold">{product.originalPrice.toLocaleString('fr-FR').replace(/\s/g, ' ')} F</span>
                            )}
                            <div className="flex items-baseline gap-1">
                                <span className={cn("text-base font-black leading-none", isPromo ? "text-red-600" : "text-primary")}>
                                    {(product.price || 0).toLocaleString('fr-FR').replace(/\s/g, ' ')}
                                </span>
                                <span className="text-[9px] font-black uppercase opacity-60">CFP</span>
                            </div>
                        </div>

                        {isPromo && product.discountPercentage && (
                            <div className="flex flex-col items-end">
                                <div className="bg-red-600 text-white font-black text-[11px] px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 animate-in zoom-in-95">
                                    <Percent className="size-3" />
                                    {Math.round(product.discountPercentage)}%
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="p-2 border-t bg-muted/10" onClick={(e) => e.stopPropagation()}>
                <Button 
                    variant="ghost" 
                    className="w-full h-10 text-[9px] font-black uppercase text-primary gap-2 hover:bg-primary/5 active:scale-95 transition-transform"
                    onClick={() => onContact(product.businessId)}
                >
                    Contacter le magasin <ChevronRight className="size-3" />
                </Button>
            </div>
        </Card>
    );
}
