// @flow
import * as React from "react";
import { useParams } from "react-router-dom";

import Drilldown from "components/Drilldown";
import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { openFiles } from "parse";
import { getProvider } from "provider";

import type { TimelineEntry } from "parse";

function Timeline(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);

  const [items, setItems] = React.useState(([]: $ReadOnlyArray<TimelineEntry>));
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
        .filter((e) => e.type === "timeline"): any);
      items.sort((a, b) => b.timestamp - a.timestamp);
      setItems(items);
    })();
  }, [provider]);

  const categories = [...provider.categoryLabels.entries()].map(([k, v]) => ({
    title: v,
    filter: (e) => e.subtype === k,
  }));

  return (
    <Theme provider={provider}>
      <Navigation provider={provider} />
      <main className="thin">
        <Drilldown
          baseLink={`/${provider.slug}/timeline`}
          categories={categories}
          drilldownTitle={(item) => `From ${item.file.path}:`}
          grouper={(item) =>
            new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date(item.timestamp * 1000))
          }
          items={items}
          listWidth="60vw"
          renderRow={(item) => item.label}
          renderDrilldown={(item) => (
            <pre>{JSON.stringify(item.value, undefined, 2)}</pre>
          )}
          selected={params.id}
        />
      </main>
    </Theme>
  );
}

export default Timeline;
