
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { navLinks } from '@/lib/nav-links';
import { cn } from '@/lib/utils';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { LogIn, User } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserAccount>(userDocRef);

  // Configuration par défaut si l'utilisateur n'a pas encore choisi de favoris
  const defaultTabs = ['/', '/peche', '/vessel-tracker', '/chasse', '/champs', '/compte'];
  
  // Utilisation des favoris de l'utilisateur ou de la configuration par défaut
  const userFavorites = userProfile?.favoriteNavLinks;
  const mobileTabs = (userFavorites && userFavorites.length > 0) ? userFavorites : defaultTabs;
  
  // On récupère les liens correspondants en respectant l'ordre défini
  const visibleLinks = mobileTabs.map(href => {
    const link = navLinks.find(l => l.href === href);
    if (!link) return null;
    
    // Sécurité supplémentaire : On vérifie si l'utilisateur a le droit de voir ce lien
    if (link.adminOnly && userProfile?.role !== 'admin' && userProfile?.subscriptionStatus !== 'admin') return null;
    if (link.proOnly && userProfile?.role !== 'professional' && userProfile?.role !== 'admin') return null;

    // Raccourcir le libellé pour le mobile
    if (link.href === '/vessel-tracker') return { ...link, label: 'Tracker' };
    return link;
  }).filter(Boolean);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[40] bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] h-[calc(4.2rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-between items-center h-16 px-0.5">
        {visibleLinks.map(link => {
          if (!link) return null;
          const isActive = pathname === link.href;
          const isCompte = link.href === '/compte';
          const label = (isCompte && !user) ? 'Login' : link.label;
          const Icon = link.icon;
          
          return (
            <Link
              href={isCompte && !user ? '/login' : link.href}
              key={link.href}
              className={cn(
                'flex flex-col items-center justify-center text-center flex-1 h-full transition-all active:scale-90 relative',
                isActive ? 'text-primary' : 'text-muted-foreground/60'
              )}
            >
              {/* Indicateur de sélection supérieur */}
              {isActive && (
                <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full shadow-[0_2px_8px_rgba(var(--primary),0.4)] animate-in fade-in zoom-in duration-300" />
              )}
              
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-300",
                isActive ? "bg-primary/10" : ""
              )}>
                <Icon className={cn("size-5", isActive && "stroke-[2.5px]")} />
              </div>
              
              <span className={cn(
                "text-[8px] font-black uppercase tracking-tighter leading-none mt-1 whitespace-nowrap",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
