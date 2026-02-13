
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, collectionGroup, query, orderBy, doc } from 'firebase/firestore';
import type { Promotion, Business, UserAccount } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ShoppingBag, Store, MapPin, Tag, Percent, Sparkles, Filter, X, ChevronRight, Info } from 'lucide-react';
import { locations } from '@/lib/locations';
import { cn } from '@/lib/utils';

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

  // CRITICAL: We remove orderBy('createdAt') from collectionGroup to avoid 
  // the hard requirement of a composite index which might not be created yet.
  // The sorting will be handled in JS below.
  const promosRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collectionGroup(firestore, 'promotions');
  }, [firestore]);
  const { data: allPromotions, isLoading: isPromosLoading } = useCollection<Promotion>(promosRef);

  // --- FILTERS STATE ---
  const [search, setSearch] = useState('');
  const [filterCommune, setFilterCommune] = useState<string>('USER_DEFAULT'); // 'USER_DEFAULT' | 'ALL' | 'CommuneName'
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterBusiness, setFilterBusiness] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL'); // 'ALL' | 'Promo' | 'Nouvel Arrivage'

  const userCommune = profile?.lastSelectedLocation || 'Nouméa';

  // --- FILTERING & SORTING LOGIC ---
  const filteredProducts = useMemo(() => {
    if (!allPromotions || !businesses) return [];

    const businessMap = new Map(businesses.map(b => [b.id, b]));

    return allPromotions
      .map(promo => ({
        ...promo,
        business: businessMap.get(promo.businessId)
      }))
      .filter(item => {
        // 1. Validation: Item must belong to a known business
        if (!item.business) return false;

        // 2. Search filter
        const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                             (item.description?.toLowerCase() || '').includes(search.toLowerCase());
        if (!matchesSearch) return false;

        // 3. Commune filter
        if (filterCommune !== 'USER_DEFAULT' && filterCommune !== 'ALL') {
            if (item.business.commune !== filterCommune) return false;
        }

        // 4. Category filter
        if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;

        // 5. Business filter
        if (filterBusiness !== 'ALL' && item.businessId !== filterBusiness) return false;

        // 6. Type filter
        if (filterType !== 'ALL' && item.promoType !== filterType) return false;

        return true;
      })
      .sort((a, b) => {
        // A. Priority sorting: User's commune products first
        if (filterCommune === 'USER_DEFAULT') {
            const aInCommune = a.business?.commune === userCommune;
            const bInCommune = b.business?.commune === userCommune;
            if (aInCommune && !bInCommune) return -1;
            if (!aInCommune && bInCommune) return 1;
        }
        
        // B. Temporal sorting: Newest first (using createdAt if available)
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
  }, [allPromotions, businesses, search, filterCommune, filterCategory, filterBusiness, filterType, userCommune]);

  const resetFilters = () => {
    setSearch('');
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

      {/* --- BARRE DE RECHERCHE --- */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input 
          placeholder="Chercher un produit (ex: Moulinet, terreau...)" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-12 h-14 border-2 shadow-sm font-bold text-base bg-white" 
        />
      </div>

      {/* --- FILTRES --- */}
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
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Commune</Label>
                <Select value={filterCommune} onValueChange={setFilterCommune}>
                    <SelectTrigger className="h-10 border-2 bg-white font-bold text-xs">
                        <SelectValue placeholder="Toutes les communes" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="USER_DEFAULT" className="font-black text-xs text-primary uppercase">Mise en avant : {userCommune}</SelectItem>
                        <SelectItem value="ALL" className="font-bold text-xs">Toutes les communes</SelectItem>
                        {Object.keys(locations).sort().map(loc => (
                            <SelectItem key={loc} value={loc} className="text-xs">{loc}</SelectItem>
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
                            <SelectItem key={b.id} value={b.id} className="text-xs">{b.name} ({b.commune})</SelectItem>
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

      {/* --- LISTE DES PRODUITS --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Tag className="size-3" /> {filteredProducts.length} Produit{filteredProducts.length > 1 ? 's' : ''} disponible{filteredProducts.length > 1 ? 's' : ''}
            </h3>
            {filterCommune === 'USER_DEFAULT' && (
                <Badge variant="outline" className="text-[8px] h-4 font-black border-primary/30 text-primary uppercase">Priorité localité</Badge>
            )}
        </div>

        {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
            </div>
        ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((item) => (
                    <ProductCard key={item.id} product={item} />
                ))}
            </div>
        ) : (
            <div className="text-center py-20 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center gap-4 opacity-30">
                <div className="p-6 bg-muted rounded-full"><ShoppingBag className="size-12" /></div>
                <div className="space-y-1">
                    <p className="font-black uppercase tracking-widest text-sm">Aucun produit trouvé</p>
                    <p className="text-xs font-bold">Essayez d'élargir vos filtres de recherche.</p>
                </div>
                <Button variant="outline" onClick={resetFilters} className="mt-2 font-black uppercase text-[10px] border-2">Voir tout le catalogue NC</Button>
            </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Promotion & { business?: Business } }) {
    const isPromo = product.promoType === 'Promo';
    
    return (
        <Card className={cn(
            "overflow-hidden border-2 shadow-sm flex flex-col group transition-all hover:border-primary/40",
            isPromo && "border-red-100 bg-red-50/10"
        )}>
            {/* Store Header */}
            <div className="px-3 py-2 bg-muted/20 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="size-6 rounded-lg bg-white flex items-center justify-center border shadow-sm shrink-0">
                        <Store className="size-3 text-primary" />
                    </div>
                    <span className="text-[9px] font-black uppercase truncate text-slate-700">{product.business?.name}</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground shrink-0 bg-white/50 px-1.5 py-0.5 rounded border">
                    <MapPin className="size-2 text-primary" />
                    {product.business?.commune}
                </div>
            </div>

            <div className="flex min-h-[140px] h-auto">
                {/* Product Image */}
                <div className="w-32 bg-muted/20 shrink-0 relative flex items-center justify-center border-r">
                    {product.imageUrl ? (
                        <img src={product.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={product.title} />
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

                {/* Product Info */}
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
            
            {/* Footer Action */}
            <div className="p-2 border-t bg-muted/10">
                <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase text-primary gap-2 hover:bg-primary/5">
                    Contacter le magasin <ChevronRight className="size-3" />
                </Button>
            </div>
        </Card>
    );
}
