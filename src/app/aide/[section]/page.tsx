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
      "L'assistant IA vous aide à identifier la 'meilleure fenêtre' de la semaine pour vos activités, mas la décision finale et la sécurité vous incombent.",
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
      "Émetteur (A) - Signaux Tactiques : Utilisez 'DEMANDE ASSISTANCE' pour une alerte rouge clignotante immédiate, ou 'REGROUPEMENT OISEAUX' pour marquer une chasse par un point GPS horodaté sur la carte.",
      "Récepteur (B) - Flotte & Suivi : Saisissez l'ID d'un navire pour l'ajouter. Vous pouvez suivre plusieurs navires simultanément sur la carte satellite.",
      "Récepteur (B) - Signalisation Inverse : Activez votre propre GPS pour signaler un 'REGROUPEMENT OISEAUX' à votre tour. Le point s'affichera sur la carte du capitaine.",
      "Récepteur (B) - Veille Stratégique : Configurez une alerte d'immobilité (1h à 24h). Si le navire reste immobile trop longtemps, une alarme sonore jouera en boucle jusqu'à votre validation.",
      "Récepteur (B) - Sons : Personnalisez chaque alerte (Mouvement, Assistance, Oiseaux, Batterie) via les sélecteurs de sons dédiés.",
      "Journal de Bord : Consultez l'historique permanent. Utilisez le bouton 'Reset' pour vider l'historique et effacer les points de chasse de la carte."
    ],
    tips: [
      "Surnom SMS : Votre surnom de navire (ex: [TITANIC]) est ajouté automatiquement au début du SMS pour une identification immédiate par les secours.",
      "Lecture en boucle : L'alarme de veille stratégique ne s'arrête que si vous appuyez sur le bouton 'ARRÊTER L'ALARME' sur le téléphone du récepteur.",
      "Mode Auto : Le système détecte l'immobilité après 30s. Le bouton 'Reprise Mode Auto' permet de recalibrer le statut en cas de dérive de pêche."
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
      "Partagez vos spots : Envoyez un coin secret à un ami via son e-mail. Il sera automatiquement ajouté à son carnet dès son ouverture.",
      "Consultez l'historique détaillé de vos prises : l'application mémorise automatiquement le contexte exact (lune, marée, vent, température).",
      "Utilisez l'IA 'Chercher un jour similaire' sur un spot pour trouver la date idéale dans les 30 prochains jours."
    ],
    tips: [
      "Le mode satellite de la carte est idéal pour repérer les patates de corail.",
      "Le partage de spots inclut automatiquement tout le contexte environnemental enregistré lors du marquage.",
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
      "Pêche & Cuisine : Accédez à des fiches détaillées incluant les techniques de capture (appâts, profondeur) et les meilleurs conseils culinaires locaux.",
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
    title: 'Chasse & Tactique',
    icon: Crosshair,
    color: 'bg-orange-600',
    role: "Optimisez vos sorties en brousse grâce à l'analyse du vent, au suivi de groupe et désormais à un calculateur balistique complet pour carabines et fusils lisses.",
    steps: [
      "Consultez la période biologique (Brame, Chute des bois) pour adapter votre stratégie.",
      "Utilisez la carte du vent pour visualiser d'où vient l'air par rapport au relief.",
      "Table de Tir : Sélectionnez votre calibre, le modèle d'ogive et le grammage précis (Grains ou Grammes).",
      "Réglages Optiques : Indiquez votre distance de zérotage pour obtenir le nombre de clics exacts à appliquer sur vos tourelles.",
      "Compensation Vent : Saisissez la force et direction du vent pour corriger la dérive latérale en temps réel.",
      "Accessoires : Activez le mode 'Silencieux' pour recalculer la poussée prolongée (+2% V0) et la stabilité au vent.",
      "Simulateur de Gerbe : Pour les fusils lisses (12, 16, 20), visualisez le diamètre d'impact selon le Choke et la distance.",
      "Session de Groupe : Partagez votre position GPS en temps réel avec vos partenaires au-dessus de la carte satellite via un code unique.",
      "Alertes Tactiques : Signalez 'Gibier en vue' d'un clic. Une alerte visuelle et sonore préviendra immédiatement vos coéquipiers."
    ],
    tips: [
      "Le silencieux augmente légèrement la vitesse car il agit comme un prolongement du canon pour les gaz.",
      "Simulateur de Gerbe : Au-delà de 40m au plomb n°6, la dispersion est trop forte pour un prélèvement éthique.",
      "Mode Expert : Utilisez le modèle 'PERSONNALISÉ' pour saisir manuellement vos propres données de rechargement.",
      "1 Clic = 1cm à 100m. Le tableau vous donne le sens de rotation (HAUT/BAS, DROITE/GAUCHE) pour chaque distance."
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
      "Top Semis : Consultez la liste 'Idéal pour aujourd'hui' basée on l'influence lunaire actuelle."
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
    title: 'Réglementation & Sécurité',
    icon: Scale,
    color: 'bg-slate-500',
    role: "L'essentiel des règles de pêche, de chasse et de sécurité maritime pour une pratique responsable.",
    steps: [
      "Fermetures : Consultez le calendrier annuel des interdictions de pêche (Picot, Crabe de palétuvier, etc.).",
      "Gestion de Flotte : Créez des profils pour vos navires en les nommant pour organiser votre matériel séparément.",
      "Inventaire de Sécurité : Ajoutez vos équipements obligatoires (Fusées parachute, extincteurs, feux à main) pour chaque navire.",
      "Suivi des Péremptions : Saisissez les dates limites de chaque objet. L'application calcule automatiquement l'état de conformité (Conforme, Alerte, Expiré).",
      "Tailles & Espèces : Vérifiez les dimensions minimales autorisées et la liste des espèces strictement protégées (Napoléon, Dugong, etc.)."
    ],
    tips: [
      "Le marquage de la queue de la langouste est obligatoire dès la capture.",
      "Consultez régulièrement cette section pour vérifier que votre armement est à jour avant de prendre la mer."
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
