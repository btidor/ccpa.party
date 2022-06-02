import React from "react";

import { ProviderScopedDatabase } from "@src/common/database";
import type { Provider } from "@src/common/provider";
import Navigation from "@src/components/Navigation";

import styles from "@src/Errors.module.css";

type Props<T> = {
  provider: Provider<T>;
};

function Errors<T>(props: Props<T>): JSX.Element {
  const { provider } = props;

  const [_db, setDb] = React.useState<ProviderScopedDatabase<T>>();
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(
    () =>
      setDb(new ProviderScopedDatabase(provider, () => setEpoch(epoch + 1))),
    [epoch, provider]
  );

  return (
    <div
      className={styles.outer}
      style={
        {
          "--neon-hex": props.provider.neonColor,
          "--neon-hdr": props.provider.neonColorHDR,
        } as React.CSSProperties
      }
    >
      <Navigation provider={provider} pageSlug="timeline" />
      <main className={styles.drilldown}>
        <div>Hi There!</div>
        <div>Ligne Two</div>
      </main>
    </div>
  );
}

export default Errors;
