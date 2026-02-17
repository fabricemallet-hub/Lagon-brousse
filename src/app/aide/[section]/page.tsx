'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Info, 
  Lightbulb, 
  PlayCircle,
  Waves, 
  Fish, 
  Crosshair, 
  Leaf, 
  Sprout, 
  Calendar, 
  Scale, 
  Navigation, 
  User,
  Home,
  Sparkles,
  Sun,
  ShieldAlert,
  ExternalLink,
  BrainCircuit,
  Megaphone,
  Compass,
  Zap,
  Target,
  LocateFixed,
  Briefcase,
  ShoppingBag,
  Wand2,
  Users,
  Shield,
  DollarSign,
  Smartphone,
  Mail,
  Bell,
  Package,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CIGUATERA_GUIDE_URL = "https://coastfish.spc.int/fr/component/content/article/340-ciguatera-field-reference-guide.html";

const sectionContent: Record<string, {
  title: string;
  icon: any;
  color: string;
  role: string;
  steps: string[];
  tips: string[];
  links?: { label: string, url: string }[];
}> = {
  'admin': {
    title: 'Console d\'Administration',
    icon: Shield,
    color: 'bg-slate-800',
    role: "La console Master permet de piloter l'ensemble de l'écosystème L&B : utilisateurs, partenaires commerciaux, tarification et base de données scientifique.",
    steps: [
      "Gestion des Comptes : Modifiez les statuts d'abonnement et les dates d'expiration manuellement via l'onglet 'Comptes'.",
      "Liaison PRO : Pour activer un magasin, récupérez l'UID de l'utilisateur (dans son profil) et liez-le à un commerce via l'onglet 'Pros'.",
      "Configuration Tarifs : Gérez les frais fixes et les coûts par utilisateur/canal pour les campagnes publicitaires dans l'onglet 'Tarifs'.",
      "Alertes Globales : Diffusez des messages de maintenance ou de sécurité (Info, Warning, Urgent) qui s'afficheront instantanément sur l'accueil de tous les utilisateurs.",
      "Guide Poissons : Enrichissez le catalogue et utilisez l'IA pour générer automatiquement les fiches techniques (Ciguatera, biologie, cuisine).",
      "Cartographie Globale : Surveillez l'ensemble des spots GPS enregistrés par les utilisateurs pour identifier les zones de forte activité."
    ],
    tips: [
      "La liaison PRO via UID est indispensable pour que le commerçant voit son 'Dashboard Pro'.",
      "Les tarifs de pub modifiés ici sont appliqués instantanément sur les devis générés par les commerçants.",
      "Utilisez le 'Mode Fantôme' dans le tracker pour superviser sans être vu."
    ]
  },
  'accueil': {
    title: 'Accueil',
    icon: Home,
    color: 'bg-blue-500',
    role: "L'Accueil est votre centre de contrôle quotidien. Il synthétise les informations les plus importantes pour votre commune sans que vous ayez à parcourir tous les onglets.",
    steps: [
      "Visualisez la météo actuelle et les prévisions heure par heure.",
      "Sécurité Prioritaire : Un bandeau orange clignotant apparaîtra automatiquement en haut de l'écran 90 jours (3 mois) avant la péremption d'un de vos équipements de sécurité.",
      "Consultez les prochaines marées (haute et basse) en un clin d'œil.",
      "Lisez le conseil du jardinier basé sur la lune du jour.",
      "Naviguez entre les jours grâce aux flèches en haut de page pour planifier vos sorties."
    ],
    tips: [
      "Le bandeau météo en haut de page vous indique également la tendance du vent pour les 6 prochaines heures.",
      "Le badge de statut (Abonné, Essai, Limité) est cliquable pour gérer votre compte."
    ]
  },
  'lagon': {
    title: 'Lagon & Météo',
    icon: Waves,
    color: 'bg-cyan-500',
    role: "Cet onglet fournit les données techniques pour vos activités nautiques : vent précis, état de la mer et cycles solaires/lunaires.",
    steps: [
      "Consultez les prévisions de vent (vitesse et direction) pour quatre moments clés de la journée.",
      "Analysez la houle : la hauteur est donnée à l'intérieur du lagon et à l'extérieur du récif.",
      "Vérifiez la période de la houle (en secondes) : plus elle est élevée, plus les vagues sont puissantes.",
      "Consultez les heures précises de lever et coucher du soleil et de la lune."
    ],
    tips: [
      "Cliquez sur une tranche horaire du vent pour mettre à jour les détails de la houle correspondants.",
      "Une houle de plus de 2m au récif annonce souvent une passe 'déferlante' ou dangereuse."
    ]
  },
  'meteo': {
    title: 'Météo Live',
    icon: Sun,
    color: 'bg-yellow-500',
    role: "Un outil de surveillance météo haute précision qui combine les relevés en temps réel des stations NC et une analyse prévisionnelle stratégique sur 7 jours, assistée par l'IA.",
    steps: [
      "Recherche & Proximité : Les stations sont triées automatiquement par distance GPS par rapport à votre commune favorite.",
      "Lecture Live : Visualisez instantanément le vent (force et direction exacte via la flèche), la température et l'indice UV actuel.",
      "Tableau de Bord J+7 : Accédez à une vue complète sur une semaine incluant codes météo, températures extrêmes et probabilités de pluie.",
      "Bilan Stratégique IA : L'assistant analyse la cohérence des prévisions pour rédiger une synthèse globale de l'évolution du temps.",
      "Optimisation des Activités : Recevez des conseils personnalisés pour la pêche (selon les vents/marées), la chasse (humidité) et le jardinage.",
      "Vigilance & Sécurité : L'IA identifie les dangers comme les pics d'UV extrêmes, les fortes rafales ou les passages pluvieux soudains."
    ],
    tips: [
      "AVERTISSEMENT CRITIQUE : Cette application ne remplace PAS le site officiel de Météo Nouvelle-Calédonie (meteo.nc). Consultez-le toujours avant de prévoir une sortie en mer.",
      "L'assistant IA vous aide à identifier la 'meilleure fenêtre' de la semaine pour vos activités, mais la décision finale et la sécurité vous incombent.",
      "La flèche du vent indique la provenance réelle de l'air : une flèche pointant vers le bas indique un vent de Nord."
    ]
  },
  'vessel-tracker': {
    title: 'Boat Tracker',
    icon: Navigation,
    color: 'bg-blue-600',
    role: "Un système de sécurité maritime haute-fidélité conçu pour partager votre position GPS, surveiller la dérive et mutualiser les infos de pêche au sein d'une flotte.",
    steps: [
      "Émetteur (A) - Détection Auto : Activez le partage. Le système envoie un point GPS toutes les minutes et analyse vos mouvements.",
      "Statut Dérive : L'app détecte automatiquement si vous dérivez (mouvement lent entre 20m et 100m/min) et alerte vos contacts.",
      "Mode Fantôme : Masquez votre navire sur les cartes distantes pour naviguer discrètement tout en recevant les alertes des autres.",
      "Override Secours : En cas de 'Demande d'Assistance', le mode Fantôme est annulé pour permettre votre localisation immédiate.",
      "Récepteur (B) - Veille Stratégique : Configurez une alarme sonore si un navire suivi reste immobile au-delà d'un temps défini.",
      "Flotte (C) - Partage Tactique : Rejoignez un groupe pour partager oiseaux et prises (Marlin, Thon, etc.) avec icônes colorées.",
      "Gestion des Journaux : Statuts (mouvements) et Tactique (pêche) sont séparés pour un nettoyage précis des données."
    ],
    tips: [
      "Mise à jour Minute : Le point GPS est forcé toutes les 60s pour garantir une précision maximale dans l'historique.",
      "Reset Global : Seul l'émetteur A peut vider l'historique pour tout le monde. Les récepteurs ne vident que leur vue locale.",
      "Rayon de Mouillage : Ajustez le cercle bleu (10-100m) selon le vent pour éviter les fausses alertes de mouvement."
    ]
  },
  'pro-dashboard': {
    title: 'Dashboard Pro & Publicité',
    icon: Briefcase,
    color: 'bg-slate-900',
    role: "Le Dashboard Pro permet de piloter votre point de vente en diffusant des offres ciblées. Il intègre désormais des assistants IA pour vos rédactions et la gestion de vos ruptures de stock.",
    steps: [
      "Magicien IA Produit : Lors de l'ajout d'un article, l'IA analyse vos photos et les données (prix, remise) pour proposer 3 descriptions percutantes adaptées au ton choisi.",
      "Gestion des Stocks : Utilisez le toggle 'Stock vide' pour marquer un article comme épuisé. Indiquez le mois et l'année du 'Prochain arrivage' pour rassurer vos clients.",
      "Mise en avant Shopping : Les articles en rupture s'affichent avec un badge rouge et une opacité réduite sur la page Shopping, tout en restant informatifs sur le futur stock.",
      "Magicien Campagne : Sélectionnez vos articles et laissez l'IA générer 5 propositions de messages par canal (SMS, Push, Mail). L'IA est entraînée pour ne jamais inventer de produits hors catalogue.",
      "Longueur Adaptative : Choisissez Court, Moyen ou Long. L'IA adapte techniquement le texte : un mail sera plus détaillé qu'un SMS pour une même sélection.",
      "Ciblage & Reach : Définissez votre zone (Communes, Pays ou Région). Le devis se met à jour en temps réel selon le nombre d'abonnés actifs et les canaux choisis."
    ],
    tips: [
      "Le ton 'Local (Caillou)' est idéal pour créer un lien de confiance immédiat avec les pêcheurs et chasseurs du pays.",
      "Articles en rupture : Ne les supprimez pas ! Indiquer une date de retour de stock permet de générer de l'attente et du passage en magasin.",
      "Vérifiez toujours le 'Reach' avant de valider : il indique combien de personnes recevront réellement votre alerte selon leurs préférences de thématiques."
    ]
  },
  'peche': {
    title: 'Pêche',
    icon: Fish,
    color: 'bg-indigo-500',
    role: "Optimisez vos sorties en mer grâce aux prévisions d'activité par espèce et à la mémorisation de vos spots secrets.",
    steps: [
      "Consultez les indices de réussite (sur 10) calculés selon la marée, la lune et l'heure.",
      "Enregistrez vos 'Coins de Pêche' par GPS sur la carte satellite interactive.",
      "Partagez vos spots : Envoyez un coin secret à un ami via son e-mail directement depuis la fiche du spot.",
      "Suivi des Crustacés : Repérez les jours de mue ou de remplissage des crabes et l'activité des poulpes.",
      "Session de Groupe : Rejoignez vos amis pour voir leurs positions en temps réel et partager vos zones de surveillance.",
      "IA 'Quel spot maintenant ?' : Laissez l'IA choisir le meilleur coin dans votre carnet selon les conditions actuelles."
    ],
    tips: [
      "Le partage de spots inclut automatiquement tout le contexte environnemental (marée, lune) enregistré lors du marquage.",
      "L'IA ignore météo et vent pour se concentrer sur les cycles immuables de la lune et des marées.",
      "SÉCURITÉ : Consultez toujours le guide de la CPS pour limiter les risques de ciguatera."
    ],
    links: [
      { label: "lien vers guide_pratique_ciguatera", url: CIGUATERA_GUIDE_URL }
    ]
  },
  'fish': {
    title: 'Guide des Poissons & Gratte',
    icon: BrainCircuit,
    color: 'bg-cyan-600',
    role: "Un répertoire intelligent des espèces de Nouvelle-Calédonie incluant un système de calcul de risque collaboratif et différencié par taille pour la ciguatera (gratte).",
    steps: [
      "Identification IA : Prenez une photo de votre prise pour identifier l'espèce et son profil de risque.",
      "Analyse par Taille : Le risque est détaillé pour 3 catégories (Petit, Moyen, Grand).",
      "Risque Collaboratif : Visualisez le score final pondéré (Moyenne entre les données scientifiques et les retours des pêcheurs locaux).",
      "Signalement Citoyen : Contribuez à la sécurité en signalant un ressenti de gratte par commune.",
      "Indice de Confiance : Le nombre de votants s'affiche pour crédibiliser la donnée locale."
    ],
    tips: [
      "Le risque de gratte augmente statistiquement avec la taille du poisson.",
      "L'indice de confiance (Vert, Orange, Rouge) vous offre une décision rapide avant consommation.",
      "Consultez systématiquement le guide pratique ciguatera de la CPS via le lien présent dans chaque fiche."
    ],
    links: [
      { label: "lien vers guide_pratique_ciguatera", url: CIGUATERA_GUIDE_URL }
    ]
  },
  'chasse': {
    title: 'Chasse & Tactique',
    icon: Crosshair,
    color: 'bg-orange-600',
    role: "Optimisez vos sorties en brousse grâce à l'analyse du vent, au suivi de groupe sécurisé et au calculateur balistique complet.",
    steps: [
      "Session de Groupe : Partagez votre position GPS en temps réel. Le niveau de précision GPS (+/- Xm) est affiché pour chaque participant.",
      "Angle de Tir Tactique : Réglez votre axe de tir (Cône bleu). Si un coéquipier y pénètre, une alerte sonore retentit chez les deux chasseurs.",
      "Alertes Gibier : Utilisez le bouton central pour prévenir instantanément toute l'équipe d'un contact visuel.",
      "Table de Tir & Râtelier : Chargez vos carabines enregistrées pour obtenir les clics de réglage optique selon la distance et le vent.",
      "Compensation Vent : Saisissez la force et direction du vent pour corriger la dérive latérale.",
      "Simulateur de Gerbe : Visualisez le diamètre d'impact des plombs selon le Choke et la distance."
    ],
    tips: [
      "Angle de Tir : En mode portrait plein écran, masquez les boutons de statut (icône Œil) pour régler votre angle plus précisément sur la carte.",
      "Portée Sécurité : Réglez la détection jusqu'à 2km pour anticiper les mouvements des coéquipiers sur de longues distances en savane.",
      "Éveil Écran : Utilisez le bouton 'MAINTENIR ÉCRAN' pour éviter que le GPS ne se coupe lors des phases d'approche."
    ]
  },
  'champs': {
    title: 'Champs & Jardin',
    icon: Leaf,
    color: 'bg-green-600',
    role: "Jardiner selon les traditions calédoniennes et l'influence lunaire. Cette section inclut un gestionnaire de jardin intelligent par IA.",
    steps: [
      "Tendance du Jour : Identifiez si la lune est Montante ou Descendante.",
      "Inventaire Réel : Enregistrez vos plantes. L'IA corrige les noms et suggère les variétés locales.",
      "Bilan Stratégique IA : Générez un rapport global. L'IA planifie les priorités et calcule l'arrosage au jet (en secondes) selon la pluie réelle.",
      "Scanner Plante (IA) : Utilisez la photo pour identifier une plante, un nuisible ou diagnostiquer une maladie."
    ],
    tips: [
      "Le Bilan Stratégique réduit automatiquement les besoins en eau s'il a plu récemment à votre commune via la météo live."
    ]
  },
  'semis': {
    title: 'Guide Culture & IA',
    icon: Sprout,
    color: 'bg-emerald-500',
    role: "Un assistant intelligent pour planifier vos cultures de A à Z selon les cycles biologiques et climatiques.",
    steps: [
      "Recherche & Scanner : Tapez le nom d'une graine ou scannez un sachet pour identifier la variété.",
      "Validation Lunaire : L'IA vérifie votre date de semis. Si elle est mauvaise, elle vous donne la date idéale précise sur les 30 prochains jours.",
      "Planification : Obtenez les dates estimées de récolte et les périodes de repiquage."
    ],
    tips: [
      "L'IA suggère systématiquement des variétés résistantes à la chaleur calédonienne."
    ]
  },
  'calendrier-peche': {
    title: 'Calendrier Pêche',
    icon: Calendar,
    color: 'bg-slate-700',
    role: "Planification stratégique à long terme basée sur les cycles biologiques marins.",
    steps: [
      "Suivi des Crustacés : Repérez les jours 'Crabe Plein' (vives-eaux) ou 'Crabe Mout' (mue).",
      "Marées : Visualisez les coefficients et les hauteurs record.",
      "Potentiel IA : Repérez les icônes 'Poissons' (1 à 3) pour identifier les jours de très forte activité prévisible."
    ],
    tips: [
      "Zoom & Pinch : Sur mobile, vous pouvez écarter deux doigts sur le calendrier pour agrandir les cases et voir plus de détails."
    ]
  },
  'calendrier-champs': {
    title: 'Calendrier Champs',
    icon: Calendar,
    color: 'bg-green-800',
    role: "Le calendrier lunaire complet pour organiser vos travaux du jardin.",
    steps: [
      "Zodiaque : Repérez visuellement les jours Fruits, Racines, Fleurs ou Feuilles.",
      "Travaux Spéciaux : Les icônes indiquent les jours propices à la taille, au bouturage ou à la tonte."
    ],
    tips: [
      "Cliquez sur n'importe quel jour pour ouvrir la 'Fiche Tactique Journalière' détaillée."
    ]
  },
  'reglementation': {
    title: 'Réglementation & Sécurité',
    icon: Scale,
    color: 'bg-slate-500',
    role: "L'essentiel des règles de pêche, de chasse et de sécurité maritime pour une pratique responsable.",
    steps: [
      "Fermetures : Consultez le calendrier annuel des interdictions (Picot, Crabe, etc.).",
      "Suivi des Péremptions : Créez vos profils navires et gérez les dates de vos fusées et extincteurs.",
      "Alertes Automatiques : L'application vous prévient sur l'accueil 3 mois avant une péremption."
    ],
    tips: [
      "Le marquage de la queue de la langouste est obligatoire dès la capture."
    ]
  },
  'compte': {
    title: 'Compte & Abonnement',
    icon: User,
    color: 'bg-zinc-600',
    role: "Gérez votre profil, vos préférences et votre accès premium.",
    steps: [
      "Coordonnées : Renseignez votre mobile et adresse pour le module Shopping.",
      "Personnalisation : Choisissez vos 6 raccourcis favoris pour la barre de navigation.",
      "Jetons : Activez vos codes d'accès offerts.",
      "Notifications : Configurez vos alertes push et SMS."
    ],
    tips: [
      "En mode 'Limité', vous disposez d'une minute d'accès par jour pour les consultations rapides."
    ]
  }
};

