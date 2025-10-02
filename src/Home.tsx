import React from "react";

import { ProviderRegistry } from "@src/common/provider";
import { Link } from "@src/common/router";
import Logo from "@src/components/Logo";
import { useBaseDatabase } from "@src/database/hooks";

import styles from "@src/Home.module.css";

function Home(props: { scrolled: boolean }): React.JSX.Element {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(
    () => ref.current?.scrollTo(props.scrolled ? 9999 : 0, 0),
    [props.scrolled, ref],
  );

  const db = useBaseDatabase();
  const [imported, setImported] = React.useState<Set<string>>();
  React.useEffect(() => {
    (async () => db && setImported(await db.getProviders()))();
  }, [db]);

  return (
    <main className={styles.home} ref={ref}>
      <section>
        <div className={styles.intro}>
          <div
            className={styles.logo}
            style={{ "--neon": "#fff" } as React.CSSProperties}
          >
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
          {ProviderRegistry.map((provider) => (
            <div
              key={provider.slug}
              style={
                {
                  "--neon-hex": provider.neonColor,
                  "--neon-hdr": provider.neonColorHDR,
                } as React.CSSProperties
              }
            >
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
