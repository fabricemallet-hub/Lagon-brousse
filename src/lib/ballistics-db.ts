
export type MunitionData = {
  id: string;
  caliber: string;
  model: string;
  weight: number; // grains or grams
  v0: number; // m/s
  bc: number; // G1 Ballistic Coefficient
  usage: string;
  color: string;
  type: 'bullet' | 'shot' | 'slug' | 'buckshot';
};

export const BALLISTIC_DATABASE: MunitionData[] = [
  // .222 Remington
  { id: '222-rem-40-vmax', caliber: '.222 Rem', model: 'Hornady V-MAX', weight: 40, v0: 1100, bc: 0.200, usage: 'Nuisibles (très rapide)', color: 'bg-emerald-500', type: 'bullet' },
  { id: '222-rem-50-vmax', caliber: '.222 Rem', model: 'Hornady V-MAX', weight: 50, v0: 960, bc: 0.242, usage: 'Nuisibles / Précision', color: 'bg-emerald-500', type: 'bullet' },
  { id: '222-rem-55-nbt', caliber: '.222 Rem', model: 'Nosler Ballistic Tip', weight: 55, v0: 980, bc: 0.267, usage: 'Précision / Tir biche', color: 'bg-emerald-500', type: 'bullet' },
  { id: '222-rem-50-pp', caliber: '.222 Rem', model: 'Winchester Power-Point', weight: 50, v0: 950, bc: 0.180, usage: 'Expansion rapide', color: 'bg-emerald-500', type: 'bullet' },
  
  // .243 Winchester
  { id: '243-win-80-superx', caliber: '.243 Win', model: 'Winchester Super-X', weight: 80, v0: 1020, bc: 0.276, usage: 'Tir de plaine (tendu)', color: 'bg-yellow-600', type: 'bullet' },
  { id: '243-win-95-sst', caliber: '.243 Win', model: 'Hornady SST', weight: 95, v0: 920, bc: 0.355, usage: 'Précision en savane', color: 'bg-yellow-600', type: 'bullet' },
  { id: '243-win-100-gk', caliber: '.243 Win', model: 'Sierra GameKing', weight: 100, v0: 900, bc: 0.430, usage: 'Biche / Cerf Rusa moyen', color: 'bg-yellow-600', type: 'bullet' },
  { id: '243-win-100-pp', caliber: '.243 Win', model: 'Winchester Power-Point', weight: 100, v0: 890, bc: 0.350, usage: 'Polyvalent', color: 'bg-yellow-600', type: 'bullet' },

  // .25-06 Remington
  { id: '25-06-rem-117-sst', caliber: '.25-06 Rem', model: 'Hornady SST', weight: 117, v0: 910, bc: 0.443, usage: 'Polyvalent longue dist.', color: 'bg-cyan-500', type: 'bullet' },
  { id: '25-06-rem-120-cl', caliber: '.25-06 Rem', model: 'Remington Core-Lokt', weight: 120, v0: 910, bc: 0.391, usage: 'Plaine / Savane (Reference)', color: 'bg-cyan-500', type: 'bullet' },

  // 6.5 Creedmoor
  { id: '65-cm-143-eldx', caliber: '6.5 Creedmoor', model: 'Hornady ELD-X', weight: 143, v0: 823, bc: 0.625, usage: 'Précision chirurgicale', color: 'bg-teal-600', type: 'bullet' },
  { id: '65-cm-140-match', caliber: '6.5 Creedmoor', model: 'Hornady ELD-Match', weight: 140, v0: 820, bc: 0.646, usage: 'Longue distance (Compétition)', color: 'bg-teal-600', type: 'bullet' },

  // .270 Winchester
  { id: '270-win-130-sst', caliber: '.270 Win', model: 'Hornady SST', weight: 130, v0: 930, bc: 0.460, usage: 'Expansion violente (Savane)', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-130-ds', caliber: '.270 Win', model: 'Winchester Deer Season', weight: 130, v0: 930, bc: 0.392, usage: 'Savane (arrêt net)', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-140-ab', caliber: '.270 Win', model: 'Nosler AccuBond', weight: 140, v0: 880, bc: 0.496, usage: 'Polyvalent Cerf Rusa', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-150-pt', caliber: '.270 Win', model: 'Nosler Partition', weight: 150, v0: 850, bc: 0.465, usage: 'Gros Cerf / Pénétration', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-155-ta', caliber: '.270 Win', model: 'Federal Terminal Ascent', weight: 155, v0: 870, bc: 0.586, usage: 'Très gros cerfs', color: 'bg-orange-500', type: 'bullet' },
  { id: '270-win-subso', caliber: '.270 Win', model: 'Subsonic Custom', weight: 150, v0: 320, bc: 0.450, usage: 'Tir discret (80-100m max)', color: 'bg-orange-900', type: 'bullet' },

  // .270 Winchester Short Magnum (WSM)
  { id: '270-wsm-130-sst', caliber: '.270 WSM', model: 'Hornady SST', weight: 130, v0: 1000, bc: 0.460, usage: 'Vitesse Magnum / Savane', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-140-ab', caliber: '.270 WSM', model: 'Nosler AccuBond', weight: 140, v0: 960, bc: 0.496, usage: 'Puissance Magnum Polyvalente', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-150-pt', caliber: '.270 WSM', model: 'Nosler Partition', weight: 150, v0: 930, bc: 0.465, usage: 'Gros gibier / Pénétration Max', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-110-ttsx', caliber: '.270 WSM', model: 'Barnes TTSX', weight: 110, v0: 1060, bc: 0.323, usage: 'Vitesse extrême / Sans plomb', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-145-eldx', caliber: '.270 WSM', model: 'ELD-X (Precision)', weight: 145, v0: 950, bc: 0.536, usage: 'Tir de précision Magnum', color: 'bg-orange-700', type: 'bullet' },
  { id: '270-wsm-subso', caliber: '.270 WSM', model: 'Subsonic Custom', weight: 160, v0: 325, bc: 0.480, usage: 'Tir discret Magnum (Proche)', color: 'bg-orange-950', type: 'bullet' },

  // 7mm-08
  { id: '7mm-08-120-ttsx', caliber: '7mm-08', model: 'Barnes TTSX (Sans plomb)', weight: 120, v0: 915, bc: 0.373, usage: 'Vitesse / Pénétration', color: 'bg-indigo-600', type: 'bullet' },
  { id: '7mm-08-140-ab', caliber: '7mm-08', model: 'Nosler AccuBond', weight: 140, v0: 850, bc: 0.485, usage: 'Approche / Montagne', color: 'bg-indigo-600', type: 'bullet' },
  { id: '7mm-08-150-ph', caliber: '7mm-08', model: 'Hornady Precision Hunter', weight: 150, v0: 845, bc: 0.574, usage: 'Tir de montagne / crêtes', color: 'bg-indigo-600', type: 'bullet' },

  // .308 Winchester
  { id: '308-win-150-pp', caliber: '.308 Win', model: 'Win. Power-Point', weight: 150, v0: 860, bc: 0.294, usage: 'Standard Brousse', color: 'bg-blue-500', type: 'bullet' },
  { id: '308-win-165-sst', caliber: '.308 Win', model: 'Hornady SST', weight: 165, v0: 840, bc: 0.447, usage: 'Équilibre Vitesse/Poids', color: 'bg-blue-500', type: 'bullet' },
  { id: '308-win-180-partition', caliber: '.308 Win', model: 'Nosler Partition', weight: 180, v0: 790, bc: 0.474, usage: 'Cochon / Cerf massif', color: 'bg-blue-500', type: 'bullet' },
  { id: '308-win-180-shh', caliber: '.308 Win', model: 'Sako Super Hammerhead', weight: 180, v0: 780, bc: 0.430, usage: 'Rétention de masse maximale', color: 'bg-blue-500', type: 'bullet' },

  // .30-06 Sprg
  { id: '30-06-150-cl', caliber: '.30-06 Sprg', model: 'Remington Core-Lokt', weight: 150, v0: 880, bc: 0.314, usage: 'Tir rapide en forêt', color: 'bg-green-600', type: 'bullet' },
  { id: '30-06-180-shh', caliber: '.30-06 Sprg', model: 'Sako Hammerhead', weight: 180, v0: 820, bc: 0.383, usage: 'Arrêt net (classique)', color: 'bg-green-600', type: 'bullet' },
  { id: '30-06-180-club', caliber: '.30-06 Sprg', model: 'Core-Lokt Ultra Bonded', weight: 180, v0: 825, bc: 0.420, usage: 'Précision et transfert d\'énergie', color: 'bg-green-600', type: 'bullet' },
  { id: '30-06-200-oryx', caliber: '.30-06 Sprg', model: 'Norma Oryx (Lourde)', weight: 200, v0: 780, bc: 0.400, usage: 'Chasse en battue dense', color: 'bg-green-600', type: 'bullet' },

  // 7mm Rem Mag
  { id: '7mm-rm-150-tc', caliber: '7mm Rem Mag', model: 'Federal Trophy Copper', weight: 150, v0: 940, bc: 0.490, usage: 'Très longue distance (Sans plomb)', color: 'bg-rose-700', type: 'bullet' },
  { id: '7mm-rm-160-ab', caliber: '7mm Rem Mag', model: 'Nosler AccuBond', weight: 160, v0: 900, bc: 0.531, usage: 'Performance Magnum Polyvalente', color: 'bg-rose-700', type: 'bullet' },

  // .300 Win Mag
  { id: '300-wm-150-xp', caliber: '.300 Win Mag', model: 'Winchester XP', weight: 150, v0: 990, bc: 0.387, usage: 'Vitesse fulgurante', color: 'bg-red-800', type: 'bullet' },
  { id: '300-wm-200-eldx', caliber: '.300 Win Mag', model: 'Hornady ELD-X', weight: 200, v0: 870, bc: 0.626, usage: 'Puissance maximale', color: 'bg-red-800', type: 'bullet' },
  { id: '300-wm-215-hybrid', caliber: '.300 Win Mag', model: 'Berger Hybrid', weight: 215, v0: 850, bc: 0.691, usage: 'Tir de précision extrême', color: 'bg-red-800', type: 'bullet' },

  // 9.3x62
  { id: '93-oryx-18', caliber: '9.3x62', model: 'Norma Oryx', weight: 18.5, v0: 720, bc: 0.340, usage: 'Stoppeur cochon / cerf brousse', color: 'bg-stone-700', type: 'bullet' },

  // --- Calibres Lisses ---
  { id: '12-bfs-26', caliber: 'Calibre 12', model: 'Balle Sauvestre (BFS)', weight: 26, v0: 500, bc: 0.170, usage: 'Battue (0-80m)', color: 'bg-red-600', type: 'slug' },
  { id: '12-brenn-31', caliber: 'Calibre 12', model: 'Balle Brenneke', weight: 31.5, v0: 430, bc: 0.120, usage: 'Forêt dense (0-50m)', color: 'bg-red-600', type: 'slug' },
  { id: '12-plomb-2', caliber: 'Calibre 12', model: 'Plomb n°2', weight: 32, v0: 400, bc: 0.015, usage: 'Roussette, Gros canards.', color: 'bg-red-600', type: 'shot' },
  { id: '12-plomb-4', caliber: 'Calibre 12', model: 'Plomb n°4', weight: 32, v0: 400, bc: 0.015, usage: 'Gros canards, nuisibles.', color: 'bg-red-600', type: 'shot' },
  { id: '12-plomb-6', caliber: 'Calibre 12', model: 'Plomb n°6', weight: 32, v0: 400, bc: 0.015, usage: 'Notou, Pigeon vert, Collier blanc.', color: 'bg-red-600', type: 'shot' },
  { id: '12-plomb-9', caliber: 'Calibre 12', model: 'Plomb n°9', weight: 32, v0: 400, bc: 0.015, usage: 'Entraînement / Petits nuisibles.', color: 'bg-red-600', type: 'shot' },
  { id: '12-chev-9', caliber: 'Calibre 12', model: 'Chevrotine 9 grains', weight: 32, v0: 400, bc: 0.045, usage: 'Cochon sauvage (très proche).', color: 'bg-red-600', type: 'buckshot' },

  { id: '16-slug-24', caliber: 'Calibre 16', model: 'Balle Type Slug', weight: 24.5, v0: 400, bc: 0.100, usage: 'Tradition / Forêt', color: 'bg-orange-800', type: 'slug' },
  { id: '16-plomb-6', caliber: 'Calibre 16', model: 'Plomb n°6', weight: 28, v0: 390, bc: 0.015, usage: 'Efficace pour Notou et Pigeon vert.', color: 'bg-orange-800', type: 'shot' },

  { id: '20-win-22', caliber: 'Calibre 20', model: 'Balle Winchester', weight: 22.5, v0: 420, bc: 0.110, usage: 'Léger / Précis', color: 'bg-yellow-800', type: 'slug' },
  { id: '20-plomb-6', caliber: 'Calibre 20', model: 'Plomb n°6', weight: 24, v0: 390, bc: 0.015, usage: 'Excellent pour la plume, recul faible.', color: 'bg-yellow-800', type: 'shot' },

  { id: '410-brenn-7.5', caliber: 'Calibre .410', model: 'Balle Brenneke', weight: 7.5, v0: 530, bc: 0.090, usage: 'Jeune Cerf / Cochon (0-50m)', color: 'bg-stone-500', type: 'slug' },
  { id: '410-pdx1', caliber: 'Calibre .410', model: 'Winchester PDX1 (Défense)', weight: 19, v0: 350, bc: 0.040, usage: 'Hybride : 3 disques + 12 billes.', color: 'bg-stone-500', type: 'slug' },
  { id: '410-plomb-6', caliber: 'Calibre .410', model: 'Plomb n°6', weight: 12, v0: 370, bc: 0.015, usage: 'Tourterelles et petits oiseaux.', color: 'bg-stone-500', type: 'shot' },
  { id: '410-plomb-7.5', caliber: 'Calibre .410', model: 'Plomb n°7.5', weight: 12, v0: 350, bc: 0.015, usage: 'Tourterelles / Merles (Très discret).', color: 'bg-stone-500', type: 'shot' },
  { id: '410-buck-000', caliber: 'Calibre .410', model: 'Chevrotine 000 Buck', weight: 15, v0: 340, bc: 0.040, usage: 'Nuisibles / Cochon (Proche).', color: 'bg-stone-500', type: 'buckshot' },
];

export const CALIBERS = Array.from(new Set(BALLISTIC_DATABASE.map(m => m.caliber)));
