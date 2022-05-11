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

const importTag = "__import__";

type Props = {|
  +provider: Provider,
  +pageSlug: string,
|};

function Navigation(props: Props): React.Node {
  const navigate = useNavigate();
  const location = useLocation();
  const { provider, pageSlug } = props;
  const [providers, setProviders] = React.useState(
    (undefined: ?$ReadOnlyArray<Provider>)
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
      <select
        value={provider.slug}
        onChange={(event) => {
          const { value } = event.target;
          if (!value || value === provider.slug) return;
          if (value === importTag) navigate("/");
          else navigate(`/${value}/${pageSlug}`);
        }}
      >
        {providers ? (
          <React.Fragment>
            {providers.map((provider) => (
              <option key={provider.slug} value={provider.slug}>
                {provider.displayName}
              </option>
            ))}
            <option value={importTag}>+ Add More</option>
          </React.Fragment>
        ) : (
          <option key={provider.slug} value={provider.slug}>
            {provider.displayName}
          </option>
        )}
      </select>

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
