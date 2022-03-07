import { openDB } from "idb";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import AutoSizer from "react-virtualized/dist/commonjs/AutoSizer";
import { SupportedProviders } from "./constants";

import "./Explore.css";

function Explore() {
  const params = useParams();
  const provider = SupportedProviders.find(p => p.slug === params.provider);

  let db;
  let items = {};
  let users = {};
  const [itemCount, setItemCount] = useState(undefined);
  useEffect(() => {
    async function setup() {
      db = await openDB("data", 1);
      const rusers = await db.getAll("slack.users");
      for (const r of rusers) {
        users[r.id] = r;
      }
      const keys = await db.getAllKeys("slack.messages");
      for (let i = 0; i < keys.length; i++) {
        items[i] = [keys[i], undefined];
      }
      setItemCount(keys.length);
    }
    setup();
  })

  const isItemLoaded = index => (!!items[index] && !!items[index][1]);
  const loadMoreItems = async (start, end) => {
    for (let i = start; i < end; i++) {
      if (items[i] && !items[i][1]) {
        items[i][1] = await db.get("slack.messages", items[i][0])
      }
    }
  };

  if (provider.slug !== "slack") {
    return (
      <div className="Explore">Unknown provider: {provider.displayName}</div>
    );
  } else if (itemCount === undefined) {
    return (
      <div className="Explore">Loading...</div>
    )
  } else {
    return (
      <div className="Explore">
        <div className="Explore-categories">
          <ul>
            <li><a href="#">Users</a></li>
            <li><a href="#">Channels</a></li>
            <li><a href="#">Integration Logs</a></li>
            <li><a href="#">All Messages</a></li>
          </ul>
        </div>
        <div className="Explore-listing">
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref }) => (
              <AutoSizer>
                {({ height, width }) => (
                  <FixedSizeList
                    itemCount={itemCount}
                    onItemsRendered={onItemsRendered}
                    ref={ref}
                    height={height}
                    width={width}
                    itemSize={25}
                  >
                    {({ index, style }) => {
                      if (!isItemLoaded(index)) {
                        return (<div style={style}>Loading...</div>)
                      }
                      const item = items[index][1];
                      return (
                        <div style={style}>
                          {users[item.user].profile.display_name_normalized}: {item.text.slice(0, 80)}
                        </div>
                      );
                    }}
                  </FixedSizeList>
                )}
              </AutoSizer>
            )}
          </InfiniteLoader>
        </div>
        <div className="Explore-drilldown">
          <pre>{JSON.stringify({ example: "data", other: 123 }, undefined, 2)}</pre>
        </div>
      </div>
    );
  }
}

export default Explore;
