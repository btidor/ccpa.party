// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { BeakerIcon, DesktopDownloadIcon } from "@primer/octicons-react";

import FilePreview from "components/FilePreview";
import FileTree from "components/FileTree";
import Navigation from "components/Navigation";
import Placeholder from "components/Placeholder";
import Theme from "components/Theme";
import { Database, fileSizeLimitMB } from "database";

import styles from "Drilldown.module.css";

import type { DataFileKey, DataFile } from "database";
import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +selected?: number,
|};

function Files(props: Props): React.Node {
  const navigate = useNavigate();
  const { provider, selected } = props;

  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new Database(() => setEpoch(epoch + 1)),
    [epoch]
  );

  const [items, setItems] = React.useState(
    (undefined: ?$ReadOnlyArray<DataFileKey>)
  );
  React.useEffect(() => {
    (async () => {
      const items = await db.getFilesForProvider(provider);
      if (items.length === 0) navigate(`/${provider.slug}/import`);
      setItems(items);
    })();
  }, [db, navigate, provider]);

  const [item, setItem] = React.useState((undefined: DataFile | void));
  React.useEffect(() => {
    (async () => {
      setItem(
        selected && items?.[selected]
          ? await db.hydrateFile(items[selected])
          : undefined
      );
    })();
  }, [db, items, selected]);

  return (
    <Theme provider={provider}>
      <Navigation provider={provider} pageSlug="files" />
      <main className="thin">
        <div className={styles.container} style={{ "--left-width": "30vw" }}>
          <div className={styles.left}>
            <div className={styles.bar}></div>
            {!items || items.length === 0 ? (
              <Placeholder />
            ) : (
              <FileTree
                selected={selected}
                onSelect={(index) =>
                  navigate(
                    `/${provider.slug}/files` +
                      (selected === index ? "" : `@${index}`)
                  )
                }
              >
                {items}
              </FileTree>
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              <span>
                {selected !== undefined &&
                  items?.[selected]?.path.slice(1).join("/")}
              </span>
              <div className={styles.grow}></div>
              {item && (
                <div
                  className={styles.download}
                  onClick={() => {
                    provider.parse(item).then((e) => console.warn(e));
                  }}
                >
                  <BeakerIcon />
                </div>
              )}
              {item && (
                <a
                  className={styles.download}
                  download={item.path.slice(-1)[0]}
                  href={URL.createObjectURL(new Blob([item.data]))}
                >
                  <DesktopDownloadIcon />
                </a>
              )}
            </div>
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
      </main>
    </Theme>
  );
}

export default Files;
