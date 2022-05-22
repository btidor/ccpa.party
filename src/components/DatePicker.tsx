import React from "react";

import styles from "components/DatePicker.module.css";

import type { Entry, Group } from "components/TimelineRow";

type Props = {
  index: number,
  rows: ReadonlyArray<Entry | Group> | void,
  scrollToIndex: (index: number) => void,
};

const VerboseDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function DatePicker(props: Props): JSX.Element {
  const { index, rows, scrollToIndex } = props;

  const ref = React.useRef<HTMLInputElement>(null);

  let inner;
  const row = rows?.[index];
  if (row && rows) {
    const parts = row.day.split("-").map((x) => parseInt(x));
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    inner = (
      <React.Fragment>
        <label
          // $FlowFixMe[prop-missing]
          onClick={() => (ref.current as any)?.showPicker?.()}
        >
          {VerboseDateFormat.format(date)}
          <input
            type="date"
            ref={ref}
            defaultValue={row.day}
            onChange={(e) => {
              let target = 0;
              for (const [index, item] of rows as any) {
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

  return <div className={styles.picker}>{inner}</div>;
}

export default DatePicker;
