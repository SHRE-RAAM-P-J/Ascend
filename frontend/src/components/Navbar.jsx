import "../styles/Navbar.css";

function Navbar() {
  return (
    <header className="ascend-header">
      <div className="header-badge">
        <span className="badge-dot" />
        <span>DIRECT PORTAL ACCESS</span>
      </div>
      <h1 className="ascend-title">Ascend</h1>
      <p className="ascend-subtitle">
        Curated directory linking directly to the verified official career portals of 140 premier technology companies.
      </p>
    </header>
  );
}

export default Navbar;
