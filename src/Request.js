// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Logo from "components/Logo";
import { WritableDatabase } from "common/database";
import { darkColor, importFiles } from "common/provider";

import styles from "Request.module.css";

import type { Provider } from "common/provider";

type Props = {|
  +provider: Provider,
|};

function Request(props: Props): React.Node {
  const { provider } = props;
  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new WritableDatabase(provider, () => setEpoch(epoch + 1)),
    [epoch, provider]
  );

  const [progress, setProgress] = React.useState(undefined);
  const fileHandler = (event) =>
    importFiles(db, provider, event.target.files, setProgress);

  const inputRef = React.useRef<?HTMLInputElement>();
  return (
    <main className={styles.request} style={{ "--dark": darkColor(provider) }}>
      {/* HACK: place extra <div>s so that vertical spacing gets distriuted
          in a 2:3 ratio above/below the <section> */}
      <div></div>
      <section>
        <header>
          <Logo block="request" party="plain" picker />
          <div className={styles.provider}>{provider.displayName} ◆</div>
        </header>

        <div className={styles.instruction}>
          <span className={styles.emoji}>👉</span>
          <div className={styles.finger}>
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
          <div className={styles.compass}>
            {" "}
            <input
              id="import"
              type="file"
              multiple
              accept=".zip,.tar.gz"
              ref={inputRef}
              onChange={fileHandler}
            />
            {progress === undefined ? (
              <label
                htmlFor="import"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.code === "Enter" && inputRef.current?.click()
                }
              >
                Import Archive ↑
              </label>
            ) : progress === true ? (
              <Link to={`/${provider.slug}/timeline`}>Explore →</Link>
            ) : (
              <code>importing {progress.toLocaleString()} items</code>
            )}
          </div>
        </div>
      </section>
      <div></div>
      <div></div>
    </main>
  );
}

export default Request;
