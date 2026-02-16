
'use client';

import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { UserAccount } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { navLinks } from '@/lib/nav-links';
import { useMemo } from 'react';


export function SidebarNav() {
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

  return (
    <div className="flex flex-col h-full">
      <SidebarMenu className="flex-grow">
        {navLinks.map((link) => {
          // FILTRAGE DYNAMIQUE BASÉ SUR LES RÔLES
          if (link.adminOnly && !roles.isAdmin) return null;
          if (link.proOnly && !roles.isPro) return null;
          
          return (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === link.href}
                tooltip={link.label}
              >
                <Link href={link.href}>
                  <link.icon />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
      
      <div className="px-4 py-4 mt-auto border-t border-sidebar-border bg-sidebar group-data-[collapsible=icon]:hidden">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          Rôle : {roles.isAdmin ? 'Administrateur' : roles.isPro ? 'Professionnel' : 'Client'}
        </p>
      </div>
    </div>
  );
}
