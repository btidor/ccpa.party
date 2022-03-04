import React from 'react';
import { Routes, Route, Link } from "react-router-dom";
import Home from './Home';
import Import from './Import';

import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <code>500 Internal Server Error</code>;
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div className="App">
      <h1 className="App-header">
        <Link to="/">🎉 ccpa.party</Link>
      </h1>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/import/:provider" element={<Import />} />
          <Route path="*" element={<code>404 Not Found</code>} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

export default App;
