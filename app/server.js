import express from "express";
import cors from "cors";

const app = express();

const PORT = 3001;
const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_MODEL = "qwen3:1.7b";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Noven sentence-locked examiner is running");
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

function extractEvidenceSegments(studentAnswer) {
  const sentences =
    String(studentAnswer ?? "").match(
      /[^.!?]+[.!?]?/g
    ) ?? [];

  const cleanedSentences = sentences
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (cleanedSentences.length > 0) {
    return cleanedSentences;
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

  const nonAnswerPatterns = [
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

  return nonAnswerPatterns.some(
    pattern => pattern.test(normalized)
  );
}


/* ---------------------------------
   Mark-Scheme Parsing
---------------------------------- */

function extractNumberedMarkPoints(
  markScheme,
  maxMarks
) {
  const lines = String(markScheme)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const points = [];

  for (const line of lines) {
    const match = line.match(
      /^\(?(\d+)\)?[\.\):-]\s*(.+)$/u
    );

    if (!match) {
      continue;
    }

    const number = Number(match[1]);
    const point = cleanText(match[2]);

    if (
      Number.isInteger(number) &&
      point &&
      !points.some(
        item => item.number === number
      )
    ) {
      points.push({
        number,
        point
      });
    }
  }

  points.sort((first, second) => {
    return first.number - second.number;
  });

  return points.slice(0, maxMarks);
}


/* ---------------------------------
   Deterministic Claim Splitting
---------------------------------- */

const predicateWords = [
  "is",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "can",
  "could",
  "will",
  "would",
  "should",
  "may",
  "might",
  "must",
  "bind",
  "binds",
  "form",
  "forms",
  "become",
  "becomes",
  "expand",
  "expands",
  "move",
  "moves",
  "pass",
  "passes",
  "enter",
  "enters",
  "provide",
  "provides",
  "create",
  "creates",
  "maintain",
  "maintains",
  "give",
  "gives",
  "allow",
  "allows",
  "cause",
  "causes",
  "contain",
  "contains",
  "release",
  "releases",
  "increase",
  "increases",
  "decrease",
  "decreases",
  "diffuse",
  "diffuses",
  "dissolve",
  "dissolves",
  "supply",
  "supplies",
  "remain",
  "remains",
  "speed",
  "speeds",
  "join",
  "joins",
  "determine",
  "determines",
  "activate",
  "activates",
  "oppose",
  "opposes",
  "return",
  "returns"
];

const predicatePattern =
  predicateWords.join("|");

function containsPredicate(value) {
  const expression = new RegExp(
    `\\b(?:${predicatePattern})\\b`,
    "i"
  );

  return expression.test(value);
}

function startsWithPredicate(value) {
  const expression = new RegExp(
    `^(?:to\\s+)?(?:${predicatePattern})\\b`,
    "i"
  );

  return expression.test(value.trim());
}

function hasIndependentClause(value) {
  const expression = new RegExp(
    `^(?:the|a|an|this|that|these|those|it|they|` +
      `water|cells?|enzymes?|substrates?|products?|` +
      `vacuoles?|walls?|blood|ventilation|amino acids?|` +
      `effectors?|variables?)\\b.*` +
      `\\b(?:${predicatePattern})\\b`,
    "i"
  );

  return expression.test(value.trim());
}

function shouldSplitConjunction(
  left,
  right
) {
  if (!containsPredicate(left)) {
    return false;
  }

  return (
    startsWithPredicate(right) ||
    hasIndependentClause(right)
  );
}

function splitAtomicClaims(
  criterion,
  depth = 0
) {
  const text = cleanText(criterion)
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/, "")
    .trim();

  if (!text || depth > 4) {
    return text ? [text] : [];
  }

  const conjunctionExpression =
    /\s+and\s+/gi;

  let match;

  while (
    (match =
      conjunctionExpression.exec(text)) !==
    null
  ) {
    const left = text
      .slice(0, match.index)
      .trim();

    const right = text
      .slice(
        match.index + match[0].length
      )
      .trim();

    if (
      !left ||
      !right ||
      !shouldSplitConjunction(
        left,
        right
      )
    ) {
      continue;
    }

    return [
      ...splitAtomicClaims(
        left,
        depth + 1
      ),

      ...splitAtomicClaims(
        right,
        depth + 1
      )
    ];
  }

  return [text];
}


/* ---------------------------------
   Explanatory Tail Handling
---------------------------------- */

function stripExplanatoryTail(
  criterion
) {
  const text = cleanText(criterion)
    .replace(/\s+/g, " ")
    .trim();

  const explanatoryPatterns = [
    /\s*,\s*(?:giving|providing|allowing|causing|leading to|resulting in)\b/i,
    /\s+so(?:\s+that)?\s+/i,
    /\s+(?:thereby|therefore)\s+/i
  ];

  let cutIndex = text.length;

  for (
    const pattern of explanatoryPatterns
  ) {
    const match = pattern.exec(text);

    if (
      match &&
      match.index < cutIndex
    ) {
      cutIndex = match.index;
    }
  }

  return text
    .slice(0, cutIndex)
    .replace(/[,:;\s]+$/, "")
    .trim();
}


