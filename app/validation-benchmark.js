const API_URL = "http://localhost:3001/analyze";

const validationCases = [
  {
    id: "reflex-arc-full",
    title: "Reflex arc — full answer",
    expectedScore: 5,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question: "Explain how a reflex action occurs.",
      markScheme: `
1. A receptor detects a stimulus.
2. An electrical impulse travels along a sensory neurone.
3. The impulse passes across a synapse to a relay neurone.
4. The impulse travels along a motor neurone to an effector.
5. The effector produces a rapid response without conscious control.
      `.trim(),
      answer:
        "A receptor detects the stimulus and an electrical impulse travels along a sensory neurone. The impulse crosses a synapse to a relay neurone and then travels along a motor neurone to an effector. The effector responds rapidly without conscious control."
    }
  },

  {
    id: "reflex-arc-partial",
    title: "Reflex arc — partial answer",
    expectedScore: 3,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question: "Explain how a reflex action occurs.",
      markScheme: `
1. A receptor detects a stimulus.
2. An electrical impulse travels along a sensory neurone.
3. The impulse passes across a synapse to a relay neurone.
4. The impulse travels along a motor neurone to an effector.
5. The effector produces a rapid response without conscious control.
      `.trim(),
      answer:
        "A receptor detects the stimulus. An impulse travels along a sensory neurone and crosses a synapse to a relay neurone."
    }
  },

  {
    id: "thermoregulation-hot",
    title: "Thermoregulation — hot conditions",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Explain how the body responds when its temperature becomes too high.",
      markScheme: `
1. Thermoreceptors detect an increase in body temperature.
2. The hypothalamus coordinates the response.
3. Sweat production increases.
4. Evaporation of sweat transfers thermal energy from the skin.
5. Vasodilation increases blood flow near the skin surface.
      `.trim(),
      answer:
        "Temperature receptors detect that body temperature has risen. The hypothalamus coordinates the response. More sweat is produced and its evaporation removes heat from the skin."
    }
  },

  {
    id: "thermoregulation-misconception",
    title: "Thermoregulation — misconception",
    expectedScore: 2,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Explain how the body responds when its temperature becomes too high.",
      markScheme: `
1. Thermoreceptors detect an increase in body temperature.
2. The hypothalamus coordinates the response.
3. Sweat production increases.
4. Evaporation of sweat transfers thermal energy from the skin.
5. Vasodilation increases blood flow near the skin surface.
      `.trim(),
      answer:
        "Receptors detect that the body is too hot and the hypothalamus coordinates the response. Sweating decreases and blood vessels near the skin constrict."
    }
  },

  {
    id: "adh-water-balance",
    title: "ADH and water balance",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Explain how ADH helps conserve water when the blood contains too little water.",
      markScheme: `
1. A low water content of the blood is detected.
2. More ADH is released from the pituitary gland.
3. ADH increases the permeability of the kidney collecting ducts to water.
4. More water is reabsorbed into the blood.
5. A smaller volume of more concentrated urine is produced.
      `.trim(),
      answer:
        "A low water level in the blood is detected and more ADH is released from the pituitary gland. ADH makes the collecting ducts more permeable to water, so more water is reabsorbed into the blood."
    }
  },

  {
    id: "menstrual-cycle-hormones",
    title: "Menstrual cycle hormones",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Describe the roles of hormones in controlling the menstrual cycle.",
      markScheme: `
1. FSH stimulates maturation of an egg in an ovary.
2. FSH stimulates oestrogen production.
3. Oestrogen stimulates repair or thickening of the uterus lining.
4. LH causes ovulation.
5. Progesterone maintains the uterus lining.
      `.trim(),
      answer:
        "FSH causes an egg to mature and stimulates oestrogen production. Oestrogen causes the uterus lining to thicken. A rise in LH causes ovulation."
    }
  },

  {
    id: "plant-phototropism",
    title: "Plant phototropism",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question: "Explain how a plant shoot grows towards light.",
      markScheme: `
1. Auxin is produced in the shoot tip.
2. Auxin moves to or accumulates on the shaded side of the shoot.
3. Auxin stimulates cell elongation in shoots.
4. Cells on the shaded side elongate more than cells on the illuminated side.
5. Unequal growth causes the shoot to bend towards the light.
      `.trim(),
      answer:
        "Auxin is made in the shoot tip and accumulates on the shaded side. It stimulates cells there to elongate more than cells on the lit side, causing unequal growth."
    }
  },

  {
    id: "plant-phototropism-misconception",
    title: "Plant phototropism — misconception",
    expectedScore: 2,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question: "Explain how a plant shoot grows towards light.",
      markScheme: `
1. Auxin is produced in the shoot tip.
2. Auxin moves to or accumulates on the shaded side of the shoot.
3. Auxin stimulates cell elongation in shoots.
4. Cells on the shaded side elongate more than cells on the illuminated side.
5. Unequal growth causes the shoot to bend towards the light.
      `.trim(),
      answer:
        "Auxin is produced at the shoot tip. It builds up on the shaded side, but it stops cells there from elongating so the shaded side grows more slowly."
    }
  },

  {
    id: "fish-gas-exchange",
    title: "Fish gill gas exchange",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Explain how fish gills are adapted for efficient gas exchange.",
      markScheme: `
1. Gill filaments provide a large surface area.
2. Lamellae further increase the surface area.
3. The exchange surface is thin, giving a short diffusion distance.
4. A good blood supply maintains concentration gradients.
5. Counter-current flow maintains a concentration gradient along the gill.
      `.trim(),
      answer:
        "Gill filaments and many lamellae give a very large surface area. The exchange surface is thin, giving a short diffusion distance, and a strong blood supply maintains the concentration gradient."
    }
  },

  {
    id: "blood-clotting",
    title: "Blood clotting",
    expectedScore: 3,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,
      question: "Explain how a blood clot forms after a blood vessel is damaged.",
      markScheme: `
1. Platelets become activated at the damaged area.
2. A series of reactions converts soluble fibrinogen into insoluble fibrin.
3. Fibrin forms a mesh across the wound.
4. Blood cells become trapped in the fibrin mesh to form a clot.
      `.trim(),
      answer:
        "Platelets become activated at the damaged area. Fibrinogen is converted into insoluble fibrin, which forms a mesh across the wound."
    }
  },

  {
    id: "coronary-heart-disease",
    title: "Coronary heart disease",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Explain how narrowing of a coronary artery can damage heart muscle.",
      markScheme: `
1. Fatty deposits or plaques narrow the coronary artery.
2. Less blood flows to the heart muscle.
3. Less oxygen reaches heart muscle cells.
4. Aerobic respiration decreases.
5. Less energy is released for contraction and cells may die.
      `.trim(),
      answer:
        "Fatty deposits narrow the coronary arteries, reducing blood flow to the heart muscle. Less oxygen reaches the cells, so aerobic respiration decreases and less energy is released."
    }
  },

  {
    id: "pathogen-antibiotics",
    title: "Antibiotics and pathogens",
    expectedScore: 3,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,
      question:
        "Explain why antibiotics can treat some infections but not viral infections.",
      markScheme: `
1. Antibiotics act against bacteria.
2. Antibiotics may target bacterial structures or processes.
3. Viruses reproduce inside host cells.
4. Viruses do not have the bacterial structures or processes targeted by antibiotics.
      `.trim(),
      answer:
        "Antibiotics work against bacteria by interfering with bacterial structures or processes. Viruses reproduce inside host cells, so antibiotics cannot kill them in the same way."
    }
  },

  {
    id: "food-test-starch",
    title: "Food test for starch",
    expectedScore: 3,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 3,
      question:
        "Describe how to test a food sample for starch and state the positive result.",
      markScheme: `
1. Add iodine solution to the food sample.
2. A positive result changes from orange-brown to blue-black.
3. A blue-black colour indicates that starch is present.
      `.trim(),
      answer:
        "Add iodine solution to the food. If starch is present, the iodine changes from orange-brown to blue-black."
    }
  },

  {
    id: "microscopy-resolution",
    title: "Microscopy — magnification and resolution",
    expectedScore: 3,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,
      question:
        "Explain the difference between magnification and resolution in microscopy.",
      markScheme: `
1. Magnification is how many times larger the image is than the real object.
2. Resolution is the ability to distinguish two close points as separate.
3. Higher resolution allows more detail to be seen.
4. Increasing magnification alone does not necessarily increase resolution.
      `.trim(),
      answer:
        "Magnification describes how many times larger the image is than the real specimen. Resolution is the ability to distinguish two nearby points separately, so higher resolution reveals more detail."
    }
  },

  {
    id: "eutrophication",
    title: "Eutrophication",
    expectedScore: 5,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 6,
      question:
        "Explain how fertiliser entering a lake can lead to the death of aquatic animals.",
      markScheme: `
1. Fertiliser increases nitrate or mineral ion concentration in the water.
2. Algae grow rapidly, producing an algal bloom.
3. The algal bloom blocks light reaching plants below.
4. Aquatic plants die.
5. Decomposers respire while breaking down dead material and use oxygen.
6. Dissolved oxygen concentration falls, causing aquatic animals to die.
      `.trim(),
      answer:
        "Fertiliser adds nitrate ions to the water and causes rapid algal growth. The algal bloom blocks light, so plants underneath die. Decomposers break down the dead material and use oxygen in respiration, lowering the oxygen concentration."
    }
  },

  {
    id: "nitrogen-cycle",
    title: "Nitrogen cycle",
    expectedScore: 4,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question:
        "Describe processes that recycle nitrogen compounds in an ecosystem.",
      markScheme: `
1. Decomposers break down dead organisms and waste.
2. Ammonium compounds are produced during decomposition.
3. Nitrifying bacteria convert ammonium compounds into nitrates.
4. Plants absorb nitrate ions through their roots.
5. Denitrifying bacteria convert nitrates into nitrogen gas.
      `.trim(),
      answer:
        "Decomposers break down dead organisms and waste, producing ammonium compounds. Nitrifying bacteria convert these compounds into nitrates, which plants absorb through their roots."
    }
  },

  {
    id: "selective-breeding",
    title: "Selective breeding",
    expectedScore: 5,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 5,
      question: "Explain how selective breeding is carried out.",
      markScheme: `
1. Individuals with a desired characteristic are selected.
2. Selected individuals are bred together.
3. Offspring showing the desired characteristic are selected.
4. Selected offspring are bred together.
5. The process is repeated over many generations.
      `.trim(),
      answer:
        "Organisms with the desired characteristic are selected and bred together. Offspring showing the characteristic are then selected and bred, and this is repeated for many generations."
    }
  },

  {
    id: "natural-selection",
    title: "Natural selection",
    expectedScore: 6,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 6,
      question: "Explain how natural selection can change a population.",
      markScheme: `
1. Individuals in a population show genetic variation.
2. Some variants provide a survival or reproductive advantage.
3. Individuals with advantageous variants are more likely to survive.
4. These individuals are more likely to reproduce.
5. Advantageous alleles are passed to offspring.
6. The frequency of advantageous alleles increases over generations.
      `.trim(),
      answer:
        "There is genetic variation within a population. Some variants give an advantage, so those individuals are more likely to survive and reproduce. They pass the advantageous alleles to their offspring, making those alleles more common over generations."
    }
  },

  {
    id: "cloning-cuttings",
    title: "Plant cloning using cuttings",
    expectedScore: 3,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,
      question:
        "Explain how taking cuttings can be used to produce genetically identical plants.",
      markScheme: `
1. A piece of a parent plant is removed.
2. The cutting is encouraged to form roots and grow.
3. New cells are produced by mitosis.
4. The new plant is genetically identical to the parent plant.
      `.trim(),
      answer:
        "A piece is cut from the parent plant and encouraged to develop roots and grow. Its new cells are produced by mitosis."
    }
  },

  {
    id: "irrelevant-knowledge",
    title: "Irrelevant biological knowledge",
    expectedScore: 0,
    request: {
      board: "Edexcel",
      qualification: "IGCSE",
      subject: "Biology",
      maxMarks: 4,
      question: "Explain how selective breeding is carried out.",
      markScheme: `
1. Individuals with a desired characteristic are selected.
2. Selected individuals are bred together.
3. Offspring showing the desired characteristic are selected.
4. The process is repeated over many generations.
      `.trim(),
      answer:
        "Mitochondria are the site of aerobic respiration and ribosomes are involved in protein synthesis."
    }
  }
];

