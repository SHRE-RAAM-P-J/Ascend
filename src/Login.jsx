import { useState } from "react";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Email:", email);
    console.log("Password:", password);

    alert("Login button clicked!");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome Back 👋</h1>
        <p>Login to your account</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Login</button>
        </form>

        <div className="extra-links">
          <a href="#">Forgot Password?</a>
          <a href="#">Create Account</a>
        </div>
      </div>
    </div>
  );
}

export default Login;