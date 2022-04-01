// @flow
import * as React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import Logo from "components/Logo";
import { openFiles } from "parse";
import { ProviderRegistry } from "provider";

import styles from "components/Navigation.module.css";

import type { Provider } from "provider";

const links = [
  { label: "Activity", to: "activity" },
  { label: "Files", to: "files" },
];

const importTag = "__import__";

type Props = {|
  provider: Provider,
|};

function Navigation(props: Props): React.Node {
  const navigate = useNavigate();
  const location = useLocation();
  const [providers, setProviders] = React.useState(
    (undefined: ?$ReadOnlyArray<Provider>)
  );

  React.useEffect(() => {
    (async () => {
      const db = await openFiles();
      const active = new Set<string>();
      if (db.objectStoreNames.contains("files")) {
        const files = await db.getAll("files");
        files.forEach((file) => active.add(file.provider));
      }
      setProviders(
        ProviderRegistry.filter((provider) => active.has(provider.slug))
      );
    })();
  }, [props]);

  const provider = props.provider;
  return (
    <header
      className={styles.header}
      style={{ backgroundColor: provider.color }}
    >
      <Logo />
      <select
        value={provider.slug}
        onChange={(event) => {
          const { value } = event.target;
          if (!value || value === provider.slug) return;
          if (value === importTag) navigate("/");
          else navigate(`/${value}/${location.pathname.split("/")[2]}`);
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
          <NavLink key={link.label} to={`/${provider.slug}/${link.to}`}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export default Navigation;
