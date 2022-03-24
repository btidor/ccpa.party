// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Navigation from "Navigation";

import styles from "Home.module.css";

const PlaceholderProviders = [
  "Facebook",
  "Apple",
  "Amazon",
  "Netflix",
  "Google",
  "TikTok",
  "Instagram",
  "Snapchat",
  "Discord",
  "Twitter",
  "Spotify",
  "HBO Max",
  "Disney+",
  "Reddit",
  "GitHub",
  "Slack",
  "Quora",
  "PayPal",
  "Square",
  "eBay",
  "LinkedIn",
  "Microsoft",
  "Zoom",
  "Yahoo",
];

function Home(): React.Node {
  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home}>
        <div className={styles.info}>
          <strong>Hello World!</strong> Lorem ipsum dolor sit amet, consectetur
          adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </div>
        {PlaceholderProviders.map((name) => (
          <Link key={name} to="/">
            {name}
          </Link>
        ))}
        {[...Array(100)].map((_, i) => (
          <div className={styles.filler}></div>
        ))}
      </main>
    </React.Fragment>
  );
}

export default Home;
