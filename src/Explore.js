// @flow
import { openDB } from "idb";
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProvider } from "provider";
import "Explore.css";

let keys = [];
let items = {};
let categories = [];
let metadata;

function Explore(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);

  const [db, setDb] = React.useState(undefined);
  const [dataKey, setDataKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  const loadMoreRows = async (params) => {
    if (!db) return;
    await _loadMoreRows(db, params);
    setDataKey(dataKey + 1);
  };
  const _loadMoreRows = async (db, { startIndex, endIndex }) => {
    const results = await db.getAll(
      "slack.messages",
      // $FlowFixMe[prop-missing]
      IDBKeyRange.bound(keys[startIndex], keys[endIndex])
    );
    for (let i = startIndex; i <= endIndex; i++) {
      items[i] = results[i - startIndex];
    }
  };

  React.useEffect(() => {
    (async () => {
      const db = await openDB("data", 1);
      keys = await db.getAllKeys("slack.messages");
      categories = await provider.categories(db);
      metadata = await provider.metadata(db);
      if (keys.length > 0) {
        await _loadMoreRows(db, {
          startIndex: 0,
          endIndex: Math.min(100, keys.length),
        });
      }
      setDb(db);
    })();
  }, [provider]);

  if (!db) {
    return <div className="Explore">📊 Loading...</div>;
  } else {
    return (
      <div className="Explore">
        <div className="Explore-categories">
          <ul>
            {categories.map((category) => (
              <li key={category}>
                <Link to="/TODO">{category}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="Explore-listing">
          <Virtuoso
            totalCount={keys.length}
            itemContent={(index) => {
              if (!!items[index]) {
                return (
                  <div
                    className="Explore-item"
                    onClick={() => setDrilldownItem(index)}
                  >
                    {provider.render(items[index], metadata)}
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
        <div className="Explore-drilldown">
          {drilldownItem !== undefined && (
            <pre>{JSON.stringify(items[drilldownItem], undefined, 2)}</pre>
          )}
        </div>
      </div>
    );
  }
}

export default Explore;
