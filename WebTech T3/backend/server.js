const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
const PORT = 5000;

// MySQL Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "classrooms",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err.message);
    process.exit(1);
  }
  console.log("Connected to MySQL");
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") cb(null, true);
    else cb(new Error("Invalid file type. Only CSV files are allowed."));
  },
});

// Ensure uploads directory exists
const uploadDirectory = "uploads/";
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Function to allocate seating
function allocateSeating(tableName, students, subject, res) {
  db.query("SELECT * FROM rooms", (err, rooms) => {
    if (err) {
      console.error("Error retrieving rooms data:", err);
      return res.status(500).send("Error retrieving rooms data.");
    }

    const allocation = [];
    let currentIndex = 0;

    rooms.forEach(({ uniqueid, capacity }) => {
      const rollNumbers = students
        .slice(currentIndex, currentIndex + parseInt(capacity))
        .map((student) => student.roll_no || student.RollNo)
        .join(", ");

      allocation.push([
        uniqueid,
        rollNumbers,
        rollNumbers ? rollNumbers.split(", ").length : 0,
        subject,
      ]);

      currentIndex += parseInt(capacity);
    });

    // Insert allocation data into the subject-specific table
    const insertQuery = `INSERT INTO ${tableName} (UniqueID, RollNumbers, QuestionPaperCount, Subject) VALUES ?`;
    db.query(insertQuery, [allocation], (err) => {
      if (err) {
        console.error("Error saving allocation data:", err);
        return res.status(500).send("Error saving allocation data.");
      }

      // Query the newly inserted data to return to frontend
      const selectQuery = `SELECT * FROM ${tableName}`;
      db.query(selectQuery, (err, results) => {
        if (err) {
          console.error("Error retrieving allocation data:", err);
          return res.status(500).send("Error retrieving allocation data.");
        }

        // Format results as array of objects for frontend
        const formattedResults = results.map((row) => ({
          UniqueID: row.UniqueID,
          RollNumbers: row.RollNumbers,
          QuestionPaperCount: row.QuestionPaperCount,
          Subject: row.Subject,
        }));

        res.json(formattedResults);
      });
    });
  });
}

// Function to create the table and allocate seating for the subject
function createSubjectTable(tableName, students, subject, res) {
  // Create a new table for the subject
  db.query(
    `CREATE TABLE ${tableName} (
        UniqueID VARCHAR(255),
        RollNumbers TEXT,
        QuestionPaperCount INT,
        Subject VARCHAR(255)
      )`,
    (err) => {
      if (err) {
        console.error("Error creating subject table:", err);
        return res.status(500).send("Error creating subject table.");
      }
      console.log(`Table ${tableName} created successfully.`);
      allocateSeating(tableName, students, subject, res); // Call the allocateSeating function
    }
  );
}

// Endpoint to upload CSV and allocate seating
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const filePath = req.file.path;
    const subject = req.body.subject;

    if (!subject) {
      return res.status(400).send("Subject is required.");
    }

    const students = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        if (!row.RollNo && !row.roll_no) {
          throw new Error("CSV file must contain 'RollNo' or 'roll_no' column");
        }
        students.push(row);
      })
      .on("end", () => {
        if (students.length === 0) {
          throw new Error("CSV file is empty or invalid format");
        }
        handleSubjectTable(subject, students, res);
      })
      .on("error", (err) => {
        console.error("Error reading CSV file:", err);
        res.status(500).send("Error reading file: " + err.message);
      });
  } catch (err) {
    console.error("Error in upload endpoint:", err);
    res.status(500).send("Error uploading file: " + err.message);
  }
});

// Function to handle the subject and table creation or update
function handleSubjectTable(subject, students, res) {
  try {
    const tableName = `allocation_${subject}`;
    console.log("Subject:", subject, "Table Name:", tableName);

    // Check database connection
    if (!db.threadId) {
      throw new Error("Database connection lost");
    }

    // Check if the table exists
    db.query(`SHOW TABLES LIKE '${tableName}'`, (err, result) => {
      if (err) {
        console.error("Error checking table existence:", err);
        return res
          .status(500)
          .send("Error checking table existence: " + err.message);
      }

      if (result.length === 0) {
        console.log("Creating new table:", tableName);
        createSubjectTable(tableName, students, subject, res);
      } else {
        console.log("Table exists, recreating:", tableName);
        const dropQuery = `DROP TABLE IF EXISTS ${mysql.escapeId(tableName)}`;
        db.query(dropQuery, (err) => {
          if (err) {
            console.error("Error dropping existing table:", err);
            return res
              .status(500)
              .send("Error dropping existing table: " + err.message);
          }

          console.log("Creating new table after dropping:", tableName);
          createSubjectTable(tableName, students, subject, res);
        });
      }
    });
  } catch (err) {
    console.error("Error in handleSubjectTable:", err);
    res.status(500).send("Error handling subject table: " + err.message);
  }
}

