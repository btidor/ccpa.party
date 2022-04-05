// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { GroupedVirtuoso, Virtuoso } from "react-virtuoso";

import styles from "components/Drilldown.module.css";

type Category<T> = {| title: string, filter: (T) => boolean |};

type Props<T, U> = {|
  baseLink: string,
  categories?: $ReadOnlyArray<Category<T>>,
  drilldownTitle: (T) => string,
  items: ?$ReadOnlyArray<T>,
  grouper?: (T) => U,
  listWidth: string,
  renderRow: (T) => React.Node,
  renderDrilldown: (T) => React.Node,
  selected?: number,
|};

function Drilldown<T, U>(props: Props<T, U>): React.Node {
  const navigate = useNavigate();
  const { categories, grouper, items, selected } = props;
  const [filters, setFilters] = React.useState(categories || []);
  const id = typeof selected === "string" ? parseInt(selected) : selected;

  const filtered = categories
    ? items
      ? items.filter((i) => filters.some((f) => f.filter(i)))
      : []
    : items || [];

  let groups;
  if (grouper) {
    groups = filtered.reduce((state, item) => {
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

  const renderItem = (index) => {
    if (!filtered[index]) return;
    const lastInGroup =
      grouper &&
      filtered[index + 1] &&
      grouper(filtered[index]) !== grouper(filtered[index + 1]);
    return (
      <React.Fragment>
        <div
          onClick={() =>
            navigate(
              props.baseLink + (id === index ? "" : `/${index.toString()}`)
            )
          }
          className={
            styles.listItem + (!filtered[index + 1] ? " " + styles.last : "")
          }
          role="row"
          aria-selected={id === index}
        >
          {props.renderRow(filtered[index])}
        </div>
        {lastInGroup && <hr className={styles.divider} />}
      </React.Fragment>
    );
  };

  if (!items) {
    return <React.Fragment>📊 Loading...</React.Fragment>;
  } else {
    return (
      <div
        className={styles.container}
        style={{ "--left-width": props.listWidth }}
      >
        <div className={styles.left}>
          <div className={styles.bar}>
            {categories &&
              categories.map((category) => (
                <button
                  className={
                    filters.some((f) => f.title === category.title)
                      ? styles.selected
                      : undefined
                  }
                  key={category.title}
                  onClick={() => {
                    const updated = filters.filter(
                      (f) => f.title !== category.title
                    );
                    if (!filters.some((f) => f.title === category.title))
                      updated.push(category);
                    setFilters(updated);
                  }}
                >
                  {category.title}
                </button>
              ))}
          </div>
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
        <div className={styles.right}>
          <div className={styles.bar}>
            {id !== undefined &&
              !!filtered[id] &&
              props.drilldownTitle(filtered[id])}
          </div>
          <div className={styles.inspector}>
            {id !== undefined &&
              !!filtered[id] &&
              props.renderDrilldown(filtered[id])}
          </div>
        </div>
      </div>
    );
  }
}

export default Drilldown;