/* ---------------------------------
   Claim Polarity Helpers
---------------------------------- */

function containsNegation(value) {
  return /\b(?:without|no|not|never|does not|doesn't|do not|don't|did not|didn't|is not|isn't|are not|aren't)\b/i.test(
    value
  );
}

function claimStatesEnergyIsRequired(
  claim
) {
  const hasEnergyConcept =
    /\b(?:energy|atp|respiration)\b/i.test(
      claim
    );

  const hasRequirement =
    /\b(?:required|needed|used|requires?|needs?|uses?)\b/i.test(
      claim
    );

  return (
    hasEnergyConcept &&
    hasRequirement &&
    !containsNegation(claim)
  );
}

function claimStatesCarrierProteinsAreUsed(
  claim
) {
  return (
    /\bcarrier proteins?\b/i.test(
      claim
    ) &&
    !containsNegation(claim)
  );
}


/* ---------------------------------
   Explicit Contradiction Detection
---------------------------------- */

function detectExplicitContradiction(
  claim,
  studentAnswer
) {
  const answer = cleanText(studentAnswer)
    .replace(/\s+/g, " ");

  const contradictionRules = [
    {
      applies(currentClaim) {
        return claimStatesCarrierProteinsAreUsed(
          currentClaim
        );
      },

      contradictionPatterns: [
        /\b(?:does not|doesn't|do not|don't|did not|didn't)\b.{0,30}\b(?:need|require|use|involve)\b.{0,20}\bcarrier proteins?\b/i,

        /\b(?:without|no)\b.{0,15}\bcarrier proteins?\b/i,

        /\bcarrier proteins?\b.{0,30}\b(?:not needed|not required|not involved|not used|unnecessary)\b/i
      ],

      reason:
        "The student explicitly states that carrier proteins are not needed or involved."
    },

    {
      applies(currentClaim) {
        return claimStatesEnergyIsRequired(
          currentClaim
        );
      },

      contradictionPatterns: [
        /\b(?:does not|doesn't|do not|don't|did not|didn't)\b.{0,30}\b(?:need|require|use)\b.{0,20}\b(?:energy|atp|respiration)\b/i,

        /\b(?:uses?|requires?|needs?)\b.{0,10}\bno\b.{0,10}\b(?:energy|atp)\b/i,

        /\b(?:without|no)\b.{0,15}\b(?:energy|atp)\b/i,

        /\b(?:energy|atp|respiration)\b.{0,30}\b(?:not needed|not required|not used|unnecessary)\b/i
      ],

      reason:
        "The student explicitly states that energy or ATP is not required."
    },

    {
      applies(currentClaim) {
        return (
          /\bdenatur\w*\b/i.test(
            currentClaim
          ) &&
          !containsNegation(
            currentClaim
          )
        );
      },

      contradictionPatterns: [
        /\b(?:never|does not|doesn't|do not|don't|cannot|can't)\b.{0,20}\bdenatur\w*\b/i,

        /\benzymes?\b.{0,25}\bnever\b.{0,15}\bdenatur\w*\b/i
      ],

      reason:
        "The student explicitly states that the enzyme does not denature."
    },

    {
      applies(currentClaim) {
        return (
          /\bactive sites?\b/i.test(
            currentClaim
          ) &&
          /\b(?:change|changes|changed|alter|alters|altered|shape)\b/i.test(
            currentClaim
          )
        );
      },

      contradictionPatterns: [
        /\bactive sites?\b.{0,30}\b(?:never change|does not change|doesn't change|do not change|don't change|remain unchanged|stay unchanged)\b/i,

        /\b(?:shape of the )?active sites?\b.{0,30}\b(?:does not|doesn't|do not|don't|never)\b.{0,15}\bchange\b/i
      ],

      reason:
        "The student explicitly states that the active site does not change shape."
    },

    {
      applies(currentClaim) {
        return (
          /\boptimum temperature\b/i.test(
            currentClaim
          ) &&
          /\b(?:enzyme activity|activity|rate)\b/i.test(
            currentClaim
          )
        );
      },

      contradictionPatterns: [
        /\bcontinue(?:s|d|ing)?\b.{0,40}\b(?:faster|increase|increasing|rise|rising)\b.{0,40}\b(?:every|all)\s+temperatures?\b/i,

        /\b(?:no|never reaches?|does not reach|doesn't reach)\b.{0,20}\boptimum temperature\b/i
      ],

      reason:
        "The student states that enzyme activity continues increasing at every temperature, contradicting the existence of an optimum."
    }
  ];

  for (
    const rule of contradictionRules
  ) {
    if (!rule.applies(claim)) {
      continue;
    }

    const contradicted =
      rule.contradictionPatterns.some(
        pattern => pattern.test(answer)
      );

    if (contradicted) {
      return {
        contradicted: true,
        reason: rule.reason
      };
    }
  }

  return {
    contradicted: false,
    reason: ""
  };
}


/* ---------------------------------
   Evidence Validation Rules
---------------------------------- */

const formalConceptRules = [
  {
    claimPattern:
      /enzyme[\s-]*substrate complex/i,

    evidencePattern:
      /enzyme[\s-]*substrate complex/i,

    failureReason:
      "Binding alone does not explicitly state that an enzyme-substrate complex forms."
  },

  {
    claimPattern:
      /water potential/i,

    evidencePattern:
      /water[\s-]*potential/i,

    failureReason:
      "Naming osmosis or water movement does not explicitly state the water-potential relationship."
  },

  {
    claimPattern:
      /maintain(?:s|ed|ing)?[^.]{0,50}concentration gradient|concentration gradient[^.]{0,50}maintain/i,

    evidencePattern:
      /(?:concentration gradient|gradient in concentration|difference in concentration)/i,

    failureReason:
      "Mentioning blood supply or ventilation alone does not explicitly state that a concentration gradient is maintained."
  },

  {
    claimPattern:
      /peptide bonds?/i,

    evidencePattern:
      /peptide bonds?|peptide links?/i,

    failureReason:
      "Describing transcription, translation, or amino-acid delivery does not explicitly state that amino acids are joined by peptide bonds."
  },

  {
    claimPattern:
      /\bcrossing over\b/i,

    evidencePattern:
      /crossing over|genetic recombination|exchange of genetic material/i,

    failureReason:
      "General genetic variation in meiosis does not explicitly state that crossing over contributes to variation."
  }
];

const explicitLanguageRules = [
  /*
    Diffusion direction.
  */

  {
    claimPattern:
      /higher concentration.*lower concentration|from (?:a region of )?higher concentration to (?:a region of )?lower concentration/i,

    isSatisfied(evidence) {
      const hasHigher =
        /\b(?:higher|high|greater|more concentrated)\b/i.test(
          evidence
        );

      const hasLower =
        /\b(?:lower|low|less concentrated)\b/i.test(
          evidence
        );

      const hasConcentration =
        /\bconcentrat\w*\b/i.test(
          evidence
        );

      return (
        hasHigher &&
        hasLower &&
        hasConcentration
      );
    },

    failureReason:
      "Reaching an even distribution does not explicitly state movement from higher concentration to lower concentration."
  },

  /*
    Active transport against a gradient.
  */

  {
    claimPattern:
      /against (?:the )?concentration gradient/i,

    isSatisfied(evidence) {
      const explicitlyAgainstGradient =
        /\bagainst\b.{0,20}\bconcentration gradient\b/i.test(
          evidence
        );

      const hasLower =
        /\b(?:lower|low|less concentrated)\b/i.test(
          evidence
        );

      const hasHigher =
        /\b(?:higher|high|more concentrated)\b/i.test(
          evidence
        );

      const hasConcentration =
        /\bconcentrat\w*\b/i.test(
          evidence
        );

      return (
        explicitlyAgainstGradient ||
        (
          hasLower &&
          hasHigher &&
          hasConcentration
        )
      );
    },

    failureReason:
      "The answer does not state movement against the concentration gradient or movement from lower to higher concentration."
  },

  /*
    Random movement.
  */

  {
    claimPattern:
      /\brandom(?:ly)?\b/i,

    isSatisfied(evidence) {
      return /\brandom(?:ly)?\b/i.test(
        evidence
      );
    },

    failureReason:
      "The answer does not explicitly state that the particles move randomly."
  },

  /*
    No-energy statement.
  */

  {
    claimPattern:
      /without requiring .*?(?:energy|atp|respiration)|does not require .*?(?:energy|atp|respiration)|no .*?(?:energy|atp|respiration).*?required/i,

    isSatisfied(evidence) {
      const negativeBeforeEnergy =
        /\b(?:without|no|not|does not|doesn't|do not|don't)\b.{0,40}\b(?:energy|atp|respiration)\b/i.test(
          evidence
        );

      const energyBeforeNegative =
        /\b(?:energy|atp|respiration)\b.{0,40}\b(?:not required|not needed|not used|unnecessary)\b/i.test(
          evidence
        );

      return (
        negativeBeforeEnergy ||
        energyBeforeNegative
      );
    },

    failureReason:
      "The answer does not explicitly state that metabolic energy is unnecessary."
  },

  /*
    Enzyme activity reaches an optimum.
  */

  {
    claimPattern:
      /\b(?:enzyme activity|activity|rate)\b.*\b(?:increase|increases|rises?|rising)\b.*\boptimum temperature\b|\boptimum temperature\b.*\b(?:enzyme activity|activity|rate)\b/i,

    isSatisfied(evidence) {
      const mentionsActivity =
        /\b(?:enzyme activity|enzyme rate|reaction rate|rate of enzyme activity|activity)\b/i.test(
          evidence
        );

      const mentionsIncrease =
        /\b(?:increase|increases|increased|rise|rises|rising|faster)\b/i.test(
          evidence
        );

      const mentionsOptimum =
        /\boptimum temperature\b/i.test(
          evidence
        );

      return (
        mentionsActivity &&
        mentionsIncrease &&
        mentionsOptimum
      );
    },

    failureReason:
      "Greater kinetic energy alone does not explicitly state that enzyme activity increases until an optimum temperature is reached."
  },

  /*
    Limiting-factor definition.
  */

  {
    claimPattern:
      /limiting factor.*shortest supply.*restricts? the rate|factor in shortest supply that restricts? the rate/i,

    isSatisfied(evidence) {
      const hasSupplyDefinition =
        /\b(?:shortest|least|lowest)\b.{0,25}\bsupply\b/i.test(
          evidence
        );

      const hasRateRestriction =
        /\b(?:restrict|restricts|limit|limits)\b.{0,35}\brate\b/i.test(
          evidence
        ) ||
        /\brate\b.{0,35}\b(?:restricted|limited)\b/i.test(
          evidence
        );

      return (
        hasSupplyDefinition &&
        hasRateRestriction
      );
    },

    failureReason:
      "Listing examples of limiting factors does not define a limiting factor as the factor in shortest supply that restricts the rate."
  },

  /*
    Oxygen debt.
  */

  {
    claimPattern:
      /\boxygen debt\b/i,

    isSatisfied(evidence) {
      const mentionsOxygenDebt =
        /\boxygen debt\b/i.test(
          evidence
        );

      const mentionsOxygenRepayment =
        /\b(?:repay|repaying|repayment)\b.{0,35}\boxygen\b/i.test(
          evidence
        ) ||
        /\boxygen\b.{0,35}\b(?:repay|repaying|repayment)\b/i.test(
          evidence
        );

      const mentionsLacticAcidRemoval =
        /\b(?:remove|removes|removed|removal|oxidise|oxidises|oxidised|oxidize|oxidizes|oxidized|oxidation|break down|breaks down|broken down)\b.{0,45}\blactic acid\b/i.test(
          evidence
        ) &&
        /\b(?:after exercise|following exercise|during recovery|afterwards|recovery)\b/i.test(
          evidence
        );

      return (
        mentionsOxygenDebt ||
        mentionsOxygenRepayment ||
        mentionsLacticAcidRemoval
      );
    },

    failureReason:
      "Producing lactic acid does not explicitly state that it contributes to oxygen debt after exercise."
  },

  /*
    Diploid cells.
  */

  {
    claimPattern:
      /\bdiploid\b/i,

    isSatisfied(evidence) {
      return (
        /\bdiploid\b/i.test(
          evidence
        ) ||
        /\b(?:two|2)\s+sets?\s+of\s+chromosomes\b/i.test(
          evidence
        ) ||
        /\bfull\s+(?:chromosome|chromosomal)\s+(?:number|set)\b/i.test(
          evidence
        ) ||
        /\b46\s+chromosomes\b/i.test(
          evidence
        )
      );
    },

    failureReason:
      "Producing genetically identical daughter cells does not explicitly state that the cells are diploid."
  },

  /*
    Lacteals and lipid absorption.
  */

  {
    claimPattern:
      /\blacteals?\b/i,

    isSatisfied(evidence) {
      const mentionsLacteal =
        /\blacteals?\b/i.test(
          evidence
        );

      const mentionsLipids =
        /\b(?:lipids?|fats?|fatty acids?|glycerol|chylomicrons?)\b/i.test(
          evidence
        );

      return (
        mentionsLacteal &&
        mentionsLipids
      );
    },

    failureReason:
      "Large surface area or blood capillaries do not explicitly state that villi contain lacteals for lipid absorption."
  },

  /*
    DNA strand sequence relationship.
  */

  {
    claimPattern:
      /base sequence.*one strand.*determines?.*other strand|sequence on one strand.*(?:determines?|specifies?|dictates?).*other strand/i,

    isSatisfied(evidence) {
      const hasRelationshipVerb =
        /\b(?:determine|determines|determined|specify|specifies|specified|dictate|dictates|dictated)\b/i.test(
          evidence
        );

      const mentionsOneStrand =
        /\b(?:one|first)\s+(?:dna\s+)?strand\b/i.test(
          evidence
        );

      const mentionsOtherStrand =
        /\b(?:other|second|complementary)\s+(?:dna\s+)?strand\b/i.test(
          evidence
        );

      const mentionsTemplateRelationship =
        /\b(?:template strand|complementary sequence)\b/i.test(
          evidence
        );

      return (
        (
          hasRelationshipVerb &&
          mentionsOneStrand &&
          mentionsOtherStrand
        ) ||
        mentionsTemplateRelationship
      );
    },

    failureReason:
      "Stating complementary base-pairing rules does not explicitly state that the sequence on one strand determines the sequence on the other strand."
  },

  /*
    Base sequence determines amino-acid sequence.
  */

  {
    claimPattern:
      /sequence of bases.*determines?.*sequence of amino acids|base sequence.*(?:determines?|specifies?|codes? for).*amino acid sequence/i,

    isSatisfied(evidence) {
      const mentionsBases =
        /\b(?:base|bases|nucleotide|nucleotides|codon|codons)\b/i.test(
          evidence
        );

      const mentionsAminoAcids =
        /\bamino acids?\b/i.test(
          evidence
        );

      const hasRelationship =
        /\b(?:determine|determines|determined|specify|specifies|specified|code|codes|coded|encode|encodes|encoded|dictate|dictates|dictated)\b/i.test(
          evidence
        );

      const mentionsSequence =
        /\b(?:sequence|order)\b/i.test(
          evidence
        );

      return (
        mentionsBases &&
        mentionsAminoAcids &&
        hasRelationship &&
        mentionsSequence
      );
    },

    failureReason:
      "Describing transcription does not explicitly state that the base sequence determines the amino-acid sequence."
  },

  /*
    Effector response opposes the change.
  */

  {
    claimPattern:
      /effector.*response.*opposes?.*original change|response.*opposes?.*change/i,

    isSatisfied(evidence) {
      const mentionsResponse =
        /\b(?:response|responds?|action)\b/i.test(
          evidence
        );

      const mentionsOpposition =
        /\b(?:oppose|opposes|opposed|reverse|reverses|reversed|counteract|counteracts|counteracted|reduce|reduces|reduced|correct|corrects|corrected)\b/i.test(
          evidence
        );

      const mentionsChange =
        /\b(?:change|deviation|increase|decrease)\b/i.test(
          evidence
        );

      return (
        mentionsResponse &&
        mentionsOpposition &&
        mentionsChange
      );
    },

    failureReason:
      "Activating an effector does not explicitly state that its response opposes the original change."
  },

  /*
    Return towards normal level.
  */

  {
    claimPattern:
      /returns?.*normal level|returns?.*set point|variable.*normal level|variable.*set point/i,

    isSatisfied(evidence) {
      const mentionsNormalTarget =
        /\b(?:normal level|set point|normal value|original level|stable level)\b/i.test(
          evidence
        );

      const mentionsReturn =
        /\b(?:return|returns|returned|restore|restores|restored|back toward|back towards|moves toward|moves towards)\b/i.test(
          evidence
        );

      return (
        mentionsNormalTarget &&
        mentionsReturn
      );
    },

    failureReason:
      "Activating an effector does not explicitly state that the variable returns towards its normal level or set point."
  }
];

function validateEvidenceAgainstClaim(
  claim,
  evidence
) {
  for (
    const rule of formalConceptRules
  ) {
    if (
      rule.claimPattern.test(claim) &&
      !rule.evidencePattern.test(
        evidence
      )
    ) {
      return {
        valid: false,
        reason: rule.failureReason
      };
    }
  }

  for (
    const rule of explicitLanguageRules
  ) {
    if (
      rule.claimPattern.test(claim) &&
      !rule.isSatisfied(evidence)
    ) {
      return {
        valid: false,
        reason: rule.failureReason
      };
    }
  }

  return {
    valid: true,
    reason: ""
  };
}


/* ---------------------------------
   Ollama Request
---------------------------------- */

async function callOllama({
  messages,
  format,
  temperature = 0,
  seed = 42,
  timeoutMs = 240000
}) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      OLLAMA_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        signal: controller.signal,

        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages,
          stream: false,
          think: false,
          format,
          keep_alive: "15m",

          options: {
            temperature,
            seed
          }
        })
      }
    );

    if (!response.ok) {
      const errorBody =
        await response.text();

      throw new Error(
        `Ollama returned ${response.status}: ${errorBody}`
      );
    }

    const data = await response.json();

    const content =
      data?.message?.content;

    if (!content) {
      throw new Error(
        "Ollama returned an empty response."
      );
    }

    return JSON.parse(content);

  } finally {
    clearTimeout(timeout);
  }
}


