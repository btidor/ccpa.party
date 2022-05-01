// @flow
import * as React from "react";

import Logo from "components/Logo";
import { darkColor } from "provider";
import styles from "Request.module.css";

import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
|};

function Request(props: Props): React.Node {
  const { provider } = props;
  return (
    <main
      className={styles.request}
      style={{ "--primary": darkColor(provider) }}
    >
      <section>
        <span className={styles.logo}>
          <Logo />
        </span>
        <span className={styles.provider}>{provider.displayName} ⏎</span>
        <span className={styles.item}>
          <span className={styles.emoji}>👉</span>
          <pre>
            {`Google Takeout →

 under "My Activity"
  click second pill
   select JSON, not HTML`}
          </pre>
        </span>
        <span className={styles.item}>
          <span className={styles.emoji}>⏳</span>
          <pre>up to a few days</pre>
        </span>
        <span className={styles.item}>
          <span className={styles.emoji}>🧭</span>
          <pre>[Browse] Select a file...</pre>
        </span>
      </section>
    </main>
  );
}

export default Request;
