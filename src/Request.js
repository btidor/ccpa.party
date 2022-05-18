// @flow
import * as React from "react";
import { Link } from "react-router-dom";
import { TrashIcon } from "@primer/octicons-react";

import { Database } from "common/database";
import { importFiles, resetProvider } from "common/importer";

import Logo from "components/Logo";

import styles from "Request.module.css";

import type { Provider } from "common/provider";

type Props = {|
  +provider: Provider,
|};

function Request(props: Props): React.Node {
  const { provider } = props;
  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new Database(() => setEpoch(epoch + 1)),
    [epoch]
  );

  const [imported, setImported] = React.useState();
  React.useEffect(() => {
    (async () => (
      setImported((await db.getProviders()).has(provider.slug)),
      setInProgress(false)
    ))();
  }, [db, provider]);

  const [inProgress, setInProgress] = React.useState(false);
  const fileHandler = (event) => (
    setInProgress(true),
    importFiles(provider, event.target.files, () => setEpoch(epoch + 1))
  );
  const resetHandler = (event) => (
    setInProgress(true), resetProvider(provider, () => setEpoch(epoch + 1))
  );

  const inputRef = React.useRef<?HTMLInputElement>();
  return (
    <main
      className={styles.request}
      style={{
        "--neon-hex": provider.neonColor,
        "--neon-hdr": provider.neonColorHDR,
      }}
    >
      {/* HACK: place extra <div>s so that vertical spacing gets distriuted
          in a 2:3 ratio above/below the <section> */}
      <div></div>
      <section>
        <header>
          <div className={styles.logo}>
            <Logo block="request" party="plain" picker />
          </div>
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
            {imported === undefined ? undefined : imported ? (
              <React.Fragment>
                <Link to={`/${provider.slug}/timeline`}>Explore →</Link>
                <div className={styles.grow}></div>
                <div className={styles.reset}>
                  <button aria-label="reset" onClick={resetHandler}>
                    <TrashIcon />
                  </button>
                </div>
              </React.Fragment>
            ) : inProgress ? (
              <code>...</code>
            ) : (
              <label
                htmlFor="import"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.code === "Enter" && inputRef.current?.click()
                }
                role="button"
              >
                Import {provider.singleFile ? "File" : "Files"} ↑
              </label>
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
