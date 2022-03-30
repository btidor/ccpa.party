// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import styles from "components/Links.module.css";

type Props = {|
  children: string,
  to: string,
  newTab?: boolean,
|};

const newTabExtra = { target: "_blank", rel: "noreferrer" };

function WordsWithCaret(props: {| children: string |}): React.Node {
  const words = props.children.split(" ");
  return (
    <React.Fragment>
      {words.slice(0, -1).join(" ")}{" "}
      <span className={styles.nobr}>
        {words.slice(-1)[0]} <span className={styles.caret}>➜</span>
      </span>
    </React.Fragment>
  );
}

export function ExternalLink(props: Props): React.Node {
  const extra = props.newTab ? newTabExtra : {};
  return (
    <a href={props.to} className={styles.link} {...extra}>
      <WordsWithCaret>{props.children}</WordsWithCaret>
    </a>
  );
}

export function InternalLink(props: Props): React.Node {
  const extra = props.newTab ? newTabExtra : {};
  return (
    <Link to={props.to} className={styles.link} {...extra}>
      <WordsWithCaret>{props.children}</WordsWithCaret>
    </Link>
  );
}
