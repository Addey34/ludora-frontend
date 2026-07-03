// One-off generator for the Motus/Wordle word lists.
// Normalises a loose list of words -> clean 5-letter, accent-free, A-Z, unique,
// sorted -> public/motus-<lang>.txt. Run: node scripts/gen-motus-words.mjs
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const clean = (words) => {
  const set = new Set();
  for (const w of words) {
    const up = w.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    if (/^[A-Z]{5}$/.test(up)) set.add(up);
  }
  return [...set].sort();
};

const en = `
about above abuse actor acute admit adopt adult after again agent agree ahead
alarm album alert alike alive allow alone along alter among angel anger angle
angry apart apple apply arena argue arise armor array aside asset audio audit
avoid awake award aware badly baker bases basic beach began begin begun being
below bench birth black blade blame blank blast blaze bleak blend bless blind
block blood bloom board boast bonus boost booth bound brain brake brand brass
brave bread break breed brick bride brief bring broad broke brown brush build
built bunch burst buyer cabin cable candy cargo carry catch cause chain chair
chalk champ chaos charm chart chase cheap check chess chest chief child chill
china choir chose civic civil claim clash class clean clear clerk click cliff
climb cling clock close cloth cloud clown clued coach coast could count court
cover crack craft crash crazy cream crest crime crisp cross crowd crown crude
cruel crush curve cycle daily dairy dance dated dealt death debit debut delay
delta dense depth dirty dodge doing donor doubt dozen draft drain drama drank
drawn dread dream dress dried drift drill drink drive drone drove drown drunk
eager eagle early earth easel eaten eight elbow elder elect elite empty enemy
enjoy enter entry equal error essay event every exact exams exile exist extra
fable faced faint fairy faith false fancy fatal fault favor feast fence ferry
fetch fever fewer field fifth fifty fight final first fixed flame flash fleet
flesh float flock flood floor flour fluid flush focus force forge forth forty
forum found frame frank fraud fresh fried front frost fruit fully funny genre
ghost giant given giver glass gleam globe gloom glory glove going grace grade
grain grand grant grape graph grass grave great greed green greet grief grill
grind groan groom gross group grove grown guard guess guest guide guilt habit
hairy handy happy harsh haste hatch haunt heart heavy hedge hello hence hobby
honey honor horse hotel house hover human humor hurry ideal image imply index
inner input irony issue ivory jeans joint joker judge juice jumbo knife knock
known label labor large laser later laugh layer learn lease least leave legal
lemon level lever light limit linen liver lobby local lodge logic loose lorry
loser lover lower loyal lucky lunar lunch lyric magic major maker maple march
marsh match maybe mayor meant medal media melon mercy merit merry metal meter
metro might minor mixed model money month moral motor mound mount mouse mouth
movie music naval nerve never newly night noble noise north novel nurse ocean
offer often olive onion opera optic order organ other ounce outer owner ozone
paint panel panic paper party paste patch pause peace peach pearl phase phone
photo piano piece pilot pinch pitch pixel pizza place plain plane plant plate
plaza pluck plumb poem poet point polar porch pound power press price pride
prime print prior prize probe proof proud prove pulse punch pupil puppy purse
queen query quest queue quick quiet quilt quite quota quote radar radio raise
rally ranch range rapid ratio reach react ready realm rebel refer relax reply
rider ridge rifle right rigid rinse risky rival river roast robin robot rocky
rogue roman rough round route royal rugby ruler rumor rural sadly saint salad
sauce scale scarf scene scent scope score scout scrap screw scrub sedan seize
sense serve seven shade shaft shake shall shame shape share shark sharp sheep
sheet shelf shell shine shiny shirt shock shoot shore short shout shown shrub
sight silks silly since siren sixth sixty sized skill skirt skull slate sleep
sleet slice slide slime slope small smart smash smell smile smoke snack snail
snake sneak snowy solar solid solve sorry sound south space spare spark speak
spear speed spell spend spent spice spike spill spine split spoil spoke spoon
sport spray squad staff stage stain stair stake stale stamp stand stare start
state steak steal steam steel steep steer stern stick stiff still sting stock
stone stood stool store storm story stove strap straw strip stuck study stuff
stump style sugar suite sunny super surge sweat sweep sweet swept swift swing
sword table taken tally tango taste teach teeth tempo tenth terms theft their
theme there these thick thief thigh thing think third those three threw throw
thumb tiger tight timer tired title toast today token tooth topic torch total
touch tough tower toxic trace track trade trail train tramp trash tread treat
trend trial tribe trick tried tulip tumor tutor tweet twice twist ultra uncle
under union unite unity until upper upset urban usage usher usual vague valid
value valve vapor vault venue verse video views villa vinyl viola virus visit
vital vivid vocal vodka voice voter vowel wagon waist waste watch water weary
weave wedge weird whale wheat wheel where which while whine white whole whose
widen widow width witch woman world worry worse worth would wound wrist write
wrong yacht yield young yours youth zebra zesty
`.split(/\s+/);

