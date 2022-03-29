// @flow
import * as React from "react";
import { useParams } from "react-router-dom";

import Drilldown from "Drilldown";
import Navigation from "Navigation";
import { openFiles } from "parse";
import { getProvider } from "provider";

import type { ActivityEntry } from "parse";

function Activity(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);

  const [items, setItems] = React.useState(([]: $ReadOnlyArray<ActivityEntry>));
  React.useEffect(() => {
    (async () => {
      const db = await openFiles();
      const files = await db.getAllFromIndex(
        "files",
        "provider",
        provider.slug
      );

      const items = (provider
        .parse(files)
        .filter((e) => e.type === "activity"): any);
      items.sort((a, b) => b.timestamp - a.timestamp);
      setItems(items);
    })();
  }, [provider]);

  return (
    <React.Fragment>
      <Navigation provider={provider} />
      <main className="thin">
        <Drilldown
          items={items}
          renderRow={(item) => item.label}
          renderDrilldown={(item) => (
            <pre>
              From {item.file.path}:{"\n"}
              {JSON.stringify(item.value, undefined, 2)}
            </pre>
          )}
          listWidth="60vw"
        />
      </main>
    </React.Fragment>
  );
}

export default Activity;
