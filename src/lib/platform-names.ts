const aliases: Record<string, string> = {
  ps1: "PS1", ps2: "PS2", ps3: "PS3", ps4: "PS4", ps5: "PS5",
  playstation1: "PS1", playstation2: "PS2", playstation3: "PS3",
  playstation4: "PS4", playstation5: "PS5",
  playstationps1: "PS1", playstationps2: "PS2", playstationps3: "PS3",
  playstationps4: "PS4", playstationps5: "PS5",
  playstation: "PlayStation", psp: "PSP", playstationportable: "PSP",
  psvita: "PS Vita", playstationvita: "PS Vita",
  psvr: "PS VR", playstationvr: "PS VR",
  psvr2: "PS VR2", playstationvr2: "PS VR2",
  pc: "PC", pcwindows: "PC", windows: "PC", win32: "PC", win64: "PC",
  pspc: "PC", playstationpc: "PC", xboxwindows: "PC", windows10: "PC", windows11: "PC",
  windowsdesktop: "PC",
  xbox: "Xbox", xboxone: "Xbox One", durango: "Xbox One", xbox360: "Xbox 360",
  xboxseries: "Xbox Series X/S", xboxseriesxs: "Xbox Series X/S",
  xboxseriesx: "Xbox Series X", xboxseriess: "Xbox Series S",
  switch: "Nintendo Switch", nintendoswitch: "Nintendo Switch",
  switch2: "Nintendo Switch 2", nintendoswitch2: "Nintendo Switch 2",
  steam: "Steam", gog: "GOG", linux: "Linux", mac: "macOS", macos: "macOS",
};

/** Normalize per-user platform names, never the catalog's supported platforms. */
export function normalizePlatformNames(value: string | null | undefined): string[] {
  const platforms = new Map<string, string>();
  // Split known PS bundle notation, but keep names such as Xbox Series X/S intact.
  const input = (value ?? "").replace(/(PS[1-5])\s*\/\s*(?=PS[1-5])/gi, "$1,");
  for (const part of input.split(/[,;]/)) {
    const name = part.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const label = aliases[key] ?? name;
    if (!platforms.has(label.toLowerCase())) platforms.set(label.toLowerCase(), label);
  }
  if ([...platforms.values()].some((name) => /^(PS[1-5]|PSP|PS Vita|PS VR2?)$/.test(name))) {
    platforms.delete("playstation");
  }
  if ([...platforms.values()].some((name) => /^Xbox (One|360|Series)/.test(name))) {
    platforms.delete("xbox");
  }
  return [...platforms.values()];
}

export function formatPlatformNames(value: string | null | undefined) {
  return normalizePlatformNames(value).join(", ");
}
