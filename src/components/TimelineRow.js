// @flow
import * as React from "react";

import styles from "components/TimelineRow.module.css";

import { ProviderScopedDatabase } from "common/database";

import type { Group } from "Timeline";
import type { MetadataEntry, TimelineEntryKey } from "common/database";
import type { Provider } from "common/provider";

type Props = {|
  +db: ProviderScopedDatabase,
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
          <React.Fragment>&nbsp;</React.Fragment>
        )}
      </div>
    );
  }
}

export default TimelineRow;
