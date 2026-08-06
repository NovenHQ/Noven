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
  "speeds"
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
      `vacuoles?|walls?|blood|ventilation)\\b.*` +
      `\\b(?:${predicatePattern})\\b`,
    "i"
  );

  return expression.test(value.trim());
}

function shouldSplitConjunction(
  left,
  right
) {
  /*
    Do not split subject lists such as:

    "Ventilation and blood flow maintain..."
  */

  if (!containsPredicate(left)) {
    return false;
  }

  /*
    Split coordinated predicates:

    "can bind and form a complex"

    Split independent clauses:

    "the vacuole expands and the cell becomes turgid"
  */

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
   Formal Scientific Concept Locks
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
      /concentration gradient/i,

    evidencePattern:
      /(?:concentration gradient|gradient in concentration|difference in concentration)/i,

    failureReason:
      "Mentioning blood supply or ventilation alone does not explicitly state that a concentration gradient is maintained."
  }
];

function validateFormalConcepts(
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

5. Do not accept implication alone.

6. Naming a process does not automatically state its mechanism.

   Saying "osmosis" does not state movement from higher water
   potential to lower water potential.

7. Saying that a substrate binds does not state that an
   enzyme-substrate complex forms.

8. Mentioning capillaries or blood supply does not state that a
   concentration gradient is maintained.

9. If the claim is ExplicitlySupported, return the number of the
   strongest supporting student-answer segment.

10. For InferredOnly, Missing, or Contradicted, return
    evidenceSegment as 0.

11. Never create, rewrite, or quote evidence yourself.

12. Return only JSON matching the supplied schema.
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
    const conceptValidation =
      validateFormalConcepts(
        claim,
        studentEvidence
      );

    if (
      !conceptValidation.valid
    ) {
      decision = "InferredOnly";
      evidenceSegment = 0;
      studentEvidence = "";
      reason =
        conceptValidation.reason;
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
            "The answer attempts to address the question."
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
        ? "Some required marking points were missing or only implied."
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
4. Distinguish missing ideas from implied ideas.
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

      const scoreAchieved =
        markAllocation.filter(
          item =>
            item.status ===
            "Achieved"
        ).length;

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

      const finalReport = {
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

      console.log(
        `Noven awarded ${scoreAchieved}/${numericMaxMarks}`
      );

      return res.json(
        finalReport
      );

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