function parseRange() {
  const first = Number(process.argv[2]);
  const second = Number(process.argv[3]);

  if (!Number.isInteger(first)) {
    return {
      start: 1,
      end: validationCases.length
    };
  }

  if (!Number.isInteger(second)) {
    return {
      start: first,
      end: first
    };
  }

  return {
    start: first,
    end: second
  };
}

function clampRange(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

async function analyzeCase(testCase) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 420000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify(testCase.request)
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `Backend returned ${response.status}: ${text}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function calculateSummary(results) {
  const completed = results.filter(result => !result.error);
  const errors = results.filter(result => result.error);

  const passed = completed.filter(result => result.passed).length;

  const withinOne = completed.filter(
    result => Math.abs(result.difference) <= 1
  ).length;

  const absoluteError = completed.reduce(
    (sum, result) => sum + Math.abs(result.difference),
    0
  );

  const overmarked = completed.filter(
    result => result.difference > 0
  ).length;

  const undermarked = completed.filter(
    result => result.difference < 0
  ).length;

  return {
    completed: completed.length,
    errors: errors.length,
    passed,
    exactAccuracy:
      completed.length > 0
        ? Math.round((passed / completed.length) * 100)
        : 0,
    withinOneAccuracy:
      completed.length > 0
        ? Math.round((withinOne / completed.length) * 100)
        : 0,
    meanAbsoluteError:
      completed.length > 0
        ? Number((absoluteError / completed.length).toFixed(2))
        : 0,
    overmarked,
    undermarked
  };
}

async function main() {
  const { start, end } = parseRange();

  const safeStart = clampRange(
    Math.min(start, end),
    1,
    validationCases.length
  );

  const safeEnd = clampRange(
    Math.max(start, end),
    1,
    validationCases.length
  );

  const selectedCases = validationCases.slice(
    safeStart - 1,
    safeEnd
  );

  console.log("");
  console.log("Noven Untouched Validation Benchmark");
  console.log("====================================");
  console.log(
    `Cases selected: ${safeStart}-${safeEnd} of ${validationCases.length}`
  );
  console.log("");

  const results = [];

  for (let index = 0; index < selectedCases.length; index++) {
    const testCase = selectedCases[index];

    const caseNumber = safeStart + index;

    console.log(
      `[${index + 1}/${selectedCases.length}] Testing: ${testCase.title}`
    );

    try {
      const response = await analyzeCase(testCase);

      const actualScore = Number(response.scoreAchieved);

      if (!Number.isFinite(actualScore)) {
        throw new Error(
          "Backend response did not contain a valid scoreAchieved."
        );
      }

      const difference =
        actualScore - testCase.expectedScore;

      const passed = difference === 0;

      if (passed) {
        console.log(
          `PASS — Expected ${testCase.expectedScore}/${testCase.request.maxMarks}, received ${actualScore}/${testCase.request.maxMarks}`
        );
      } else {
        const direction =
          difference > 0 ? "overmarked" : "undermarked";

        console.log(
          `FAIL — Expected ${testCase.expectedScore}/${testCase.request.maxMarks}, received ${actualScore}/${testCase.request.maxMarks}`
        );

        console.log(
          `Difference: ${Math.abs(difference)} mark(s) ${direction}`
        );
      }

      results.push({
        caseNumber,
        id: testCase.id,
        title: testCase.title,
        expectedScore: testCase.expectedScore,
        actualScore,
        maxMarks: testCase.request.maxMarks,
        difference,
        passed,
        markAllocation: response.markAllocation ?? [],
        response
      });
    } catch (error) {
      console.log(
        `ERROR — ${error?.message ?? String(error)}`
      );

      results.push({
        caseNumber,
        id: testCase.id,
        title: testCase.title,
        expectedScore: testCase.expectedScore,
        maxMarks: testCase.request.maxMarks,
        error: error?.message ?? String(error)
      });
    }

    console.log("");
  }

  const summary = calculateSummary(results);

  console.log("Validation Summary");
  console.log("------------------");

  if (summary.completed > 0) {
    console.log(
      `Exact-score accuracy: ${summary.exactAccuracy}%`
    );
    console.log(
      `Passed: ${summary.passed}/${summary.completed}`
    );
    console.log(
      `Within-one-mark accuracy: ${summary.withinOneAccuracy}%`
    );
    console.log(
      `Mean absolute error: ${summary.meanAbsoluteError}`
    );
    console.log(
      `Overmarked: ${summary.overmarked}`
    );
    console.log(
      `Undermarked: ${summary.undermarked}`
    );
  }

  if (summary.errors > 0) {
    console.log(`Errors: ${summary.errors}`);
  }

  const fs = await import("node:fs/promises");

  const output = {
    benchmark: "untouched-validation-v1",
    frozenExpectedScores: true,
    generatedAt: new Date().toISOString(),
    range: {
      start: safeStart,
      end: safeEnd
    },
    summary,
    results
  };

  await fs.writeFile(
    "benchmark-results-validation.json",
    JSON.stringify(output, null, 2)
  );

  await fs.writeFile(
    `benchmark-results-validation-${safeStart}-${safeEnd}.json`,
    JSON.stringify(output, null, 2)
  );

  console.log("");
  console.log(
    "Latest validation results saved to benchmark-results-validation.json"
  );

  console.log(
    `Range results saved to benchmark-results-validation-${safeStart}-${safeEnd}.json`
  );
}

main().catch(error => {
  console.error("");
  console.error("Validation benchmark failed:");
  console.error(error);
  process.exitCode = 1;
});