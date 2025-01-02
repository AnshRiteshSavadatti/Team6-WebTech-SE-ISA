import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const Modal = ({ classID, tableName, onClose, setShowTable }) => {
  const [rollNumbers, setRollNumbers] = useState([]);
  const [newRollNumber, setNewRollNumber] = useState("");

  // Fetching roll numbers dynamically for the table and classID
  useEffect(() => {
    const fetchRollNumbers = async () => {
      try {
        const subject = tableName.replace("allocation_", "");
        const response = await fetch(
          `http://localhost:5000/class/${subject}/${classID}`
        );

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        setRollNumbers(data.rollNumbers || []); // Populate state with rollNumbers
      } catch (error) {
        console.error("Error fetching roll numbers:", error);
        alert("Failed to load roll numbers");
      }
    };

    fetchRollNumbers();
  }, [tableName, classID]);

  const handleAdd = () => {
    if (newRollNumber.trim() !== "") {
      setRollNumbers((prev) => [...prev, newRollNumber.trim()]);
      setNewRollNumber("");
    }
  };

  const handleRemove = async (rollNumber) => {
    try {
      // Validate roll number
      if (!rollNumber || typeof rollNumber !== "string") {
        throw new Error("Invalid roll number");
      }

      const subject = tableName.replace("allocation_", "");
      const response = await fetch(
        `http://localhost:5000/class/${subject}/delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rollNumber, uniqueID: classID }),
        }
      );

      // Check response status and parse error details
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to delete roll number");
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || "Roll number deletion failed");
      }

      // Update local state
      setRollNumbers((prev) => prev.filter((num) => num !== rollNumber));

      alert(result.message || "Roll number deleted successfully!");
    } catch (error) {
      console.error("Error deleting roll number:", {
        message: error.message,
        stack: error.stack,
      });
      alert(`Error: ${error.message}`);
    }
  };

  const handleSave = async () => {
    setShowTable(false); // Close table view
    try {
      const subject = tableName.replace("allocation_", "");
      const response = await fetch(
        `http://localhost:5000/class/${subject}/update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rollNumbers, uniqueID: classID }),
        }
      );

      if (!response.ok) throw new Error("Failed to update roll numbers");

      alert("Roll numbers updated successfully!");
      onClose(); // Close the modal
    } catch (error) {
      alert("Error saving roll numbers");
      console.error("Error:", error);
    }
  };

  return (
    <div className="modal">
      <h2>Manage Roll Numbers for Class {classID}</h2>
      <ul>
        {rollNumbers.map((num, index) => (
          <li key={index}>
            {num}
            <button
              onClick={() => handleRemove(num)}
              style={{ marginLeft: "10px" }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <input
        type="text"
        value={newRollNumber}
        onChange={(e) => setNewRollNumber(e.target.value)}
        placeholder="Enter new roll number"
      />
      <button onClick={handleAdd}>Add</button>
      <button onClick={handleSave} style={{ marginLeft: "10px" }}>
        Save
      </button>
      <button onClick={onClose} style={{ marginLeft: "10px" }}>
        Close
      </button>
    </div>
  );
};

Modal.propTypes = {
  classID: PropTypes.string.isRequired,
  tableName: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  setShowTable: PropTypes.func.isRequired,
};

export default Modal;
