import React from "react";

import Files from "@src/Files";
import Home from "@src/Home";
import Request from "@src/Request";
import Timeline from "@src/Timeline";
import { ProviderLookup } from "@src/common/provider";
import { Location, LocationContext } from "@src/common/router";

type Props = {
  location?: string; // for server-side rendering only!
};

type State = {
  hasError: boolean;
  location: Location;
};

class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    if (import.meta.env.SSR && !this.props.location) {
      throw new Error(
        "LocationContext must be provided during server-side rendering"
      );
    }
    this.state = {
      hasError: false,
      location: this.props.location
        ? {
            pathname: this.props.location,
            _set: () => {
              throw new Error("Can't navigate during server-side rendering");
            },
          }
        : {
            pathname: window.location.pathname,
            state: window.history.state,
            _set: (location) => this.setState({ hasError: false, location }),
          },
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidMount() {
    window.addEventListener("unhandledrejection", () =>
      this.setState({ hasError: true })
    );
    window.addEventListener("popstate", () =>
      this.setState({
        hasError: false,
        location: {
          pathname: window.location.pathname,
          state: window.history.state,
          _set: (location) => this.setState({ hasError: false, location }),
        },
      })
    );
  }

  error(code: number) {
    return (
      <main className="error">
        <code>{code === 404 ? "404 Not Found" : `${code} Internal Error`}</code>
      </main>
    );
  }

  route(location: Location): JSX.Element {
    const parts = location.pathname.split("/");
    parts.shift(); // empty due to leading slash

    const providerName = parts.shift();
    if (!providerName) {
      // Malformed URL
      if (parts.length) return this.error(404);
      // URL: `/`
      return <Home scrolled={!!location.state} />;
    }

    // Extract provider from URL: `/:provider(/...)?`
    const provider = ProviderLookup.get(providerName);
    // Invalid provider
    if (!provider) return this.error(404);

    // Extract page from URL: `/:provider(/:page(/...)?)?`
    const page = parts.shift();
    if (!page) {
      // Malformed URL
      if (parts.length) return this.error(404);
      // URL: `/:provider`
      return <Request provider={provider} />;
    }

    // Page is non-empty. Extract special components from page slug
    // (e.g. page:abc@123).
    const matches = page.match(/^([^@:]+)(:[^@:]*)?(@[^@:]*)?$/);
    // Invalid page.
    if (!matches || !matches[1]) return this.error(404);

    // At this point we should not have further path components.
    // URL: `/:provider/:page`
    if (parts.length) return this.error(404);
    const pageSlug = matches[1];
    if (pageSlug === "files") {
      // URL: `/:provider/files(@selected)?`
      if (matches[2]) return this.error(404);
      return <Files provider={provider} selected={matches[3]?.slice(1)} />;
    } else if (pageSlug === "timeline") {
      // URL: `/:provider/timeline(:filter)?(@selected)?`
      const filter = matches[2]?.slice(1) || undefined;
      const selected = matches[3]?.slice(1) || undefined;
      return (
        <Timeline provider={provider} filter={filter} selected={selected} />
      );
    }

    return this.error(404);
  }

  render() {
    if (this.state.hasError) {
      return this.error(500);
    } else {
      return (
        <LocationContext.Provider value={this.state.location}>
          {this.route(this.state.location)}
        </LocationContext.Provider>
      );
    }
  }
}

export default App;
