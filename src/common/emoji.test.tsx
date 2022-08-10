import EmojiMap from "emoji-name-map";
import { expect, test } from "vitest";

import emoji from "@src/common/emoji.json";

test("emoji.json is up to date", () => {
  expect(emoji).toEqual(EmojiMap.emoji);
});

// emoji = (await import("emoji-name-map")).default.emoji;
// out = JSON.stringify(emoji, null, 2);
// fs.writeFileSync("./emoji.json", out, "utf8");
