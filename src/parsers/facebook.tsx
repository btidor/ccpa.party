import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type { IgnoreParser, Parser, TimelineParser } from "@src/common/parser";
import type { CategoryKey } from "@src/providers/facebook";
import { parseJSON, smartDecodeText } from "@src/worker/parse";

class Facebook implements Parser<CategoryKey> {
  slug = "facebook";

  ignore: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("**/no-data.txt") },

    // Media
    { glob: new Minimatch("messages/**/files/**") },
    { glob: new Minimatch("messages/**/gifs/**") },
    { glob: new Minimatch("messages/**/photos/**") },
    { glob: new Minimatch("messages/**/videos/**") },
    { glob: new Minimatch("messages/stickers_used/**") },
    { glob: new Minimatch("posts/album/**") },
    { glob: new Minimatch("posts/media/**") },

    // Settings
    { glob: new Minimatch("activity_messages/events_interactions.json") },
    { glob: new Minimatch("activity_messages/group_interactions.json") },
    { glob: new Minimatch("activity_messages/people_and_friends.json") },
    { glob: new Minimatch("facebook_news/your_locations.json") },
    { glob: new Minimatch("groups/creator_badges.json") },
    { glob: new Minimatch("location/primary_location.json") },
    { glob: new Minimatch("location/timezone.json") },
    { glob: new Minimatch("messages/autofill_information.json") },
    { glob: new Minimatch("messages/secret_groups.json") },
    { glob: new Minimatch("other_logged_information/friend_peer_group.json") },
    { glob: new Minimatch("preferences/language_and_locale.json") },
    { glob: new Minimatch("voting_location_and_reminders/location.json") },
    {
      glob: new Minimatch(
        "voting_location_and_reminders/voting_reminders.json"
      ),
    },
    { glob: new Minimatch("your_topics/your_topics.json") },

    // Duplicate
    {
      glob: new Minimatch(
        "security_and_login_information/browser_cookies.json"
      ),
    },
    {
      glob: new Minimatch(
        "security_and_login_information/where_you're_logged_in.json"
      ),
    },
    {
      glob: new Minimatch(
        "security_and_login_information/your_facebook_activity_history.json"
      ),
    },
  ];

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
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
        }).off_facebook_activity_v2.flatMap(
          ({ events, ...rest }: { events: { [key: string]: unknown }[] }) =>
            events.map((item) => ({ company: rest, ...item }))
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
        const parsed = parseJSON(data, { smart: true }).event_responses_v2 as {
          events_joined: { [key: string]: unknown }[];
          events_declined: { [key: string]: unknown }[];
        };
        return parsed.events_joined
          .map((item) => ({
            type: "joined",
            ...item,
          }))
          .concat(
            parsed.events_declined.map((item) => ({
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
        (
          parseJSON(data, { smart: true }).people_and_friends_v2 as {
            name: string;
            entries: { [key: string]: unknown }[];
          }[]
        ).flatMap((category) =>
          category.entries.map((entry) => ({
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
        const { messages, ...rest } = parseJSON(data, { smart: false }) as {
          messages: { [key: string]: unknown }[];
        };
        return messages.map((item) => ({
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
        (
          parseJSON(data, {
            smart: true,
          }).recently_viewed as {
            entries: { timestamp: unknown; [key: string]: unknown }[];
          }[]
        ).flatMap(({ entries, ...rest }) =>
          (entries || [])
            .map((item) => ({ category: rest, ...item }))
            .filter((item) => item.timestamp)
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
        (
          parseJSON(data, {
            smart: true,
          }).visited_things_v2 as {
            entries: { timestamp: unknown; [key: string]: unknown }[];
          }[]
        ).flatMap(({ entries, ...rest }) =>
          (entries || [])
            .map((item) => ({ category: rest, ...item }))
            .filter((item) => item.timestamp)
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
}

export default Facebook;
