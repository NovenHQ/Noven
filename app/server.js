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


    markAllocation: [

      {
        mark: "Mark 1",
        point: "Enzymes are biological catalysts",
        status: "Achieved"
      },

      {
        mark: "Mark 2",
        point: "Enzymes have specific active sites",
        status: "Achieved"
      },

      {
        mark: "Mark 3",
        point: "Substrate binds to the active site",
        status: "Missing"
      },

      {
        mark: "Mark 4",
        point: "Temperature affects enzyme structure",
        status: "Missing"
      }

    ],


    strengths: [
      "Shows understanding of enzyme function",
      "Uses correct biological terminology"
    ],


    improvements: [
      "Explain the enzyme-substrate interaction",
      "Include more detail about factors affecting enzymes"
    ],


    examinerComment:
      "Good understanding shown. Add the missing marking points to reach full marks."

  });

});


app.listen(3001, () => {
  console.log("Noven backend running on port 3001");
});