export default function AideSectionPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.section as string;
  const content = sectionContent[sectionId];

  if (!content) {
    return <div className="p-8 text-center">Section non trouvée.</div>;
  }

  const Icon = content.icon;

  return (
    <div className="space-y-6 pb-12 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
          <ChevronLeft className="size-6" />
        </Button>
        <h1 className="text-xl font-bold">Retour</h1>
      </div>

      <Card className="border-2 overflow-hidden shadow-lg">
        <CardHeader className={cn("text-white p-6", content.color)}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="size-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{content.title}</CardTitle>
              <p className="text-white/80 text-sm font-medium mt-1">Guide d'utilisation</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6 space-y-8">
            {/* Rôle */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Info className="size-5" /> À quoi ça sert ?
              </h3>
              <div className="text-muted-foreground leading-relaxed italic text-sm">
                {content.role}
              </div>
            </div>

            {/* Mode d'emploi */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <PlayCircle className="size-5" /> Comment ça marche ?
              </h3>
              <ul className="space-y-4">
                {content.steps.map((step, index) => (
                  <li key={index} className="flex gap-4 items-start">
                    <div className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                      {index + 1}
                    </div>
                    <span className="text-sm text-foreground/90 font-medium">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Astuces */}
            <div className="bg-muted/50 p-5 rounded-2xl border-2 border-dashed border-muted-foreground/20 space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-accent">
                <Lightbulb className="size-5" /> Astuces &amp; Conseils
              </h3>
              <ul className="space-y-2">
                {content.tips.map((tip, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              
              {content.links && content.links.length > 0 && (
                <div className="pt-4 mt-2 border-t border-muted-foreground/10 space-y-2">
                  {content.links.map((link, idx) => (
                    <a 
                      key={idx} 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-[10px] font-black uppercase text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" /> {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-14 text-lg font-bold shadow-md mt-4" variant="outline" onClick={() => router.back()}>
        Compris !
      </Button>
    </div>
  );
}
