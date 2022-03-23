// @flow
import { openDB } from "idb";
import * as React from "react";
import { useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { getProvider } from "provider";

import styles from "Explore.module.css";

import type { ActivityEntry } from "parse";

let events: Array<ActivityEntry>;

function Activity(): React.Node {
  const params = useParams();

  const [, setRefreshKey] = React.useState(0);
  const [drilldownItem, setDrilldownItem] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      const provider = getProvider(params.provider);
      const db = await openDB("import");
      const files = await db.getAllFromIndex(
        "files",
        "provider",
        provider.slug
      );
      events = (provider
        .parse(files)
        .filter((e) => e.type === "activity"): any);
      events.sort((a, b) => b.timestamp - a.timestamp);
      setRefreshKey(1);
    })();
  }, [params]);

  if (!events) {
    return <main>📊 Loading...</main>;
  } else {
    return (
      <React.Fragment>
        <main className={styles.main}>
          <div className={styles.listing}>
            <Virtuoso
              totalCount={events.length}
              itemContent={(index) => {
                const event: ?ActivityEntry = events && events[index];
                if (event) {
                  return (
                    <div onClick={() => setDrilldownItem(index)}>
                      {event.label}
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
              if (!events || typeof drilldownItem !== "number") {
                return;
              }
              const event: ActivityEntry = events[drilldownItem];
              return (
                <pre>
                  From {event.file.path}:{"\n"}
                  {JSON.stringify(event.value, undefined, 2)}
                </pre>
              );
            })()}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Activity;
