// @flow
import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Activity from "Activity";
import Files from "Files";
import Home from "Home";
import Import from "Import";
import Navigation from "components/Navigation";

type Props = {
  children: React.Node,
};

type State = {
  hasError: boolean,
};

class ErrorBoundary extends React.Component<Props, State> {
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
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:provider" element={<Home />} />
        <Route path="/:provider/import" element={<Home import />} />
        <Route path="/:provider/files" element={<Files />} />
        <Route path="/:provider/activity" element={<Activity />} />
        <Route
          path="*"
          element={
            <React.Fragment>
              <Navigation />
              <main>
                <code>404 Not Found</code>
              </main>
            </React.Fragment>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
