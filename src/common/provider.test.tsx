import Color from "colorjs.io";

import { ProviderRegistry } from "@/common/provider";

test.each(ProviderRegistry)("neonColors are computed for $slug", (provider) => {
  const rec2020 = new Color(provider.brandColor)
    .to("rec2020")
    .toGamut({ space: "rec2020" })
    .set("lightness", 65)
    .set("chroma", 132);
  const srgb = rec2020.to("srgb").toGamut({ method: "clip", space: "srgb" });

  expect([provider.neonColor, provider.neonColorHDR]).toEqual([
    srgb.toString({ format: "hex" }),
    rec2020.toString(),
  ]);
});
