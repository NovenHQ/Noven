import { writeFile } from "node:fs/promises";

const API_URL = "http://localhost:3001/analyze";

/*
  NOVEN UNSEEN HOLDOUT BENCHMARK

  These synthetic cases were not used to develop the current
  examiner logic.

  Important testing rule:

  Run the entire holdout set before changing server.js.
  Do not optimize the examiner after individual failures.

  Run every case:

    node holdout-benchmark.js

  Optional range commands:

    node holdout-benchmark.js --start=1 --end=4
    node holdout-benchmark.js --start=5 --end=8
    node holdout-benchmark.js --start=9 --end=12
*/

const holdoutCases = [
  {
    id: "kidney-ultrafiltration-partial",
    title: "Kidney ultrafiltration — partial answer",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain how ultrafiltration occurs in the kidney.",

      markScheme: `
Award one mark for each point:
1. High pressure in the glomerulus forces small molecules out of the blood.
2. The filtrate enters Bowman's capsule.
3. Large proteins remain in the blood.
4. Blood cells remain in the blood.
      `.trim(),

      answer:
        "High pressure in the glomerulus forces small molecules out of the blood and into Bowman's capsule. Large proteins remain in the blood."
    }
  },

  {
    id: "blood-glucose-misconception",
    title: "Blood glucose regulation — misconception",
    expectedScore: 2,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain how the body responds when blood glucose concentration becomes too high.",

      markScheme: `
Award one mark for each point:
1. The increase in blood glucose is detected by the pancreas.
2. Beta cells in the pancreas release insulin.
3. Body cells take up more glucose from the blood.
4. The liver converts glucose into glycogen.
5. Blood glucose concentration returns towards its normal level.
      `.trim(),

      answer:
        "The rise in blood glucose is detected by the pancreas. Beta cells release insulin. Insulin causes the liver to convert glycogen into glucose, so the blood glucose concentration rises further."
    }
  },

  {
    id: "transpiration-stream-full",
    title: "Transpiration stream — full answer",
    expectedScore: 5,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain how transpiration causes water to move through a plant.",

      markScheme: `
Award one mark for each point:
1. Water evaporates from the surfaces of mesophyll cells.
2. Water vapour diffuses out through the stomata.
3. Water loss lowers the water potential of leaf cells.
4. Water is drawn from the xylem into the leaf cells.
5. Cohesion between water molecules maintains a continuous water column in the xylem.
      `.trim(),

      answer:
        "Water evaporates from the surfaces of mesophyll cells and water vapour diffuses out through the stomata. This lowers the water potential of the leaf cells, so water is drawn from the xylem into them. Cohesion between water molecules maintains a continuous column of water in the xylem."
    }
  },

  {
    id: "heart-valves-partial",
    title: "Heart valves — partial answer",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain how valves help the heart function.",

      markScheme: `
Award one mark for each point:
1. Atrioventricular valves prevent blood flowing back into the atria.
2. Semilunar valves prevent blood flowing back into the ventricles.
3. Pressure differences cause the valves to open and close.
4. Tendinous cords prevent the atrioventricular valves from turning inside out.
      `.trim(),

      answer:
        "Atrioventricular valves prevent blood from flowing back into the atria. Semilunar valves prevent blood from returning to the ventricles. The valves open and close because of pressure differences."
    }
  },

  {
    id: "vaccination-partial",
    title: "Vaccination — partial answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain how vaccination can protect a person from a disease.",

      markScheme: `
Award one mark for each point:
1. A vaccine introduces antigens from a pathogen.
2. The antigens stimulate specific lymphocytes.
3. The lymphocytes produce specific antibodies.
4. Memory cells are formed.
5. Memory cells produce a faster secondary immune response after later exposure.
      `.trim(),

      answer:
        "A vaccine introduces harmless antigens from a pathogen. These antigens stimulate specific lymphocytes to produce specific antibodies. Memory cells are also formed and remain in the body."
    }
  },

  {
    id: "antibiotic-resistance-misconception",
    title: "Antibiotic resistance — misconception",
    expectedScore: 2,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain how a population of bacteria can become resistant to an antibiotic.",

      markScheme: `
Award one mark for each point:
1. A random mutation produces resistance in some bacteria.
2. The antibiotic kills susceptible bacteria.
3. Resistant bacteria survive the antibiotic treatment.
4. Resistant bacteria reproduce and pass on the resistance allele.
5. The proportion of resistant bacteria increases over generations.
      `.trim(),

      answer:
        "Some bacteria already have a random mutation that makes them resistant. The antibiotic kills susceptible bacteria. The antibiotic creates the resistant bacteria, but the resistant bacteria do not reproduce."
    }
  },

  {
    id: "quadrat-sampling-full",
    title: "Random quadrat sampling — full answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Describe how quadrats can be used to estimate the abundance of a plant species.",

      markScheme: `
Award one mark for each point:
1. Random coordinates are generated within the study area.
2. A quadrat is placed at each selected coordinate.
3. The number of organisms inside each quadrat is counted.
4. Sampling is repeated and a mean is calculated to estimate abundance.
      `.trim(),

      answer:
        "Random coordinates are generated within the study area and a quadrat is placed at each coordinate. The plants inside every quadrat are counted. This is repeated many times and the mean count is used to estimate abundance."
    }
  },

  {
    id: "trophic-energy-loss-partial",
    title: "Energy loss between trophic levels",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,

      question:
        "Explain why less energy is available at each successive trophic level.",

      markScheme: `
Award one mark for each point:
1. Not all of an organism's biomass is eaten.
2. Some ingested material is egested or excreted.
3. Energy is released as heat during respiration.
4. Energy is used for movement.
5. Less biomass is available to the next trophic level.
      `.trim(),

      answer:
        "Not all parts of an organism are eaten. Some ingested material is lost in faeces or excretory products. Respiration also releases energy as heat."
    }
  },

  {
    id: "synaptic-transmission-partial",
    title: "Synaptic transmission — partial answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "A-Level",
      subject: "Biology",
      maxMarks: 6,

      question:
        "Describe how an impulse is transmitted across a cholinergic synapse.",

      markScheme: `
Award one mark for each point:
1. An action potential arrives at the presynaptic membrane.
2. Calcium ion channels open and calcium ions enter the presynaptic neurone.
3. Vesicles fuse with the presynaptic membrane and release neurotransmitter.
4. The neurotransmitter diffuses across the synaptic cleft.
5. The neurotransmitter binds to receptors on the postsynaptic membrane.
6. The postsynaptic membrane depolarises and a new impulse may be generated.
      `.trim(),

      answer:
        "An action potential arrives at the presynaptic membrane. Calcium ion channels open and calcium ions enter the presynaptic neurone. Vesicles fuse with the membrane and release neurotransmitter. The neurotransmitter then diffuses across the synaptic cleft."
    }
  },

  {
    id: "genetic-engineering-partial",
    title: "Genetic engineering — partial answer",
    expectedScore: 4,

    request: {
      board: "Edexcel",
      qualification: "A-Level",
      subject: "Biology",
      maxMarks: 6,

      question:
        "Describe how a human gene can be inserted into a bacterial plasmid.",

      markScheme: `
Award one mark for each point:
1. A restriction enzyme is used to cut out the required human gene.
2. The same restriction enzyme cuts open the plasmid.
3. The gene and plasmid have complementary sticky ends.
4. DNA ligase joins the gene to the plasmid.
5. The recombinant plasmid is inserted into a bacterium.
6. The bacteria reproduce and may produce the required human protein.
      `.trim(),

      answer:
        "A restriction enzyme cuts out the required human gene. The same restriction enzyme cuts open the plasmid, producing complementary sticky ends. DNA ligase joins the gene into the plasmid."
    }
  },

  {
    id: "xylem-adaptations-partial",
    title: "Xylem adaptations — partial answer",
    expectedScore: 3,

    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain how xylem vessels are adapted for transporting water.",

      markScheme: `
Award one mark for each point:
1. Xylem vessels are formed from dead cells and have a hollow lumen.
2. The cells have no end walls, forming a continuous tube.
3. Lignin strengthens the vessel walls and prevents collapse.
4. Pits allow sideways movement of water between vessels and surrounding cells.
      `.trim(),

      answer:
        "Xylem vessels consist of dead cells with a hollow lumen. There are no end walls, so they form a continuous tube. Lignin strengthens the walls and stops the vessel from collapsing."
    }
  },

  {
    id: "guard-cells-misconception",
    title: "Guard cells — misconception",
    expectedScore: 2,

    request: {
      board: "Edexcel",
      qualification: "A-Level",
      subject: "Biology",
      maxMarks: 4,

      question:
        "Explain how guard cells cause a stoma to open.",

      markScheme: `
Award one mark for each point:
1. Potassium ions enter the guard cells.
2. Water enters the guard cells by osmosis.
3. The guard cells become turgid and the stomatal pore opens.
4. The unevenly thickened guard-cell walls cause the cells to curve.
      `.trim(),

      answer:
        "Potassium ions enter the guard cells and water enters them by osmosis. The guard cells become flaccid, causing the stomatal pore to close."
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
          holdoutCases.length,
          requestedStart
        )
      )
    : 1;

