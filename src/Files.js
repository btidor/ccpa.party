// @flow
import * as React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BeakerIcon, DesktopDownloadIcon } from "@primer/octicons-react";

import FilePreview from "components/FilePreview";
import FileTree from "components/FileTree";
import Navigation from "components/Navigation";
import Placeholder from "components/Placeholder";
import { ProviderScopedDatabase } from "common/database";
import { fileSizeLimitMB } from "common/importer";
import { darkColor } from "common/provider";

import styles from "Drilldown.module.css";

import type { DataFileKey, DataFile } from "common/database";
import type { Provider } from "common/provider";

type Props = {|
  +provider: Provider,
  +selected?: number,
|};

const FileParseAction = (props: {|
  +file: DataFile,
  +provider: Provider,
|}): React.Node => (
  <div
    className={styles.action}
    onClick={() => {
      props.provider.parse(props.file).then((e) => console.warn(e));
    }}
  >
    <BeakerIcon />
  </div>
);

const FileDownloadAction = (props: {| +file: DataFile |}): React.Node => (
  <a
    className={styles.action}
    download={props.file.path.slice(-1)[0]}
    href={URL.createObjectURL(new Blob([props.file.data]))}
  >
    <DesktopDownloadIcon />
  </a>
);

function Files(props: Props): React.Node {
  const navigate = useNavigate();
  const { provider, selected } = props;

  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new ProviderScopedDatabase(provider, () => setEpoch(epoch + 1)),
    [epoch, provider]
  );

  const [items, setItems] = React.useState(
    (undefined: ?$ReadOnlyArray<DataFileKey>)
  );
  React.useEffect(() => {
    // When `provider` changes, immediately unset `items`. This prevents
    // components like FileTree from performing their initialization with
    // incorrect data (e.g. expanding the wrong root).
    setItems();
    (async () => {
      setItems(await db.getFiles());
    })();
  }, [db, provider]);

  const [item, setItem] = React.useState((undefined: DataFile | void));
  React.useEffect(() => {
    // When `items` or `selected` changes, *don't* immediately unset `item`.
    // Rather than flashing a loading message, we allow the previous item to
    // ghost in the drilldown pane for a few moments while the next item is
    // loaded.
    (async () => {
      setItem(
        selected && items?.[selected]
          ? await db.hydrateFile(items[selected])
          : undefined
      );
    })();
  }, [db, items, selected]);

  if (items?.length === 0) {
    return <Navigate to={`/${provider.slug}`} />;
  }

  return (
    <div
      className={styles.outer}
      style={{ "--dark": darkColor(props.provider) }}
    >
      <Navigation provider={provider} pageSlug="files" />
      <main className={styles.drilldown}>
        <div className={styles.container} style={{ "--left-width": "30vw" }}>
          <div className={styles.left}>
            <div className={styles.bar}></div>
            <div className={styles.box}>
              {!items || items.length === 0 ? (
                <Placeholder />
              ) : (
                <FileTree
                  items={items}
                  selected={selected}
                  onSelect={(index) =>
                    navigate(
                      `/${provider.slug}/files` +
                        (selected === index ? "" : `@${index}`)
                    )
                  }
                />
              )}
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              <span>
                {selected !== undefined &&
                  items?.[selected]?.path.slice(1).join("/")}
              </span>
              <div className={styles.grow}></div>
              {item && <FileParseAction file={item} provider={provider} />}
              {item && <FileDownloadAction file={item} />}
            </div>
            <div className={styles.box}>
              {!selected ? undefined : item?.skipped ? (
                <FilePreview>
                  {`🐘 Not imported due to ${fileSizeLimitMB}MB size limit`}
                </FilePreview>
              ) : (
                <FilePreview filename={item?.path.slice(-1)[0]}>
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
