// @flow
import * as React from "react";
import { Link, useLocation } from "react-router-dom";

import { Database } from "common/database";
import { darkColor } from "common/provider";
import Logo from "components/Logo";

import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Discord from "providers/discord";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";

import styles from "Home.module.css";

import type { Provider } from "common/provider";

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
  const location = useLocation();
  const ref = React.useRef<?HTMLElement>(null);
  React.useEffect(
    () =>
      (ref.current && ref.current.scrollTo(location.state ? 9999 : 0, 0)) ||
      undefined,
    [location, ref]
  );

  const [epoch, setEpoch] = React.useState(0);
  const [imported, setImported] = React.useState();
  React.useEffect(() => {
    (async () =>
      setImported(
        await new Database(() => setEpoch(epoch + 1)).getProviders()
      ))();
  }, [epoch]);

  return (
    <main className={styles.home} ref={ref}>
      <section>
        <div className={styles.intro}>
          <div className={styles.logo} style={{ "--dark": "#fff" }}>
            <Logo block="home" party="glow" />
          </div>
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
            <div key={provider.slug} style={{ "--dark": darkColor(provider) }}>
              <span>{imported?.has(provider.slug) && "␥"}</span>
              <Link to={`/${provider.slug}`}>{provider.displayName}</Link>
            </div>
          ))}
        </nav>
      </section>
    </main>
  );
}

export default Home;
