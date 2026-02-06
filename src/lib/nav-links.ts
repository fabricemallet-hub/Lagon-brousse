import { Home, Waves, Leaf, Fish, Calendar, Scale, Crosshair, User, Shield, MessageSquare, BookOpen, Sprout, Sun, Navigation } from 'lucide-react';

export const navLinks = [
  { href: '/', label: 'Accueil', icon: Home, adminOnly: false },
  { href: '/meteo', label: 'Météo Live', icon: Sun, adminOnly: false },
  { href: '/lagon', label: 'Lagon', icon: Waves, adminOnly: false },
  { href: '/peche', label: 'Pêche', icon: Fish, adminOnly: false },
  { href: '/vessel-tracker', label: 'Boat Tracker', icon: Navigation, adminOnly: false },
  { href: '/chasse', label: 'Chasse', icon: Crosshair, adminOnly: false },
  { href: '/champs', label: 'Champs', icon: Leaf, adminOnly: false },
  { href: '/fish', label: 'Fish', icon: Fish, adminOnly: false },
  { href: '/semis', label: 'Guide Culture', icon: Sprout, adminOnly: false },
  { href: '/calendrier', label: 'Calendrier', icon: Calendar, adminOnly: false },
  { href: '/reglementation', label: 'Réglementation', icon: Scale, adminOnly: false },
  { href: '/aide', label: 'Mode opératoire', icon: BookOpen, adminOnly: false },
  { href: '/contact', label: 'Contact Admin', icon: MessageSquare, adminOnly: false },
  { href: '/compte', label: 'Compte', icon: User, adminOnly: false },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];
