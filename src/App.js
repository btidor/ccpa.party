// @flow
import * as React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Activity from "Activity";
import Explore from "Explore";
import Home from "Home";
import Import from "Import";

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
    <React.Fragment>
      <h1>
        <Link to="/" className="box-link">
          🎉 ccpa.party
        </Link>
      </h1>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:provider">
            <Route path="activity" element={<Activity />} />
            <Route path="explore">
              <Route path=":view" element={<Explore />} />
              <Route path="" element={<Explore />} />
            </Route>
            <Route path="import" element={<Import />} />
          </Route>
          <Route
            path="*"
            element={
              <main>
                <code>404 Not Found</code>{" "}
              </main>
            }
          />
        </Routes>
      </ErrorBoundary>
    </React.Fragment>
  );
}

export default App;