/* ---------------------------------
   Atomic Claim Decision
---------------------------------- */

function buildClaimDecisionSchema(
  evidenceSegmentCount
) {
  return {
    type: "object",
    additionalProperties: false,

    properties: {
      decision: {
        type: "string",

        enum: [
          "ExplicitlySupported",
          "InferredOnly",
          "Missing",
          "Contradicted"
        ]
      },

      evidenceSegment: {
        type: "integer",
        minimum: 0,
        maximum:
          evidenceSegmentCount
      },

      reason: {
        type: "string"
      }
    },

    required: [
      "decision",
      "evidenceSegment",
      "reason"
    ]
  };
}

async function judgeAtomicClaim({
  markNumber,
  claimNumber,
  claim,
  question,
  studentAnswer
}) {
  const contradiction =
    detectExplicitContradiction(
      claim,
      studentAnswer
    );

  if (contradiction.contradicted) {
    return {
      claimNumber,
      claim,
      decision: "Contradicted",
      evidenceSegment: 0,
      studentEvidence: "",
      reason: contradiction.reason
    };
  }

  const evidenceSegments =
    extractEvidenceSegments(
      studentAnswer
    );

  const numberedEvidence =
    evidenceSegments
      .map(
        (segment, index) =>
          `[${index + 1}] ${segment}`
      )
      .join("\n");

  const systemPrompt = `
You are judging one fixed atomic Biology marking claim.

The server has already created the claim. You must not add,
remove, expand, combine, or rewrite its requirements.

RULES:

1. Judge only the exact fixed claim supplied.

2. Use ExplicitlySupported only when one of the numbered
   student-answer segments directly communicates the required
   scientific idea.

3. Accept clear scientific synonyms and equivalent wording.

4. Do not require an exact wording match.

5. Do not accept implication, background knowledge, or a later
   consequence that the student did not state.

6. Explicit contradictions must not receive a mark.

7. Naming a biological process does not automatically state
   every mechanism or consequence associated with it.

8. Movement from lower concentration to higher concentration is
   equivalent to movement against the concentration gradient.

9. Saying greater kinetic energy does not state that enzyme
   activity increases until an optimum temperature.

10. Saying "osmosis" does not state movement from higher water
    potential to lower water potential.

11. Saying that a substrate binds does not state that an
    enzyme-substrate complex forms.

12. Mentioning capillaries or blood supply does not state that a
    concentration gradient is maintained.

13. Saying particles become evenly distributed does not state
    movement from higher concentration to lower concentration.

14. Saying diffusion occurred does not state random movement or
    lack of energy use.

15. Listing examples of limiting factors does not define a
    limiting factor.

16. Mentioning lactic acid does not state oxygen debt.

17. Saying daughter cells are genetically identical does not
    state that they are diploid.

18. Saying meiosis causes variation does not state that crossing
    over occurred.

19. Large surface area or blood capillaries do not state that
    villi contain lacteals.

20. Giving complementary base-pairing rules does not state that
    one DNA strand determines the other strand's sequence.

21. Describing transcription or translation does not state that
    amino acids are joined by peptide bonds.

22. Describing transcription does not state that the base
    sequence determines the amino-acid sequence.

23. Saying an effector is activated does not state that its
    response opposes the original change.

24. Saying an effector is activated does not state that the
    variable returns to the set point.

25. A statement such as "I do not know" supports no scientific
    marking claim.

26. If the claim is ExplicitlySupported, return the number of
    the strongest supporting student-answer segment.

27. For InferredOnly, Missing, or Contradicted, return
    evidenceSegment as 0.

28. Never create, rewrite, or quote evidence yourself.

29. Return only JSON matching the supplied schema.
`.trim();

  const userPrompt = `
EXAM QUESTION:

<question>
${question}
</question>

FIXED ATOMIC CLAIM:

<claim>
${claim}
</claim>

NUMBERED STUDENT-ANSWER SEGMENTS:

${numberedEvidence}

Judge this fixed claim only.
`.trim();

  const modelDecision =
    await callOllama({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],

      format:
        buildClaimDecisionSchema(
          evidenceSegments.length
        ),

      temperature: 0,

      seed:
        1000 +
        markNumber * 100 +
        claimNumber
    });

  let decision = [
    "ExplicitlySupported",
    "InferredOnly",
    "Missing",
    "Contradicted"
  ].includes(modelDecision?.decision)
    ? modelDecision.decision
    : "Missing";

  let evidenceSegment = Number(
    modelDecision?.evidenceSegment
  );

  let studentEvidence = "";

  let reason = cleanText(
    modelDecision?.reason,
    "No explanation was returned."
  );

  if (
    !Number.isInteger(
      evidenceSegment
    )
  ) {
    evidenceSegment = 0;
  }

  if (
    decision ===
    "ExplicitlySupported"
  ) {
    const validSegment =
      evidenceSegment >= 1 &&
      evidenceSegment <=
        evidenceSegments.length;

    if (!validSegment) {
      decision = "Missing";
      evidenceSegment = 0;

      reason =
        "No valid supporting sentence was selected from the student's answer.";

    } else {
      studentEvidence =
        evidenceSegments[
          evidenceSegment - 1
        ];
    }
  }

  if (
    decision ===
    "ExplicitlySupported"
  ) {
    const evidenceValidation =
      validateEvidenceAgainstClaim(
        claim,
        studentEvidence
      );

    if (
      !evidenceValidation.valid
    ) {
      decision = "InferredOnly";
      evidenceSegment = 0;
      studentEvidence = "";

      reason =
        evidenceValidation.reason;
    }
  }

  if (
    decision !==
    "ExplicitlySupported"
  ) {
    evidenceSegment = 0;
    studentEvidence = "";
  }

  return {
    claimNumber,
    claim,
    decision,
    evidenceSegment,
    studentEvidence,
    reason
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
  const evidenceCriterion =
    stripExplanatoryTail(
      criterion
    );

  const atomicClaimTexts =
    splitAtomicClaims(
      evidenceCriterion
    );

  const atomicClaims = [];

  for (
    let index = 0;
    index <
      atomicClaimTexts.length;
    index += 1
  ) {
    const atomicDecision =
      await judgeAtomicClaim({
        markNumber,
        claimNumber: index + 1,

        claim:
          atomicClaimTexts[index],

        question,
        studentAnswer
      });

    atomicClaims.push(
      atomicDecision
    );
  }

  const achieved =
    atomicClaims.every(
      item =>
        item.decision ===
        "ExplicitlySupported"
    );

  const verifiedEvidence =
    uniqueStrings(
      atomicClaims
        .filter(
          item =>
            item.decision ===
            "ExplicitlySupported"
        )
        .map(
          item =>
            item.studentEvidence
        )
    );

  const failedClaims =
    atomicClaims.filter(
      item =>
        item.decision !==
        "ExplicitlySupported"
    );

  const reason = achieved
    ? atomicClaims
        .map(
          item =>
            `${item.claim}: explicitly supported.`
        )
        .join(" ")
    : failedClaims
        .map(
          item =>
            `${item.claim}: ${item.reason}`
        )
        .join(" ");

  return {
    mark: `Mark ${markNumber}`,
    point: criterion,

    status:
      achieved
        ? "Achieved"
        : "Missing",

    studentEvidence:
      achieved
        ? verifiedEvidence.join(" ")
        : "",

    reason,
    atomicClaims
  };
}


