import { buildChoices, type Difficulty, type Question } from '../../shared/quiz/quiz.js';

export const SCIENCE_TOPICS = ['biology', 'chemistry', 'physics', 'space', 'earth'] as const;

export type ScienceTopic = (typeof SCIENCE_TOPICS)[number];
export type ScienceTopicFilter = ScienceTopic | 'all';
type ScienceLocale = 'en' | 'fr';
type BilingualText = readonly [en: string, fr: string];

interface ScienceQuestionItem {
  id: string;
  topic: ScienceTopic;
  difficulty: Difficulty;
  prompt: BilingualText;
  answer: BilingualText;
  decoys: readonly BilingualText[];
  hint: BilingualText;
}

interface ScienceQuestion extends Question {
  id: string;
  topic: ScienceTopic;
}

export const SCIENCE_QUESTIONS: readonly ScienceQuestionItem[] = [
  {
    id: 'biology-easy-heart',
    topic: 'biology',
    difficulty: 'easy',
    prompt: [
      'Which organ pumps blood through the human body?',
      'Quel organe pompe le sang dans le corps humain ?',
    ],
    answer: ['The heart', 'Le cœur'],
    decoys: [
      ['The lungs', 'Les poumons'],
      ['The liver', 'Le foie'],
      ['The stomach', 'L’estomac'],
    ],
    hint: [
      'The heart contracts to drive blood through the vessels.',
      'Le cœur se contracte pour propulser le sang dans les vaisseaux.',
    ],
  },
  {
    id: 'biology-easy-photosynthesis',
    topic: 'biology',
    difficulty: 'easy',
    prompt: [
      'Which gas do plants absorb for photosynthesis?',
      'Quel gaz les plantes absorbent-elles pour la photosynthèse ?',
    ],
    answer: ['Carbon dioxide', 'Le dioxyde de carbone'],
    decoys: [
      ['Oxygen', 'L’oxygène'],
      ['Nitrogen', 'L’azote'],
      ['Hydrogen', 'L’hydrogène'],
    ],
    hint: [
      'Plants use carbon dioxide, water and light to make sugars.',
      'Les plantes utilisent du dioxyde de carbone, de l’eau et de la lumière pour fabriquer des sucres.',
    ],
  },
  {
    id: 'biology-easy-skin',
    topic: 'biology',
    difficulty: 'easy',
    prompt: [
      'What is the largest organ of the human body?',
      'Quel est le plus grand organe du corps humain ?',
    ],
    answer: ['The skin', 'La peau'],
    decoys: [
      ['The liver', 'Le foie'],
      ['The brain', 'Le cerveau'],
      ['The lungs', 'Les poumons'],
    ],
    hint: [
      'Skin covers and protects the entire body.',
      'La peau recouvre et protège tout le corps.',
    ],
  },
  {
    id: 'chemistry-easy-water',
    topic: 'chemistry',
    difficulty: 'easy',
    prompt: ['What is the chemical formula of water?', 'Quelle est la formule chimique de l’eau ?'],
    answer: ['H₂O', 'H₂O'],
    decoys: [
      ['CO₂', 'CO₂'],
      ['O₂', 'O₂'],
      ['NaCl', 'NaCl'],
    ],
    hint: [
      'One water molecule contains two hydrogen atoms and one oxygen atom.',
      'Une molécule d’eau contient deux atomes d’hydrogène et un atome d’oxygène.',
    ],
  },
  {
    id: 'chemistry-easy-ph',
    topic: 'chemistry',
    difficulty: 'easy',
    prompt: [
      'What pH is neutral at room temperature?',
      'Quel pH est neutre à température ambiante ?',
    ],
    answer: ['7', '7'],
    decoys: [
      ['0', '0'],
      ['5', '5'],
      ['14', '14'],
    ],
    hint: [
      'Values below 7 are acidic and values above 7 are basic.',
      'Les valeurs inférieures à 7 sont acides et celles supérieures à 7 sont basiques.',
    ],
  },
  {
    id: 'chemistry-easy-element',
    topic: 'chemistry',
    difficulty: 'easy',
    prompt: [
      'Which chemical symbol represents oxygen?',
      'Quel symbole chimique représente l’oxygène ?',
    ],
    answer: ['O', 'O'],
    decoys: [
      ['Ox', 'Ox'],
      ['Og', 'Og'],
      ['On', 'On'],
    ],
    hint: [
      'O is oxygen; Og is the symbol for oganesson.',
      'O représente l’oxygène ; Og est le symbole de l’oganesson.',
    ],
  },
  {
    id: 'physics-easy-force',
    topic: 'physics',
    difficulty: 'easy',
    prompt: ['What is the SI unit of force?', 'Quelle est l’unité SI de la force ?'],
    answer: ['The newton', 'Le newton'],
    decoys: [
      ['The joule', 'Le joule'],
      ['The watt', 'Le watt'],
      ['The pascal', 'Le pascal'],
    ],
    hint: [
      'One newton accelerates one kilogram by one metre per second squared.',
      'Un newton accélère un kilogramme d’un mètre par seconde carrée.',
    ],
  },
  {
    id: 'physics-easy-light',
    topic: 'physics',
    difficulty: 'easy',
    prompt: [
      'Which travels fastest in a vacuum?',
      'Qu’est-ce qui se déplace le plus vite dans le vide ?',
    ],
    answer: ['Light', 'La lumière'],
    decoys: [
      ['Sound', 'Le son'],
      ['A jet aircraft', 'Un avion à réaction'],
      ['An ocean wave', 'Une vague océanique'],
    ],
    hint: [
      'Light travels at about 300,000 kilometres per second in a vacuum.',
      'La lumière parcourt environ 300 000 kilomètres par seconde dans le vide.',
    ],
  },
  {
    id: 'physics-easy-motion-energy',
    topic: 'physics',
    difficulty: 'easy',
    prompt: [
      'What kind of energy does a moving object have?',
      'Quelle énergie possède un objet en mouvement ?',
    ],
    answer: ['Kinetic energy', 'De l’énergie cinétique'],
    decoys: [
      ['Chemical energy', 'De l’énergie chimique'],
      ['Nuclear energy', 'De l’énergie nucléaire'],
      ['Elastic energy', 'De l’énergie élastique'],
    ],
    hint: [
      'Kinetic energy depends on mass and speed.',
      'L’énergie cinétique dépend de la masse et de la vitesse.',
    ],
  },
  {
    id: 'space-easy-mars',
    topic: 'space',
    difficulty: 'easy',
    prompt: [
      'Which planet is known as the Red Planet?',
      'Quelle planète est surnommée la planète rouge ?',
    ],
    answer: ['Mars', 'Mars'],
    decoys: [
      ['Venus', 'Vénus'],
      ['Jupiter', 'Jupiter'],
      ['Mercury', 'Mercure'],
    ],
    hint: [
      'Iron oxides give the Martian surface its reddish colour.',
      'Les oxydes de fer donnent sa couleur rougeâtre à la surface martienne.',
    ],
  },
  {
    id: 'space-easy-sun',
    topic: 'space',
    difficulty: 'easy',
    prompt: [
      'What is at the centre of our Solar System?',
      'Qu’y a-t-il au centre de notre Système solaire ?',
    ],
    answer: ['The Sun', 'Le Soleil'],
    decoys: [
      ['Earth', 'La Terre'],
      ['The Moon', 'La Lune'],
      ['Jupiter', 'Jupiter'],
    ],
    hint: [
      'The planets orbit the Sun because of its gravity.',
      'Les planètes tournent autour du Soleil grâce à sa gravité.',
    ],
  },
  {
    id: 'space-easy-moon',
    topic: 'space',
    difficulty: 'easy',
    prompt: ['What is Earth’s natural satellite?', 'Quel est le satellite naturel de la Terre ?'],
    answer: ['The Moon', 'La Lune'],
    decoys: [
      ['The Sun', 'Le Soleil'],
      ['Mars', 'Mars'],
      ['Titan', 'Titan'],
    ],
    hint: [
      'The Moon completes an orbit around Earth in about 27 days.',
      'La Lune effectue une orbite autour de la Terre en environ 27 jours.',
    ],
  },
  {
    id: 'earth-easy-mineral',
    topic: 'earth',
    difficulty: 'easy',
    prompt: ['What is the hardest natural mineral?', 'Quel est le minéral naturel le plus dur ?'],
    answer: ['Diamond', 'Le diamant'],
    decoys: [
      ['Quartz', 'Le quartz'],
      ['Granite', 'Le granite'],
      ['Calcite', 'La calcite'],
    ],
    hint: [
      'Diamond ranks 10 on the Mohs hardness scale.',
      'Le diamant atteint 10 sur l’échelle de dureté de Mohs.',
    ],
  },
  {
    id: 'earth-easy-lava',
    topic: 'earth',
    difficulty: 'easy',
    prompt: [
      'What is molten rock called after it reaches the surface?',
      'Comment appelle-t-on la roche en fusion lorsqu’elle atteint la surface ?',
    ],
    answer: ['Lava', 'La lave'],
    decoys: [
      ['Magma', 'Le magma'],
      ['Basalt', 'Le basalte'],
      ['Ash', 'La cendre'],
    ],
    hint: [
      'Below the surface it is magma; at the surface it is lava.',
      'Sous la surface, c’est du magma ; à la surface, c’est de la lave.',
    ],
  },
  {
    id: 'earth-easy-condensation',
    topic: 'earth',
    difficulty: 'easy',
    prompt: [
      'Which process turns water vapour into liquid droplets?',
      'Quel processus transforme la vapeur d’eau en gouttelettes liquides ?',
    ],
    answer: ['Condensation', 'La condensation'],
    decoys: [
      ['Evaporation', 'L’évaporation'],
      ['Sublimation', 'La sublimation'],
      ['Infiltration', 'L’infiltration'],
    ],
    hint: [
      'Cooling vapour condenses into droplets that can form clouds.',
      'En refroidissant, la vapeur se condense en gouttelettes qui peuvent former des nuages.',
    ],
  },
  {
    id: 'biology-medium-mitochondria',
    topic: 'biology',
    difficulty: 'medium',
    prompt: [
      'Which organelle produces most of a cell’s ATP?',
      'Quel organite produit la majeure partie de l’ATP d’une cellule ?',
    ],
    answer: ['The mitochondrion', 'La mitochondrie'],
    decoys: [
      ['The ribosome', 'Le ribosome'],
      ['The lysosome', 'Le lysosome'],
      ['The Golgi apparatus', 'L’appareil de Golgi'],
    ],
    hint: [
      'Cellular respiration in mitochondria converts nutrients into ATP.',
      'La respiration cellulaire dans les mitochondries transforme les nutriments en ATP.',
    ],
  },
  {
    id: 'biology-medium-rna',
    topic: 'biology',
    difficulty: 'medium',
    prompt: [
      'Which base occurs in RNA instead of thymine?',
      'Quelle base se trouve dans l’ARN à la place de la thymine ?',
    ],
    answer: ['Uracil', 'L’uracile'],
    decoys: [
      ['Adenine', 'L’adénine'],
      ['Guanine', 'La guanine'],
      ['Cytosine', 'La cytosine'],
    ],
    hint: [
      'RNA uses uracil, while DNA uses thymine.',
      'L’ARN utilise l’uracile, tandis que l’ADN utilise la thymine.',
    ],
  },
  {
    id: 'biology-medium-blood',
    topic: 'biology',
    difficulty: 'medium',
    prompt: [
      'Which blood type is the universal red-cell donor?',
      'Quel groupe sanguin est le donneur universel de globules rouges ?',
    ],
    answer: ['O negative', 'O négatif'],
    decoys: [
      ['AB positive', 'AB positif'],
      ['A negative', 'A négatif'],
      ['O positive', 'O positif'],
    ],
    hint: [
      'O-negative red cells lack A, B and Rh antigens.',
      'Les globules rouges O négatif ne portent pas les antigènes A, B ni Rh.',
    ],
  },
  {
    id: 'chemistry-medium-carbon',
    topic: 'chemistry',
    difficulty: 'medium',
    prompt: ['What is the atomic number of carbon?', 'Quel est le numéro atomique du carbone ?'],
    answer: ['6', '6'],
    decoys: [
      ['4', '4'],
      ['8', '8'],
      ['12', '12'],
    ],
    hint: [
      'Carbon atoms have six protons in their nuclei.',
      'Les atomes de carbone possèdent six protons dans leur noyau.',
    ],
  },
  {
    id: 'chemistry-medium-salt',
    topic: 'chemistry',
    difficulty: 'medium',
    prompt: ['What compound is represented by NaCl?', 'Quel composé est représenté par NaCl ?'],
    answer: ['Sodium chloride', 'Le chlorure de sodium'],
    decoys: [
      ['Sodium carbonate', 'Le carbonate de sodium'],
      ['Calcium chloride', 'Le chlorure de calcium'],
      ['Potassium chloride', 'Le chlorure de potassium'],
    ],
    hint: [
      'Na is sodium and Cl is chlorine; together they form table salt.',
      'Na est le sodium et Cl le chlore ; ensemble, ils forment le sel de table.',
    ],
  },
  {
    id: 'chemistry-medium-oxidation',
    topic: 'chemistry',
    difficulty: 'medium',
    prompt: [
      'In a redox reaction, what does oxidation involve?',
      'Dans une réaction redox, qu’implique l’oxydation ?',
    ],
    answer: ['Loss of electrons', 'Une perte d’électrons'],
    decoys: [
      ['Gain of electrons', 'Un gain d’électrons'],
      ['Gain of neutrons', 'Un gain de neutrons'],
      ['Loss of protons', 'Une perte de protons'],
    ],
    hint: [
      'The mnemonic OIL RIG begins with Oxidation Is Loss.',
      'Le moyen mnémotechnique indique que l’oxydation est une perte d’électrons.',
    ],
  },
  {
    id: 'physics-medium-ohm',
    topic: 'physics',
    difficulty: 'medium',
    prompt: ['Which equation states Ohm’s law?', 'Quelle équation exprime la loi d’Ohm ?'],
    answer: ['V = I × R', 'V = I × R'],
    decoys: [
      ['P = m × g', 'P = m × g'],
      ['E = m × c²', 'E = m × c²'],
      ['F = m × a', 'F = m × a'],
    ],
    hint: [
      'Voltage equals current multiplied by resistance.',
      'La tension est égale à l’intensité multipliée par la résistance.',
    ],
  },
  {
    id: 'physics-medium-sound',
    topic: 'physics',
    difficulty: 'medium',
    prompt: [
      'Why can sound not travel through a vacuum?',
      'Pourquoi le son ne peut-il pas se propager dans le vide ?',
    ],
    answer: ['There are no particles to vibrate', 'Il n’y a pas de particules à faire vibrer'],
    decoys: [
      ['Gravity blocks it', 'La gravité le bloque'],
      ['Light absorbs it', 'La lumière l’absorbe'],
      ['The temperature is always zero', 'La température y est toujours nulle'],
    ],
    hint: [
      'Sound is a mechanical wave and needs a material medium.',
      'Le son est une onde mécanique qui nécessite un milieu matériel.',
    ],
  },
  {
    id: 'physics-medium-kinetic',
    topic: 'physics',
    difficulty: 'medium',
    prompt: [
      'Which formula gives translational kinetic energy?',
      'Quelle formule donne l’énergie cinétique de translation ?',
    ],
    answer: ['E = ½mv²', 'E = ½mv²'],
    decoys: [
      ['E = mgh', 'E = mgh'],
      ['E = mc²', 'E = mc²'],
      ['E = Fd²', 'E = Fd²'],
    ],
    hint: [
      'Kinetic energy grows with the square of speed.',
      'L’énergie cinétique augmente avec le carré de la vitesse.',
    ],
  },
  {
    id: 'space-medium-jupiter',
    topic: 'space',
    difficulty: 'medium',
    prompt: [
      'Which is the largest planet in the Solar System?',
      'Quelle est la plus grande planète du Système solaire ?',
    ],
    answer: ['Jupiter', 'Jupiter'],
    decoys: [
      ['Saturn', 'Saturne'],
      ['Neptune', 'Neptune'],
      ['Earth', 'La Terre'],
    ],
    hint: [
      'Jupiter is more massive than all the other planets combined.',
      'Jupiter est plus massive que toutes les autres planètes réunies.',
    ],
  },
  {
    id: 'space-medium-galaxy',
    topic: 'space',
    difficulty: 'medium',
    prompt: [
      'Which galaxy contains our Solar System?',
      'Quelle galaxie contient notre Système solaire ?',
    ],
    answer: ['The Milky Way', 'La Voie lactée'],
    decoys: [
      ['Andromeda', 'Andromède'],
      ['The Whirlpool Galaxy', 'La galaxie du Tourbillon'],
      ['The Sombrero Galaxy', 'La galaxie du Sombrero'],
    ],
    hint: [
      'The Solar System lies in the Orion Arm of the Milky Way.',
      'Le Système solaire se situe dans le bras d’Orion de la Voie lactée.',
    ],
  },
  {
    id: 'space-medium-lightyear',
    topic: 'space',
    difficulty: 'medium',
    prompt: ['What does a light-year measure?', 'Que mesure une année-lumière ?'],
    answer: ['Distance', 'Une distance'],
    decoys: [
      ['Time', 'Une durée'],
      ['Brightness', 'Une luminosité'],
      ['Mass', 'Une masse'],
    ],
    hint: [
      'It is the distance light travels in one year.',
      'C’est la distance parcourue par la lumière en une année.',
    ],
  },
  {
    id: 'earth-medium-ozone',
    topic: 'earth',
    difficulty: 'medium',
    prompt: [
      'Which atmospheric layer contains most of the ozone layer?',
      'Quelle couche atmosphérique contient l’essentiel de la couche d’ozone ?',
    ],
    answer: ['The stratosphere', 'La stratosphère'],
    decoys: [
      ['The troposphere', 'La troposphère'],
      ['The mesosphere', 'La mésosphère'],
      ['The thermosphere', 'La thermosphère'],
    ],
    hint: [
      'Stratospheric ozone absorbs much of the Sun’s ultraviolet radiation.',
      'L’ozone stratosphérique absorbe une grande partie des ultraviolets solaires.',
    ],
  },
  {
    id: 'earth-medium-subduction',
    topic: 'earth',
    difficulty: 'medium',
    prompt: [
      'At which plate boundary does subduction occur?',
      'À quelle limite de plaques se produit la subduction ?',
    ],
    answer: ['A convergent boundary', 'Une limite convergente'],
    decoys: [
      ['A divergent boundary', 'Une limite divergente'],
      ['A transform boundary', 'Une limite transformante'],
      ['A passive margin', 'Une marge passive'],
    ],
    hint: [
      'At convergence, one plate can sink beneath another into the mantle.',
      'À une limite convergente, une plaque peut plonger sous une autre dans le manteau.',
    ],
  },
  {
    id: 'earth-medium-seismograph',
    topic: 'earth',
    difficulty: 'medium',
    prompt: [
      'Which instrument records ground motion during an earthquake?',
      'Quel instrument enregistre les mouvements du sol pendant un séisme ?',
    ],
    answer: ['A seismograph', 'Un sismographe'],
    decoys: [
      ['A barometer', 'Un baromètre'],
      ['An anemometer', 'Un anémomètre'],
      ['A hygrometer', 'Un hygromètre'],
    ],
    hint: [
      'A seismograph records seismic waves as a seismogram.',
      'Un sismographe enregistre les ondes sismiques sous forme de sismogramme.',
    ],
  },
  {
    id: 'biology-hard-helicase',
    topic: 'biology',
    difficulty: 'hard',
    prompt: [
      'Which enzyme unwinds the DNA double helix during replication?',
      'Quelle enzyme déroule la double hélice d’ADN pendant la réplication ?',
    ],
    answer: ['Helicase', 'L’hélicase'],
    decoys: [
      ['Ligase', 'La ligase'],
      ['Amylase', 'L’amylase'],
      ['Peptidase', 'La peptidase'],
    ],
    hint: [
      'Helicase separates the two DNA strands at the replication fork.',
      'L’hélicase sépare les deux brins d’ADN au niveau de la fourche de réplication.',
    ],
  },
  {
    id: 'biology-hard-nephron',
    topic: 'biology',
    difficulty: 'hard',
    prompt: [
      'What is the functional unit of the kidney?',
      'Quelle est l’unité fonctionnelle du rein ?',
    ],
    answer: ['The nephron', 'Le néphron'],
    decoys: [
      ['The alveolus', 'L’alvéole'],
      ['The axon', 'L’axone'],
      ['The villus', 'La villosité'],
    ],
    hint: [
      'Each nephron filters blood and adjusts water and solute levels.',
      'Chaque néphron filtre le sang et ajuste les niveaux d’eau et de solutés.',
    ],
  },
  {
    id: 'biology-hard-antibodies',
    topic: 'biology',
    difficulty: 'hard',
    prompt: [
      'Which cells secrete large quantities of antibodies?',
      'Quelles cellules sécrètent de grandes quantités d’anticorps ?',
    ],
    answer: ['Plasma cells', 'Les plasmocytes'],
    decoys: [
      ['Red blood cells', 'Les globules rouges'],
      ['Platelets', 'Les plaquettes'],
      ['Osteoclasts', 'Les ostéoclastes'],
    ],
    hint: [
      'Activated B lymphocytes differentiate into antibody-secreting plasma cells.',
      'Les lymphocytes B activés se différencient en plasmocytes sécréteurs d’anticorps.',
    ],
  },
  {
    id: 'chemistry-hard-avogadro',
    topic: 'chemistry',
    difficulty: 'hard',
    prompt: [
      'Approximately how many entities are in one mole?',
      'Combien d’entités contient approximativement une mole ?',
    ],
    answer: ['6.022 × 10²³', '6,022 × 10²³'],
    decoys: [
      ['9.81 × 10²', '9,81 × 10²'],
      ['3.00 × 10⁸', '3,00 × 10⁸'],
      ['1.602 × 10⁻¹⁹', '1,602 × 10⁻¹⁹'],
    ],
    hint: ['This value is the Avogadro constant.', 'Cette valeur est la constante d’Avogadro.'],
  },
  {
    id: 'chemistry-hard-methane',
    topic: 'chemistry',
    difficulty: 'hard',
    prompt: [
      'What is the hybridisation of carbon in methane, CH₄?',
      'Quelle est l’hybridation du carbone dans le méthane CH₄ ?',
    ],
    answer: ['sp³', 'sp³'],
    decoys: [
      ['sp', 'sp'],
      ['sp²', 'sp²'],
      ['dsp²', 'dsp²'],
    ],
    hint: [
      'Four equivalent bonds form a tetrahedral sp³ geometry.',
      'Quatre liaisons équivalentes forment une géométrie tétraédrique sp³.',
    ],
  },
  {
    id: 'chemistry-hard-catalyst',
    topic: 'chemistry',
    difficulty: 'hard',
    prompt: [
      'How does a catalyst speed up a reaction?',
      'Comment un catalyseur accélère-t-il une réaction ?',
    ],
    answer: ['It lowers the activation energy', 'Il abaisse l’énergie d’activation'],
    decoys: [
      ['It raises the final energy', 'Il augmente l’énergie finale'],
      ['It changes the equilibrium constant', 'Il modifie la constante d’équilibre'],
      ['It increases every molecule’s mass', 'Il augmente la masse de chaque molécule'],
    ],
    hint: [
      'A catalyst provides an alternative reaction pathway and is regenerated.',
      'Un catalyseur fournit un chemin réactionnel alternatif et se régénère.',
    ],
  },
  {
    id: 'physics-hard-photon',
    topic: 'physics',
    difficulty: 'hard',
    prompt: [
      'Which particle mediates the electromagnetic interaction?',
      'Quelle particule transmet l’interaction électromagnétique ?',
    ],
    answer: ['The photon', 'Le photon'],
    decoys: [
      ['The gluon', 'Le gluon'],
      ['The graviton', 'Le graviton'],
      ['The Higgs boson', 'Le boson de Higgs'],
    ],
    hint: [
      'In quantum electrodynamics, photons are the force carriers.',
      'En électrodynamique quantique, les photons sont les vecteurs de cette force.',
    ],
  },
  {
    id: 'physics-hard-uncertainty',
    topic: 'physics',
    difficulty: 'hard',
    prompt: [
      'Which pair is linked by Heisenberg’s uncertainty principle?',
      'Quelle paire est liée par le principe d’incertitude de Heisenberg ?',
    ],
    answer: ['Position and momentum', 'La position et la quantité de mouvement'],
    decoys: [
      ['Mass and charge', 'La masse et la charge'],
      ['Speed and acceleration', 'La vitesse et l’accélération'],
      ['Pressure and volume', 'La pression et le volume'],
    ],
    hint: ['Their uncertainties obey ΔxΔp ≥ ℏ/2.', 'Leurs incertitudes vérifient ΔxΔp ≥ ℏ/2.'],
  },
  {
    id: 'physics-hard-entropy',
    topic: 'physics',
    difficulty: 'hard',
    prompt: [
      'What happens to entropy in an isolated system?',
      'Comment évolue l’entropie dans un système isolé ?',
    ],
    answer: ['It cannot decrease', 'Elle ne peut pas diminuer'],
    decoys: [
      ['It must become zero', 'Elle doit devenir nulle'],
      ['It always oscillates', 'Elle oscille toujours'],
      ['It equals the temperature', 'Elle est égale à la température'],
    ],
    hint: [
      'This is a statistical statement of the second law of thermodynamics.',
      'C’est une formulation statistique du deuxième principe de la thermodynamique.',
    ],
  },
  {
    id: 'space-hard-chandrasekhar',
    topic: 'space',
    difficulty: 'hard',
    prompt: [
      'The Chandrasekhar limit is about how many solar masses?',
      'La limite de Chandrasekhar vaut environ combien de masses solaires ?',
    ],
    answer: ['1.4', '1,4'],
    decoys: [
      ['0.08', '0,08'],
      ['10', '10'],
      ['100', '100'],
    ],
    hint: [
      'Above about 1.4 solar masses, electron degeneracy cannot support a white dwarf.',
      'Au-delà d’environ 1,4 masse solaire, la dégénérescence électronique ne soutient plus une naine blanche.',
    ],
  },
  {
    id: 'space-hard-cmb',
    topic: 'space',
    difficulty: 'hard',
    prompt: [
      'What is the approximate temperature of the cosmic microwave background?',
      'Quelle est la température approximative du fond diffus cosmologique ?',
    ],
    answer: ['2.7 K', '2,7 K'],
    decoys: [
      ['0 K', '0 K'],
      ['27 K', '27 K'],
      ['273 K', '273 K'],
    ],
    hint: [
      'Expansion has cooled this relic radiation to about 2.725 kelvins.',
      'L’expansion a refroidi ce rayonnement fossile à environ 2,725 kelvins.',
    ],
  },
  {
    id: 'space-hard-horizon',
    topic: 'space',
    difficulty: 'hard',
    prompt: [
      'What defines a black hole’s event horizon?',
      'Qu’est-ce qui définit l’horizon des événements d’un trou noir ?',
    ],
    answer: [
      'The boundary beyond which nothing can escape',
      'La frontière au-delà de laquelle rien ne peut s’échapper',
    ],
    decoys: [
      ['The solid surface of the star', 'La surface solide de l’étoile'],
      ['The orbit of its nearest planet', 'L’orbite de sa planète la plus proche'],
      ['The place where gravity becomes zero', 'L’endroit où la gravité devient nulle'],
    ],
    hint: [
      'Inside this causal boundary, even outward-directed light cannot escape.',
      'À l’intérieur de cette frontière causale, même la lumière dirigée vers l’extérieur ne peut s’échapper.',
    ],
  },
  {
    id: 'earth-hard-moho',
    topic: 'earth',
    difficulty: 'hard',
    prompt: [
      'What does the Mohorovičić discontinuity separate?',
      'Que sépare la discontinuité de Mohorovičić ?',
    ],
    answer: ['The crust and the mantle', 'La croûte et le manteau'],
    decoys: [
      ['The mantle and the outer core', 'Le manteau et le noyau externe'],
      ['The outer and inner core', 'Le noyau externe et le noyau interne'],
      ['The troposphere and stratosphere', 'La troposphère et la stratosphère'],
    ],
    hint: [
      'Seismic waves abruptly speed up across the Moho.',
      'Les ondes sismiques accélèrent brusquement en franchissant le Moho.',
    ],
  },
  {
    id: 'earth-hard-coriolis',
    topic: 'earth',
    difficulty: 'hard',
    prompt: [
      'What causes the Coriolis effect on Earth?',
      'Quelle est la cause de l’effet de Coriolis sur Terre ?',
    ],
    answer: ['Earth’s rotation', 'La rotation de la Terre'],
    decoys: [
      ['The Moon’s phases', 'Les phases de la Lune'],
      ['Solar radiation alone', 'Le seul rayonnement solaire'],
      ['The magnetic poles', 'Les pôles magnétiques'],
    ],
    hint: [
      'Motion is deflected when observed in Earth’s rotating reference frame.',
      'Un mouvement paraît dévié lorsqu’il est observé dans le référentiel terrestre en rotation.',
    ],
  },
  {
    id: 'earth-hard-paleomagnetism',
    topic: 'earth',
    difficulty: 'hard',
    prompt: [
      'Magnetic stripes on the ocean floor are evidence for what?',
      'Les bandes magnétiques du plancher océanique prouvent quel phénomène ?',
    ],
    answer: ['Seafloor spreading', 'L’expansion des fonds océaniques'],
    decoys: [
      ['Tidal erosion', 'L’érosion par les marées'],
      ['Meteorite impacts', 'Les impacts de météorites'],
      ['Atmospheric circulation', 'La circulation atmosphérique'],
    ],
    hint: [
      'Symmetrical polarity bands record new crust forming at mid-ocean ridges.',
      'Des bandes de polarité symétriques enregistrent la formation de croûte aux dorsales.',
    ],
  },
];

export function makeSciencequizQuestion(
  difficulty: Difficulty,
  locale: ScienceLocale,
  topic: ScienceTopicFilter = 'all',
  random: () => number = Math.random,
  excludeId: string | null = null
): ScienceQuestion {
  const matching = SCIENCE_QUESTIONS.filter(
    (item) => item.difficulty === difficulty && (topic === 'all' || item.topic === topic)
  );
  const withoutPrevious = matching.filter((item) => item.id !== excludeId);
  const pool = withoutPrevious.length > 0 ? withoutPrevious : matching;
  const item = pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length))];
  if (!item) throw new Error('No science quiz question matches the selected filters');

  const languageIndex = locale === 'fr' ? 1 : 0;
  const answer = item.answer[languageIndex];
  return {
    id: item.id,
    topic: item.topic,
    prompt: item.prompt[languageIndex],
    answer,
    choices: buildChoices(
      answer,
      item.decoys.map((decoy) => decoy[languageIndex]),
      difficulty === 'easy' ? 3 : 4,
      random
    ),
    hint: item.hint[languageIndex],
  };
}
