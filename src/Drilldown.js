// @flow
import * as React from "react";
import { Virtuoso } from "react-virtuoso";

import styles from "Drilldown.module.css";

type Props<T> = {|
  items: ?$ReadOnlyArray<T>,
  renderRow: (T) => React.Node,
  renderDrilldown: (T) => React.Node,
  listWidth: string,
|};

function Drilldown<T>(props: Props<T>): React.Node {
  const [drilldownItem, setDrilldownItem] = React.useState();

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
              if (props.items && props.items[index]) {
                return (
                  <div
                    onClick={() =>
                      setDrilldownItem(
                        drilldownItem === index ? undefined : index
                      )
                    }
                    className={styles.listItem}
                    role="row"
                    aria-selected={drilldownItem === index}
                  >
                    {props.renderRow(props.items[index])}
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
            if (
              props.items &&
              drilldownItem !== undefined &&
              props.items[drilldownItem]
            ) {
              return props.renderDrilldown(props.items[drilldownItem]);
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
