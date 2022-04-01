// @flow
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import styles from "components/Drilldown.module.css";

type Props<T> = {|
  baseLink: string,
  items: ?$ReadOnlyArray<T>,
  listWidth: string,
  renderRow: (T) => React.Node,
  renderDrilldown: (T) => React.Node,
  selected?: number,
|};

function Drilldown<T>(props: Props<T>): React.Node {
  const navigate = useNavigate();
  const { items, selected } = props;
  const id = typeof selected === "string" ? parseInt(selected) : selected;

  if (!props.items) {
    return <React.Fragment>📊 Loading...</React.Fragment>;
  } else {
    return (
      <div
        className={styles.drilldown}
        style={{ "--list-width": props.listWidth }}
      >
        <div className={styles.list}>
          <Virtuoso
            totalCount={props.items.length}
            itemContent={(index) => {
              if (items && items[index]) {
                return (
                  <div
                    onClick={() =>
                      navigate(
                        props.baseLink +
                          (id === index ? "" : `/${index.toString()}`)
                      )
                    }
                    className={styles.listItem}
                    role="row"
                    aria-selected={id === index}
                  >
                    {props.renderRow(items[index])}
                  </div>
                );
              } else {
                return <div>Loading... #{index}</div>;
              }
            }}
          />
        </div>
        <div className={styles.inspector}>
          {(() => {
            if (items && id !== undefined && items[id]) {
              return props.renderDrilldown(items[id]);
            } else {
              return;
            }
          })()}
        </div>
      </div>
    );
  }
}

export default Drilldown;
