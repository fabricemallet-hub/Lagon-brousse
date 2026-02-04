
import { FishSpeciesInfo } from './types';

export const lagoonFishData: FishSpeciesInfo[] = [
  {
    id: 'baleinier',
    name: 'Baleinier',
    scientificName: 'Aprion virescens',
    gratteRisk: 15,
    culinaryAdvice: 'Chair ferme et savoureuse. Excellent en grillade, en steaks ou en carpaccio.',
    fishingAdvice: 'Se pêche souvent à la traîne ou au vif. Très combatif, ne pas lâcher de mou.',
    category: 'Large',
    imagePlaceholder: 'fish-baleinier'
  },
  {
    id: 'barracuda',
    name: 'Barracuda, bécune',
    scientificName: 'Sphyraena barracuda',
    gratteRisk: 45,
    culinaryAdvice: 'Chair fine mais attention à la gratte sur les gros spécimens (>80cm). Consommer de préférence les petits.',
    fishingAdvice: 'Attaque tout ce qui brille. Leurres de traîne ou poppers. Attention aux dents lors du décrochage.',
    category: 'Large',
    imagePlaceholder: 'fish-barracuda'
  },
  {
    id: 'bec-de-cane-tache-noire',
    name: 'Bec de cane à tache noire',
    scientificName: 'Lethrinus harak',
    gratteRisk: 5,
    culinaryAdvice: 'Goût délicat. Parfait en friture ou grillé entier.',
    fishingAdvice: 'Présent dans les herbiers et fonds sableux peu profonds. Ligne fine avec morceaux de bernard-l\'ermite.',
    category: 'Lagon',
    imagePlaceholder: 'fish-bec-de-cane-tache-noire'
  },
  {
    id: 'bec-de-cane-bleute',
    name: 'Bec de cane bleuté',
    scientificName: 'Lethrinus nebulosus',
    gratteRisk: 8,
    culinaryAdvice: 'Chair excellente, ferme. Très apprécié en salade tahitienne ou grillé au feu de bois.',
    fishingAdvice: 'Se trouve sur les fonds de sable et débris coralliens. Appâts : calamar, crevette.',
    category: 'Lagon',
    imagePlaceholder: 'fish-bec-de-cane-bleute'
  },
  {
    id: 'bec-de-cane',
    name: 'Bec de cane',
    scientificName: 'Lethrinus nebulosus',
    gratteRisk: 5,
    culinaryAdvice: 'Excellent en grillade ou au four. Sa chair est ferme et savoureuse. Très apprécié cru en salade tahitienne.',
    fishingAdvice: 'Se pêche à la ligne au fond ou au poser avec du calamar ou du bernard-l\'ermite. Très combatif.',
    category: 'Lagon',
    imagePlaceholder: 'fish-bec-de-cane'
  },
  {
    id: 'bossu-herbe',
    name: "Bossu d'herbe",
    scientificName: 'Lethrinus variegatus',
    gratteRisk: 5,
    culinaryAdvice: 'Petit mais très bon. Souvent frit ou en bouillon.',
    fishingAdvice: 'Pêche de bordure dans les herbiers de faible profondeur.',
    category: 'Lagon',
    imagePlaceholder: 'fish-bossu-herbe'
  },
  {
    id: 'bossu-dore',
    name: 'Bossu doré',
    scientificName: 'Lethrinus chrysostomus',
    gratteRisk: 10,
    culinaryAdvice: 'Chair blanche très fine. Idéal au four avec un filet d\'huile d\'olive et des herbes.',
    fishingAdvice: 'Chercher les patates de corail isolées sur les fonds de 5 à 15m. Appât : crevettes ou morceaux de poisson.',
    category: 'Lagon',
    imagePlaceholder: 'fish-bossu-dore'
  },
  {
    id: 'carangue-grosse-tete',
    name: 'Carangue à grosse tête, baoum',
    scientificName: 'Caranx ignobilis',
    gratteRisk: 40,
    culinaryAdvice: 'Les gros spécimens sont souvent grattés. Privilégier les poissons de moins de 5kg pour la consommation.',
    fishingAdvice: 'Le graal du pêcheur au popper. Puissance extrême, matériel lourd indispensable.',
    category: 'Recif',
    imagePlaceholder: 'fish-carangue-grosse-tete'
  },
  {
    id: 'carangue-echevelee',
    name: 'Carangue échevelée',
    scientificName: 'Alectis ciliaris',
    gratteRisk: 15,
    culinaryAdvice: 'Chair très fine et appréciée. Souvent préparée en filets.',
    fishingAdvice: 'Plus rare, se prend parfois au jig ou au leurre souple.',
    category: 'Lagon',
    imagePlaceholder: 'fish-carangue-echevelee'
  },
  {
    id: 'carangue-noire',
    name: 'Carangue noire',
    scientificName: 'Caranx lugubris',
    gratteRisk: 35,
    culinaryAdvice: 'Risque de gratte modéré à élevé. Souvent remise à l\'eau par sécurité.',
    fishingAdvice: 'Zones de courant, passes et récifs extérieurs.',
    category: 'Recif',
    imagePlaceholder: 'fish-carangue-noire'
  },
  {
    id: 'carangue-ombree',
    name: 'Carangue ombrée',
    scientificName: 'Carangoides plagiotaenia',
    gratteRisk: 15,
    culinaryAdvice: 'Chair honnête, souvent consommée grillée.',
    fishingAdvice: 'Moins puissante que la GT, se prend sur des leurres de taille moyenne.',
    category: 'Lagon',
    imagePlaceholder: 'fish-carangue-ombree'
  },
  {
    id: 'gaterin',
    name: 'Gaterin à bandes diagonale',
    scientificName: 'Plectorhinchus lineatus',
    gratteRisk: 5,
    culinaryAdvice: 'Chair comestible mais parfois jugée fade. Préférer une préparation épicée ou en sauce.',
    fishingAdvice: 'Se pêche souvent près du fond, sous les surplombs de corail.',
    category: 'Lagon',
    imagePlaceholder: 'fish-gaterin'
  },
  {
    id: 'jaunet',
    name: 'Jaunet',
    scientificName: 'Lutjanus fulviflamma',
    gratteRisk: 5,
    culinaryAdvice: 'Petit vivanneau délicieux frit ou grillé entier.',
    fishingAdvice: 'Abondant autour des patates de corail. Facile à prendre à la ligne légère.',
    category: 'Lagon',
    imagePlaceholder: 'fish-jaunet'
  },
  {
    id: 'lanterne',
    name: 'Lanterne Gros oeil',
    scientificName: 'Priacanthus hamrur',
    gratteRisk: 2,
    culinaryAdvice: 'Peu de chair mais excellente. Attention, la peau est très dure, comme du papier de verre.',
    fishingAdvice: 'Pêche de nuit principalement. Vit dans les anfractuosités du corail.',
    category: 'Lagon',
    imagePlaceholder: 'fish-lanterne'
  },
  {
    id: 'loche-castex-levres',
    name: 'Loche castex grosses lèvres',
    scientificName: 'Plectorhinchus chaetodonoides',
    gratteRisk: 10,
    culinaryAdvice: 'Semblable au Gaterin. Chair blanche correcte.',
    fishingAdvice: 'Souvent rencontrée en apnée, moins fréquente à la ligne.',
    category: 'Lagon',
    imagePlaceholder: 'fish-loche-castex-levres'
  },
  {
    id: 'loche-castex',
    name: 'Loche castex',
    scientificName: 'Plectropomus laevis',
    gratteRisk: 30,
    culinaryAdvice: 'Excellente qualité de chair. Attention aux gros individus souvent porteurs de gratte.',
    fishingAdvice: 'Se poste près des structures. Attaque franche au jig ou au vif.',
    category: 'Lagon',
    imagePlaceholder: 'fish-loche-castex'
  },
  {
    id: 'loche-merou',
    name: 'Loche Mérou',
    scientificName: 'Epinephelus sp.',
    gratteRisk: 20,
    culinaryAdvice: 'Chair dense et gélatineuse, parfaite pour les bouillons ou le four.',
    fishingAdvice: 'Pêche au fond au poser. Chercher les trous dans le récif.',
    category: 'Lagon',
    imagePlaceholder: 'fish-loche-merou'
  },
  {
    id: 'loche-truite',
    name: 'Loche truite',
    scientificName: 'Plectropomus leopardus',
    gratteRisk: 25,
    culinaryAdvice: 'Un des meilleurs poissons du Caillou. Chair floconneuse. Parfait à la vapeur ou à la crème.',
    fishingAdvice: 'Se pêche au leurre souple ou au jig près du récif. Attention, elle cherche tout de suite à s\'enraguer.',
    category: 'Lagon',
    imagePlaceholder: 'fish-loche-truite'
  },
  {
    id: 'perroquet-bandes-bleues',
    name: 'Perroquet à bandes bleues',
    scientificName: 'Scarus ghobban',
    gratteRisk: 10,
    culinaryAdvice: 'Chair très tendre. Délicieux en papillote. Ne pas trop cuire car la chair devient vite molle.',
    fishingAdvice: 'Se prend principalement en chasse sous-marine.',
    category: 'Lagon',
    imagePlaceholder: 'fish-perroquet-bandes-bleues'
  },
  {
    id: 'picot-canaque',
    name: 'Picot canaque',
    scientificName: 'Siganus argenteus',
    gratteRisk: 2,
    culinaryAdvice: 'Le préféré de beaucoup. Chair fine, idéal grillé avec un peu de citron.',
    fishingAdvice: 'Pêche au filet ou à la ligne fine sur les tombants.',
    category: 'Lagon',
    imagePlaceholder: 'fish-picot-canaque'
  },
  {
    id: 'picot-chirurgien',
    name: 'Picot chirurgien',
    scientificName: 'Acanthurus sp.',
    gratteRisk: 5,
    culinaryAdvice: 'Peau épaisse, chair appréciée mais attention aux "scalpels" sur la queue lors du nettoyage.',
    fishingAdvice: 'Principalement chasse sous-marine sur le platier.',
    category: 'Lagon',
    imagePlaceholder: 'fish-picot-chirurgien'
  },
  {
    id: 'picot-gris',
    name: 'Picot gris',
    scientificName: 'Siganus sp.',
    gratteRisk: 2,
    culinaryAdvice: 'Très commun, chair simple et bonne. Toujours bon en grillade.',
    fishingAdvice: 'Ligne fine avec de la pâte ou de la mie de pain.',
    category: 'Lagon',
    imagePlaceholder: 'fish-picot-gris'
  },
  {
    id: 'picot-nid-abeille',
    name: "Picot nid d'abeille",
    scientificName: 'Siganus stellatus',
    gratteRisk: 2,
    culinaryAdvice: 'Identique aux autres picots. Chair blanche très saine.',
    fishingAdvice: 'Platier et zones coralliennes.',
    category: 'Lagon',
    imagePlaceholder: 'fish-picot-nid-abeille'
  },
  {
    id: 'picot-raye',
    name: 'Picot rayé',
    scientificName: 'Siganus lineatus',
    gratteRisk: 2,
    culinaryAdvice: 'Indétrônable en grillade. On le mange entier après l\'avoir écaillé soigneusement.',
    fishingAdvice: 'Se pêche souvent au filet ou à la ligne fine avec de la pâte. Attention aux épines venimeuses !',
    category: 'Lagon',
    imagePlaceholder: 'fish-picot-raye'
  },
  {
    id: 'poisson-perroquet',
    name: 'Poisson-perroquet',
    scientificName: 'Scaridae sp.',
    gratteRisk: 8,
    culinaryAdvice: 'Chair délicate. Se cuisine souvent entier ou en papillote.',
    fishingAdvice: 'Chasse sous-marine ou par hasard à la ligne.',
    category: 'Lagon',
    imagePlaceholder: 'fish-poisson-perroquet'
  },
  {
    id: 'rouget-nuit',
    name: 'Rouget de nuit',
    scientificName: 'Parupeneus sp.',
    gratteRisk: 0,
    culinaryAdvice: 'Chair fine au goût de crevette. Délicieux simplement poêlé.',
    fishingAdvice: 'Pêche nocturne sur le sable.',
    category: 'Lagon',
    imagePlaceholder: 'fish-rouget-nuit'
  },
  {
    id: 'saumonee-loche-bleu',
    name: 'Saumonée loche bleu',
    scientificName: 'Plectropomus sp.',
    gratteRisk: 20,
    culinaryAdvice: 'Exceptionnel. La chair est fondante.',
    fishingAdvice: 'Leurres souples en profondeur modérée.',
    category: 'Lagon',
    imagePlaceholder: 'fish-saumonee-loche-bleu'
  },
  {
    id: 'saumonee',
    name: 'Saumonée',
    scientificName: 'Plectropomus leopardus',
    gratteRisk: 20,
    culinaryAdvice: 'Le must du lagon. Se déguste à toutes les sauces.',
    fishingAdvice: 'Passes et zones de récif actif.',
    category: 'Recif',
    imagePlaceholder: 'fish-saumonee'
  },
  {
    id: 'tazard',
    name: 'Tazard',
    scientificName: 'Scomberomorus commerson',
    gratteRisk: 5,
    culinaryAdvice: 'Le roi du sashimi en Calédonie. Se mange aussi très bien en steaks grillés ou fumé.',
    fishingAdvice: 'Se pêche à la traîne rapide (7-9 nds) avec des leurres à bavette longue (Rapala Magnum).',
    category: 'Large',
    imagePlaceholder: 'fish-tazard'
  },
  {
    id: 'vieille-corail',
    name: 'Vieille de corail',
    scientificName: 'Cephalopholis argus',
    gratteRisk: 30,
    culinaryAdvice: 'Méfiance vis-à-vis de la gratte. Chair fine mais goût parfois fort.',
    fishingAdvice: 'Vit dans le corail peu profond. Très facile à prendre.',
    category: 'Lagon',
    imagePlaceholder: 'fish-vieille-corail'
  },
  {
    id: 'vivanneau-tetu',
    name: 'Vivanneau têtu',
    scientificName: 'Lutjanus malabaricus',
    gratteRisk: 15,
    culinaryAdvice: 'Chair excellente. Très bon au four ou en court-bouillon.',
    fishingAdvice: 'Se pêche en profondeur sur les tombants.',
    category: 'Large',
    imagePlaceholder: 'fish-vivanneau-tetu'
  },
  {
    id: 'wahoo',
    name: 'Wahoo',
    scientificName: 'Acanthocybium solandri',
    gratteRisk: 5,
    culinaryAdvice: 'Chair exceptionnelle, très proche du thon mais plus fine. Parfait en steaks.',
    fishingAdvice: 'Pêche de hauturier à la traîne rapide.',
    category: 'Large',
    imagePlaceholder: 'fish-wahoo'
  }
];
