import { TrashIcon } from "@primer/octicons-react";
import React from "react";

import type { Provider } from "@src/common/provider";
import { Link } from "@src/common/router";
import Logo from "@src/components/Logo";
import { useBrowserSupport, useProviderDatabase } from "@src/database/hooks";
import { importFiles, resetProvider } from "@src/worker/client";

import styles from "@src/Request.module.css";

type Props<T> = {
  provider: Provider<T>;
};

type Status =
  | { type: "explore" }
  | { type: "import" }
  | { type: "pending"; progress: number | void }
  | { type: "unsupported" };

function Request<T>(props: Props<T>): JSX.Element {
  const { provider } = props;

  const support = useBrowserSupport();
  const db = useProviderDatabase(provider);
  const [status, setStatus] = React.useState<Status>();

  React.useEffect(() => {
    (async () => {
      if (support === false) {
        setStatus({ type: "unsupported" });
      } else if (support === true && db) {
        const imported = (await db.getProviders()).has(provider.slug);
        setStatus((status) => {
          if (imported) return { type: "explore" };
          else if (status?.type === "pending") return status;
          else return { type: "import" };
        });
      }
    })();
  }, [db, provider, support]);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const fileHandler: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    (async () => {
      if (!event.target.files) return;
      setStatus({ type: "pending", progress: 0 });
      await importFiles(provider, event.target.files, (progress: number) =>
        setStatus({ type: "pending", progress })
      );
      setStatus({ type: "explore" });
    })();
  };

  const resetHandler: React.ChangeEventHandler<unknown> = () => {
    (async () => {
      setStatus({ type: "pending", progress: undefined });
      await resetProvider(provider);
      setStatus({ type: "import" });
      // Reset file input (for Chrome)
      if (inputRef?.current) inputRef.current.value = "";
    })();
  };

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
            {status?.type === "explore" ? (
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
            ) : status?.type === "import" ? (
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
            ) : status?.type === "pending" ? (
              <code>
                {status.progress === undefined
                  ? "..."
                  : `${Math.min(Math.round(status.progress * 100), 99)
                      .toString()
                      .padStart(2, "0")}%`}
              </code>
            ) : status?.type === "unsupported" ? (
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
