import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Database } from "@src/common/database";
import { ProviderRegistry } from "@src/common/provider";
import type { Provider } from "@src/common/provider";
import Logo from "@src/components/Logo";

import styles from "@src/components/Navigation.module.css";

const links = [
  { label: "Timeline", to: "timeline" },
  { label: "Files", to: "files" },
];

type Props<T> = {
  provider: Provider<T>;
  pageSlug: string;
};

function Navigation<T>(props: Props<T>): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { provider, pageSlug } = props;
  const [providers, setProviders] =
    React.useState<ReadonlyArray<Provider<T>>>();
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
