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
      style={{ "--dark": darkColor(provider) }}
    >
      {/* HACK: place extra <div>s so that vertical spacing gets distriuted
          in a 2:3 ratio above/below the <section> */}
      <div></div>
      <section>
        <div className={styles.logo}>
          <Logo picker />
        </div>
        <div className={styles.provider}>{provider.displayName} ◆</div>

        <div className={styles.instruction}>
          <span className={styles.emoji}>👉</span>
          <div className={styles.pointer}>
            <a
              href={provider.requestLink.href}
              target="_blank"
              rel="noreferrer"
            >
              {provider.requestLink.text} →
            </a>
            {!!provider.instructions.length && (
              <pre>{provider.instructions.join("\n")}</pre>
            )}
          </div>
        </div>

        <div className={styles.instruction}>
          <span className={styles.emoji}>⏳</span>
          <code>results in {provider.waitTime}</code>
        </div>

        <div className={styles.instruction}>
          <span className={styles.emoji}>🧭</span>
          <div className={styles.import}>
            <input id="import" type="file" multiple accept=".zip,.tar.gz" />
            <label htmlFor="import">Import Archive ↑</label>
            <code></code>
          </div>
        </div>
      </section>
      <div></div>
      <div></div>
    </main>
  );
}

export default Request;
