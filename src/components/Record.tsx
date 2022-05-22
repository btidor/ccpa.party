import React from "react";

import styles from "components/Record.module.css";

type Props = {
  time?: string,
  icon?: string,
  username?: { display: string, color?: string; },
  body?: JSX.Element,
  trailer?: string,
};

export const Highlight = (props: { children: React.ReactNode; }): JSX.Element => (
  <span className={styles.highlight}>{props.children}</span>
);

export const Pill = (props: { children: React.ReactNode; }): JSX.Element => (
  <div className={styles.pill}>{props.children}</div>
);

function Record(props: Props): JSX.Element {
  const { time, icon, username, body, trailer } = props;
  return (
    <React.Fragment>
      <span className={styles.time}>{time}</span>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.content}>
        {username && (
          <span
            className={styles.username}
            style={{ "--custom": username.color || "#ccc" } as React.CSSProperties}
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

export default Record;
