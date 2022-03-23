// @flow
import { openDB } from "idb";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { autoParse } from "parse";
import { getProvider } from "provider";

import styles from "Explore.module.css";

import type { Entry } from "parse";

let items: $ReadOnlyArray<Entry>;

function Explore(): React.Node {
  const params = useParams();
  const navigate = useNavigate();

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
      items = files.flatMap((file) => autoParse(file, provider));
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
                      {[items[index].file.path, items[index].label]
                        .filter((x) => x)
                        .join("—")}
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
              const item: Entry = items[drilldownItem];
              switch (item.type) {
                case "activity":
                case "setting": {
                  return <pre>{JSON.stringify(item.value, undefined, 2)}</pre>;
                }
                case "media":
                case "unknown": {
                  if (item.file.path.endsWith(".txt")) {
                    const text = new TextDecoder().decode(item.file.data);
                    return <pre>{text}</pre>;
                  } else {
                    const url = URL.createObjectURL(new Blob([item.file.data]));
                    return (
                      <React.Fragment>
                        <img src={url} alt="" className={styles.media} />
                        <a href={url} download={item.file.path}>
                          Download
                        </a>
                      </React.Fragment>
                    );
                  }
                }
                default:
                  console.error("Unknown Entry type", item.type);
              }
            })()}
          </div>
        </main>
      </React.Fragment>
    );
  }
}

export default Explore;
