export type Vegetable = {
  name: string;
  icon: string;
  sowingSeasonWarm: string;
  sowingSeasonCool: string;
  harvestWarm: string;
  harvestCool: string;
  advice: {
    plantingLocation: string;
    sunlight: string;
    watering: string;
    soilFertilizer: string;
    pests: string;
    grandmaRecipe: string;
  };
};

export const semisData: Vegetable[] = [
  {
    name: 'Tomate',
    icon: '🍅',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: 'Mars à Mai',
    harvestWarm: 'Décembre à Mars',
    harvestCool: 'Juin à Août',
    advice: {
      plantingLocation:
        'En pleine terre, dans un endroit abrité des vents dominants. Tuteurer solidement.',
      sunlight: 'Plein soleil indispensable (minimum 6-8 heures par jour).',
      watering:
        'Arrosage régulier et copieux au pied, jamais sur le feuillage pour éviter le mildiou. Pailler le sol pour garder l\'humidité.',
      soilFertilizer:
        'Sol riche, profond et bien drainé. Enrichir avec du compost bien mûr et un engrais spécial tomates.',
      pests: 'Mildiou, pucerons, aleurodes (mouches blanches), vers.',
      grandmaRecipe:
        'Planter du basilic ou des oeillets d\'Inde à proximité pour repousser les nuisibles. Le purin d\'ortie en pulvérisation renforce la plante.',
    },
  },
  {
    name: 'Salade (Laitue)',
    icon: '🥬',
    sowingSeasonWarm: 'Toute l\'année (privilégier les variétés résistantes à la chaleur)',
    sowingSeasonCool: 'Toute l\'année',
    harvestWarm: '30 à 50 jours après le semis',
    harvestCool: '40 à 60 jours après le semis',
    advice: {
      plantingLocation:
        'Mi-ombre en saison chaude pour éviter qu\'elle ne monte en graines trop vite. Plein soleil en saison fraîche.',
      sunlight: 'Soleil doux le matin, ombre pendant les heures les plus chaudes.',
      watering:
        'Arrosages légers mais très fréquents pour maintenir un sol frais mais pas détrempé. Le goutte-à-goutte est idéal.',
      soilFertilizer: 'Sol léger, humifère et frais. Un bon compost suffit.',
      pests: 'Limaces et escargots.',
      grandmaRecipe:
        'Disposer un cordon de cendres de bois, de coquilles d\'oeufs broyées ou de marc de café autour des plants pour créer une barrière anti-limaces.',
    },
  },
  {
    name: 'Patate douce',
    icon: '🍠',
    sowingSeasonWarm: 'Octobre à Décembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Mars à Mai',
    harvestCool: '-',
    advice: {
      plantingLocation:
        'En buttes ou planches surélevées pour favoriser le développement des tubercules et le drainage.',
      sunlight: 'Beaucoup de soleil et de chaleur.',
      watering:
        'Arrosage régulier, surtout pendant les premières semaines. Diminuer l\'arrosage un mois avant la récolte pour favoriser la tubérisation.',
      soilFertilizer: 'Sol léger, sableux et bien drainé. N\'aime pas les excès d\'azote qui favorisent le feuillage au détriment des tubercules.',
      pests: 'Charançons de la patate douce, rats.',
      grandmaRecipe:
        'Rotation des cultures indispensable. Ne pas replanter de patates douces au même endroit avant 3-4 ans pour limiter les risques de maladies et de charançons.',
    },
  },
    {
    name: 'Manioc',
    icon: '🪵',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Toute l\'année (après 9-12 mois)',
    harvestCool: 'Toute l\'année (après 9-12 mois)',
    advice: {
      plantingLocation:
        'Planter des boutures de 20-30 cm, enterrées de moitié, inclinées ou à plat.',
      sunlight: 'Plein soleil.',
      watering:
        'Très résistant à la sécheresse une fois établi. Arroser les premières semaines après la plantation.',
      soilFertilizer:
        'S\'adapte à tous types de sols pauvres, mais préfère un sol léger et bien drainé. Pas d\'engrais nécessaire en général.',
      pests: 'Cochenilles, acariens.',
      grandmaRecipe:
        'La cendre de bois au pied des plants peut aider à limiter les attaques de certains insectes du sol.',
    },
  },
  {
    name: 'Courgette',
    icon: '🥒',
    sowingSeasonWarm: 'Septembre à Janvier',
    sowingSeasonCool: 'Mars à Avril',
    harvestWarm: 'Novembre à Mars',
    harvestCool: 'Mai à Juin',
    advice: {
      plantingLocation:
        'Prévoir de l\'espace, la plante est coureuse. Planter en poquets de 2-3 graines.',
      sunlight: 'Plein soleil.',
      watering:
        'Arrosage régulier et abondant au pied. Un bon paillage est très bénéfique.',
      soilFertilizer:
        'Sol très riche en matière organique. Incorporer du compost ou du fumier bien décomposé à la plantation.',
      pests: 'Oïdium (poudre blanche sur les feuilles), pucerons.',
      grandmaRecipe:
        'Pulvériser une solution de lait écrémé (1 part de lait pour 9 parts d\'eau) sur le feuillage pour prévenir l\'oïdium.',
    },
  },
];
