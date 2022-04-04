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

  const renderItem = (index) => {
    if (!items || !items[index]) return;
    const lastInGroup =
      grouper &&
      items[index + 1] &&
      grouper(items[index]) !== grouper(items[index + 1]);
    return (
      <React.Fragment>
        <div
          onClick={() =>
            navigate(
              props.baseLink + (id === index ? "" : `/${index.toString()}`)
            )
          }
          className={
            styles.listItem + (!items[index + 1] ? " " + styles.last : "")
          }
          role="row"
          aria-selected={id === index}
        >
          {props.renderRow(items[index])}
        </div>
        {lastInGroup && <hr className={styles.divider} />}
      </React.Fragment>
    );
  };

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
                <div className={styles.group}>{groups[index]?.name}</div>
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
