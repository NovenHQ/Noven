import express from "express";
import cors from "cors";

const app = express();

const PORT = 3001;
const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_MODEL = "qwen3:1.7b";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Noven evidence-gate-v2.4.1 examiner is running");
});


/* ---------------------------------
   General Helpers
---------------------------------- */

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundNumber(value, decimals = 3) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function extractEvidenceSegments(studentAnswer) {
  const sentences =
    String(studentAnswer ?? "").match(/[^.!?]+[.!?]?/g) ?? [];

  const cleaned = sentences
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (cleaned.length > 0) {
    return cleaned;
  }

  const fallback = cleanText(studentAnswer);
  return fallback ? [fallback] : [];
}

function isNonAnswer(studentAnswer) {
  const normalized = cleanText(studentAnswer)
    .toLowerCase()
    .replace(/[.!?,;:]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /^i do not know$/,
    /^i don't know$/,
    /^i do not know the answer$/,
    /^i don't know the answer$/,
    /^i do not know the answer to this question$/,
    /^i don't know the answer to this question$/,
    /^i have no idea$/,
    /^no idea$/,
    /^idk$/,
    /^not sure$/,
    /^i am not sure$/,
    /^i'm not sure$/,
    /^unknown$/,
    /^n\/a$/,
    /^na$/
  ];

  return patterns.some(pattern => pattern.test(normalized));
}


/* ---------------------------------
   Mark-Scheme Parsing
---------------------------------- */

function extractNumberedMarkPoints(markScheme, maxMarks) {
  const lines = String(markScheme)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const points = [];

  for (const line of lines) {
    const match = line.match(/^\(?(\d+)\)?[\.\):-]\s*(.+)$/u);

    if (!match) {
      continue;
    }

    const number = Number(match[1]);
    const point = cleanText(match[2]);

    if (
      Number.isInteger(number) &&
      point &&
      !points.some(item => item.number === number)
    ) {
      points.push({ number, point });
    }
  }

  points.sort((first, second) => first.number - second.number);
  return points.slice(0, maxMarks);
}


/* ---------------------------------
   Atomic Claim Splitting
---------------------------------- */

const predicateWords = [
  "is", "are", "was", "were", "has", "have", "had",
  "can", "could", "will", "would", "should", "may", "might", "must",
  "bind", "binds", "form", "forms", "become", "becomes",
  "expand", "expands", "move", "moves", "pass", "passes",
  "enter", "enters", "leave", "leaves", "provide", "provides",
  "create", "creates", "maintain", "maintains", "give", "gives",
  "allow", "allows", "cause", "causes", "contain", "contains",
  "release", "releases", "increase", "increases", "decrease", "decreases",
  "diffuse", "diffuses", "dissolve", "dissolves", "supply", "supplies",
  "remain", "remains", "speed", "speeds", "join", "joins",
  "determine", "determines", "activate", "activates", "oppose", "opposes",
  "return", "returns", "detect", "detects", "produce", "produces",
  "convert", "converts", "take", "takes", "open", "opens", "close", "closes",
  "prevent", "prevents", "stimulate", "stimulates", "survive", "survives",
  "reproduce", "reproduces", "kill", "kills", "use", "uses",
  "arrive", "arrives", "fuse", "fuses", "attach", "attaches",
  "depolarise", "depolarises", "depolarize", "depolarizes",
  "insert", "inserts", "curve", "curves", "occur", "occurs",
  "count", "counts", "repeat", "repeats", "calculate", "calculates",
  "estimate", "estimates", "consist", "consists"
];

const predicatePattern = predicateWords.join("|");

function containsPredicate(value) {
  return new RegExp(`\\b(?:${predicatePattern})\\b`, "i").test(value);
}

function startsWithPredicate(value) {
  return new RegExp(`^(?:to\\s+)?(?:${predicatePattern})\\b`, "i")
    .test(value.trim());
}

function hasIndependentClause(value) {
  return new RegExp(
    `^(?:the|a|an|this|that|these|those|it|they|water|cells?|` +
      `enzymes?|substrates?|products?|vacuoles?|walls?|blood|ventilation|` +
      `amino acids?|effectors?|variables?|bacteria|lymphocytes?|` +
      `neurotransmitters?|guard cells?|stomatal pore|plasmids?)\\b.*` +
      `\\b(?:${predicatePattern})\\b`,
    "i"
  ).test(value.trim());
}

function shouldSplitConjunction(left, right) {
  if (!containsPredicate(left)) {
    return false;
  }

  /*
    Split only when the text after "and" introduces its own subject.

    Keep coordinated predicates together:

      "open and close"
      "bind and form a complex"
      "strengthens the wall and prevents collapse"

    The evidence gate can then require both actions without creating
    dangling claims such as "close" or "have a hollow lumen".
  */

  return hasIndependentClause(right);
}

function splitAtomicClaims(criterion, depth = 0) {
  const text = cleanText(criterion)
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/, "")
    .trim();

  if (!text || depth > 5) {
    return text ? [text] : [];
  }

  const conjunctionExpression = /\s+and\s+/gi;
  let match;

  while ((match = conjunctionExpression.exec(text)) !== null) {
    const left = text.slice(0, match.index).trim();
    const right = text.slice(match.index + match[0].length).trim();

    if (!left || !right || !shouldSplitConjunction(left, right)) {
      continue;
    }

    return [
      ...splitAtomicClaims(left, depth + 1),
      ...splitAtomicClaims(right, depth + 1)
    ];
  }

  return [text];
}

function stripExplanatoryTail(criterion) {
  const text = cleanText(criterion)
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /\s*,\s*(?:giving|providing|allowing|causing|leading to|resulting in)\b/i,
    /\s+so(?:\s+that)?\s+/i,
    /\s+(?:thereby|therefore)\s+/i
  ];

  let cutIndex = text.length;

  for (const pattern of patterns) {
    const match = pattern.exec(text);

    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }

  return text
    .slice(0, cutIndex)
    .replace(/[,:;\s]+$/, "")
    .trim();
}


/* ---------------------------------
   Generic Concept Normalisation
---------------------------------- */