/* ---------------------------------
   Deterministic Non-Answer Result
---------------------------------- */

function createNonAnswerAllocation(
  markPoints
) {
  return markPoints.map(
    (criterion, index) => {
      return {
        mark: `Mark ${index + 1}`,
        point: criterion.point,
        status: "Missing",
        studentEvidence: "",

        reason:
          "The student did not provide any usable biological knowledge.",

        atomicClaims: [
          {
            claimNumber: 1,

            claim:
              stripExplanatoryTail(
                criterion.point
              ),

            decision: "Missing",
            evidenceSegment: 0,
            studentEvidence: "",

            reason:
              "The student answer is a non-answer and does not support this marking claim."
          }
        ]
      };
    }
  );
}


/* ---------------------------------
   Feedback Summary
---------------------------------- */

const summarySchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    strengths: {
      type: "array",

      items: {
        type: "string"
      }
    },

    improvements: {
      type: "array",

      items: {
        type: "string"
      }
    },

    missingMarksSummary: {
      type: "string"
    },

    upgradeSentence: {
      type: "string"
    },

    fullMarkAnswer: {
      type: "string"
    },

    examinerComment: {
      type: "string"
    }
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

function createFallbackSummary(
  markAllocation
) {
  const achieved =
    markAllocation.filter(
      item =>
        item.status ===
        "Achieved"
    );

  const missing =
    markAllocation.filter(
      item =>
        item.status ===
        "Missing"
    );

  return {
    strengths:
      achieved.length > 0
        ? achieved
            .slice(0, 4)
            .map(
              item =>
                `Correctly addressed: ${item.point}`
            )
        : [
            "No creditworthy biological points were identified."
          ],

    improvements:
      missing.length > 0
        ? missing
            .slice(0, 4)
            .map(
              item =>
                `Add this required point: ${item.point}`
            )
        : [
            "Maintain this level of precision in future answers."
          ],

    missingMarksSummary:
      missing.length > 0
        ? `The answer missed ${missing.length} required marking point(s).`
        : "No marks were lost.",

    upgradeSentence:
      missing.length > 0
        ? missing
            .map(
              item => item.point
            )
            .join(" ")
        : "No additional sentence is required.",

    fullMarkAnswer:
      markAllocation
        .map(item => item.point)
        .join(" "),

    examinerComment:
      missing.length > 0
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
5. The model answer must remain within the mark scheme.
6. Return only JSON matching the schema.
`.trim();

  const userPrompt = `
QUESTION:

${question}

MARK SCHEME:

${markScheme}

STUDENT ANSWER:

${studentAnswer}

LOCKED MARK DECISIONS:

${JSON.stringify(
  markAllocation,
  null,
  2
)}

Generate concise feedback without changing the marks.
`.trim();

  try {
    return await callOllama({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],

      format: summarySchema,
      temperature: 0,
      seed: 9000
    });

  } catch (error) {
    console.error(
      "Summary generation error:",
      error
    );

    return createFallbackSummary(
      markAllocation
    );
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
  const scoreAchieved =
    markAllocation.filter(
      item =>
        item.status ===
        "Achieved"
    ).length;

  return {
    scoreAchieved,

    scoreTotal:
      numericMaxMarks,

    markAllocation,

    strengths:
      Array.isArray(
        summary.strengths
      )
        ? summary.strengths
        : [],

    improvements:
      Array.isArray(
        summary.improvements
      )
        ? summary.improvements
        : [],

    missingMarksSummary:
      cleanText(
        summary.missingMarksSummary,
        "The answer was assessed against the supplied criteria."
      ),

    upgradeSentence:
      cleanText(
        summary.upgradeSentence,
        "Add the missing marking points identified above."
      ),

    fullMarkAnswer:
      cleanText(
        summary.fullMarkAnswer,
        "A model answer was not generated."
      ),

    examinerComment:
      cleanText(
        summary.examinerComment,
        "The answer was assessed against the supplied criteria."
      ),

    examContext: {
      board:
        cleanText(
          board,
          "Not specified"
        ),

      qualification:
        cleanText(
          qualification,
          "Not specified"
        ),

      subject:
        cleanText(
          subject,
          "Biology"
        )
    }
  };
}


/* ---------------------------------
   Analyze Endpoint
---------------------------------- */

app.post(
  "/analyze",
  async (req, res) => {
    const {
      board,
      qualification,
      subject,
      maxMarks,
      question,
      markScheme,
      answer
    } = req.body;

    const numericMaxMarks =
      Number(maxMarks);

    if (
      !Number.isInteger(
        numericMaxMarks
      ) ||
      numericMaxMarks < 1 ||
      numericMaxMarks > 20
    ) {
      return res.status(400).json({
        error:
          "Maximum marks must be a whole number between 1 and 20."
      });
    }

    const cleanQuestion =
      cleanText(question);

    const cleanMarkScheme =
      cleanText(markScheme);

    const cleanAnswer =
      cleanText(answer);

    if (
      !cleanQuestion ||
      !cleanMarkScheme ||
      !cleanAnswer
    ) {
      return res.status(400).json({
        error:
          "Question, mark scheme, and student answer are required."
      });
    }

    const markPoints =
      extractNumberedMarkPoints(
        cleanMarkScheme,
        numericMaxMarks
      );

    if (
      markPoints.length !==
      numericMaxMarks
    ) {
      return res.status(400).json({
        error:
          `The mark scheme must contain exactly ${numericMaxMarks} numbered marking points.`
      });
    }

    if (isNonAnswer(cleanAnswer)) {
      const markAllocation =
        createNonAnswerAllocation(
          markPoints
        );

      const summary =
        createFallbackSummary(
          markAllocation
        );

      const finalReport =
        buildFinalReport({
          board,
          qualification,
          subject,
          numericMaxMarks,
          markAllocation,
          summary
        });

      console.log("");
      console.log(
        `Non-answer detected. Noven awarded 0/${numericMaxMarks}`
      );

      return res.json(finalReport);
    }

    console.log("");

    console.log(
      `Analyzing ${numericMaxMarks}-mark ${cleanText(subject, "Biology")} question`
    );

    try {
      const markAllocation = [];

      for (
        let index = 0;
        index < markPoints.length;
        index += 1
      ) {
        const criterion =
          markPoints[index];

        const judgingCriterion =
          stripExplanatoryTail(
            criterion.point
          );

        const claims =
          splitAtomicClaims(
            judgingCriterion
          );

        console.log(
          `Mark ${index + 1}/${numericMaxMarks}: checking ${claims.length} fixed claim(s)`
        );

        const decision =
          await markCriterion({
            markNumber:
              index + 1,

            criterion:
              criterion.point,

            question:
              cleanQuestion,

            studentAnswer:
              cleanAnswer
          });

        markAllocation.push(
          decision
        );
      }

      const summary =
        await generateFeedbackSummary({
          question:
            cleanQuestion,

          markScheme:
            cleanMarkScheme,

          studentAnswer:
            cleanAnswer,

          markAllocation
        });

      const finalReport =
        buildFinalReport({
          board,
          qualification,
          subject,
          numericMaxMarks,
          markAllocation,
          summary
        });

      console.log(
        `Noven awarded ${finalReport.scoreAchieved}/${numericMaxMarks}`
      );

      return res.json(finalReport);

    } catch (error) {
      console.error(
        "Noven AI error:",
        error
      );

      if (
        error.name ===
        "AbortError"
      ) {
        return res.status(504).json({
          error:
            "The local AI model took too long to respond."
        });
      }

      if (
        error.cause?.code ===
        "ECONNREFUSED"
      ) {
        return res.status(503).json({
          error:
            "Ollama is not running on this computer."
        });
      }

      return res.status(500).json({
        error:
          "Noven could not generate a valid examiner report."
      });
    }
  }
);


/* ---------------------------------
   Start Server
---------------------------------- */

app.listen(PORT, () => {
  console.log(
    `Noven sentence-locked backend running on port ${PORT}`
  );

  console.log(
    `Using local model: ${OLLAMA_MODEL}`
  );
});