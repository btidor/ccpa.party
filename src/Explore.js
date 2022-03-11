// @flow
import { openDB } from "idb";
import * as React from "react";
import { useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProviderView } from "provider";
import Navigator from "Navigator";

import styles from "Explore.module.css";

let keys = [];
let items = {};
let categories = [];
let metadata;
let provider;
let view;

function Explore(): React.Node {
  const params = useParams();

  const [db, setDb] = React.useState(undefined);
  const [dataKey, setDataKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  const loadMoreRows = async (params) => {
    if (!db) return;
    await _loadMoreRows(db, params);
    setDataKey(dataKey + 1);
  };
  const _loadMoreRows = async (db, { startIndex, endIndex }) => {
    let finish = endIndex >= keys.length ? keys.length - 1 : endIndex;
    const results = await db.getAll(
      view.table,
      // $FlowFixMe[prop-missing]
      IDBKeyRange.bound(keys[startIndex], keys[finish])
    );
    for (let i = startIndex; i <= finish; i++) {
      items[i] = results[i - startIndex];
    }
  };

  React.useEffect(() => {
    (async () => {
      [provider, view] = await getProviderView(params.provider, params.view);
      const db = await openDB("data", 1);
      keys = await db.getAllKeys(view.table);
      categories = await provider.views(db);
      metadata = await view.metadata(db);
      if (keys.length > 0) {
        await _loadMoreRows(db, {
          startIndex: 0,
          endIndex: Math.min(100, keys.length),
        });
      }
      setDb(db);
    })();
  }, [params]);

  if (!db) {
    return <main>📊 Loading...</main>;
  } else {
    return (
      <React.Fragment>
        <Navigator
          provider={provider}
          views={categories}
          selected={params.view}
        />
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={keys.length}
              itemContent={(index) => {
                if (!!items[index]) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {view.render(items[index], metadata)}
                    </div>
                  );
                } else {
                  return <div>Loading... #{index}</div>;
                }
              }}
              overscan={200}
              rangeChanged={loadMoreRows}
            />
          </div>
          <div className={styles.drilldown}>
            {drilldownItem !== undefined && (
              <pre>{JSON.stringify(items[drilldownItem], undefined, 2)}</pre>
            )}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Explore;
