// @flow
import { openDB } from "idb";
import * as React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { ProviderRegistry } from "provider";

import styles from "Navigation.module.css";

import type { Provider } from "provider";

const links = [
  { label: "Activity", to: "../activity" },
  { label: "Files", to: "../files" },
  { label: "Import", to: "../import" },
];

const importTag = "__import__";

type Props = {|
  provider?: Provider,
|};

function Navigation(props: Props): React.Node {
  const navigate = useNavigate();
  const location = useLocation();
  const [providers, setProviders] = React.useState(
    ([]: $ReadOnlyArray<Provider>)
  );

  React.useEffect(() => {
    (async () => {
      const db = await openDB("import");
      const files = await db.getAll("files");
      const active = new Set<string>();
      files.forEach((file) => active.add(file.provider));
      setProviders(
        ProviderRegistry.filter(
          (provider) =>
            active.has(provider.slug) ||
            (props.provider && props.provider.slug === provider.slug)
        )
      );
    })();
  }, [props]);

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        🎉 ccpa.party
      </Link>
      {props.provider && (
        <nav>
          {links.map((link) => (
            <NavLink key={link.label} to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
      <select
        value={!!props.provider ? props.provider.slug : ""}
        onChange={(event) => {
          const { value } = event.target;
          if (!value) return;
          if (props.provider && value === props.provider.slug) return;
          if (value === importTag) navigate("/");
          else
            navigate(`/${value}/${location.pathname.split("/").slice(-1)[0]}`);
        }}
      >
        {!props.provider && <option></option>}
        {providers.map((provider) => (
          <option key={provider.slug} value={provider.slug}>
            {provider.displayName}
          </option>
        ))}
        <option value={importTag}>+ Import</option>
      </select>
    </header>
  );
}

export default Navigation;
