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

  // Détection robuste et prioritaire des rôles Admin
  const roles = useMemo(() => {
    if (!user) return { isAdmin: false, isPro: false };
    
    // Liste blanche technique (Priorité Haute pour Fabrice Mallet)
    const masterAdminUids = [
      'K9cVYLVUk1NV99YV3anebkugpPp1',
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
      'Irglq69MasYdNwBmUu8yKvw6h4G2',
      't8nPnZLcTiaLJSKMuLzib3C5nPn1'
    ];

    const masterAdminEmails = [
      'f.mallet81@outlook.com',
      'fabrice.mallet@gmail.com',
      'f.mallet81@gmail.com'
    ];

    const isExplicitAdmin = masterAdminUids.includes(user.uid) || 
                           (user.email && masterAdminEmails.includes(user.email.toLowerCase()));

    const isAdmin = isExplicitAdmin || 
                    userProfile?.subscriptionStatus === 'admin' || 
                    userProfile?.role === 'admin';

    const isPro = isAdmin || 
                  userProfile?.subscriptionStatus === 'professional' || 
                  userProfile?.role === 'professional';
    
    return { isAdmin, isPro };
  }, [user, userProfile]);

  return (
    <div className="flex flex-col h-full">
      <SidebarMenu className="flex-grow">
        {navLinks.map((link) => {
          // Filtrage dynamique selon les rôles
          if (link.adminOnly && !roles.isAdmin) return null;
          if (link.proOnly && !roles.isPro) return null;
          
          // Masquer Contact pour l'admin (il utilise le dashboard)
          if (link.href === '/contact' && roles.isAdmin) return null;
          if (link.href === '/contact' && !user) return null;
          
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
          Version 2.2.5
        </p>
      </div>
    </div>
  );
}