import { writeFile } from "node:fs/promises";

const API_URL = "http://localhost:3001/analyze";

/*
  These are synthetic calibration cases, not official Edexcel
  questions or mark schemes.

  Later, replace or expand them using verified questions,
  examiner decisions, and mark schemes that you are permitted
  to use.
*/

const benchmarkCases = [
  {
    id: "enzyme-specificity-01",
    title: "Enzyme specificity",
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
    id: "osmosis-01",
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
        "Water enters the plant cell by osmosis through the partially permeable membrane. The vacuole gets larger and the cell becomes turgid."
    }
  },

  {
    id: "gas-exchange-01",
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
  }
];

async function analyzeCase(testCase) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 240000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      signal: controller.signal,

      body: JSON.stringify(testCase.request)
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}: ${responseText}`
      );
    }

    const report = JSON.parse(responseText);
    const actualScore = Number(report.scoreAchieved);

    if (!Number.isInteger(actualScore)) {
      throw new Error(
        "The backend did not return a valid integer score."
      );
    }

    const passed =
      actualScore === testCase.expectedScore;

    return {
      id: testCase.id,
      title: testCase.title,
      expectedScore: testCase.expectedScore,
      actualScore,
      maximumMarks: testCase.request.maxMarks,
      passed,
      difference:
        actualScore - testCase.expectedScore,
      examinerComment:
        report.examinerComment ?? "",
      markAllocation:
        report.markAllocation ?? []
    };

  } finally {
    clearTimeout(timeout);
  }
}

async function runBenchmark() {
  console.log("");
  console.log("Noven Examiner Accuracy Benchmark");
  console.log("=================================");
  console.log("");

  const results = [];

  for (const testCase of benchmarkCases) {
    console.log(`Testing: ${testCase.title}`);

    try {
      const result =
        await analyzeCase(testCase);

      results.push(result);

      const status =
        result.passed ? "PASS" : "FAIL";

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
        id: testCase.id,
        title: testCase.title,
        expectedScore:
          testCase.expectedScore,
        actualScore: null,
        maximumMarks:
          testCase.request.maxMarks,
        passed: false,
        error: error.message
      });
    }

    console.log("");
  }

  const passedCases =
    results.filter(result => result.passed).length;

  const totalCases = results.length;

  const accuracy =
    totalCases > 0
      ? Math.round(
          (passedCases / totalCases) * 100
        )
      : 0;

  const summary = {
    generatedAt:
      new Date().toISOString(),

    model:
      "qwen3:1.7b",

    totalCases,
    passedCases,
    failedCases:
      totalCases - passedCases,

    exactScoreAccuracy:
      accuracy,

    results
  };

  console.log("Benchmark Summary");
  console.log("-----------------");
  console.log(
    `Exact score accuracy: ${accuracy}%`
  );
  console.log(
    `Passed: ${passedCases}/${totalCases}`
  );

  await writeFile(
    "benchmark-results.json",
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.log("");
  console.log(
    "Detailed results saved to benchmark-results.json"
  );
}

runBenchmark().catch(error => {
  console.error(
    "Benchmark failed:",
    error
  );

  process.exitCode = 1;
});