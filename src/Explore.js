// @flow
import { openDB } from "idb";
import * as React from "react";
import { useParams } from "react-router-dom";
import { InfiniteLoader } from "react-virtualized";
import { Virtuoso } from "react-virtuoso";
import { SupportedProviders } from "constants";

import "Explore.css";

function Explore(): React.Node {
  const params = useParams();
  const provider = SupportedProviders.find((p) => p.slug === params.provider);

  const [db, setDb] = React.useState(undefined);
  const [keys, setKeys] = React.useState(undefined);
  const [items, setItems] = React.useState({});
  const [ready, setReady] = React.useState(false);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  const isRowLoaded = (index) => !!items[index];
  const loadMoreRows = async ({ startIndex, endIndex }) => {
    for (let i = startIndex; i < endIndex; i++) {
      if (!items[i]) {
        items[i] = await (db: any).get("slack.messages", (keys: any)[i]);
        setItems(items);
      }
    }
    setReady(true);
  };

  React.useEffect(() => {
    async function setup() {
      const db = await openDB("data", 1);
      setDb(db);
      setKeys(await db.getAllKeys("slack.messages"));
    }
    setup();
  }, []);
  React.useEffect(() => {
    if (!!keys) {
      loadMoreRows({ startIndex: 0, endIndex: 100 });
    }
  }, [keys]);

  if (!provider || provider.slug !== "slack") {
    return <div className="Explore">Unknown provider: {params.provider}</div>;
  } else if (!ready || !keys || !items) {
    return <div className="Explore">📊 Loading...</div>;
  } else {
    return (
      <div className="Explore">
        <div className="Explore-categories">
          <ul>
            <li>
              <a href="#">Users</a>
            </li>
            <li>
              <a href="#">Channels</a>
            </li>
            <li>
              <a href="#">Integration Logs</a>
            </li>
            <li>
              <a href="#">All Messages</a>
            </li>
          </ul>
        </div>
        <div className="Explore-listing">
          <InfiniteLoader
            isRowLoaded={isRowLoaded}
            loadMoreRows={loadMoreRows}
            rowCount={keys.length}
          >
            {({ onRowsRendered, registerChild }) => (
              <Virtuoso
                itemsRendered={onRowsRendered}
                ref={registerChild}
                totalCount={keys.length}
                itemContent={(i) => {
                  if (!!items[i]) {
                    let name;
                    if (!!items[i].user_profile) {
                      name =
                        items[i].user_profile.display_name ||
                        items[i].user_profile.real_name;
                    } else {
                      name = "<unknown>";
                    }
                    let message = items[i].text;
                    if (items[i].files || items[i].attachments) {
                      message += " <attachment>";
                    }
                    return (
                      <div onClick={() => setDrilldownItem(i)}>
                        {name}: {message}
                      </div>
                    );
                  } else {
                    return <div>Loading...</div>;
                  }
                }}
                overscan={200}
                rangeChanged={loadMoreRows}
              />
            )}
          </InfiniteLoader>
        </div>
        <div className="Explore-drilldown">
          <pre>{JSON.stringify(items[drilldownItem || ""], undefined, 2)}</pre>
        </div>
      </div>
    );
  }
}

export default Explore;
