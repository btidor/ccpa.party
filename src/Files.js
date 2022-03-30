// @flow
import * as React from "react";
import { useParams } from "react-router-dom";

import Drilldown from "components/Drilldown";
import Navigation from "components/Navigation";
import { openFiles } from "parse";
import { getProvider } from "provider";

import styles from "Files.module.css";

import type { DataFile } from "provider";

function Files(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);

  const [items, setItems] = React.useState(([]: $ReadOnlyArray<DataFile>));
  React.useEffect(() => {
    (async () => {
      const db = await openFiles();
      const files = await db.getAllFromIndex(
        "files",
        "provider",
        provider.slug
      );
      setItems(files);
    })();
  }, [provider]);

  return (
    <React.Fragment>
      <Navigation provider={provider} />
      <main className="thin">
        <Drilldown
          items={items}
          renderRow={(item) => <div className={styles.row}>{item.path}</div>}
          renderDrilldown={(item) => {
            const ext = item.path.split(".").slice(-1)[0];
            switch (ext) {
              case "json":
                const parsed = JSON.parse(new TextDecoder().decode(item.data));
                return <pre>{JSON.stringify(parsed, undefined, 2)}</pre>;
              case "txt":
              case "csv":
                const text = new TextDecoder().decode(item.data);
                return <pre>{text}</pre>;
              default:
                const url = URL.createObjectURL(new Blob([item.data]));
                return (
                  <React.Fragment>
                    <img src={url} alt="" className={styles.media} />
                    <a href={url} download={item.path}>
                      Download
                    </a>
                  </React.Fragment>
                );
            }
          }}
          listWidth="30vw"
        />
      </main>
    </React.Fragment>
  );
}

export default Files;
