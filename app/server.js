import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Noven backend is running");
});

app.post("/analyze", (req, res) => {

  const {
    board,
    qualification,
    subject,
    question,
    answer
  } = req.body;


  console.log("Exam Board:", board);
  console.log("Qualification:", qualification);
  console.log("Subject:", subject);
  console.log("Question:", question);
  console.log("Student Answer:", answer);


  res.json({

    score: "4/6",

    markBreakdown: [
      "✓ Correct explanation of enzyme function",
      "✓ Uses relevant biological terminology",
      "✗ Missing explanation of active site specificity",
      "✗ Needs more detail about enzyme-substrate interaction"
    ],

    strengths: [
      "Shows understanding of the basic biological concept",
      "Uses some correct scientific vocabulary"
    ],

    improvements: [
      "Include more precise explanations",
      "Link ideas directly to the question wording"
    ],

    examinerComment:
      "Good understanding shown. To achieve full marks, include more detailed biological explanations."

  });

});


app.listen(3001, () => {
  console.log("Noven backend running on port 3001");
});