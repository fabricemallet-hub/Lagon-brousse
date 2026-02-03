
import { Home, Waves, Leaf, Fish, Calendar, Scale, Crosshair, User, Shield, MessageSquare, BookOpen } from 'lucide-react';

export const navLinks = [
  { href: '/', label: 'Accueil', icon: Home, adminOnly: false },
  { href: '/lagon', label: 'Lagon', icon: Waves, adminOnly: false },
  { href: '/peche', label: 'Pêche', icon: Fish, adminOnly: false },
  { href: '/chasse', label: 'Chasse', icon: Crosshair, adminOnly: false },
  { href: '/champs', label: 'Champs', icon: Leaf, adminOnly: false },
  { href: '/calendrier', label: 'Calendrier', icon: Calendar, adminOnly: false },
  { href: '/reglementation', label: 'Réglementation', icon: Scale, adminOnly: false },
  { href: '/aide', label: 'Mode opératoire', icon: BookOpen, adminOnly: false },
  { href: '/contact', label: 'Contact Admin', icon: MessageSquare, adminOnly: false },
  { href: '/compte', label: 'Compte', icon: User, adminOnly: false },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];
