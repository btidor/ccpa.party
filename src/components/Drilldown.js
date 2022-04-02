// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { GroupedVirtuoso, Virtuoso } from "react-virtuoso";

import styles from "components/Drilldown.module.css";

type Props<T, U> = {|
  baseLink: string,
  items: ?$ReadOnlyArray<T>,
  grouper?: (T) => U,
  listWidth: string,
  renderRow: (T) => React.Node,
  renderDrilldown: (T) => React.Node,
  selected?: number,
|};

function Drilldown<T, U>(props: Props<T, U>): React.Node {
  const navigate = useNavigate();
  const { grouper, items, selected } = props;
  const id = typeof selected === "string" ? parseInt(selected) : selected;

  const renderItem = (index) =>
    items &&
    items[index] && (
      <div
        onClick={() =>
          navigate(
            props.baseLink + (id === index ? "" : `/${index.toString()}`)
          )
        }
        className={styles.listItem}
        role="row"
        aria-selected={id === index}
      >
        {props.renderRow(items[index])}
      </div>
    );

  let groups;
  if (items && grouper) {
    groups = items.reduce((state, item) => {
      const end = state.length - 1;
      const name = grouper(item);
      if (state[end]?.name !== name) {
        state.push({ name, count: 1 });
      } else {
        state[end].count++;
      }
      return state;
    }, []);
  }

  if (!items) {
    return <React.Fragment>📊 Loading...</React.Fragment>;
  } else {
    return (
      <div
        className={styles.drilldown}
        style={{ "--list-width": props.listWidth }}
      >
        <div className={styles.list}>
          {groups ? (
            <GroupedVirtuoso
              groupCounts={groups.map((g) => g.count)}
              groupContent={(index) => (
                <div className={index === 0 ? styles.firstOuter : styles.outer}>
                  <div className={styles.inner}>{groups[index]?.name}</div>
                </div>
              )}
              itemContent={renderItem}
            />
          ) : (
            <Virtuoso totalCount={items.length} itemContent={renderItem} />
          )}
        </div>
        <div className={styles.inspector}>
          {id && !!items[id] && props.renderDrilldown(items[id])}
        </div>
      </div>
    );
  }
}

export default Drilldown;
