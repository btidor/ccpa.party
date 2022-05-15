// @flow
import * as React from "react";

import styles from "components/SimpleRecord.module.css";

type Props = {|
  +time?: ?string,
  +icon?: ?string,
  +username?: ?{| display: string, color: ?string |},
  +body?: ?React.Node,
  +trailer?: ?string,
|};

export const Highlight = (props: {| +children: React.Node |}): React.Node => (
  <span className={styles.highlight}>{props.children}</span>
);

export const Pill = (props: {| +children: React.Node |}): React.Node => (
  <div className={styles.pill}>{props.children}</div>
);

function SimpleRecord(props: Props): React.Node {
  const { time, icon, username, body, trailer } = props;
  return (
    <React.Fragment>
      <span className={styles.time}>{time}</span>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.content}>
        {username && (
          <span
            className={styles.username}
            style={{ "--custom": username.color || "#ccc" }}
          >
            {username.display}
          </span>
        )}
        {typeof body === "string" ? <span>{body}</span> : body}
        {trailer && <span className={styles.trailer}>{trailer}</span>}
      </div>
    </React.Fragment>
  );
}

export default SimpleRecord;
