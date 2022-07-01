import React from "react";

import { ProviderRegistry } from "@src/common/provider";
import type { Provider } from "@src/common/provider";
import { Link, LocationContext, useNavigate } from "@src/common/router";
import Logo from "@src/components/Logo";
import { useProviderDatabase } from "@src/database/hooks";

import styles from "@src/components/Navigation.module.css";

type Props<T> = {
  provider: Provider<T>;
  pageSlug: string;
};

const baseLinks = [
  { label: "Timeline", to: "timeline" },
  { label: "Files", to: "files" },
];

function Navigation<T>(props: Props<T>): JSX.Element {
  const { provider, pageSlug } = props;

  const navigate = useNavigate();
  const location = React.useContext(LocationContext);

  const db = useProviderDatabase(props.provider);
  const [links, setLinks] = React.useState(baseLinks);
  const [providers, setProviders] =
    React.useState<ReadonlyArray<Provider<unknown>>>();

  React.useEffect(() => {
    (async () => {
      if (!db) return;
      setLinks([...baseLinks, { label: ":)", to: "errors" }]);
      const active = await db.getProviders();
      setProviders(
        ProviderRegistry.filter((provider) => active.has(provider.slug))
      );
      setLinks([
        ...baseLinks,
        { label: (await db.getHasErrors()) ? "!!" : ":)", to: "errors" },
      ]);
    })();
  }, [db, provider]);

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
              location?.pathname.startsWith(`/${provider.slug}/${link.to}`)
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

export default React.memo(Navigation);
