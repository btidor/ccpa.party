// @flow
import * as React from "react";

import styles from "components/TimelineRow.module.css";

import { Database } from "database";

import type { Group } from "Timeline";
import type { MetadataEntry, TimelineEntryKey } from "database";
import type { Provider } from "provider";

type Props = {|
  +db: Database,
  +isLast: boolean,
  +metadata: ?$ReadOnlyMap<string, MetadataEntry>,
  +provider: Provider,
  +row: TimelineEntryKey | Group,
  +selected: ?string,
  +setSelected: (string) => any,
|};

const VerboseDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function TimelineRow(props: Props): React.Node {
  const { db, isLast, metadata, provider, row, selected, setSelected } = props;

  const [hydrated, setHydrated] = React.useState();
  React.useEffect(() => {
    (async () => {
      const hydrated =
        row.type === "group" ? undefined : await db.hydrateTimelineEntry(row);
      setHydrated(hydrated);
    })();
  }, [db, row]);

  if (row.type === "group") {
    return (
      <React.Fragment>
        {!row.first && <hr className={styles.divider} />}
        <div className={styles.group} role="row">
          {VerboseDateFormat.format(new Date(row.value))}
        </div>
      </React.Fragment>
    );
  } else {
    return (
      <div
        onClick={() => row && setSelected(row.slug)}
        className={styles.item + (isLast ? " " + styles.last : "")}
        role="row"
        aria-selected={row && selected === row.slug}
      >
        {hydrated && metadata ? (
          provider.render(hydrated, metadata)
        ) : (
          <code>Loading...</code>
        )}
      </div>
    );
  }
}

export default TimelineRow;
