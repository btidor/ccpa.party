// @flow
import * as React from "react";
import { Link } from "react-router-dom";
import { ProviderRegistry } from "provider";

function Home(): React.Node {
  return (
    <div className="App-body">
      <div className="instructions">Import data from...</div>
      <ul>
        {ProviderRegistry.map((provider) => (
          <li key={provider.slug}>
            <Link to={"/import/" + provider.slug}>{provider.displayName}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Home;
