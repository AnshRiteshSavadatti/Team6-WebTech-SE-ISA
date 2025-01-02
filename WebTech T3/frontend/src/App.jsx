import { useState } from "react";
import UploadCSV from "./components/UploadCSV";
import ResultTable from "./components/ResultTable";

const App = () => {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="container">
      <h1>Class Seating Allocation</h1>
      <UploadCSV />
      <button onClick={() => setShowTable(!showTable)}>
        {showTable ? "Hide Table" : "Show Table"}
      </button>
      {showTable && <ResultTable setShowTable={setShowTable}/>}
    </div>
  );
};

export default App;
