import { gameBasename, gameKey, gameUrl, resolveActiveGameFromPath, setActiveGame } from "./index";

afterEach(() => setActiveGame("oot"));

describe("resolveActiveGameFromPath", () => {
  it("resolves root and OoT paths to oot", () => {
    expect(resolveActiveGameFromPath("/")).toBe("oot");
    expect(resolveActiveGameFromPath("/tracker")).toBe("oot");
    expect(resolveActiveGameFromPath("/tracker/checks")).toBe("oot");
  });

  it("resolves the /mm prefix to mm", () => {
    expect(resolveActiveGameFromPath("/mm")).toBe("mm");
    expect(resolveActiveGameFromPath("/mm/tracker/checks")).toBe("mm");
  });

  it("does not match a non-boundary prefix", () => {
    expect(resolveActiveGameFromPath("/mmfoo")).toBe("oot");
  });
});

describe("active-game-derived helpers", () => {
  it("namespaces storage keys and basename per active game", () => {
    setActiveGame("oot");
    expect(gameKey("layout")).toBe("oot:layout");
    expect(gameBasename()).toBe("");
    expect(gameUrl("/tracker")).toBe("/tracker");

    setActiveGame("mm");
    expect(gameKey("layout")).toBe("mm:layout");
    expect(gameBasename()).toBe("/mm");
    expect(gameUrl("/tracker")).toBe("/mm/tracker");
  });
});
