// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Navigation from "Navigation";
import { ProviderRegistry } from "provider";

import styles from "Home.module.css";

function Home(): React.Node {
  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home}>
        <div>Import data from...</div>
        <ul>
          {ProviderRegistry.map((provider) => (
            <li key={provider.slug}>
              <Link to={`${provider.slug}/import`}>{provider.displayName}</Link>
            </li>
          ))}
        </ul>
      </main>
    </React.Fragment>
  );
}

export default Home;
