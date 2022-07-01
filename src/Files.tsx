import { BeakerIcon, DesktopDownloadIcon } from "@primer/octicons-react";
import React from "react";

import { parseByStages } from "@src/common/parse";
import type { Provider } from "@src/common/provider";
import { Navigate, useNavigate } from "@src/common/router";
import FilePreview from "@src/components/FilePreview";
import FileTree from "@src/components/FileTree";
import Navigation from "@src/components/Navigation";
import Placeholder from "@src/components/Placeholder";
import { useProviderDatabase } from "@src/database/hooks";
import type { DataFile, DataFileKey } from "@src/database/types";
import { fileSizeLimitMB } from "@src/worker/types";

import styles from "@src/Drilldown.module.css";

type Props<T> = {
  provider: Provider<T>;
  selected?: string;
};

const FileParseAction = <T,>(props: {
  file: DataFile;
  provider: Provider<T>;
}): JSX.Element | null =>
  import.meta.env.DEV ? (
    <div
      className={styles.action}
      onClick={() => {
        parseByStages(props.provider, props.file).then((e) => console.warn(e));
      }}
    >
      <BeakerIcon />
    </div>
  ) : null;

const FileDownloadAction = (props: { file: DataFile }): JSX.Element => (
  <a
    className={styles.action}
    download={props.file.path.at(-1)}
    href={URL.createObjectURL(new Blob([props.file.data]))}
  >
    <DesktopDownloadIcon />
  </a>
);

function Files<T>(props: Props<T>): JSX.Element {
  const navigate = useNavigate();
  const { provider, selected } = props;

  const db = useProviderDatabase(props.provider);
  const [items, setItems] = React.useState<ReadonlyArray<DataFileKey>>();
  React.useEffect(() => {
    // When `provider` changes, immediately unset `items`. This prevents
    // components like FileTree from performing their initialization with
    // incorrect data (e.g. expanding the wrong root).
    setItems(undefined);
    (async () => {
      db && setItems(await db.getFiles());
    })();
  }, [db, provider]);

  const [item, setItem] = React.useState<DataFile>();
  React.useEffect(() => {
    // When `items` or `selected` changes, *don't* immediately unset `item`.
    // Rather than flashing a loading message, we allow the previous item to
    // ghost in the drilldown pane for a few moments while the next item is
    // loaded.
    (async () => {
      const key = items?.find((item) => item.slug === selected);
      setItem((db && key && (await db.hydrateFile(key))) || undefined);
    })();
  }, [db, items, selected]);

  if (items?.length === 0) {
    return <Navigate to={`/${provider.slug}`} />;
  }

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
      <Navigation provider={provider} pageSlug="files" />
      <main className={styles.drilldown}>
        <div
          className={styles.container}
          style={{ "--left-width": "30vw" } as React.CSSProperties}
        >
          <div className={styles.left}>
            <div className={styles.bar}></div>
            <div className={styles.box}>
              {!items || items.length === 0 ? (
                <Placeholder />
              ) : (
                <FileTree
                  items={items}
                  selected={item}
                  onSelect={(slug) =>
                    navigate(
                      `/${provider.slug}/files` +
                        (selected === slug ? "" : `@${slug}`)
                    )
                  }
                />
              )}
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              <span>{item && item.path.slice(1).join("/")}</span>
              <div className={styles.grow}></div>
              {item && <FileParseAction<T> file={item} provider={provider} />}
              {item && <FileDownloadAction file={item} />}
            </div>
            <div className={styles.box}>
              {selected === undefined ? undefined : item?.skipped ? (
                <Placeholder>
                  {`🐘 Not saved due to ${fileSizeLimitMB}MB size limit`}
                </Placeholder>
              ) : (
                <FilePreview filename={item?.path.at(-1)}>
                  {item?.data}
                </FilePreview>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Files;
