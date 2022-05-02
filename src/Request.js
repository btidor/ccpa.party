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
      className={`${styles.request} thin`}
      style={{ "--primary": darkColor(provider) }}
    >
      <section>
        <div className={styles.logo}>
          <Logo picker />
        </div>
        <div className={styles.provider}>{provider.displayName} ◆</div>

        <div className={styles.instruction}>
          <span className={styles.emoji}>👉</span>
          <div className={styles.pointer}>
            <a href="https://example.org/" target="_blank" rel="noreferrer">
              Google Takeout →
            </a>
            <pre>
              {`under "My Activity"
click second pill
& select JSON`}
            </pre>
          </div>
        </div>

        <div className={styles.instruction}>
          <span className={styles.emoji}>⏳</span>
          <code>results in up to a few days</code>
        </div>

        <div className={styles.instruction}>
          <span className={styles.emoji}>🧭</span>
          <div className={styles.import}>
            <input id="import" type="file" multiple accept=".zip,.tar.gz" />
            <label for="import">Import Archive ↑</label>
            <code></code>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Request;
