// @flow
import * as React from "react";

import styles from "components/DatePicker.module.css";

import type { Entry, Group } from "components/TimelineRow";

type Props = {|
  +index: number,
  +rows: ?$ReadOnlyArray<Entry | Group>,
  +scrollToIndex: (number) => void,
|};

const VerboseDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function DatePicker(props: Props): React.Node {
  const { index, rows, scrollToIndex } = props;

  let node;
  const row = rows?.[index];
  if (row && rows) {
    node = (
      <React.Fragment>
        <label>
          {VerboseDateFormat.format(new Date(row.day))}
          <input
            type="date"
            value={row.day}
            onChange={(e) => {
              let target = 0;
              for (const [index, item] of rows.entries()) {
                if (!item.isGroup) continue;
                if (item.day < e.target.value) break;
                target = index;
              }
              scrollToIndex(target);
            }}
          />
        </label>
      </React.Fragment>
    );
  }

  return <div className={styles.picker}>{node}</div>;
}

export default DatePicker;
