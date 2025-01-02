import { useState } from "react";

const UploadCSV = () => {
  const [file, setFile] = useState(null);
  const [semester, setSemester] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [tableData, setTableData] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSemesterChange = (e) => {
    setSemester(e.target.value);
    setSubject(""); // Reset subject when semester changes
    setTableData(null); // Clear previous table data if semester changes
  };

  const handleSubjectChange = (e) => {
    setSubject(e.target.value);
    setTableData(null); // Clear previous table data if subject changes
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file || !semester || !subject) {
      setErrorMessage("Please select a file, semester, and subject.");
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("semester", semester);
    formData.append("subject", subject);

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Received data:", data); // Debugging log

        // Validate the received data
        if (data && Array.isArray(data)) {
          setTableData(data);
          setSuccessMessage("File uploaded and processed successfully!");
        } else {
          console.error("Invalid data format received:", data);
          setErrorMessage("Received data is in an unexpected format.");
        }
      } else {
        const errorText = await response.text();
        console.error("Upload error:", errorText); // Debugging log
        setErrorMessage(errorText || "Error uploading file.");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setErrorMessage("Error uploading file.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!tableData) return;

    const csvContent = [
      Object.keys(tableData[0]).join(","), // Header row
      ...tableData.map((row) => Object.values(row).join(",")), // Data rows
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${subject}_${semester}.csv`;
    link.click();

    URL.revokeObjectURL(url); // Clean up the URL object
  };

  const subjects = {
    3: [
      "Data_Structure_and_Algorithm",
      "Database_Management_System",
      "Computer_Organisation_and_Architecture",
      "Discrete_Mathematics_Structure",
      "Graph_Theory_and_Linear_Algebra",
    ],
    4: [
      "Operating_Systems",
      "Micro_Controllers",
      "Principle_of_Compiler_Design",
      "Applied_Statistics",
      "Object_Oriented_Programming",
      "Exploratory_Data_Analysis",
    ],
    5: [
      "Web_Technology",
      "Software_Engineering",
      "System_Software",
      "Machine_Learning",
      "Computer_Networks_1",
      "Computer_Vision",
      "Cybersecurity",
      "Computational_Medicine",
    ],
    6: [
      "Computer_Networks_2",
      "Cloud_Computing",
      "Professional_Elective_2",
      "Professional_Elective_3",
      "Computer_Networks_Lab",
      "Minor_Project_1",
      "Minor_Project_2",
      "Industry_Readiness_&_Leadership_Skills(Audit)",
      "Professional_Aptitude_&_Logical_Reasoning(Audit)",
    ],
    7: [
      "Constitution_of_India",
      "Big_Data_and_Analytics",
      "Information_Security",
      "Generative_AI",
      "Cyber_Security",
    ],
  };

  return (
    <div style={{ padding: "20px" }}>
      <form onSubmit={handleUpload}>
        <label htmlFor="semester">Select Semester:</label>
        <select
          id="semester"
          value={semester}
          onChange={handleSemesterChange}
          style={{ marginLeft: "10px" }}
        >
          <option value="">--Select Semester--</option>
          {Object.keys(subjects).map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </select>
        <br />

        {semester && subjects[semester] && (
          <>
            <label htmlFor="subject">Select Subject:</label>
            <select
              id="subject"
              value={subject}
              onChange={handleSubjectChange}
              style={{ marginLeft: "10px" }}
            >
              <option value="">--Select Subject--</option>
              {subjects[semester].map((subj, index) => (
                <option key={index} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </>
        )}
        <br />

        <label htmlFor="file">Upload CSV File:</label>
        <input
          type="file"
          id="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ marginLeft: "10px" }}
        />
        <br />

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: loading ? "gray" : "#4CAF50",
            color: "white",
            padding: "10px 20px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: "10px",
          }}
        >
          {loading ? "Uploading..." : "Upload and Process"}
        </button>
      </form>

      {errorMessage && (
        <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>
      )}
      {successMessage && (
        <div style={{ color: "green", marginTop: "10px" }}>
          {successMessage}
        </div>
      )}

      {tableData && (
        <div style={{ marginTop: "20px" }}>
          <h3>Processed Table Data:</h3>
          <table
            border="1"
            cellPadding="5"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                {Object.keys(tableData[0]).map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, colIndex) => (
                    <td key={colIndex}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleDownload}
            style={{
              backgroundColor: "#2196F3",
              color: "white",
              padding: "10px 20px",
              border: "none",
              cursor: "pointer",
              marginTop: "10px",
            }}
          >
            Download Table as CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadCSV;
