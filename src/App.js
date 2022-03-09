// @flow
import * as React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Explore from "Explore";
import Home from "Home";
import Import from "Import";

import "App.css";

type Prop = {
  children: React.Node,
};

type State = {
  hasError: boolean,
};

class ErrorBoundary extends React.Component<Prop, State> {
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

function App(): React.Node {
  return (
    <div className="App">
      <h1 className="App-header">
        <Link to="/">🎉 ccpa.party</Link>
      </h1>
      <div className="App-body">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore/:provider" element={<Explore />} />
            <Route path="/import/:provider" element={<Import />} />
            <Route path="*" element={<code>404 Not Found</code>} />
          </Routes>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;
