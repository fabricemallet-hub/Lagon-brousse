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

  // Détection robuste et instantanée des rôles
  const roles = useMemo(() => {
    if (!user) return { isAdmin: false, isPro: false, isClient: true };
    
    // Identifiants de confiance absolue (Administrateurs Master)
    const masterAdminUids = [
      't8nPnZLcTiaLJSKMuLzib3C5nPn1',
      'koKj5ObSGXYeO1PLKU5bgo8Yaky1',
      'D1q2GPM95rZi38cvCzvsjcWQDaV2',
      'K9cVYLVUk1NV99YV3anebkugpPp1',
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
      'Irglq69MasYdNwBmUu8yKvw6h4G2'
    ];

    const masterAdminEmails = [
      'f.mallet81@outlook.com',
      'fabrice.mallet@gmail.com', 
      'f.mallet81@gmail.com',
      'kledostyle@outlook.com'
    ];

    const userEmail = user.email?.toLowerCase() || '';

    // Détection Admin
    const isAdmin = masterAdminUids.includes(user.uid) || 
                    (userEmail && masterAdminEmails.includes(userEmail)) ||
                    userProfile?.role === 'admin' || 
                    userProfile?.subscriptionStatus === 'admin';

    // Détection Pro
    const isPro = isAdmin || 
                  userProfile?.role === 'professional' || 
                  userProfile?.subscriptionStatus === 'professional';
    
    // Un utilisateur est client s'il n'est ni admin ni pro
    const isClient = !isAdmin && !isPro;
    
    return { isAdmin, isPro, isClient };
  }, [user, userProfile]);

  return (
    <div className="flex flex-col h-full">
      <SidebarMenu className="flex-grow">
        {navLinks.map((link) => {
          // FILTRAGE DYNAMIQUE BASÉ SUR LES RÔLES
          
          // 1. Si le lien est réservé aux Admins et que l'utilisateur n'est pas Admin
          if (link.adminOnly && !roles.isAdmin) return null;
          
          // 2. Si le lien est réservé aux Pros et que l'utilisateur n'est pas Pro (ou Admin)
          if (link.proOnly && !roles.isPro) return null;
          
          // 3. Masquage du contact pour l'admin et les non-connectés
          if (link.href === '/contact' && (roles.isAdmin || !user)) return null;
          
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