const phraseRules = [
  [/\bincreasing temperature\b/gi, " high temperature "],
  [/\b(?:become|becomes|became) larger\b/gi, " expand "],
  [/\b(?:become|becomes|became) crenated\b/gi, " shrink "],
  [/\b(?:many|numerous) capillaries(?: supplying blood)?\b/gi, " rich_blood_supply "],
  [/\bfrom (?:an? )?(?:low|lower) concentration to (?:an? )?(?:high|higher) concentration\b/gi, " move against concentration_gradient "],
  [/\b(?:can )?limit(?:s|ed|ing)? (?:the )?rate\b/gi, " limit_rate "],
  [/\b(?:is|are|may be|can be) limited by\b/gi, " limit_rate "],
  [/\b(?:restrict(?:s|ed|ing)?|reduce(?:s|d|ing)?|decrease(?:s|d|ing)?|slow(?:s|ed|ing)?) (?:the )?rate\b/gi, " limit rate "],
  [/\bone cell division\b/gi, " mitosis one_cell_division "],
  [/\bcut(?:s|ting)? out\b/gi, " cut "],
  [/\bthe mean(?: count)? is used to estimate\b/gi, " mean calculate estimate "],
  [/because of|due to/gi, " cause "],
  [/consist(?:s|ed|ing)? of/gi, " form "],
  [/enzyme[\s-]*substrate complex/gi, " enzyme_substrate_complex "],
  [/active sites?/gi, " active_site "],
  [/water potential/gi, " water_potential "],
  [/concentration gradient/gi, " concentration_gradient "],
  [/(?:partially|selectively) permeable (?:cell )?membrane/gi, " permeable_membrane "],
  [/bowman['’]?s capsule/gi, " bowman_capsule "],
  [/blood cells?/gi, " blood_cell "],
  [/body cells?/gi, " body_cell "],
  [/beta cells?/gi, " beta_cell "],
  [/memory cells?/gi, " memory_cell "],
  [/guard cells?/gi, " guard_cell "],
  [/daughter cells?/gi, " daughter_cell "],
  [/resistant bacteria/gi, " resistant_bacteria "],
  [/susceptible bacteria/gi, " susceptible_bacteria "],
  [/atrioventricular valves?/gi, " atrioventricular_valve "],
  [/semilunar valves?/gi, " semilunar_valve "],
  [/tendinous cords?/gi, " tendinous_cord "],
  [/blood glucose(?: concentration)?/gi, " blood_glucose "],
  [/messenger rna|mRNA/gi, " mrna "],
  [/transfer rna|tRNA/gi, " trna "],
  [/peptide bonds?/gi, " peptide_bond "],
  [/restriction enzymes?/gi, " restriction_enzyme "],
  [/dna ligase/gi, " dna_ligase "],
  [/sticky ends?/gi, " sticky_end "],
  [/action potentials?/gi, " action_potential "],
  [/calcium ions?/gi, " calcium_ion "],
  [/presynaptic membranes?/gi, " presynaptic_membrane "],
  [/postsynaptic membranes?/gi, " postsynaptic_membrane "],
  [/synaptic cleft/gi, " synaptic_cleft "],
  [/trophic levels?/gi, " trophic_level "],
  [/xylem vessels?/gi, " xylem_vessel "],
  [/hollow lumen/gi, " hollow_lumen "],
  [/end walls?/gi, " end_wall "],
  [/large surface area/gi, " large_surface_area "],
  [/rich blood supply/gi, " rich_blood_supply "],
  [/(?:many|numerous|dense|extensive) blood capillaries/gi, " rich_blood_supply "],
  [/blood capillary network/gi, " rich_blood_supply "],
  [/one cell thick/gi, " one_cell_thick "],
  [/oxygen debt/gi, " oxygen_debt "],
  [/crossing over/gi, " crossing_over "],
  [/genetic recombination/gi, " crossing_over "],
  [/set point/gi, " set_point "],
  [/normal level/gi, " normal_level "],
  [/secondary immune response/gi, " secondary_immune_response "],
  [/later exposure/gi, " later_exposure "],
  [/sideways movement/gi, " sideways_movement "],
  [/\bnet movement\b/gi, " net_movement "],
  [/stomatal pore/gi, " stomatal_pore "],
  [/parts? of an organism/gi, " biomass "],
  [/full chromosome number/gi, " diploid "],
  [/two sets? of chromosomes/gi, " diploid "],
  [/evenly distributed/gi, " equilibrium "],
  [/selectively permeable/gi, " permeable "],
  [/partially permeable/gi, " permeable "]
];

const wordCanonicalMap = new Map(Object.entries({
  copied: "replicate",
  copy: "replicate",
  copies: "replicate",
  replicated: "replicate",
  replicates: "replicate",
  replication: "replicate",

  expanded: "expand",
  expands: "expand",
  expanding: "expand",
  enlarged: "expand",
  enlarges: "expand",
  enlarging: "expand",

  controlled: "control",
  controls: "control",
  controlling: "control",

  limited: "limit",
  limits: "limit",
  limiting: "limit",
  restrict: "limit",
  restricts: "limit",
  restricted: "limit",
  restricting: "limit",
  limitation: "limit",
  limitations: "limit",

  transcribed: "transcribe",
  transcribes: "transcribe",
  transcribing: "transcribe",
  transcription: "transcribe",

  denatured: "denature",
  denatures: "denature",
  denaturing: "denature",

  created: "create",
  creates: "create",
  creating: "create",

  makes: "produce",
  make: "produce",
  made: "produce",
  resistant: "resistance",

  contains: "have",
  contain: "have",
  contained: "have",
  has: "have",
  had: "have",

  becomes: "become",
  became: "become",
  becoming: "become",

  causes: "cause",
  caused: "cause",
  causing: "cause",
  forces: "force",
  forced: "force",
  forcing: "force",
  provides: "provide",
  provided: "provide",
  providing: "provide",
  allows: "allow",
  allowed: "allow",
  allowing: "allow",
  evaporates: "evaporate",
  evaporated: "evaporate",
  evaporating: "evaporate",
  drawn: "draw",
  draws: "draw",
  drawing: "draw",
  strengthens: "strengthen",
  strengthened: "strengthen",
  strengthening: "strengthen",
  stops: "prevent",
  stopped: "prevent",
  stopping: "prevent",
  collapsed: "collapse",
  collapses: "collapse",
  collapsing: "collapse",
  eaten: "eat",
  eats: "eat",
  eating: "eat",
  faster: "fast",
  through: "pass",

  produced: "produce",
  producing: "produce",
  produces: "produce",
  formed: "form",
  forming: "form",
  forms: "form",

  entered: "enter",
  enters: "enter",
  entering: "enter",
  into: "enter",

  left: "leave",
  leaves: "leave",
  leaving: "leave",
  out: "leave",

  moved: "move",
  moves: "move",
  moving: "move",
  movement: "move",
  spread: "move",
  spreads: "move",
  spreading: "move",
  dispersed: "move",
  disperses: "move",
  dispersing: "move",

  increased: "increase",
  increases: "increase",
  increasing: "increase",
  rise: "increase",
  rises: "increase",
  rising: "increase",
  raised: "increase",
  higher: "high",
  greater: "high",

  decreased: "decrease",
  decreases: "decrease",
  decreasing: "decrease",
  lower: "low",
  reduced: "decrease",
  reduces: "decrease",
  reducing: "decrease",

  bound: "bind",
  binds: "bind",
  binding: "bind",

  joined: "join",
  joins: "join",
  joining: "join",
  linked: "join",
  links: "join",

  released: "release",
  releases: "release",
  releasing: "release",

  opened: "open",
  opens: "open",
  opening: "open",
  closed: "close",
  closes: "close",
  closing: "close",

  detected: "detect",
  detects: "detect",
  detecting: "detect",

  converted: "convert",
  converts: "convert",
  converting: "convert",

  absorbed: "absorb",
  absorbs: "absorb",
  absorbing: "absorb",
  absorption: "absorb",

  stimulated: "stimulate",
  stimulates: "stimulate",
  stimulating: "stimulate",

  survived: "survive",
  survives: "survive",
  surviving: "survive",

  reproduced: "reproduce",
  reproduces: "reproduce",
  reproducing: "reproduce",

  killed: "kill",
  kills: "kill",
  killing: "kill",

  used: "use",
  uses: "use",
  using: "use",
  required: "require",
  requires: "require",
  requiring: "require",
  needed: "require",
  needs: "require",

  attached: "attach",
  attaches: "attach",
  attaching: "attach",

  diffused: "diffuse",
  diffuses: "diffuse",
  diffusing: "diffuse",

  fused: "fuse",
  fuses: "fuse",
  fusing: "fuse",

  depolarised: "depolarise",
  depolarises: "depolarise",
  depolarized: "depolarise",
  depolarizes: "depolarise",

  inserted: "insert",
  inserts: "insert",
  inserting: "insert",

  curved: "curve",
  curves: "curve",
  curving: "curve",

  prevented: "prevent",
  prevents: "prevent",
  preventing: "prevent",

  remained: "remain",
  remains: "remain",
  staying: "remain",
  stays: "remain",

  shrivelled: "shrink",
  shriveled: "shrink",
  shrivels: "shrink",
  shrivel: "shrink",
  crenated: "shrink",
  crenates: "shrink",

  random: "randomly",
  randomised: "randomly",

  fats: "lipid",
  fat: "lipid",
  lipids: "lipid",

  antibodies: "antibody",
  antigens: "antigen",
  lymphocytes: "lymphocyte",
  receptors: "receptor",
  vesicles: "vesicle",
  capillaries: "capillary",
  alleles: "allele",
  chromosomes: "chromosome",
  molecules: "molecule",
  proteins: "protein",
  bacteria: "bacterium",
  cells: "cell",
  vessels: "vessel",
  valves: "valve",
  walls: "wall",
  particles: "particle",

  versions: "form",
  version: "form",
  alternative: "alternative",

  faeces: "egest",
  feces: "egest",
  egested: "egest",
  egestion: "egest",
  excreted: "excrete",
  excretion: "excrete",
  excretory: "excrete",

  heat: "heat",

  turgidity: "turgid",
  flaccidity: "flaccid",

  backwards: "back",
  backward: "back",
  returning: "return",

  counted: "count",
  counts: "count",
  counting: "count",

  repeated: "repeat",
  repeats: "repeat",
  repeating: "repeat",

  calculated: "calculate",
  calculates: "calculate",
  calculating: "calculate",

  estimated: "estimate",
  estimates: "estimate",
  estimating: "estimate",

  organisms: "organism",
  plants: "plant",
  animals: "animal",

  happens: "occur",
  happened: "occur",
  occurring: "occur",
  occurs: "occur"
}));

const stopWords = new Set([
  "a", "an", "the", "this", "that", "these", "those",
  "of", "in", "on", "at", "by", "for", "from", "with",
  "between", "within", "during", "after", "before", "towards", "toward",
  "to", "and", "or", "while", "whereas", "which", "who", "whose",
  "it", "its", "they", "their", "them", "there", "then", "also",
  "more", "some", "each", "every", "only", "may", "can", "could",
  "will", "would", "should", "must", "be", "been", "being",
  "is", "are", "was", "were", "do", "does", "did",
  "as", "so", "such", "than", "when", "because", "therefore",
  "toward", "across", "around", "about", "up", "down"
]);

const genericActions = new Set([
  "be", "have", "occur", "become", "provide"
]);

const structuralConcepts = new Set([
  "have",
  "use",
  "require",
  "allow",
  "become",
  "provide",
  "occur"
]);

const genericProcessSubjects = new Set([
  "sampling", "sample", "process", "method", "procedure", "operation"
]);

const weakContradictionAnchors = new Set([
  "blood", "water", "cell", "molecule", "protein", "bacterium",
  "vessel", "valve", "wall", "particle", "concentration", "temperature",
  "energy", "gene", "plasmid", "membrane", "organism"
]);

const actionConcepts = new Set([
  "replicate", "produce", "form", "enter", "leave", "move", "increase",
  "decrease", "bind", "join", "release", "open", "close", "detect",
  "convert", "absorb", "stimulate", "survive", "reproduce", "kill",
  "use", "require", "attach", "diffuse", "fuse", "depolarise", "insert",
  "curve", "prevent", "remain", "shrink", "egest", "excrete", "occur",
  "maintain", "allow", "cause", "provide", "return", "oppose", "pass",
  "take", "draw", "force", "evaporate", "lower", "strengthen", "have",
  "become", "eat", "cause", "count", "repeat", "calculate", "estimate",
  "cut", "expand", "control", "limit", "transcribe", "denature", "create"
]);

const negationWords = new Set([
  "not", "no", "never", "without"
]);

const antonymPairs = [
  ["increase", "decrease"],
  ["high", "low"],
  ["open", "close"],
  ["turgid", "flaccid"],
  ["enter", "leave"],
  ["survive", "kill"],
  ["bind", "separate"],
  ["form", "break"],
  ["remain", "leave"]
];

function applyPhraseRules(value) {
  let result = String(value ?? "")
    .toLowerCase()
    .replace(/[’]/g, "'");

  for (const [pattern, replacement] of phraseRules) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function canonicalizeToken(token) {
  const cleaned = token
    .toLowerCase()
    .replace(/^'+|'+$/g, "")
    .replace(/[^a-z0-9_'-]/g, "");

  if (!cleaned) {
    return "";
  }

  if (wordCanonicalMap.has(cleaned)) {
    return wordCanonicalMap.get(cleaned);
  }

  if (cleaned.endsWith("ies") && cleaned.length > 4) {
    return `${cleaned.slice(0, -3)}y`;
  }

  if (cleaned.endsWith("es") && cleaned.length > 4) {
    return cleaned.slice(0, -2);
  }

  if (cleaned.endsWith("s") && cleaned.length > 3 && !cleaned.endsWith("ss")) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

function normaliseConcepts(value) {
  const phraseNormalised = applyPhraseRules(value)
    .replace(/\bdoesn't\b/g, " not ")
    .replace(/\bdon't\b/g, " not ")
    .replace(/\bdidn't\b/g, " not ")
    .replace(/\bisn't\b/g, " not ")
    .replace(/\baren't\b/g, " not ")
    .replace(/\bcannot\b/g, " not ")
    .replace(/\bcan't\b/g, " not ")
    .replace(/\bdoes not\b/g, " not ")
    .replace(/\bdo not\b/g, " not ")
    .replace(/\bdid not\b/g, " not ")
    .replace(/\bis not\b/g, " not ")
    .replace(/\bare not\b/g, " not ")
    .replace(/\bno longer\b/g, " not ")
    .replace(/[^a-z0-9_'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = phraseNormalised
    .split(" ")
    .map(canonicalizeToken)
    .filter(Boolean)
    .filter(token => !stopWords.has(token));

  return tokens;
}

function conceptWeight(concept) {
  if (concept.includes("_")) {
    return 2.6;
  }

  if (negationWords.has(concept)) {
    return 1.5;
  }

  if (actionConcepts.has(concept)) {
    return genericActions.has(concept) ? 0.7 : 1.6;
  }

  if (/^\d+$/.test(concept)) {
    return 1.4;
  }

  return 1.2;
}

function uniqueConcepts(tokens) {
  return [...new Set(tokens)];
}

function extractClaimProfile(claim) {
  const rawConcepts = uniqueConcepts(normaliseConcepts(claim));

  /*
    Possession verbs such as "has" and "contains" are structural.
    The scientific content is carried by the subject and object,
    so they should not become indispensable lexical requirements.
  */

  let concepts = rawConcepts.filter(concept =>
    !structuralConcepts.has(concept) &&
    !genericProcessSubjects.has(concept)
  );

  /*
    Some phrases are contextual qualifiers rather than separate
    mark-bearing requirements. A receptor that explicitly detects
    a change satisfies the detection point even when the student
    does not repeat "from the normal level".
  */
  if (concepts.includes("detect") && concepts.includes("change")) {
    concepts = concepts.filter(concept => concept !== "normal_level");
  }

  const firstActionIndex = concepts.findIndex(concept =>
    actionConcepts.has(concept)
  );

  const rawSubjectConcepts = firstActionIndex > 0
    ? concepts.slice(0, firstActionIndex)
    : [];

  const subjectConcepts = rawSubjectConcepts.filter(concept =>
    !genericProcessSubjects.has(concept)
  );

  const actionConceptList = concepts.filter(concept =>
    actionConcepts.has(concept)
  );

  const outcomeConcepts = firstActionIndex >= 0
    ? concepts.slice(firstActionIndex + 1)
    : concepts;

  const phraseConcepts = concepts.filter(concept => concept.includes("_"));
  const polarity = rawConcepts.some(concept => negationWords.has(concept))
    ? "negative"
    : "positive";

  return {
    concepts,
    subjectConcepts,
    actionConcepts: actionConceptList,
    outcomeConcepts,
    phraseConcepts,
    polarity
  };
}

/*
  Morphological and examiner-safe semantic equivalents. These only
  relax lexical form; subject, outcome, polarity and contradiction
  checks still have to pass before a mark can be awarded.
*/
const conceptAlternatives = new Map([
  ["produce", ["produce", "form", "create"]],
  ["form", ["form", "produce", "create"]],
  ["create", ["create", "produce", "form"]],
  ["expand", ["expand", "enlarge"]],
  ["organism", ["organism", "plant", "animal"]],
  ["plant", ["plant", "organism"]],
  ["animal", ["animal", "organism"]],
  ["number", ["number", "count"]],
  ["count", ["count", "number"]],
  ["sampling", ["sampling", "sample"]],
  ["sample", ["sample", "sampling"]],
  ["move", ["move"]],
  ["net_movement", ["net_movement", "diffusion"]],
  ["limit", ["limit", "decrease", "control"]]
]);

function evidenceHasConcept(concept, evidenceSet) {
  if (evidenceSet.has(concept)) {
    return true;
  }

  const alternatives = conceptAlternatives.get(concept) ?? [];

  if (alternatives.some(alternative => evidenceSet.has(alternative))) {
    return true;
  }

  const phraseParts = concept.includes("_")
    ? concept.split("_").filter(Boolean)
    : [];

  return (
    phraseParts.length > 1 &&
    phraseParts.every(part => evidenceHasConcept(part, evidenceSet))
  );
}

function weightedCoverage(requiredConcepts, evidenceSet) {
  if (requiredConcepts.length === 0) {
    return { score: 1, matched: [], missing: [], totalWeight: 0, matchedWeight: 0 };
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];

  for (const concept of requiredConcepts) {
    const weight = conceptWeight(concept);
    totalWeight += weight;

    const conceptMatched = evidenceHasConcept(
      concept,
      evidenceSet
    );

    if (conceptMatched) {
      matchedWeight += weight;
      matched.push(concept);
    } else {
      missing.push(concept);
    }
  }

  return {
    score: totalWeight > 0 ? matchedWeight / totalWeight : 1,
    matched,
    missing,
    totalWeight,
    matchedWeight
  };
}

function buildLocalActionGate(profile, evidence) {
  const requiredActions = profile.actionConcepts.filter(concept =>
    !genericActions.has(concept)
  );

  if (requiredActions.length === 0) {
    return {
      valid: true,
      matchedActions: [],
      requiredActions: []
    };
  }

  const units = extractEvidenceSegments(evidence);

  for (const unit of units) {
    const unitSet = new Set(uniqueConcepts(normaliseConcepts(unit)));

    const allActionsPresent = requiredActions.every(action =>
      evidenceHasConcept(action, unitSet)
    );

    if (allActionsPresent) {
      return {
        valid: true,
        matchedActions: requiredActions,
        requiredActions
      };
    }
  }

  return {
    valid: false,
    matchedActions: [],
    requiredActions
  };
}

function buildEvidenceGate(claim, evidence) {
  const profile = extractClaimProfile(claim);
  const evidenceConcepts = uniqueConcepts(normaliseConcepts(evidence));
  const evidenceSet = new Set(evidenceConcepts);

  const overall = weightedCoverage(profile.concepts, evidenceSet);
  const subject = weightedCoverage(profile.subjectConcepts, evidenceSet);
  const action = weightedCoverage(profile.actionConcepts, evidenceSet);
  const outcome = weightedCoverage(profile.outcomeConcepts, evidenceSet);
  const phrase = weightedCoverage(profile.phraseConcepts, evidenceSet);
  const localActionGate = buildLocalActionGate(profile, evidence);

  const claimHasNegation = profile.polarity === "negative";
  const evidenceHasNegation = evidenceConcepts.some(concept =>
    negationWords.has(concept)
  );

  const nonGenericActions = profile.actionConcepts.filter(concept =>
    !genericActions.has(concept)
  );

  const matchedCount = overall.matched.length;
  const totalCount = profile.concepts.length;

  const overallThreshold = totalCount <= 2 ? 0.82 : 0.55;

  const subjectOkay =
    profile.subjectConcepts.length === 0 ||
    subject.score >= 0.45 ||
    overall.score >= 0.76;

  const actionOkay =
    nonGenericActions.length === 0 ||
    (
      weightedCoverage(nonGenericActions, evidenceSet).score >= 0.5 &&
      localActionGate.valid
    );

  const outcomeOkay =
    profile.outcomeConcepts.length === 0 ||
    (
      profile.outcomeConcepts.length === 1
        ? outcome.score >= 0.95 || overall.score >= 0.86
        : outcome.score >= 0.28 || overall.score >= 0.76
    );

  const phraseOkay =
    profile.phraseConcepts.length === 0 ||
    phrase.matched.length > 0 ||
    overall.score >= 0.78;

  const polarityOkay = !claimHasNegation || evidenceHasNegation;

  const minimumMatchOkay =
    totalCount <= 2
      ? matchedCount === totalCount
      : matchedCount >= 2;

  const eligible =
    overall.score >= overallThreshold &&
    subjectOkay &&
    actionOkay &&
    outcomeOkay &&
    phraseOkay &&
    polarityOkay &&
    minimumMatchOkay;

  const score = clamp(
    overall.score * 0.55 +
      subject.score * 0.12 +
      action.score * 0.18 +
      outcome.score * 0.1 +
      phrase.score * 0.05,
    0,
    1
  );

  return {
    eligible,
    score: roundNumber(score),
    overallCoverage: roundNumber(overall.score),
    subjectCoverage: roundNumber(subject.score),
    actionCoverage: roundNumber(action.score),
    outcomeCoverage: roundNumber(outcome.score),
    phraseCoverage: roundNumber(phrase.score),
    localActionSupport: localActionGate.valid,
    requiredLocalActions: localActionGate.requiredActions,
    matchedConcepts: overall.matched,
    missingConcepts: overall.missing,
    claimConcepts: profile.concepts,
    evidenceConcepts,
    reason: eligible
      ? "The evidence contains sufficient explicit concept coverage."
      : (
          !localActionGate.valid
            ? `Required action(s) do not occur together in one evidence sentence: ${localActionGate.requiredActions.join(", ")}.`
            : `Required concepts are absent or incomplete: ${overall.missing.slice(0, 6).join(", ") || "insufficient explicit support"}.`
        )
  };
}

function buildEvidenceWindows(studentAnswer) {
  const segments = extractEvidenceSegments(studentAnswer);
  const windows = [];

  for (let index = 0; index < segments.length; index += 1) {
    windows.push({
      start: index,
      end: index,
      segmentNumbers: [index + 1],
      text: segments[index]
    });

    if (index + 1 < segments.length) {
      windows.push({
        start: index,
        end: index + 1,
        segmentNumbers: [index + 1, index + 2],
        text: `${segments[index]} ${segments[index + 1]}`
      });
    }
  }

  return windows;
}

function rankEvidenceWindows(claim, studentAnswer) {
  return buildEvidenceWindows(studentAnswer)
    .map(window => ({
      ...window,
      gate: buildEvidenceGate(claim, window.text)
    }))
    .sort((first, second) => {
      if (first.gate.eligible !== second.gate.eligible) {
        return first.gate.eligible ? -1 : 1;
      }

      return second.gate.score - first.gate.score;
    });
}


/* ---------------------------------
   Generic Contradiction Detection
---------------------------------- */

function contradictionAnchorProfile(claimProfile, sentenceConcepts) {
  const sentenceSet = new Set(sentenceConcepts);

  const anchors = uniqueConcepts([
    ...claimProfile.subjectConcepts,
    ...claimProfile.phraseConcepts,
    ...claimProfile.outcomeConcepts.filter(concept =>
      !actionConcepts.has(concept) &&
      !negationWords.has(concept)
    )
  ]);

  const matched = anchors.filter(anchor =>
    evidenceHasConcept(anchor, sentenceSet)
  );

  const phraseMatched = claimProfile.phraseConcepts.some(anchor =>
    evidenceHasConcept(anchor, sentenceSet)
  );

  const specificMatched = matched.filter(anchor =>
    !weakContradictionAnchors.has(anchor)
  );

  return {
    total: matched.length,
    phraseMatched,
    specificCount: specificMatched.length,
    strong:
      phraseMatched ||
      specificMatched.length >= 1
  };
}

function detectReverseConversion(claim, studentAnswer) {
  const claimMatch = cleanText(claim).toLowerCase().match(
    /convert\w*\s+([a-z -]+?)\s+(?:in)?to\s+([a-z -]+?)(?:[.,]|$)/i
  );

  if (!claimMatch) {
    return null;
  }

  const first = canonicalizeToken(claimMatch[1].trim().split(/\s+/).pop());
  const second = canonicalizeToken(claimMatch[2].trim().split(/\s+/).shift());

  if (!first || !second || first === second) {
    return null;
  }

  const answer = applyPhraseRules(studentAnswer)
    .replace(/[^a-z0-9_'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const reversed = new RegExp(
    `convert\\w*\\s+${second}\\s+(?:in)?to\\s+${first}`,
    "i"
  ).test(answer);

  return reversed
    ? "The student reverses the stated conversion direction."
    : null;
}

function detectExplicitContradiction(claim, studentAnswer) {
  const claimConceptSet = new Set(normaliseConcepts(claim));
  const claimHasNegation = [...claimConceptSet].some(concept =>
    negationWords.has(concept)
  );
  const rawAnswer = cleanText(studentAnswer).replace(/\s+/g, " ");

  const explicitlyDeniesEnergy =
    /\b(?:does not|doesn't|do not|don't|did not|didn't)\s+(?:need|require|use)\s+(?:any\s+)?(?:energy|atp)\b/i.test(rawAnswer) ||
    /\b(?:without|no)\s+(?:energy|atp)\b/i.test(rawAnswer) ||
    /\b(?:energy|atp)\b.{0,30}\b(?:not required|not needed|not used|unnecessary)\b/i.test(rawAnswer);

  if (
    !claimHasNegation &&
    (claimConceptSet.has("energy") || claimConceptSet.has("atp")) &&
    explicitlyDeniesEnergy
  ) {
    return {
      contradicted: true,
      reason: "The student explicitly states that energy or ATP is not required."
    };
  }

  const explicitlyDeniesCarrierProteins =
    /\b(?:does not|doesn't|do not|don't|did not|didn't)\s+(?:need|require|use|involve)\s+carrier proteins?\b/i.test(rawAnswer) ||
    /\b(?:without|no)\s+carrier proteins?\b/i.test(rawAnswer) ||
    /\bcarrier proteins?\b.{0,30}\b(?:not needed|not required|not involved|not used|unnecessary)\b/i.test(rawAnswer);

  if (
    !claimHasNegation &&
    claimConceptSet.has("carrier") &&
    claimConceptSet.has("protein") &&
    explicitlyDeniesCarrierProteins
  ) {
    return {
      contradicted: true,
      reason: "The student explicitly states that carrier proteins are not involved."
    };
  }

  const reverseConversionReason = detectReverseConversion(claim, studentAnswer);

  if (reverseConversionReason) {
    return { contradicted: true, reason: reverseConversionReason };
  }

  const claimProfile = extractClaimProfile(claim);
  const sentences = extractEvidenceSegments(studentAnswer);

  for (const sentence of sentences) {
    const sentenceConcepts = uniqueConcepts(normaliseConcepts(sentence));
    const sentenceSet = new Set(sentenceConcepts);
    const anchorProfile = contradictionAnchorProfile(
      claimProfile,
      sentenceConcepts
    );

    const explicitlyNegatedAction = claimProfile.actionConcepts.find(action => {
      return sentenceConcepts.some((concept, index) => {
        return (
          concept === action &&
          index > 0 &&
          sentenceConcepts[index - 1] === "not"
        );
      });
    });

    if (
      claimProfile.polarity === "positive" &&
      explicitlyNegatedAction &&
      anchorProfile.strong
    ) {
      return {
        contradicted: true,
        reason: `The student explicitly negates the required action "${explicitlyNegatedAction}".`
      };
    }

    for (const [first, second] of antonymPairs) {
      const claimRequiresFirst = claimProfile.concepts.includes(first);
      const claimRequiresSecond = claimProfile.concepts.includes(second);

      /*
        Both directions or states may legitimately appear together:

          "out of the blood and into Bowman's capsule"
          "the valves open and close"

        An opposite term is not contradictory when the required term
        is also explicitly present in the same sentence.
      */

      if (
        claimRequiresFirst &&
        !sentenceSet.has(first) &&
        sentenceSet.has(second) &&
        anchorProfile.strong
      ) {
        return {
          contradicted: true,
          reason: `The student states "${second}", which contradicts the required concept "${first}".`
        };
      }

      if (
        claimRequiresSecond &&
        !sentenceSet.has(second) &&
        sentenceSet.has(first) &&
        anchorProfile.strong
      ) {
        return {
          contradicted: true,
          reason: `The student states "${first}", which contradicts the required concept "${second}".`
        };
      }
    }
  }

  const answer = cleanText(studentAnswer).replace(/\s+/g, " ");

  const safeguardRules = [
    {
      applies: /enzyme[\s-]*substrate complex/i.test(claim),
      contradicted: false,
      reason: ""
    },
    {
      applies: /\bdiploid\b/i.test(claim),
      contradicted: false,
      reason: ""
    },
    {
      applies: /\boxygen debt\b/i.test(claim),
      contradicted: false,
      reason: ""
    },
    {
      applies: /\bdenatur\w*\b/i.test(claim),
      contradicted: /\b(?:never|not|does not|doesn't|do not|don't)\b.{0,25}\bdenatur\w*\b/i.test(answer),
      reason: "The student explicitly states that the enzyme does not denature."
    },
    {
      applies: /\bactive_site\b|active sites?/i.test(applyPhraseRules(claim)),
      contradicted: /active sites?.{0,35}(?:never change|does not change|doesn't change|do not change|don't change|remain unchanged|stay unchanged)/i.test(answer),
      reason: "The student explicitly states that the active site does not change."
    },
    {
      applies: /optimum temperature/i.test(claim),
      contradicted: /continue\w*.{0,30}(?:faster|increase\w*|rise\w*).{0,35}(?:every|all) temperatures?/i.test(answer),
      reason: "The student states that activity keeps increasing at all temperatures, contradicting an optimum."
    }
  ];

  for (const rule of safeguardRules) {
    if (rule.applies && rule.contradicted) {
      return { contradicted: true, reason: rule.reason };
    }
  }

  return { contradicted: false, reason: "" };
}


/* ---------------------------------
   Final Safeguard Rules
---------------------------------- */

const finalSafeguards = [
  {
    claimPattern: /enzyme[\s-]*substrate complex/i,
    evidencePattern: /enzyme[\s-]*substrate complex/i,
    reason: "Binding alone does not explicitly state formation of an enzyme-substrate complex."
  },
  {
    claimPattern: /water potential/i,
    evidencePattern: /water[\s-]*potential/i,
    reason: "Naming osmosis or water movement does not explicitly state the water-potential relationship."
  },
  {
    claimPattern: /maintain\w*[^.]{0,50}concentration gradient|concentration gradient[^.]{0,50}maintain/i,
    evidencePattern: /concentration gradient|gradient in concentration|difference in concentration/i,
    reason: "Blood supply or ventilation alone does not explicitly state that a concentration gradient is maintained."
  },
  {
    claimPattern: /peptide bonds?/i,
    evidencePattern: /peptide bonds?|peptide links?/i,
    reason: "Amino-acid delivery does not explicitly state that peptide bonds form."
  },
  {
    claimPattern: /\bcrossing over\b/i,
    evidencePattern: /crossing over|genetic recombination|exchange of genetic material/i,
    reason: "General genetic variation does not explicitly state crossing over."
  },
  {
    claimPattern: /\bdiploid\b/i,
    evidencePattern: /\bdiploid\b|two sets? of chromosomes|full chromosome number|46 chromosomes/i,
    reason: "Genetically identical daughter cells are not automatically stated to be diploid."
  },
  {
    claimPattern: /\boxygen debt\b/i,
    evidencePattern: /oxygen debt|repay\w*.{0,30}oxygen|oxygen.{0,30}repay\w*|remove\w*.{0,30}lactic acid|oxid\w*.{0,30}lactic acid/i,
    reason: "Producing lactic acid does not explicitly state oxygen debt."
  },
  {
    claimPattern: /\blacteals?\b/i,
    evidencePattern: /\blacteals?\b/i,
    reason: "Surface area and blood capillaries do not explicitly state the presence of lacteals."
  }
];

function validateFinalSafeguards(claim, evidence) {
  for (const rule of finalSafeguards) {
    if (rule.claimPattern.test(claim) && !rule.evidencePattern.test(evidence)) {
      return { valid: false, reason: rule.reason };
    }
  }

  return { valid: true, reason: "" };
}


/* ---------------------------------
   Ollama Request
---------------------------------- */

async function callOllama({
  messages,
  format,
  temperature = 0,
  seed = 42,
  timeoutMs = 360000
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        think: false,
        format,
        keep_alive: "15m",
        options: { temperature, seed }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama returned ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data?.message?.content;

    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}


/* ---------------------------------
   Atomic Claim Decision
---------------------------------- */

function buildClaimDecisionSchema(candidateCount) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      decision: {
        type: "string",
        enum: ["ExplicitlySupported", "InferredOnly", "Missing", "Contradicted"]
      },
      evidenceCandidate: {
        type: "integer",
        minimum: 0,
        maximum: candidateCount
      },
      reason: { type: "string" }
    },
    required: ["decision", "evidenceCandidate", "reason"]
  };
}

async function judgeAtomicClaim({
  markNumber,
  claimNumber,
  claim,
  question,
  studentAnswer
}) {
  const contradiction = detectExplicitContradiction(claim, studentAnswer);

  if (contradiction.contradicted) {
    return {
      claimNumber,
      claim,
      decision: "Contradicted",
      evidenceSegment: 0,
      studentEvidence: "",
      reason: contradiction.reason,
      evidenceGate: null
    };
  }

  const rankedWindows = rankEvidenceWindows(claim, studentAnswer);
  const eligibleCandidates = rankedWindows
    .filter(window => window.gate.eligible)
    .slice(0, 3);

  if (eligibleCandidates.length === 0) {
    const bestGate = rankedWindows[0]?.gate;

    return {
      claimNumber,
      claim,
      decision: "Missing",
      evidenceSegment: 0,
      studentEvidence: "",
      reason: bestGate?.reason ?? "No evidence window contained the required concepts.",
      evidenceGate: bestGate ?? null
    };
  }

  const strongest = eligibleCandidates[0];

  if (
    strongest.gate.overallCoverage >= 0.86 &&
    strongest.gate.actionCoverage >= 0.5 &&
    strongest.gate.score >= 0.8
  ) {
    const safeguard = validateFinalSafeguards(claim, strongest.text);

    if (safeguard.valid) {
      return {
        claimNumber,
        claim,
        decision: "ExplicitlySupported",
        evidenceSegment: strongest.segmentNumbers[0],
        studentEvidence: strongest.text,
        reason: "The required concepts are explicitly present in the selected evidence.",
        evidenceGate: strongest.gate
      };
    }
  }

  const numberedCandidates = eligibleCandidates
    .map((candidate, index) => {
      return `[${index + 1}] ${candidate.text}`;
    })
    .join("\n");

  const systemPrompt = `
You are performing strict textual entailment for one Biology marking claim.

The server has already filtered the student answer through a deterministic
concept-coverage gate. You must now judge only whether one candidate explicitly
states the fixed claim.

Rules:
1. Judge only the exact fixed claim.
2. Accept clear scientific synonyms and equivalent wording.
3. Do not accept background knowledge, normal biological consequences, or implication.
4. Do not invent words that are absent from the candidate.
5. A related sentence is not enough.
6. Select ExplicitlySupported only when the candidate itself communicates the claim.
7. For any other decision, evidenceCandidate must be 0.
8. Return JSON only.
`.trim();

  const userPrompt = `
QUESTION:
${question}

FIXED CLAIM:
${claim}

CANDIDATE EVIDENCE WINDOWS:
${numberedCandidates}

Select the strongest candidate only if it explicitly states the fixed claim.
`.trim();

  const modelDecision = await callOllama({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    format: buildClaimDecisionSchema(eligibleCandidates.length),
    temperature: 0,
    seed: 1000 + markNumber * 100 + claimNumber
  });

  let decision = [
    "ExplicitlySupported",
    "InferredOnly",
    "Missing",
    "Contradicted"
  ].includes(modelDecision?.decision)
    ? modelDecision.decision
    : "Missing";

  let evidenceCandidate = Number(modelDecision?.evidenceCandidate);
  let studentEvidence = "";
  let evidenceSegment = 0;
  let evidenceGate = null;
  let reason = cleanText(modelDecision?.reason, "No explanation was returned.");

  if (!Number.isInteger(evidenceCandidate)) {
    evidenceCandidate = 0;
  }

  if (decision === "ExplicitlySupported") {
    const selected = eligibleCandidates[evidenceCandidate - 1];

    if (!selected) {
      decision = "Missing";
      reason = "The model did not select a valid evidence candidate.";
    } else {
      const gate = buildEvidenceGate(claim, selected.text);
      const safeguard = validateFinalSafeguards(claim, selected.text);

      if (!gate.eligible) {
        decision = "InferredOnly";
        reason = gate.reason;
      } else if (!safeguard.valid) {
        decision = "InferredOnly";
        reason = safeguard.reason;
      } else {
        studentEvidence = selected.text;
        evidenceSegment = selected.segmentNumbers[0];
        evidenceGate = gate;
      }
    }
  }

  if (decision !== "ExplicitlySupported") {
    evidenceCandidate = 0;
    evidenceSegment = 0;
    studentEvidence = "";
    evidenceGate = strongest.gate;
  }

  return {
    claimNumber,
    claim,
    decision,
    evidenceSegment,
    studentEvidence,
    reason,
    evidenceGate
  };
}


/* ---------------------------------
   Mark One Criterion
---------------------------------- */

async function markCriterion({
  markNumber,
  criterion,
  question,
  studentAnswer
}) {
  const evidenceCriterion = stripExplanatoryTail(criterion);
  const atomicClaimTexts = splitAtomicClaims(evidenceCriterion);
  const atomicClaims = [];

  for (let index = 0; index < atomicClaimTexts.length; index += 1) {
    const atomicDecision = await judgeAtomicClaim({
      markNumber,
      claimNumber: index + 1,
      claim: atomicClaimTexts[index],
      question,
      studentAnswer
    });

    atomicClaims.push(atomicDecision);
  }

  const achieved = atomicClaims.every(item =>
    item.decision === "ExplicitlySupported"
  );

  const verifiedEvidence = uniqueStrings(
    atomicClaims
      .filter(item => item.decision === "ExplicitlySupported")
      .map(item => item.studentEvidence)
  );

  const failedClaims = atomicClaims.filter(item =>
    item.decision !== "ExplicitlySupported"
  );

  const reason = achieved
    ? atomicClaims
        .map(item => `${item.claim}: explicitly supported.`)
        .join(" ")
    : failedClaims
        .map(item => `${item.claim}: ${item.reason}`)
        .join(" ");

  return {
    mark: `Mark ${markNumber}`,
    point: criterion,
    status: achieved ? "Achieved" : "Missing",
    studentEvidence: achieved ? verifiedEvidence.join(" ") : "",
    reason,
    atomicClaims
  };
}


/* ---------------------------------
   Deterministic Non-Answer Result
---------------------------------- */

function createNonAnswerAllocation(markPoints) {
  return markPoints.map((criterion, index) => ({
    mark: `Mark ${index + 1}`,
    point: criterion.point,
    status: "Missing",
    studentEvidence: "",
    reason: "The student did not provide any usable biological knowledge.",
    atomicClaims: [
      {
        claimNumber: 1,
        claim: stripExplanatoryTail(criterion.point),
        decision: "Missing",
        evidenceSegment: 0,
        studentEvidence: "",
        reason: "The student answer is a non-answer and supports no marking claim.",
        evidenceGate: null
      }
    ]
  }));
}


/* ---------------------------------
   Feedback Summary
---------------------------------- */

const summarySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    missingMarksSummary: { type: "string" },
    upgradeSentence: { type: "string" },
    fullMarkAnswer: { type: "string" },
    examinerComment: { type: "string" }
  },
  required: [
    "strengths",
    "improvements",
    "missingMarksSummary",
    "upgradeSentence",
    "fullMarkAnswer",
    "examinerComment"
  ]
};

function createFallbackSummary(markAllocation) {
  const achieved = markAllocation.filter(item => item.status === "Achieved");
  const missing = markAllocation.filter(item => item.status === "Missing");

  return {
    strengths: achieved.length > 0
      ? achieved.slice(0, 4).map(item => `Correctly addressed: ${item.point}`)
      : ["No creditworthy biological points were identified."],

    improvements: missing.length > 0
      ? missing.slice(0, 4).map(item => `Add this required point: ${item.point}`)
      : ["Maintain this level of precision in future answers."],

    missingMarksSummary: missing.length > 0
      ? `The answer missed ${missing.length} required marking point(s).`
      : "No marks were lost.",

    upgradeSentence: missing.length > 0
      ? missing.map(item => item.point).join(" ")
      : "No additional sentence is required.",

    fullMarkAnswer: markAllocation.map(item => item.point).join(" "),

    examinerComment: missing.length > 0
      ? "Required biological knowledge was missing, contradicted, or only implied."
      : "The answer met every supplied marking criterion."
  };
}

async function generateFeedbackSummary({
  question,
  markScheme,
  studentAnswer,
  markAllocation
}) {
  const systemPrompt = `
You write concise Biology examiner feedback.

The mark decisions are locked and cannot be changed.

Rules:
1. Do not change any mark decision.
2. Do not recalculate the score.
3. Base feedback only on the supplied material.
4. Distinguish missing, contradicted, and implied ideas.
5. Keep the model answer within the supplied mark scheme.
6. Return JSON only.
`.trim();

  const userPrompt = `
QUESTION:
${question}

MARK SCHEME:
${markScheme}

STUDENT ANSWER:
${studentAnswer}

LOCKED MARK DECISIONS:
${JSON.stringify(markAllocation, null, 2)}

Generate concise feedback without changing the marks.
`.trim();

  try {
    return await callOllama({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      format: summarySchema,
      temperature: 0,
      seed: 9000
    });
  } catch (error) {
    console.error("Summary generation error:", error);
    return createFallbackSummary(markAllocation);
  }
}


/* ---------------------------------
   Final Report Builder
---------------------------------- */

function buildFinalReport({
  board,
  qualification,
  subject,
  numericMaxMarks,
  markAllocation,
  summary
}) {
  const scoreAchieved = markAllocation.filter(item =>
    item.status === "Achieved"
  ).length;

  return {
    scoreAchieved,
    scoreTotal: numericMaxMarks,
    markAllocation,
    strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
    improvements: Array.isArray(summary.improvements) ? summary.improvements : [],
    missingMarksSummary: cleanText(
      summary.missingMarksSummary,
      "The answer was assessed against the supplied criteria."
    ),
    upgradeSentence: cleanText(
      summary.upgradeSentence,
      "Add the missing marking points identified above."
    ),
    fullMarkAnswer: cleanText(
      summary.fullMarkAnswer,
      "A model answer was not generated."
    ),
    examinerComment: cleanText(
      summary.examinerComment,
      "The answer was assessed against the supplied criteria."
    ),
    examContext: {
      board: cleanText(board, "Not specified"),
      qualification: cleanText(qualification, "Not specified"),
      subject: cleanText(subject, "Biology")
    }
  };
}


/* ---------------------------------
   Analyze Endpoint
---------------------------------- */

app.post("/analyze", async (req, res) => {
  const {
    board,
    qualification,
    subject,
    maxMarks,
    question,
    markScheme,
    answer
  } = req.body;

  const numericMaxMarks = Number(maxMarks);

  if (
    !Number.isInteger(numericMaxMarks) ||
    numericMaxMarks < 1 ||
    numericMaxMarks > 20
  ) {
    return res.status(400).json({
      error: "Maximum marks must be a whole number between 1 and 20."
    });
  }

  const cleanQuestion = cleanText(question);
  const cleanMarkScheme = cleanText(markScheme);
  const cleanAnswer = cleanText(answer);

  if (!cleanQuestion || !cleanMarkScheme || !cleanAnswer) {
    return res.status(400).json({
      error: "Question, mark scheme, and student answer are required."
    });
  }

  const markPoints = extractNumberedMarkPoints(
    cleanMarkScheme,
    numericMaxMarks
  );

  if (markPoints.length !== numericMaxMarks) {
    return res.status(400).json({
      error: `The mark scheme must contain exactly ${numericMaxMarks} numbered marking points.`
    });
  }

  if (isNonAnswer(cleanAnswer)) {
    const markAllocation = createNonAnswerAllocation(markPoints);
    const summary = createFallbackSummary(markAllocation);

    return res.json(buildFinalReport({
      board,
      qualification,
      subject,
      numericMaxMarks,
      markAllocation,
      summary
    }));
  }

  console.log("");
  console.log(
    `Analyzing ${numericMaxMarks}-mark ${cleanText(subject, "Biology")} question with evidence gate v2.4`
  );

  try {
    const markAllocation = [];

    for (let index = 0; index < markPoints.length; index += 1) {
      const criterion = markPoints[index];
      const judgingCriterion = stripExplanatoryTail(criterion.point);
      const claims = splitAtomicClaims(judgingCriterion);

      console.log(
        `Mark ${index + 1}/${numericMaxMarks}: checking ${claims.length} claim(s)`
      );

      const decision = await markCriterion({
        markNumber: index + 1,
        criterion: criterion.point,
        question: cleanQuestion,
        studentAnswer: cleanAnswer
      });

      markAllocation.push(decision);
    }

    const summary = await generateFeedbackSummary({
      question: cleanQuestion,
      markScheme: cleanMarkScheme,
      studentAnswer: cleanAnswer,
      markAllocation
    });

    const finalReport = buildFinalReport({
      board,
      qualification,
      subject,
      numericMaxMarks,
      markAllocation,
      summary
    });

    console.log(
      `Noven evidence gate v2.4 awarded ${finalReport.scoreAchieved}/${numericMaxMarks}`
    );

    return res.json(finalReport);
  } catch (error) {
    console.error("Noven AI error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "The local AI model took too long to respond."
      });
    }

    if (error.cause?.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Ollama is not running on this computer."
      });
    }

    return res.status(500).json({
      error: "Noven could not generate a valid examiner report."
    });
  }
});


/* ---------------------------------
   Start Server
---------------------------------- */

app.listen(PORT, () => {
  console.log(`Noven evidence-gate-v2.4.1 backend running on port ${PORT}`);
  console.log(`Using local model: ${OLLAMA_MODEL}`);
});
