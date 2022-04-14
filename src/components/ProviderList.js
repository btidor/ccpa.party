// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Amazon from "providers/amazon";
import Apple from "providers/apple";
import Facebook from "providers/facebook";
import GitHub from "providers/github";
import Google from "providers/google";
import Netflix from "providers/netflix";
import Slack from "providers/slack";
import Discord from "providers/discord";

import styles from "components/ProviderList.module.css";

import type { Provider } from "provider";

type Props = {|
  +backLink: ?string,
  +selected: ?Provider,
|};

const Providers = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
];

function ProviderList(props: Props): React.Node {
  const { backLink, selected } = props;
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    setTimeout(() => setLoaded(true));
  }, []);

  return (
    <nav className={loaded ? styles.loaded : undefined}>
      {Providers.map((provider) => (
        <Link
          key={provider.slug}
          to={
            provider.slug === selected?.slug && backLink
              ? backLink
              : `/${provider.slug}`
          }
          style={{ "--primary": provider.color }}
          className={
            styles.tile + " " + (provider.fullColor ? "" : styles.whiteout)
          }
          aria-selected={provider.slug === selected?.slug}
        >
          {provider.icon} <span>{provider.displayName}</span>
        </Link>
      ))}
    </nav>
  );
}

export default ProviderList;
