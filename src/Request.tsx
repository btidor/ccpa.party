import { TrashIcon } from "@primer/octicons-react";
import React from "react";
import { Link } from "react-router-dom";

import { ProviderScopedDatabase } from "@/common/database";
import { importFiles, resetProvider } from "@/common/importer";
import type { Provider } from "@/common/provider";
import Logo from "@/components/Logo";

import styles from "@/Request.module.css";

type Props<T> = {
  provider: Provider<T>;
};

type Display = "explore" | "import" | "pending" | "error";

function Request<T>(props: Props<T>): JSX.Element {
  const { provider } = props;

  const [db, setDb] = React.useState<ProviderScopedDatabase<T>>();
  const [display, setDisplay] = React.useState<Display>();
  const [epoch, setEpoch] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  React.useEffect(
    () =>
      setDb(
        new ProviderScopedDatabase(
          provider,
          () => setEpoch(epoch + 1),
          () => setDisplay("error")
        )
      ),
    [epoch, provider]
  );

  React.useEffect(() => {
    (async () => {
      if (db) {
        const imported = (await db.getProviders()).has(provider.slug);
        setDisplay(imported ? "explore" : "import");
        setErrors(await db.getErrors());
      }
    })();
  }, [db, provider]);

  const fileHandler: React.ChangeEventHandler<HTMLInputElement> = (event) =>
    event.target.files &&
    (setDisplay("pending"),
    importFiles(provider, event.target.files, () => setEpoch(epoch + 1)));
  const resetHandler: React.ChangeEventHandler<any> = () => (
    setDisplay("pending"), resetProvider(provider, () => setEpoch(epoch + 1))
  );

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
                {errors ? (
                  <div className={styles.errors}>
                    (imported with {errors} {errors > 1 ? "errors" : "error"})
                  </div>
                ) : undefined}
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
