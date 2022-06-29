import { TrashIcon } from "@primer/octicons-react";
import React from "react";

import type { Provider } from "@src/common/provider";
import { Link } from "@src/common/router";
import isBrowserSupported from "@src/common/support";
import Logo from "@src/components/Logo";
import { useProviderDatabase } from "@src/database/hooks";
import { importFiles, resetProvider } from "@src/worker";

import styles from "@src/Request.module.css";

type Props<T> = {
  provider: Provider<T>;
};

type Display = "explore" | "import" | "pending" | "error";

function Request<T>(props: Props<T>): JSX.Element {
  const { provider } = props;

  const db = useProviderDatabase(provider);
  const [display, setDisplay] = React.useState<Display>();

  React.useEffect(() => {
    (async () => {
      if (!(await isBrowserSupported())) {
        setDisplay("error");
      } else if (db) {
        const imported = (await db.getProviders()).has(provider.slug);
        setDisplay(imported ? "explore" : "import");
      }
    })();
  }, [db, provider]);

  const fileHandler: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    (async () => {
      if (!event.target.files) return;
      setDisplay("pending");
      await importFiles(provider, event.target.files);
      // TODO: WritableDatabase should reload all database connections on commit
    })();
  };

  const resetHandler: React.ChangeEventHandler<unknown> = () => {
    (async () => {
      setDisplay("pending");
      await resetProvider(provider);
      // TODO: WritableDatabase should reload all database connections on commit
    })();
  };

  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <main
      className={styles.request}
      style={
        {
          "--neon-hex": provider.neonColor,
          "--neon-hdr": provider.neonColorHDR,
        } as React.CSSProperties
      }
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
              accept=".zip,.tar.gz,.tgz,.gz"
              ref={inputRef}
              onChange={fileHandler}
            />
            {display === "explore" ? (
              <React.Fragment>
                <div className={styles.import}>
                  <Link to={`/${provider.slug}/timeline`}>Explore →</Link>
                  <div className={styles.grow}></div>
                  <div className={styles.reset}>
                    <button aria-label="reset" onClick={resetHandler}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            ) : display === "import" ? (
              <label
                htmlFor="import"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.code === "Enter" && inputRef.current?.click()
                }
                role="button"
              >
                Import {provider.fileName} ↑
              </label>
            ) : display === "pending" ? (
              <code>...</code>
            ) : display === "error" ? (
              <code>[Browser Not Supported]</code>
            ) : undefined}
          </div>
        </div>
      </section>
      <div></div>
      <div></div>
    </main>
  );
}

export default Request;
