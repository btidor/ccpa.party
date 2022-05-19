// @flow
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Logo from "components/Logo";
import { Database } from "common/database";
import { ProviderRegistry } from "common/provider";

import styles from "components/Navigation.module.css";

import type { Provider } from "common/provider";

const links = [
  { label: "Timeline", to: "timeline" },
  { label: "Files", to: "files" },
];

type Props = {|
  +provider: Provider<any>,
  +pageSlug: string,
|};

function Navigation(props: Props): React.Node {
  const navigate = useNavigate();
  const location = useLocation();
  const { provider, pageSlug } = props;
  const [providers, setProviders] = React.useState(
    (undefined: ?$ReadOnlyArray<Provider<any>>)
  );
  const [epoch, setEpoch] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      const db = new Database(() => setEpoch(epoch + 1));
      const active = await db.getProviders();
      setProviders(
        ProviderRegistry.filter((provider) => active.has(provider.slug))
      );
    })();
  }, [epoch]);

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Logo block="nav" party="plain" />
      </div>
      <div className={styles.select}>
        <select
          value={provider.slug}
          onChange={(event) => {
            const { value } = event.target;
            value &&
              value !== provider.slug &&
              navigate(`/${value}/${pageSlug}`);
          }}
        >
          {providers ? (
            <React.Fragment>
              {providers.map((provider) => (
                <option key={provider.slug} value={provider.slug}>
                  {provider.displayName.toLowerCase()}
                </option>
              ))}
            </React.Fragment>
          ) : (
            <option key={provider.slug} value={provider.slug}>
              {provider.displayName.toLowerCase()}
            </option>
          )}
        </select>
        <div className={styles.arrow}>↲</div>
      </div>

      <nav>
        {links.map((link) => (
          <Link
            key={link.label}
            to={`/${provider.slug}/${link.to}`}
            aria-current={
              location.pathname.startsWith(`/${provider.slug}/${link.to}`)
                ? "page"
                : undefined
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default Navigation;
