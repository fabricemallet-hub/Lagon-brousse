'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, orderBy, doc, getDoc } from 'firebase/firestore';
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
    Search, 
    ShoppingBag, 
    Store, 
    MapPin, 
    Tag, 
    Percent, 
    Filter, 
    RefreshCw, 
    AlertTriangle, 
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
    FileText
} from 'lucide-react';
import { locations, locationsByRegion, regions } from '@/lib/locations';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function ShoppingPage() {
  const { user } = useUser();
  const firestore = useFirestore();

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

  // --- CONTACT DIALOG STATE ---
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedBusinessContact, setSelectedBusinessContact] = useState<Business | null>(null);
  const [isLoadingContact, setIsLoadingContact] = useState(false);

  useEffect(() => {
    if (selectedProductForDetail) setActiveImageIdx(0);
  }, [selectedProductForDetail]);

  const handleOpenContact = async (businessId: string) => {
    setIsLoadingContact(true);
    setIsContactDialogOpen(true);
    if (!firestore) return;
    
    try {
        const bSnap = await getDoc(doc(firestore, 'businesses', businessId));
        if (bSnap.exists()) {
            const bData = bSnap.data() as Business;
            // On enrichit avec les données du propriétaire si les champs business sont vides
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

  // --- LOGIQUE DE FILTRAGE ---
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

        // Filtre Région
        if (currentFRegion !== 'ALL') {
            const itemCommune = item.business?.commune;
            if (itemCommune) {
                // Déterminer la région du produit basée sur la commune
                const isTahiti = Object.keys(locationsByRegion['TAHITI']).includes(itemCommune);
                const itemRegion = isTahiti ? 'TAHITI' : 'CALEDONIE';
                if (itemRegion !== currentFRegion) return false;
            } else {
                return false; 
            }
        }

        // Filtre Commune
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
        // Priorité à la commune de l'utilisateur si on est en mode USER_DEFAULT
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
  
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return (user.email?.toLowerCase() === 'f.mallet81@outlook.com' || user.uid === 't8nPnZLcTiaLJSKMuLzib3C5nPn1') || profile?.role === 'admin' || profile?.subscriptionStatus === 'admin';
  }, [user, profile]);

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

      {/* MODAL DÉTAIL PRODUIT */}
      <Dialog open={!!selectedProductForDetail} onOpenChange={(open) => !open && setSelectedProductForDetail(null)}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] flex flex-col">
            {selectedProductForDetail && (
                <>
                    <DialogHeader className="p-0 relative shrink-0">
                        <DialogTitle className="sr-only">{selectedProductForDetail.title}</DialogTitle>
                        <DialogDescription className="sr-only">Détails de l'offre publicitaire du magasin {selectedProductForDetail.business?.name}</DialogDescription>
                        
                        <button 
                            onClick={() => setSelectedProductForDetail(null)}
                            className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-colors shadow-lg"
                        >
                            <X className="size-5" />
                        </button>
                        
                        <div className="aspect-video sm:aspect-[16/9] bg-muted relative overflow-hidden">
                            {selectedProductForDetail.images && selectedProductForDetail.images.length > 0 ? (
                                <>
                                    <img 
                                        src={selectedProductForDetail.images[activeImageIdx]} 
                                        className="w-full h-full object-cover animate-in fade-in duration-500" 
                                        alt={selectedProductForDetail.title} 
                                    />
                                    {selectedProductForDetail.images.length > 1 && (
                                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
                                            {selectedProductForDetail.images.map((_, idx) => (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => setActiveImageIdx(idx)}
                                                    className={cn(
                                                        "size-2 rounded-full transition-all shadow-md",
                                                        activeImageIdx === idx ? "bg-primary w-6" : "bg-white/60 hover:bg-white"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                                    <ImageIcon className="size-16" />
                                    <span className="font-black uppercase text-[10px] mt-2">Aucun visuel</span>
                                </div>
                            )}
                            <div className="absolute top-4 left-4 flex flex-col gap-2">
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

                        <div className="p-5 bg-muted/10 rounded-2xl border-2 border-dashed border-primary/10 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Prix de vente</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                        "text-4xl font-black tracking-tighter",
                                        selectedProductForDetail.promoType === 'Promo' ? "text-red-600" : "text-primary"
                                    )}>
                                        {selectedProductForDetail.price}
                                    </span>
                                    <span className="text-xs font-black uppercase opacity-60">FCFP</span>
                                </div>
                            </div>
                            
                            {selectedProductForDetail.promoType === 'Promo' && selectedProductForDetail.originalPrice && (
                                <div className="text-right flex flex-col items-end gap-1">
                                    <span className="text-sm text-muted-foreground line-through font-bold">{selectedProductForDetail.originalPrice} F</span>
                                    {selectedProductForDetail.discountPercentage && (
                                        <Badge className="bg-red-600 text-white font-black text-sm px-2 py-1 rounded-lg shadow-lg border-none">
                                            -{Math.round(selectedProductForDetail.discountPercentage)}%
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
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
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 bg-primary text-white border-b relative">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter pr-8 break-words">
                    {selectedBusinessContact?.name || "Chargement..."}
                </DialogTitle>
                <DialogDescription className="text-white/70 font-bold uppercase text-[10px]">Coordonnées de l'établissement</DialogDescription>
                <button onClick={() => setIsContactDialogOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="size-6" /></button>
            </DialogHeader>
            <div className="p-6 space-y-6 bg-slate-50">
                {isLoadingContact ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : selectedBusinessContact ? (
                    <div className="space-y-5 animate-in fade-in">
                        <div className="grid grid-cols-1 gap-3">
                            {selectedBusinessContact.phoneNumber && (
                                <a href={`tel:${selectedBusinessContact.phoneNumber}`} className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 shadow-sm active:scale-[0.98] transition-transform">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-green-50 text-green-600 rounded-xl"><Smartphone className="size-5" /></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-black uppercase opacity-40">Mobile</span><span className="font-black text-lg">{selectedBusinessContact.phoneNumber}</span></div>
                                    </div>
                                    <ChevronRight className="size-5 opacity-20" />
                                </a>
                            )}
                            {selectedBusinessContact.landline && (
                                <a href={`tel:${selectedBusinessContact.landline}`} className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 shadow-sm active:scale-[0.98] transition-transform">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Phone className="size-5" /></div>
                                        <div className="flex flex-col"><span className="text-[9px] font-black uppercase opacity-40">Fixe</span><span className="font-black text-lg">{selectedBusinessContact.landline}</span></div>
                                    </div>
                                    <ChevronRight className="size-5 opacity-20" />
                                </a>
                            )}
                        </div>

                        <div className="p-4 bg-white rounded-2xl border-2 shadow-sm space-y-3">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-primary/5 text-primary rounded-xl shrink-0"><Home className="size-5" /></div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase opacity-40">Adresse physique</span>
                                    <p className="text-sm font-bold leading-relaxed">{selectedBusinessContact.address || `Commune de ${selectedBusinessContact.commune}`}</p>
                                </div>
                            </div>
                            
                            {selectedBusinessContact.location && (
                                <div className="pt-3 border-t border-dashed">
                                    <Button 
                                        className="w-full h-14 bg-slate-900 text-white font-black uppercase tracking-widest gap-3 shadow-lg rounded-xl"
                                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedBusinessContact.location!.latitude},${selectedBusinessContact.location!.longitude}`, '_blank')}
                                    >
                                        <Navigation className="size-5 text-primary" /> S'y rendre (GPS)
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : <p className="text-center text-xs font-bold opacity-40 uppercase py-10">Aucune information trouvée</p>}
            </div>
            <DialogFooter className="p-4 bg-white border-t">
                <Button variant="outline" onClick={() => setIsContactDialogOpen(false)} className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2">Fermer la fiche</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ 
    product, 
    onContact, 
    onViewDetail 
}: { 
    product: Promotion & { business?: Business }, 
    onContact: (id: string) => void,
    onViewDetail: () => void 
}) {
    const isPromo = product.promoType === 'Promo';
    const images = product.images || (product.imageUrl ? [product.imageUrl] : []);
    
    return (
        <Card 
            className={cn(
                "overflow-hidden border-2 shadow-sm flex flex-col group transition-all hover:border-primary/40 cursor-pointer active:scale-[0.98]",
                isPromo && "border-red-100 bg-red-50/10"
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
                <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground shrink-0 bg-white/50 px-1.5 py-0.5 rounded border">
                    <MapPin className="size-2 text-primary" />
                    {product.business?.commune || "NC"}
                </div>
            </div>

            <div className="flex min-h-[140px] h-auto">
                <div className="w-32 bg-muted/20 shrink-0 relative flex items-center justify-center border-r overflow-hidden">
                    {images.length > 0 ? (
                        <>
                            <img src={images[0]} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={product.title} />
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
                        "absolute top-1 left-1 font-black text-[8px] uppercase border-none shadow-md",
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
                        <p className="text-[10px] text-muted-foreground leading-tight break-words italic line-clamp-3">
                            {product.description || "Aucune description disponible."}
                        </p>
                    </div>

                    <div className="flex items-end justify-between mt-3">
                        <div className="flex flex-col">
                            {isPromo && product.originalPrice && (
                                <span className="text-[9px] text-muted-foreground line-through font-bold">{product.originalPrice} F</span>
                            )}
                            <div className="flex items-baseline gap-1">
                                <span className={cn("text-base font-black leading-none", isPromo ? "text-red-600" : "text-primary")}>
                                    {product.price}
                                </span>
                                <span className="text-[9px] font-black uppercase opacity-60">FCFP</span>
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