const fr = `
abord absent achat acide acier actif actes admis adore agent agile aider aigle
aigre ailes aimer ainsi aisse album amande amour ample ancre angle animal appel
arbre arene argent armee arome arret aspic assez atout aucun audio aussi autre
avant avion avoir avril bague balai balle banane banc bande barbe barre bassin
bateau baton belle berge betes beton biche biere bijou blanc blaze bleus bloc
boire boite bonus bord botte bouche boucle boueux bougie boule bourg brave
brebis breve brise bronze brosse brume brute buche buffle bulle butte cable
cacao cadre cafe cage calme camel canal canard carre carte case cause cedre
celui cendre cercle chaud chaise champ chant chats chef chien choix chose chute
ciel cinq cinema cible cidre citron civil clair clan classe clef climat cloche
clone cloue coeur coin cointe colle color combat comte conte corde corne corps
cote couche coude coule coup cour court crabe crane craie crayon creme crepe
creux cri crise croix cruel cube cuir cuire culte curer cycle dame danse date
debut decor delai delta demain dense dents depot desir dessin detail deux devis
digne dinde diner dire divan divin doigt donne dorer dortoir dose doute douze
drame drap droit drole duree eaux ebene ecart echec ecole ecran ecrit effet
egale eglise elans elire elite eloge email emploi encre enfant engin ennui
entre envie epais epine epoux equipe erreur essai etage etain etang etats ete
ethnie etoile etude euros evier exact excel exil face facon fada fagot faim
faire falaise farce farde fatal faune faute faux femme fente ferme feuille
fevre fiche fier fille film final fini flair flanc fleau fleche fleur flore
flot fluide foie foire folie fonce fond force foret forme fort forum foule
four foyer frais franc frein frere frise froid front fruit fugue fumee gagne
galet garde gare garis gauche gaz gele geler genou genre geste gilet givre
glace globe gloire golfe gomme gorge gout grace grain grand gras grave grele
grief griffe gris gros grue guepe guide habit hache haies haine halle halte
hardi harpe haute havre herbe heure hibou honte hotel houle huile humide
humour hyene idees idole igloo image imite index infos ivoire ivres jadis
jambe jardin jaune jeans jeter jeton jeune jeux joie joint joker joue jouet
jouir jules jupes jury juste kayak label laine laisse laits lampe lance lapin
large larme laver leger lente levre liane liens lieux ligne lilas lime linge
lions lisse liste livre local loger logis loire long lotus louer loupe lourd
loyer lueur lundi lune lutin lutte lycee madame magie main maire malle manche
mange manie marche mardi marge marin masse match matin mauve medal medias
melon menu mercredi merci mere merle metal metro meuble miel mieux mille mince
mine minute miroir mixte mode moine moins moisi monde moral morse mort motos
mouche moule mousse moyen muet mule mur mure murs muscle musee myrtille nage
naif navet neige nerf neveu niche nid noble noce noeud noir nord notre nuage
nuire nuit ocean ocre odeur oeuf oeuvre oignon oiseau olive ombre once oncle
ongle opale opera orage orange ordre oreille orge orne ortie ourse ouvert
ovale page paille pain paire palme panda panne papa papier paquet parc pardon
paris parle part passe pate patin patte pause pauvre pave payer pays peau
peche pedale peine peintre pelle pendre pente perdre perle perte peser petale
petit peur phare photo piano piece pierre pieton pigeon pilote pince pinte
pion piste pitie place plage plaie plait plan plat plein pleur pli plomb plume
poche poele poeme poete poids poil point poire poirier poison poivre pomme
pompe pont porc porte poser poste pouce poule poulet poumon poupee pouvoir
prise prix proie propre prose puce puits pull pur purge pyjama quai quart
quete queue quiche quille quinze radar radio rage raide rails raisin ramer
rampe rang raser rasoir rater rayon rebord recif reflet regal regle reine
relais remede rendre rene renne renard repas repli repos requin reste retard
retour reve revue riche rideau rire rive riz robe roche roi role roman rond
rose rouge roule route royal ruban rude rue ruee ruse rythme sabot sable sabre
sac sacre safran sage saint saison salade salle salon sang sante sapin sardine
sauce saut savon scene sceau seau sec seche selle selon semer senat sens seuil
seul sieste signe silence singe sirene site sofa soie soif soin soir sol soleil
solde somme son songe sonner sorte sortir sotte souci souffle soupe sourd
souris sous soute soyeux stade stage store style sucre sud sueur suite suivre
sujet super sur sursis table tache tacle taie taille talon tante tapis tard
tarte tasse taupe taxe temps tendre tenir tennis tente terme terre tete texte
theatre these tigre tirer tiroir tissu titre toile toit tomate tombe tome ton
tonne tordu total touche tour tousser tout trace tract train traire trait
trame tramway trace trente tresor triangle tribu trier trois trompe tronc
trop trotte troue trouve truite tuile tulipe tunnel type ultra unite urne
usage usine usure utile vache vague vaincre valet valse valve vapeur varier
vase vaste veau veille velo vendre venin vent verbe verre vers verser veste
vetir viande vide vider vigne ville vin vinaigre violet violon vipere virage
vis visage vitre vitesse vivre voeu voile voir voisin voiture voix vol volet
voler volume vomir vote votre vouloir voute voyage vrac vrai wagon zebre zele
zeste zinc zone zoom
`.split(/\s+/);

writeFileSync(resolve(root, 'public/motus-en.txt'), clean(en).join('\n') + '\n');
writeFileSync(resolve(root, 'public/motus-fr.txt'), clean(fr).join('\n') + '\n');
console.log('EN words:', clean(en).length, '| FR words:', clean(fr).length);
