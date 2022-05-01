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

type Props = {|
  +provider?: Provider,
|};

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

function Home(props: Props): React.Node {
  const current = props.provider;
  return (
    <main className={styles.home}>
      <section className={current ? styles.three : styles.two}>
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
              aria-current={
                current?.slug === provider.slug ? "page" : undefined
              }
            >
              {provider.displayName}
            </Link>
          ))}
        </nav>
        {current && (
          <div className={styles.request}>
            <pre>
              {`data requests @
Google Takeout →

  zip or tgz
  under activity
   please
  select json

results in
Up To A Few Days

  [Import] Select a file...
`}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}

export default Home;