// Fetch allocation results
app.get("/results", (req, res) => {
  // Fetch all tables dynamically
  db.query("SHOW TABLES", (err, results) => {
    if (err) {
      console.error("Error fetching table names:", err);
      return res.status(500).send("Error fetching table names.");
    }

    // Filter tables based on your naming convention (e.g., Allocation_1, Allocation_2, ...)
    const allocationTables = results
      .map((row) => Object.values(row)[0])
      .filter((table) => table.startsWith("allocation_"));

    // Create a query to fetch data from all 'Allocation_*' tables
    const queries = allocationTables.map((table) => {
      return new Promise((resolve, reject) => {
        db.query(`SELECT * FROM ${table}`, (err, rows) => {
          if (err) {
            reject(`Error fetching data from ${table}: ${err}`);
          } else {
            resolve({ table, rows });
          }
        });
      });
    });

    // Execute all queries and send the combined results
    Promise.all(queries)
      .then((results) => {
        const groupedData = results.reduce((acc, { table, rows }) => {
          const [prefix, semester, ...rest] = table.split("_"); // Extract the full table name, semester, and subject
          const subject = rest.join("_"); // Rejoin the subject part if it contains underscores
          const fullTableName = `${prefix}_${semester}_${subject}`;

          if (!acc[fullTableName]) acc[fullTableName] = [];
          acc[fullTableName] = [...acc[fullTableName], ...rows]; // Merge the results from different tables
          return acc;
        }, {});

        res.json(groupedData);
      })
      .catch((err) => {
        console.error("Error fetching results:", err);
        res.status(500).send("Error fetching results.");
      });
  });
});

// Fetch roll numbers for a specific class from a dynamically named table
app.get("/class/:subject/:id", (req, res) => {
  const { subject, id } = req.params;

  const tableName = `allocation_${subject}`; // Updated table name based on subject

  const query = `SELECT RollNumbers FROM ?? WHERE UniqueID = ?`;

  db.query(query, [tableName, id], (err, results) => {
    if (err) {
      console.error("Error fetching class data:", err);
      return res.status(500).json({ error: "Error fetching class data." });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Class not found." });
    }

    const rollNumbers = results[0].RollNumbers
      ? results[0].RollNumbers.split(",").map((num) => num.trim())
      : []; // Split and trim roll numbers

    res.json({ rollNumbers });
  });
});

// Assume you're using Express

// Route for updating roll numbers in a class
app.post("/class/:subject/update", async (req, res) => {
  const { subject } = req.params;
  const { rollNumbers, uniqueID } = req.body;

  const tableName = `allocation_${subject}`; // Updated table name

  const query = `UPDATE ?? SET RollNumbers = ? WHERE UniqueID = ?`;

  try {
    await db.query(query, [tableName, rollNumbers.join(","), uniqueID]);
    res.json({ success: true, message: "Roll numbers updated successfully!" });
  } catch (err) {
    console.error("Error updating roll numbers:", err);
    res.status(500).json({ error: "Error updating roll numbers." });
  }
});

