// @flow
import * as React from "react";
import { Link } from "react-router-dom";
import { StopwatchIcon } from "@primer/octicons-react";

import Navigation from "Navigation";

import styles from "Home.module.css";

import AppleIcon from "icons/apple.svg";
import AmazonIcon from "icons/amazon.svg";
import DiscordIcon from "icons/discord.svg";
import FacebookIcon from "icons/facebook.svg";
import GoogleIcon from "icons/google.svg";
import GithubIcon from "icons/github.svg";
import NetflixIcon from "icons/netflix.svg";
import SlackIcon from "icons/slack.svg";

const PlaceholderProviders = ([
  { displayName: "Amazon", icon: AmazonIcon, primary: "#f90" },
  { displayName: "Apple", icon: AppleIcon, primary: "#000" },
  { displayName: "Discord", icon: DiscordIcon, primary: "#5865f2" },
  { displayName: "Facebook", icon: FacebookIcon, primary: "#1877f2" },
  { displayName: "Github", icon: GithubIcon, primary: "#000" },
  { displayName: "Google", icon: GoogleIcon, primary: "#34a853" },
  {
    displayName: "Netflix",
    icon: NetflixIcon,
    primary: "#000",
    fullColor: true,
  },
  {
    displayName: "Slack",
    icon: SlackIcon,
    primary: "#4a154b",
    fullColor: true,
  },
]: $ReadOnlyArray<{|
  displayName: string,
  icon: (any) => React.Node,
  primary: string,
  fullColor?: boolean,
|}>);

function Home(): React.Node {
  return (
    <React.Fragment>
      <Navigation />
      <main className={styles.home}>
        <div className={styles.providers}>
          <div>
            <span className={styles.numeral}>1</span> Select a company
          </div>
          {PlaceholderProviders.map(
            ({ displayName, icon, primary, fullColor }) => (
              <Link
                key={displayName}
                to="/"
                style={{ "--primary": primary }}
                className={!fullColor && styles.whiteout}
              >
                {icon()} <span>{displayName}</span>
              </Link>
            )
          )}
        </div>
        <div className={styles.info}>
          <ol>
            <li>
              <span className={styles.numeral}>2</span>
              Submit data access request
            </li>
            <li>
              <StopwatchIcon className={styles.iconNumeral} />
              <i>Wait (up to a few days)</i>
            </li>
            <li>
              <span className={styles.numeral}>3</span>
              Import data to ccpa.party
            </li>
          </ol>
        </div>
      </main>
    </React.Fragment>
  );
}

export default Home;
