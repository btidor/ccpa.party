// @flow
import * as React from "react";
import { Routes, Route } from "react-router-dom";

import Activity from "Activity";
import Files from "Files";
import Home from "Home";

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
      return (
        <main>
          <code>500 Internal Server Error</code>
        </main>
      );
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
        <Route path="/:provider/files/:id" element={<Files />} />
        <Route path="/:provider/activity" element={<Activity />} />
        <Route path="/:provider/activity/:id" element={<Activity />} />
        <Route
          path="*"
          element={
            <React.Fragment>
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
