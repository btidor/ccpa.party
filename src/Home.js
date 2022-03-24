// @flow
import * as React from "react";
import { Link } from "react-router-dom";

import Navigation from "Navigation";

import styles from "Home.module.css";

import AppleIcon from "icons/apple.svg";
import AmazonIcon from "icons/amazon.svg";
import DiscordIcon from "icons/discord.svg";
import FacebookIcon from "icons/facebook.svg";
import GoogleIcon from "icons/google.svg";
import NetflixIcon from "icons/netflix.svg";
import SlackIcon from "icons/slack.svg";

const PlaceholderProviders = [
  { displayName: "Amazon", icon: AmazonIcon },
  { displayName: "Apple", icon: AppleIcon },
  { displayName: "Discord", icon: DiscordIcon },
  { displayName: "Facebook", icon: FacebookIcon },
  { displayName: "Google", icon: GoogleIcon },
  { displayName: "Netflix", icon: NetflixIcon },
  { displayName: "Slack", icon: SlackIcon },
];

function Home(): React.Node {
  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home}>
        <div className={styles.providers}>
          <div>1 Select a Company</div>
          {PlaceholderProviders.map(({ displayName, icon }) => (
            <Link key={displayName} to="/">
              {icon()} <span>{displayName}</span>
            </Link>
          ))}
        </div>
        <div className={styles.info}>
          2 Submit data access request
          <br />
          (wait...)
          <br />3 Import to data explorer
        </div>
      </main>
    </React.Fragment>
  );
}

export default Home;
