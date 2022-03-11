// @flow
import * as React from "react";
import { Link } from "react-router-dom";
import { ProviderRegistry } from "provider";

import styles from "Home.module.css";

function Home(): React.Node {
  return (
    <main>
      <div>Import data from...</div>
      <ul className={styles.list}>
        {ProviderRegistry.map((provider) => (
          <li key={provider.slug}>
            <Link to={"/import/" + provider.slug} className="box-link">
              {provider.displayName}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Home;
