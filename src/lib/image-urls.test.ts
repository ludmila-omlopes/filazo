import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedImageUrl } from "./image-urls.ts";

test("allows local images and configured provider artwork", () => {
  assert.equal(isAllowedImageUrl("/brand/playstation-logo.png"), true);
  assert.equal(
    isAllowedImageUrl(
      "https://psnobj.prod.dl.playstation.net/psnobj/NPWR49547_00/cover.png",
    ),
    true,
  );
  assert.equal(
    isAllowedImageUrl("https://images.igdb.com/igdb/image/upload/t_cover_big/game.jpg"),
    true,
  );
});

test("rejects unknown hosts, protocols, malformed values, and unmatched paths", () => {
  assert.equal(isAllowedImageUrl("https://example.com/cover.jpg"), false);
  assert.equal(
    isAllowedImageUrl("http://psnobj.prod.dl.playstation.net/psnobj/cover.png"),
    false,
  );
  assert.equal(
    isAllowedImageUrl("https://psnobj.prod.dl.playstation.net/unexpected/cover.png"),
    false,
  );
  assert.equal(isAllowedImageUrl("//example.com/cover.jpg"), false);
  assert.equal(isAllowedImageUrl("not a url"), false);
});
