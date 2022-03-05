import { openDB } from "idb";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import { SupportedProviders } from "./constants";

function Explore() {
  const params = useParams();
  const provider = SupportedProviders.find(p => p.slug === params.provider);

  let db;
  let items = {};
  const [itemCount, setItemCount] = useState(undefined);
  useEffect(() => {
    async function setup() {
      db = await openDB("data", 1);
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
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <FixedSizeList
              itemCount={itemCount}
              onItemsRendered={onItemsRendered}
              ref={ref}
              width="100%"
              height={250}
              itemSize={25}
            >
              {({ index, style }) => {
                let content;
                if (!isItemLoaded(index)) {
                  content = "Loading...";
                } else {
                  content = (<pre>{JSON.stringify(items[index][1])}</pre>)
                }
                return (<div style={style}>{content}</div>);
              }}
            </FixedSizeList>
          )}
        </InfiniteLoader>
      </div>
    );
  }
}

export default Explore;
