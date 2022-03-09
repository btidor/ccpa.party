// @flow
import * as React from "react";
import { Link } from "react-router-dom";
import { SupportedProviders } from "./constants";

function Home(): React.Node {
  return (
    <div className="Home">
      <div className="instructions">Import data from...</div>
      <ul>
        {SupportedProviders.map((provider) => (
          <li key={provider.slug}>
            <Link to={"/import/" + provider.slug}>{provider.displayName}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Home;
