// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Party from "components/Party";

import styles from "components/Logo.module.css";

type Params = {|
  // If true, use multicolor logo.
  party?: boolean,
  // If true, scrolls the homepage to the right so the company list is in view
  // (for narrow mobile screens). Otherwise resets the homepage to the left so
  // the logo and intro are in view.
  picker?: boolean,
|};

function Logo(params: Params): React.Node {
  const { party, picker } = params;
  return (
    <Link to="/" className={styles.logo} state={picker}>
      {party ? <Party /> : <span className={styles.emoji}>🎉</span>}
      <span className={styles.title}>ccpa.party</span>
      <sup>𝛼</sup>
    </Link>
  );
}

export default Logo;
