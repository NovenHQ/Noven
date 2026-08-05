import "./style.css";
import Hero from "./components/Hero";

document.querySelector("#app").innerHTML = `
  ${Hero()}

  <section class="product">
    <h2>Exam Context</h2>

    <p class="subtitle">
      Provide the exam details and official mark scheme before submitting
      the student answer.
    </p>

    <div class="context-panel">

      <label>
        Exam Board
        <select id="examBoard">
          <option>Edexcel</option>
          <option>Cambridge</option>
          <option>AQA</option>
          <option>OCR</option>
        </select>
      </label>

      <label>
        Qualification
        <select id="qualification">
          <option>IGCSE</option>
          <option>A-Level</option>
        </select>
      </label>

      <label>
        Subject
        <select id="subject">
          <option>Biology</option>
        </select>
      </label>

      <label>
        Maximum Marks
        <input
          id="maxMarks"
          type="number"
          min="1"
          max="100"
          inputmode="numeric"
          placeholder="For example: 6"
        />
      </label>

      <label>
        Exam Question
        <textarea
          id="question"
          placeholder="Paste the exam question here..."
        ></textarea>
      </label>

      <label>
        Official Mark Scheme
        <textarea
          id="markScheme"
          class="mark-scheme-input"
          placeholder="Paste the official marking points here..."
        ></textarea>
      </label>

      <label>
        Student Answer
        <textarea
          id="answer"
          placeholder="Paste the student's Biology answer here..."
        ></textarea>
      </label>

      <button id="analyze">
        Analyze Answer
      </button>

      <div id="result" class="feedback"></div>

    </div>
  </section>
`;

const button = document.querySelector("#analyze");
const result = document.querySelector("#result");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<li>No feedback was returned.</li>";
  }

  return items
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

button.addEventListener("click", async () => {
  const board = document.querySelector("#examBoard").value;
  const qualification =
    document.querySelector("#qualification").value;
  const subject = document.querySelector("#subject").value;

  const maxMarksInput =
    document.querySelector("#maxMarks").value;

  const question =
    document.querySelector("#question").value.trim();

  const markScheme =
    document.querySelector("#markScheme").value.trim();

  const answer =
    document.querySelector("#answer").value.trim();

  const maxMarks = Number(maxMarksInput);

  if (!Number.isInteger(maxMarks) || maxMarks < 1) {
    result.textContent =
      "Please enter a valid maximum mark value.";
    return;
  }

  if (!question) {
    result.textContent =
      "Please enter the exam question.";
    return;
  }

  if (!markScheme) {
    result.textContent =
      "Please paste the official mark scheme.";
    return;
  }

  if (!answer) {
    result.textContent =
      "Please enter the student answer.";
    return;
  }

  button.disabled = true;
  button.textContent = "Analyzing...";
  result.textContent = "Analyzing the answer...";

  try {
    const response = await fetch(
      "http://localhost:3001/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          board,
          qualification,
          subject,
          maxMarks,
          question,
          markScheme,
          answer
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server returned status ${response.status}`
      );
    }

    const data = await response.json();

    const achievedMarks =
      Number(data.scoreAchieved) || 0;

    const totalMarks =
      Number(data.scoreTotal) || maxMarks;

    const percentage =
      totalMarks > 0
        ? Math.round(
            (achievedMarks / totalMarks) * 100
          )
        : 0;

    const safePercentage = Math.min(
      100,
      Math.max(0, percentage)
    );

    const markAllocation = Array.isArray(
      data.markAllocation
    )
      ? data.markAllocation
      : [];

    result.innerHTML = `
      <h3 class="report-title">
        Examiner Report
      </h3>

      <div class="score-card">

        <div class="score-heading">
          <h4>Your Performance</h4>

          <span class="percentage-badge">
            ${safePercentage}%
          </span>
        </div>

        <div class="score">
          ${achievedMarks}/${totalMarks}
        </div>

        <p class="score-label">
          Marks Achieved
        </p>

        <div class="progress-information">
          <span>Progress</span>
          <span>${safePercentage}%</span>
        </div>

        <div
          class="progress-track"
          role="progressbar"
          aria-label="Marks achieved"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${safePercentage}"
        >
          <div
            id="performanceProgress"
            class="progress-fill"
          ></div>
        </div>

        <p class="progress-caption">
          You achieved ${achievedMarks} out of
          ${totalMarks} available marks.
        </p>

      </div>

      <div class="report-card">

        <h4>
          Mark Allocation
        </h4>

        <div class="mark-list">

          ${
            markAllocation.length > 0
              ? markAllocation
                  .map(item => {
                    const status =
                      String(item.status).toLowerCase() ===
                      "achieved"
                        ? "Achieved"
                        : "Missing";

                    const statusClass =
                      status.toLowerCase();

                    return `
                      <div class="mark-item ${statusClass}">

                        <strong>
                          ${escapeHtml(item.mark)}
                        </strong>

                        <p>
                          ${escapeHtml(item.point)}
                        </p>

                        <span>
                          ${status}
                        </span>

                      </div>
                    `;
                  })
                  .join("")
              : `
                <p>
                  No mark-allocation data was returned.
                </p>
              `
          }

        </div>

      </div>

      <div class="report-grid">

        <div class="report-card">

          <h4>
            ✓ Strengths
          </h4>

          <ul>
            ${renderList(data.strengths)}
          </ul>

        </div>

        <div class="report-card improvement-card">

          <h4>
            ⚠ Improvements
          </h4>

          <ul>
            ${renderList(data.improvements)}
          </ul>

        </div>

      </div>

      <div class="upgrade-section">

        <h3 class="upgrade-title">
          Full-Mark Upgrade
        </h3>

        <p class="upgrade-subtitle">
          See exactly what was missing and how to improve
          the answer.
        </p>

        <div class="upgrade-card missing-summary-card">

          <div class="upgrade-card-heading">
            <span class="upgrade-icon">1</span>

            <h4>
              Why Marks Were Lost
            </h4>
          </div>

          <p>
            ${escapeHtml(data.missingMarksSummary)}
          </p>

        </div>

        <div class="upgrade-card sentence-card">

          <div class="upgrade-card-heading">
            <span class="upgrade-icon">2</span>

            <h4>
              Sentence to Add
            </h4>
          </div>

          <p class="upgrade-answer">
            “${escapeHtml(data.upgradeSentence)}”
          </p>

        </div>

        <div class="upgrade-card full-mark-card">

          <div class="upgrade-card-heading">
            <span class="upgrade-icon">3</span>

            <h4>
              Full-Mark Model Answer
            </h4>
          </div>

          <p class="upgrade-answer">
            ${escapeHtml(data.fullMarkAnswer)}
          </p>

        </div>

      </div>

      <div class="report-card examiner-comment-card">

        <h4>
          Examiner Comment
        </h4>

        <p>
          ${escapeHtml(data.examinerComment)}
        </p>

      </div>
    `;

    const progressBar =
      document.querySelector(
        "#performanceProgress"
      );

    requestAnimationFrame(() => {
      progressBar.style.width =
        `${safePercentage}%`;
    });

  } catch (error) {
    result.textContent =
      "Unable to connect to Noven's examiner system.";

    console.error(error);

  } finally {
    button.disabled = false;
    button.textContent = "Analyze Answer";
  }
});