// @flow
import { motion, AnimatePresence } from "framer-motion";
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
  const current = params.provider !== "start" && getProvider(params.provider);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => setLoaded(true));
  }, []);

  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home + (loaded ? " " + styles.loaded : "")}>
        <div className={styles.providers}>
          <div>
            <span className={styles.numeral}>1</span> Select a company
          </div>
          {ProviderList.map((provider) => (
            <Link
              key={provider.slug}
              to={
                current && provider.slug === current.slug
                  ? "/start"
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
        <motion.div className={styles.info} transition={{ duration: 2 }}>
          <ol>
            <li>
              <span className={styles.numeral}>2</span>
              Submit data access request
              <AnimatePresence>
                {(() => {
                  if (!current) return;

                  let count = 9;
                  try {
                    const instructions = (current.instructions: any);
                    if (instructions.type === "ol") {
                      count = instructions.props.children.length;
                    }
                  } catch {}

                  return (
                    <motion.div
                      className={styles.instructions}
                      initial={loaded ? { maxHeight: 0, opacity: 0 } : false}
                      animate={{ maxHeight: 32 * count, opacity: 1 }}
                      exit={{ maxHeight: 0, opacity: [0, 0] }}
                    >
                      {current.instructions}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </li>
            <li>
              <StopwatchIcon className={styles.iconNumeral} />
              <i>Wait {current && `${current.waitTime} for a response`}</i>
            </li>
            <li>
              <span className={styles.numeral}>3</span>
              {current ? (
                <Link to="import">Inspect your data with ccpa.party</Link>
              ) : (
                "Inspect your data with ccpa.party"
              )}
            </li>
          </ol>
        </motion.div>
      </main>
    </React.Fragment>
  );
}

export default Home;