const endCase =
  requestedEnd !== null
    ? Math.max(
        startCase,
        Math.min(
          holdoutCases.length,
          requestedEnd
        )
      )
    : holdoutCases.length;

const selectedCases =
  holdoutCases.slice(
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
   Main Holdout Benchmark
---------------------------------- */

async function runHoldoutBenchmark() {
  console.log("");
  console.log(
    "Noven Unseen Holdout Benchmark"
  );

  console.log(
    "=============================="
  );

  console.log(
    `Cases selected: ${startCase}-${endCase} of ${holdoutCases.length}`
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
      `[${absoluteCaseNumber}/${holdoutCases.length}] Testing: ${testCase.title}`
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

    suite:
      "unseen-holdout",

    model:
      "qwen3:1.7b",

    range: {
      start: startCase,
      end: endCase,

      availableCases:
        holdoutCases.length
    },

    ...statistics,

    results
  };

  console.log("Holdout Summary");
  console.log("---------------");

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
    `benchmark-results-holdout-${startCase}-${endCase}.json`;

  const output =
    JSON.stringify(
      summary,
      null,
      2
    );

  await writeFile(
    "benchmark-results-holdout.json",
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
    "Latest holdout results saved to benchmark-results-holdout.json"
  );

  console.log(
    `Range results saved to ${rangeFileName}`
  );
}

runHoldoutBenchmark().catch(error => {
  console.error(
    "Holdout benchmark failed:",
    error
  );

  process.exitCode = 1;
});