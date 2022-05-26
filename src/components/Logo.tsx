import { Link } from "@src/common/router";
import Party from "@src/components/Party";

import styles from "@src/components/Logo.module.css";

type Params = {
  block: "home" | "request" | "nav";
  party: "party" | "glow" | "plain";
  // If true, scrolls the homepage to the right so the company list is in view
  // (for narrow mobile screens). Otherwise resets the homepage to the left so
  // the logo and intro are in view.
  picker?: boolean;
};

function Logo(params: Params): JSX.Element {
  const { block, party, picker } = params;
  return (
    <Link
      to="/"
      className={[styles.logo, block === "home" && styles.home]
        .filter((x) => x)
        .join(" ")}
      state={picker}
      tabIndex={block === "home" ? -1 : undefined}
    >
      {party === "plain" ? (
        <span className={styles.emoji}>🎉</span>
      ) : (
        <Party glow={party === "glow"} />
      )}
      <span className={styles.title}>
        ccpa.party
        <sup>β</sup>
      </span>
    </Link>
  );
}

export default Logo;
