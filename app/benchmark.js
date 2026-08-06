import { writeFile } from "node:fs/promises";

const API_URL = "http://localhost:3001/analyze";

/*
  NOVEN EXAMINER BENCHMARK

  These are synthetic calibration cases created for development.
  They are not official Edexcel questions or mark schemes.

  Run the full benchmark:

    node benchmark.js

  Run a smaller range:

    node benchmark.js --start=1 --end=5
    node benchmark.js --start=6 --end=10
    node benchmark.js --start=11 --end=15
    node benchmark.js --start=16 --end=20
*/

const benchmarkCases = [
  {
    id: "enzyme-specificity-partial",
    title: "Enzyme specificity — partial answer",
    expectedScore: 2,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 3,

      question:
        "Explain why an enzyme usually acts on only one type of substrate.",

      markScheme: `
Award one mark for each point:
1. The enzyme has an active site with a specific shape.
2. The substrate has a complementary shape to the active site.
3. Only the correct substrate can bind and form an enzyme-substrate complex.
      `.trim(),

      answer:
        "An enzyme has an active site with a specific shape. The correct substrate has a complementary shape and can bind to it."
    }
  },

  {
    id: "enzyme-temperature-full",
    title: "Enzyme temperature — full answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain the effect of increasing temperature on enzyme activity.",

      markScheme: `
Award one mark for each point:
1. Increasing temperature gives particles more kinetic energy and increases successful collisions.
2. Enzyme activity increases until an optimum temperature is reached.
3. Above the optimum, bonds in the enzyme break and the enzyme becomes denatured.
4. Denaturation changes the shape of the active site.
      `.trim(),

      answer:
        "Increasing temperature gives particles more kinetic energy, causing more successful collisions. Enzyme activity rises until it reaches an optimum temperature. Above the optimum, bonds in the enzyme break and the enzyme becomes denatured. This changes the shape of the active site."
    }
  },

  {
    id: "enzyme-temperature-misconception",
    title: "Enzyme temperature — misconception",
    expectedScore: 1,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain the effect of increasing temperature on enzyme activity.",

      markScheme: `
Award one mark for each point:
1. Increasing temperature gives particles more kinetic energy.
2. Enzyme activity increases until an optimum temperature is reached.
3. Above the optimum, the enzyme becomes denatured.
4. Denaturation changes the shape of the active site.
      `.trim(),

      answer:
        "Higher temperature gives particles more kinetic energy. Enzymes continue working faster at every temperature because they never denature and their active sites never change."
    }
  },

  {
    id: "osmosis-plant-partial",
    title: "Osmosis into a plant cell",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain what happens when a plant cell is placed in a dilute solution.",

      markScheme: `
Award one mark for each point:
1. Water enters the cell by osmosis.
2. Water moves from a region of higher water potential to lower water potential.
3. Water passes through a partially permeable cell membrane.
4. The vacuole expands and the cell becomes turgid.
      `.trim(),

      answer:
        "Water enters the plant cell by osmosis through the partially permeable membrane. The vacuole becomes larger and the cell becomes turgid."
    }
  },

  {
    id: "osmosis-animal-synonyms",
    title: "Osmosis from an animal cell — synonyms",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain what happens when an animal cell is placed in a concentrated solution.",

      markScheme: `
Award one mark for each point:
1. Water leaves the cell by osmosis.
2. Water moves from higher water potential inside the cell to lower water potential outside.
3. Water passes through a partially permeable cell membrane.
4. The cell shrinks or becomes crenated.
      `.trim(),

      answer:
        "Water moves out of the cell by osmosis through its selectively permeable membrane, causing the cell to shrivel."
    }
  },

  {
    id: "diffusion-full",
    title: "Diffusion — full answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain diffusion.",

      markScheme: `
Award one mark for each point:
1. Particles move from a region of higher concentration to lower concentration.
2. Particles move randomly.
3. Diffusion does not require energy from respiration.
4. Net movement continues until equilibrium is reached.
      `.trim(),

      answer:
        "Particles move randomly from an area of higher concentration to an area of lower concentration. The process does not require energy from respiration, and net movement continues until equilibrium is reached."
    }
  },

  {
    id: "diffusion-process-only",
    title: "Diffusion — process named incompletely",
    expectedScore: 1,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 3,

      question:
        "Explain diffusion.",

      markScheme: `
Award one mark for each point:
1. Particles move from a region of higher concentration to lower concentration.
2. Particles move randomly without requiring metabolic energy.
3. Net movement continues until particles are evenly distributed.
      `.trim(),

      answer:
        "Diffusion continues until particles are evenly distributed."
    }
  },

  {
    id: "alveoli-partial",
    title: "Alveoli adaptations",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain how alveoli are adapted for efficient gas exchange.",

      markScheme: `
Award one mark for each point:
1. Alveoli provide a large surface area.
2. Their walls are one cell thick, giving a short diffusion distance.
3. They have a moist surface so gases can dissolve.
4. They have a rich blood supply.
5. Ventilation and blood flow maintain a steep concentration gradient.
      `.trim(),

      answer:
        "There are many alveoli, which creates a large surface area. Their walls are only one cell thick, and their surface is moist. They also have many capillaries supplying blood."
    }
  },

  {
    id: "villi-adaptations",
    title: "Small-intestine villi adaptations",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain how villi are adapted for absorption.",

      markScheme: `
Award one mark for each point:
1. Villi provide a large surface area.
2. The epithelium is one cell thick.
3. Villi have a rich blood supply.
4. Villi contain lacteals for absorbing lipids.
      `.trim(),

      answer:
        "The many villi create a large surface area. Their epithelium is one cell thick, and they contain many blood capillaries."
    }
  },

  {
    id: "photosynthesis-limiting-factors",
    title: "Photosynthesis limiting factors",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain factors that can limit the rate of photosynthesis.",

      markScheme: `
Award one mark for each point:
1. Low light intensity can limit photosynthesis.
2. Low carbon dioxide concentration can limit photosynthesis.
3. Temperature can limit the rate because photosynthesis is controlled by enzymes.
4. A limiting factor is the factor in shortest supply that restricts the rate.
      `.trim(),

      answer:
        "Photosynthesis may be limited by low light intensity, low carbon dioxide concentration, or an unsuitable temperature because enzymes control the reactions."
    }
  },

  {
    id: "aerobic-respiration-full",
    title: "Aerobic respiration — full answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Describe aerobic respiration.",

      markScheme: `
Award one mark for each point:
1. Glucose is broken down.
2. Oxygen is used.
3. Carbon dioxide and water are produced.
4. Energy is released.
      `.trim(),

      answer:
        "During aerobic respiration, glucose is broken down using oxygen. Carbon dioxide and water are produced, and energy is released."
    }
  },

  {
    id: "anaerobic-muscle-partial",
    title: "Anaerobic respiration in muscle",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Describe anaerobic respiration in human muscle cells.",

      markScheme: `
Award one mark for each point:
1. Glucose is broken down without oxygen.
2. Lactic acid is produced.
3. Less energy is released than in aerobic respiration.
4. Lactic acid contributes to oxygen debt after exercise.
      `.trim(),

      answer:
        "Glucose is broken down without oxygen, producing lactic acid. This releases less energy than aerobic respiration."
    }
  },

  {
    id: "mitosis-partial",
    title: "Mitosis — partial answer",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Describe mitosis.",

      markScheme: `
Award one mark for each point:
1. DNA is replicated before mitosis.
2. One cell division occurs.
3. Chromosomes are separated equally.
4. Two genetically identical diploid daughter cells are produced.
      `.trim(),

      answer:
        "The DNA is copied before one cell division. The chromosomes are separated equally, producing two genetically identical daughter cells."
    }
  },

  {
    id: "meiosis-partial",
    title: "Meiosis — partial answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Describe meiosis.",

      markScheme: `
Award one mark for each point:
1. Two cell divisions occur.
2. Four daughter cells are produced.
3. The daughter cells are haploid.
4. The daughter cells are genetically different.
5. Crossing over contributes to genetic variation.
      `.trim(),

      answer:
        "Meiosis involves two cell divisions and produces four haploid daughter cells. These daughter cells are genetically different."
    }
  },

  {
    id: "dna-base-pairing",
    title: "DNA complementary base pairing",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Describe complementary base pairing in DNA.",

      markScheme: `
Award one mark for each point:
1. Adenine pairs with thymine.
2. Cytosine pairs with guanine.
3. Hydrogen bonds hold complementary bases together.
4. The base sequence on one strand determines the sequence on the other strand.
      `.trim(),

      answer:
        "Adenine pairs with thymine, while cytosine pairs with guanine. Hydrogen bonds hold the paired bases together."
    }
  },

  {
    id: "protein-synthesis-six-mark",
    title: "Protein synthesis — six-mark response",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "A-Level",
      subject: "Biology",
      maxMarks: 6,

      question:
        "Describe how the information in a gene is used to produce a protein.",

      markScheme: `
Award one mark for each point:
1. A gene is transcribed to produce messenger RNA.
2. Messenger RNA leaves the nucleus.
3. Messenger RNA attaches to a ribosome.
4. Transfer RNA with a complementary anticodon brings an amino acid.
5. Amino acids are joined by peptide bonds.
6. The sequence of bases determines the sequence of amino acids.
      `.trim(),

      answer:
        "A gene is transcribed to form messenger RNA in the nucleus. The messenger RNA leaves the nucleus and attaches to a ribosome. Transfer RNA molecules with complementary anticodons bring amino acids to the ribosome."
    }
  },

  {
    id: "inheritance-key-terms-full",
    title: "Inheritance terminology — full answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain the terms allele, dominant, recessive, homozygous and heterozygous.",

      markScheme: `
Award one mark for each point:
1. An allele is an alternative form of a gene.
2. A dominant allele is expressed when one copy is present.
3. A recessive allele is expressed only when no dominant allele is present.
4. Homozygous means having two identical alleles, while heterozygous means having two different alleles.
      `.trim(),

      answer:
        "An allele is an alternative version of a gene. A dominant allele is expressed when only one copy is present. A recessive allele is expressed only when there is no dominant allele. Homozygous individuals have two identical alleles, whereas heterozygous individuals have two different alleles."
    }
  },

  {
    id: "negative-feedback-partial",
    title: "Negative feedback — partial answer",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "A-Level",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain how negative feedback maintains a stable internal environment.",

      markScheme: `
Award one mark for each point:
1. A receptor detects a change from the normal level.
2. Information is sent to a coordination centre.
3. The coordination centre activates an effector.
4. The effector produces a response that opposes the original change.
5. The variable returns towards its normal level or set point.
      `.trim(),

      answer:
        "A receptor detects a change and sends information to a coordination centre. The coordination centre activates an effector."
    }
  },

  {
    id: "active-transport-misconception",
    title: "Active transport — misconception",
    expectedScore: 2,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain active transport.",

      markScheme: `
Award one mark for each point:
1. Substances move from lower concentration to higher concentration.
2. Movement occurs against the concentration gradient.
3. Carrier proteins in the cell membrane are involved.
4. Energy from respiration or ATP is required.
      `.trim(),

      answer:
        "Active transport moves substances from a low concentration to a high concentration. It is a type of diffusion, does not need carrier proteins, and uses no energy."
    }
  },

  {
    id: "no-knowledge-answer",
    title: "No usable biological knowledge",
    expectedScore: 0,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 3,

      question:
        "Explain how enzymes increase the rate of reactions.",

      markScheme: `
Award one mark for each point:
1. Enzymes are biological catalysts.
2. Enzymes lower activation energy.
3. Enzymes are not used up in the reaction.
      `.trim(),

      answer:
        "I do not know the answer to this question."
    }
  }
];


