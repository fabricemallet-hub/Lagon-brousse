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
    <div className="flex flex-col h-full">
      <SidebarMenu className="flex-grow">
        {navLinks.map((link) => {
          if (link.adminOnly && !isAdmin) {
            return null;
          }
          if (link.href === '/contact' && isAdmin) {
            return null;
          }
          if (link.href === '/contact' && !user) {
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
      
      <div className="px-4 py-4 mt-auto border-t border-sidebar-border bg-sidebar group-data-[collapsible=icon]:hidden">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          Version 2.0.0
        </p>
      </div>
    </div>
  );
}