// Delete route for removing a roll number from a class
app.post("/class/:subject/delete", async (req, res) => {
  const { subject } = req.params;
  const { rollNumber, uniqueID } = req.body;

  // Validate inputs
  if (!subject || !rollNumber || !uniqueID) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const tableName = `allocation_${subject}`; // Updated table name

  try {
    // Verify database connection
    if (!db.threadId) {
      console.error("Database connection lost");
      return res.status(500).json({ error: "Database connection error" });
    }

    // First get the current roll numbers
    const getQuery = `SELECT RollNumbers FROM ?? WHERE UniqueID = ?`;
    const [result] = await db.query(getQuery, [tableName, uniqueID]);

    if (!result.length) {
      return res.status(404).json({ error: "Class not found." });
    }

    // Handle empty roll numbers
    if (!result[0].RollNumbers) {
      return res
        .status(404)
        .json({ error: "No roll numbers found for this class" });
    }

    // Handle null/undefined RollNumbers
    const rollNumbersString = result[0].RollNumbers || "";

    // Ensure we have a valid string to split
    if (typeof rollNumbersString !== "string") {
      return res.status(500).json({ error: "Invalid roll numbers format" });
    }

    // Initialize empty array by default
    let currentRollNumbers = [];

    // Only process if we have a non-empty string
    if (rollNumbersString && typeof rollNumbersString === "string" && rollNumbersString.trim().length > 0) {
      try {
        // Convert to array safely
        const tempArray = rollNumbersString.split(",");
        if (!Array.isArray(tempArray)) {
          throw new Error("Failed to convert roll numbers to array");
        }

        // Process each roll number with proper validation
        currentRollNumbers = tempArray
          .map((n) => {
            if (typeof n === "string") {
              const trimmed = n.trim();
              return trimmed.length > 0 ? trimmed : null;
            }
            return null;
          })
          .filter((n) => n !== null && n.length > 0);
        
        // Ensure we have a valid array
        if (!Array.isArray(currentRollNumbers)) {
          currentRollNumbers = [];
        }
        
        // Convert to Set to remove duplicates and back to array
        currentRollNumbers = Array.from(new Set(currentRollNumbers));
        
        // Final validation
        if (!Array.isArray(currentRollNumbers)) {
          throw new Error("Failed to create valid roll numbers array");
        }
      } catch (err) {
        console.error("Error processing roll numbers:", err);
        return res.status(500).json({
          error: "Error processing roll numbers",
          details: err.message
        });
      }
    }

    // Verify the roll number exists
    if (!currentRollNumbers.includes(rollNumber)) {
      return res.status(404).json({ error: "Roll number not found in class" });
    }

    const newRollNumbers = currentRollNumbers.filter(
      (num) => num !== rollNumber
    );

    // Update with new roll numbers and accurate count
    const updateQuery = `
        UPDATE ?? 
        SET RollNumbers = ?,
            QuestionPaperCount = ?
        WHERE UniqueID = ?`;

    const [updateResult] = await db.query(updateQuery, [
      tableName,
      newRollNumbers.join(","),
      newRollNumbers.length,
      uniqueID,
    ]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "No records updated" });
    }

    res.json({ success: true, message: "Roll number removed successfully!" });
  } catch (err) {
    console.error("Error deleting roll number:", {
      message: err.message,
      stack: err.stack,
      sql: err.sql,
      sqlMessage: err.sqlMessage,
    });
    res.status(500).json({
      error: "Error deleting roll number",
      details: err.message,
    });
  }
});

// Delete a single roll number from a class dynamically
app.post("/class/:id/delete", async (req, res) => {
  const { id } = req.params; // Class ID (e.g., '5' for allocation_5)
  const { rollNumber } = req.body;

  if (!rollNumber) {
    return res.status(400).send("Roll number is required.");
  }

  const tableName = `allocation_${id}`; // Format the table name based on the ID

  try {
    // Check if the table exists
    const tableExistsQuery = `SHOW TABLES LIKE ?`;
    const [tableExists] = await db
      .promise()
      .query(tableExistsQuery, [tableName]);

    if (tableExists.length === 0) {
      return res.status(404).send(`Table '${tableName}' does not exist.`);
    }

    // Fetch existing roll numbers for the class
    const fetchRollNumbersQuery = `SELECT RollNumbers FROM ${mysql.escapeId(
      tableName
    )} WHERE UniqueID = ?`;
    const [rows] = await db
      .promise()
      .query(fetchRollNumbersQuery, [`allocation_allocation_${id}`]);

    if (rows.length === 0) {
      return res.status(404).send("No data found for the specified class.");
    }

    let rollNumbers = rows[0].RollNumbers.split(", ");
    if (!rollNumbers.includes(rollNumber)) {
      return res.status(404).send("Roll number not found in the class.");
    }

    // Remove the roll number and update the table
    rollNumbers = rollNumbers.filter((num) => num !== rollNumber);

    const updateRollNumbersQuery = `
        UPDATE ${mysql.escapeId(tableName)} 
        SET RollNumbers = ?, QuestionPaperCount = ? 
        WHERE UniqueID = ?`;

    await db
      .promise()
      .query(updateRollNumbersQuery, [
        rollNumbers.join(", "),
        rollNumbers.length,
        `allocation_allocation_${id}`,
      ]);

    res.send("Roll number deleted successfully.");
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("An error occurred while processing the request.");
  }
});

// Endpoint to drop a specific table
app.post("/drop-table", (req, res) => {
  const { subject } = req.body;

  const tableName = `allocation_${subject}`; // Updated table name

  const dropQuery = `DROP TABLE IF EXISTS ??`;

  db.query(dropQuery, [tableName], (err) => {
    if (err) {
      console.error("Error dropping table:", err);
      return res.status(500).send("Error dropping table.");
    }
    res.send(`Table ${tableName} dropped successfully.`);
  });
});

// Start server
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
