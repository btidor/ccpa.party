// @flow
import { openDB } from "idb";
import * as React from "react";
import { useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProvider } from "provider";

import styles from "Explore.module.css";

import type { ActivityEvent, Provider } from "provider";

type Cache = {|
  db: any,
  provider: Provider,
  rows: Array<ActivityEvent<any>>,
|};

let cache: ?Cache;

function Activity(): React.Node {
  const params = useParams();

  const [, setRefreshKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      const provider = getProvider(params.provider);
      const db = await openDB(provider.slug);

      const rows = await provider.activityEvents(db);
      for (const row of rows) {
        if (row.timestamp > 9999999999) row.timestamp /= 1000;
      }
      rows.sort((a, b) => b.timestamp - a.timestamp);
      cache = {
        db,
        provider,
        rows,
      };
      setRefreshKey(1);
    })();
  }, [params]);

  if (!cache) {
    return <main>📊 Loading...</main>;
  } else {
    return (
      <React.Fragment>
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={cache.rows.length}
              itemContent={(index) => {
                const row = cache && cache.rows[index];
                if (row) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {row.view.render(row.label, row.data, row.metadata)}
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
              if (!cache || typeof drilldownItem !== "number") {
                return;
              }
              const row = cache.rows[drilldownItem];
              if (row.data instanceof Blob) {
                const filename = row.label;
                const url = URL.createObjectURL(row.data);
                return (
                  <React.Fragment>
                    <img src={url} alt="" className={styles.media} />
                    <a href={url} download={filename}>
                      Download
                    </a>
                  </React.Fragment>
                );
              } else if (typeof row.data === "string") {
                let content = row.value;
                try {
                  content = JSON.stringify(JSON.parse(row.data), undefined, 2);
                } catch {}
                return <pre>{content}</pre>;
              } else {
                return <pre>{JSON.stringify(row.data, undefined, 2)}</pre>;
              }
            })()}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Activity;
