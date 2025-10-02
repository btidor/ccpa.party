import React from "react";

import styles from "@src/components/Record.module.css";

type Props = {
  time: string | void;
  icon: string | void;
  username: { display: string; color?: string } | void;
  body: React.JSX.Element | string | void;
  trailer: string | void;
};

export const Highlight = (props: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <span className={styles.highlight}>{props.children}</span>
);

export const Pill = (props: {
  children: React.ReactNode;
}): React.JSX.Element => <div className={styles.pill}>{props.children}</div>;

function Record(props: Props): React.JSX.Element {
  const { time, icon, username, body, trailer } = props;
  return (
    <React.Fragment>
      <span className={styles.time}>{time || undefined}</span>
      {icon ? <span className={styles.icon}>{icon}</span> : undefined}
      <div className={styles.content}>
        {username ? (
          <span
            className={styles.username}
            style={
              { "--custom": username.color || "#ccc" } as React.CSSProperties
            }
          >
            {username.display}
          </span>
        ) : undefined}
        {typeof body === "string" ? <span>{body}</span> : body || undefined}
        {trailer ? (
          <span className={styles.trailer}>{trailer}</span>
        ) : undefined}
      </div>
    </React.Fragment>
  );
}

export default Record;
