// @flow
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { StopwatchIcon } from "@primer/octicons-react";

import Navigation from "Navigation";
import { getProvider } from "provider";
import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";
import Discord from "providers/discord";

import styles from "Home.module.css";

const ProviderList = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
];

function Home(): React.Node {
  const params = useParams();
  const current = params.provider && getProvider(params.provider);

  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home}>
        <div className={styles.providers}>
          <div>
            <span className={styles.numeral}>1</span> Select a company
          </div>
          {ProviderList.map((provider) => (
            <Link
              key={provider.slug}
              to={
                current && provider.slug === current.slug
                  ? "/"
                  : `/${provider.slug}`
              }
              style={{ "--primary": provider.color }}
              className={provider.fullColor ? undefined : styles.whiteout}
              aria-selected={current && provider.slug === current.slug}
            >
              {provider.icon} <span>{provider.displayName}</span>
            </Link>
          ))}
        </div>
        <div className={styles.info}>
          <ol>
            <li>
              <span className={styles.numeral}>2</span>
              Submit data access request
              {current && (
                <div className={styles.instructions}>
                  {current.instructions}
                </div>
              )}
            </li>
            <li>
              <StopwatchIcon className={styles.iconNumeral} />
              <i>
                {current ? `Wait ${current.waitTime} for a response` : "Wait"}
              </i>
            </li>
            <li>
              <span className={styles.numeral}>3</span>
              {current ? (
                <Link to="import">Import data into ccpa.party</Link>
              ) : (
                "Import data into ccpa.party"
              )}
            </li>
          </ol>
        </div>
      </main>
    </React.Fragment>
  );
}

export default Home;
