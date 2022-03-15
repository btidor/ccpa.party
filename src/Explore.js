// @flow
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getDbProviderView } from "provider";
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
      cache.view.slug,
      // $FlowFixMe[prop-missing]
      IDBKeyRange.bound(cache.keys[startIndex], cache.keys[finish])
    );
    for (let i = startIndex; i <= finish; i++) {
      cache.items[i] = results[i - startIndex];
    }
  };

  React.useEffect(() => {
    (async () => {
      const [db, provider, view] = await getDbProviderView(
        params.provider,
        params.view
      );
      if (!view) {
        const destination = provider.defaultView || provider.views(db)[0].slug;
        navigate(`/explore/${provider.slug}/${destination}`, { replace: true });
        return;
      }
      const keys = await db.getAllKeys(view.slug);
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
        <Navigator
          db={cache.db}
          provider={cache.provider}
          selected={params.view}
        />
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={cache.keys.length}
              itemContent={(index) => {
                if (cache && cache.items[index]) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {cache.view.render(
                        cache.keys[index],
                        cache.items[index],
                        cache.metadata
                      )}
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
            {(() => {
              if (!cache || typeof drilldownItem !== "number") {
                return;
              }
              const item = cache.items[drilldownItem];
              if (item instanceof Blob) {
                const filename = cache.keys[drilldownItem];
                const url = URL.createObjectURL(item);
                return (
                  <React.Fragment>
                    <img
                      src={url}
                      alt="uploaded content"
                      className={styles.media}
                    />
                    <a href={url} download={filename}>
                      Download
                    </a>
                  </React.Fragment>
                );
              } else if (typeof item === "string") {
                let content = item;
                try {
                  content = JSON.stringify(JSON.parse(item), undefined, 2);
                } catch {}
                return <pre>{content}</pre>;
              } else {
                return <pre>{JSON.stringify(item, undefined, 2)}</pre>;
              }
            })()}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Explore;
