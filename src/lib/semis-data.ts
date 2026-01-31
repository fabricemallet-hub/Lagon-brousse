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
  {
    name: 'Taro',
    icon: '🌿',
    sowingSeasonWarm: 'Septembre à Février',
    sowingSeasonCool: 'Toute l\'année dans les zones humides',
    harvestWarm: 'Après 8-12 mois',
    harvestCool: 'Après 8-12 mois',
    advice: {
      plantingLocation: 'Dans un sol très humide, voire marécageux. Idéal en bord de "creek" (ruisseau).',
      sunlight: 'Mi-ombre à ensoleillé, mais apprécie l\'humidité constante.',
      watering: 'Nécessite beaucoup d\'eau, le sol ne doit jamais sécher. L\'irrigation par inondation est parfois pratiquée.',
      soilFertilizer: 'Sol très riche en matière organique, vaseux. Apprécie un bon paillage de feuilles.',
      pests: 'Doryphores du taro, pourriture des tubercules en cas de mauvais drainage.',
      grandmaRecipe: 'La culture en rotation et le maintien d\'un écosystème de creek sain sont les meilleures préventions.'
    }
  },
  {
    name: 'Haricot Vert',
    icon: '🫛',
    sowingSeasonWarm: 'Septembre à Décembre',
    sowingSeasonCool: 'Mars à Mai',
    harvestWarm: 'Novembre à Février',
    harvestCool: 'Mai à Juillet',
    advice: {
      plantingLocation: 'Semis direct en ligne. Variétés naines ou à rames (prévoir un support).',
      sunlight: 'Plein soleil.',
      watering: 'Arrosage régulier au pied sans mouiller le feuillage, surtout pendant la floraison et la formation des gousses.',
      soilFertilizer: 'Sol léger et bien réchauffé. Le haricot fixe l\'azote, donc pas besoin d\'un engrais trop riche en azote.',
      pests: 'Pucerons, araignées rouges, rouille.',
      grandmaRecipe: 'Semer des capucines à proximité pour attirer les pucerons loin des haricots. Une pulvérisation d\'eau savonneuse (savon noir) peut aider.'
    }
  },
  {
    name: 'Piment',
    icon: '🌶️',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: 'Mars à Mai (en zone abritée)',
    harvestWarm: 'Toute l\'année si bien entretenu',
    harvestCool: 'Toute l\'année si bien entretenu',
    advice: {
      plantingLocation: 'En pot ou en pleine terre dans un endroit chaud et abrité du vent.',
      sunlight: 'Plein soleil et chaleur.',
      watering: 'Arrosage modéré mais régulier. Laisser la terre sécher légèrement entre deux arrosages.',
      soilFertilizer: 'Sol bien drainé, pas trop riche. Un excès d\'engrais favorise le feuillage au détriment des fruits.',
      pests: 'Pucerons et aleurodes.',
      grandmaRecipe: 'Un paillage de feuilles de consoude au pied des plants est un excellent fertilisant naturel.'
    }
  },
  {
    name: 'Chou de Chine (Pak Choi)',
    icon: '🥬',
    sowingSeasonWarm: 'Toute l\'année, mais préfère la fraîcheur',
    sowingSeasonCool: 'Février à Juin',
    harvestWarm: '30-45 jours après le semis',
    harvestCool: '30-45 jours après le semis',
    advice: {
      plantingLocation: 'En ligne, directement en place. Culture très rapide.',
      sunlight: 'Mi-ombre, surtout en saison chaude pour éviter une montée en graine rapide.',
      watering: 'Arrosage très régulier pour garder le sol frais.',
      soilFertilizer: 'Sol riche en humus.',
      pests: 'Altises (petits coléoptères qui font des trous dans les feuilles), limaces.',
      grandmaRecipe: 'Un arrosage fréquent du feuillage le soir décourage les altises. Cendres de bois contre les limaces.'
    }
  },
  {
    name: 'Pastèque',
    icon: '🍉',
    sowingSeasonWarm: 'Septembre à Décembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Décembre à Mars',
    harvestCool: '-',
    advice: {
      plantingLocation: 'Nécessite beaucoup d\'espace pour courir. Planter sur une butte enrichie en compost.',
      sunlight: 'Plein soleil et chaleur indispensables.',
      watering: 'Arrosage abondant et régulier au pied. Cesser l\'arrosage 1 à 2 semaines avant la récolte pour concentrer les sucres dans le fruit.',
      soilFertilizer: 'Sol très riche et bien drainé.',
      pests: 'Mildiou, oïdium.',
      grandmaRecipe: 'Placer une tuile ou une planche sous chaque fruit pour l\'isoler de l\'humidité du sol et éviter la pourriture.'
    }
  },
  {
    name: 'Concombre',
    icon: '🥒',
    sowingSeasonWarm: 'Septembre à Janvier',
    sowingSeasonCool: 'Mars à Avril',
    harvestWarm: 'Novembre à Mars',
    harvestCool: 'Mai à Juin',
    advice: {
      plantingLocation: 'Faire grimper sur un treillis ou un grillage pour un gain de place et une meilleure aération.',
      sunlight: 'Plein soleil.',
      watering: 'Arrosage très régulier au pied, le concombre est gourmand en eau. Pailler généreusement.',
      soilFertilizer: 'Sol riche, frais et bien fumé.',
      pests: 'Oïdium, mildiou, araignées rouges.',
      grandmaRecipe: 'Comme pour la courgette, une pulvérisation de lait dilué peut aider contre l\'oïdium. Associer avec du maïs qui lui fournira un support naturel.'
    }
  },
  {
    name: 'Herbes Aromatiques',
    icon: '🌿',
    sowingSeasonWarm: 'Persil: toute l\'année. Thym: semis au frais ou bouturage.',
    sowingSeasonCool: 'Persil: toute l\'année. Thym: semis au frais ou bouturage.',
    harvestWarm: 'Au besoin',
    harvestCool: 'Au besoin',
    advice: {
      plantingLocation: 'En pot, en jardinière ou en bordure de potager. Facile à cultiver.',
      sunlight: 'Persil: mi-ombre. Thym: plein soleil.',
      watering: 'Persil: sol toujours frais. Thym: supporte la sécheresse, arrosage modéré.',
      soilFertilizer: 'Sol léger et bien drainé. Pas trop d\'engrais pour ne pas diluer les arômes.',
      pests: 'Pucerons sur le persil.',
      grandmaRecipe: 'Couper régulièrement les herbes (même si vous n\'en avez pas besoin) pour stimuler la production de nouvelles feuilles et éviter que les plants ne montent en graine.'
    }
  }
];
