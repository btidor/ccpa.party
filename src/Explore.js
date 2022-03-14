// @flow
import { openDB } from "idb";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProviderView } from "provider";
import Navigator from "Navigator";

import styles from "Explore.module.css";

import type { Provider, View } from "provider";

type Cache<M> = {
  provider: Provider,
  view: View<M>,
  metadata: M,

  db: any,
  keys: $ReadOnlyArray<string>,
  items: { [key: number]: { [key: string]: any } },
};

let cache: ?Cache<any>;

function Explore(): React.Node {
  const params = useParams();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  const loadMoreRows = async (params) => {
    if (!cache) return;
    await _loadMoreRows(cache, params);
    setRefreshKey(refreshKey + 1);
  };
  const _loadMoreRows = async (cache, { startIndex, endIndex }) => {
    let finish =
      endIndex >= cache.keys.length ? cache.keys.length - 1 : endIndex;
    const results = await cache.db.getAll(
      cache.view.table,
      // $FlowFixMe[prop-missing]
      IDBKeyRange.bound(cache.keys[startIndex], cache.keys[finish])
    );
    for (let i = startIndex; i <= finish; i++) {
      cache.items[i] = results[i - startIndex];
    }
  };

  React.useEffect(() => {
    (async () => {
      const [provider, view] = await getProviderView(
        params.provider,
        params.view
      );
      if (!view) {
        const destination = provider.defaultView || provider.views()[0].slug;
        navigate(`/explore/${provider.slug}/${destination}`, { replace: true });
        return;
      }
      const db = await openDB("data", 1);
      const keys = await db.getAllKeys(view.table);
      const metadata = await view.metadata(db);
      cache = {
        provider,
        view,
        metadata,
        db,
        keys,
        items: {},
      };
      if (keys.length > 0) {
        await _loadMoreRows(cache, {
          startIndex: 0,
          endIndex: Math.min(100, keys.length),
        });
      }
      setRefreshKey(1);
    })();
  }, [params, navigate]);

  if (!cache) {
    return <main>📊 Loading...</main>;
  } else {
    return (
      <React.Fragment>
        <Navigator provider={cache.provider} selected={params.view} />
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={cache.keys.length}
              itemContent={(index) => {
                if (cache && cache.items[index]) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {cache.view.render(cache.items[index], cache.metadata)}
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
              <pre>{cache.view.drilldown(cache.items[drilldownItem])}</pre>
            )}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Explore;
