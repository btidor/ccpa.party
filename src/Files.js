// @flow
import { openDB } from "idb";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProvider } from "provider";

import styles from "Files.module.css";

import type { DataFile } from "provider";

let items: $ReadOnlyArray<DataFile>;

function Files(): React.Node {
  const params = useParams();
  const navigate = useNavigate();

  const [, setRefreshKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      const provider = getProvider(params.provider);
      const db = await openDB("import");
      items = await db.getAllFromIndex("files", "provider", provider.slug);
      setRefreshKey(1);
    })();
  }, [params, navigate]);

  if (!items) {
    return <main>📊 Loading...</main>;
  } else {
    return (
      <React.Fragment>
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={items.length}
              itemContent={(index) => {
                if (items && items[index]) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {items[index].path}
                    </div>
                  );
                } else {
                  return <div>Loading... #{index}</div>;
                }
              }}
            />
          </div>
          <div className={styles.drilldown}>
            {(() => {
              if (!items || typeof drilldownItem !== "number") {
                return;
              }
              const item: DataFile = items[drilldownItem];
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
        </main>
      </React.Fragment>
    );
  }
}

export default Files;
