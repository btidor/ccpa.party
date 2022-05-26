import React from "react";

import type { Entry, Group } from "@src/components/TimelineRow";

import styles from "@src/components/DatePicker.module.css";

type Props<T> = {
  index: number;
  rows: ReadonlyArray<Entry<T> | Group> | void;
  scrollToIndex: (index: number) => void;
};

const VerboseDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function DatePicker<T>(props: Props<T>): JSX.Element {
  const { index, rows, scrollToIndex } = props;

  const ref = React.useRef<HTMLInputElement>(null);

  let inner;
  const row = rows?.[index];
  if (row && rows) {
    const parts = row.day.split("-").map((x) => parseInt(x));
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    inner = (
      <React.Fragment>
        <label onClick={() => ref.current?.showPicker()}>
          {VerboseDateFormat.format(date)}
          <input
            type="date"
            ref={ref}
            defaultValue={row.day}
            onChange={(e) => {
              let target = 0;
              let index = -1;
              for (const item of rows) {
                index++;
                if (!item.isGroup) continue;
                if (item.day < e.target.value) break;
                target = index + 1;
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
