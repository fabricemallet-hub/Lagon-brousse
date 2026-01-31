'use client';

import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Home, Waves, Leaf, Fish, Calendar, Scale, Crosshair, User, Shield } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { UserAccount } from '@/lib/types';
import { doc } from 'firebase/firestore';


const links = [
  { href: '/', label: 'Accueil', icon: Home, adminOnly: false },
  { href: '/lagon', label: 'Lagon', icon: Waves, adminOnly: false },
  { href: '/peche', label: 'Pêche', icon: Fish, adminOnly: false },
  { href: '/chasse', label: 'Chasse', icon: Crosshair, adminOnly: false },
  { href: '/champs', label: 'Champs', icon: Leaf, adminOnly: false },
  { href: '/calendrier', label: 'Calendrier', icon: Calendar, adminOnly: false },
  { href: '/reglementation', label: 'Réglementation', icon: Scale, adminOnly: false },
  { href: '/compte', label: 'Mon Compte', icon: User, adminOnly: false },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserAccount>(userDocRef);

  const isAdmin = userProfile?.subscriptionStatus === 'admin';

  return (
    <SidebarMenu>
      {links.map((link) => {
        if (link.adminOnly && !isAdmin) {
          return null;
        }
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
  );
}
