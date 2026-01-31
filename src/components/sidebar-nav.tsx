'use client';

import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Home, Waves, Leaf, Fish } from 'lucide-react';
import Link from 'next/link';

const links = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/lagon', label: 'Lagon', icon: Waves },
  { href: '/peche', label: 'Pêche', icon: Fish },
  { href: '/champs', label: 'Champs', icon: Leaf },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.href}>
          <Link href={link.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === link.href}
              tooltip={link.label}
            >
              <a >
                <link.icon />
                <span>{link.label}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
