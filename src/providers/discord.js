// @flow
import * as React from "react";

import DiscordIcon from "icons/discord.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Discord implements Provider {
  slug: string = "discord";
  displayName: string = "Discord";
  icon: React.Node = (<DiscordIcon />);
  color: string = "#5865f2";

  privacyPolicy: string =
    "https://discord.com/privacy#information-for-california-users";
  waitTime: string = "about a week";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to{" "}
        <a href="https://discord.com/app" target="_blank" rel="noreferrer">
          Discord
        </a>
      </li>
      <li>
        Open <i>User Settings</i>
      </li>
      <li>
        Select the <i>Privacy &amp; Safety</i> tab
      </li>
      <li>
        Scroll down and hit the <i>Request Data</i> button
      </li>
    </ol>
  );

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Discord;
