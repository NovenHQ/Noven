document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>Noven</h1>
    <h2>AI Biology Examiner Assistant</h2>

    <p>
      Improve your Edexcel IGCSE and A-Level Biology exam performance
      with AI-powered feedback.
    </p>

    <textarea id="answer" placeholder="Paste your Biology answer here..."></textarea>

    <button id="analyze">Analyze Answer</button>

    <p id="result"></p>
  </div>
`;

const button = document.querySelector("#analyze");
const result = document.querySelector("#result");

button.addEventListener("click", () => {
  result.textContent = "Analysis coming soon...";
});