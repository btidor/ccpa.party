// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";
import { autoParse, discoverEntry, parseJSON } from "database";

import FacebookIcon from "icons/facebook.svg";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

class Facebook implements Provider {
  slug: string = "facebook";
  displayName: string = "Facebook";
  icon: React.Node = (<FacebookIcon />);
  color: string = "#1877f2";

  privacyPolicy: string = "https://www.facebook.com/legal/policy/ccpa";
  waitTime: string = "an unknown amount of time";
  instructions: React.Node = (
    <ol>
      <li>
        Visit the{" "}
        <ExternalLink
          to="https://www.facebook.com/help/contact/784491318687824"
          newTab
        >
          CCPA inquiry form
        </ExternalLink>
      </li>
      <li>
        Select <i>Facebook</i> as the product
      </li>
      <li>
        Select{" "}
        <i>
          I would like to access or download my personal information on Facebook
        </i>
      </li>
      <li>
        Enter your name and email address, then hit <i>Send</i>
      </li>
      <li>Wait for the email to arrive</li>
      <li>
        Follow the link to the <i>Download Your Information</i> tool
      </li>
      <li>
        Choose <i>JSON</i> as the file format and <i>All Time</i> as the date
        range
      </li>
      <li>
        In the next section, click <i>Select all</i> or make sure all items are
        checked
      </li>
      <li>
        Finally, hit <i>Request a download</i> at the bottom of the page
      </li>
    </ol>
  );

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: true,
    },
    {
      char: "c",
      slug: "content",
      displayName: "Content",
      defaultEnabled: true,
    },
    {
      char: "n",
      slug: "notification",
      displayName: "Notifications",
      defaultEnabled: false,
    },
    {
      char: "s",
      slug: "security",
      displayName: "Security Logs",
      defaultEnabled: false,
    },
  ];

  timelineLabels: { [string]: [string, string] } = {
    "apps_and_websites_off_of_facebook/apps_and_websites.json": [
      "Added/Removed App",
      "activity",
    ],
    "comments_and_reactions/posts_and_comments.json": ["Comment", "content"],
    "comments_and_reactions/comments.json": ["Comment", "content"],
    "events/event_invitations.json": ["Invited to Event", "activity"],
    "friends_and_followers/friend_requests_received.json": [
      "Received Friend Request",
      "activity",
    ],
    "friends_and_followers/friends.json": ["Became Friends", "activity"],
    "friends_and_followers/rejected_friend_requests.json": [
      "Rejected Friend Request",
      "activity",
    ],
    "friends_and_followers/removed_friends.json": ["Un-Friended", "activity"],
    "groups/your_comments_in_groups.json": ["Groups", "content"],
    "groups/your_group_membership_activity.json": ["Groups", "activity"],
    "groups/your_groups.json": ["Joined Group", "activity"],
    "groups/your_posts_in_groups.json": ["Groups", "content"],
    "notifications/notifications.json": ["Notification", "notification"],
    "pages/pages_you've_unfollowed.json": ["Unfollowed Page", "activity"],
    "polls/polls_you_voted_on.json": ["Polls", "content"],
    "search/your_search_history.json": ["Search", "activity"],
    "security_and_login_information/account_activity.json": [
      "Security Log",
      "security",
    ],
    "security_and_login_information/email_address_verifications.json": [
      "Security Log",
      "security",
    ],
    "security_and_login_information/logins_and_logouts.json": [
      "Security Log",
      "security",
    ],
    "security_and_login_information/ip_address_activity.json": [
      "Security Log",
      "security",
    ],
  };

  settingLabels: { [string]: string } = {
    "facebook_payments/payment_history.json": "Facebook Payments",
    "groups/creator_badges.json": "Group Badges",
    "location/primary_location.json": "Location",
    "location/timezone.json": "Time Zone",
    "other_logged_information/friend_peer_group.json": "Friend Peer Group",
    "profile_information/profile_information.json": "Profile Information",
    "security_and_login_information/browser_cookies.json": "DATR Cookie",
    "security_and_login_information/your_facebook_activity_history.json":
      "Recent Activity",
    "voting_location_and_reminders/location.json": "Voting Location",
    "voting_location_and_reminders/voting_reminders.json": "Voting Reminders",
  };

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    if (file.skipped) return [];
    if (file.path[1] === "messages") {
      return []; // TODO: handle messages
    } else if (file.path[1] === "posts") {
      return []; // TODO: handle posts
    } else if (!file.path.slice(-1)[0].endsWith(".json")) {
      return autoParse(file, this.timelineLabels, this.settingLabels);
    } else if (
      file.path.slice(1).join("/") === "events/your_event_responses.json"
    ) {
      const parsed = parseJSON(file.data);
      const root = parsed.event_responses_v2;
      return root.events_joined
        .map((e) => discoverEntry(file, e, "Event [Going]", "activity"))
        .concat(
          root.events_declined.map((e) =>
            discoverEntry(file, e, "Event [Declined]", "activity")
          )
        );
    } else {
      return autoParse(file, this.timelineLabels, this.settingLabels);
    }
  }

  render(entry: TimelineEntry): React.Node {
    return (
      <React.Fragment>
        ({entry.context[0]}) {entry.context[1]}
      </React.Fragment>
    );
  }
}

export default Facebook;
