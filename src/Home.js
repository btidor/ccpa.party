// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Logo from "components/Logo";
import { darkColor } from "provider";

import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";
import Discord from "providers/discord";

import styles from "Home.module.css";

import type { Provider } from "provider";

const Providers = ([
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
]: $ReadOnlyArray<Provider>);

function Home(): React.Node {
  return (
    <main className={`${styles.home} thin`}>
      <section>
        <div className={styles.intro}>
          <p>
            <Logo />
          </p>
          <p>
            a tool
            <br />
            to request &amp;
            <br />
            explore
            <br />
            your data
          </p>
        </div>
        <nav>
          {Providers.map((provider) => (
            <Link
              key={provider.slug}
              to={`/${provider.slug}`}
              style={{ "--dark": darkColor(provider) }}
              className={styles.provider}
            >
              {provider.displayName}
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

export default Home;
