import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type { DataFile, TimelineEntry } from "@src/common/database";
import {
  TimelineParser,
  parseByStages,
  parseJSON,
  smartDecodeText,
} from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

type CategoryKey =
  | "activity"
  | "content"
  | "message"
  | "notification"
  | "security";

class Facebook implements Provider<CategoryKey> {
  slug: string = "facebook";
  displayName: string = "Facebook";

  brandColor: string = "#1877f2";
  neonColor: string = "#009eff";
  neonColorHDR: string = "color(rec2020 0.12623 0.5874 1.52179)";

  requestLink: { href: string; text: string } = {
    text: "Download Your Information",
    href: "https://www.facebook.com/ccpa/download_your_information/",
  };
  waitTime: string = "1-2 hours";
  instructions: ReadonlyArray<string> = ["select format JSON"];
  singleFile: boolean = true;
  fileName: string = "facebook.zip";
  privacyPolicy: string = "https://www.facebook.com/legal/policy/ccpa";

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "activity",
      {
        char: "a",
        icon: "🖱",
        displayName: "Activity",
        defaultEnabled: true,
      },
    ],
    [
      "content",
      {
        char: "c",
        icon: "📱",
        displayName: "Content",
        defaultEnabled: true,
      },
    ],
    [
      "message",
      {
        char: "m",
        icon: "💬",
        displayName: "Messages",
        defaultEnabled: true,
      },
    ],
    [
      "notification",
      {
        char: "n",
        icon: "🔔",
        displayName: "Notifications",
        defaultEnabled: false,
      },
    ],
    [
      "security",
      {
        char: "s",
        icon: "🪪",
        displayName: "Security Logs",
        defaultEnabled: false,
      },
    ],
  ]);

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch(
        "apps_and_websites_off_of_facebook/apps_and_websites.json"
      ),
      tokenize: (data) => parseJSON(data, { smart: true }).installed_apps_v2,
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.removed_timestamp || item.added_timestamp),
        [
          `App ${item.category[0].toUpperCase() + item.category.slice(1)}`,
          item.name,
        ],
      ],
    },
    {
      glob: new Minimatch(
        "apps_and_websites_off_of_facebook/your_off-facebook_activity.json"
      ),
      tokenize: (data) =>
        parseJSON(data, {
          smart: true,
        }).off_facebook_activity_v2.flatMap(({ events, ...rest }: any) =>
          events.map((item: any) => ({ company: rest, ...item }))
        ),
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.timestamp),
        ["Off-Facebook Purchase", item.company.name],
      ],
    },
    {
      glob: new Minimatch("comments_and_reactions/comments.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).comments_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Comment", item.data?.[0]?.comment?.comment || item.title],
      ],
    },
    {
      glob: new Minimatch("comments_and_reactions/posts_and_comments.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).reactions_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Reaction", item.title],
      ],
    },
    {
      glob: new Minimatch("events/event_invitations.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).events_invited_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.start_timestamp),
        ["Event Invitation", item.name],
      ],
    },
    {
      glob: new Minimatch("events/your_event_responses.json"),
      tokenize: (data) => {
        const parsed = parseJSON(data, { smart: true }).event_responses_v2;
        return parsed.events_joined
          .map((item: any) => ({
            type: "joined",
            ...item,
          }))
          .concat(
            parsed.events_declined.map((item: any) => ({
              type: "declined",
              ...item,
            }))
          );
      },
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.start_timestamp),
        [
          item.type === "joined" ? "Going to Event" : "Declined Event",
          item.name,
        ],
      ],
    },
    {
      glob: new Minimatch("feed/feed.json"),
      tokenize: (data) =>
        parseJSON(data, { smart: true }).people_and_friends_v2.flatMap(
          (category: any) =>
            category.entries.map((entry: any) => ({
              name: category.name,
              ...entry,
            }))
        ),
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.timestamp),
        [item.name, item.data.name],
      ],
    },
    {
      glob: new Minimatch(
        "friends_and_followers/friend_requests_received.json"
      ),
      tokenize: (data) => parseJSON(data, { smart: true }).received_requests_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Friend Request", item.name],
      ],
    },
    {
      glob: new Minimatch("friends_and_followers/friends.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).friends_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Became Friends", item.name],
      ],
    },
    {
      glob: new Minimatch(
        "friends_and_followers/rejected_friend_requests.json"
      ),
      tokenize: (data) => parseJSON(data, { smart: true }).rejected_requests_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Rejected Friend Request", item.name],
      ],
    },
    {
      glob: new Minimatch("friends_and_followers/removed_friends.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).deleted_friends_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Unfriended", item.name],
      ],
    },
    {
      glob: new Minimatch("groups/your_comments_in_groups.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).group_comments_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Comment", item.data?.[0]?.comment?.comment || item.title],
      ],
    },
    {
      glob: new Minimatch("groups/your_group_membership_activity.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).groups_joined_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Joined Group", item.data?.[0]?.name || item.title],
      ],
    },
    {
      glob: new Minimatch("groups/your_groups.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).groups_admined_v2,
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.timestamp),
        ["Became Group Admin", item.name],
      ],
    },
    {
      glob: new Minimatch("groups/your_posts_in_groups.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).group_posts_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Post", item.data?.[0]?.post || item.title],
      ],
    },
    {
      glob: new Minimatch("groups/your_posts_in_groups.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).group_posts_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Post", item.data?.[0]?.post || item.title],
      ],
    },
    {
      glob: new Minimatch("messages/**/message_*.json"),
      tokenize: (data) => {
        const { messages, ...rest } = parseJSON(data, { smart: false });
        return messages.map((item: any) => ({
          ...item,
          thread: rest,
        }));
      },
      parse: (item) => [
        "message",
        DateTime.fromMillis(item.timestamp_ms),
        [
          smartDecodeText(item.content || ""),
          item.thread.title === item.sender_name
            ? undefined
            : smartDecodeText(item.thread.title),
          { color: "var(--neon)", display: smartDecodeText(item.sender_name) },
        ],
      ],
    },
    {
      glob: new Minimatch("notifications/notifications.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).notifications_v2,
      parse: (item) => [
        "notification",
        DateTime.fromSeconds(item.timestamp),
        ["Notification", item.text],
      ],
    },
    {
      glob: new Minimatch("pages/pages_you've_unfollowed.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).pages_unfollowed_v2,
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.timestamp),
        ["Un-Followed", item.data?.[0]?.name || item.title],
      ],
    },
    {
      glob: new Minimatch("polls/polls_you_voted_on.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).poll_votes_v2,
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Voted on Poll"],
      ],
    },
    {
      glob: new Minimatch("posts/your_posts_*.json"),
      tokenize: (data) => {
        const parsed = parseJSON(data, { smart: true });
        if (!Array.isArray(parsed)) return [parsed];
        return parsed;
      },
      parse: (item) => [
        "content",
        DateTime.fromSeconds(item.timestamp),
        ["Post", item.data[0].post],
      ],
    },
    {
      glob: new Minimatch("profile_information/profile_information.json"),
      tokenize: (data) => [parseJSON(data, { smart: true }).profile_v2],
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.registration_timestamp),
        ["Created Profile", item.name.full_name],
      ],
    },
    {
      glob: new Minimatch(
        "security_and_login_information/account_activity.json"
      ),
      tokenize: (data) => parseJSON(data, { smart: true }).account_activity_v2,
      parse: (item) => [
        "security",
        DateTime.fromSeconds(item.timestamp),
        [
          (item.action as string)
            .split(" ")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
          item.ip_address,
        ],
      ],
    },
    {
      glob: new Minimatch(
        "security_and_login_information/email_address_verifications.json"
      ),
      tokenize: (data) =>
        parseJSON(data, { smart: true }).contact_verifications_v2,
      parse: (item) => [
        "security",
        DateTime.fromSeconds(item.verification_time),
        ["Verified Email Address", item.contact],
      ],
    },
    {
      glob: new Minimatch(
        "security_and_login_information/ip_address_activity.json"
      ),
      tokenize: (data) => parseJSON(data, { smart: true }).used_ip_address_v2,
      parse: (item) => [
        "security",
        DateTime.fromSeconds(item.timestamp),
        [
          (item.action as string)
            .split(" ")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
          item.ip,
        ],
      ],
    },
    {
      glob: new Minimatch(
        "security_and_login_information/login_protection_data.json"
      ),
      tokenize: (data) =>
        parseJSON(data, { smart: true }).login_protection_data_v2,
      parse: (item) => [
        "security",
        DateTime.fromSeconds(item.session.created_timestamp),
        ["Session", item.name],
      ],
    },
    {
      glob: new Minimatch(
        "security_and_login_information/logins_and_logouts.json"
      ),
      tokenize: (data) => parseJSON(data, { smart: true }).account_accesses_v2,
      parse: (item) => [
        "security",
        DateTime.fromSeconds(item.timestamp),
        [
          (item.action as string)
            .split(" ")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
          item.ip_address,
        ],
      ],
    },
    {
      glob: new Minimatch("security_and_login_information/record_details.json"),
      tokenize: (data) => parseJSON(data, { smart: true }).admin_records_v2,
      parse: (item) => [
        "security",
        DateTime.fromSeconds(item.session.created_timestamp),
        [
          (item.event as string)
            .split(" ")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
          Object.values(item.extra_info || {}).find((x) => x),
        ],
      ],
    },
    {
      glob: new Minimatch("your_interactions_on_facebook/recently_viewed.json"),
      tokenize: (data) =>
        parseJSON(data, {
          smart: true,
        }).recently_viewed.flatMap(({ entries, ...rest }: any) =>
          (entries || [])
            .map((item: any) => ({ category: rest, ...item }))
            .filter((item: any) => item.timestamp)
        ),
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.timestamp),
        [`Viewed ${item.category.name}`, item.data.name],
      ],
    },
    {
      glob: new Minimatch(
        "your_interactions_on_facebook/recently_visited.json"
      ),
      tokenize: (data) =>
        parseJSON(data, {
          smart: true,
        }).visited_things_v2.flatMap(({ entries, ...rest }: any) =>
          (entries || [])
            .map((item: any) => ({ category: rest, ...item }))
            .filter((item: any) => item.timestamp)
        ),
      parse: (item) => [
        "activity",
        DateTime.fromSeconds(item.timestamp),
        [
          item.category.name === "Profile visits"
            ? "Viewed Profile"
            : item.category.name === "Events visited"
            ? "Viewed Event"
            : item.category.name === "Groups visited"
            ? "Viewed Group"
            : `Activity: ${item.category.name}`,
          item.data.name,
        ],
      ],
    },
  ];

  async parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    return await parseByStages(file, metadata, this.timelineParsers, []);
  }
}

export default Facebook;
