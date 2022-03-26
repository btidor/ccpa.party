// @flow
import * as React from "react";

import { autoParse, discoverEntry, parseJSON } from "parse";

import FacebookIcon from "icons/facebook.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

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
        <a
          href="https://www.facebook.com/help/contact/784491318687824"
          target="_blank"
          rel="noreferrer"
        >
          CCPA inquiry form
        </a>
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

  activityLabels: { [string]: string } = {
    "apps_and_websites_off_of_facebook/apps_and_websites.json":
      "Added/Removed App",
    "comments_and_reactions/posts_and_comments.json": "Comment",
    "comments_and_reactions/comments.json": "Comment",
    "events/event_invitations.json": "Invited to Event",
    "friends_and_followers/friend_requests_received.json":
      "Received Friend Request",
    "friends_and_followers/friends.json": "Became Friends",
    "friends_and_followers/rejected_friend_requests.json":
      "Rejected Friend Request",
    "friends_and_followers/removed_friends.json": "Un-Friended",
    "groups/your_comments_in_groups.json": "Groups",
    "groups/your_group_membership_activity.json": "Groups",
    "groups/your_groups.json": "Joined Group",
    "groups/your_posts_in_groups.json": "Groups",
    "notifications/notifications.json": "Notification",
    "pages/pages_you've_unfollowed.json": "Unfollowed Page",
    "polls/polls_you_voted_on.json": "Polls",
    "search/your_search_history.json": "Search",
    "security_and_login_information/account_activity.json": "Security Log",
    "security_and_login_information/email_address_verifications.json":
      "Security Log",
    "security_and_login_information/logins_and_logouts.json": "Security Log",
    "security_and_login_information/ip_address_activity.json": "Security Log",
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

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return files.flatMap((file) => {
      if (file.path.startsWith("messages/")) {
        // TODO: handle messages
        return { type: "unknown", file };
      } else if (file.path.startsWith("posts/")) {
        // TODO: handle posts
        return { type: "unknown", file };
      } else if (!file.path.endsWith(".json")) {
        return autoParse(file, this);
      } else if (file.path === "events/your_event_responses.json") {
        const parsed = parseJSON(file);
        const root = parsed.event_responses_v2;
        return (
          root.events_joined.map((e) =>
            discoverEntry(file, e, "Event [Going]")
          ) +
          root.events_declined.map((e) =>
            discoverEntry(file, e, "Event [Declined]")
          )
        );
      } else {
        return autoParse(file, this);
      }
    });
  }
}

export default Facebook;
