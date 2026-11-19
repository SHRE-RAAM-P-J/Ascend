import Navbar from "./components/Navbar";
import CompanyDirectory from "./components/CompanyDirectory";
import "./styles/App.css";

function App() {
  return (
    <div className="app-container">
      <Navbar />
      <CompanyDirectory />
    </div>
  );
}

export default App;
