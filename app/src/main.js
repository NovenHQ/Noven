import "./style.css";
import Hero from "./components/Hero";

document.querySelector("#app").innerHTML = `
  ${Hero()}

  <section class="product">
    <h2>Exam Context</h2>

    <p class="subtitle">
      Tell Noven about the exam before submitting your answer.
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
        Exam Question
        <textarea
          id="question"
          placeholder="Paste the exam question here..."
        ></textarea>
      </label>

      <label>
        Your Answer
        <textarea
          id="answer"
          placeholder="Paste your Biology answer here..."
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


button.addEventListener("click", async () => {

  const answer = document.querySelector("#answer").value;


  if (!answer.trim()) {
    result.textContent = "Please enter your answer first.";
    return;
  }


  result.innerHTML = "Analyzing...";


  try {

    const response = await fetch("http://localhost:3001/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({

        board: document.querySelector("#examBoard").value,

        qualification: document.querySelector("#qualification").value,

        subject: document.querySelector("#subject").value,

        question: document.querySelector("#question").value,

        answer: answer

      })
    });


    const data = await response.json();



    result.innerHTML = `

      <h3 class="report-title">
        Examiner Report
      </h3>


      <div class="score-card">

        <h4>
          Score
        </h4>

        <div class="score">
          ${data.score}
        </div>

        <p>
          Marks Achieved
        </p>

      </div>



      <div class="report-card">

        <h4>
          Mark Allocation
        </h4>


        <div class="mark-list">

          ${data.markAllocation.map(item => `

            <div class="mark-item ${item.status.toLowerCase()}">

              <strong>
                ${item.mark}
              </strong>

              <p>
                ${item.point}
              </p>

              <span>
                ${item.status}
              </span>

            </div>

          `).join("")}

        </div>

      </div>




      <div class="report-grid">


        <div class="report-card">

          <h4>
            ✓ Strengths
          </h4>

          <ul>
            ${data.strengths
              .map(item => `<li>${item}</li>`)
              .join("")}
          </ul>

        </div>



        <div class="report-card improvement-card">

          <h4>
            ⚠ Improvements
          </h4>

          <ul>
            ${data.improvements
              .map(item => `<li>${item}</li>`)
              .join("")}
          </ul>

        </div>


      </div>




      <div class="report-card">

        <h4>
          Examiner Comment
        </h4>

        <p>
          ${data.examinerComment}
        </p>

      </div>


    `;


  } catch (error) {

    result.textContent =
      "Unable to connect to Noven's examiner system.";

    console.error(error);

  }

});