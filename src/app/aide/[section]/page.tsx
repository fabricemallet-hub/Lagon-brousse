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
  Megaphone
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
  'accueil': {
    title: 'Accueil',
    icon: Home,
    color: 'bg-blue-500',
    role: "L'Accueil est votre centre de contrôle quotidien. Il synthétise les informations les plus importantes pour votre commune sans que vous ayez à parcourir tous les onglets.",
    steps: [
      "Visualisez la météo actuelle et les prévisions heure par heure.",
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
    role: "Un système de sécurité maritime haute-fidélité conçu pour partager votre position GPS, votre statut d'activité et votre niveau de batterie avec vos proches restés à terre.",
    steps: [
      "Émetteur (A) - Identité : Configurez un ID et votre surnom de navire. Ce surnom est inclus automatiquement au début de vos SMS d'urgence.",
      "Émetteur (A) - Mode Éveil & Status : Activez 'MODE ÉVEIL' pour maintenir l'écran allumé. Utilisez les boutons 'Retour' ou 'Home' pour signaler vos intentions.",
      "Émetteur (A) - Urgence SMS : Choisissez entre le message standard ou personnalisé via l'interrupteur. Le point GPS est toujours annexé.",
      "Récepteur (B) - Flotte & Suivi : Saisissez l'ID d'un navire pour l'ajouter. Vous pouvez suivre plusieurs navires simultanément sur la carte satellite.",
      "Récepteur (B) - Alertes : Personnalisez les sons et réglez le seuil de batterie basse via les curseurs.",
      "Journal de Bord : Consultez l'historique synchronisé (batterie, charge, statut). L'émetteur peut effacer l'historique pour tout le monde."
    ],
    tips: [
      "Surnom SMS : Votre surnom de navire (ex: [TITANIC]) est ajouté automatiquement au début du SMS pour une identification immédiate par les secours.",
      "Mode Auto : Le système détecte l'immobilité après 30s. Le bouton 'Reprise Mode Auto' permet de recalibrer le statut en cas de dérive de pêche.",
      "Annuaire Maritime : Les numéros d'urgence NC (COSS 16, SAMU 15, etc.) sont disponibles en bas de page."
    ]
  },
  'peche': {
    title: 'Pêche',
    icon: Fish,
    color: 'bg-indigo-500',
    role: "Optimisez vos sorties en mer grâce aux prévisions d'activité par espèce et à la mémorisation de vos spots secrets.",
    steps: [
      "Consultez les indices de réussite (sur 10) calculés selon la marée, la lune et l'heure pour chaque poisson.",
      "Déroulez une fiche espèce pour obtenir des conseils de profondeur et de technique.",
      "Suivez l'activité des crabes, langoustes et poulpes selon le cycle lunaire.",
      "Enregistrez vos 'Coins de Pêche' par GPS sur la carte satellite interactive.",
      "Consultez l'historique détaillé de vos prises : l'application mémorise automatiquement le contexte exact (lune, marée, vent, température).",
      "Utilisez l'IA 'Chercher un jour similaire' sur un spot pour trouver la date idéale dans les 30 prochains jours."
    ],
    tips: [
      "Le mode satellite de la carte est idéal pour repérer les patates de corail.",
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
      "Identification IA : Prenez une photo de votre prise pour identifier instantanément l'espèce et obtenir son profil de risque théorique.",
      "Analyse par Taille : Le risque est détaillé pour 3 catégories (Petit, Moyen, Grand). Les longueurs estimées en CM vous aident à situer votre prise.",
      "Risque Collaboratif : Visualisez le score final pondéré (Moyenne entre les données scientifiques et les retours des pêcheurs locaux) pour votre commune.",
      "Signalement Citoyen : Contribuez à la sécurité de tous en signalant un ressenti de gratte. Précisez la taille du spécimen pour affiner les statistiques.",
      "Indice de Confiance : Le nombre de 'retours citoyens' s'affiche pour crédibiliser la donnée locale sur chaque fiche."
    ],
    tips: [
      "Le risque de gratte augmente statistiquement avec la taille du poisson. Soyez particulièrement vigilants avec les spécimens de catégorie 'Grand'.",
      "Les longueurs en CM sont des estimations spécifiques aux spécimens calédoniens pour vous guider lors de vos signalements.",
      "L'indice de confiance (Vert, Orange, Rouge) est calculé sur la moyenne pondérée pour vous offrir une décision rapide avant consommation.",
      "Consultez systématiquement le guide pratique ciguatera de la CPS via le lien présent dans chaque fiche."
    ],
    links: [
      { label: "lien vers guide_pratique_ciguatera", url: CIGUATERA_GUIDE_URL }
    ]
  },
  'chasse': {
    title: 'Chasse au Cerf',
    icon: Crosshair,
    color: 'bg-orange-600',
    role: "Optimisez vos sorties en brousse grâce à l'analyse du vent et au suivi de groupe en temps réel.",
    steps: [
      "Consultez la période biologique (Brame, Chute des bois) pour adapter votre stratégie.",
      "Utilisez la carte du vent pour visualiser d'où vient l'air par rapport au relief.",
      "La 'Table de Tir' vous aide à estimer la correction de visée en fonction de la distance et du vent.",
      "Session de Groupe : Partagez votre position GPS en temps réel avec vos partenaires sur la carte satellite via un code unique.",
      "Alertes Tactiques : Signalez 'Gibier en vue' d'un clic. Une alerte visuelle et sonore préviendra immédiatement vos coéquipiers."
    ],
    tips: [
      "En période de Brame, les cerfs sont plus actifs mais aussi plus vigilants.",
      "Personnalisez votre icône et votre couleur dans les paramètres pour être identifié au premier coup d'œil."
    ]
  },
  'champs': {
    title: 'Champs & Jardin',
    icon: Leaf,
    color: 'bg-green-600',
    role: "Jardiner selon les traditions calédoniennes et l'influence lunaire. Cette section inclut désormais un gestionnaire de jardin intelligent par IA.",
    steps: [
      "Tendance du Jour : Identifiez si la lune est Montante ou Descendante et le signe du zodiaque actuel.",
      "Inventaire Réel : Enregistrez vos plantes dans 'Mon Jardin'. L'IA corrige les noms et suggère les variétés locales optimales.",
      "Bilan Stratégique IA : Générez un rapport global pour votre jardin. L'IA planifie les priorités et calcule l'arrosage au jet (en secondes) selon la météo.",
      "Conseils de Taille : Cliquez sur une plante pour savoir précisément OÙ et COMMENT couper selon la sève actuelle.",
      "Scanner Plante (IA) : Utilisez la photo pour identifier une plante, un nuisible ou diagnostiquer une maladie."
    ],
    tips: [
      "Le Bilan Stratégique réduit automatiquement les besoins en eau s'il a plu récemment à votre commune.",
      "Suivre le calendrier permet de renforcer naturellement vos plantes sans pesticides."
    ]
  },
  'semis': {
    title: 'Guide Culture & IA',
    icon: Sprout,
    color: 'bg-emerald-500',
    role: "Un assistant intelligent pour planifier vos cultures de A à Z selon les cycles biologiques et climatiques.",
    steps: [
      "Recherche & Scanner : Tapez le nom d'une graine ou scannez un sachet/pousse pour identifier la variété.",
      "Calcul de Fiche IA : L'IA définit le type de plante et génère les conseils d'arrosage et d'exposition spécifiques à la NC.",
      "Validation Lunaire : L'IA vérifie votre date de semis. Si elle est mauvaise, elle vous donne la date idéale précise sur les 30 prochains jours.",
      "Planification : Obtenez les dates estimées de récolte et les périodes de repiquage en pleine terre.",
      "Top Semis : Consultez la liste 'Idéal pour aujourd'hui' basée sur l'influence lunaire actuelle."
    ],
    tips: [
      "L'IA suggère systématiquement des variétés résistantes à la chaleur calédonienne (ex: Tomate Heatmaster).",
      "Une alerte visuelle vous signale dans votre historique si un semis a été fait hors période optimale."
    ]
  },
  'calendrier-peche': {
    title: 'Calendrier Pêche',
    icon: Calendar,
    color: 'bg-slate-700',
    role: "Planification stratégique à long terme basée sur les cycles biologiques marins.",
    steps: [
      "Suivi des Crustacés : Repérez les jours 'Crabe Plein' (vives-eaux) ou 'Crabe Mout' (mue).",
      "Saisons : Identifiez les périodes de passage (ex: Tazard en Nov/Déc) via les alertes intégrées.",
      "Analyse des Marées : Visualisez les coefficients et les records de hauteur pour cibler les platiers."
    ],
    tips: [
      "Un indice 10/10 coïncide souvent avec les jours de grandes marées (Nouvelle ou Pleine lune)."
    ]
  },
  'calendrier-champs': {
    title: 'Calendrier Champs',
    icon: Calendar,
    color: 'bg-green-800',
    role: "Le calendrier lunaire complet pour organiser vos travaux du jardin.",
    steps: [
      "Zodiaque : Repérez visuellement les jours Fruits, Racines, Fleurs ou Feuilles.",
      "Travaux Spéciaux : Les icônes indiquent les jours propices à la taille, au bouturage ou à la tonte.",
      "Fiche Expert : Cliquez sur une date pour obtenir l'analyse IA complète de la journée."
    ],
    tips: [
      "Le signe du zodiaque change environ tous les 2 à 3 jours."
    ]
  },
  'reglementation': {
    title: 'Réglementation',
    icon: Scale,
    color: 'bg-slate-500',
    role: "L'essentiel des règles de pêche et de chasse en NC pour une pratique responsable.",
    steps: [
      "Fermetures : Consultez le calendrier des interdictions (Picot, Crabe, etc.).",
      "Tailles : Vérifiez les dimensions minimales autorisées.",
      "Protection : Identifiez les espèces intégralement protégées (Napoléon, Dugong...)."
    ],
    tips: [
      "Le marquage de la queue de la langouste est obligatoire dès la capture."
    ]
  },
  'compte': {
    title: 'Compte & Abonnement',
    icon: User,
    color: 'bg-zinc-600',
    role: "Gérez votre profil et votre accès premium.",
    steps: [
      "Statut : Consultez votre état actuel (Abonné, Essai, Limité).",
      "Jetons : Saisissez vos codes d'accès offerts.",
      "Notifications : Activez les alertes push pour la sécurité et la chasse."
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
