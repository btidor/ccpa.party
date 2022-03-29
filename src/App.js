// @flow
import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Activity from "Activity";
import Files from "Files";
import Home from "Home";
import Import from "Import";
import Navigation from "Navigation";

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
        <Route path="/" element={<Navigate replace to="/start" />} />
        <Route path="/:provider">
          <Route path="" element={<Home />} />
          <Route path="activity" element={<Activity />} />
          <Route path="files" element={<Files />} />
          <Route path="import" element={<Import />} />
        </Route>
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
