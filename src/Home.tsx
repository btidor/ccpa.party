import React from "react";
import { Link, useLocation } from "react-router-dom";

import { Database } from "@/common/database";
import { ProviderRegistry } from "@/common/provider";
import Logo from "@/components/Logo";

import styles from "@/Home.module.css";

function Home(): JSX.Element {
  const location = useLocation();
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(
    () => ref.current?.scrollTo?.(location.state ? 9999 : 0, 0),
    [location, ref]
  );

  const [epoch, setEpoch] = React.useState(0);
  const [imported, setImported] = React.useState<Set<string>>();
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
