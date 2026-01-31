'use client';

import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Home, Waves, Leaf, Fish, Calendar, Scale, Crosshair } from 'lucide-react';
import Link from 'next/link';

const links = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/lagon', label: 'Lagon', icon: Waves },
  { href: '/peche', label: 'Pêche', icon: Fish },
  { href: '/chasse', label: 'Chasse', icon: Crosshair },
  { href: '/champs', label: 'Champs', icon: Leaf },
  { href: '/calendrier', label: 'Calendrier', icon: Calendar },
  { href: '/reglementation', label: 'Réglementation', icon: Scale },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => (
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
      ))}
    </SidebarMenu>
  );
}
