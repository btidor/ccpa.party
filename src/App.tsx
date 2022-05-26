import React from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Files from "@src/Files";
import Home from "@src/Home";
import Request from "@src/Request";
import Timeline from "@src/Timeline";
import { ProviderLookup } from "@src/common/provider";

type Props = {
  children: JSX.Element;
};

type State = {
  hasError: boolean;
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidMount() {
    window.addEventListener("unhandledrejection", () =>
      this.setState({ hasError: true })
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error">
          <code>500 Internal Server Error</code>
        </main>
      );
    }
    return this.props.children;
  }
}

function do404(): JSX.Element {
  return (
    <React.Fragment>
      <main className="error">
        <code>404 Not Found</code>
      </main>
    </React.Fragment>
  );
}

function App(): JSX.Element {
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
              return <Home />;
            }

            // Extract provider from URL: `/:provider(/...)?`
            const provider = ProviderLookup.get(providerName);

            // Invalid provider
            if (!provider) return do404();

            // Extract page from URL: `/:provider(/:page(/...)?)?`
            const page = parts.shift();

            if (!page) {
              // Malformed URL
              if (parts.length) return do404();

              // URL: `/:provider`
              return <Request provider={provider} />;
            }

            // Page is non-empty. Extract special components from page slug
            // (e.g. page:abc@123).
            const matches = page.match(/^([^@:]+)(:[^@:]*)?(@[^@:]*)?$/);

            // Invalid page.
            if (!matches || !matches[1]) return do404();

            // At this point we should not have further path components.
            // URL: `/:provider/:page`
            if (parts.length) return do404();

            const pageSlug = matches[1];
            if (pageSlug === "files") {
              // URL: `/:provider/files(@selected)?`
              if (matches[2]) return do404();
              let selected: number | undefined = parseInt(matches[3]?.slice(1));
              if (isNaN(selected)) selected = undefined;
              return <Files provider={provider} selected={selected} />;
            } else if (pageSlug === "timeline") {
              // URL: `/:provider/timeline(:filter)?(@selected)?`
              const filter = matches[2]?.slice(1) || undefined;
              const selected = matches[3]?.slice(1) || undefined;
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