/* ---------------------------------
   Command-Line Range Selection
---------------------------------- */

function readIntegerArgument(name) {
  const prefix = `--${name}=`;

  const argument = process.argv
    .slice(2)
    .find(item => item.startsWith(prefix));

  if (!argument) {
    return null;
  }

  const value = Number(
    argument.slice(prefix.length)
  );

  return Number.isInteger(value)
    ? value
    : null;
}

const requestedStart =
  readIntegerArgument("start");

const requestedEnd =
  readIntegerArgument("end");

const startCase =
  requestedStart !== null
    ? Math.max(
        1,
        Math.min(
          benchmarkCases.length,
          requestedStart
        )
      )
    : 1;

const endCase =
  requestedEnd !== null
    ? Math.max(
        startCase,
        Math.min(
          benchmarkCases.length,
          requestedEnd
        )
      )
    : benchmarkCases.length;

const selectedCases =
  benchmarkCases.slice(
    startCase - 1,
    endCase
  );


/* ---------------------------------
   API Test Runner
---------------------------------- */

async function analyzeCase(
  testCase,
  caseNumber
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 600000);

  try {
    const response = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        signal: controller.signal,

        body: JSON.stringify(
          testCase.request
        )
      }
    );

    const responseText =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}: ${responseText}`
      );
    }

    const report =
      JSON.parse(responseText);

    const actualScore =
      Number(report.scoreAchieved);

    if (
      !Number.isInteger(actualScore)
    ) {
      throw new Error(
        "The backend did not return a valid integer score."
      );
    }

    const difference =
      actualScore -
      testCase.expectedScore;

    return {
      caseNumber,
      id: testCase.id,
      title: testCase.title,

      expectedScore:
        testCase.expectedScore,

      actualScore,

      maximumMarks:
        testCase.request.maxMarks,

      passed:
        difference === 0,

      withinOneMark:
        Math.abs(difference) <= 1,

      difference,

      examinerComment:
        report.examinerComment ?? "",

      markAllocation:
        report.markAllocation ?? []
    };

  } finally {
    clearTimeout(timeout);
  }
}


/* ---------------------------------
   Statistics
---------------------------------- */

function roundNumber(value, decimals = 2) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(value * multiplier) /
    multiplier
  );
}

function calculateSummary(results) {
  const completedResults =
    results.filter(
      result =>
        Number.isInteger(
          result.actualScore
        )
    );

  const totalCases =
    results.length;

  const completedCases =
    completedResults.length;

  const passedCases =
    completedResults.filter(
      result => result.passed
    ).length;

  const withinOneMarkCases =
    completedResults.filter(
      result =>
        result.withinOneMark
    ).length;

  const overmarkedCases =
    completedResults.filter(
      result =>
        result.difference > 0
    ).length;

  const undermarkedCases =
    completedResults.filter(
      result =>
        result.difference < 0
    ).length;

  const totalAbsoluteError =
    completedResults.reduce(
      (total, result) =>
        total +
        Math.abs(result.difference),
      0
    );

  const meanAbsoluteError =
    completedCases > 0
      ? totalAbsoluteError /
        completedCases
      : 0;

  return {
    totalCases,
    completedCases,

    passedCases,

    failedCases:
      totalCases - passedCases,

    exactScoreAccuracy:
      completedCases > 0
        ? Math.round(
            (passedCases /
              completedCases) *
              100
          )
        : 0,

    withinOneMarkCases,

    withinOneMarkAccuracy:
      completedCases > 0
        ? Math.round(
            (withinOneMarkCases /
              completedCases) *
              100
          )
        : 0,

    meanAbsoluteError:
      roundNumber(
        meanAbsoluteError,
        2
      ),

    overmarkedCases,
    undermarkedCases,

    errorCases:
      results.filter(
        result => result.error
      ).length
  };
}


/* ---------------------------------
   Main Benchmark
---------------------------------- */

async function runBenchmark() {
  console.log("");
  console.log(
    "Noven Examiner Accuracy Benchmark"
  );

  console.log(
    "================================="
  );

  console.log(
    `Cases selected: ${startCase}-${endCase} of ${benchmarkCases.length}`
  );

  console.log("");

  const results = [];

  for (
    let index = 0;
    index < selectedCases.length;
    index += 1
  ) {
    const testCase =
      selectedCases[index];

    const absoluteCaseNumber =
      startCase + index;

    console.log(
      `[${absoluteCaseNumber}/${benchmarkCases.length}] Testing: ${testCase.title}`
    );

    try {
      const result =
        await analyzeCase(
          testCase,
          absoluteCaseNumber
        );

      results.push(result);

      const status =
        result.passed
          ? "PASS"
          : "FAIL";

      console.log(
        `${status} — Expected ${result.expectedScore}/${result.maximumMarks}, received ${result.actualScore}/${result.maximumMarks}`
      );

      if (!result.passed) {
        const direction =
          result.difference > 0
            ? "overmarked"
            : "undermarked";

        console.log(
          `Difference: ${Math.abs(result.difference)} mark(s) ${direction}`
        );
      }

    } catch (error) {
      console.error(
        `ERROR — ${error.message}`
      );

      results.push({
        caseNumber:
          absoluteCaseNumber,

        id: testCase.id,
        title: testCase.title,

        expectedScore:
          testCase.expectedScore,

        actualScore: null,

        maximumMarks:
          testCase.request.maxMarks,

        passed: false,
        withinOneMark: false,

        difference: null,
        error: error.message
      });
    }

    console.log("");
  }

  const statistics =
    calculateSummary(results);

  const summary = {
    generatedAt:
      new Date().toISOString(),

    model:
      "qwen3:1.7b",

    range: {
      start: startCase,
      end: endCase,

      availableCases:
        benchmarkCases.length
    },

    ...statistics,

    results
  };

  console.log("Benchmark Summary");
  console.log("-----------------");

  console.log(
    `Exact-score accuracy: ${statistics.exactScoreAccuracy}%`
  );

  console.log(
    `Passed: ${statistics.passedCases}/${statistics.completedCases}`
  );

  console.log(
    `Within-one-mark accuracy: ${statistics.withinOneMarkAccuracy}%`
  );

  console.log(
    `Mean absolute error: ${statistics.meanAbsoluteError}`
  );

  console.log(
    `Overmarked: ${statistics.overmarkedCases}`
  );

  console.log(
    `Undermarked: ${statistics.undermarkedCases}`
  );

  if (
    statistics.errorCases > 0
  ) {
    console.log(
      `Errors: ${statistics.errorCases}`
    );
  }

  const rangeFileName =
    `benchmark-results-${startCase}-${endCase}.json`;

  const output =
    JSON.stringify(
      summary,
      null,
      2
    );

  await writeFile(
    "benchmark-results.json",
    output,
    "utf8"
  );

  await writeFile(
    rangeFileName,
    output,
    "utf8"
  );

  console.log("");
  console.log(
    "Latest results saved to benchmark-results.json"
  );

  console.log(
    `Range results saved to ${rangeFileName}`
  );
}

runBenchmark().catch(error => {
  console.error(
    "Benchmark failed:",
    error
  );

  process.exitCode = 1;
});