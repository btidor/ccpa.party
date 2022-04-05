// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { openFiles } from "parse";

import styles from "Drilldown.module.css";

import type { DataFile, Provider } from "provider";

type Props = {|
  +provider: Provider,
  +selected?: number,
|};

function Files(props: Props): React.Node {
  const navigate = useNavigate();
  const { provider, selected } = props;

  const [items, setItems] = React.useState(([]: $ReadOnlyArray<DataFile>));
  React.useEffect(() => {
    (async () => {
      const db = await openFiles();
      const files = await db.getAllFromIndex(
        "files",
        "provider",
        provider.slug
      );
      setItems(files);
    })();
  }, [provider]);

  const renderItem = (index) => {
    if (!items[index]) return;
    return (
      <div
        onClick={() =>
          navigate(
            `/${provider.slug}/files` +
              (selected === index ? "" : `@${index.toString()}`)
          )
        }
        className={[styles.listItem, styles.filePath].join(" ")}
        role="row"
        aria-selected={selected === index}
      >
        {items[index].path}
      </div>
    );
  };

  return (
    <Theme provider={provider}>
      <Navigation provider={provider} pageSlug="files" />
      <main className="thin">
        {!items ? (
          <React.Fragment>📊 Loading...</React.Fragment>
        ) : (
          <div className={styles.container} style={{ "--left-width": "30vw" }}>
            <div className={styles.left}>
              <div className={styles.bar}></div>
              <Virtuoso totalCount={items.length} itemContent={renderItem} />
            </div>
            <div className={styles.right}>
              <div className={styles.bar}>
                {selected !== undefined && items[selected]?.path}
              </div>
              <div className={styles.inspector}>
                {(() => {
                  const item = selected && items[selected];
                  if (!item) return;

                  const ext = item.path.split(".").slice(-1)[0];
                  switch (ext) {
                    case "json":
                      const parsed = JSON.parse(
                        new TextDecoder().decode(item.data)
                      );
                      return <pre>{JSON.stringify(parsed, undefined, 2)}</pre>;
                    case "txt":
                    case "csv":
                      const text = new TextDecoder().decode(item.data);
                      return <pre>{text}</pre>;
                    default:
                      const url = URL.createObjectURL(new Blob([item.data]));
                      return (
                        <React.Fragment>
                          <img src={url} alt="" className={styles.media} />
                          <a href={url} download={item.path}>
                            Download
                          </a>
                        </React.Fragment>
                      );
                  }
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </Theme>
  );
}

export default Files;
