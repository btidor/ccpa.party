import { TrashIcon } from "@primer/octicons-react";
import React from "react";

import type { Provider } from "@src/common/provider";
import { Link } from "@src/common/router";
import { archiveSuffixes } from "@src/common/util";
import Logo from "@src/components/Logo";
import { useBrowserSupport, useProviderDatabase } from "@src/database/hooks";
import { importFiles, listProfiles, resetProvider } from "@src/worker/client";

import styles from "@src/Request.module.css";

type Props<T> = {
  provider: Provider<T>;
};

type Status =
  | { type: "explore" }
  | { type: "import" }
  | { type: "profile"; profiles: string[]; files: FileList }
  | { type: "pending"; action: "importing" | "clearing"; progress: number }
  | { type: "unsupported" };

function UploadLink(props: {
  children: string | string[];
  inputRef: React.RefObject<HTMLInputElement>;
}): JSX.Element {
  const { children, inputRef } = props;
  return (
    <label
      htmlFor="import"
      tabIndex={0}
      onKeyDown={(e) => e.code === "Enter" && inputRef.current?.click()}
      role="button"
    >
      {children}
    </label>
  );
}

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

  const finishImport = async (files: FileList, profile?: string) => {
    setStatus({ type: "pending", action: "importing", progress: 0 });
    await importFiles(provider, profile, files, (progress: number) =>
      setStatus({ type: "pending", action: "importing", progress })
    );
    setStatus({ type: "explore" });
  };

  const fileHandler: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    (async () => {
      if (!event.target.files) return;
      const profiles = await listProfiles(provider, event.target.files);
      if (!profiles) {
        await finishImport(event.target.files);
      } else if (profiles.length === 1) {
        await finishImport(event.target.files, profiles[0]);
      } else {
        setStatus({ type: "profile", profiles, files: event.target.files });
      }
    })();
  };

  const resetHandler: React.ChangeEventHandler<unknown> = () => {
    (async () => {
      setStatus({ type: "pending", action: "clearing", progress: 0 });
      await resetProvider(provider);
      setStatus({ type: "import" });
      // Reset file input (for Chrome)
      if (inputRef?.current) inputRef.current.value = "";
    })();
  };

  if (status?.type === "profile") {
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
          <ul className={styles.profiles}>
            {status.profiles.map((profile) => (
              <li>
                <button
                  key={profile}
                  onClick={() => finishImport(status.files, profile)}
                >
                  {profile}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <div></div>
        <div></div>
      </main>
    );
  }

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
              accept={archiveSuffixes.join(",")}
              ref={inputRef}
              onChange={fileHandler}
            />
            {status?.type === "explore" ? (
              <React.Fragment>
                <div className={styles.explore}>
                  <Link to={`/${provider.slug}/timeline`}>Explore →</Link>
                  <div className={styles.grow}></div>
                  <div className={styles.reset}>
                    <button aria-label="reset" onClick={resetHandler}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {!provider.singleFile && (
                  <div className={styles.more}>
                    <UploadLink inputRef={inputRef}>+ Add File</UploadLink>
                  </div>
                )}
              </React.Fragment>
            ) : status?.type === "import" ? (
              <UploadLink inputRef={inputRef}>
                Import {provider.fileName} ↑
              </UploadLink>
            ) : status?.type === "pending" ? (
              (() => {
                const bars = Math.round(status.progress * 25);
                return (
                  <code
                    role="progressbar"
                    aria-valuenow={Math.round(status.progress * 100)}
                    aria-label={status.action}
                  >
                    {"▓".repeat(bars) + "░".repeat(25 - bars)}
                  </code>
                );
              })()
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
