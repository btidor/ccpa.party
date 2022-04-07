// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { Database } from "database";

import styles from "Drilldown.module.css";

import type { DataFile } from "database";
import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +selected?: number,
|};

function Files(props: Props): React.Node {
  const navigate = useNavigate();
  const { provider, selected } = props;

  const [items, setItems] = React.useState(
    (undefined: ?$ReadOnlyArray<DataFile>)
  );
  const [item, setItem] = React.useState((undefined: ?DataFile));
  React.useEffect(() => {
    (async () => {
      const db = new Database();
      const files = await db.getFilesForProvider(provider);
      setItems(files);

      selected &&
        files[selected] &&
        setItem(await db.getFileWithData(files[selected]));
    })();
  }, [provider, selected]);

  const renderItem = (index) => {
    if (!items?.[index]) return;
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
        <div className={styles.container} style={{ "--left-width": "30vw" }}>
          <div className={styles.left}>
            <div className={styles.bar}></div>
            {!items || items.length === 0 ? (
              <code className={styles.loading}>
                {items ? "😮 No Results" : "📊 Loading..."}
              </code>
            ) : (
              <Virtuoso totalCount={items.length} itemContent={renderItem} />
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              {selected !== undefined && items?.[selected]?.path}
            </div>
            <div className={styles.inspector}>
              {(() => {
                if (!selected) return;
                if (!item)
                  return <code className={styles.loading}>📊 Loading...</code>;

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
      </main>
    </Theme>
  );
}

export default Files;
