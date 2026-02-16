
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { navLinks } from '@/lib/nav-links';
import { cn } from '@/lib/utils';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { useMemo } from 'react';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserAccount>(userDocRef);

  // Détection robuste des rôles pour le filtrage
  const roles = useMemo(() => {
    if (!user) return { isAdmin: false, isPro: false, isClient: true };
    
    // LISTE CONSOLIDÉE DES ADMINS
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com', 'kledostyle@hotmail.com', 'kledostyle@outlook.com'];
    const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2', 'koKj5ObSGXYeO1PLKU5bgo8Yaky1'];
    
    const isAdmin = masterEmails.includes(user.email?.toLowerCase() || '') || 
                    masterUids.includes(user.uid) || 
                    userProfile?.role === 'admin' || 
                    userProfile?.subscriptionStatus === 'admin';

    const isPro = isAdmin || 
                  userProfile?.role === 'professional' || 
                  userProfile?.subscriptionStatus === 'professional';
    
    return { isAdmin, isPro, isClient: !isAdmin && !isPro };
  }, [user, userProfile]);

  // Configuration par défaut
  const defaultTabs = ['/', '/peche', '/vessel-tracker', '/chasse', '/champs', '/compte'];
  const userFavorites = userProfile?.favoriteNavLinks;
  const mobileTabs = (userFavorites && userFavorites.length > 0) ? userFavorites : defaultTabs;
  
  const visibleLinks = mobileTabs.map(href => {
    const link = navLinks.find(l => l.href === href);
    if (!link) return null;
    
    if (link.adminOnly && !roles.isAdmin) return null;
    if (link.proOnly && !roles.isPro) return null;

    if (link.href === '/vessel-tracker') return { ...link, label: 'Tracker' };
    return link;
  }).filter(Boolean);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[40] bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] h-[calc(4.2rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-between items-center h-16 px-0.5 max-w-lg mx-auto">
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
