// @flow
import * as React from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Timeline from "Timeline";
import Files from "Files";
import Home from "Home";
import { ProviderLookup } from "provider";

type Props = {
  +children: React.Node,
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

function do404(): React.Node {
  return (
    <React.Fragment>
      <main>
        <code>404 Not Found</code>
      </main>
    </React.Fragment>
  );
}

function App(): React.Node {
  const location = useLocation();
  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="*"
          element={(() => {
            // Big custom routing function! This lets us (a) handle complex
            // URLs like /foobar/timeline:abc@123, and (b) pass inputs to
            // components as typed, fully-hydrated props instead of raw string
            // params.

            const parts = location.pathname.split("/");
            parts.shift(); // empty due to leading slash

            const providerName = parts.shift();
            if (!providerName) {
              // Malformed URL
              if (parts.length) return do404();

              // URL: `/`
              return <Home screen="select" />;
            }

            // Extract provider from URL: `/:provider(/...)?`
            const provider = ProviderLookup.get(providerName);

            // Invalid provider
            if (!provider) return do404();

            // Extract page from URL: `/:provider(/:page(/...)?)?`
            const page = parts.shift();
            if (!page && !parts.length) {
              // Malformed URL
              if (parts.length) return do404();

              // URL: `/:provider`
              return <Home screen="request" provider={provider} />;
            }

            // Page is non-empty. Extract special components from page slug
            // (e.g. page:abc@123).
            const matches = page.match(/^([^@:]+)(:[^@:]+)?(@[^@:]+)?$/);

            // Invalid page.
            if (!matches || !matches[1]) do404();

            // At this point we should not have further path components.
            // URL: `/:provider/:page`
            if (parts.length) do404();

            const pageSlug = matches[1];
            if (pageSlug === "import") {
              // URL: `/:provider/import`
              return <Home screen="import" provider={provider} />;
            } else if (pageSlug === "files") {
              // URL: `/:provider/files(@selected)?`
              let selected = !!matches[3]
                ? parseInt(matches[3].slice(1))
                : undefined;
              if (Number.isNaN(selected)) return do404();
              return <Files provider={provider} selected={selected} />;
            } else if (pageSlug === "timeline") {
              // URL: `/:provider/timeline(:filter)?(@selected)?`
              let filter = !!matches[2] ? matches[2].slice(1) : undefined;
              let selected = !!matches[3]
                ? parseInt(matches[3].slice(1))
                : undefined;
              if (Number.isNaN(selected)) return do404();
              return (
                <Timeline
                  provider={provider}
                  filter={filter}
                  selected={selected}
                />
              );
            }

            return do404();
          })()}
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
