// src/domain/contracts/resolveHospitalityContract.ts
function unique(values) {
  return [...new Set(values)];
}
function emptyShape() {
  return {
    preferredCategories: [],
    discouragedCategories: [],
    preferredTags: [],
    discouragedTags: [],
    energyPreference: []
  };
}
function mergeShape(base, patch) {
  return {
    preferredCategories: unique([
      ...base.preferredCategories ?? [],
      ...patch.preferredCategories ?? []
    ]),
    discouragedCategories: unique([
      ...base.discouragedCategories ?? [],
      ...patch.discouragedCategories ?? []
    ]),
    preferredTags: unique([...base.preferredTags ?? [], ...patch.preferredTags ?? []]),
    discouragedTags: unique([...base.discouragedTags ?? [], ...patch.discouragedTags ?? []]),
    energyPreference: unique([
      ...base.energyPreference ?? [],
      ...patch.energyPreference ?? []
    ])
  };
}
function roleRulePatch(label, strength, shape, maxEnergyLevel) {
  return {
    label,
    strength,
    preferredCategories: shape.preferredCategories ?? [],
    discouragedCategories: shape.discouragedCategories ?? [],
    preferredTags: shape.preferredTags ?? [],
    discouragedTags: shape.discouragedTags ?? [],
    maxEnergyLevel
  };
}
function getBlendMode(vibe, persona) {
  if (!persona) {
    return {
      blendMode: "vibe_only",
      compatibility: "reinforcing",
      resolutionSummary: "Vibe-only contract; no explicit persona modifier applied.",
      priority: {
        highlightStructure: "vibe",
        pacingEnergy: "vibe",
        rolePreferences: "vibe"
      }
    };
  }
  if (persona === "romantic") {
    if (vibe === "cozy" || vibe === "chill" || vibe === "cultured" || vibe === "adventurous-outdoor") {
      return {
        blendMode: "aligned",
        compatibility: "reinforcing",
        resolutionSummary: vibe === "cultured" ? "Cultured supplies thoughtful setting while romantic requires an intimate highlight moment." : vibe === "adventurous-outdoor" ? "Outdoor exploration supplies the setting while romantic resolves the highlight into a scenic shared moment." : "Cozy pacing and romantic intent reinforce each other into a low-energy intimate moment.",
        priority: {
          highlightStructure: "persona",
          pacingEnergy: "balanced",
          rolePreferences: "balanced"
        }
      };
    }
    return {
      blendMode: "selective_energy",
      compatibility: "tension",
      resolutionSummary: "Vibe supplies movement and selective energy, while romantic caps chaos and keeps the highlight date-shaped.",
      priority: {
        highlightStructure: "persona",
        pacingEnergy: "balanced",
        rolePreferences: "balanced"
      }
    };
  }
  if (persona === "friends") {
    if (vibe === "cozy" || vibe === "chill" || vibe === "cultured") {
      return {
        blendMode: "tension",
        compatibility: "tension",
        resolutionSummary: "Vibe keeps the route calmer, while friends preserves one social focal point without flattening into a generic middle.",
        priority: {
          highlightStructure: "balanced",
          pacingEnergy: "vibe",
          rolePreferences: "balanced"
        }
      };
    }
    return {
      blendMode: "aligned",
      compatibility: "reinforcing",
      resolutionSummary: "Social persona and energetic vibe reinforce each other around movement, interaction, and a louder highlight.",
      priority: {
        highlightStructure: "balanced",
        pacingEnergy: "balanced",
        rolePreferences: "balanced"
      }
    };
  }
  if (vibe === "lively" || vibe === "playful" || vibe === "adventurous-urban") {
    return {
      blendMode: "selective_energy",
      compatibility: "tension",
      resolutionSummary: "Vibe supplies activity, while family caps adult-nightlife pressure and keeps the route accessible.",
      priority: {
        highlightStructure: "persona",
        pacingEnergy: "balanced",
        rolePreferences: "persona"
      }
    };
  }
  return {
    blendMode: "aligned",
    compatibility: "reinforcing",
    resolutionSummary: "Vibe and family persona both support calmer pacing, accessibility, and lower-noise highlights.",
    priority: {
      highlightStructure: "persona",
      pacingEnergy: "balanced",
      rolePreferences: "persona"
    }
  };
}
function buildRomanticContract(vibe) {
  const baseStart = mergeShape(emptyShape(), {
    preferredCategories: ["cafe", "park", "dessert"],
    discouragedCategories: ["activity"],
    preferredTags: ["cozy", "intimate", "calm"]
  });
  const baseHighlight = mergeShape(emptyShape(), {
    preferredCategories: ["park", "activity", "museum", "live_music", "dessert", "restaurant"],
    discouragedCategories: ["event", "bar"],
    preferredTags: ["scenic", "ambient", "craft", "design-forward", "walkable"],
    energyPreference: ["low", "medium"]
  });
  const baseWindDown = mergeShape(emptyShape(), {
    preferredCategories: ["dessert", "cafe", "park"],
    discouragedCategories: ["activity", "event"],
    preferredTags: ["calm", "easygoing"],
    energyPreference: ["low"]
  });
  let highlight = baseHighlight;
  let start = baseStart;
  let windDown = baseWindDown;
  let preferredCategories = ["restaurant", "dessert", "park"];
  let discouragedCategories = ["event"];
  let preferredTags = ["cozy", "intimate", "craft", "conversation"];
  let discouragedTags = ["high-energy", "arcade"];
  let energyBandAdditions = [];
  let energyBandRemovals = [];
  let movementToleranceCap = "medium";
  let toneOverride = "intimate";
  let windDownExpectation = {
    closeToBase: true
  };
  let highlightEnergyPreference = ["low", "medium"];
  if (vibe === "lively" || vibe === "playful" || vibe === "adventurous-urban") {
    highlight = mergeShape(highlight, {
      preferredCategories: vibe === "playful" ? ["activity", "dessert"] : ["live_music", "activity", "restaurant"],
      preferredTags: vibe === "lively" ? ["listening", "stylish", "intimate"] : vibe === "adventurous-urban" ? ["walkable", "local", "design-forward"] : ["playful", "shared"],
      discouragedTags: ["chaotic", "festival"],
      energyPreference: ["medium"]
    });
    start = mergeShape(start, {
      energyPreference: ["low", "medium"]
    });
    preferredTags = unique([...preferredTags, "shared", "intentional"]);
    discouragedTags = unique([...discouragedTags, "chaotic"]);
    movementToleranceCap = "medium";
    energyBandAdditions = ["medium"];
    energyBandRemovals = vibe === "playful" ? ["high"] : [];
    windDownExpectation = {
      closeToBase: true,
      maxEnergy: "low"
    };
    highlightEnergyPreference = ["medium"];
  } else if (vibe === "cultured") {
    highlight = mergeShape(highlight, {
      preferredCategories: ["museum", "live_music"],
      preferredTags: ["thoughtful", "listening", "curated"]
    });
    preferredTags = unique([...preferredTags, "thoughtful", "curated"]);
    windDownExpectation = {
      closeToBase: true,
      maxEnergy: "low"
    };
  } else if (vibe === "adventurous-outdoor") {
    highlight = mergeShape(highlight, {
      preferredCategories: ["park", "activity"],
      preferredTags: ["garden", "viewpoint", "stroll"]
    });
    start = mergeShape(start, {
      preferredCategories: ["park", "cafe"],
      preferredTags: ["walkable", "fresh-air"]
    });
    preferredTags = unique([...preferredTags, "garden", "stroll"]);
    windDown = mergeShape(windDown, {
      preferredCategories: ["park", "dessert", "cafe"]
    });
  }
  const resolvedContract = {
    primaryVibe: vibe,
    persona: "romantic",
    ...getBlendMode(vibe, "romantic"),
    toneOverride,
    movementToleranceCap,
    repetitionToleranceOverride: "low",
    wildcardAggressivenessMax: 0.42,
    energyBandAdditions,
    energyBandRemovals,
    preferredCategories,
    discouragedCategories,
    preferredTags,
    discouragedTags,
    rolePreferences: {
      start,
      highlight,
      windDown
    },
    windDownExpectation,
    highlight: {
      requiresMomentPresence: true,
      requireMomentPresenceStrength: "soft",
      preferredHighlightTypes: ["activity", "scenic", "ambient"],
      discourageGenericHighlight: true,
      preferredCategories: highlight.preferredCategories ?? [],
      discouragedCategories: highlight.discouragedCategories ?? [],
      preferredTags: highlight.preferredTags ?? [],
      discouragedTags: highlight.discouragedTags ?? [],
      energyPreference: highlightEnergyPreference
    }
  };
  return {
    resolvedContract,
    personaContract: {
      persona: "romantic",
      requiresMomentPresence: true,
      requireMomentPresenceStrength: "soft",
      preferredHighlightTypes: ["activity", "scenic", "ambient"],
      discourageGenericHighlight: true
    },
    roleRulePatches: {
      start: roleRulePatch("Resolved romantic start contract", "strong", start),
      highlight: roleRulePatch(
        "Resolved romantic highlight contract",
        "strong",
        highlight,
        resolvedContract.highlight.energyPreference.includes("low") ? 3 : 4
      ),
      windDown: roleRulePatch("Resolved romantic wind-down contract", "strong", windDown, 3)
    }
  };
}
function buildFriendsContract(vibe) {
  const highlight = mergeShape(emptyShape(), {
    preferredCategories: vibe === "cozy" || vibe === "chill" || vibe === "cultured" ? ["activity", "live_music", "restaurant"] : ["activity", "live_music", "bar", "event"],
    preferredTags: ["social", "interactive"],
    discouragedCategories: vibe === "cozy" || vibe === "chill" ? ["park"] : [],
    energyPreference: vibe === "cozy" || vibe === "chill" || vibe === "cultured" ? ["medium"] : ["medium", "high"]
  });
  const start = mergeShape(emptyShape(), {
    preferredCategories: ["activity", "restaurant", "cafe"],
    preferredTags: ["social", "playful"],
    energyPreference: ["medium"]
  });
  const surprise = mergeShape(emptyShape(), {
    preferredCategories: ["event", "activity", "dessert"],
    preferredTags: ["community", "unexpected"],
    energyPreference: ["medium", "high"]
  });
  const resolvedContract = {
    primaryVibe: vibe,
    persona: "friends",
    ...getBlendMode(vibe, "friends"),
    toneOverride: vibe === "cozy" || vibe === "chill" ? void 0 : "electric",
    movementToleranceOverride: vibe === "cozy" || vibe === "chill" || vibe === "cultured" ? void 0 : "high",
    repetitionToleranceOverride: vibe === "cozy" || vibe === "chill" ? "medium" : void 0,
    wildcardAggressivenessMin: 0.58,
    energyBandAdditions: vibe === "cozy" || vibe === "chill" || vibe === "cultured" ? [] : ["high"],
    energyBandRemovals: [],
    preferredCategories: ["activity", "bar", "live_music", "event"],
    discouragedCategories: [],
    preferredTags: ["social", "buzzing", "interactive"],
    discouragedTags: ["silent"],
    rolePreferences: {
      start,
      highlight,
      surprise
    },
    windDownExpectation: {
      closeToBase: false
    },
    highlight: {
      requiresMomentPresence: false,
      requireMomentPresenceStrength: "none",
      preferredHighlightTypes: [],
      discourageGenericHighlight: false,
      preferredCategories: highlight.preferredCategories ?? [],
      discouragedCategories: highlight.discouragedCategories ?? [],
      preferredTags: highlight.preferredTags ?? [],
      discouragedTags: [],
      energyPreference: highlight.energyPreference ?? []
    }
  };
  return {
    resolvedContract,
    roleRulePatches: {
      start: roleRulePatch("Resolved friends start contract", "soft", start),
      highlight: roleRulePatch("Resolved friends highlight contract", "soft", highlight),
      surprise: roleRulePatch("Resolved friends surprise contract", "soft", surprise),
      windDown: roleRulePatch(
        "Resolved friends wind-down contract",
        "soft",
        mergeShape(emptyShape(), {
          preferredCategories: ["dessert", "bar", "cafe", "restaurant"]
        })
      )
    }
  };
}
function buildFamilyContract(vibe) {
  const highlight = mergeShape(emptyShape(), {
    preferredCategories: vibe === "lively" || vibe === "playful" || vibe === "adventurous-urban" ? ["museum", "activity", "event", "park"] : ["museum", "park", "activity", "event", "cafe"],
    discouragedCategories: ["bar", "live_music"],
    preferredTags: ["interactive", "accessible", "hands-on"],
    energyPreference: ["low", "medium"]
  });
  const resolvedContract = {
    primaryVibe: vibe,
    persona: "family",
    ...getBlendMode(vibe, "family"),
    movementToleranceOverride: vibe === "lively" || vibe === "playful" || vibe === "adventurous-urban" ? void 0 : "low",
    movementToleranceCap: "medium",
    repetitionToleranceOverride: "low",
    wildcardAggressivenessMin: 0.38,
    wildcardAggressivenessMax: 0.5,
    energyBandAdditions: [],
    energyBandRemovals: [],
    preferredCategories: ["museum", "park", "activity", "dessert"],
    discouragedCategories: ["bar", "live_music"],
    preferredTags: ["hands-on", "accessible", "walkable"],
    discouragedTags: ["late-night", "crowded"],
    rolePreferences: {
      start: {
        preferredCategories: ["park", "museum", "cafe"],
        preferredTags: ["easygoing", "hands-on"]
      },
      highlight,
      windDown: {
        preferredCategories: ["park", "dessert", "cafe"],
        preferredTags: ["calm", "accessible"],
        discouragedCategories: ["bar", "live_music"],
        energyPreference: ["low"]
      }
    },
    windDownExpectation: {
      closeToBase: true,
      maxEnergy: "low"
    },
    highlight: {
      requiresMomentPresence: false,
      requireMomentPresenceStrength: "none",
      preferredHighlightTypes: [],
      discourageGenericHighlight: false,
      preferredCategories: highlight.preferredCategories ?? [],
      discouragedCategories: highlight.discouragedCategories ?? [],
      preferredTags: highlight.preferredTags ?? [],
      discouragedTags: [],
      energyPreference: highlight.energyPreference ?? ["low", "medium"]
    }
  };
  return {
    resolvedContract,
    roleRulePatches: {
      start: roleRulePatch(
        "Resolved family start contract",
        "strong",
        resolvedContract.rolePreferences.start ?? {},
        3
      ),
      highlight: {
        ...roleRulePatch("Resolved family highlight contract", "hard", highlight, 4),
        requiredCategories: ["museum", "park", "activity", "event", "cafe"],
        requiredTags: ["family-friendly", "accessible", "hands-on", "walkable"]
      },
      windDown: roleRulePatch(
        "Resolved family wind-down contract",
        "strong",
        resolvedContract.rolePreferences.windDown ?? {},
        3
      )
    }
  };
}
function buildVibeOnlyContract(vibe) {
  return {
    resolvedContract: {
      primaryVibe: vibe,
      ...getBlendMode(vibe, void 0),
      energyBandAdditions: [],
      energyBandRemovals: [],
      preferredCategories: [],
      discouragedCategories: [],
      preferredTags: [],
      discouragedTags: [],
      rolePreferences: {},
      windDownExpectation: {},
      highlight: {
        requiresMomentPresence: false,
        requireMomentPresenceStrength: "none",
        preferredHighlightTypes: [],
        discourageGenericHighlight: false,
        preferredCategories: [],
        discouragedCategories: [],
        preferredTags: [],
        discouragedTags: [],
        energyPreference: []
      }
    },
    roleRulePatches: {}
  };
}
function resolveHospitalityContract(intent) {
  const persona = intent.personaSource === "explicit" ? intent.persona : void 0;
  if (persona === "romantic") {
    return buildRomanticContract(intent.primaryAnchor);
  }
  if (persona === "friends") {
    return buildFriendsContract(intent.primaryAnchor);
  }
  if (persona === "family") {
    return buildFamilyContract(intent.primaryAnchor);
  }
  return buildVibeOnlyContract(intent.primaryAnchor);
}

// src/domain/contracts/getRoleContract.ts
function unique2(values) {
  return [...new Set(values)];
}
function strengthRank(value) {
  if (value === "none") {
    return 0;
  }
  if (value === "soft") {
    return 1;
  }
  if (value === "strong") {
    return 2;
  }
  return 3;
}
function stronger(left, right) {
  return strengthRank(left) >= strengthRank(right) ? left : right;
}
function baseRule(role) {
  return {
    label: `Default ${role}`,
    role,
    strength: "none",
    requiredCategories: [],
    preferredCategories: [],
    discouragedCategories: [],
    requiredTags: [],
    preferredTags: [],
    discouragedTags: []
  };
}
function mergeRule(base, patch) {
  return {
    ...base,
    label: patch.label ?? base.label,
    strength: patch.strength ? stronger(base.strength, patch.strength) : base.strength,
    requiredCategories: unique2([...base.requiredCategories ?? [], ...patch.requiredCategories ?? []]),
    preferredCategories: unique2([...base.preferredCategories ?? [], ...patch.preferredCategories ?? []]),
    discouragedCategories: unique2([...base.discouragedCategories ?? [], ...patch.discouragedCategories ?? []]),
    requiredTags: unique2([...base.requiredTags ?? [], ...patch.requiredTags ?? []]),
    preferredTags: unique2([...base.preferredTags ?? [], ...patch.preferredTags ?? []]),
    discouragedTags: unique2([...base.discouragedTags ?? [], ...patch.discouragedTags ?? []]),
    maxEnergyLevel: typeof patch.maxEnergyLevel === "number" ? typeof base.maxEnergyLevel === "number" ? Math.min(base.maxEnergyLevel, patch.maxEnergyLevel) : patch.maxEnergyLevel : base.maxEnergyLevel
  };
}
function asCategories(values) {
  return values ?? [];
}
function starterPackContracts(starterPack) {
  if (!starterPack?.roleContracts) {
    return {};
  }
  const build = (role, label) => {
    const contract = starterPack.roleContracts?.[role];
    if (!contract) {
      return void 0;
    }
    return {
      label,
      strength: contract.strength,
      requiredCategories: asCategories(contract.requiredCategories),
      preferredCategories: asCategories(contract.preferredCategories),
      discouragedCategories: asCategories(contract.discouragedCategories),
      requiredTags: contract.requiredTags ?? [],
      preferredTags: contract.preferredTags ?? [],
      discouragedTags: contract.discouragedTags ?? [],
      maxEnergyLevel: contract.maxEnergyLevel
    };
  };
  return {
    start: build("start", `${starterPack.title} start contract`),
    highlight: build("highlight", `${starterPack.title} highlight contract`),
    surprise: build("surprise", `${starterPack.title} surprise contract`),
    windDown: build("windDown", `${starterPack.title} wind-down contract`)
  };
}
function tightenForStrictShape(rule) {
  const tighterStrength = rule.strength === "none" ? "soft" : rule.strength === "soft" ? "strong" : "hard";
  return {
    ...rule,
    strength: tighterStrength,
    maxEnergyLevel: typeof rule.maxEnergyLevel === "number" ? Math.max(1, rule.maxEnergyLevel - 1) : rule.role === "windDown" ? 3 : void 0
  };
}
function getRoleContract({
  intent,
  starterPack,
  strictShapeEnabled = false
}) {
  const base = {
    start: baseRule("start"),
    highlight: baseRule("highlight"),
    surprise: baseRule("surprise"),
    windDown: baseRule("windDown")
  };
  const resolvedContractPackage = resolveHospitalityContract(intent);
  const persona = resolvedContractPackage.roleRulePatches;
  const pack = starterPackContracts(starterPack);
  const merged = {
    sourceLabels: [intent.crew, starterPack?.id].filter(Boolean),
    personaContract: resolvedContractPackage.personaContract,
    resolvedContract: resolvedContractPackage.resolvedContract,
    byRole: {
      start: mergeRule(mergeRule(base.start, persona.start ?? {}), pack.start ?? {}),
      highlight: mergeRule(mergeRule(base.highlight, persona.highlight ?? {}), pack.highlight ?? {}),
      surprise: mergeRule(mergeRule(base.surprise, persona.surprise ?? {}), pack.surprise ?? {}),
      windDown: mergeRule(mergeRule(base.windDown, persona.windDown ?? {}), pack.windDown ?? {})
    }
  };
  if (!strictShapeEnabled) {
    return merged;
  }
  return {
    sourceLabels: [...merged.sourceLabels, "strict-shape"],
    personaContract: merged.personaContract,
    resolvedContract: merged.resolvedContract,
    byRole: {
      start: tightenForStrictShape(merged.byRole.start),
      highlight: tightenForStrictShape(merged.byRole.highlight),
      surprise: tightenForStrictShape(merged.byRole.surprise),
      windDown: tightenForStrictShape(merged.byRole.windDown)
    }
  };
}

// src/domain/intent/getCrewPolicy.ts
var crewPolicies = {
  romantic: {
    crew: "romantic",
    preferredCategories: ["restaurant", "dessert", "cafe", "park", "museum"],
    discouragedCategories: ["activity", "event"],
    blockedCategories: [],
    preferredVibes: ["cozy", "cultured", "chill", "adventurous-outdoor"],
    maxPriceTier: "$$$$",
    targetEnergy: 2.2,
    hiddenGemBias: 0.15,
    wildcardBias: 0.04,
    diversityBias: 0.14,
    proximityStrictness: 0.86,
    windDownPreferredCategories: ["dessert", "park", "cafe", "restaurant"],
    windDownAvoidCategories: ["activity", "event"]
  },
  socialite: {
    crew: "socialite",
    preferredCategories: ["bar", "live_music", "activity", "event", "restaurant", "dessert"],
    discouragedCategories: ["park"],
    blockedCategories: [],
    preferredVibes: ["lively", "playful", "adventurous-urban", "cultured"],
    maxPriceTier: "$$$$",
    targetEnergy: 4.2,
    hiddenGemBias: 0.1,
    wildcardBias: 0.22,
    diversityBias: 0.28,
    proximityStrictness: 0.48,
    windDownPreferredCategories: ["dessert", "cafe", "bar"],
    windDownAvoidCategories: ["activity"]
  },
  curator: {
    crew: "curator",
    preferredCategories: ["museum", "park", "activity", "cafe", "dessert", "event", "restaurant"],
    discouragedCategories: ["bar", "live_music"],
    blockedCategories: ["bar"],
    preferredVibes: ["cultured", "adventurous-outdoor", "chill", "playful", "cozy"],
    maxPriceTier: "$$$",
    targetEnergy: 2.6,
    hiddenGemBias: 0.11,
    wildcardBias: 0.08,
    diversityBias: 0.19,
    proximityStrictness: 0.82,
    windDownPreferredCategories: ["park", "dessert", "cafe", "museum"],
    windDownAvoidCategories: ["live_music", "activity"]
  }
};
function getCrewPolicy(crew) {
  return crewPolicies[crew];
}

// src/domain/taste/getVibeProfile.ts
function buildShape(preferredCategories, discouragedCategories, preferredTags, discouragedTags, energyPreference) {
  return {
    preferredCategories,
    discouragedCategories,
    preferredTags,
    discouragedTags,
    energyPreference
  };
}
var vibeProfiles = {
  cozy: {
    vibe: "cozy",
    label: "Cozy",
    sublabel: "warm | intimate | relaxed",
    legacyTags: ["cozy", "culinary", "relaxed"],
    idealEnergyRange: [1, 3],
    preferredCategories: ["restaurant", "cafe", "dessert", "park"],
    discouragedCategories: ["activity", "event", "live_music"],
    preferredTags: ["cozy", "intimate", "conversation", "slow-paced", "craft", "wine"],
    discouragedTags: ["high-energy", "crowded", "arcade", "festival", "chaotic"],
    toneBias: "intimate",
    discoveryBias: "medium",
    movementTolerance: "low",
    energyBand: ["low", "medium"],
    start: buildShape(
      ["cafe", "park", "restaurant"],
      ["activity", "event"],
      ["cozy", "walkable", "intimate", "conversation"],
      ["arcade", "high-energy"],
      ["low", "medium"]
    ),
    highlight: buildShape(
      ["restaurant", "dessert", "cafe"],
      ["activity", "event", "live_music"],
      ["chef-led", "intimate", "cozy", "conversation", "craft", "wine"],
      ["chaotic", "festival", "arcade", "late-night"],
      ["low", "medium"]
    ),
    surprise: buildShape(
      ["dessert", "cafe", "park"],
      ["activity", "event"],
      ["understated", "craft", "quiet", "local"],
      ["high-energy", "crowded"],
      ["low", "medium"]
    ),
    windDown: buildShape(
      ["dessert", "cafe", "park"],
      ["activity", "event", "live_music"],
      ["calm", "cozy", "soft-landing", "easygoing"],
      ["high-energy", "crowded"],
      ["low"]
    )
  },
  lively: {
    vibe: "lively",
    label: "Lively",
    sublabel: "energetic | social | buzzing",
    legacyTags: ["lively", "creative"],
    idealEnergyRange: [3, 5],
    preferredCategories: ["bar", "live_music", "event", "activity", "restaurant"],
    discouragedCategories: ["park"],
    preferredTags: ["social", "buzzing", "high-energy", "cocktails", "live"],
    discouragedTags: ["silent", "sleepy", "quiet-only"],
    toneBias: "electric",
    discoveryBias: "medium",
    movementTolerance: "high",
    energyBand: ["medium", "high"],
    start: buildShape(
      ["restaurant", "bar", "activity"],
      ["park"],
      ["social", "quick-start", "playful"],
      ["silent"],
      ["medium"]
    ),
    highlight: buildShape(
      ["live_music", "bar", "event", "activity"],
      ["park", "museum"],
      ["high-energy", "social", "cocktails", "live", "interactive"],
      ["sleepy", "quiet"],
      ["medium", "high"]
    ),
    surprise: buildShape(
      ["event", "live_music", "bar"],
      ["park"],
      ["unexpected", "underexposed", "community"],
      ["predictable"],
      ["medium", "high"]
    ),
    windDown: buildShape(
      ["bar", "dessert", "cafe"],
      ["activity"],
      ["easygoing", "comfort", "social"],
      ["chaotic"],
      ["low", "medium"]
    )
  },
  playful: {
    vibe: "playful",
    label: "Playful",
    sublabel: "fun | active | interactive",
    legacyTags: ["playful", "creative"],
    idealEnergyRange: [3, 5],
    preferredCategories: ["activity", "event", "dessert", "cafe"],
    discouragedCategories: ["museum"],
    preferredTags: ["interactive", "games", "fun", "social", "hands-on"],
    discouragedTags: ["formal", "sleepy"],
    toneBias: "electric",
    discoveryBias: "medium",
    movementTolerance: "medium",
    energyBand: ["medium", "high"],
    start: buildShape(
      ["cafe", "activity", "dessert"],
      ["museum"],
      ["playful", "quick-start", "interactive"],
      ["formal"],
      ["medium"]
    ),
    highlight: buildShape(
      ["activity", "event", "dessert"],
      ["museum", "park"],
      ["interactive", "games", "fun", "social"],
      ["sleepy"],
      ["medium", "high"]
    ),
    surprise: buildShape(
      ["event", "dessert", "activity"],
      ["museum"],
      ["unexpected", "community", "interactive"],
      ["predictable"],
      ["medium", "high"]
    ),
    windDown: buildShape(
      ["dessert", "cafe", "bar"],
      ["activity"],
      ["comfort", "easygoing", "social"],
      ["chaotic"],
      ["low", "medium"]
    )
  },
  cultured: {
    vibe: "cultured",
    label: "Cultured",
    sublabel: "arts | music | thoughtful",
    legacyTags: ["cultured", "culture", "creative"],
    idealEnergyRange: [2, 4],
    preferredCategories: ["museum", "live_music", "event", "restaurant"],
    discouragedCategories: ["activity"],
    preferredTags: ["curated", "immersive", "performance", "listening", "thoughtful"],
    discouragedTags: ["arcade", "chaotic"],
    toneBias: "refined",
    discoveryBias: "medium",
    movementTolerance: "medium",
    energyBand: ["low", "medium"],
    start: buildShape(
      ["museum", "cafe", "park"],
      ["activity"],
      ["thoughtful", "curated", "walkable"],
      ["chaotic"],
      ["low", "medium"]
    ),
    highlight: buildShape(
      ["museum", "live_music", "event", "restaurant"],
      ["activity"],
      ["curated", "immersive", "performance", "listening", "story"],
      ["arcade", "sleepy"],
      ["medium"]
    ),
    surprise: buildShape(
      ["event", "museum", "dessert"],
      ["activity"],
      ["local-artists", "underexposed", "community"],
      ["predictable"],
      ["low", "medium"]
    ),
    windDown: buildShape(
      ["dessert", "cafe", "park", "museum"],
      ["activity", "event"],
      ["calm", "quiet", "reflective"],
      ["high-energy"],
      ["low"]
    )
  },
  chill: {
    vibe: "chill",
    label: "Chill",
    sublabel: "easygoing | casual | low-pressure",
    legacyTags: ["chill", "relaxed", "cozy"],
    idealEnergyRange: [1, 3],
    preferredCategories: ["cafe", "park", "dessert", "restaurant", "museum"],
    discouragedCategories: ["event"],
    preferredTags: ["easygoing", "calm", "casual", "low-pressure", "quiet"],
    discouragedTags: ["high-energy", "crowded", "chaotic"],
    toneBias: "intimate",
    discoveryBias: "low",
    movementTolerance: "low",
    energyBand: ["low", "medium"],
    start: buildShape(
      ["cafe", "park", "dessert"],
      ["event"],
      ["easygoing", "casual", "walkable"],
      ["high-energy"],
      ["low", "medium"]
    ),
    highlight: buildShape(
      ["restaurant", "cafe", "park", "museum"],
      ["event", "activity"],
      ["low-pressure", "comfortable", "quiet", "thoughtful"],
      ["chaotic", "crowded"],
      ["low", "medium"]
    ),
    surprise: buildShape(
      ["park", "dessert", "cafe"],
      ["event"],
      ["understated", "local", "quiet"],
      ["high-energy"],
      ["low", "medium"]
    ),
    windDown: buildShape(
      ["dessert", "cafe", "park"],
      ["activity", "event"],
      ["calm", "soft-landing", "easygoing"],
      ["crowded"],
      ["low"]
    )
  },
  "adventurous-outdoor": {
    vibe: "adventurous-outdoor",
    label: "Adventurous (Outdoor)",
    sublabel: "scenic | open-air | exploratory",
    legacyTags: ["adventurous-outdoor", "outdoors", "relaxed"],
    idealEnergyRange: [2, 4],
    preferredCategories: ["park", "activity", "cafe", "dessert"],
    discouragedCategories: ["bar", "museum", "live_music"],
    preferredTags: [
      "walkable",
      "nature",
      "scenic",
      "fresh-air",
      "viewpoint",
      "trail",
      "garden",
      "stargazing",
      "outdoor-seating"
    ],
    discouragedTags: ["indoors-only", "late-night", "district", "street-food", "night-market"],
    toneBias: "refined",
    discoveryBias: "medium",
    movementTolerance: "medium",
    energyBand: ["low", "medium"],
    start: buildShape(
      ["park", "cafe"],
      ["bar", "museum"],
      ["walkable", "scenic", "fresh-air", "garden"],
      ["late-night", "district"],
      ["low", "medium"]
    ),
    highlight: buildShape(
      ["park", "activity", "cafe", "dessert"],
      ["bar", "live_music", "museum"],
      ["nature", "open-air", "viewpoint", "exploratory", "trail", "garden", "stargazing"],
      ["indoors-only", "late-night", "district", "street-food"],
      ["medium"]
    ),
    surprise: buildShape(
      ["park", "dessert", "activity"],
      ["bar", "museum"],
      ["underexposed", "trail", "community", "garden", "viewpoint"],
      ["chaotic", "district"],
      ["low", "medium"]
    ),
    windDown: buildShape(
      ["dessert", "park", "cafe"],
      ["activity", "museum", "live_music"],
      ["calm", "scenic", "soft-landing", "quiet", "outdoor-seating"],
      ["crowded", "late-night"],
      ["low"]
    )
  },
  "adventurous-urban": {
    vibe: "adventurous-urban",
    label: "Adventurous (Urban)",
    sublabel: "local | wandering | discovery",
    legacyTags: ["adventurous-urban", "creative", "culinary"],
    idealEnergyRange: [2, 4],
    preferredCategories: ["restaurant", "bar", "event", "cafe", "live_music", "dessert"],
    discouragedCategories: ["museum", "park"],
    preferredTags: [
      "underexposed",
      "street-food",
      "district",
      "local",
      "community",
      "wandering",
      "market",
      "food-hall",
      "live-popups",
      "neighborhood"
    ],
    discouragedTags: ["predictable", "chain", "sleepy", "nature", "trail", "viewpoint", "garden"],
    toneBias: "electric",
    discoveryBias: "high",
    movementTolerance: "high",
    energyBand: ["medium", "high"],
    start: buildShape(
      ["cafe", "restaurant", "event"],
      ["museum", "park"],
      ["local", "district", "community", "neighborhood"],
      ["predictable", "nature"],
      ["medium"]
    ),
    highlight: buildShape(
      ["restaurant", "bar", "event", "live_music", "dessert"],
      ["museum", "park"],
      ["underexposed", "street-food", "wandering", "community", "local", "market", "food-hall"],
      ["chain", "predictable", "nature", "trail", "viewpoint"],
      ["medium", "high"]
    ),
    surprise: buildShape(
      ["event", "bar", "dessert", "restaurant"],
      ["museum"],
      ["unexpected", "underexposed", "community", "local", "live-popups"],
      ["predictable", "nature"],
      ["medium", "high"]
    ),
    windDown: buildShape(
      ["dessert", "cafe", "bar"],
      ["activity", "park"],
      ["easygoing", "local", "comfort", "neighborhood"],
      ["chaotic", "nature"],
      ["low", "medium"]
    )
  }
};
function getVibeProfile(vibe) {
  return vibeProfiles[vibe];
}
function normalizeTag(tag) {
  return tag.trim().toLowerCase();
}
function venueMatchesVibeTag(venue, vibe) {
  const profile = getVibeProfile(vibe);
  return profile.legacyTags.some((tag) => venue.vibeTags.includes(tag));
}
function tagOverlapScore(venueTags, targetTags) {
  if (targetTags.length === 0) {
    return 0;
  }
  const normalizedVenueTags = new Set(venueTags.map(normalizeTag));
  const matches = targetTags.filter((tag) => normalizedVenueTags.has(normalizeTag(tag))).length;
  return matches / targetTags.length;
}
function scoreVibeTagAffinity(venue, vibe) {
  const profile = getVibeProfile(vibe);
  const categoryFit = profile.preferredCategories.includes(venue.category) ? 1 : 0.36;
  const categoryPenalty = profile.discouragedCategories.includes(venue.category) ? 0.24 : 0;
  const tagFit = tagOverlapScore(venue.tags, profile.preferredTags);
  const discouragedFit = tagOverlapScore(venue.tags, profile.discouragedTags);
  const vibeTagFit = venueMatchesVibeTag(venue, vibe) ? 1 : 0.18;
  const [minEnergy, maxEnergy] = profile.idealEnergyRange;
  const energyDistance = venue.energyLevel >= minEnergy && venue.energyLevel <= maxEnergy ? 0 : Math.min(
    Math.abs(venue.energyLevel - minEnergy),
    Math.abs(venue.energyLevel - maxEnergy)
  );
  const energyFit = energyDistance === 0 ? 1 : Math.max(0, 1 - energyDistance / 4);
  return Math.max(
    0,
    Math.min(
      1,
      categoryFit * 0.34 + vibeTagFit * 0.26 + tagFit * 0.18 + energyFit * 0.22 - categoryPenalty - discouragedFit * 0.16
    )
  );
}
function getRoleShapeForVibe(vibe, role) {
  const profile = getVibeProfile(vibe);
  if (role === "start") {
    return profile.start;
  }
  if (role === "highlight") {
    return profile.highlight;
  }
  if (role === "surprise") {
    return profile.surprise;
  }
  return profile.windDown;
}

// src/domain/taste/selectTasteMode.ts
var tasteModes = {
  "cozy-flow": {
    id: "cozy-flow",
    label: "Cozy Flow",
    biasSummary: "Favor intimate openers, conversation-friendly highlights, and soft landings.",
    favoredCategories: ["cafe", "dessert", "restaurant", "park"],
    discouragedCategories: ["activity", "event", "live_music"],
    favoredTags: ["cozy", "intimate", "conversation", "craft", "quiet", "wine"],
    discouragedTags: ["festival", "arcade", "chaotic", "high-energy"],
    favoredLanes: ["dining", "sweet", "outdoor"],
    discouragedLanes: ["activity"],
    enforcementStrength: "moderate",
    alignmentWeight: 0.14,
    penaltyWeight: 0.06,
    movementTolerance: "low",
    discoveryBias: "medium",
    wildcardAggressivenessFloor: 0.36,
    energyBand: ["low", "medium"],
    roleBoosts: {
      start: 0.095,
      highlight: 0.075,
      surprise: 0.05,
      windDown: 0.1
    },
    stopShapePatches: {
      start: {
        preferredCategories: ["cafe", "park", "restaurant"],
        preferredTags: ["cozy", "intimate", "walkable"]
      },
      highlight: {
        preferredCategories: ["restaurant", "dessert", "cafe"],
        preferredTags: ["conversation", "chef-led", "craft"]
      },
      windDown: {
        preferredCategories: ["dessert", "cafe", "park"],
        preferredTags: ["calm", "soft-landing", "easygoing"]
      }
    },
    reasonBuilder: (intent) => `Primary vibe is ${intent.primaryAnchor}, so Taste keeps the night low-friction and close to conversation.`
  },
  "highlight-centered": {
    id: "highlight-centered",
    label: "Highlight-Centered",
    biasSummary: "Hold back early so one strong stop clearly carries the night.",
    favoredCategories: ["restaurant", "live_music", "museum", "event", "bar"],
    discouragedCategories: ["park"],
    favoredTags: ["chef-led", "immersive", "performance", "signature", "curated", "cocktails"],
    discouragedTags: ["predictable", "sleepy"],
    favoredLanes: ["dining", "culture", "drinks"],
    discouragedLanes: ["outdoor"],
    enforcementStrength: "moderate",
    alignmentWeight: 0.15,
    penaltyWeight: 0.05,
    movementTolerance: "medium",
    discoveryBias: "medium",
    wildcardAggressivenessFloor: 0.48,
    energyBand: ["medium", "high"],
    roleBoosts: {
      start: 0.04,
      highlight: 0.13,
      surprise: 0.06,
      windDown: 0.045
    },
    stopShapePatches: {
      highlight: {
        preferredCategories: ["restaurant", "live_music", "museum", "event"],
        preferredTags: ["immersive", "signature", "performance", "chef-led"]
      }
    },
    reasonBuilder: (intent) => intent.refinementModes?.includes("more-exciting") ? "Interpretation asked for more excitement, so Taste centers the route on a stronger peak moment." : `Primary vibe is ${intent.primaryAnchor}, so Taste gives one standout stop more weight than the connectors.`
  },
  "activity-led": {
    id: "activity-led",
    label: "Activity-Led",
    biasSummary: "Lean into interactive or movement-oriented stops before food becomes the center of gravity.",
    favoredCategories: ["activity", "event", "park", "dessert"],
    discouragedCategories: ["museum"],
    favoredTags: ["interactive", "games", "hands-on", "playful", "social"],
    discouragedTags: ["formal", "sleepy"],
    favoredLanes: ["activity", "sweet", "outdoor"],
    discouragedLanes: ["culture"],
    enforcementStrength: "strong",
    alignmentWeight: 0.18,
    penaltyWeight: 0.08,
    movementTolerance: "medium",
    discoveryBias: "medium",
    wildcardAggressivenessFloor: 0.58,
    energyBand: ["medium", "high"],
    roleBoosts: {
      start: 0.07,
      highlight: 0.12,
      surprise: 0.11,
      windDown: 0.04
    },
    stopShapePatches: {
      start: {
        preferredCategories: ["activity", "cafe", "dessert"],
        preferredTags: ["quick-start", "interactive"]
      },
      highlight: {
        preferredCategories: ["activity", "event", "park"],
        preferredTags: ["playful", "hands-on", "social"]
      },
      surprise: {
        preferredCategories: ["activity", "event", "dessert"],
        preferredTags: ["unexpected", "community", "games"]
      }
    },
    reasonBuilder: () => "Interpretation reads as playful or interactive, so Taste favors nights built around doing something together."
  },
  "wander-explore": {
    id: "wander-explore",
    label: "Wander / Explore",
    biasSummary: "Prefer local pockets, underexposed finds, and route shapes with a little more drift.",
    favoredCategories: ["restaurant", "bar", "event", "cafe", "dessert"],
    discouragedCategories: ["museum"],
    favoredTags: ["underexposed", "local", "community", "market", "neighborhood", "wandering"],
    discouragedTags: ["predictable", "chain"],
    favoredLanes: ["dining", "drinks", "sweet", "activity"],
    discouragedLanes: [],
    enforcementStrength: "strong",
    alignmentWeight: 0.17,
    penaltyWeight: 0.07,
    movementTolerance: "high",
    discoveryBias: "high",
    wildcardAggressivenessFloor: 0.72,
    energyBand: ["medium", "high"],
    roleBoosts: {
      start: 0.06,
      highlight: 0.08,
      surprise: 0.12,
      windDown: 0.045
    },
    stopShapePatches: {
      start: {
        preferredCategories: ["cafe", "restaurant", "event"],
        preferredTags: ["local", "neighborhood", "community"]
      },
      highlight: {
        preferredCategories: ["restaurant", "bar", "event"],
        preferredTags: ["underexposed", "market", "wandering", "local"]
      },
      surprise: {
        preferredCategories: ["event", "bar", "dessert"],
        preferredTags: ["unexpected", "underexposed", "live-popups"]
      }
    },
    reasonBuilder: (intent) => intent.mode === "surprise" ? "Surprise mode is active, so Taste opens the route to more local and underexposed options." : `Primary vibe is ${intent.primaryAnchor}, so Taste pushes away from obvious defaults and toward local pockets.`
  },
  "social-night": {
    id: "social-night",
    label: "Social Night",
    biasSummary: "Prioritize buzzing group-friendly stops, then land somewhere easy to keep talking.",
    favoredCategories: ["bar", "live_music", "event", "restaurant", "activity"],
    discouragedCategories: ["park"],
    favoredTags: ["social", "buzzing", "cocktails", "group-friendly", "interactive", "live"],
    discouragedTags: ["silent", "sleepy"],
    favoredLanes: ["drinks", "activity", "dining"],
    discouragedLanes: ["outdoor"],
    enforcementStrength: "moderate",
    alignmentWeight: 0.16,
    penaltyWeight: 0.06,
    movementTolerance: "high",
    discoveryBias: "medium",
    wildcardAggressivenessFloor: 0.62,
    energyBand: ["medium", "high"],
    roleBoosts: {
      start: 0.05,
      highlight: 0.11,
      surprise: 0.08,
      windDown: 0.05
    },
    stopShapePatches: {
      start: {
        preferredCategories: ["restaurant", "bar", "activity"],
        preferredTags: ["social", "quick-start"]
      },
      highlight: {
        preferredCategories: ["bar", "live_music", "event", "activity"],
        preferredTags: ["buzzing", "live", "cocktails", "interactive"]
      },
      windDown: {
        preferredCategories: ["bar", "dessert", "cafe"],
        preferredTags: ["easygoing", "social"]
      }
    },
    reasonBuilder: (intent) => `Crew and vibe read as more social, so Taste favors nights with stronger group energy and lively anchors.`
  },
  "scenic-outdoor": {
    id: "scenic-outdoor",
    label: "Scenic / Outdoor",
    biasSummary: "Bias toward open-air movement, scenic pauses, and stops that feel better outside than inside.",
    favoredCategories: ["park", "activity", "cafe", "dessert"],
    discouragedCategories: ["bar", "museum"],
    favoredTags: ["scenic", "viewpoint", "garden", "trail", "outdoor-seating", "fresh-air"],
    discouragedTags: ["indoors-only", "late-night"],
    favoredLanes: ["outdoor", "activity", "sweet"],
    discouragedLanes: ["drinks"],
    enforcementStrength: "strong",
    alignmentWeight: 0.2,
    penaltyWeight: 0.09,
    movementTolerance: "medium",
    discoveryBias: "medium",
    wildcardAggressivenessFloor: 0.5,
    energyBand: ["low", "medium"],
    roleBoosts: {
      start: 0.11,
      highlight: 0.12,
      surprise: 0.08,
      windDown: 0.1
    },
    stopShapePatches: {
      start: {
        preferredCategories: ["park", "cafe"],
        preferredTags: ["walkable", "scenic", "garden"]
      },
      highlight: {
        preferredCategories: ["park", "activity", "dessert"],
        preferredTags: ["viewpoint", "open-air", "trail"]
      },
      windDown: {
        preferredCategories: ["dessert", "park", "cafe"],
        preferredTags: ["quiet", "outdoor-seating", "soft-landing"]
      }
    },
    reasonBuilder: () => "Interpretation points outdoors, so Taste keeps the route oriented around scenic and open-air moments."
  }
};
function hasRefinement(intent, value) {
  return intent.refinementModes?.includes(value) ?? false;
}
function getTasteModeId(intent) {
  if (intent.primaryAnchor === "adventurous-outdoor") {
    return "scenic-outdoor";
  }
  if (intent.primaryAnchor === "playful") {
    return "activity-led";
  }
  if (intent.primaryAnchor === "adventurous-urban") {
    return "wander-explore";
  }
  if (intent.mode === "surprise" || hasRefinement(intent, "more-unique")) {
    return intent.primaryAnchor === "cozy" || intent.primaryAnchor === "chill" ? "cozy-flow" : "wander-explore";
  }
  if (intent.primaryAnchor === "cozy" || intent.primaryAnchor === "chill") {
    return hasRefinement(intent, "more-exciting") ? "highlight-centered" : "cozy-flow";
  }
  if (intent.primaryAnchor === "cultured") {
    return hasRefinement(intent, "more-exciting") ? "highlight-centered" : "highlight-centered";
  }
  if (intent.primaryAnchor === "lively") {
    return intent.crew === "socialite" ? "social-night" : "highlight-centered";
  }
  if (intent.crew === "socialite") {
    return "social-night";
  }
  return "highlight-centered";
}
function selectTasteMode(intent) {
  const blueprint = tasteModes[getTasteModeId(intent)];
  return {
    ...blueprint,
    reason: blueprint.reasonBuilder(intent)
  };
}
function unique3(values) {
  return [...new Set(values)];
}
function applyTasteModeToLens(lens, tasteMode) {
  const nextLens = {
    ...lens,
    tasteMode,
    energyBand: unique3([...lens.energyBand, ...tasteMode.energyBand]),
    preferredCategories: unique3([...lens.preferredCategories, ...tasteMode.favoredCategories]),
    discouragedCategories: unique3([
      ...lens.discouragedCategories,
      ...tasteMode.discouragedCategories
    ]),
    preferredTags: unique3([...lens.preferredTags, ...tasteMode.favoredTags]),
    discouragedTags: unique3([...lens.discouragedTags, ...tasteMode.discouragedTags]),
    movementTolerance: tasteMode.movementTolerance,
    discoveryBias: tasteMode.discoveryBias,
    wildcardAggressiveness: Math.max(
      lens.wildcardAggressiveness,
      tasteMode.wildcardAggressivenessFloor
    ),
    preferredStopShapes: { ...lens.preferredStopShapes },
    windDownExpectation: {
      ...lens.windDownExpectation,
      preferredCategories: unique3([
        ...lens.windDownExpectation.preferredCategories,
        ...tasteMode.stopShapePatches.windDown?.preferredCategories ?? []
      ]),
      discouragedCategories: unique3([
        ...lens.windDownExpectation.discouragedCategories,
        ...tasteMode.stopShapePatches.windDown?.discouragedCategories ?? []
      ])
    }
  };
  const roles = Object.keys(nextLens.preferredStopShapes);
  for (const role of roles) {
    const patch = tasteMode.stopShapePatches[role];
    if (!patch) {
      continue;
    }
    nextLens.preferredStopShapes[role] = {
      preferredCategories: unique3([
        ...nextLens.preferredStopShapes[role].preferredCategories,
        ...patch.preferredCategories ?? []
      ]),
      discouragedCategories: unique3([
        ...nextLens.preferredStopShapes[role].discouragedCategories,
        ...patch.discouragedCategories ?? []
      ]),
      preferredTags: unique3([
        ...nextLens.preferredStopShapes[role].preferredTags,
        ...patch.preferredTags ?? []
      ]),
      discouragedTags: unique3([
        ...nextLens.preferredStopShapes[role].discouragedTags,
        ...patch.discouragedTags ?? []
      ]),
      energyPreference: unique3([
        ...nextLens.preferredStopShapes[role].energyPreference,
        ...patch.energyPreference ?? []
      ])
    };
  }
  return nextLens;
}
function normalizeTag2(tag) {
  return tag.trim().toLowerCase();
}
function normalizedTagSet(tags) {
  return new Set(tags.map(normalizeTag2));
}
function hasAnyTag(tags, candidates) {
  return candidates.some((candidate) => tags.has(normalizeTag2(candidate)));
}
function textIncludesAny(values, terms) {
  const corpus = values.filter((value) => Boolean(value?.trim())).join(" ").toLowerCase();
  if (!corpus) {
    return false;
  }
  return terms.some((term) => corpus.includes(term.toLowerCase()));
}
function tagOverlap(venueTags, targetTags) {
  if (targetTags.length === 0) {
    return 0;
  }
  const normalizedVenueTags = normalizedTagSet(venueTags);
  const matches = targetTags.filter((tag) => normalizedVenueTags.has(normalizeTag2(tag))).length;
  return matches / targetTags.length;
}
function getTasteExperienceLane(venue) {
  if (venue.category === "restaurant") {
    return "dining";
  }
  if (venue.category === "bar" || venue.category === "cafe") {
    return "drinks";
  }
  if (venue.category === "dessert") {
    return "sweet";
  }
  if (venue.category === "activity") {
    return "activity";
  }
  if (venue.category === "park") {
    return "outdoor";
  }
  return "culture";
}
function getTasteModeAlignment(venue, tasteMode, options = {}) {
  const lane = getTasteExperienceLane(venue);
  if (!tasteMode) {
    return {
      overall: 0,
      penalty: 0,
      lane,
      tier: "misaligned",
      supportiveTagScore: 0,
      lanePriorityScore: 0,
      byRole: {
        start: 0,
        highlight: 0,
        surprise: 0,
        windDown: 0
      }
    };
  }
  const protectedCandidate = options.protectedCandidate ?? false;
  const normalizedTags3 = normalizedTagSet(venue.tags);
  const textSignals = [venue.subcategory, venue.shortDescription, venue.narrativeFlavor];
  const categoryMatch = tasteMode.favoredCategories.includes(venue.category) ? 1 : 0;
  const categoryPenalty = tasteMode.discouragedCategories.includes(venue.category) ? 0.8 : 0;
  const lanePriorityIndex = tasteMode.favoredLanes.indexOf(lane);
  const lanePriorityScore = lanePriorityIndex === 0 ? 1 : lanePriorityIndex === 1 ? 0.82 : lanePriorityIndex === 2 ? 0.64 : lanePriorityIndex === 3 ? 0.46 : 0.12;
  const lanePenalty = tasteMode.discouragedLanes.includes(lane) ? 0.5 : 0;
  const supportiveTagScore = tagOverlap(venue.tags, tasteMode.favoredTags);
  const tagPenalty = tagOverlap(venue.tags, tasteMode.discouragedTags);
  const modeSignalStrength = getModeSignalStrength(
    venue,
    tasteMode,
    normalizedTags3,
    textSignals
  );
  const hospitalityLane = lane === "dining" || lane === "drinks" || lane === "sweet";
  const genericFallbackPenalty = protectedCandidate ? 0 : (tasteMode.id === "scenic-outdoor" || tasteMode.id === "activity-led") && hospitalityLane && modeSignalStrength.strong < 0.32 && supportiveTagScore < 0.18 && categoryMatch === 0 ? 0.92 : hospitalityLane && lanePriorityIndex > 1 && supportiveTagScore < 0.18 && categoryMatch === 0 ? 0.75 : hospitalityLane && lanePriorityIndex === -1 && supportiveTagScore < 0.12 ? 0.58 : 0;
  const overall = Math.max(
    0,
    Math.min(
      1,
      lanePriorityScore * 0.42 + categoryMatch * 0.22 + supportiveTagScore * 0.22 + modeSignalStrength.strong * 0.24 + modeSignalStrength.light * 0.14 + (venue.distinctivenessScore ?? 0) * 0.08 + (venue.underexposureScore ?? 0) * 0.06 - categoryPenalty * 0.3 - lanePenalty * 0.18 - tagPenalty * 0.22 - genericFallbackPenalty * 0.22
    )
  );
  const penalty = protectedCandidate ? 0 : Math.max(
    0,
    categoryPenalty * tasteMode.penaltyWeight * 0.34 + lanePenalty * tasteMode.penaltyWeight * 0.28 + tagPenalty * tasteMode.penaltyWeight * 0.26 + genericFallbackPenalty * tasteMode.penaltyWeight
  );
  const tier = overall >= 0.72 && lanePriorityIndex <= 1 && modeSignalStrength.strong >= 0.52 ? "primary" : overall >= 0.5 && (modeSignalStrength.light >= 0.34 || lanePriorityIndex <= 2) ? "supporting" : overall >= 0.24 ? "fallback" : "misaligned";
  return {
    overall,
    penalty,
    lane,
    tier,
    supportiveTagScore,
    lanePriorityScore,
    byRole: {
      start: overall * tasteMode.roleBoosts.start,
      highlight: overall * tasteMode.roleBoosts.highlight,
      surprise: overall * tasteMode.roleBoosts.surprise,
      windDown: overall * tasteMode.roleBoosts.windDown
    }
  };
}
function getModeSignalStrength(venue, tasteMode, normalizedTags3, textSignals) {
  if (tasteMode.id === "scenic-outdoor") {
    const strong = (venue.category === "park" ? 0.84 : 0) + (venue.settings.setting === "outdoor" ? 0.42 : 0) + (hasAnyTag(normalizedTags3, [
      "garden",
      "lookout",
      "open-air",
      "scenic",
      "trail",
      "viewpoint",
      "waterfront"
    ]) ? 0.22 : 0) + (textIncludesAny(textSignals, [
      "botanical",
      "garden",
      "lookout",
      "open air",
      "scenic",
      "sunset",
      "trail",
      "view",
      "waterfront"
    ]) ? 0.18 : 0);
    const light = strong * 0.72 + (venue.settings.setting === "hybrid" ? 0.24 : 0) + (hasAnyTag(normalizedTags3, ["courtyard", "outdoor-seating", "patio", "plaza", "walkable"]) ? 0.22 : 0);
    return {
      strong: Math.min(1, strong),
      light: Math.min(1, Math.max(strong, light))
    };
  }
  if (tasteMode.id === "activity-led") {
    const strong = (venue.category === "activity" ? 0.78 : venue.category === "event" ? 0.28 : 0) + (hasAnyTag(normalizedTags3, [
      "arcade",
      "board-games",
      "games",
      "hands-on",
      "immersive",
      "interactive",
      "karaoke",
      "mini-golf",
      "workshop"
    ]) ? 0.24 : 0) + (textIncludesAny(textSignals, [
      "arcade",
      "class",
      "games",
      "hands-on",
      "immersive",
      "interactive",
      "karaoke",
      "mini golf",
      "workshop"
    ]) ? 0.18 : 0);
    const light = strong * 0.7 + (venue.settings.eventCapable ? 0.18 : 0) + (venue.settings.performanceCapable || venue.settings.musicCapable ? 0.12 : 0) + (hasAnyTag(normalizedTags3, ["community", "live", "playful", "social"]) ? 0.18 : 0);
    return {
      strong: Math.min(1, strong),
      light: Math.min(1, Math.max(strong, light))
    };
  }
  const genericStrong = (tasteMode.favoredCategories.includes(venue.category) ? 0.38 : 0) + tagOverlap(venue.tags, tasteMode.favoredTags) * 0.42;
  const genericLight = genericStrong * 0.72 + (tasteMode.favoredLanes.includes(getTasteExperienceLane(venue)) ? 0.18 : 0);
  return {
    strong: Math.min(1, genericStrong),
    light: Math.min(1, Math.max(genericStrong, genericLight))
  };
}

// src/domain/intent/buildExperienceLens.ts
function unique4(values) {
  return [...new Set(values)];
}
function toEnergyBand(value) {
  if (value <= 2) {
    return "low";
  }
  if (value <= 3) {
    return "medium";
  }
  return "high";
}
function biasRank(value) {
  if (value === "low") {
    return 0;
  }
  if (value === "medium") {
    return 1;
  }
  return 2;
}
function chooseStrongerBias(current, next) {
  return biasRank(next) > biasRank(current) ? next : current;
}
function mergeStopShape(base, patch) {
  return {
    preferredCategories: unique4([
      ...base.preferredCategories ?? [],
      ...patch.preferredCategories ?? []
    ]),
    discouragedCategories: unique4([
      ...base.discouragedCategories ?? [],
      ...patch.discouragedCategories ?? []
    ]),
    preferredTags: unique4([...base.preferredTags ?? [], ...patch.preferredTags ?? []]),
    discouragedTags: unique4([
      ...base.discouragedTags ?? [],
      ...patch.discouragedTags ?? []
    ]),
    energyPreference: unique4([
      ...base.energyPreference ?? [],
      ...patch.energyPreference ?? []
    ])
  };
}
function buildNeutralBaseline() {
  return {
    tone: "refined",
    energyBand: ["low", "medium"],
    discoveryBias: "medium",
    movementTolerance: "medium",
    repetitionTolerance: "medium",
    wildcardAggressiveness: 0.42,
    preferredCategories: ["museum", "park", "cafe", "dessert", "activity", "restaurant", "bar"],
    discouragedCategories: [],
    preferredTags: ["hands-on", "walkable", "local", "curated"],
    discouragedTags: ["chaotic"],
    windDownExpectation: {
      preferredCategories: ["park", "dessert", "cafe", "museum"],
      discouragedCategories: ["activity", "live_music"],
      closeToBase: false,
      maxEnergy: "medium"
    },
    preferredStopShapes: {
      start: {
        preferredCategories: ["park", "cafe", "museum"],
        discouragedCategories: [],
        preferredTags: ["walkable", "easygoing", "hands-on"],
        discouragedTags: ["high-energy"],
        energyPreference: ["low", "medium"]
      },
      highlight: {
        preferredCategories: ["museum", "activity", "restaurant", "event"],
        discouragedCategories: [],
        preferredTags: ["immersive", "story", "interactive"],
        discouragedTags: ["late-night"],
        energyPreference: ["medium"]
      },
      surprise: {
        preferredCategories: ["event", "dessert", "activity", "park"],
        discouragedCategories: [],
        preferredTags: ["community", "underexposed", "local"],
        discouragedTags: ["chaotic"],
        energyPreference: ["low", "medium"]
      },
      windDown: {
        preferredCategories: ["park", "dessert", "cafe"],
        discouragedCategories: ["activity", "live_music"],
        preferredTags: ["calm", "accessible", "easygoing"],
        discouragedTags: ["high-energy", "crowded"],
        energyPreference: ["low"]
      }
    }
  };
}
function applyVibeShaping(lens, intent) {
  const anchors = [intent.primaryAnchor, ...intent.secondaryAnchors ?? []];
  const next = {
    ...lens,
    preferredCategories: [...lens.preferredCategories],
    discouragedCategories: [...lens.discouragedCategories],
    preferredTags: [...lens.preferredTags],
    discouragedTags: [...lens.discouragedTags],
    preferredStopShapes: { ...lens.preferredStopShapes },
    windDownExpectation: { ...lens.windDownExpectation }
  };
  for (const [index, anchor] of anchors.entries()) {
    const profile = getVibeProfile(anchor);
    next.preferredCategories = unique4([
      ...next.preferredCategories,
      ...profile.preferredCategories
    ]);
    next.discouragedCategories = unique4([
      ...next.discouragedCategories,
      ...profile.discouragedCategories
    ]);
    next.preferredTags = unique4([...next.preferredTags, ...profile.preferredTags]);
    next.discouragedTags = unique4([...next.discouragedTags, ...profile.discouragedTags]);
    next.energyBand = unique4([...next.energyBand, ...profile.energyBand]);
    next.discoveryBias = chooseStrongerBias(next.discoveryBias, profile.discoveryBias);
    if (index === 0) {
      next.tone = profile.toneBias;
      next.movementTolerance = profile.movementTolerance;
    } else if (biasRank(profile.movementTolerance) > biasRank(next.movementTolerance)) {
      next.movementTolerance = profile.movementTolerance;
    }
    next.preferredStopShapes.start = mergeStopShape(
      next.preferredStopShapes.start,
      getRoleShapeForVibe(anchor, "start")
    );
    next.preferredStopShapes.highlight = mergeStopShape(
      next.preferredStopShapes.highlight,
      getRoleShapeForVibe(anchor, "highlight")
    );
    next.preferredStopShapes.surprise = mergeStopShape(
      next.preferredStopShapes.surprise,
      getRoleShapeForVibe(anchor, "surprise")
    );
    next.preferredStopShapes.windDown = mergeStopShape(
      next.preferredStopShapes.windDown,
      getRoleShapeForVibe(anchor, "windDown")
    );
    next.windDownExpectation.preferredCategories = unique4([
      ...next.windDownExpectation.preferredCategories,
      ...profile.windDown.preferredCategories
    ]);
    next.windDownExpectation.discouragedCategories = unique4([
      ...next.windDownExpectation.discouragedCategories,
      ...profile.windDown.discouragedCategories
    ]);
    next.windDownExpectation.maxEnergy = profile.windDown.energyPreference.includes("low") ? "low" : chooseStrongerBias(next.windDownExpectation.maxEnergy, "medium");
    if (profile.movementTolerance === "low") {
      next.windDownExpectation.closeToBase = true;
    }
  }
  if (intent.primaryAnchor === "adventurous-outdoor") {
    next.movementTolerance = next.movementTolerance === "low" ? "medium" : next.movementTolerance;
    next.preferredCategories = unique4([...next.preferredCategories, "park", "cafe", "dessert"]);
    next.discouragedCategories = unique4([...next.discouragedCategories, "museum", "live_music"]);
    next.preferredTags = unique4([
      ...next.preferredTags,
      "trail",
      "viewpoint",
      "garden",
      "stargazing",
      "outdoor-seating"
    ]);
    next.discouragedTags = unique4([
      ...next.discouragedTags,
      "district",
      "street-food",
      "night-market"
    ]);
    next.windDownExpectation.preferredCategories = unique4([
      ...next.windDownExpectation.preferredCategories,
      "park",
      "dessert",
      "cafe"
    ]);
  }
  if (intent.primaryAnchor === "adventurous-urban") {
    next.discoveryBias = "high";
    next.movementTolerance = "high";
    next.preferredCategories = unique4([
      ...next.preferredCategories,
      "restaurant",
      "bar",
      "event",
      "dessert"
    ]);
    next.discouragedCategories = unique4([...next.discouragedCategories, "park"]);
    next.preferredTags = unique4([
      ...next.preferredTags,
      "district",
      "street-food",
      "market",
      "food-hall",
      "neighborhood"
    ]);
    next.discouragedTags = unique4([...next.discouragedTags, "nature", "trail", "viewpoint"]);
    next.windDownExpectation.closeToBase = false;
  }
  if (intent.primaryAnchor === "cozy" || intent.primaryAnchor === "chill") {
    next.movementTolerance = "low";
    next.windDownExpectation.closeToBase = true;
  }
  if (intent.primaryAnchor === "lively") {
    next.movementTolerance = "high";
    next.windDownExpectation.closeToBase = false;
  }
  return next;
}
function applyResolvedContractShaping(lens, resolvedContract) {
  const next = {
    ...lens,
    energyBand: [...lens.energyBand],
    preferredCategories: [...lens.preferredCategories],
    discouragedCategories: [...lens.discouragedCategories],
    preferredTags: [...lens.preferredTags],
    discouragedTags: [...lens.discouragedTags],
    preferredStopShapes: { ...lens.preferredStopShapes },
    windDownExpectation: { ...lens.windDownExpectation }
  };
  if (resolvedContract.toneOverride) {
    next.tone = resolvedContract.toneOverride;
  }
  if (resolvedContract.movementToleranceOverride) {
    next.movementTolerance = resolvedContract.movementToleranceOverride;
  }
  if (resolvedContract.movementToleranceCap) {
    if (biasRank(next.movementTolerance) > biasRank(resolvedContract.movementToleranceCap)) {
      next.movementTolerance = resolvedContract.movementToleranceCap;
    }
  }
  if (resolvedContract.repetitionToleranceOverride) {
    next.repetitionTolerance = resolvedContract.repetitionToleranceOverride;
  }
  if (typeof resolvedContract.wildcardAggressivenessMin === "number") {
    next.wildcardAggressiveness = Math.max(
      next.wildcardAggressiveness,
      resolvedContract.wildcardAggressivenessMin
    );
  }
  if (typeof resolvedContract.wildcardAggressivenessMax === "number") {
    next.wildcardAggressiveness = Math.min(
      next.wildcardAggressiveness,
      resolvedContract.wildcardAggressivenessMax
    );
  }
  next.preferredCategories = unique4([
    ...next.preferredCategories,
    ...resolvedContract.preferredCategories
  ]);
  next.discouragedCategories = unique4([
    ...next.discouragedCategories,
    ...resolvedContract.discouragedCategories
  ]);
  next.preferredTags = unique4([...next.preferredTags, ...resolvedContract.preferredTags]);
  next.discouragedTags = unique4([...next.discouragedTags, ...resolvedContract.discouragedTags]);
  next.energyBand = unique4(
    next.energyBand.filter((band) => !resolvedContract.energyBandRemovals.includes(band)).concat(resolvedContract.energyBandAdditions)
  );
  const roleKeys = Object.keys(resolvedContract.rolePreferences);
  for (const role of roleKeys) {
    const patch = resolvedContract.rolePreferences[role];
    if (!patch) {
      continue;
    }
    next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], patch);
  }
  if (resolvedContract.windDownExpectation.preferredCategories?.length) {
    next.windDownExpectation.preferredCategories = unique4([
      ...next.windDownExpectation.preferredCategories,
      ...resolvedContract.windDownExpectation.preferredCategories
    ]);
  }
  if (resolvedContract.windDownExpectation.discouragedCategories?.length) {
    next.windDownExpectation.discouragedCategories = unique4([
      ...next.windDownExpectation.discouragedCategories,
      ...resolvedContract.windDownExpectation.discouragedCategories
    ]);
  }
  if (typeof resolvedContract.windDownExpectation.closeToBase === "boolean") {
    next.windDownExpectation.closeToBase = resolvedContract.windDownExpectation.closeToBase;
  }
  if (resolvedContract.windDownExpectation.maxEnergy) {
    next.windDownExpectation.maxEnergy = resolvedContract.windDownExpectation.maxEnergy;
  }
  return next;
}
function applyModeShaping(lens, intent) {
  const next = { ...lens };
  const refinements = new Set(intent.refinementModes ?? []);
  if (refinements.has("more-relaxed")) {
    next.energyBand = unique4([...next.energyBand, "low"]);
    next.movementTolerance = "low";
  }
  if (refinements.has("more-exciting")) {
    next.energyBand = unique4([...next.energyBand, "high"]);
    next.wildcardAggressiveness = Math.max(next.wildcardAggressiveness, 0.7);
  }
  if (refinements.has("closer-by")) {
    next.movementTolerance = "low";
  }
  if (refinements.has("more-unique")) {
    next.discoveryBias = "high";
  }
  if (refinements.has("little-fancier")) {
    next.tone = next.tone === "electric" ? "electric" : "refined";
    next.preferredTags = unique4([...next.preferredTags, "elevated", "chef-led", "craft"]);
  }
  if (intent.mode === "surprise") {
    return {
      ...next,
      discoveryBias: "high",
      wildcardAggressiveness: Math.max(next.wildcardAggressiveness, 0.78),
      repetitionTolerance: "medium",
      preferredTags: unique4([...next.preferredTags, "underexposed", "unexpected"])
    };
  }
  if (intent.mode === "curate") {
    return {
      ...next,
      discoveryBias: next.discoveryBias === "low" ? "medium" : next.discoveryBias,
      wildcardAggressiveness: Math.max(next.wildcardAggressiveness, 0.6)
    };
  }
  return {
    ...next,
    wildcardAggressiveness: Math.min(next.wildcardAggressiveness, 0.52)
  };
}
function applyStarterPackShaping(lens, starterPack) {
  const preset = starterPack?.lensPreset;
  if (!starterPack || !preset) {
    return lens;
  }
  const next = {
    ...lens,
    preferredCategories: [...lens.preferredCategories],
    preferredTags: [...lens.preferredTags],
    discouragedTags: [...lens.discouragedTags],
    preferredStopShapes: { ...lens.preferredStopShapes },
    windDownExpectation: { ...lens.windDownExpectation }
  };
  if (preset.lensTone) {
    next.tone = preset.lensTone;
  }
  if (preset.energyBand?.length) {
    next.energyBand = unique4([...preset.energyBand]);
  }
  if (preset.discoveryBias) {
    next.discoveryBias = preset.discoveryBias;
    next.wildcardAggressiveness = preset.discoveryBias === "high" ? Math.max(next.wildcardAggressiveness, 0.78) : preset.discoveryBias === "low" ? Math.min(next.wildcardAggressiveness, 0.45) : next.wildcardAggressiveness;
  }
  if (preset.movementTolerance) {
    next.movementTolerance = preset.movementTolerance;
  }
  if (preset.preferredCategories?.length) {
    next.preferredCategories = unique4([
      ...next.preferredCategories,
      ...preset.preferredCategories
    ]);
  }
  if (preset.discouragedCategories?.length) {
    next.discouragedCategories = unique4([
      ...next.discouragedCategories,
      ...preset.discouragedCategories
    ]);
  }
  if (preset.preferredTags?.length) {
    next.preferredTags = unique4([...next.preferredTags, ...preset.preferredTags]);
  }
  if (preset.discouragedTags?.length) {
    next.discouragedTags = unique4([...next.discouragedTags, ...preset.discouragedTags]);
  }
  if (preset.preferredStopShapes) {
    const roles = Object.keys(
      preset.preferredStopShapes
    );
    for (const role of roles) {
      const patch = preset.preferredStopShapes[role];
      if (!patch) {
        continue;
      }
      next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], patch);
    }
  }
  if (preset.preferredCategories?.length) {
    const roleKeys = Object.keys(next.preferredStopShapes);
    for (const role of roleKeys) {
      next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], {
        preferredCategories: preset.preferredCategories
      });
    }
  }
  if (preset.preferredTags?.length) {
    const roleKeys = Object.keys(next.preferredStopShapes);
    for (const role of roleKeys) {
      next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], {
        preferredTags: preset.preferredTags
      });
    }
  }
  if (preset.windDown) {
    if (preset.windDown.preferredCategories?.length) {
      next.windDownExpectation.preferredCategories = unique4([
        ...next.windDownExpectation.preferredCategories,
        ...preset.windDown.preferredCategories
      ]);
    }
    if (preset.windDown.discouragedCategories?.length) {
      next.windDownExpectation.discouragedCategories = unique4([
        ...next.windDownExpectation.discouragedCategories,
        ...preset.windDown.discouragedCategories
      ]);
    }
    if (typeof preset.windDown.closeToBase === "boolean") {
      next.windDownExpectation.closeToBase = preset.windDown.closeToBase;
    }
    if (preset.windDown.maxEnergy) {
      next.windDownExpectation.maxEnergy = preset.windDown.maxEnergy;
    }
  }
  return next;
}
function buildPersonaEffectSummary(intent) {
  if (!intent.persona || intent.personaSource !== "explicit") {
    return "No persona modifier applied.";
  }
  if (intent.persona === "romantic") {
    return "Refined toward intimate pacing and calmer wind-down choices.";
  }
  if (intent.persona === "friends") {
    return "Refined toward social energy and more interactive highlight options.";
  }
  return "Refined toward comfortable pacing and broader all-ages accessibility.";
}
function applyStrictDebugShaping(lens, intent, starterPack) {
  const next = {
    ...lens,
    energyBand: [...lens.energyBand],
    preferredCategories: [...lens.preferredCategories],
    discouragedCategories: [...lens.discouragedCategories],
    preferredTags: [...lens.preferredTags],
    discouragedTags: [...lens.discouragedTags],
    preferredStopShapes: { ...lens.preferredStopShapes },
    windDownExpectation: { ...lens.windDownExpectation }
  };
  if (intent.personaSource === "explicit" && intent.crew === "curator") {
    next.energyBand = unique4(next.energyBand.filter((band) => band !== "high"));
    next.movementTolerance = "low";
    next.discouragedCategories = unique4([
      ...next.discouragedCategories,
      "bar",
      "live_music",
      "event"
    ]);
    next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
      preferredCategories: ["museum", "park", "activity"],
      discouragedCategories: ["bar", "live_music", "event"]
    });
  }
  if (intent.personaSource === "explicit" && intent.crew === "romantic") {
    next.tone = "intimate";
    next.movementTolerance = "low";
    next.energyBand = unique4(next.energyBand.filter((band) => band !== "high"));
    next.preferredStopShapes.start = mergeStopShape(next.preferredStopShapes.start, {
      preferredCategories: ["cafe", "park", "restaurant"],
      preferredTags: ["cozy", "intimate"]
    });
    next.preferredStopShapes.windDown = mergeStopShape(next.preferredStopShapes.windDown, {
      preferredCategories: ["dessert", "cafe", "park"],
      discouragedCategories: ["activity", "event"],
      energyPreference: ["low"]
    });
    next.windDownExpectation.closeToBase = true;
    next.windDownExpectation.maxEnergy = "low";
  }
  if (starterPack?.id === "cozy-jazz-night") {
    next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
      preferredCategories: ["live_music", "bar"],
      preferredTags: ["listening", "live", "intimate"]
    });
    next.preferredStopShapes.windDown = mergeStopShape(next.preferredStopShapes.windDown, {
      preferredCategories: ["dessert", "cafe"],
      energyPreference: ["low"]
    });
  }
  if (starterPack?.id === "museum-afternoon") {
    next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
      preferredCategories: ["museum"],
      preferredTags: ["curated", "hands-on", "interactive"],
      discouragedCategories: ["bar", "live_music"]
    });
  }
  if (starterPack?.id === "cozy-date-night" || starterPack?.id === "wine-slow-evening") {
    next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
      preferredCategories: ["restaurant", "dessert", "bar"],
      discouragedCategories: ["live_music", "event"],
      preferredTags: ["cozy", "intimate", "conversation", "craft"],
      discouragedTags: ["festival", "chaotic"]
    });
  }
  return {
    ...next,
    preferredCategories: unique4(next.preferredCategories),
    discouragedCategories: unique4(next.discouragedCategories),
    preferredTags: unique4(next.preferredTags),
    discouragedTags: unique4(next.discouragedTags),
    energyBand: unique4(next.energyBand.length > 0 ? next.energyBand : ["low", "medium"])
  };
}
function buildExperienceLens({
  intent,
  starterPack,
  strictShape = false
}) {
  const resolvedContractPackage = resolveHospitalityContract(intent);
  const base = buildNeutralBaseline();
  const afterVibe = applyVibeShaping(base, intent);
  const afterPersona = applyResolvedContractShaping(
    afterVibe,
    resolvedContractPackage.resolvedContract
  );
  const afterMode = applyModeShaping(afterPersona, intent);
  const tasteMode = selectTasteMode(intent);
  const afterTasteMode = applyTasteModeToLens(afterMode, tasteMode);
  const afterPack = applyStarterPackShaping(afterTasteMode, starterPack);
  const strictShaped = strictShape ? applyStrictDebugShaping(afterPack, intent, starterPack) : afterPack;
  return {
    ...strictShaped,
    tasteMode,
    personaContract: resolvedContractPackage.personaContract,
    resolvedContract: resolvedContractPackage.resolvedContract,
    interpretation: {
      primaryVibe: intent.primaryAnchor,
      personaModifier: intent.persona ?? void 0,
      personaSource: intent.personaSource ?? "derived",
      personaEffectSummary: resolvedContractPackage.resolvedContract.persona ? resolvedContractPackage.resolvedContract.resolutionSummary : buildPersonaEffectSummary(intent)
    },
    preferredCategories: unique4(strictShaped.preferredCategories),
    discouragedCategories: unique4(strictShaped.discouragedCategories),
    preferredTags: unique4(strictShaped.preferredTags),
    discouragedTags: unique4(strictShaped.discouragedTags),
    energyBand: unique4(
      strictShaped.energyBand.length > 0 ? strictShaped.energyBand : [toEnergyBand(2.5)]
    )
  };
}

// src/domain/intent/normalizeIntent.ts
function mapPersonaToCrew(persona, primaryVibe) {
  if (persona === "romantic") {
    return "romantic";
  }
  if (persona === "friends") {
    return "socialite";
  }
  if (persona === "family") {
    return "curator";
  }
  if (primaryVibe === "cozy" || primaryVibe === "chill") {
    return "romantic";
  }
  if (primaryVibe === "cultured" || primaryVibe === "adventurous-outdoor") {
    return "curator";
  }
  return "socialite";
}
function normalizeIntent(input) {
  if (!input.primaryVibe) {
    throw new Error("Primary vibe is required before generating a plan.");
  }
  const crew = mapPersonaToCrew(input.persona, input.primaryVibe);
  const refinementModes = Array.from(new Set(input.refinementModes ?? []));
  const secondaryAnchors = input.secondaryVibe ? [input.secondaryVibe] : void 0;
  const normalizedAnchor = input.anchor?.venueId ? {
    venueId: input.anchor.venueId,
    role: input.anchor.role ?? "highlight"
  } : void 0;
  const discoveryPreferenceSource = [
    ...input.discoveryPreferences ?? [],
    ...normalizedAnchor ? [{ venueId: normalizedAnchor.venueId, role: normalizedAnchor.role }] : []
  ];
  const discoveryPreferences = discoveryPreferenceSource.length > 0 ? Array.from(
    new Map(
      discoveryPreferenceSource.map((preference) => [
        preference.venueId,
        preference
      ])
    ).values()
  ) : void 0;
  const autoHiddenGemPreference = refinementModes.includes("more-unique") || input.primaryVibe === "adventurous-urban" || input.mode === "surprise";
  const planningMode = normalizedAnchor?.venueId ? "user-led" : input.planningMode ?? "engine-led";
  return {
    crew,
    persona: input.persona,
    personaSource: input.persona ? "explicit" : "derived",
    primaryAnchor: input.primaryVibe,
    secondaryAnchors,
    city: input.city.trim() || "San Jose",
    district: input.district?.trim() || void 0,
    neighborhood: input.neighborhood?.trim() || void 0,
    distanceMode: input.distanceMode,
    budget: input.budget,
    timeWindow: input.timeWindow ?? input.startTime,
    prefersHiddenGems: input.prefersHiddenGems ?? autoHiddenGemPreference,
    refinementModes,
    mode: input.mode ?? "build",
    planningMode,
    anchor: normalizedAnchor,
    discoveryPreferences,
    selectedDirectionContext: input.selectedDirectionContext
  };
}

// src/domain/retrieval/scoreLensCompatibility.ts
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeTag3(tag) {
  return tag.trim().toLowerCase();
}
function mapEnergyLevelToBand(level) {
  if (level <= 2) {
    return "low";
  }
  if (level <= 3) {
    return "medium";
  }
  return "high";
}
function hasTagOverlap(venueTags, targetTags) {
  if (targetTags.length === 0) {
    return 0;
  }
  const normalizedVenueTags = venueTags.map(normalizeTag3);
  const matches = targetTags.filter((tag) => normalizedVenueTags.includes(normalizeTag3(tag)));
  return matches.length / targetTags.length;
}
function scoreLensCompatibility(venue, intent, lens) {
  const categoryPreferred = lens.preferredCategories.includes(venue.category) ? 1 : 0.42;
  const categoryPenalty = lens.discouragedCategories.includes(venue.category) ? 0.24 : 0;
  const preferredTags = hasTagOverlap(venue.tags, lens.preferredTags);
  const discouragedTags = hasTagOverlap(venue.tags, lens.discouragedTags);
  const energyBand = mapEnergyLevelToBand(venue.energyLevel);
  const energyFit = lens.energyBand.includes(energyBand) ? 1 : 0.45;
  const movementPressure = lens.movementTolerance === "low" ? Math.max(0, (venue.driveMinutes - 12) / 20) : 0;
  const discoveryPreference = lens.discoveryBias === "high" ? venue.underexposureScore * 0.12 + venue.distinctivenessScore * 0.08 : lens.discoveryBias === "low" ? -venue.underexposureScore * 0.06 : 0;
  const neighborhoodBias = intent.neighborhood && intent.neighborhood.toLowerCase() === venue.neighborhood.toLowerCase() ? 0.08 : 0;
  return clamp01(
    categoryPreferred * 0.4 + preferredTags * 0.18 + energyFit * 0.22 + neighborhoodBias + discoveryPreference - discouragedTags * 0.14 - categoryPenalty - movementPressure
  );
}
function scoreLensStopShapeCompatibility(venue, lens, role) {
  const shape = lens.preferredStopShapes[role];
  const categoryFit = shape.preferredCategories.includes(venue.category) ? 1 : 0.4;
  const categoryPenalty = shape.discouragedCategories.includes(venue.category) ? 0.28 : 0;
  const tagFit = hasTagOverlap(venue.tags, shape.preferredTags);
  const discouragedTagFit = hasTagOverlap(venue.tags, shape.discouragedTags);
  const energyBand = mapEnergyLevelToBand(venue.energyLevel);
  const energyFit = shape.energyPreference.includes(energyBand) ? 1 : 0.4;
  return clamp01(
    categoryFit * 0.46 + tagFit * 0.2 + energyFit * 0.34 - categoryPenalty - discouragedTagFit * 0.2
  );
}

// src/domain/retrieval/applyLensToVenue.ts
function applyLensToVenue(venue, intent, lens) {
  return {
    venue,
    lensCompatibility: scoreLensCompatibility(venue, intent, lens)
  };
}

// src/domain/retrieval/computeLiveQualityFairness.ts
var emptyProfile = {
  supportRecoveryEligible: false,
  qualityBonus: 0,
  fitBonus: 0,
  genericRelief: 0,
  hoursGrace: 0,
  notes: []
};
function clamp012(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function countMatches(values, candidates) {
  return candidates.filter((candidate) => values.has(normalizeValue(candidate))).length;
}
function computeLiveQualityFairness(venue) {
  if (venue.source.sourceOrigin !== "live") {
    return emptyProfile;
  }
  const normalizedSignals = /* @__PURE__ */ new Set([
    ...venue.tags.map(normalizeValue),
    ...venue.source.sourceTypes.map(normalizeValue),
    ...venue.source.sourceQueryLabel ? venue.source.sourceQueryLabel.split(/[^a-z0-9]+/i).map(normalizeValue).filter(Boolean) : []
  ]);
  const notes = [];
  const distinctiveSignals = countMatches(normalizedSignals, [
    "cocktails",
    "wine",
    "coffee",
    "espresso-bar",
    "tea-house",
    "brunch",
    "chef-led",
    "seasonal",
    "local",
    "artisan",
    "craft",
    "cozy",
    "intimate",
    "rooftop",
    "outdoor-seating",
    "quiet",
    "museum",
    "gallery",
    "historic",
    "park",
    "trail",
    "event",
    "discovery",
    "cultural"
  ]);
  const supportedCategory = venue.category === "restaurant" || venue.category === "bar" || venue.category === "cafe" || venue.category === "dessert" || venue.category === "museum" || venue.category === "activity" || venue.category === "park" || venue.category === "event";
  const supportFriendly = venue.category === "cafe" || venue.category === "restaurant" || venue.category === "dessert" || venue.category === "museum" || venue.category === "activity" || venue.category === "park" || venue.category === "event" || venue.category === "bar" && venue.settings.dateFriendly || venue.settings.supportOnly;
  const strongRecord = venue.source.sourceConfidence >= 0.56 && venue.source.completenessScore >= 0.56;
  const signatureFairness = clamp012(
    venue.signature.signatureScore * 0.34 + (1 - venue.signature.genericScore) * 0.24 + venue.source.sourceConfidence * 0.18 + venue.source.completenessScore * 0.14 + Math.min(distinctiveSignals, 4) * 0.04
  );
  const supportRecoveryEligible = supportedCategory && supportFriendly && strongRecord && !venue.signature.chainLike && !venue.source.hoursSuppressionApplied && (signatureFairness >= 0.56 || distinctiveSignals >= 2);
  if (supportRecoveryEligible) {
    notes.push("live support candidate has enough metadata to compete fairly");
  }
  if (distinctiveSignals >= 2) {
    notes.push("distinctive live metadata reduced genericity");
  }
  return {
    supportRecoveryEligible,
    qualityBonus: supportRecoveryEligible ? Number(Math.min(0.05, 0.012 + signatureFairness * 0.032).toFixed(3)) : 0,
    fitBonus: supportRecoveryEligible ? Number(Math.min(0.024, 6e-3 + signatureFairness * 0.016).toFixed(3)) : 0,
    genericRelief: supportRecoveryEligible ? Number(Math.min(0.1, 0.02 + Math.min(distinctiveSignals, 4) * 0.015).toFixed(3)) : 0,
    hoursGrace: supportRecoveryEligible && !venue.source.hoursKnown ? 0.018 : supportRecoveryEligible ? 8e-3 : 0,
    notes
  };
}

// src/domain/normalize/applyQualityGate.ts
function clamp013(value) {
  return Math.max(0, Math.min(1, value));
}
function meaningfulTagCount(venue) {
  return venue.tags.filter((tag) => tag.trim().length >= 4).length;
}
function hasAnySignal(venue, candidates) {
  const normalized = new Set(
    [...venue.tags, ...venue.source.sourceTypes].map((value) => value.trim().toLowerCase())
  );
  return candidates.some((candidate) => normalized.has(candidate.toLowerCase()));
}
function applyQualityGate(venue) {
  const notes = [];
  const approvalBlockers = [];
  const demotionReasons = [];
  const suppressionReasons = [];
  let status = "approved";
  let hoursDemotionApplied = false;
  let hoursSuppressionApplied = false;
  const tagCount = meaningfulTagCount(venue);
  const isLiveSource = venue.source.sourceOrigin === "live";
  const supportedLiveCategories = /* @__PURE__ */ new Set([
    "restaurant",
    "bar",
    "cafe",
    "dessert",
    "museum",
    "activity",
    "park",
    "event"
  ]);
  const nonCoreLiveCategory = venue.category !== "restaurant" && venue.category !== "bar" && venue.category !== "cafe";
  const unsupportedLiveCategory = isLiveSource && !supportedLiveCategories.has(venue.category);
  const fastFoodLike = hasAnySignal(venue, [
    "fast-food",
    "fast-food-restaurant",
    "meal-takeaway",
    "meal-delivery",
    "drive-through"
  ]);
  const convenienceLike = hasAnySignal(venue, [
    "convenience-store",
    "gas-station",
    "grocery-store",
    "supermarket"
  ]);
  const likelyClosedNow = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.7;
  const stronglyClosedNow = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.86;
  const highConfidenceOpenNow = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.68;
  const liveFairness = computeLiveQualityFairness(venue);
  const supportApprovalCandidate = liveFairness.supportRecoveryEligible && venue.settings.highlightCapabilityTier !== "connective-only";
  const completenessPenalty = venue.source.missingFields.length * 0.07;
  const effectiveGenericScore = clamp013(venue.signature.genericScore - liveFairness.genericRelief);
  const effectiveSourceConfidence = clamp013(
    venue.source.sourceConfidence + (supportApprovalCandidate ? 0.03 : 0)
  );
  const genericPenalty = effectiveGenericScore * 0.32;
  const chainPenalty = venue.signature.chainLike ? 0.16 : 0;
  const hoursPenalty = isLiveSource && likelyClosedNow ? stronglyClosedNow ? Math.max(0.1, 0.18 - liveFairness.hoursGrace) : Math.max(0.03, 0.08 - liveFairness.hoursGrace) : isLiveSource && !venue.source.hoursKnown ? Math.max(4e-3, 0.025 - liveFairness.hoursGrace) : 0;
  const hoursBonus = isLiveSource && highConfidenceOpenNow ? 0.06 : 0;
  const completenessScore = clamp013(1 - completenessPenalty);
  const qualityScore = clamp013(
    effectiveSourceConfidence * 0.36 + completenessScore * 0.24 + venue.signature.signatureScore * 0.2 + (1 - effectiveGenericScore) * 0.12 + venue.settings.highlightConfidence * 0.08 + liveFairness.qualityBonus + hoursBonus - hoursPenalty - chainPenalty - genericPenalty
  );
  if (venue.signature.chainLike) {
    notes.push("chain-like profile");
  }
  if (effectiveGenericScore >= 0.64) {
    notes.push("generic venue signature");
  }
  if (tagCount < 2) {
    notes.push("thin descriptive tagging");
  }
  if (venue.source.missingFields.length > 2) {
    notes.push("source record is missing several engine fields");
  }
  if (venue.settings.supportOnly) {
    notes.push("support-shaped venue");
  }
  if (isLiveSource && nonCoreLiveCategory) {
    notes.push("extended live category candidate");
  }
  if (fastFoodLike) {
    notes.push("fast-food / takeaway signal");
  }
  if (convenienceLike) {
    notes.push("convenience signal");
  }
  if (isLiveSource && venue.source.hoursKnown) {
    notes.push(
      venue.source.likelyOpenForCurrentWindow ? "hours signal supports current planning window" : "hours signal conflicts with current planning window"
    );
  }
  if (isLiveSource && !venue.source.hoursKnown) {
    notes.push("hours are unknown for the current planning window");
  }
  for (const note of liveFairness.notes) {
    notes.push(note);
  }
  if (supportApprovalCandidate) {
    notes.push("live support candidate has a viable path to approval");
  }
  if (effectiveSourceConfidence < 0.36 && venue.source.missingFields.length >= 3 && venue.settings.highlightCapabilityTier !== "highlight-capable") {
    suppressionReasons.push("low-confidence record with weak completeness");
  }
  if (venue.signature.chainLike && effectiveGenericScore >= 0.78 && venue.settings.highlightCapabilityTier !== "highlight-capable") {
    suppressionReasons.push("generic chain-like venue is too low-signal for current inventory");
  }
  if (tagCount < 2 && venue.shortDescription.trim().length < 28 && venue.settings.highlightCapabilityTier === "connective-only") {
    suppressionReasons.push("too little descriptive signal to normalize reliably");
  }
  if (unsupportedLiveCategory) {
    suppressionReasons.push("unsupported category for live place ingestion");
  }
  if (isLiveSource && nonCoreLiveCategory && venue.source.sourceConfidence < 0.53 && venue.source.completenessScore < 0.55 && venue.settings.highlightCapabilityTier === "connective-only") {
    suppressionReasons.push("extended live category lacked minimum confidence and completeness");
  }
  if (isLiveSource && (venue.source.businessStatus === "temporarily-closed" || venue.source.businessStatus === "closed-permanently")) {
    suppressionReasons.push(`live venue is ${venue.source.businessStatus}`);
    hoursSuppressionApplied = true;
  }
  if (isLiveSource && stronglyClosedNow && venue.settings.highlightCapabilityTier === "highlight-capable") {
    suppressionReasons.push("live highlight-capable venue appears closed for the current planning window");
    hoursSuppressionApplied = true;
  }
  if (isLiveSource && (fastFoodLike || convenienceLike)) {
    suppressionReasons.push("unsupported low-signal place type for live restaurant/bar/cafe ingestion");
  }
  if (isLiveSource && effectiveGenericScore >= 0.8 && effectiveSourceConfidence < 0.56 && venue.settings.highlightCapabilityTier !== "highlight-capable" && !liveFairness.supportRecoveryEligible) {
    suppressionReasons.push("live venue is too generic for the current engine slice");
  }
  if (suppressionReasons.length > 0) {
    status = "suppressed";
    approvalBlockers.push(...suppressionReasons);
  } else {
    if (qualityScore < (supportApprovalCandidate ? 0.54 : 0.62)) {
      demotionReasons.push("quality score stayed below the approval floor");
    }
    if (effectiveGenericScore >= (supportApprovalCandidate ? 0.68 : 0.6)) {
      demotionReasons.push("generic signature kept the venue below approval");
    }
    if (effectiveSourceConfidence < (supportApprovalCandidate ? 0.5 : 0.55)) {
      demotionReasons.push("source confidence stayed below the approval floor");
    }
    if (isLiveSource && likelyClosedNow && venue.settings.highlightCapabilityTier !== "connective-only") {
      demotionReasons.push("hours signal stayed too soft for confident approval");
    }
    if (isLiveSource && !venue.source.hoursKnown && effectiveGenericScore >= (supportApprovalCandidate ? 0.72 : 0.64) && venue.settings.highlightCapabilityTier !== "highlight-capable" && !liveFairness.supportRecoveryEligible) {
      demotionReasons.push("unknown hours kept a generic live venue below approval");
    }
    if (isLiveSource && effectiveGenericScore >= (supportApprovalCandidate ? 0.72 : 0.68) && effectiveSourceConfidence < (supportApprovalCandidate ? 0.62 : 0.7) && !liveFairness.supportRecoveryEligible) {
      demotionReasons.push("generic live metadata still outweighed trust signals");
    }
    if (venue.settings.supportOnly && effectiveGenericScore >= (supportApprovalCandidate ? 0.62 : 0.52) && venue.settings.highlightConfidence < (supportApprovalCandidate ? 0.54 : 0.6)) {
      demotionReasons.push("support-shaped venue still lacked enough signature to approve outright");
    }
  }
  if (demotionReasons.length > 0) {
    status = "demoted";
    approvalBlockers.push(...demotionReasons);
    hoursDemotionApplied = hoursDemotionApplied || isLiveSource && (likelyClosedNow && venue.settings.highlightCapabilityTier !== "connective-only" || !venue.source.hoursKnown && effectiveGenericScore >= 0.58 && venue.settings.highlightCapabilityTier !== "highlight-capable");
  }
  return {
    status,
    qualityScore: Number(qualityScore.toFixed(2)),
    notes: [...new Set(notes)],
    approvalBlockers: [...new Set(approvalBlockers)],
    demotionReasons: [...new Set(demotionReasons)],
    suppressionReasons,
    hoursDemotionApplied,
    hoursSuppressionApplied
  };
}

// src/domain/normalize/deriveVenueHappeningsSignals.ts
function clamp014(value) {
  return Math.max(0, Math.min(1, value));
}
function toFixed01(value) {
  return Number(clamp014(value).toFixed(3));
}
function normalizeToken(value) {
  return value.trim().toLowerCase();
}
function collectNormalizedTokens(venue) {
  const summary = `${venue.shortDescription} ${venue.narrativeFlavor} ${venue.subcategory}`.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
  return new Set(
    [...venue.tags, ...venue.vibeTags, ...venue.source.sourceTypes, ...summary.split(/\s+/)].map(normalizeToken).filter(Boolean)
  );
}
function hasAnyToken(tokens, candidates) {
  return candidates.some((candidate) => tokens.has(candidate));
}
function getCategoryBase(venue, values, fallback) {
  return values[venue.category] ?? fallback;
}
function deriveVenueHappeningsSignals(venue) {
  const tokens = collectNormalizedTokens(venue);
  const eventLikeSignal = (venue.settings.eventCapable ? 0.14 : 0) + (venue.settings.performanceCapable ? 0.12 : 0) + (venue.settings.musicCapable ? 0.1 : 0);
  const currentOpenSignal = venue.source.openNow ? 0.12 : venue.source.likelyOpenForCurrentWindow ? 0.08 : 0;
  const highQualitySignal = venue.signature.signatureScore * 0.08 + venue.source.qualityScore * 0.06 + venue.source.sourceConfidence * 0.05;
  const hotspotStrength = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.68,
        live_music: 0.72,
        event: 0.66,
        restaurant: 0.56,
        activity: 0.54,
        museum: 0.46,
        cafe: 0.42,
        park: 0.34,
        dessert: 0.36
      },
      0.45
    ) + venue.energyLevel / 5 * 0.14 + venue.socialDensity / 5 * 0.1 + venue.shareabilityScore * 0.08 + (hasAnyToken(tokens, ["nightlife", "social", "crowded", "district", "market"]) ? 0.08 : 0) + highQualitySignal
  );
  const eventPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        event: 0.82,
        live_music: 0.72,
        activity: 0.5,
        museum: 0.42,
        bar: 0.38
      },
      0.28
    ) + eventLikeSignal + (hasAnyToken(tokens, [
      "event",
      "festival",
      "market",
      "community",
      "popup",
      "program",
      "lineup",
      "showcase"
    ]) ? 0.1 : 0) + currentOpenSignal * 0.45
  );
  const performancePotential = toFixed01(
    getCategoryBase(
      venue,
      {
        live_music: 0.84,
        event: 0.64,
        museum: 0.46,
        activity: 0.44,
        bar: 0.34
      },
      0.22
    ) + (venue.settings.performanceCapable ? 0.14 : 0) + (venue.settings.musicCapable ? 0.14 : 0) + (hasAnyToken(tokens, [
      "live",
      "music",
      "jazz",
      "concert",
      "performance",
      "theatre",
      "theater",
      "opera",
      "stage"
    ]) ? 0.12 : 0)
  );
  const liveNightlifePotential = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.84,
        live_music: 0.78,
        event: 0.58,
        restaurant: 0.36,
        activity: 0.34
      },
      0.2
    ) + venue.energyLevel / 5 * 0.12 + venue.socialDensity / 5 * 0.08 + (hasAnyToken(tokens, [
      "late",
      "night",
      "nightcap",
      "cocktail",
      "speakeasy",
      "lounge",
      "after",
      "midnight"
    ]) ? 0.14 : 0) + currentOpenSignal
  );
  const culturalAnchorPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        museum: 0.82,
        event: 0.58,
        activity: 0.56,
        live_music: 0.5,
        park: 0.42,
        restaurant: 0.38,
        bar: 0.32
      },
      0.28
    ) + venue.distinctivenessScore * 0.14 + venue.uniquenessScore * 0.08 + (hasAnyToken(tokens, [
      "museum",
      "gallery",
      "cultural",
      "historic",
      "theatre",
      "theater",
      "opera",
      "heritage"
    ]) ? 0.16 : 0)
  );
  const lateNightPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.74,
        live_music: 0.66,
        event: 0.58,
        restaurant: 0.38,
        dessert: 0.32
      },
      0.24
    ) + (hasAnyToken(tokens, [
      "late",
      "night",
      "nightcap",
      "after",
      "midnight",
      "open"
    ]) ? 0.16 : 0) + (venue.source.hoursPressureLevel === "strong-open" ? 0.1 : 0) + (venue.source.hoursPressureLevel === "likely-open" ? 0.05 : 0) + venue.source.timeConfidence * 0.06
  );
  const currentRelevance = toFixed01(
    0.22 + (venue.source.openNow ? 0.28 : 0) + (venue.source.likelyOpenForCurrentWindow ? 0.16 : 0) + venue.source.timeConfidence * 0.18 + eventPotential * 0.08 + performancePotential * 0.08 + (venue.source.businessStatus === "operational" ? 0.08 : 0)
  );
  const hiddenGemStrength = toFixed01(
    (venue.isHiddenGem ? 0.48 : 0.16) + venue.underexposureScore * 0.22 + venue.distinctivenessScore * 0.14 + venue.localSignals.localFavoriteScore * 0.1
  );
  const majorVenueStrength = toFixed01(
    getCategoryBase(
      venue,
      {
        museum: 0.46,
        event: 0.44,
        live_music: 0.4
      },
      0.22
    ) + venue.signature.signatureScore * 0.16 + venue.distinctivenessScore * 0.1 + (hasAnyToken(tokens, [
      "arena",
      "stadium",
      "theatre",
      "theater",
      "opera",
      "museum",
      "center",
      "centre",
      "hall",
      "district"
    ]) ? 0.16 : 0)
  );
  return {
    hotspotStrength,
    eventPotential,
    performancePotential,
    liveNightlifePotential,
    culturalAnchorPotential,
    lateNightPotential,
    currentRelevance,
    hiddenGemStrength,
    majorVenueStrength
  };
}

// src/domain/normalize/getNormalizedCategory.ts
function normalizeValue2(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function firstMatch(values, candidates) {
  return values.find((value) => candidates.includes(value));
}
function firstSuffixMatch(values, suffix) {
  return values.find((value) => value.endsWith(suffix));
}
function getNormalizedCategory(raw) {
  if (raw.categoryHint) {
    return {
      category: raw.categoryHint,
      subcategory: raw.subcategoryHint ?? raw.categoryHint
    };
  }
  const rawTypes = [
    ...raw.rawType === "place" ? raw.placeTypes ?? [] : raw.eventTypes ?? [],
    ...raw.sourceTypes ?? [],
    ...raw.tags ?? []
  ].map(normalizeValue2);
  const dessertType = firstMatch(rawTypes, ["dessert", "bakery", "ice-cream", "gelato", "pastry"]);
  if (dessertType) {
    return { category: "dessert", subcategory: dessertType };
  }
  const cafeType = firstMatch(rawTypes, [
    "cafe",
    "coffee",
    "coffee-shop",
    "tea-room",
    "tea-house",
    "espresso-bar"
  ]);
  if (cafeType) {
    return { category: "cafe", subcategory: cafeType };
  }
  const barType = firstMatch(rawTypes, [
    "bar",
    "cocktail-bar",
    "wine-bar",
    "lounge",
    "brewery",
    "winery",
    "pub",
    "beer-hall",
    "sports-bar"
  ]);
  if (barType) {
    return { category: "bar", subcategory: barType };
  }
  const musicType = firstMatch(rawTypes, ["live_music", "music-venue", "concert", "performance", "small-stage"]);
  if (musicType) {
    return { category: "live_music", subcategory: musicType };
  }
  const museumType = firstMatch(rawTypes, ["museum", "gallery", "exhibit"]);
  if (museumType) {
    return { category: "museum", subcategory: museumType };
  }
  const parkType = firstMatch(rawTypes, ["park", "garden", "trail", "viewpoint", "greenhouse"]);
  if (parkType) {
    return { category: "park", subcategory: parkType };
  }
  const activityType = firstMatch(rawTypes, [
    "activity",
    "arcade",
    "games",
    "board-games",
    "karaoke",
    "mini-golf",
    "studio",
    "guided",
    "photo-walk"
  ]);
  if (activityType) {
    return { category: "activity", subcategory: activityType };
  }
  const eventType = firstMatch(rawTypes, [
    "event",
    "market",
    "festival",
    "fair",
    "pop-up",
    "gallery-crawl",
    "observatory",
    "stargazing"
  ]);
  if (eventType || raw.rawType === "event") {
    return { category: "event", subcategory: eventType ?? "event" };
  }
  const restaurantType = firstMatch(rawTypes, ["restaurant", "food", "tapas", "bistro", "food-hall"]) ?? firstSuffixMatch(rawTypes, "-restaurant");
  return {
    category: "restaurant",
    subcategory: restaurantType ?? "restaurant"
  };
}

// src/domain/normalize/inferHoursPressure.ts
function clamp015(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue3(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function hasAny(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}
function toWeeklyMinute(day, hour, minute) {
  return day * 24 * 60 + hour * 60 + minute;
}
function mapBusinessStatus(value) {
  const normalized = value ? normalizeValue3(value) : "unknown";
  if (normalized === "operational") {
    return "operational";
  }
  if (normalized === "closed-temporarily" || normalized === "temporarily-closed") {
    return "temporarily-closed";
  }
  if (normalized === "closed-permanently") {
    return "closed-permanently";
  }
  return "unknown";
}
function isOpenDuringWindow(periods, signal) {
  if (!periods || periods.length === 0) {
    return void 0;
  }
  const targetMinute = toWeeklyMinute(signal.day, signal.hour, signal.minute);
  for (const period of periods) {
    if (!period.open || !period.close) {
      continue;
    }
    let openMinute = toWeeklyMinute(period.open.day, period.open.hour, period.open.minute);
    let closeMinute = toWeeklyMinute(period.close.day, period.close.hour, period.close.minute);
    if (closeMinute <= openMinute) {
      closeMinute += 7 * 24 * 60;
    }
    const adjustedTarget = targetMinute < openMinute ? targetMinute + 7 * 24 * 60 : targetMinute;
    if (adjustedTarget >= openMinute && adjustedTarget < closeMinute) {
      return true;
    }
  }
  return false;
}
function inferLikelyOpenFromCategory(raw, category, signal) {
  const notes = [];
  const placeSignals = [
    ...raw.placeTypes ?? [],
    ...raw.sourceTypes ?? [],
    ...raw.tags ?? []
  ].map(normalizeValue3);
  if (category === "cafe") {
    if (signal.phase === "morning") {
      return { likelyOpen: true, confidence: 0.58, notes: ["cafe-hour heuristic favors mornings"] };
    }
    if (signal.phase === "afternoon") {
      return { likelyOpen: true, confidence: 0.54, notes: ["cafe-hour heuristic still supports afternoons"] };
    }
    if (signal.phase === "evening") {
      const eveningCafe = hasAny(placeSignals, ["dessert", "tea-house", "intimate", "late-night"]);
      return {
        likelyOpen: eveningCafe,
        confidence: eveningCafe ? 0.46 : 0.5,
        notes: [eveningCafe ? "evening cafe signal detected" : "cafe-hour heuristic weak after daytime"]
      };
    }
    return {
      likelyOpen: hasAny(placeSignals, ["late-night", "dessert"]),
      confidence: hasAny(placeSignals, ["late-night", "dessert"]) ? 0.56 : 0.58,
      notes: ["late-night cafe heuristic is conservative"]
    };
  }
  if (category === "bar") {
    if (signal.phase === "morning") {
      return { likelyOpen: false, confidence: 0.78, notes: ["bar-hour heuristic suppresses morning anchors"] };
    }
    if (signal.phase === "afternoon") {
      const afternoonBar = hasAny(placeSignals, ["brewery", "sports-bar", "beer-hall"]);
      return {
        likelyOpen: afternoonBar,
        confidence: afternoonBar ? 0.52 : 0.56,
        notes: [afternoonBar ? "afternoon bar subtype detected" : "bar-hour heuristic prefers later windows"]
      };
    }
    return {
      likelyOpen: true,
      confidence: signal.phase === "late-night" ? 0.66 : 0.6,
      notes: ["bar-hour heuristic supports evening nightlife windows"]
    };
  }
  if (signal.phase === "morning") {
    const brunchFriendly = hasAny(placeSignals, ["breakfast", "brunch", "coffee"]);
    return {
      likelyOpen: brunchFriendly,
      confidence: brunchFriendly ? 0.56 : 0.5,
      notes: [brunchFriendly ? "morning restaurant subtype detected" : "restaurant-hour heuristic is weaker in the morning"]
    };
  }
  if (signal.phase === "late-night") {
    const lateNightFriendly = hasAny(placeSignals, ["late-night", "cocktails", "bar"]);
    return {
      likelyOpen: lateNightFriendly,
      confidence: lateNightFriendly ? 0.52 : 0.52,
      notes: [lateNightFriendly ? "late-night restaurant signal detected" : "restaurant-hour heuristic softens after late night"]
    };
  }
  notes.push(signal.phase === "evening" ? "restaurant-hour heuristic favors dinner windows" : "restaurant-hour heuristic supports daytime service");
  return {
    likelyOpen: true,
    confidence: signal.phase === "evening" ? 0.58 : 0.54,
    notes
  };
}
function inferHoursPressure({
  raw,
  category,
  timeWindowSignal
}) {
  const businessStatus = mapBusinessStatus(raw.businessStatus);
  const isLive = raw.sourceOrigin === "live";
  if (!isLive) {
    return {
      openNow: void 0,
      hoursKnown: false,
      likelyOpenForCurrentWindow: true,
      businessStatus,
      timeConfidence: 0.24,
      hoursPressureLevel: "unknown",
      hoursPressureNotes: ["Curated venue has no live hours metadata in this phase."]
    };
  }
  if (businessStatus === "closed-permanently" || businessStatus === "temporarily-closed") {
    return {
      openNow: false,
      hoursKnown: true,
      likelyOpenForCurrentWindow: false,
      businessStatus,
      timeConfidence: 1,
      hoursPressureLevel: "closed",
      hoursPressureNotes: [`Business status is ${businessStatus}.`]
    };
  }
  const hoursKnown = Boolean(
    typeof raw.openNow === "boolean" || raw.hoursPeriods && raw.hoursPeriods.length > 0 || raw.currentOpeningHoursText && raw.currentOpeningHoursText.length > 0 || raw.regularOpeningHoursText && raw.regularOpeningHoursText.length > 0
  );
  if (typeof raw.openNow === "boolean") {
    if (timeWindowSignal?.usesIntentWindow) {
      const heuristic2 = inferLikelyOpenFromCategory(raw, category, timeWindowSignal);
      const confidence = clamp015(
        heuristic2.confidence + (raw.openNow ? 0.1 : -0.02) + ((raw.hoursPeriods?.length ?? 0) > 0 ? 0.06 : 0)
      );
      return {
        openNow: raw.openNow,
        hoursKnown: true,
        likelyOpenForCurrentWindow: heuristic2.likelyOpen,
        businessStatus,
        timeConfidence: Number(confidence.toFixed(2)),
        hoursPressureLevel: heuristic2.likelyOpen ? "likely-open" : "likely-closed",
        hoursPressureNotes: [
          ...heuristic2.notes,
          raw.openNow ? "Provider reports open now, but a future/planned window required heuristic calibration." : "Provider reports closed now, but the requested planning window required softer heuristic calibration."
        ]
      };
    }
    return {
      openNow: raw.openNow,
      hoursKnown: true,
      likelyOpenForCurrentWindow: raw.openNow,
      businessStatus,
      timeConfidence: raw.openNow ? 0.96 : 0.94,
      hoursPressureLevel: raw.openNow ? "strong-open" : "closed",
      hoursPressureNotes: [raw.openNow ? "Provider reports open now." : "Provider reports closed now."]
    };
  }
  if (timeWindowSignal && raw.hoursPeriods && raw.hoursPeriods.length > 0) {
    const openFromPeriods = isOpenDuringWindow(raw.hoursPeriods, timeWindowSignal);
    if (typeof openFromPeriods === "boolean") {
      return {
        openNow: void 0,
        hoursKnown: true,
        likelyOpenForCurrentWindow: openFromPeriods,
        businessStatus,
        timeConfidence: 0.88,
        hoursPressureLevel: openFromPeriods ? "strong-open" : "likely-closed",
        hoursPressureNotes: [
          openFromPeriods ? `Opening periods suggest the venue is available for ${timeWindowSignal.label}.` : `Opening periods suggest the venue is not available for ${timeWindowSignal.label}.`
        ]
      };
    }
  }
  if (!timeWindowSignal) {
    return {
      openNow: void 0,
      hoursKnown,
      likelyOpenForCurrentWindow: true,
      businessStatus,
      timeConfidence: hoursKnown ? 0.56 : 0.38,
      hoursPressureLevel: hoursKnown ? "likely-open" : "unknown",
      hoursPressureNotes: [
        hoursKnown ? "Hours metadata exists, but no current planning window was available." : "No hours metadata was available from the live provider."
      ]
    };
  }
  const heuristic = inferLikelyOpenFromCategory(raw, category, timeWindowSignal);
  const softenedConfidence = clamp015(
    heuristic.confidence + (hoursKnown ? 0.04 : heuristic.likelyOpen ? 0.02 : -0.08)
  );
  return {
    openNow: void 0,
    hoursKnown,
    likelyOpenForCurrentWindow: heuristic.likelyOpen,
    businessStatus,
    timeConfidence: Number(softenedConfidence.toFixed(2)),
    hoursPressureLevel: !hoursKnown ? heuristic.likelyOpen || softenedConfidence < 0.64 ? "unknown" : "likely-closed" : heuristic.likelyOpen ? "likely-open" : "likely-closed",
    hoursPressureNotes: [
      ...heuristic.notes,
      hoursKnown ? `Hours metadata exists but required heuristic interpretation for ${timeWindowSignal.label}.` : `No structured hours were returned, so a ${timeWindowSignal.label} heuristic was used.`
    ]
  };
}

// src/domain/taste/getDurationProfile.ts
var categoryProfiles = {
  dessert: { durationClass: "XS", minMinutes: 15, maxMinutes: 35, baseMinutes: 25 },
  cafe: { durationClass: "S", minMinutes: 30, maxMinutes: 65, baseMinutes: 45 },
  bar: { durationClass: "M", minMinutes: 45, maxMinutes: 95, baseMinutes: 75 },
  restaurant: { durationClass: "L", minMinutes: 75, maxMinutes: 150, baseMinutes: 110 },
  museum: { durationClass: "L", minMinutes: 75, maxMinutes: 140, baseMinutes: 100 },
  live_music: { durationClass: "XL", minMinutes: 110, maxMinutes: 180, baseMinutes: 140 },
  park: { durationClass: "S", minMinutes: 30, maxMinutes: 100, baseMinutes: 50 },
  activity: { durationClass: "M", minMinutes: 45, maxMinutes: 120, baseMinutes: 80 },
  event: { durationClass: "M", minMinutes: 45, maxMinutes: 120, baseMinutes: 85 }
};
function getDurationClass(minutes) {
  if (minutes <= 30) {
    return "XS";
  }
  if (minutes <= 60) {
    return "S";
  }
  if (minutes <= 90) {
    return "M";
  }
  if (minutes <= 150) {
    return "L";
  }
  return "XL";
}
function getDurationProfile(venue) {
  const tags = new Set(venue.tags.map((tag) => tag.toLowerCase()));
  const profile = categoryProfiles[venue.category];
  let baseMinutes = profile.baseMinutes;
  if (tags.has("quick-start") || tags.has("walk-up")) {
    baseMinutes -= 10;
  }
  if (tags.has("chef-led") || tags.has("elevated") || tags.has("tasting-menu") || tags.has("wine-pairing")) {
    baseMinutes += 20;
  }
  if (tags.has("social") || tags.has("rooftop") || tags.has("beer-garden")) {
    baseMinutes += 10;
  }
  if (tags.has("tea-room") || tags.has("quiet") || tags.has("reflective") || tags.has("garden")) {
    baseMinutes += 10;
  }
  if (tags.has("trail") || tags.has("viewpoint") || tags.has("nature")) {
    baseMinutes += 25;
  }
  if (tags.has("arcade") || tags.has("games") || tags.has("mini-golf") || tags.has("karaoke")) {
    baseMinutes += 15;
  }
  if (tags.has("hands-on") || tags.has("immersive") || tags.has("guided") || tags.has("learning") || tags.has("family-friendly")) {
    baseMinutes += 10;
  }
  if (tags.has("local-artists") || tags.has("small-stage") || tags.has("listening") || tags.has("jazz") || tags.has("acoustic")) {
    baseMinutes += 15;
  }
  if (tags.has("market") || tags.has("makers") || tags.has("gallery") || tags.has("vintage") || tags.has("pop-up")) {
    baseMinutes -= 10;
  }
  if (tags.has("dessert") || tags.has("gelato") || tags.has("ice-cream")) {
    baseMinutes -= 10;
  }
  const estimatedDurationMinutes = Math.max(profile.minMinutes, Math.min(profile.maxMinutes, baseMinutes));
  return {
    durationClass: getDurationClass(estimatedDurationMinutes),
    minMinutes: profile.minMinutes,
    maxMinutes: profile.maxMinutes,
    baseMinutes: estimatedDurationMinutes
  };
}

// src/domain/retrieval/computeLiveSignatureStrength.ts
var emptyStrength = {
  strength: 0,
  signatureBoost: 0,
  genericRelief: 0,
  sourceConfidenceBoost: 0,
  notes: []
};
function clamp016(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue4(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function tokenizeQueryLabel(value) {
  if (!value) {
    return [];
  }
  return value.split(/[^a-z0-9]+/i).map((part) => normalizeValue4(part)).filter(Boolean);
}
function countMatches2(values, candidates) {
  return candidates.filter((candidate) => values.has(normalizeValue4(candidate))).length;
}
function computeLiveSignatureStrength(raw, category) {
  if (raw.sourceOrigin !== "live") {
    return emptyStrength;
  }
  const normalizedSignals = /* @__PURE__ */ new Set([
    ...(raw.tags ?? []).map(normalizeValue4),
    ...(raw.sourceTypes ?? []).map(normalizeValue4),
    ...(raw.queryTerms ?? []).map(normalizeValue4),
    ...tokenizeQueryLabel(raw.sourceQueryLabel)
  ]);
  const notes = [];
  const distinctiveSignals = countMatches2(normalizedSignals, [
    "cocktails",
    "cocktail-bar",
    "wine",
    "wine-bar",
    "espresso-bar",
    "tea-house",
    "brunch",
    "chef-led",
    "seasonal",
    "local",
    "artisan",
    "craft",
    "cozy",
    "intimate",
    "rooftop",
    "outdoor-seating",
    "historic",
    "understated"
  ]);
  const categorySpecificSignals = category === "bar" ? countMatches2(normalizedSignals, ["cocktails", "wine", "rooftop", "brewery", "craft", "intimate"]) : category === "cafe" ? countMatches2(normalizedSignals, ["espresso-bar", "tea-house", "cozy", "artisan", "local"]) : countMatches2(normalizedSignals, ["chef-led", "seasonal", "brunch", "local", "craft", "intimate"]);
  const rating = raw.rating ?? 0;
  const ratingCount = raw.ratingCount ?? 0;
  const reviewSignal = (rating >= 4.6 ? 0.12 : rating >= 4.4 ? 0.08 : rating >= 4.2 ? 0.04 : 0) + (ratingCount >= 800 ? 0.1 : ratingCount >= 250 ? 0.07 : ratingCount >= 80 ? 0.04 : 0);
  const summarySignal = raw.shortDescription && raw.shortDescription.trim().length >= 36 ? 0.06 : raw.shortDescription && raw.shortDescription.trim().length >= 20 ? 0.03 : 0;
  const querySignal = categorySpecificSignals >= 1 && (raw.queryTerms?.length ?? 0) > 0 ? 0.04 : 0;
  const localSignal = distinctiveSignals >= 2 ? 0.06 : distinctiveSignals === 1 ? 0.03 : 0;
  const chainPenalty = raw.isChain ? 0.12 : 0;
  const strength = clamp016(
    0.26 + reviewSignal + summarySignal + querySignal + localSignal + Math.min(categorySpecificSignals, 3) * 0.06 - chainPenalty
  );
  if (reviewSignal >= 0.08) {
    notes.push("reviews imply stronger local signal");
  }
  if (categorySpecificSignals >= 1) {
    notes.push("category-specific signature cues detected");
  }
  if (querySignal > 0) {
    notes.push("query intent aligns with venue signature");
  }
  return {
    strength: Number(strength.toFixed(2)),
    signatureBoost: Number(Math.min(0.16, strength * 0.14).toFixed(2)),
    genericRelief: Number(Math.min(0.14, strength * 0.12).toFixed(2)),
    sourceConfidenceBoost: Number(Math.min(0.06, strength * 0.05).toFixed(2)),
    notes
  };
}

// src/domain/normalize/inferVenueSignals.ts
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function hasAnyTag2(raw, candidates) {
  const tags = new Set((raw.tags ?? []).map((tag) => tag.toLowerCase()));
  return candidates.some((candidate) => tags.has(candidate.toLowerCase()));
}
function inferSetting(raw, category) {
  if (raw.settingHint) {
    return raw.settingHint;
  }
  if (category === "park") {
    return "outdoor";
  }
  if (hasAnyTag2(raw, ["garden", "trail", "viewpoint", "stargazing", "walkable", "outdoor-seating", "rooftop"])) {
    return category === "bar" || category === "event" || category === "activity" ? "hybrid" : "outdoor";
  }
  if (hasAnyTag2(raw, ["greenhouse", "courtyard", "open-air"])) {
    return "hybrid";
  }
  return "indoor";
}
function inferEnergyLevel(raw, category, inferredFields) {
  if (typeof raw.energyLevel === "number") {
    return raw.energyLevel;
  }
  inferredFields.push("energyLevel");
  const baseByCategory = {
    restaurant: 3,
    bar: 4,
    cafe: 2,
    dessert: 2,
    live_music: 4,
    activity: 4,
    park: 1,
    museum: 2,
    event: 3
  };
  let energy = baseByCategory[category];
  if (hasAnyTag2(raw, ["quiet", "calm", "tea-room", "reflective", "stargazing"])) {
    energy -= 1;
  }
  if (hasAnyTag2(raw, ["social", "group", "arcade", "karaoke", "high-energy", "cocktails"])) {
    energy += 1;
  }
  return clamp(energy, 1, 5);
}
function inferSocialDensity(raw, category, energyLevel, inferredFields) {
  if (typeof raw.socialDensity === "number") {
    return raw.socialDensity;
  }
  inferredFields.push("socialDensity");
  let socialDensity = category === "bar" || category === "event" || category === "live_music" ? 4 : category === "restaurant" || category === "activity" ? 3 : 2;
  if (hasAnyTag2(raw, ["quiet", "tea-room", "reflective", "stroll"])) {
    socialDensity -= 1;
  }
  if (hasAnyTag2(raw, ["community", "market", "social", "group"])) {
    socialDensity += 1;
  }
  if (energyLevel >= 4) {
    socialDensity += 0.5;
  }
  return clamp(Math.round(socialDensity), 1, 5);
}
function inferVibeTags(raw, category, inferredFields) {
  if (raw.vibeTags && raw.vibeTags.length > 0) {
    return raw.vibeTags;
  }
  inferredFields.push("vibeTags");
  const base = {
    restaurant: ["culinary", "cozy"],
    bar: ["lively", "creative"],
    cafe: ["cozy", "relaxed"],
    dessert: ["cozy", "culinary"],
    live_music: ["culture", "creative"],
    activity: ["playful", "creative"],
    park: ["outdoors", "relaxed"],
    museum: ["culture", "creative"],
    event: ["creative", "culture"]
  };
  const vibes = new Set(base[category]);
  if (hasAnyTag2(raw, ["social", "cocktails", "group", "community"])) {
    vibes.add("lively");
  }
  if (hasAnyTag2(raw, ["quiet", "tea-room", "calm", "reflective"])) {
    vibes.add("relaxed");
  }
  if (hasAnyTag2(raw, ["garden", "trail", "viewpoint", "stargazing"])) {
    vibes.add("outdoors");
  }
  return [...vibes];
}
function inferAudienceFlags(raw, category) {
  const familyFriendly = raw.familyFriendly ?? (hasAnyTag2(raw, ["family-friendly", "learning", "hands-on", "outdoor-play", "animals"]) || category === "museum");
  const adultSocial = raw.adultSocial ?? (category === "bar" || category === "live_music" || hasAnyTag2(raw, ["cocktails", "wine", "stylish", "rooftop", "speakeasy"]));
  const dateFriendly = raw.dateFriendly ?? (category === "restaurant" || category === "dessert" || hasAnyTag2(raw, ["intimate", "chef-led", "tea-room", "cozy", "wine"]));
  return {
    familyFriendly,
    adultSocial,
    dateFriendly
  };
}
function inferUseCases(raw, audienceFlags, inferredFields) {
  if (raw.useCases && raw.useCases.length > 0) {
    return raw.useCases;
  }
  inferredFields.push("useCases");
  const useCases = /* @__PURE__ */ new Set();
  if (audienceFlags.dateFriendly) {
    useCases.add("romantic");
  }
  if (audienceFlags.adultSocial || hasAnyTag2(raw, ["social", "group", "playful"])) {
    useCases.add("socialite");
  }
  if (audienceFlags.familyFriendly || hasAnyTag2(raw, ["culture", "learning", "guided"])) {
    useCases.add("curator");
  }
  if (useCases.size === 0) {
    useCases.add("socialite");
  }
  return [...useCases];
}
function inferHighlightTier(raw, category) {
  if (category === "restaurant" || category === "bar" || category === "live_music") {
    return { tier: "highlight-capable", confidence: 0.82 };
  }
  if (category === "event" || category === "activity" && hasAnyTag2(raw, ["arcade", "karaoke", "mini-golf", "guided"])) {
    return { tier: "highlight-capable", confidence: 0.74 };
  }
  if (category === "museum" || category === "activity" || category === "park" || category === "dessert" || category === "cafe") {
    return {
      tier: hasAnyTag2(raw, ["scenic", "trail", "viewpoint", "signature", "historic", "immersive", "intimate"]) ? "highlight-capable" : "support-only",
      confidence: hasAnyTag2(raw, ["signature", "immersive", "historic"]) ? 0.68 : 0.56
    };
  }
  return { tier: "connective-only", confidence: 0.45 };
}
function inferRouteFootprint(raw) {
  const driveMinutes = raw.driveMinutes ?? 12;
  if (driveMinutes <= 10) {
    return "compact";
  }
  if (driveMinutes <= 16) {
    return "neighborhood-hop";
  }
  return "destination";
}
function inferSignatureSignals(raw, category) {
  const chainLike = raw.isChain ?? false;
  const liveSignatureStrength = computeLiveSignatureStrength(raw, category);
  let genericScore = chainLike ? 0.8 : 0.32;
  let signatureScore = typeof raw.distinctivenessScore === "number" ? raw.distinctivenessScore : chainLike ? 0.28 : 0.62;
  if (hasAnyTag2(raw, ["local", "signature", "chef-led", "historic", "artisan", "understated"])) {
    genericScore -= 0.12;
    signatureScore += 0.12;
  }
  if (hasAnyTag2(raw, ["casual", "food-hall", "family-friendly", "neighborhood"])) {
    genericScore += 0.08;
  }
  if (category === "event" || category === "live_music") {
    signatureScore += 0.05;
  }
  if (liveSignatureStrength.strength > 0) {
    genericScore -= liveSignatureStrength.genericRelief;
    signatureScore += liveSignatureStrength.signatureBoost;
  }
  return {
    chainLike,
    genericScore: clamp(Number(genericScore.toFixed(2)), 0, 1),
    signatureScore: clamp(Number(signatureScore.toFixed(2)), 0, 1)
  };
}
function inferScore(rawValue, fallback, inferredFields, field) {
  if (typeof rawValue === "number") {
    return rawValue;
  }
  inferredFields.push(field);
  return fallback;
}
function inferLocalSignals(raw, signatureScore, inferredFields) {
  if (raw.localSignals) {
    return {
      localFavoriteScore: raw.localSignals.localFavoriteScore ?? 0.72,
      neighborhoodPrideScore: raw.localSignals.neighborhoodPrideScore ?? 0.72,
      repeatVisitorScore: raw.localSignals.repeatVisitorScore ?? 0.72
    };
  }
  inferredFields.push("localSignals");
  const base = clamp(0.58 + signatureScore * 0.24, 0.45, 0.92);
  return {
    localFavoriteScore: Number(base.toFixed(2)),
    neighborhoodPrideScore: Number((base + 0.04).toFixed(2)),
    repeatVisitorScore: Number((base - 0.02).toFixed(2))
  };
}
function inferRoleAffinity(raw, category, highlightTier, inferredFields) {
  if (raw.roleAffinity) {
    return {
      warmup: raw.roleAffinity.warmup ?? 0.5,
      peak: raw.roleAffinity.peak ?? 0.5,
      wildcard: raw.roleAffinity.wildcard ?? 0.5,
      cooldown: raw.roleAffinity.cooldown ?? 0.5
    };
  }
  inferredFields.push("roleAffinity");
  const baseByCategory = {
    restaurant: { warmup: 0.58, peak: 0.84, wildcard: 0.4, cooldown: 0.42 },
    bar: { warmup: 0.5, peak: 0.8, wildcard: 0.48, cooldown: 0.54 },
    cafe: { warmup: 0.86, peak: 0.42, wildcard: 0.52, cooldown: 0.82 },
    dessert: { warmup: 0.58, peak: 0.52, wildcard: 0.48, cooldown: 0.9 },
    live_music: { warmup: 0.42, peak: 0.86, wildcard: 0.82, cooldown: 0.38 },
    activity: { warmup: 0.48, peak: 0.8, wildcard: 0.82, cooldown: 0.34 },
    park: { warmup: 0.78, peak: 0.56, wildcard: 0.66, cooldown: 0.92 },
    museum: { warmup: 0.62, peak: 0.72, wildcard: 0.6, cooldown: 0.68 },
    event: { warmup: 0.54, peak: 0.76, wildcard: 0.86, cooldown: 0.44 }
  };
  const roleAffinity = { ...baseByCategory[category] };
  if (highlightTier === "support-only") {
    roleAffinity.peak = Math.max(0.48, roleAffinity.peak - 0.12);
    roleAffinity.cooldown = Math.min(0.96, roleAffinity.cooldown + 0.04);
  }
  if (highlightTier === "connective-only") {
    roleAffinity.peak = Math.max(0.3, roleAffinity.peak - 0.2);
    roleAffinity.wildcard = Math.max(0.34, roleAffinity.wildcard - 0.1);
  }
  return roleAffinity;
}
function inferVenueSignals({
  raw,
  category
}) {
  const inferredFields = [];
  const energyLevel = inferEnergyLevel(raw, category, inferredFields);
  const socialDensity = inferSocialDensity(raw, category, energyLevel, inferredFields);
  const vibeTags = inferVibeTags(raw, category, inferredFields);
  const audienceFlags = inferAudienceFlags(raw, category);
  const useCases = inferUseCases(raw, audienceFlags, inferredFields);
  const highlight = inferHighlightTier(raw, category);
  const signature = inferSignatureSignals(raw, category);
  const uniquenessScore = inferScore(
    raw.uniquenessScore,
    clamp(0.52 + signature.signatureScore * 0.38, 0.4, 0.95),
    inferredFields,
    "uniquenessScore"
  );
  const distinctivenessScore = inferScore(
    raw.distinctivenessScore,
    clamp(0.5 + signature.signatureScore * 0.42, 0.38, 0.96),
    inferredFields,
    "distinctivenessScore"
  );
  const underexposureScore = inferScore(
    raw.underexposureScore,
    clamp(0.42 + (raw.isHiddenGem ? 0.22 : 0) + (signature.signatureScore - signature.genericScore) * 0.12, 0.25, 0.92),
    inferredFields,
    "underexposureScore"
  );
  const shareabilityScore = inferScore(
    raw.shareabilityScore,
    clamp(0.48 + socialDensity * 0.06 + signature.signatureScore * 0.12, 0.35, 0.94),
    inferredFields,
    "shareabilityScore"
  );
  const isHiddenGem = typeof raw.isHiddenGem === "boolean" ? raw.isHiddenGem : signature.signatureScore >= 0.78 && underexposureScore >= 0.64;
  if (typeof raw.isHiddenGem !== "boolean") {
    inferredFields.push("isHiddenGem");
  }
  const isChain = raw.isChain ?? signature.chainLike;
  if (typeof raw.isChain !== "boolean") {
    inferredFields.push("isChain");
  }
  const setting = inferSetting(raw, category);
  const localSignals = inferLocalSignals(raw, signature.signatureScore, inferredFields);
  const roleAffinity = inferRoleAffinity(raw, category, highlight.tier, inferredFields);
  const durationProfileBase = getDurationProfile({
    category,
    tags: raw.tags ?? []
  });
  const durationProfile = {
    durationClass: durationProfileBase.durationClass,
    estimatedMinutes: durationProfileBase.baseMinutes
  };
  return {
    useCases,
    vibeTags,
    energyLevel,
    socialDensity,
    uniquenessScore,
    distinctivenessScore,
    underexposureScore,
    shareabilityScore,
    isHiddenGem,
    isChain,
    localSignals,
    roleAffinity,
    durationProfile,
    settings: {
      socialDensity,
      highlightCapabilityTier: highlight.tier,
      highlightConfidence: highlight.confidence,
      supportOnly: highlight.tier === "support-only",
      connectiveOnly: highlight.tier === "connective-only",
      setting,
      familyFriendly: audienceFlags.familyFriendly,
      adultSocial: audienceFlags.adultSocial,
      dateFriendly: audienceFlags.dateFriendly,
      eventCapable: raw.eventCapable ?? (category === "event" || hasAnyTag2(raw, ["market", "pop-up", "community"])),
      musicCapable: raw.musicCapable ?? (category === "live_music" || hasAnyTag2(raw, ["jazz", "listening", "acoustic"])),
      performanceCapable: raw.performanceCapable ?? (category === "live_music" || hasAnyTag2(raw, ["performance", "small-stage", "guided", "gallery"])),
      routeFootprint: inferRouteFootprint(raw)
    },
    signature,
    inferredFields: [...new Set(inferredFields)]
  };
}

// src/domain/normalize/normalizeRawPlace.ts
function clamp017(value) {
  return Math.max(0, Math.min(1, value));
}
function collectMissingFields(raw) {
  const missing = [];
  if (!raw.city) {
    missing.push("city");
  }
  if (!raw.neighborhood) {
    missing.push("neighborhood");
  }
  if (typeof raw.driveMinutes !== "number") {
    missing.push("driveMinutes");
  }
  if (!raw.priceTier) {
    missing.push("priceTier");
  }
  if (!raw.shortDescription) {
    missing.push("shortDescription");
  }
  if (!raw.narrativeFlavor) {
    missing.push("narrativeFlavor");
  }
  if (!raw.tags || raw.tags.length === 0) {
    missing.push("tags");
  }
  return missing;
}
function normalizeRawPlace(raw, options = {}) {
  const categoryResult = getNormalizedCategory(raw);
  const inferred = inferVenueSignals({
    raw,
    category: categoryResult.category
  });
  const hoursPressure = inferHoursPressure({
    raw,
    category: categoryResult.category,
    timeWindowSignal: options.timeWindowSignal
  });
  const missingFields = collectMissingFields(raw);
  const completenessScore = clamp017(1 - missingFields.length * 0.1);
  const sourceConfidence = clamp017(
    typeof raw.sourceConfidence === "number" ? raw.sourceConfidence : 0.58 + completenessScore * 0.18 + inferred.signature.signatureScore * 0.1
  );
  const sourceOrigin = raw.sourceOrigin ?? (raw.normalizedFromRawType === "seed" ? "curated" : "live");
  const baseVenue = {
    id: raw.id,
    name: raw.name,
    city: raw.city ?? "San Jose",
    neighborhood: raw.neighborhood ?? "Unknown",
    driveMinutes: raw.driveMinutes ?? 14,
    category: categoryResult.category,
    subcategory: raw.subcategoryHint ?? categoryResult.subcategory,
    priceTier: raw.priceTier ?? "$$",
    tags: raw.tags ?? [],
    useCases: inferred.useCases,
    vibeTags: inferred.vibeTags,
    energyLevel: inferred.energyLevel,
    socialDensity: inferred.socialDensity,
    uniquenessScore: inferred.uniquenessScore,
    distinctivenessScore: inferred.distinctivenessScore,
    underexposureScore: inferred.underexposureScore,
    shareabilityScore: inferred.shareabilityScore,
    isChain: inferred.isChain,
    localSignals: inferred.localSignals,
    roleAffinity: inferred.roleAffinity,
    imageUrl: raw.imageUrl ?? "",
    shortDescription: raw.shortDescription ?? `${raw.name} with a usable local fit profile.`,
    narrativeFlavor: raw.narrativeFlavor ?? "A normalized venue waiting for stronger narrative detail.",
    isHiddenGem: inferred.isHiddenGem,
    isActive: raw.isActive ?? true,
    highlightCapable: inferred.settings.highlightCapabilityTier === "highlight-capable",
    durationProfile: inferred.durationProfile,
    settings: inferred.settings,
    signature: inferred.signature,
    source: {
      normalizedFromRawType: raw.normalizedFromRawType ?? "raw-place",
      sourceOrigin,
      provider: raw.provider,
      providerRecordId: raw.providerRecordId,
      latitude: raw.latitude,
      longitude: raw.longitude,
      sourceQueryLabel: raw.sourceQueryLabel,
      sourceConfidence: Number(sourceConfidence.toFixed(2)),
      completenessScore: Number(completenessScore.toFixed(2)),
      qualityScore: 0,
      openNow: hoursPressure.openNow,
      hoursKnown: hoursPressure.hoursKnown,
      likelyOpenForCurrentWindow: hoursPressure.likelyOpenForCurrentWindow,
      businessStatus: hoursPressure.businessStatus,
      timeConfidence: hoursPressure.timeConfidence,
      hoursPressureLevel: hoursPressure.hoursPressureLevel,
      hoursPressureNotes: hoursPressure.hoursPressureNotes,
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: [.../* @__PURE__ */ new Set([...raw.placeTypes ?? [], ...raw.sourceTypes ?? []])],
      missingFields,
      inferredFields: inferred.inferredFields,
      qualityGateStatus: "approved",
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: []
    }
  };
  const qualityGate = applyQualityGate(baseVenue);
  return {
    ...baseVenue,
    source: {
      ...baseVenue.source,
      qualityScore: qualityGate.qualityScore,
      qualityGateStatus: qualityGate.status,
      qualityGateNotes: qualityGate.notes,
      approvalBlockers: qualityGate.approvalBlockers,
      demotionReasons: qualityGate.demotionReasons,
      suppressionReasons: qualityGate.suppressionReasons,
      hoursDemotionApplied: qualityGate.hoursDemotionApplied,
      hoursSuppressionApplied: qualityGate.hoursSuppressionApplied,
      happenings: deriveVenueHappeningsSignals(baseVenue)
    }
  };
}

// src/domain/normalize/normalizeVenue.ts
function clamp018(value) {
  return Math.max(0, Math.min(1, value));
}
function collectMissingFields2(raw) {
  const missing = [];
  if (!raw.city) {
    missing.push("city");
  }
  if (!raw.neighborhood) {
    missing.push("neighborhood");
  }
  if (typeof raw.driveMinutes !== "number") {
    missing.push("driveMinutes");
  }
  if (!raw.shortDescription) {
    missing.push("shortDescription");
  }
  if (!raw.narrativeFlavor) {
    missing.push("narrativeFlavor");
  }
  return missing;
}
function normalizeRawEvent(raw, options = {}) {
  const categoryResult = getNormalizedCategory(raw);
  const inferred = inferVenueSignals({
    raw,
    category: categoryResult.category
  });
  const missingFields = collectMissingFields2(raw);
  const completenessScore = clamp018(1 - missingFields.length * 0.11);
  const sourceConfidence = clamp018(
    typeof raw.sourceConfidence === "number" ? raw.sourceConfidence : 0.52 + completenessScore * 0.16 + inferred.signature.signatureScore * 0.1
  );
  const hoursPressure = inferHoursPressure({
    raw: {
      ...raw,
      rawType: "place",
      placeTypes: raw.eventTypes
    },
    category: categoryResult.category,
    timeWindowSignal: options.timeWindowSignal
  });
  const sourceOrigin = raw.sourceOrigin ?? (raw.normalizedFromRawType === "seed" ? "curated" : "live");
  const baseVenue = {
    id: raw.id,
    name: raw.name,
    city: raw.city ?? "San Jose",
    neighborhood: raw.neighborhood ?? "Unknown",
    driveMinutes: raw.driveMinutes ?? 16,
    category: categoryResult.category,
    subcategory: raw.subcategoryHint ?? categoryResult.subcategory,
    priceTier: raw.priceTier ?? "$$",
    tags: raw.tags ?? [],
    useCases: inferred.useCases,
    vibeTags: inferred.vibeTags,
    energyLevel: inferred.energyLevel,
    socialDensity: inferred.socialDensity,
    uniquenessScore: inferred.uniquenessScore,
    distinctivenessScore: inferred.distinctivenessScore,
    underexposureScore: inferred.underexposureScore,
    shareabilityScore: inferred.shareabilityScore,
    isChain: inferred.isChain,
    localSignals: inferred.localSignals,
    roleAffinity: inferred.roleAffinity,
    imageUrl: raw.imageUrl ?? "",
    shortDescription: raw.shortDescription ?? `${raw.name} with event-like local signal.`,
    narrativeFlavor: raw.narrativeFlavor ?? "An event-shaped venue normalized for engine use.",
    isHiddenGem: inferred.isHiddenGem,
    isActive: raw.isActive ?? true,
    highlightCapable: inferred.settings.highlightCapabilityTier === "highlight-capable",
    durationProfile: inferred.durationProfile,
    settings: {
      ...inferred.settings,
      eventCapable: true,
      performanceCapable: raw.performanceCapable ?? inferred.settings.performanceCapable
    },
    signature: inferred.signature,
    source: {
      normalizedFromRawType: raw.normalizedFromRawType ?? "raw-event",
      sourceOrigin,
      provider: raw.provider,
      providerRecordId: raw.providerRecordId,
      sourceQueryLabel: raw.sourceQueryLabel,
      sourceConfidence: Number(sourceConfidence.toFixed(2)),
      completenessScore: Number(completenessScore.toFixed(2)),
      qualityScore: 0,
      openNow: hoursPressure.openNow,
      hoursKnown: hoursPressure.hoursKnown,
      likelyOpenForCurrentWindow: hoursPressure.likelyOpenForCurrentWindow,
      businessStatus: hoursPressure.businessStatus,
      timeConfidence: hoursPressure.timeConfidence,
      hoursPressureLevel: hoursPressure.hoursPressureLevel,
      hoursPressureNotes: hoursPressure.hoursPressureNotes,
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: [.../* @__PURE__ */ new Set([...raw.eventTypes ?? [], ...raw.sourceTypes ?? []])],
      missingFields,
      inferredFields: inferred.inferredFields,
      qualityGateStatus: "approved",
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: []
    }
  };
  const qualityGate = applyQualityGate(baseVenue);
  return {
    ...baseVenue,
    source: {
      ...baseVenue.source,
      qualityScore: qualityGate.qualityScore,
      qualityGateStatus: qualityGate.status,
      qualityGateNotes: qualityGate.notes,
      approvalBlockers: qualityGate.approvalBlockers,
      demotionReasons: qualityGate.demotionReasons,
      suppressionReasons: qualityGate.suppressionReasons,
      hoursDemotionApplied: qualityGate.hoursDemotionApplied,
      hoursSuppressionApplied: qualityGate.hoursSuppressionApplied,
      happenings: deriveVenueHappeningsSignals(baseVenue)
    }
  };
}
function normalizeVenue(raw, options = {}) {
  if (raw.rawType === "place") {
    return normalizeRawPlace(raw, options);
  }
  return normalizeRawEvent(raw, options);
}

// src/domain/retrieval/getTimeWindowSignal.ts
function getPhaseFromHour(hour) {
  if (hour < 11) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  if (hour < 22) {
    return "evening";
  }
  return "late-night";
}
function parseHourFromTimeWindow(timeWindow) {
  if (!timeWindow) {
    return void 0;
  }
  const normalized = timeWindow.trim().toLowerCase();
  const directMatches = [
    [["breakfast", "morning", "coffee"], 9],
    [["brunch", "lunch", "daytime", "afternoon"], 13],
    [["sunset", "dinner", "evening", "date-night"], 19],
    [["late-night", "nightcap", "after-dark", "night"], 22]
  ];
  for (const [candidates, hour2] of directMatches) {
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return hour2;
    }
  }
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    return void 0;
  }
  let hour = Number(match[1]);
  const meridiem = match[3];
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  return Math.max(0, Math.min(23, hour));
}
function getTimeWindowSignal(intent) {
  const now = /* @__PURE__ */ new Date();
  const parsedHour = parseHourFromTimeWindow(intent.timeWindow);
  const hour = parsedHour ?? now.getHours();
  const minute = parsedHour === void 0 ? now.getMinutes() : 0;
  const phase = getPhaseFromHour(hour);
  return {
    day: now.getDay(),
    hour,
    minute,
    phase,
    label: parsedHour === void 0 ? `${phase} now` : intent.timeWindow?.trim() || phase,
    usesIntentWindow: parsedHour !== void 0
  };
}

// src/domain/sources/buildLiveQueryPlan.ts
function normalizeTerm(value) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}
function unique5(values) {
  return [...new Set(values.filter(Boolean))];
}
function pickStarterPackTerms(starterPack) {
  const preferred = starterPack?.lensPreset?.preferredTags ?? [];
  return unique5(preferred.slice(0, 3).map(normalizeTerm).filter((value) => value.length >= 4));
}
function getPersonaTerms(intent) {
  if (intent.crew === "romantic") {
    return ["intimate", "date night", "conversation"];
  }
  if (intent.crew === "socialite") {
    return ["social", "cocktail", "lively"];
  }
  return ["welcoming", "casual", "comfortable"];
}
function getVibeTerms(intent) {
  const primary = intent.primaryAnchor;
  if (primary === "cozy") {
    return ["cozy", "quiet", "warm"];
  }
  if (primary === "lively") {
    return ["lively", "buzzing", "energetic"];
  }
  if (primary === "cultured") {
    return ["thoughtful", "design forward", "local culture"];
  }
  if (primary === "chill") {
    return ["relaxed", "easygoing", "neighborhood"];
  }
  if (primary === "playful") {
    return ["fun", "playful", "social"];
  }
  if (primary === "adventurous-urban") {
    return ["local", "under the radar", "neighborhood"];
  }
  return ["scenic", "open air", "local"];
}
function buildLocationLabel(intent) {
  return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city;
}
function buildQueryText(kind, descriptors, locationLabel) {
  const phrase = unique5(descriptors).slice(0, 4).join(" ");
  return `${phrase} ${kind} in ${locationLabel}`.trim();
}
function buildLiveQueryPlan(intent, starterPack) {
  const locationLabel = buildLocationLabel(intent);
  const timeSignal = getTimeWindowSignal(intent);
  const personaTerms = getPersonaTerms(intent);
  const vibeTerms = getVibeTerms(intent);
  const starterPackTerms = pickStarterPackTerms(starterPack);
  const dateOrSocialTerms = intent.crew === "romantic" ? ["wine", "dessert"] : intent.crew === "socialite" ? ["cocktail", "group friendly"] : ["coffee", "daytime"];
  const startKind = timeSignal.phase === "morning" || timeSignal.phase === "afternoon" ? "cafe" : "restaurant";
  const highlightKind = timeSignal.phase === "late-night" || intent.primaryAnchor === "lively" || intent.crew === "socialite" ? "bar" : "restaurant";
  const windDownKind = timeSignal.phase === "late-night" ? "bar" : "cafe";
  const cultureKind = intent.primaryAnchor === "cultured" || intent.crew === "curator" ? "museum" : "activity";
  const strollKind = intent.primaryAnchor === "cozy" || intent.primaryAnchor === "chill" ? "park" : "activity";
  const plan = [
    {
      kind: startKind,
      roleHint: "start",
      label: "start-intent",
      template: "start-role-aware",
      queryTerms: unique5([
        "start",
        ...personaTerms.slice(0, 2),
        ...vibeTerms.slice(0, 2),
        ...startKind === "cafe" ? ["coffee", "brunch", "easy"] : ["lighter", "easy"],
        ...starterPackTerms.slice(0, 2)
      ]),
      notes: [
        `Start query favors easier openings for ${timeSignal.label}.`,
        startKind === "cafe" ? "Start query leans toward cafes and lighter coffee-led openings." : "Start query leans toward lighter restaurants with lower-friction entry."
      ],
      textQuery: ""
    },
    {
      kind: highlightKind,
      roleHint: "highlight",
      label: "highlight-intent",
      template: "highlight-role-aware",
      queryTerms: unique5([
        "highlight",
        ...personaTerms,
        ...vibeTerms,
        ...dateOrSocialTerms,
        ...highlightKind === "bar" ? ["cocktail", "stylish", "night"] : ["restaurant", "chef led", "intimate"],
        ...starterPackTerms
      ]),
      notes: [
        "Highlight query aims for anchor-grade restaurant/bar candidates.",
        highlightKind === "bar" ? "Highlight query emphasizes nightlife and social anchor strength." : "Highlight query emphasizes dinner and date-centered anchor strength."
      ],
      textQuery: ""
    },
    {
      kind: windDownKind,
      roleHint: "windDown",
      label: "wind-down-intent",
      template: "wind-down-role-aware",
      queryTerms: unique5([
        "wind down",
        "quiet",
        "conversation",
        ...windDownKind === "bar" ? ["wine", "nightcap"] : ["dessert", "tea", "coffee"],
        ...vibeTerms.slice(0, 2),
        ...starterPackTerms.slice(0, 2)
      ]),
      notes: [
        "Wind-down query favors calmer endings and softer support candidates.",
        windDownKind === "bar" ? "Wind-down query allows quieter bars or wine-forward nightcaps." : "Wind-down query favors cafes and dessert-adjacent soft landings."
      ],
      textQuery: ""
    },
    {
      kind: highlightKind,
      roleHint: "support",
      label: "neighborhood-broad",
      template: "context-broad",
      queryTerms: unique5([
        ...personaTerms.slice(0, 2),
        ...vibeTerms.slice(0, 2),
        "neighborhood",
        "local",
        ...starterPackTerms.slice(0, 1)
      ]),
      notes: ["Broad neighborhood query keeps a small fallback layer of context-matched live candidates."],
      textQuery: ""
    },
    {
      kind: cultureKind,
      roleHint: "support",
      label: "culture-discovery",
      template: "culture-support",
      queryTerms: unique5([
        "local",
        "cultural",
        "discovery",
        ...cultureKind === "museum" ? ["museum", "gallery", "historic"] : ["activity", "community", "art"],
        ...starterPackTerms.slice(0, 2)
      ]),
      notes: ["Culture support query expands retrieval into district-identity shaping venues."],
      textQuery: ""
    },
    {
      kind: strollKind,
      roleHint: "support",
      label: "walkable-support",
      template: "walkability-support",
      queryTerms: unique5([
        "walkable",
        "neighborhood",
        "local",
        ...strollKind === "park" ? ["park", "trail", "open air"] : ["plaza", "market", "district"],
        ...vibeTerms.slice(0, 1)
      ]),
      notes: ["Walkability support query broadens non-dining anchors for district sequencing."],
      textQuery: ""
    },
    {
      kind: "dessert",
      roleHint: "windDown",
      label: "dessert-winddown",
      template: "winddown-dessert",
      queryTerms: unique5([
        "dessert",
        "sweet",
        "shareable",
        "nightcap",
        ...vibeTerms.slice(0, 1)
      ]),
      notes: ["Dessert query provides softer end-of-route anchors when available."],
      textQuery: ""
    }
  ];
  const withText = plan.map((entry) => ({
    ...entry,
    textQuery: buildQueryText(entry.kind, entry.queryTerms, locationLabel)
  }));
  const deduped = /* @__PURE__ */ new Map();
  for (const entry of withText) {
    const key = `${entry.kind}:${entry.textQuery.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }
  return [...deduped.values()];
}

// src/domain/sources/getSourceMode.ts
function getProcessEnvValue(key) {
  const processEnv = globalThis.process?.env;
  return processEnv?.[key];
}
function getGooglePlacesConfig() {
  const env = import.meta.env ?? {};
  return {
    apiKey: env.VITE_GOOGLE_PLACES_API_KEY ?? getProcessEnvValue("VITE_GOOGLE_PLACES_API_KEY"),
    endpoint: env.VITE_GOOGLE_PLACES_ENDPOINT ?? getProcessEnvValue("VITE_GOOGLE_PLACES_ENDPOINT") ?? "https://places.googleapis.com/v1/places:searchText",
    languageCode: env.VITE_GOOGLE_PLACES_LANGUAGE_CODE ?? getProcessEnvValue("VITE_GOOGLE_PLACES_LANGUAGE_CODE") ?? "en",
    regionCode: env.VITE_GOOGLE_PLACES_REGION_CODE ?? getProcessEnvValue("VITE_GOOGLE_PLACES_REGION_CODE") ?? "US",
    pageSize: Number(
      env.VITE_GOOGLE_PLACES_PAGE_SIZE ?? getProcessEnvValue("VITE_GOOGLE_PLACES_PAGE_SIZE") ?? 8
    ),
    queryRadiusM: Number(
      env.VITE_GOOGLE_PLACES_QUERY_RADIUS_M ?? getProcessEnvValue("VITE_GOOGLE_PLACES_QUERY_RADIUS_M") ?? 3200
    ),
    centerOffsetM: Number(
      env.VITE_GOOGLE_PLACES_CENTER_OFFSET_M ?? getProcessEnvValue("VITE_GOOGLE_PLACES_CENTER_OFFSET_M") ?? 2400
    ),
    maxCenters: Number(
      env.VITE_GOOGLE_PLACES_MAX_CENTERS ?? getProcessEnvValue("VITE_GOOGLE_PLACES_MAX_CENTERS") ?? 3
    )
  };
}

// src/domain/sources/mapLivePlaceToRawPlace.ts
var ignoredTypes = /* @__PURE__ */ new Set([
  "food",
  "establishment",
  "point-of-interest",
  "store",
  "tourist-attraction"
]);
function normalizeValue5(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function unique6(values) {
  return [...new Set(values)];
}
function mapHoursPeriods(periods) {
  if (!periods || periods.length === 0) {
    return void 0;
  }
  return periods.map((period) => ({
    open: period.open?.day === void 0 || period.open.hour === void 0 || period.open.minute === void 0 ? void 0 : {
      day: period.open.day,
      hour: period.open.hour,
      minute: period.open.minute
    },
    close: period.close?.day === void 0 || period.close.hour === void 0 || period.close.minute === void 0 ? void 0 : {
      day: period.close.day,
      hour: period.close.hour,
      minute: period.close.minute
    }
  })).filter((period) => period.open || period.close);
}
function getNormalizedTypes(place) {
  return unique6(
    [place.primaryType, ...place.types ?? []].filter((value) => Boolean(value)).map(normalizeValue5).filter((value) => !ignoredTypes.has(value))
  );
}
function hasAny2(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}
function resolveCategory(placeTypes, requestedKind) {
  if (hasAny2(placeTypes, ["bar", "cocktail-bar", "wine-bar", "pub", "brewery", "sports-bar"])) {
    return "bar";
  }
  if (hasAny2(placeTypes, ["cafe", "coffee-shop", "tea-house", "espresso-bar"])) {
    return "cafe";
  }
  if (hasAny2(placeTypes, [
    "dessert-shop",
    "ice-cream-shop",
    "bakery",
    "pastry-shop",
    "chocolate-shop"
  ])) {
    return "dessert";
  }
  if (hasAny2(placeTypes, ["museum", "art-gallery", "history-museum", "science-museum"])) {
    return "museum";
  }
  if (hasAny2(placeTypes, [
    "park",
    "national-park",
    "dog-park",
    "garden",
    "botanical-garden",
    "hiking-area",
    "trailhead",
    "state-park"
  ])) {
    return "park";
  }
  if (hasAny2(placeTypes, ["event-venue", "concert-hall", "amphitheater", "performing-arts-theater"])) {
    return "event";
  }
  if (hasAny2(placeTypes, [
    "movie-theater",
    "bowling-alley",
    "mini-golf-course",
    "escape-room-center",
    "arcade",
    "tourist-attraction"
  ])) {
    return "activity";
  }
  if (hasAny2(placeTypes, ["restaurant", "brunch-restaurant", "fine-dining-restaurant"]) || placeTypes.some((type) => type.endsWith("-restaurant"))) {
    return "restaurant";
  }
  if (hasAny2(placeTypes, ["fast-food-restaurant", "meal-takeaway", "meal-delivery"])) {
    return "restaurant";
  }
  if (requestedKind === "dessert") {
    return "dessert";
  }
  if (requestedKind === "museum") {
    return "museum";
  }
  if (requestedKind === "park") {
    return "park";
  }
  if (requestedKind === "activity") {
    return "activity";
  }
  return requestedKind;
}
function getAddressComponent(components, candidates) {
  return components?.find(
    (component) => component.types?.some((type) => candidates.includes(normalizeValue5(type)))
  )?.longText;
}
function inferNeighborhood(place, fallback) {
  const fromComponents = getAddressComponent(place.addressComponents, ["neighborhood"]) ?? getAddressComponent(place.addressComponents, ["sublocality-level-1", "sublocality"]) ?? getAddressComponent(place.addressComponents, ["postal-town"]);
  if (fromComponents) {
    return fromComponents;
  }
  const address = place.shortFormattedAddress ?? place.formattedAddress;
  if (!address) {
    return fallback;
  }
  const firstSegment = address.split(",")[0]?.trim();
  return firstSegment && firstSegment.length >= 3 ? firstSegment : fallback;
}
function inferCity(place, fallback) {
  return getAddressComponent(place.addressComponents, ["locality"]) ?? getAddressComponent(place.addressComponents, ["administrative-area-level-2"]) ?? fallback;
}
function mapPriceTier(priceLevel) {
  if (priceLevel === "PRICE_LEVEL_FREE" || priceLevel === "PRICE_LEVEL_INEXPENSIVE") {
    return "$";
  }
  if (priceLevel === "PRICE_LEVEL_MODERATE") {
    return "$$";
  }
  if (priceLevel === "PRICE_LEVEL_EXPENSIVE") {
    return "$$$";
  }
  if (priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE") {
    return "$$$$";
  }
  return "$$";
}
function inferSummaryKeywords(summary) {
  const normalized = summary.toLowerCase();
  const matches = [];
  const keywordMap = [
    ["patio", "outdoor-seating"],
    ["rooftop", "rooftop"],
    ["cocktail", "cocktails"],
    ["wine", "wine"],
    ["coffee", "coffee"],
    ["espresso", "espresso-bar"],
    ["tea", "tea-house"],
    ["brunch", "brunch"],
    ["dessert", "dessert"],
    ["intimate", "intimate"],
    ["cozy", "cozy"],
    ["craft", "craft"],
    ["local", "local"],
    ["seasonal", "seasonal"],
    ["chef", "chef-led"],
    ["quiet", "quiet"],
    ["lively", "social"]
  ];
  for (const [needle, tag] of keywordMap) {
    if (normalized.includes(needle)) {
      matches.push(tag);
    }
  }
  return matches;
}
function inferTags(placeTypes, summary, requestedKind, queryTerms) {
  const tags = new Set(placeTypes);
  tags.add(requestedKind);
  for (const tag of inferSummaryKeywords(summary)) {
    tags.add(tag);
  }
  for (const tag of queryTerms) {
    tags.add(normalizeValue5(tag));
  }
  return [...tags].slice(0, 10);
}
function inferIsChain(name, placeTypes, ratingCount, tags) {
  if (hasAny2(placeTypes, ["fast-food-restaurant", "meal-takeaway", "meal-delivery"])) {
    return true;
  }
  if (/#\d+/.test(name)) {
    return true;
  }
  const strongLocalSignal = tags.some(
    (tag) => ["local", "artisan", "chef-led", "craft", "seasonal", "intimate"].includes(tag)
  );
  return ratingCount >= 1800 && !strongLocalSignal && name.trim().split(/\s+/).length <= 2;
}
function inferDriveMinutes(context, placeNeighborhood) {
  const rankPenalty = Math.min(context.rank, 5);
  const normalizedIntentNeighborhood = context.neighborhood ? normalizeValue5(context.neighborhood) : void 0;
  const normalizedPlaceNeighborhood = placeNeighborhood ? normalizeValue5(placeNeighborhood) : void 0;
  const sameNeighborhood = Boolean(normalizedIntentNeighborhood) && Boolean(normalizedPlaceNeighborhood) && normalizedIntentNeighborhood === normalizedPlaceNeighborhood;
  let base = 11;
  if (context.requestedKind === "bar") {
    base = 10;
  } else if (context.requestedKind === "restaurant") {
    base = 12;
  } else if (context.requestedKind === "cafe") {
    base = 9;
  } else if (context.requestedKind === "dessert") {
    base = 9;
  } else if (context.requestedKind === "park") {
    base = 13;
  } else if (context.requestedKind === "museum") {
    base = 12;
  } else if (context.requestedKind === "activity") {
    base = 11;
  }
  if (sameNeighborhood) {
    base -= 3;
  }
  if (!placeNeighborhood) {
    base += 2;
  }
  return Math.max(6, Math.min(22, base + rankPenalty * 2));
}
function buildShortDescription(category, summary) {
  if (summary) {
    return summary;
  }
  if (category === "bar") {
    return "Live place result with bar-forward social energy.";
  }
  if (category === "cafe") {
    return "Live place result suited to a softer coffee or cafe stop.";
  }
  if (category === "dessert") {
    return "Live place result suited to a softer dessert or sweet stop.";
  }
  if (category === "park") {
    return "Live place result that can support a walkable reset moment.";
  }
  if (category === "museum") {
    return "Live place result with culturally distinct discovery utility.";
  }
  if (category === "activity" || category === "event") {
    return "Live place result with activity or event momentum potential.";
  }
  return "Live place result that fits the current dining slice.";
}
function buildNarrativeFlavor(category, tags) {
  if (category === "bar") {
    return tags.includes("intimate") ? "A live-discovered bar with enough signal to support a focused social moment." : "A live-discovered bar that can supplement the current route without overpowering it.";
  }
  if (category === "cafe") {
    return "A live-discovered cafe that reads as a plausible opening or wind-down move.";
  }
  if (category === "dessert") {
    return "A live-discovered dessert lane that can land a route with softer pacing.";
  }
  if (category === "park") {
    return "A live-discovered park lane that improves reset and movement flow in sequence.";
  }
  if (category === "museum") {
    return "A live-discovered cultural venue with discovery-forward district value.";
  }
  if (category === "activity" || category === "event") {
    return "A live-discovered activity lane that can add momentum without dominating the route.";
  }
  return "A live-discovered restaurant with enough structured signal to enter the route pool safely.";
}
function inferSourceConfidence(place, tags, neighborhood, requestedKind) {
  const summaryPresent = Boolean(place.editorialSummary?.text);
  const rating = place.rating ?? 0;
  const ratingCount = place.userRatingCount ?? 0;
  const ratingCountScore = Math.min(ratingCount / 650, 1);
  const neighborhoodScore = neighborhood ? 0.08 : 0;
  const summaryScore = summaryPresent ? 0.12 : 0;
  const typeScore = Math.min(tags.length / 10, 1) * 0.14;
  const websiteScore = place.websiteUri ? 0.05 : 0;
  const hoursScore = (place.currentOpeningHours?.weekdayDescriptions?.length ?? 0) > 0 || (place.regularOpeningHours?.weekdayDescriptions?.length ?? 0) > 0 ? 0.05 : 0;
  const kindAlignmentScore = requestedKind && tags.includes(requestedKind) ? 0.03 : 0;
  return Number(
    Math.max(
      0.48,
      Math.min(
        0.94,
        0.5 + rating / 10 + ratingCountScore * 0.18 + neighborhoodScore + summaryScore + typeScore + websiteScore + hoursScore + kindAlignmentScore
      )
    ).toFixed(2)
  );
}
function mapLivePlaceToRawPlaceWithDiagnostics(place, context) {
  const name = place.displayName?.text?.trim();
  const placeId = place.id?.trim();
  if (!name) {
    return { dropReason: "missing_name" };
  }
  if (!placeId) {
    return { dropReason: "missing_place_id" };
  }
  const placeTypes = getNormalizedTypes(place);
  const category = resolveCategory(placeTypes, context.requestedKind);
  if (!category) {
    return { dropReason: "unsupported_category" };
  }
  const summary = place.editorialSummary?.text?.trim() ?? "";
  const neighborhood = inferNeighborhood(place, context.neighborhood);
  const city = inferCity(place, context.city);
  const tags = inferTags(placeTypes, summary, context.requestedKind, context.queryTerms);
  const ratingCount = place.userRatingCount ?? 0;
  const isChain = inferIsChain(name, placeTypes, ratingCount, tags);
  const sourceConfidence = inferSourceConfidence(place, tags, neighborhood, context.requestedKind);
  return {
    rawPlace: {
      rawType: "place",
      id: `live_google_${placeId}`,
      name,
      city,
      neighborhood: neighborhood ?? context.city,
      driveMinutes: inferDriveMinutes(context, neighborhood),
      priceTier: mapPriceTier(place.priceLevel),
      tags,
      shortDescription: buildShortDescription(category, summary),
      narrativeFlavor: buildNarrativeFlavor(category, tags),
      imageUrl: "",
      categoryHint: category,
      subcategoryHint: placeTypes[0] ?? context.requestedKind,
      placeTypes,
      sourceTypes: placeTypes,
      normalizedFromRawType: "raw-place",
      sourceOrigin: "live",
      provider: "google-places",
      providerRecordId: placeId,
      sourceQueryLabel: context.queryLabel,
      queryTerms: context.queryTerms,
      sourceConfidence,
      isChain,
      formattedAddress: place.formattedAddress,
      rating: place.rating,
      ratingCount,
      openNow: place.currentOpeningHours?.openNow,
      businessStatus: place.businessStatus,
      hoursPeriods: mapHoursPeriods(place.currentOpeningHours?.periods) ?? mapHoursPeriods(place.regularOpeningHours?.periods),
      currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
      regularOpeningHoursText: place.regularOpeningHours?.weekdayDescriptions,
      utcOffsetMinutes: place.utcOffsetMinutes,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude
    }
  };
}

// src/domain/sources/fetchLivePlaces.ts
var googleFieldMask = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.types",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.addressComponents",
  "places.editorialSummary",
  "places.businessStatus",
  "places.currentOpeningHours.openNow",
  "places.currentOpeningHours.weekdayDescriptions",
  "places.currentOpeningHours.periods",
  "places.priceLevel",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.regularOpeningHours.periods",
  "places.rating",
  "places.userRatingCount",
  "places.utcOffsetMinutes",
  "places.websiteUri",
  "places.location"
].join(",");
var KNOWN_CITY_CENTERS = {
  "san jose": { lat: 37.3382, lng: -121.8863 },
  denver: { lat: 39.7392, lng: -104.9903 },
  austin: { lat: 30.2672, lng: -97.7431 }
};
function normalizeCity(value) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).replace(/\s+/g, " ").trim();
}
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function hashToUnit(value) {
  return hashString(value) / 4294967295;
}
function getCityCenter(city) {
  const cityKey = normalizeCity(city);
  const known = KNOWN_CITY_CENTERS[cityKey];
  if (known) {
    return known;
  }
  const lat = 30.5 + hashToUnit(`${cityKey}:lat`) * 11.5;
  const lng = -121.5 + hashToUnit(`${cityKey}:lng`) * 23.5;
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}
function metersToLatDegrees(meters) {
  return meters / 111320;
}
function metersToLngDegrees(meters, latitude) {
  const latRadians = latitude * Math.PI / 180;
  const metersPerDegree = 111320 * Math.max(0.2, Math.cos(latRadians));
  return meters / metersPerDegree;
}
function deriveQueryCenters(city, maxCenters, offsetM) {
  const center = getCityCenter(city);
  const latOffset = metersToLatDegrees(offsetM);
  const lngOffset = metersToLngDegrees(offsetM, center.lat);
  const allCenters = [
    {
      id: "core",
      lat: Number(center.lat.toFixed(5)),
      lng: Number(center.lng.toFixed(5))
    },
    {
      id: "north",
      lat: Number((center.lat + latOffset).toFixed(5)),
      lng: Number(center.lng.toFixed(5))
    },
    {
      id: "east",
      lat: Number(center.lat.toFixed(5)),
      lng: Number((center.lng + lngOffset).toFixed(5))
    },
    {
      id: "south",
      lat: Number((center.lat - latOffset).toFixed(5)),
      lng: Number(center.lng.toFixed(5))
    },
    {
      id: "west",
      lat: Number(center.lat.toFixed(5)),
      lng: Number((center.lng - lngOffset).toFixed(5))
    }
  ];
  return allCenters.slice(0, Math.max(1, Math.min(5, maxCenters)));
}
async function runQueryPlanInBatches(queryPlan) {
  const settled = [];
  const batchSize = 6;
  for (let index = 0; index < queryPlan.length; index += batchSize) {
    const batch = queryPlan.slice(index, index + batchSize);
    const batchSettled = await Promise.allSettled(
      batch.map(async (query) => ({
        query,
        places: await queryGooglePlacesTextSearch({
          kind: query.kind,
          textQuery: query.textQuery,
          center: query.center,
          radiusM: query.radiusM
        })
      }))
    );
    settled.push(...batchSettled);
  }
  return settled;
}
function countByGateStatus(venues, status) {
  return venues.filter((venue) => venue.source.qualityGateStatus === status).length;
}
function emptyMapDropReasons() {
  return {
    missing_name: 0,
    missing_place_id: 0,
    unsupported_category: 0
  };
}
function incrementBucket(counter, key) {
  counter[key] = (counter[key] ?? 0) + 1;
}
function formatLocationLabel(intent) {
  return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city;
}
async function queryGooglePlacesTextSearch(query) {
  const config = getGooglePlacesConfig();
  if (!config.apiKey) {
    throw new Error("Missing VITE_GOOGLE_PLACES_API_KEY.");
  }
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.apiKey,
      "X-Goog-FieldMask": googleFieldMask
    },
    body: JSON.stringify({
      textQuery: query.textQuery,
      pageSize: config.pageSize,
      languageCode: config.languageCode,
      regionCode: config.regionCode,
      rankPreference: "RELEVANCE",
      locationBias: {
        circle: {
          center: {
            latitude: query.center.lat,
            longitude: query.center.lng
          },
          radius: query.radiusM
        }
      }
    })
  });
  if (!response.ok) {
    throw new Error(`${query.kind} query failed (${response.status})`);
  }
  const payload = await response.json();
  return (payload.places ?? []).filter(
    (place) => place.businessStatus !== "CLOSED_PERMANENTLY"
  );
}
function gateStatusRank(status) {
  if (status === "approved") {
    return 3;
  }
  if (status === "demoted") {
    return 2;
  }
  return 1;
}
function compareVenueQuality(left, right) {
  const gateDelta = gateStatusRank(left.source.qualityGateStatus) - gateStatusRank(right.source.qualityGateStatus);
  if (gateDelta !== 0) {
    return gateDelta;
  }
  if (left.source.qualityScore !== right.source.qualityScore) {
    return left.source.qualityScore - right.source.qualityScore;
  }
  if (left.source.sourceConfidence !== right.source.sourceConfidence) {
    return left.source.sourceConfidence - right.source.sourceConfidence;
  }
  if (left.source.completenessScore !== right.source.completenessScore) {
    return left.source.completenessScore - right.source.completenessScore;
  }
  return right.id.localeCompare(left.id);
}
function dedupeByPlaceId(venues) {
  const bestByKey = /* @__PURE__ */ new Map();
  for (const venue of venues) {
    const key = venue.source.providerRecordId ?? `${normalizeCity(venue.city)}|${venue.name.trim().toLowerCase()}|${venue.category}`;
    const existing = bestByKey.get(key);
    if (!existing || compareVenueQuality(venue, existing) > 0) {
      bestByKey.set(key, venue);
    }
  }
  const deduped = [...bestByKey.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    venues: deduped,
    dropped: Math.max(0, venues.length - deduped.length)
  };
}
function normalizeRawPlaces(rawPlaces, intent) {
  const timeWindowSignal = getTimeWindowSignal(intent);
  const venues = [];
  let droppedCount = 0;
  const droppedReasons = {};
  for (const rawPlace of rawPlaces) {
    try {
      venues.push(
        normalizeVenue(rawPlace, {
          timeWindowSignal
        })
      );
    } catch (error) {
      droppedCount += 1;
      const reason = error instanceof Error && error.message ? `normalize_error:${error.message.split(":")[0]}` : "normalize_error:unknown";
      incrementBucket(droppedReasons, reason);
    }
  }
  return {
    venues,
    droppedCount,
    droppedReasons
  };
}
function countSuppressionReasons(venues) {
  const reasons = {};
  for (const venue of venues) {
    if (venue.source.qualityGateStatus !== "suppressed") {
      continue;
    }
    if (venue.source.suppressionReasons.length === 0) {
      incrementBucket(reasons, "suppressed_without_reason");
      continue;
    }
    for (const reason of venue.source.suppressionReasons) {
      incrementBucket(reasons, reason);
    }
  }
  return reasons;
}
async function fetchLivePlaces(intent, starterPack) {
  const config = getGooglePlacesConfig();
  const queryLocationLabel = formatLocationLabel(intent);
  const baseQueryPlan = buildLiveQueryPlan(intent, starterPack);
  const queryCenters = deriveQueryCenters(intent.city, config.maxCenters, config.centerOffsetM);
  const queryPlan = baseQueryPlan.flatMap(
    (entry) => queryCenters.map((center) => ({
      ...entry,
      label: `${entry.label}@${center.id}`,
      center,
      radiusM: config.queryRadiusM
    }))
  );
  const queryTemplatesUsed = [...new Set(queryPlan.map((entry) => entry.template))];
  const queryLabelsUsed = queryPlan.map((entry) => entry.label);
  const roleIntentQueryNotes = [...new Set(baseQueryPlan.flatMap((entry) => entry.notes))];
  const requestedKindsForPlan = [...new Set(baseQueryPlan.map((entry) => entry.kind))];
  if (!config.apiKey) {
    return {
      venues: [],
      diagnostics: {
        attempted: false,
        provider: "google-places",
        queryLocationLabel,
        queryCentersCount: queryCenters.length,
        queryCentersUsed: queryCenters,
        queryRadiusM: config.queryRadiusM,
        requestedKinds: requestedKindsForPlan,
        queryCount: 0,
        liveQueryTemplatesUsed: queryTemplatesUsed,
        liveQueryLabelsUsed: queryLabelsUsed,
        liveCandidatesByQuery: [],
        liveRoleIntentQueryNotes: roleIntentQueryNotes,
        fetchedCount: 0,
        rawFetchedCount: 0,
        mappedCount: 0,
        mappedDroppedCount: 0,
        mappedDropReasons: emptyMapDropReasons(),
        normalizedCount: 0,
        dedupedByPlaceIdCount: 0,
        normalizationDroppedCount: 0,
        normalizationDropReasons: {},
        acceptedCount: 0,
        acceptanceDroppedCount: 0,
        acceptanceDropReasons: {},
        approvedCount: 0,
        demotedCount: 0,
        suppressedCount: 0,
        partialFailure: false,
        success: false,
        failureReason: "Live adapter disabled because the Google Places API key is missing.",
        errors: []
      }
    };
  }
  const settled = await runQueryPlanInBatches(queryPlan);
  const errors = [];
  let fetchedCount = 0;
  const rawPlaces = [];
  const fetchedCountByQuery = /* @__PURE__ */ new Map();
  const mappedDropReasons = emptyMapDropReasons();
  let mappedDroppedCount = 0;
  for (const result of settled) {
    if (result.status === "rejected") {
      errors.push(result.reason instanceof Error ? result.reason.message : "Unknown live source failure");
      continue;
    }
    const { query, places } = result.value;
    fetchedCount += places.length;
    fetchedCountByQuery.set(query.label, places.length);
    places.forEach((place, index) => {
      const mapped = mapLivePlaceToRawPlaceWithDiagnostics(place, {
        city: intent.city,
        neighborhood: intent.neighborhood,
        requestedKind: query.kind,
        queryLabel: query.label,
        queryTerms: query.queryTerms,
        rank: index
      });
      if (mapped.rawPlace) {
        rawPlaces.push(mapped.rawPlace);
      } else if (mapped.dropReason) {
        mappedDroppedCount += 1;
        mappedDropReasons[mapped.dropReason] = (mappedDropReasons[mapped.dropReason] ?? 0) + 1;
      }
    });
  }
  const normalized = normalizeRawPlaces(rawPlaces, intent);
  const deduped = dedupeByPlaceId(normalized.venues);
  const venues = deduped.venues;
  const successfulQueries = settled.filter((entry) => entry.status === "fulfilled").length;
  const liveCandidatesByQuery = queryPlan.map((query) => {
    const mapped = rawPlaces.filter((rawPlace) => rawPlace.sourceQueryLabel === query.label);
    const normalizedForQuery = normalized.venues.filter(
      (venue) => venue.source.sourceQueryLabel === query.label
    );
    return {
      label: query.label,
      template: query.template,
      roleHint: query.roleHint,
      fetchedCount: fetchedCountByQuery.get(query.label) ?? 0,
      mappedCount: mapped.length,
      normalizedCount: normalizedForQuery.length,
      approvedCount: countByGateStatus(normalizedForQuery, "approved"),
      demotedCount: countByGateStatus(normalizedForQuery, "demoted"),
      suppressedCount: countByGateStatus(normalizedForQuery, "suppressed")
    };
  });
  return {
    venues,
    diagnostics: {
      attempted: true,
      provider: "google-places",
      queryLocationLabel,
      queryCentersCount: queryCenters.length,
      queryCentersUsed: queryCenters,
      queryRadiusM: config.queryRadiusM,
      requestedKinds: requestedKindsForPlan,
      queryCount: queryPlan.length,
      liveQueryTemplatesUsed: queryTemplatesUsed,
      liveQueryLabelsUsed: queryLabelsUsed,
      liveCandidatesByQuery,
      liveRoleIntentQueryNotes: roleIntentQueryNotes,
      fetchedCount,
      rawFetchedCount: fetchedCount,
      mappedCount: rawPlaces.length,
      mappedDroppedCount,
      mappedDropReasons,
      normalizedCount: venues.length,
      dedupedByPlaceIdCount: deduped.dropped,
      normalizationDroppedCount: normalized.droppedCount,
      normalizationDropReasons: normalized.droppedReasons,
      acceptedCount: venues.length - countByGateStatus(venues, "suppressed"),
      acceptanceDroppedCount: countByGateStatus(venues, "suppressed"),
      acceptanceDropReasons: countSuppressionReasons(venues),
      approvedCount: countByGateStatus(venues, "approved"),
      demotedCount: countByGateStatus(venues, "demoted"),
      suppressedCount: countByGateStatus(venues, "suppressed"),
      partialFailure: errors.length > 0 && successfulQueries > 0,
      success: successfulQueries > 0,
      failureReason: successfulQueries === 0 && errors.length > 0 ? errors[0] : void 0,
      errors
    }
  };
}

// src/domain/retrieval/hybridPortableAdapter.ts
var PORTABLE_SEEDS = [
  {
    idSuffix: "central-coffee-hall",
    name: "Central Coffee Hall",
    neighborhoodSuffix: "Central District",
    category: "cafe",
    driveMinutes: 8,
    tags: ["coffee", "warmup", "walkable", "conversation"],
    priceTier: "$$",
    description: "Coffee-forward start point with a calm social tone.",
    narrative: "Portable warmup anchor with low-friction pacing."
  },
  {
    idSuffix: "central-kitchen",
    name: "Central Kitchen",
    neighborhoodSuffix: "Central District",
    category: "restaurant",
    driveMinutes: 9,
    tags: ["dining", "chef-led", "conversation", "neighborhood"],
    priceTier: "$$$",
    description: "Balanced dining anchor with broad route utility.",
    narrative: "Reliable centerpiece dining lane for mixed intents."
  },
  {
    idSuffix: "central-social-club",
    name: "Central Social Club",
    neighborhoodSuffix: "Central District",
    category: "bar",
    driveMinutes: 9,
    tags: ["cocktails", "social", "highlight", "night"],
    priceTier: "$$",
    description: "Social bar anchor with moderate highlight energy.",
    narrative: "Portable momentum bump for lively arcs."
  },
  {
    idSuffix: "central-market-court",
    name: "Central Market Court",
    neighborhoodSuffix: "Central District",
    category: "event",
    driveMinutes: 8,
    tags: ["market", "event", "movement", "walkable"],
    priceTier: "$$",
    description: "Market-style support lane with flexible timing.",
    narrative: "Compact event node for layered sequences."
  },
  {
    idSuffix: "central-arcade-hub",
    name: "Central Arcade Hub",
    neighborhoodSuffix: "Central District",
    category: "activity",
    driveMinutes: 9,
    tags: ["activity", "playful", "group-friendly", "discovery"],
    priceTier: "$$",
    description: "Interactive activity support stop for social groups.",
    narrative: "High-energy optional lane for highlight-adjacent movement."
  },
  {
    idSuffix: "arts-craft-cafe",
    name: "Craft District Cafe",
    neighborhoodSuffix: "Arts District",
    category: "cafe",
    driveMinutes: 11,
    tags: ["coffee", "curated", "low-noise", "linger"],
    priceTier: "$$",
    description: "Arts-side cafe with calmer warmup utility.",
    narrative: "Discovery-friendly opening in the cultural lane."
  },
  {
    idSuffix: "arts-gallery-walk",
    name: "Gallery Walk",
    neighborhoodSuffix: "Arts District",
    category: "activity",
    driveMinutes: 11,
    tags: ["gallery", "discovery", "movement", "cultural-flow"],
    priceTier: "$",
    description: "Walkable gallery corridor with strong cultural signal.",
    narrative: "Cultural discovery connector with low-friction movement."
  },
  {
    idSuffix: "arts-museum-house",
    name: "City Arts House",
    neighborhoodSuffix: "Arts District",
    category: "museum",
    driveMinutes: 12,
    tags: ["museum", "cultural-anchor", "historic", "curated"],
    priceTier: "$$",
    description: "Cultural anchor with slower pacing and discovery depth.",
    narrative: "Portable culture authority for curator/family intents."
  },
  {
    idSuffix: "arts-wine-room",
    name: "Arts Wine Room",
    neighborhoodSuffix: "Arts District",
    category: "bar",
    driveMinutes: 11,
    tags: ["wine", "intimate", "conversation", "slow"],
    priceTier: "$$$",
    description: "Low-noise wine bar with winddown utility.",
    narrative: "Softer highlight option for romantic/cultured arcs."
  },
  {
    idSuffix: "arts-bistro",
    name: "Arts Bistro",
    neighborhoodSuffix: "Arts District",
    category: "restaurant",
    driveMinutes: 12,
    tags: ["dining", "local", "cozy", "curated"],
    priceTier: "$$",
    description: "Neighborhood bistro with approachable cultural tone.",
    narrative: "Supportive dining anchor in arts-forward pockets."
  },
  {
    idSuffix: "riverfront-trail-cafe",
    name: "Riverfront Trail Cafe",
    neighborhoodSuffix: "Riverfront",
    category: "cafe",
    driveMinutes: 13,
    tags: ["coffee", "open-air", "walkable", "reset"],
    priceTier: "$$",
    description: "Open-air cafe for start or reset transitions.",
    narrative: "Outdoors-leaning starter lane near stroll routes."
  },
  {
    idSuffix: "riverfront-park-loop",
    name: "Riverfront Park Loop",
    neighborhoodSuffix: "Riverfront",
    category: "park",
    driveMinutes: 13,
    tags: ["park", "stroll", "reset", "open-air"],
    priceTier: "$",
    description: "Scenic reset route with strong cooldown usefulness.",
    narrative: "Winddown lane that improves sequence quality."
  },
  {
    idSuffix: "riverfront-food-hall",
    name: "Riverfront Food Hall",
    neighborhoodSuffix: "Riverfront",
    category: "event",
    driveMinutes: 14,
    tags: ["food-hall", "social", "event", "variety"],
    priceTier: "$$",
    description: "Flexible social node with broad dining variety.",
    narrative: "Event-like support lane for friends/family groups."
  },
  {
    idSuffix: "riverfront-dining-room",
    name: "Riverfront Dining Room",
    neighborhoodSuffix: "Riverfront",
    category: "restaurant",
    driveMinutes: 14,
    tags: ["dining", "conversation", "neighborhood", "highlight"],
    priceTier: "$$$",
    description: "Steady dining anchor with medium-intensity pace.",
    narrative: "Adaptable center point for mixed route shapes."
  },
  {
    idSuffix: "riverfront-gelato-house",
    name: "Riverfront Gelato House",
    neighborhoodSuffix: "Riverfront",
    category: "dessert",
    driveMinutes: 13,
    tags: ["dessert", "shareable", "cooldown", "walkable"],
    priceTier: "$$",
    description: "Dessert lane with strong winddown compatibility.",
    narrative: "Soft landing option that improves end-role fit."
  },
  {
    idSuffix: "neighborhood-bakery-cafe",
    name: "Neighborhood Bakery Cafe",
    neighborhoodSuffix: "Neighborhood Core",
    category: "cafe",
    driveMinutes: 10,
    tags: ["bakery", "coffee", "cozy", "low-noise"],
    priceTier: "$$",
    description: "Cozy bakery cafe with low-friction start utility.",
    narrative: "Soft neighborhood entry for cozy/family arcs."
  },
  {
    idSuffix: "neighborhood-dinner-house",
    name: "Neighborhood Dinner House",
    neighborhoodSuffix: "Neighborhood Core",
    category: "restaurant",
    driveMinutes: 10,
    tags: ["dining", "conversation", "family-friendly", "local"],
    priceTier: "$$",
    description: "Approachable dining anchor with broad usefulness.",
    narrative: "Comfortable core dining lane with stable pacing."
  },
  {
    idSuffix: "neighborhood-green-park",
    name: "Neighborhood Green Park",
    neighborhoodSuffix: "Neighborhood Core",
    category: "park",
    driveMinutes: 10,
    tags: ["park", "reset", "open-air", "family-friendly"],
    priceTier: "$",
    description: "Calmer open-air support venue for transitions.",
    narrative: "Reset anchor for softer sequence movement."
  },
  {
    idSuffix: "neighborhood-dessert-kitchen",
    name: "Neighborhood Dessert Kitchen",
    neighborhoodSuffix: "Neighborhood Core",
    category: "dessert",
    driveMinutes: 10,
    tags: ["dessert", "cozy", "shareable", "cooldown"],
    priceTier: "$$",
    description: "Dessert support lane for romantic/family winddowns.",
    narrative: "Reliable gentle finish lane in residential pockets."
  },
  {
    idSuffix: "neighborhood-listening-bar",
    name: "Neighborhood Listening Bar",
    neighborhoodSuffix: "Neighborhood Core",
    category: "bar",
    driveMinutes: 11,
    tags: ["listening", "intimate", "conversation", "night"],
    priceTier: "$$",
    description: "Lower-noise social option for smaller groups.",
    narrative: "Conversation-forward highlight for softer nights."
  }
];
function normalizeCity2(value) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).replace(/\s+/g, " ").trim();
}
var KNOWN_CITY_CENTERS2 = {
  "san jose": { lat: 37.3382, lng: -121.8863 },
  denver: { lat: 39.7392, lng: -104.9903 },
  austin: { lat: 30.2672, lng: -97.7431 }
};
function toTitleCase(value) {
  return value.split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function hashString2(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function hashToUnit2(value) {
  return hashString2(value) / 4294967295;
}
function getCityCenter2(city) {
  const key = normalizeCity2(city);
  const known = KNOWN_CITY_CENTERS2[key];
  if (known) {
    return known;
  }
  return {
    lat: Number((30.5 + hashToUnit2(`${key}:lat`) * 11.5).toFixed(4)),
    lng: Number((-121.5 + hashToUnit2(`${key}:lng`) * 23.5).toFixed(4))
  };
}
function gateStatusRank2(status) {
  if (status === "approved") {
    return 3;
  }
  if (status === "demoted") {
    return 2;
  }
  return 1;
}
function compareVenueQuality2(left, right) {
  const gateDelta = gateStatusRank2(left.source.qualityGateStatus) - gateStatusRank2(right.source.qualityGateStatus);
  if (gateDelta !== 0) {
    return gateDelta;
  }
  if (left.source.qualityScore !== right.source.qualityScore) {
    return left.source.qualityScore - right.source.qualityScore;
  }
  if (left.source.sourceConfidence !== right.source.sourceConfidence) {
    return left.source.sourceConfidence - right.source.sourceConfidence;
  }
  if (left.source.completenessScore !== right.source.completenessScore) {
    return left.source.completenessScore - right.source.completenessScore;
  }
  return right.id.localeCompare(left.id);
}
function sortByQuality(venues) {
  return [...venues].sort((left, right) => {
    const qualityDelta = compareVenueQuality2(right, left);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    return left.id.localeCompare(right.id);
  });
}
function dedupeVenues(venues) {
  const bestByKey = /* @__PURE__ */ new Map();
  for (const venue of venues) {
    const key = venue.source.providerRecordId ?? `${normalizeCity2(venue.city)}|${slugify(venue.name)}|${slugify(venue.neighborhood)}|${venue.category}`;
    const existing = bestByKey.get(key);
    if (!existing || compareVenueQuality2(venue, existing) > 0) {
      bestByKey.set(key, venue);
    }
  }
  return sortByQuality([...bestByKey.values()]);
}
function mergeReasonCounts(current, incoming) {
  const merged = { ...current };
  for (const [reason, count] of Object.entries(incoming)) {
    merged[reason] = (merged[reason] ?? 0) + count;
  }
  return merged;
}
function clamp019(value) {
  return Math.max(0, Math.min(1, value));
}
function getGeoBucketKey(venue) {
  const latitude = venue.source.latitude;
  const longitude = venue.source.longitude;
  if (typeof latitude === "number" && typeof longitude === "number") {
    const latBucket = Math.round(latitude / 0.018);
    const lngBucket = Math.round(longitude / 0.018);
    return `grid:${latBucket}:${lngBucket}`;
  }
  const neighborhoodKey = slugify(venue.neighborhood);
  if (neighborhoodKey) {
    return `nbh:${neighborhoodKey}`;
  }
  return "unknown";
}
function summarizeGeoSpread(venues) {
  const bucketMap = /* @__PURE__ */ new Map();
  for (const venue of venues) {
    const key = getGeoBucketKey(venue);
    const entries = bucketMap.get(key) ?? [];
    entries.push(venue);
    bucketMap.set(key, entries);
  }
  const bucketCount = bucketMap.size;
  const total = venues.length;
  const dominantEntry = [...bucketMap.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }
    return left[0].localeCompare(right[0]);
  })[0];
  const dominantCount = dominantEntry?.[1].length ?? 0;
  const dominantAreaShare = total > 0 ? Number((dominantCount / total).toFixed(3)) : 0;
  const bucketComponent = clamp019((bucketCount - 1) / 4);
  const balanceComponent = clamp019(1 - dominantAreaShare);
  const geoSpreadScore = Number((bucketComponent * 0.6 + balanceComponent * 0.4).toFixed(3));
  return {
    geoBucketCount: bucketCount,
    dominantAreaShare,
    geoSpreadScore,
    dominantBucketKey: dominantEntry?.[0],
    bucketMap
  };
}
function applyGeoDiversityShaping(venues) {
  const summary = summarizeGeoSpread(venues);
  if (venues.length < 10 || summary.geoBucketCount < 2 || summary.dominantAreaShare <= 0.5) {
    return {
      venues,
      geoBucketCount: summary.geoBucketCount,
      dominantAreaShare: summary.dominantAreaShare,
      geoSpreadScore: summary.geoSpreadScore,
      downsampledCount: 0,
      notes: []
    };
  }
  const dominantBucketKey = summary.dominantBucketKey;
  if (!dominantBucketKey) {
    return {
      venues,
      geoBucketCount: summary.geoBucketCount,
      dominantAreaShare: summary.dominantAreaShare,
      geoSpreadScore: summary.geoSpreadScore,
      downsampledCount: 0,
      notes: []
    };
  }
  const dominantBucket = sortByQuality(summary.bucketMap.get(dominantBucketKey) ?? []);
  const nonDominant = sortByQuality(
    [...summary.bucketMap.entries()].filter(([key]) => key !== dominantBucketKey).flatMap(([, bucketVenues]) => bucketVenues)
  );
  const total = venues.length;
  const dominantCap = Math.max(6, Math.ceil(total * 0.55));
  if (dominantBucket.length <= dominantCap) {
    return {
      venues,
      geoBucketCount: summary.geoBucketCount,
      dominantAreaShare: summary.dominantAreaShare,
      geoSpreadScore: summary.geoSpreadScore,
      downsampledCount: 0,
      notes: []
    };
  }
  const trimmedDominant = dominantBucket.slice(0, dominantCap);
  const shaped = sortByQuality([...trimmedDominant, ...nonDominant]);
  const shapedSummary = summarizeGeoSpread(shaped);
  return {
    venues: shaped,
    geoBucketCount: shapedSummary.geoBucketCount,
    dominantAreaShare: shapedSummary.dominantAreaShare,
    geoSpreadScore: shapedSummary.geoSpreadScore,
    downsampledCount: dominantBucket.length - trimmedDominant.length,
    notes: [
      `Geo diversity shaping trimmed ${dominantBucket.length - trimmedDominant.length} dominant-area venues to improve bucket balance.`
    ]
  };
}
function selectGeoBalancedVenues(venues, maxCount) {
  if (venues.length <= maxCount) {
    return venues;
  }
  const bucketMap = /* @__PURE__ */ new Map();
  for (const venue of sortByQuality(venues)) {
    const key = getGeoBucketKey(venue);
    const entries = bucketMap.get(key) ?? [];
    entries.push(venue);
    bucketMap.set(key, entries);
  }
  const bucketOrder = [...bucketMap.entries()].sort((left, right) => {
    const leftHead = left[1][0];
    const rightHead = right[1][0];
    if (leftHead && rightHead) {
      const qualityDelta = compareVenueQuality2(rightHead, leftHead);
      if (qualityDelta !== 0) {
        return qualityDelta;
      }
    }
    return left[0].localeCompare(right[0]);
  }).map(([key]) => key);
  const selected = [];
  while (selected.length < maxCount) {
    let advanced = false;
    for (const bucketKey of bucketOrder) {
      const entries = bucketMap.get(bucketKey);
      if (!entries || entries.length === 0) {
        continue;
      }
      const nextVenue = entries.shift();
      if (!nextVenue) {
        continue;
      }
      selected.push(nextVenue);
      advanced = true;
      if (selected.length >= maxCount) {
        break;
      }
    }
    if (!advanced) {
      break;
    }
  }
  return sortByQuality(selected);
}
function projectNeighborhoodByGeoArea(venues, city) {
  const cityCenter = getCityCenter2(city);
  return venues.map((venue) => {
    const latitude = venue.source.latitude;
    const longitude = venue.source.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return venue;
    }
    const latDelta = latitude - cityCenter.lat;
    const lngDelta = longitude - cityCenter.lng;
    const absLat = Math.abs(latDelta);
    const absLng = Math.abs(lngDelta);
    let areaLabel = "Central";
    if (absLat > 0.012 || absLng > 0.012) {
      areaLabel = absLat >= absLng ? latDelta >= 0 ? "North" : "South" : lngDelta >= 0 ? "East" : "West";
    }
    return {
      ...venue,
      neighborhood: `${toTitleCase(normalizeCity2(city) || city)} ${areaLabel} District`
    };
  });
}
function buildIntent(city, primaryAnchor, crew) {
  return {
    crew,
    primaryAnchor,
    city,
    distanceMode: "short-drive",
    prefersHiddenGems: primaryAnchor === "cultured" || primaryAnchor === "adventurous-urban",
    mode: "build",
    planningMode: "engine-led"
  };
}
function buildPortableBootstrapVenues(city) {
  const cityLabel = toTitleCase(normalizeCity2(city) || city);
  const citySlug = slugify(cityLabel || "portable-city");
  return PORTABLE_SEEDS.map(
    (seed) => normalizeVenue({
      rawType: "place",
      id: `hybrid_${citySlug}_${seed.idSuffix}`,
      name: `${cityLabel} ${seed.name}`,
      city: cityLabel,
      neighborhood: `${cityLabel} ${seed.neighborhoodSuffix}`,
      driveMinutes: seed.driveMinutes,
      priceTier: seed.priceTier,
      tags: [...seed.tags, "portable-bootstrap", "hybrid"],
      shortDescription: seed.description,
      narrativeFlavor: seed.narrative,
      categoryHint: seed.category,
      subcategoryHint: seed.tags[0] ?? seed.category,
      placeTypes: [seed.category, ...seed.tags.slice(0, 2)],
      sourceTypes: [seed.category, "portable-bootstrap"],
      normalizedFromRawType: "raw-place",
      sourceOrigin: "live",
      sourceQueryLabel: "portable-bootstrap",
      sourceConfidence: 0.62,
      isChain: false,
      isHiddenGem: true,
      uniquenessScore: 0.72,
      distinctivenessScore: 0.74,
      underexposureScore: 0.73,
      shareabilityScore: 0.7,
      vibeTags: ["culture", "creative", "relaxed"]
    })
  );
}
async function fetchHybridPortableVenues(city) {
  const normalizedCity = toTitleCase(normalizeCity2(city) || city);
  if (!normalizedCity) {
    return {
      venues: [],
      diagnostics: {
        mode: "none",
        city,
        liveAttempted: false,
        liveSucceeded: false,
        liveRawFetched: 0,
        liveMapped: 0,
        liveMappedDropped: 0,
        liveMapDropReasons: {},
        liveNormalized: 0,
        liveNormalizationDropped: 0,
        liveNormalizationDropReasons: {},
        liveAcceptedPreGeo: 0,
        liveAccepted: 0,
        liveSuppressed: 0,
        liveSuppressionReasons: {},
        geoBucketCount: 0,
        dominantAreaShare: 0,
        geoSpreadScore: 0,
        geoDiversityDownsampledCount: 0,
        bootstrapCount: 0,
        selectedCount: 0,
        notes: ["No city provided for hybrid retrieval."]
      }
    };
  }
  const liveIntents = [
    buildIntent(normalizedCity, "cozy", "romantic"),
    buildIntent(normalizedCity, "lively", "socialite"),
    buildIntent(normalizedCity, "cultured", "curator")
  ];
  const liveResults = await Promise.all(liveIntents.map((intent) => fetchLivePlaces(intent)));
  const liveAcceptedBeforeDedupe = liveResults.flatMap((entry) => entry.venues).filter((venue) => venue.source.qualityGateStatus !== "suppressed");
  const liveSuppressedBeforeDedupe = liveResults.flatMap((entry) => entry.venues).filter((venue) => venue.source.qualityGateStatus === "suppressed");
  const liveVenuesDeduped = dedupeVenues(
    liveAcceptedBeforeDedupe
  );
  const geoShapedLiveVenues = applyGeoDiversityShaping(liveVenuesDeduped);
  const liveVenues = geoShapedLiveVenues.venues;
  const liveRawFetched = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.rawFetchedCount,
    0
  );
  const liveMapped = liveResults.reduce((sum, entry) => sum + entry.diagnostics.mappedCount, 0);
  const liveMappedDropped = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.mappedDroppedCount,
    0
  );
  const liveMapDropReasons = liveResults.reduce(
    (merged2, entry) => mergeReasonCounts(merged2, entry.diagnostics.mappedDropReasons),
    {}
  );
  const liveNormalized = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.normalizedCount,
    0
  );
  const liveNormalizationDropped = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.normalizationDroppedCount,
    0
  );
  const liveNormalizationDropReasons = liveResults.reduce(
    (merged2, entry) => mergeReasonCounts(merged2, entry.diagnostics.normalizationDropReasons),
    {}
  );
  const liveSuppressionReasons = liveResults.reduce(
    (merged2, entry) => mergeReasonCounts(merged2, entry.diagnostics.acceptanceDropReasons),
    {}
  );
  const liveAttempted = liveResults.some((entry) => entry.diagnostics.attempted);
  const liveSucceeded = liveResults.some((entry) => entry.diagnostics.success);
  const dedupeDropped = liveAcceptedBeforeDedupe.length - liveVenuesDeduped.length;
  if (liveVenues.length >= 12) {
    const selectedLiveVenues = projectNeighborhoodByGeoArea(
      selectGeoBalancedVenues(liveVenues, 32),
      normalizedCity
    );
    return {
      venues: selectedLiveVenues,
      diagnostics: {
        mode: "hybrid_live",
        city: normalizedCity,
        liveAttempted,
        liveSucceeded,
        liveRawFetched,
        liveMapped,
        liveMappedDropped,
        liveMapDropReasons,
        liveNormalized,
        liveNormalizationDropped,
        liveNormalizationDropReasons,
        liveAcceptedPreGeo: liveVenuesDeduped.length,
        liveAccepted: liveVenues.length,
        liveSuppressed: liveSuppressedBeforeDedupe.length,
        liveSuppressionReasons,
        geoBucketCount: geoShapedLiveVenues.geoBucketCount,
        dominantAreaShare: geoShapedLiveVenues.dominantAreaShare,
        geoSpreadScore: geoShapedLiveVenues.geoSpreadScore,
        geoDiversityDownsampledCount: geoShapedLiveVenues.downsampledCount,
        bootstrapCount: 0,
        selectedCount: selectedLiveVenues.length,
        notes: [
          "Live hybrid retrieval provided enough entities without bootstrap support.",
          ...dedupeDropped > 0 ? [`${dedupeDropped} duplicate live entities collapsed during merge.`] : [],
          ...geoShapedLiveVenues.notes,
          ...selectedLiveVenues.length < liveVenues.length ? [`Geo-balanced selection chose ${selectedLiveVenues.length} venues from ${liveVenues.length} live candidates.`] : []
        ]
      }
    };
  }
  const bootstrapVenues = buildPortableBootstrapVenues(normalizedCity);
  const merged = dedupeVenues([...liveVenues, ...bootstrapVenues]);
  const selectedMergedVenues = projectNeighborhoodByGeoArea(
    selectGeoBalancedVenues(merged, 36),
    normalizedCity
  );
  const mode = liveVenues.length > 0 ? "hybrid_live_plus_bootstrap" : "hybrid_bootstrap";
  return {
    venues: selectedMergedVenues,
    diagnostics: {
      mode,
      city: normalizedCity,
      liveAttempted,
      liveSucceeded,
      liveRawFetched,
      liveMapped,
      liveMappedDropped,
      liveMapDropReasons,
      liveNormalized,
      liveNormalizationDropped,
      liveNormalizationDropReasons,
      liveAcceptedPreGeo: liveVenuesDeduped.length,
      liveAccepted: liveVenues.length,
      liveSuppressed: liveSuppressedBeforeDedupe.length,
      liveSuppressionReasons,
      geoBucketCount: geoShapedLiveVenues.geoBucketCount,
      dominantAreaShare: geoShapedLiveVenues.dominantAreaShare,
      geoSpreadScore: geoShapedLiveVenues.geoSpreadScore,
      geoDiversityDownsampledCount: geoShapedLiveVenues.downsampledCount,
      bootstrapCount: bootstrapVenues.length,
      selectedCount: selectedMergedVenues.length,
      notes: mode === "hybrid_bootstrap" ? [
        "Live retrieval unavailable or too thin; portable bootstrap fallback supplied the field.",
        ...liveAttempted ? [
          `Live attrition snapshot: fetched ${liveRawFetched}, mapped ${liveMapped}, normalized ${liveNormalized}, accepted ${liveVenues.length}.`
        ] : []
      ] : [
        "Live retrieval was thin; portable bootstrap supplemented coverage for district formation.",
        `Live attrition snapshot: fetched ${liveRawFetched}, mapped ${liveMapped}, normalized ${liveNormalized}, accepted ${liveVenues.length}.`,
        ...dedupeDropped > 0 ? [`${dedupeDropped} duplicate live entities collapsed during merge.`] : [],
        ...geoShapedLiveVenues.notes,
        ...selectedMergedVenues.length < merged.length ? [
          `Geo-balanced selection chose ${selectedMergedVenues.length} venues from ${merged.length} total candidates.`
        ] : []
      ]
    }
  };
}

// src/domain/retrieval/computeHybridLiveLift.ts
var emptyRoleLift = {
  warmup: 0,
  peak: 0,
  wildcard: 0,
  cooldown: 0
};
var emptyProfile2 = {
  fitLift: 0,
  rolePoolLift: 0,
  roleLiftByRole: emptyRoleLift,
  dedupePriorityScore: 0,
  liftApplied: false,
  freshnessLiftApplied: false,
  strongLiveCandidate: false,
  strongHighlightCandidate: false,
  notes: []
};
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function computeHybridLiveLift(venue) {
  if (venue.source.sourceOrigin !== "live") {
    return emptyProfile2;
  }
  const notes = [];
  const approved = venue.source.qualityGateStatus === "approved";
  const demoted = venue.source.qualityGateStatus === "demoted";
  const liveFairness = computeLiveQualityFairness(venue);
  const strongHours = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.68 && !venue.source.hoursSuppressionApplied;
  const softHours = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.5 && !venue.source.hoursSuppressionApplied;
  const strongSource = venue.source.sourceConfidence >= 0.72 && venue.source.completenessScore >= 0.58 && venue.source.qualityScore >= 0.72;
  const fairSupportSource = venue.source.sourceConfidence >= 0.6 && venue.source.completenessScore >= 0.56 && venue.source.qualityScore >= 0.6;
  const signatureForward = venue.signature.signatureScore >= 0.58 && venue.signature.genericScore <= 0.44;
  const highlightReady = venue.highlightCapable && venue.settings.highlightCapabilityTier === "highlight-capable" && !venue.settings.connectiveOnly;
  const supportReady = !venue.settings.connectiveOnly && (venue.category === "cafe" || venue.category === "restaurant" || venue.settings.dateFriendly || venue.settings.adultSocial);
  const freshnessLiftApplied = approved && strongSource && signatureForward;
  const strongLiveCandidate = approved && strongSource && (strongHours || softHours) || demoted && supportReady && liveFairness.supportRecoveryEligible && fairSupportSource && venue.source.timeConfidence >= 0.4;
  const strongHighlightCandidate = strongLiveCandidate && highlightReady;
  let fitLift = 0;
  fitLift += strongHours ? 0.028 : softHours ? 0.016 : 0;
  fitLift += freshnessLiftApplied ? 0.016 : approved && signatureForward ? 8e-3 : 0;
  fitLift += demoted && liveFairness.supportRecoveryEligible ? 8e-3 : 0;
  fitLift += approved && venue.source.qualityScore >= 0.78 ? 8e-3 : 0;
  fitLift -= demoted ? 6e-3 : 0;
  const roleLiftByRole = {
    warmup: strongLiveCandidate && supportReady ? liveFairness.supportRecoveryEligible ? 0.024 : 0.018 : softHours && venue.category === "cafe" ? 0.01 : 0,
    peak: strongHighlightCandidate ? 0.042 : strongLiveCandidate && highlightReady ? 0.024 : 0,
    wildcard: freshnessLiftApplied && venue.signature.signatureScore >= 0.62 ? 0.016 : 0,
    cooldown: strongLiveCandidate && supportReady && venue.energyLevel <= 3 ? liveFairness.supportRecoveryEligible ? 0.022 : 0.016 : softHours && venue.energyLevel <= 3 ? 8e-3 : 0
  };
  const rolePoolLift = (strongHighlightCandidate ? 0.018 : 0) + (strongLiveCandidate && !strongHighlightCandidate ? 0.01 : 0) + (freshnessLiftApplied ? 8e-3 : 0);
  const dedupePriorityScore = clamp2(
    venue.source.qualityScore * 0.34 + venue.source.sourceConfidence * 0.22 + venue.source.completenessScore * 0.16 + venue.source.timeConfidence * 0.14 + venue.signature.signatureScore * 0.14 + (strongHours ? 0.08 : softHours ? 0.03 : 0),
    0,
    1
  );
  if (strongHours) {
    notes.push("current-window hours support is strong");
  } else if (softHours) {
    notes.push("hours support is positive enough to compete");
  }
  if (freshnessLiftApplied) {
    notes.push("fresh live discovery lift applied");
  }
  if (demoted && liveFairness.supportRecoveryEligible) {
    notes.push("demoted live support venue stayed competitive on fair-quality recovery");
  }
  if (strongHighlightCandidate) {
    notes.push("live venue is strong enough to anchor Highlight competition");
  } else if (strongLiveCandidate) {
    notes.push("live venue is strong enough to stay competitive downstream");
  }
  const liftApplied = fitLift > 1e-3 || rolePoolLift > 1e-3 || Object.values(roleLiftByRole).some((value) => value > 1e-3);
  return {
    fitLift,
    rolePoolLift,
    roleLiftByRole,
    dedupePriorityScore,
    liftApplied,
    freshnessLiftApplied,
    strongLiveCandidate,
    strongHighlightCandidate,
    notes
  };
}

// src/domain/retrieval/dedupeVenues.ts
function normalizeValue6(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}
function buildNameSignature(value) {
  return normalizeValue6(value).split(/\s+/).filter((part) => part.length > 1).join(" ");
}
function isUnknownNeighborhood(value) {
  const normalized = normalizeValue6(value);
  return normalized.length === 0 || normalized === "unknown";
}
function getDuplicateReason(left, right) {
  if (left.category !== right.category) {
    return void 0;
  }
  const leftName = buildNameSignature(left.name);
  const rightName = buildNameSignature(right.name);
  if (!leftName || !rightName) {
    return void 0;
  }
  const sameNeighborhood = normalizeValue6(left.neighborhood) === normalizeValue6(right.neighborhood);
  const sameCity = normalizeValue6(left.city) === normalizeValue6(right.city);
  const ambiguousNeighborhood = isUnknownNeighborhood(left.neighborhood) || isUnknownNeighborhood(right.neighborhood);
  const nearEquivalentDrive = Math.abs(left.driveMinutes - right.driveMinutes) <= 2;
  if (!sameCity) {
    return void 0;
  }
  if (leftName === rightName && (sameNeighborhood || ambiguousNeighborhood || nearEquivalentDrive)) {
    return sameNeighborhood ? "same normalized name and category in the same neighborhood" : ambiguousNeighborhood ? "same normalized name and city with ambiguous neighborhood metadata" : "same normalized name and category with nearly identical route distance";
  }
  if (sameNeighborhood && leftName.includes(rightName)) {
    return "same-category venue with a longer live/curated name variant in the same neighborhood";
  }
  if (sameNeighborhood && rightName.includes(leftName)) {
    return "same-category venue with a shorter live/curated name variant in the same neighborhood";
  }
  return void 0;
}
function pickPreferredVenue(left, right) {
  if (left.source.sourceOrigin !== right.source.sourceOrigin) {
    const liveVenue = left.source.sourceOrigin === "live" ? left : right;
    const curatedVenue = left.source.sourceOrigin === "curated" ? left : right;
    const liveLift = computeHybridLiveLift(liveVenue);
    const curatedScore = curatedVenue.source.qualityScore * 0.45 + curatedVenue.source.sourceConfidence * 0.25 + curatedVenue.signature.signatureScore * 0.16 + (curatedVenue.highlightCapable ? 0.08 : 0);
    if ((liveLift.strongLiveCandidate || liveVenue.source.qualityGateStatus !== "suppressed" && liveLift.dedupePriorityScore >= curatedScore - 0.02 && liveVenue.signature.signatureScore >= curatedVenue.signature.signatureScore + 0.06) && liveVenue.signature.genericScore <= curatedVenue.signature.genericScore + 0.06) {
      return {
        preferred: liveVenue,
        reason: "live record outranked curated on dedupe priority and stayed specific enough to keep"
      };
    }
    return {
      preferred: curatedVenue,
      reason: "curated record kept the duplicate because its quality/signature stack stayed stronger than the live dedupe priority"
    };
  }
  if (left.source.qualityScore !== right.source.qualityScore) {
    return left.source.qualityScore >= right.source.qualityScore ? {
      preferred: left,
      reason: "higher quality score won the duplicate tie"
    } : {
      preferred: right,
      reason: "higher quality score won the duplicate tie"
    };
  }
  if (left.source.sourceConfidence !== right.source.sourceConfidence) {
    return left.source.sourceConfidence >= right.source.sourceConfidence ? {
      preferred: left,
      reason: "higher source confidence won the duplicate tie"
    } : {
      preferred: right,
      reason: "higher source confidence won the duplicate tie"
    };
  }
  return {
    preferred: left,
    reason: "existing duplicate entry held on a tie"
  };
}
function computeNoveltyCollapse(removed, kept) {
  if (removed.source.sourceOrigin !== "live" || kept.source.sourceOrigin !== "curated") {
    return false;
  }
  return removed.signature.signatureScore >= 0.55 || removed.distinctivenessScore >= kept.distinctivenessScore || computeHybridLiveLift(removed).strongLiveCandidate;
}
function dedupeVenues2(venues) {
  const deduped = [];
  let dedupedCount = 0;
  let dedupedLiveCount = 0;
  let liveDedupedAgainstCuratedCount = 0;
  let liveNoveltyCollapsedCount = 0;
  const losses = [];
  for (const venue of venues) {
    const duplicateIndex = deduped.findIndex((candidate) => Boolean(getDuplicateReason(candidate, venue)));
    if (duplicateIndex === -1) {
      deduped.push(venue);
      continue;
    }
    const current = deduped[duplicateIndex];
    const duplicateReason = getDuplicateReason(current, venue) ?? "duplicate collapsed during source merge";
    dedupedCount += 1;
    const resolution = pickPreferredVenue(current, venue);
    const removed = resolution.preferred.id === current.id ? venue : current;
    const kept = resolution.preferred;
    if (removed.source.sourceOrigin === "live") {
      dedupedLiveCount += 1;
    }
    const liveLostAgainstCurated = removed.source.sourceOrigin === "live" && kept.source.sourceOrigin === "curated";
    const liveNoveltyCollapsed = computeNoveltyCollapse(removed, kept);
    if (liveLostAgainstCurated) {
      liveDedupedAgainstCuratedCount += 1;
    }
    if (liveNoveltyCollapsed) {
      liveNoveltyCollapsedCount += 1;
    }
    if (removed.source.sourceOrigin === "live" || kept.source.sourceOrigin === "live") {
      losses.push({
        removedVenueId: removed.id,
        removedVenueName: removed.name,
        removedSourceOrigin: removed.source.sourceOrigin,
        keptVenueId: kept.id,
        keptVenueName: kept.name,
        keptSourceOrigin: kept.source.sourceOrigin,
        duplicateReason,
        preferenceReason: resolution.reason,
        liveLostAgainstCurated,
        liveNoveltyCollapsed,
        liveSignatureScore: removed.source.sourceOrigin === "live" ? Number((removed.signature.signatureScore * 100).toFixed(1)) : kept.source.sourceOrigin === "live" ? Number((kept.signature.signatureScore * 100).toFixed(1)) : void 0,
        keptSignatureScore: Number((kept.signature.signatureScore * 100).toFixed(1)),
        liveDistinctivenessScore: removed.source.sourceOrigin === "live" ? Number((removed.distinctivenessScore * 100).toFixed(1)) : kept.source.sourceOrigin === "live" ? Number((kept.distinctivenessScore * 100).toFixed(1)) : void 0,
        keptDistinctivenessScore: Number((kept.distinctivenessScore * 100).toFixed(1))
      });
    }
    deduped[duplicateIndex] = kept;
  }
  return {
    venues: deduped,
    dedupedCount,
    dedupedLiveCount,
    liveDedupedAgainstCuratedCount,
    liveNoveltyCollapsedCount,
    losses
  };
}

// src/domain/retrieval/mergeVenueSources.ts
function mergeVenueSources(curatedVenues2, liveVenues, requestedSourceMode) {
  const sourcePool = requestedSourceMode === "curated" ? curatedVenues2 : requestedSourceMode === "live" ? liveVenues : [...curatedVenues2, ...liveVenues];
  const deduped = dedupeVenues2(sourcePool);
  const countsBySource = deduped.venues.reduce(
    (acc, venue) => {
      acc[venue.source.sourceOrigin] += 1;
      return acc;
    },
    { curated: 0, live: 0 }
  );
  return {
    venues: deduped.venues,
    dedupedCount: deduped.dedupedCount,
    dedupedLiveCount: deduped.dedupedLiveCount,
    liveDedupedAgainstCuratedCount: deduped.liveDedupedAgainstCuratedCount,
    liveNoveltyCollapsedCount: deduped.liveNoveltyCollapsedCount,
    dedupeLosses: deduped.losses,
    countsBySource
  };
}

// src/domain/debug/buildLiveTrustBreakdown.ts
function countReasons(reasons) {
  const counts = reasons.reduce((acc, reason) => {
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count).slice(0, 6);
}
function upstreamStrength(venue) {
  return venue.source.qualityScore * 0.34 + venue.source.sourceConfidence * 0.24 + venue.source.completenessScore * 0.18 + venue.signature.signatureScore * 0.14 + (1 - venue.signature.genericScore) * 0.1;
}
function toFailureCandidate(venue) {
  const helpedBy = [
    ...venue.source.qualityGateNotes.filter(
      (note) => /(supports|viable path|distinctive|fairly|metadata|signal)/i.test(note)
    ),
    ...venue.source.hoursPressureNotes.filter(
      (note) => /(supports|accepted|positive|open)/i.test(note)
    )
  ].slice(0, 4);
  const hurtBy = [
    ...venue.source.demotionReasons,
    ...venue.source.suppressionReasons,
    ...venue.source.hoursPressureNotes.filter(
      (note) => /(conflicts|unknown|closed|soft)/i.test(note)
    )
  ].slice(0, 6);
  return {
    venueId: venue.id,
    venueName: venue.name,
    qualityGateStatus: venue.source.qualityGateStatus,
    qualityScore: Number((venue.source.qualityScore * 100).toFixed(1)),
    sourceConfidence: Number((venue.source.sourceConfidence * 100).toFixed(1)),
    completenessScore: Number((venue.source.completenessScore * 100).toFixed(1)),
    signatureScore: Number((venue.signature.signatureScore * 100).toFixed(1)),
    genericScore: Number((venue.signature.genericScore * 100).toFixed(1)),
    sourceQueryLabel: venue.source.sourceQueryLabel,
    helpedBy,
    hurtBy,
    blockers: venue.source.qualityGateStatus === "suppressed" ? venue.source.suppressionReasons : venue.source.demotionReasons
  };
}
function buildLiveTrustBreakdown(liveVenues, dedupeLosses) {
  const demoted = liveVenues.filter((venue) => venue.source.qualityGateStatus === "demoted").sort((left, right) => upstreamStrength(right) - upstreamStrength(left));
  const suppressed = liveVenues.filter((venue) => venue.source.qualityGateStatus === "suppressed").sort((left, right) => upstreamStrength(right) - upstreamStrength(left));
  return {
    topApprovedBlockers: countReasons(demoted.flatMap((venue) => venue.source.demotionReasons)),
    topSuppressionReasons: countReasons(suppressed.flatMap((venue) => venue.source.suppressionReasons)),
    topDedupeReasons: countReasons(
      dedupeLosses.filter((loss) => loss.removedSourceOrigin === "live").flatMap((loss) => [loss.duplicateReason, loss.preferenceReason])
    ),
    strongestApprovalFailures: demoted.slice(0, 5).map(toFailureCandidate),
    strongestSuppressedCandidates: suppressed.slice(0, 5).map(toFailureCandidate),
    strongestDedupedCandidates: dedupeLosses.filter((loss) => loss.removedSourceOrigin === "live").sort((left, right) => {
      const leftSignal = Math.max(left.liveSignatureScore ?? 0, left.liveDistinctivenessScore ?? 0);
      const rightSignal = Math.max(right.liveSignatureScore ?? 0, right.liveDistinctivenessScore ?? 0);
      return rightSignal - leftSignal;
    }).slice(0, 5)
  };
}

// src/domain/interpretation/taste/scenarioContracts.ts
var SAN_JOSE_ROMANTIC_COZY_CONTRACT = {
  id: "san_jose_romantic_cozy",
  city: "San Jose",
  persona: "romantic",
  vibe: "cozy",
  buildLabel: "Romantic Cozy Concierge Build",
  description: "Atmospheric romantic pacing that centers a conviction dinner anchor, preserves hidden gems, and closes softly.",
  timingRules: {
    startWindowLabels: ["golden-hour", "early-evening"],
    endWindowLabels: ["nightcap", "soft-close"],
    paceLabel: "gentle linger",
    minStopMinutes: 55,
    maxStopMinutes: 120,
    minBufferMinutes: 10
  },
  stopRules: [
    {
      position: 1,
      stopType: "start",
      purpose: "shared arrival with low-friction movement",
      examples: ["garden stroll", "tea", "quiet aperitif"]
    },
    {
      position: 2,
      stopType: "highlight",
      purpose: "intimate dinner or scenic romantic centerpiece",
      examples: ["intimate dinner", "scenic anchor", "conversation-first"]
    },
    {
      position: 3,
      stopType: "windDown",
      purpose: "soft close with jazz, wine, or calm cocktail energy",
      examples: ["jazz close", "wine bar", "quiet lounge"]
    }
  ],
  hiddenGemRules: {
    minimumHiddenGemStops: 1,
    preferredHiddenGemVenues: [
      "Hakone Gardens",
      "Japanese Friendship Garden",
      "Rosicrucian Egyptian Museum"
    ],
    routeLevelHiddenGemBias: true
  },
  anchorRules: {
    defaultPrimaryAnchors: ["La Foret", "Hedley Club Lounge"],
    stronglyPreferredVenues: [
      "La Foret",
      "Hedley Club Lounge",
      "Hakone Gardens",
      "Japanese Friendship Garden"
    ],
    avoidVenues: ["San Pedro Square Market"],
    forbiddenPatterns: [
      "back to back high energy bar crawl",
      "hard cut ending after peak",
      "no intimate centerpiece"
    ]
  },
  toneGuidance: "Warm, intimate, and discovery-aware with a calm landing.",
  specialRules: [
    "Preserve at least one hidden-gem or scenic signal when available.",
    "Avoid loud back-to-back peak stacking."
  ],
  selectionBias: {
    roleBoosts: {
      start: 0.04,
      highlight: 0.09,
      windDown: 0.06
    },
    momentTypeBoosts: {
      anchor: 0.08,
      supporting: 0.05,
      discovery: 0.07,
      community: 0.06,
      temporal: 0.03
    },
    preferredVenueBoost: 0.16,
    hiddenGemBoost: 0.09
  }
};
var SAN_JOSE_ROMANTIC_LIVELY_CONTRACT = {
  id: "san_jose_romantic_lively",
  city: "San Jose",
  persona: "romantic",
  vibe: "lively",
  buildLabel: "Romantic Lively Concierge Build",
  description: "Aperitivo-to-performance pulse with a conviction highlight and an intentional late close.",
  timingRules: {
    startWindowLabels: ["aperitivo", "early-evening"],
    endWindowLabels: ["late-night", "after-show"],
    paceLabel: "energized build",
    minStopMinutes: 40,
    maxStopMinutes: 105,
    minBufferMinutes: 8
  },
  stopRules: [
    {
      position: 1,
      stopType: "start",
      purpose: "social opener that builds toward a stronger center",
      examples: ["aperitivo", "cocktail start", "quick social opener"]
    },
    {
      position: 2,
      stopType: "highlight",
      purpose: "energetic dinner or live cultural centerpiece",
      examples: ["energetic dinner", "performance anchor", "live center"]
    },
    {
      position: 3,
      stopType: "windDown",
      purpose: "intentional late close with optional final bite",
      examples: ["late cocktail", "nightcap", "late food"]
    }
  ],
  hiddenGemRules: {
    minimumHiddenGemStops: 1,
    preferredHiddenGemVenues: ["Poor House Bistro", "Hammer Theatre", "Opera San Jose"],
    routeLevelHiddenGemBias: true
  },
  anchorRules: {
    defaultPrimaryAnchors: ["Poor House Bistro", "Hedley Club Lounge"],
    stronglyPreferredVenues: [
      "Poor House Bistro",
      "Hedley Club Lounge",
      "Hammer Theatre",
      "Opera San Jose",
      "Paper Plane"
    ],
    avoidVenues: ["quiet daytime cafe"],
    forbiddenPatterns: [
      "flat pacing without a clear center",
      "early close before peak lands",
      "low energy anchor for lively build"
    ]
  },
  toneGuidance: "Confident pulse with a clear center and clean late landing.",
  specialRules: [
    "Protect anchor conviction before over-optimizing proximity.",
    "Preserve temporal/community moments when they reinforce tonight relevance."
  ],
  selectionBias: {
    roleBoosts: {
      start: 0.03,
      highlight: 0.11,
      windDown: 0.04
    },
    momentTypeBoosts: {
      anchor: 0.1,
      temporal: 0.09,
      discovery: 0.05,
      community: 0.06,
      supporting: 0.03
    },
    preferredVenueBoost: 0.18,
    hiddenGemBoost: 0.07
  }
};
var SAN_JOSE_ROMANTIC_CULTURED_CONTRACT = {
  id: "san_jose_romantic_cultured",
  city: "San Jose",
  persona: "romantic",
  vibe: "cultured",
  buildLabel: "Romantic Cultured Concierge Build",
  description: "Institution or gallery-led structure with thoughtful pacing, strong anchor conviction, and refined close.",
  timingRules: {
    startWindowLabels: ["late-afternoon", "early-evening"],
    endWindowLabels: ["nightcap", "late-gallery-close"],
    paceLabel: "intentional curated",
    minStopMinutes: 50,
    maxStopMinutes: 125,
    minBufferMinutes: 10
  },
  stopRules: [
    {
      position: 1,
      stopType: "start",
      purpose: "curated opener that sets context and pace",
      examples: ["institution opener", "gallery start", "wine-led entry"]
    },
    {
      position: 2,
      stopType: "highlight",
      purpose: "cultural conviction centerpiece",
      examples: ["museum anchor", "performance center", "fine dining highlight"]
    },
    {
      position: 3,
      stopType: "windDown",
      purpose: "quiet reflective close nearby",
      examples: ["refined nightcap", "soft close", "quiet walk"]
    }
  ],
  hiddenGemRules: {
    minimumHiddenGemStops: 1,
    preferredHiddenGemVenues: [
      "Rosicrucian Egyptian Museum",
      "Japanese Friendship Garden",
      "Hakone Gardens"
    ],
    routeLevelHiddenGemBias: true
  },
  anchorRules: {
    defaultPrimaryAnchors: ["Rosicrucian Egyptian Museum"],
    stronglyPreferredVenues: [
      "Rosicrucian Egyptian Museum",
      "Hammer Theatre",
      "Opera San Jose",
      "Hakone Gardens"
    ],
    avoidVenues: ["high-volume sports bar"],
    forbiddenPatterns: [
      "generic loud bar crawl",
      "anchorless roaming",
      "high friction cross city hopping"
    ]
  },
  toneGuidance: "Curated, place-aware, and reflective with a clear cultural center.",
  specialRules: [
    "Bias toward high-conviction cultural anchors when available.",
    "Preserve discovery/community moments that deepen place meaning."
  ],
  selectionBias: {
    roleBoosts: {
      start: 0.05,
      highlight: 0.09,
      windDown: 0.06
    },
    momentTypeBoosts: {
      discovery: 0.1,
      community: 0.09,
      anchor: 0.08,
      temporal: 0.05,
      supporting: 0.04
    },
    preferredVenueBoost: 0.17,
    hiddenGemBoost: 0.1
  }
};
var HOSPITALITY_SCENARIO_CONTRACTS = [
  SAN_JOSE_ROMANTIC_COZY_CONTRACT,
  SAN_JOSE_ROMANTIC_LIVELY_CONTRACT,
  SAN_JOSE_ROMANTIC_CULTURED_CONTRACT
];
function normalizeToken2(value) {
  return (value ?? "").toLowerCase().trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
function normalizePersona(value) {
  const token = normalizeToken2(value);
  if (token.includes("romantic") || token.includes("couple") || token.includes("date")) {
    return "romantic";
  }
  if (token.includes("friend") || token.includes("social")) {
    return "friends";
  }
  if (token.includes("family")) {
    return "family";
  }
  return void 0;
}
function normalizeVibe(value) {
  const token = normalizeToken2(value);
  if (token.includes("cozy") || token.includes("chill") || token.includes("calm")) {
    return "cozy";
  }
  if (token.includes("lively") || token.includes("playful") || token.includes("pulse") || token.includes("energetic")) {
    return "lively";
  }
  if (token.includes("cultured") || token.includes("culture") || token.includes("curated")) {
    return "cultured";
  }
  return void 0;
}
function normalizeCity3(value) {
  return normalizeToken2(value);
}
function isSanJoseCity(value) {
  const city = normalizeCity3(value);
  return city.includes("san jose") || city.includes("san jose ca") || city.includes("sj") || city.includes("silicon valley");
}
function getHospitalityScenarioContract(input) {
  const persona = normalizePersona(input.persona);
  const vibe = normalizeVibe(input.vibe);
  if (!persona || !vibe) {
    return null;
  }
  if (!isSanJoseCity(input.city)) {
    return null;
  }
  return HOSPITALITY_SCENARIO_CONTRACTS.find(
    (contract) => contract.city === "San Jose" && contract.persona === persona && contract.vibe === vibe
  ) ?? null;
}

// src/domain/constraints/localStretchPolicy.ts
var STRICT_NEARBY_DRIVE_MINUTES = 14;
var BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES = 18;
function getCanonicalDistanceStatus(driveMinutes) {
  if (driveMinutes <= STRICT_NEARBY_DRIVE_MINUTES) {
    return "inside_strict_nearby";
  }
  if (driveMinutes <= BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES) {
    return "inside_bounded_stretch";
  }
  return "outside_bounded_stretch";
}
function isWithinStrictNearbyWindow(driveMinutes, distanceMode) {
  return distanceMode === "nearby" && getCanonicalDistanceStatus(driveMinutes) === "inside_strict_nearby";
}
function isOutsideStrictNearbyButWithinBoundedStretch(driveMinutes, distanceMode) {
  return distanceMode === "nearby" && getCanonicalDistanceStatus(driveMinutes) === "inside_bounded_stretch";
}

// src/data/venues.ts
var categoryImages = {
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  bar: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80",
  cafe: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  dessert: "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1200&q=80",
  live_music: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1200&q=80",
  activity: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80",
  park: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
  museum: "https://images.unsplash.com/photo-1566127992631-137a642a90f4?auto=format&fit=crop&w=1200&q=80",
  event: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80"
};
function makeVenue(seed) {
  return normalizeVenue({
    rawType: "place",
    id: seed.id,
    name: seed.name,
    city: seed.city ?? "San Jose",
    neighborhood: seed.neighborhood,
    driveMinutes: seed.driveMinutes,
    priceTier: seed.priceTier,
    tags: seed.tags,
    shortDescription: seed.shortDescription,
    narrativeFlavor: seed.narrativeFlavor,
    imageUrl: seed.imageUrl ?? categoryImages[seed.category],
    isActive: true,
    categoryHint: seed.category,
    subcategoryHint: seed.tags[0] ?? seed.category,
    sourceTypes: [seed.category, ...seed.tags.slice(0, 2)],
    normalizedFromRawType: "seed",
    sourceConfidence: 0.96,
    vibeTags: seed.vibeTags,
    useCases: seed.useCases,
    energyLevel: seed.energyLevel,
    socialDensity: seed.socialDensity,
    uniquenessScore: seed.uniquenessScore,
    distinctivenessScore: seed.distinctivenessScore,
    underexposureScore: seed.underexposureScore,
    shareabilityScore: seed.shareabilityScore,
    isHiddenGem: seed.isHiddenGem,
    isChain: seed.isChain,
    localSignals: {
      localFavoriteScore: seed.local[0],
      neighborhoodPrideScore: seed.local[1],
      repeatVisitorScore: seed.local[2]
    },
    roleAffinity: {
      warmup: seed.roles[0],
      peak: seed.roles[1],
      wildcard: seed.roles[2],
      cooldown: seed.roles[3]
    }
  });
}
var sanJoseVenues = [
  makeVenue({
    id: "sj-petiscos",
    name: "Petiscos",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["tapas", "chef-led", "elevated"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.83,
    underexposureScore: 0.62,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Small-plate dining with polished, modern comfort.",
    narrativeFlavor: "A confident culinary center point with real occasion feel.",
    isHiddenGem: false,
    local: [0.81, 0.75, 0.69],
    roles: [0.62, 0.92, 0.44, 0.36]
  }),
  makeVenue({
    id: "sj-orchard-city-kitchen",
    name: "Orchard City Kitchen",
    neighborhood: "Santana Row",
    driveMinutes: 15,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["new-american", "seasonal", "social"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.7,
    underexposureScore: 0.4,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Refined plates with bright flavors and lively pacing.",
    narrativeFlavor: "A high-confidence anchor for social groups that love food.",
    isHiddenGem: false,
    local: [0.78, 0.7, 0.73],
    roles: [0.45, 0.9, 0.38, 0.35]
  }),
  makeVenue({
    id: "sj-nirvana-soul",
    name: "Nirvana Soul",
    neighborhood: "SoFA District",
    driveMinutes: 7,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "design-forward", "local"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "creative", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.91,
    underexposureScore: 0.74,
    shareabilityScore: 0.89,
    isChain: false,
    shortDescription: "Modern cafe ritual with local personality.",
    narrativeFlavor: "A smooth opening move that still feels special.",
    isHiddenGem: true,
    local: [0.9, 0.88, 0.76],
    roles: [0.93, 0.42, 0.54, 0.8]
  }),
  makeVenue({
    id: "sj-voyager-coffee",
    name: "Voyager Craft Coffee",
    neighborhood: "San Pedro",
    driveMinutes: 8,
    category: "cafe",
    priceTier: "$$",
    tags: ["third-wave", "quick-start", "craft"],
    useCases: ["socialite", "curator"],
    vibeTags: ["relaxed", "cozy", "playful"],
    energyLevel: 2,
    uniquenessScore: 0.72,
    distinctivenessScore: 0.64,
    underexposureScore: 0.52,
    shareabilityScore: 0.66,
    isChain: false,
    shortDescription: "Reliable craft coffee with upbeat local energy.",
    narrativeFlavor: "A practical, polished first stop for any mode.",
    isHiddenGem: false,
    local: [0.71, 0.69, 0.81],
    roles: [0.84, 0.33, 0.41, 0.74]
  }),
  makeVenue({
    id: "sj-paper-plane",
    name: "Paper Plane",
    neighborhood: "Downtown",
    driveMinutes: 5,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "social", "stylish"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["lively", "creative", "playful"],
    energyLevel: 4,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.71,
    underexposureScore: 0.41,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Signature cocktails and high-social atmosphere.",
    narrativeFlavor: "A polished surge in momentum for social plans.",
    isHiddenGem: false,
    local: [0.83, 0.74, 0.79],
    roles: [0.41, 0.82, 0.53, 0.55]
  }),
  makeVenue({
    id: "sj-miniboss",
    name: "MiniBoss",
    neighborhood: "Downtown",
    driveMinutes: 5,
    category: "activity",
    priceTier: "$$",
    tags: ["arcade", "games", "nostalgia"],
    useCases: ["socialite", "curator"],
    vibeTags: ["playful", "lively", "creative"],
    energyLevel: 5,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.77,
    underexposureScore: 0.5,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Arcade-forward stop that instantly raises the tempo.",
    narrativeFlavor: "An easy crowd-pleaser when you want movement and laughs.",
    isHiddenGem: false,
    local: [0.8, 0.72, 0.68],
    roles: [0.4, 0.88, 0.86, 0.28]
  }),
  makeVenue({
    id: "sj-river-oaks-concert",
    name: "River Oaks Pop-Up Stage",
    neighborhood: "North San Jose",
    driveMinutes: 18,
    category: "live_music",
    priceTier: "$$",
    tags: ["local-artists", "small-stage", "community"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["lively", "culture", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.87,
    underexposureScore: 0.79,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Intimate live set showcasing local performers.",
    narrativeFlavor: "A strong surprise candidate with real local signal.",
    isHiddenGem: true,
    local: [0.77, 0.85, 0.59],
    roles: [0.35, 0.79, 0.91, 0.3]
  }),
  makeVenue({
    id: "sj-tech-interactive",
    name: "The Tech Interactive",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "museum",
    priceTier: "$$",
    tags: ["hands-on", "innovation", "immersive"],
    useCases: ["socialite", "curator"],
    vibeTags: ["creative", "culture", "playful"],
    energyLevel: 3,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.68,
    underexposureScore: 0.37,
    shareabilityScore: 0.71,
    isChain: false,
    shortDescription: "Interactive exhibits with high curiosity payoff.",
    narrativeFlavor: "A practical centerpiece for mixed-age plans.",
    isHiddenGem: false,
    local: [0.69, 0.7, 0.54],
    roles: [0.48, 0.76, 0.56, 0.52]
  }),
  makeVenue({
    id: "sj-rosicrucian",
    name: "Rosicrucian Egyptian Museum",
    neighborhood: "Rose Garden",
    driveMinutes: 12,
    category: "museum",
    priceTier: "$$",
    tags: ["historic", "curated", "iconic"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "relaxed", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.89,
    distinctivenessScore: 0.92,
    underexposureScore: 0.64,
    shareabilityScore: 0.78,
    isChain: false,
    shortDescription: "Quietly iconic museum with deep visual character.",
    narrativeFlavor: "An elegant pivot for culture-led plans.",
    isHiddenGem: true,
    local: [0.86, 0.88, 0.58],
    roles: [0.68, 0.8, 0.62, 0.74]
  }),
  makeVenue({
    id: "sj-japanese-friendship-garden",
    name: "Japanese Friendship Garden",
    neighborhood: "Kelley Park",
    driveMinutes: 14,
    category: "park",
    priceTier: "$",
    tags: ["garden", "walk", "reflective"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.76,
    underexposureScore: 0.58,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Calm pathways and scenic pauses built for reset.",
    narrativeFlavor: "A graceful landing spot for winding down.",
    isHiddenGem: true,
    local: [0.84, 0.9, 0.62],
    roles: [0.72, 0.43, 0.49, 0.95]
  }),
  makeVenue({
    id: "sj-hakone-gardens",
    name: "Hakone Gardens",
    neighborhood: "Saratoga Hills",
    driveMinutes: 18,
    category: "park",
    priceTier: "$$",
    tags: ["garden", "japanese", "scenic", "cultural-anchor", "stroll"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "culture", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.94,
    distinctivenessScore: 0.96,
    underexposureScore: 0.78,
    shareabilityScore: 0.92,
    isChain: false,
    shortDescription: "Historic Japanese estate gardens with layered walking paths.",
    narrativeFlavor: "A high-conviction scenic/cultural anchor for romantic and cultured sequencing.",
    isHiddenGem: true,
    local: [0.88, 0.92, 0.72],
    roles: [0.86, 0.74, 0.72, 0.98]
  }),
  makeVenue({
    id: "sj-la-foret",
    name: "La Foret",
    neighborhood: "New Almaden",
    driveMinutes: 18,
    category: "restaurant",
    priceTier: "$$$$",
    tags: ["french", "romantic", "special-occasion", "intimate", "chef-led"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: 0.92,
    distinctivenessScore: 0.9,
    underexposureScore: 0.74,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Historic estate dining with candlelit, conversation-first pacing.",
    narrativeFlavor: "A conviction dinner anchor for romantic cozy routes.",
    isHiddenGem: true,
    local: [0.9, 0.91, 0.73],
    roles: [0.44, 0.98, 0.5, 0.7]
  }),
  makeVenue({
    id: "sj-hedley-club-lounge",
    name: "Hedley Club Lounge",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "lounge", "hotel-bar", "nightcap", "intimate"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "lively", "culture"],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.86,
    underexposureScore: 0.63,
    shareabilityScore: 0.78,
    isChain: false,
    shortDescription: "Low-light cocktail lounge with polished live-evening energy.",
    narrativeFlavor: "A strong closer authority for romantic and lively builds.",
    isHiddenGem: false,
    local: [0.83, 0.78, 0.68],
    roles: [0.38, 0.76, 0.74, 0.97]
  }),
  makeVenue({
    id: "sj-hammer-theatre",
    name: "Hammer Theatre",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "live_music",
    priceTier: "$$$",
    tags: ["theatre", "performance", "cultural-anchor", "ticketed", "events"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.6,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Major downtown stage with mixed performance programming.",
    narrativeFlavor: "A performance-capable anchor that improves eventful nighttime coverage.",
    isHiddenGem: false,
    local: [0.8, 0.82, 0.7],
    roles: [0.42, 0.9, 0.8, 0.58]
  }),
  makeVenue({
    id: "sj-opera-san-jose",
    name: "Opera San Jose",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "live_music",
    priceTier: "$$$",
    tags: ["opera", "performance", "cultural-anchor", "night-out", "ticketed"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "cozy", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.91,
    distinctivenessScore: 0.93,
    underexposureScore: 0.66,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Historic opera venue with recurring evening performances.",
    narrativeFlavor: "A high-conviction cultured/night-out authority.",
    isHiddenGem: true,
    local: [0.82, 0.85, 0.68],
    roles: [0.36, 0.91, 0.77, 0.62]
  }),
  makeVenue({
    id: "sj-san-pedro-square-market",
    name: "San Pedro Square Market",
    neighborhood: "San Pedro",
    driveMinutes: 6,
    category: "event",
    priceTier: "$$",
    tags: ["market", "nightlife", "food-hall", "live-music", "community"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["lively", "culinary", "culture"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.8,
    underexposureScore: 0.45,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Open-format market district with frequent evening activations.",
    narrativeFlavor: "A nightlife and event-bearing authority for higher-energy routes.",
    isHiddenGem: false,
    local: [0.89, 0.83, 0.82],
    roles: [0.57, 0.85, 0.82, 0.55]
  }),
  makeVenue({
    id: "sj-sap-center",
    name: "SAP Center",
    neighborhood: "Arena District",
    driveMinutes: 9,
    category: "event",
    priceTier: "$$$",
    tags: ["arena", "major-event", "concert", "sports", "night-out"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["lively", "culture", "playful"],
    energyLevel: 5,
    socialDensity: 5,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.89,
    underexposureScore: 0.42,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Major arena draw with concerts and large-format events.",
    narrativeFlavor: "A major-venue authority that expands eventful tonight options.",
    isHiddenGem: false,
    local: [0.84, 0.81, 0.86],
    roles: [0.34, 0.94, 0.88, 0.4]
  }),
  makeVenue({
    id: "sj-alum-rock-loop",
    name: "Alum Rock Overlook Loop",
    neighborhood: "Alum Rock",
    driveMinutes: 22,
    category: "park",
    priceTier: "$",
    tags: ["trail", "viewpoint", "nature"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["outdoors", "playful", "relaxed"],
    energyLevel: 3,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.8,
    underexposureScore: 0.75,
    shareabilityScore: 0.77,
    isChain: false,
    shortDescription: "Short trail with strong scenic payoff and breathing room.",
    narrativeFlavor: "A smart wildcard for groups that want open-air contrast.",
    isHiddenGem: true,
    local: [0.79, 0.83, 0.67],
    roles: [0.61, 0.59, 0.83, 0.82]
  }),
  makeVenue({
    id: "sj-peters-bakery",
    name: "Peter's Bakery Burnt Almond",
    neighborhood: "Evergreen",
    driveMinutes: 19,
    category: "dessert",
    priceTier: "$$",
    tags: ["legacy", "dessert", "signature"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "playful"],
    energyLevel: 2,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.86,
    underexposureScore: 0.57,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Beloved local classic with instant dessert nostalgia.",
    narrativeFlavor: "A feel-good close with recognizable local character.",
    isHiddenGem: true,
    local: [0.92, 0.87, 0.81],
    roles: [0.49, 0.58, 0.66, 0.93]
  }),
  makeVenue({
    id: "sj-chromatic",
    name: "Chromatic Coffee Roastery",
    neighborhood: "Willow Glen",
    driveMinutes: 13,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "roastery", "intimate", "conversation", "linger", "neighborhood"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "relaxed", "culinary"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.87,
    underexposureScore: 0.82,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Roastery stop with low-noise seating and easy linger tempo.",
    narrativeFlavor: "A strong warmup anchor for coffee-first Willow Glen sequencing.",
    isHiddenGem: true,
    local: [0.86, 0.89, 0.84],
    roles: [0.95, 0.58, 0.66, 0.95]
  }),
  makeVenue({
    id: "sj-guildhouse",
    name: "Guildhouse",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "activity",
    priceTier: "$$",
    tags: ["board-games", "esports", "community"],
    useCases: ["socialite", "curator"],
    vibeTags: ["playful", "creative", "lively"],
    energyLevel: 4,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.82,
    underexposureScore: 0.67,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Interactive gaming lounge with social momentum.",
    narrativeFlavor: "A flexible middle stop for friends or mixed-age groups.",
    isHiddenGem: true,
    local: [0.83, 0.76, 0.74],
    roles: [0.44, 0.8, 0.87, 0.37]
  }),
  makeVenue({
    id: "sj-sofa-street-market",
    name: "SoFA Street Market",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "event",
    priceTier: "$$",
    tags: ["pop-up", "makers", "weekend"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["creative", "culture", "playful"],
    energyLevel: 3,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.88,
    underexposureScore: 0.82,
    shareabilityScore: 0.75,
    isChain: false,
    shortDescription: "Rotating local makers and mini experiences in one strip.",
    narrativeFlavor: "A discovery-heavy wildcard with broad audience appeal.",
    isHiddenGem: true,
    local: [0.74, 0.82, 0.58],
    roles: [0.52, 0.72, 0.9, 0.43]
  }),
  makeVenue({
    id: "sj-lunas-mexican-kitchen",
    name: "Luna Mexican Kitchen",
    neighborhood: "The Alameda",
    driveMinutes: 11,
    category: "restaurant",
    priceTier: "$$",
    tags: ["regional", "comfort", "colorful"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.73,
    distinctivenessScore: 0.67,
    underexposureScore: 0.44,
    shareabilityScore: 0.77,
    isChain: false,
    shortDescription: "Warm, colorful dining with broad group appeal.",
    narrativeFlavor: "A dependable highlight with easy crowd alignment.",
    isHiddenGem: false,
    local: [0.81, 0.77, 0.84],
    roles: [0.58, 0.79, 0.35, 0.4]
  }),
  makeVenue({
    id: "sj-adega-wine-atelier",
    name: "Adega Wine Atelier",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "restaurant",
    priceTier: "$$$$",
    tags: ["tasting-menu", "wine-pairing", "elevated"],
    useCases: ["romantic"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 3,
    uniquenessScore: 0.91,
    distinctivenessScore: 0.88,
    underexposureScore: 0.54,
    shareabilityScore: 0.87,
    isChain: false,
    shortDescription: "Refined tasting experience with slower, intentional pacing.",
    narrativeFlavor: "A romantic highlight with clear occasion energy.",
    isHiddenGem: false,
    local: [0.82, 0.76, 0.6],
    roles: [0.48, 0.94, 0.42, 0.46]
  }),
  makeVenue({
    id: "sj-theatre-district-jazz-cellar",
    name: "Theatre District Jazz Cellar",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "live_music",
    priceTier: "$$$",
    tags: ["jazz", "listening", "intimate"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culture", "cozy", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.69,
    shareabilityScore: 0.81,
    isChain: false,
    shortDescription: "Low-light listening room with a focused local lineup.",
    narrativeFlavor: "A soulful highlight that keeps plans feeling curated.",
    isHiddenGem: true,
    local: [0.79, 0.73, 0.66],
    roles: [0.45, 0.86, 0.85, 0.52]
  }),
  makeVenue({
    id: "sj-willow-glen-tea-atelier",
    name: "Willow Glen Tea Atelier",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "cafe",
    priceTier: "$$",
    tags: ["tea-room", "intimate", "low-noise", "linger", "neighborhood"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "relaxed", "culture"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.87,
    underexposureScore: 0.85,
    shareabilityScore: 0.72,
    isChain: false,
    shortDescription: "Tea-forward room with serene pacing and local pastries.",
    narrativeFlavor: "A premium low-friction anchor for emotionally soft routing.",
    isHiddenGem: true,
    local: [0.85, 0.83, 0.72],
    roles: [0.93, 0.34, 0.6, 0.96]
  }),
  makeVenue({
    id: "sj-little-portugal-pastry-bar",
    name: "Little Portugal Pastry Bar",
    neighborhood: "Evergreen",
    driveMinutes: 17,
    category: "dessert",
    priceTier: "$$",
    tags: ["pasteis", "local", "cozy"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.84,
    underexposureScore: 0.7,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Neighborhood pastry stop with easy linger energy.",
    narrativeFlavor: "A comforting close that still feels discovered.",
    isHiddenGem: true,
    local: [0.8, 0.82, 0.75],
    roles: [0.62, 0.54, 0.66, 0.9]
  }),
  makeVenue({
    id: "sj-municipal-rose-garden-promenade",
    name: "Municipal Rose Garden Promenade",
    neighborhood: "Rose Garden",
    driveMinutes: 11,
    category: "park",
    priceTier: "$",
    tags: ["scenic", "stroll", "photogenic"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.78,
    underexposureScore: 0.52,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Classic garden walk with strong visual payoff.",
    narrativeFlavor: "A reliable start or soft landing for slower plans.",
    isHiddenGem: false,
    local: [0.86, 0.89, 0.84],
    roles: [0.88, 0.52, 0.48, 0.92]
  }),
  makeVenue({
    id: "sj-santana-rooftop-lounge",
    name: "Santana Rooftop Lounge",
    neighborhood: "Santana Row",
    driveMinutes: 15,
    category: "bar",
    priceTier: "$$$",
    tags: ["rooftop", "craft", "social"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["lively", "cozy", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.71,
    underexposureScore: 0.35,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Open-air lounge energy with polished cocktails.",
    narrativeFlavor: "A high-energy highlight for social groups.",
    isHiddenGem: false,
    local: [0.73, 0.7, 0.77],
    roles: [0.46, 0.84, 0.47, 0.56]
  }),
  makeVenue({
    id: "sj-family-art-lab",
    name: "Family Art Lab Collective",
    neighborhood: "SoFA District",
    driveMinutes: 9,
    category: "activity",
    priceTier: "$$",
    tags: ["hands-on", "family-friendly", "studio"],
    useCases: ["curator", "socialite"],
    vibeTags: ["creative", "playful", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.85,
    underexposureScore: 0.78,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Drop-in art activities with guided mini workshops.",
    narrativeFlavor: "A family-safe highlight with real novelty.",
    isHiddenGem: true,
    local: [0.79, 0.8, 0.62],
    roles: [0.62, 0.82, 0.74, 0.55]
  }),
  makeVenue({
    id: "sj-childrens-discovery-museum",
    name: "Children's Discovery Museum",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "museum",
    priceTier: "$$",
    tags: ["interactive", "family-friendly", "learning"],
    useCases: ["curator"],
    vibeTags: ["playful", "culture", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.76,
    distinctivenessScore: 0.72,
    underexposureScore: 0.44,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Hands-on exhibits tuned for family discovery.",
    narrativeFlavor: "A dependable family highlight with low confusion.",
    isHiddenGem: false,
    local: [0.82, 0.78, 0.69],
    roles: [0.6, 0.86, 0.52, 0.58]
  }),
  makeVenue({
    id: "sj-happy-hollow-adventure-corner",
    name: "Happy Hollow Adventure Corner",
    neighborhood: "Kelley Park",
    driveMinutes: 13,
    category: "activity",
    priceTier: "$$",
    tags: ["family-friendly", "outdoor-play", "animals"],
    useCases: ["curator"],
    vibeTags: ["playful", "outdoors", "relaxed"],
    energyLevel: 3,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.69,
    underexposureScore: 0.43,
    shareabilityScore: 0.7,
    isChain: false,
    shortDescription: "Kid-centered activity stop with easy pacing options.",
    narrativeFlavor: "A family-safe highlight that avoids nightlife energy.",
    isHiddenGem: false,
    local: [0.75, 0.8, 0.72],
    roles: [0.58, 0.81, 0.46, 0.54]
  }),
  makeVenue({
    id: "sj-japantown-makers-market",
    name: "Japantown Makers Market",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "event",
    priceTier: "$$",
    tags: ["market", "discovery", "movement", "cultural-flow", "community"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "culture", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.91,
    underexposureScore: 0.84,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Local maker booths with rotating micro-experiences.",
    narrativeFlavor: "A cultural-flow wildcard that stitches together a layered Japantown route.",
    isHiddenGem: true,
    local: [0.82, 0.9, 0.58],
    roles: [0.6, 0.7, 0.95, 0.52]
  }),
  makeVenue({
    id: "sj-heritage-tea-house",
    name: "Heritage Tea House",
    neighborhood: "Rose Garden",
    driveMinutes: 11,
    category: "cafe",
    priceTier: "$$",
    tags: ["tea-room", "heritage", "quiet"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.8,
    underexposureScore: 0.76,
    shareabilityScore: 0.68,
    isChain: false,
    shortDescription: "Calm tea service in a heritage-style setting.",
    narrativeFlavor: "A graceful wind down for romantic and family routes.",
    isHiddenGem: true,
    local: [0.78, 0.82, 0.73],
    roles: [0.88, 0.44, 0.61, 0.94]
  }),
  makeVenue({
    id: "sj-story-road-ice-cream-social",
    name: "Story Road Ice Cream Social",
    neighborhood: "Evergreen",
    driveMinutes: 16,
    category: "dessert",
    priceTier: "$",
    tags: ["ice-cream", "family-friendly", "casual"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["playful", "cozy", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.72,
    distinctivenessScore: 0.66,
    underexposureScore: 0.55,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Simple dessert stop with broad crowd appeal.",
    narrativeFlavor: "A low-friction closing move after busier highlights.",
    isHiddenGem: false,
    local: [0.83, 0.79, 0.86],
    roles: [0.56, 0.5, 0.49, 0.91]
  }),
  makeVenue({
    id: "sj-alum-rock-picnic-grove",
    name: "Alum Rock Picnic Grove",
    neighborhood: "Alum Rock",
    driveMinutes: 20,
    category: "park",
    priceTier: "$",
    tags: ["picnic", "shade", "family-friendly"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.73,
    underexposureScore: 0.67,
    shareabilityScore: 0.7,
    isChain: false,
    shortDescription: "Scenic picnic pockets away from busier strips.",
    narrativeFlavor: "A restorative wind down for low-movement plans.",
    isHiddenGem: true,
    local: [0.76, 0.82, 0.65],
    roles: [0.8, 0.46, 0.58, 0.93]
  }),
  makeVenue({
    id: "sj-downtown-listening-room",
    name: "Downtown Listening Room",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "live_music",
    priceTier: "$$",
    tags: ["listening", "acoustic", "small-stage"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culture", "cozy", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.85,
    distinctivenessScore: 0.88,
    underexposureScore: 0.77,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Acoustic-forward room with a more intimate crowd.",
    narrativeFlavor: "A curated highlight that avoids noisy chaos.",
    isHiddenGem: true,
    local: [0.77, 0.81, 0.61],
    roles: [0.46, 0.82, 0.89, 0.5]
  }),
  makeVenue({
    id: "sj-sofa-indie-gallery-crawl",
    name: "SoFA Indie Gallery Crawl",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "event",
    priceTier: "$$",
    tags: ["gallery", "indie", "walkable"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "culture", "outdoors"],
    energyLevel: 2,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.91,
    underexposureScore: 0.86,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Light walking route through rotating local galleries.",
    narrativeFlavor: "A daytime surprise that feels premium and local.",
    isHiddenGem: true,
    local: [0.74, 0.86, 0.53],
    roles: [0.66, 0.74, 0.95, 0.52]
  }),
  makeVenue({
    id: "sj-makers-vintage-hall",
    name: "Makers and Vintage Hall",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "event",
    priceTier: "$$",
    tags: ["vintage", "community", "market"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["creative", "playful", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.86,
    underexposureScore: 0.8,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Curated vendors, vinyl, and rotating local makers.",
    narrativeFlavor: "A flexible surprise stop for curate-mode exploration.",
    isHiddenGem: true,
    local: [0.75, 0.79, 0.57],
    roles: [0.57, 0.68, 0.92, 0.45]
  }),
  makeVenue({
    id: "sj-riverwalk-boardgame-cafe",
    name: "Riverwalk Boardgame Cafe",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "cafe",
    priceTier: "$$",
    tags: ["board-games", "social", "low-key"],
    useCases: ["socialite", "curator"],
    vibeTags: ["playful", "relaxed", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.81,
    underexposureScore: 0.72,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Tabletop cafe with easy pacing for mixed groups.",
    narrativeFlavor: "A soft social stop that avoids second-peak endings.",
    isHiddenGem: true,
    local: [0.81, 0.78, 0.73],
    roles: [0.79, 0.52, 0.67, 0.88]
  }),
  makeVenue({
    id: "sj-preserve-botanical-studio",
    name: "Preserve Botanical Studio",
    neighborhood: "Willow Glen",
    driveMinutes: 13,
    category: "park",
    priceTier: "$$",
    tags: ["garden", "reset", "walkable", "open-air", "calm"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "cozy", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.89,
    underexposureScore: 0.84,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Small botanical pockets with quiet seating corners.",
    narrativeFlavor: "A low-intensity reset that improves Willow Glen sequence flow.",
    isHiddenGem: true,
    local: [0.8, 0.84, 0.66],
    roles: [0.9, 0.42, 0.72, 0.97]
  }),
  makeVenue({
    id: "sj-electric-alley-karaoke",
    name: "Electric Alley Karaoke",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "activity",
    priceTier: "$$",
    tags: ["karaoke", "group", "high-energy"],
    useCases: ["socialite"],
    vibeTags: ["lively", "playful", "creative"],
    energyLevel: 5,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.75,
    underexposureScore: 0.49,
    shareabilityScore: 0.91,
    isChain: false,
    shortDescription: "Private rooms and group sing-along energy.",
    narrativeFlavor: "A friends highlight with clear high-tempo payoff.",
    isHiddenGem: false,
    local: [0.78, 0.73, 0.71],
    roles: [0.38, 0.9, 0.75, 0.25]
  }),
  makeVenue({
    id: "sj-san-pedro-beer-garden",
    name: "San Pedro Beer Garden",
    neighborhood: "San Pedro",
    driveMinutes: 7,
    category: "bar",
    priceTier: "$$",
    tags: ["beer-garden", "social", "outdoor-seating"],
    useCases: ["socialite"],
    vibeTags: ["lively", "playful", "outdoors"],
    energyLevel: 4,
    uniquenessScore: 0.73,
    distinctivenessScore: 0.68,
    underexposureScore: 0.38,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Casual social stop with easy group seating.",
    narrativeFlavor: "A practical start or highlight for friends mode.",
    isHiddenGem: false,
    local: [0.81, 0.77, 0.82],
    roles: [0.62, 0.82, 0.43, 0.51]
  }),
  makeVenue({
    id: "sj-hidden-courtyard-cocktail",
    name: "Hidden Courtyard Cocktail Bar",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "bar",
    priceTier: "$$$",
    tags: ["speakeasy", "craft", "understated"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "creative", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.88,
    underexposureScore: 0.84,
    shareabilityScore: 0.83,
    isChain: false,
    shortDescription: "Quiet courtyard cocktails with local seasonal menus.",
    narrativeFlavor: "A high-value surprise for discovery-heavy plans.",
    isHiddenGem: true,
    local: [0.74, 0.78, 0.59],
    roles: [0.52, 0.77, 0.93, 0.65]
  }),
  makeVenue({
    id: "sj-sketchbook-supper-club",
    name: "Sketchbook Supper Club",
    neighborhood: "SoFA District",
    driveMinutes: 9,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["chef-led", "artful", "intimate"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "creative", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.89,
    distinctivenessScore: 0.9,
    underexposureScore: 0.76,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Art-forward tasting plates and conversational pacing.",
    narrativeFlavor: "A premium highlight with personality.",
    isHiddenGem: true,
    local: [0.76, 0.82, 0.62],
    roles: [0.54, 0.9, 0.79, 0.48]
  }),
  makeVenue({
    id: "sj-farmers-lane-food-hall",
    name: "Farmers Lane Food Hall Nights",
    neighborhood: "North San Jose",
    driveMinutes: 18,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "live-popups", "community"],
    useCases: ["socialite", "curator"],
    vibeTags: ["culinary", "playful", "lively"],
    energyLevel: 4,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.74,
    underexposureScore: 0.61,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Rotating food stalls with frequent local popups.",
    narrativeFlavor: "A social highlight or surprise for group outings.",
    isHiddenGem: false,
    local: [0.73, 0.71, 0.64],
    roles: [0.48, 0.83, 0.74, 0.44]
  }),
  makeVenue({
    id: "sj-moonlight-mini-golf",
    name: "Moonlight Mini Golf",
    neighborhood: "Downtown",
    driveMinutes: 8,
    category: "activity",
    priceTier: "$$",
    tags: ["mini-golf", "playful", "group"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["playful", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.77,
    distinctivenessScore: 0.73,
    underexposureScore: 0.58,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Easy playful competition with compact travel footprint.",
    narrativeFlavor: "A light-hearted surprise that still feels structured.",
    isHiddenGem: false,
    local: [0.76, 0.75, 0.7],
    roles: [0.5, 0.81, 0.79, 0.39]
  }),
  makeVenue({
    id: "sj-evergreen-observatory-nights",
    name: "Evergreen Observatory Nights",
    neighborhood: "Evergreen",
    driveMinutes: 21,
    category: "event",
    priceTier: "$$",
    tags: ["stargazing", "community", "quiet"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "outdoors", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.91,
    distinctivenessScore: 0.92,
    underexposureScore: 0.88,
    shareabilityScore: 0.77,
    isChain: false,
    shortDescription: "Local astronomy evenings with guided telescope access.",
    narrativeFlavor: "A distinctive surprise that is not nightlife-coded.",
    isHiddenGem: true,
    local: [0.7, 0.79, 0.49],
    roles: [0.6, 0.7, 0.95, 0.62]
  }),
  makeVenue({
    id: "sj-camera-obscura-photo-walk",
    name: "Camera Obscura Photo Walk",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "activity",
    priceTier: "$$",
    tags: ["photo-walk", "guided", "creative"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "outdoors", "culture"],
    energyLevel: 2,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.85,
    shareabilityScore: 0.91,
    isChain: false,
    shortDescription: "Guided city photo loop through overlooked scenic pockets.",
    narrativeFlavor: "A non-nightlife surprise with strong shareability.",
    isHiddenGem: true,
    local: [0.74, 0.81, 0.55],
    roles: [0.72, 0.73, 0.94, 0.58]
  }),
  makeVenue({
    id: "sj-orchard-artisan-gelato",
    name: "Orchard Artisan Gelato",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "dessert",
    priceTier: "$$",
    tags: ["gelato", "artisan", "walk-up"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.75,
    underexposureScore: 0.63,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Artisan scoops and low-friction seating for quick resets.",
    narrativeFlavor: "A smooth close that keeps the plan feeling complete.",
    isHiddenGem: true,
    local: [0.84, 0.77, 0.83],
    roles: [0.61, 0.46, 0.58, 0.94]
  }),
  makeVenue({
    id: "sj-rose-garden-bistro",
    name: "Rose Garden Bistro",
    neighborhood: "Rose Garden",
    driveMinutes: 11,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["neighborhood", "wine", "comfort"],
    useCases: ["romantic", "curator", "socialite"],
    vibeTags: ["culinary", "cozy", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.75,
    distinctivenessScore: 0.7,
    underexposureScore: 0.49,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Neighborhood bistro with polished but low-noise service.",
    narrativeFlavor: "A warm wind down for groups wanting an easy finish.",
    isHiddenGem: false,
    local: [0.82, 0.84, 0.86],
    roles: [0.64, 0.72, 0.44, 0.87]
  }),
  makeVenue({
    id: "sj-willow-glen-bookhouse",
    name: "Willow Glen Bookhouse",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "activity",
    priceTier: "$$",
    tags: ["bookshop", "intimate", "low-noise", "linger", "neighborhood"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.89,
    underexposureScore: 0.86,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Independent bookshop with curated shelves and quiet seating nooks.",
    narrativeFlavor: "A soft anchor that reinforces Willow Glen low-friction sequencing.",
    isHiddenGem: true,
    local: [0.88, 0.9, 0.78],
    roles: [0.94, 0.34, 0.62, 0.96]
  }),
  makeVenue({
    id: "sj-lincoln-avenue-deli",
    name: "Lincoln Avenue Deli",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "restaurant",
    priceTier: "$$",
    tags: ["deli", "neighborhood", "quiet", "linger"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "relaxed"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.75,
    distinctivenessScore: 0.72,
    underexposureScore: 0.63,
    shareabilityScore: 0.68,
    isChain: false,
    shortDescription: "Local deli counter with polished comfort classics.",
    narrativeFlavor: "A low-noise support stop that keeps Willow Glen cohesive.",
    isHiddenGem: false,
    local: [0.87, 0.88, 0.84],
    roles: [0.84, 0.58, 0.41, 0.79]
  }),
  makeVenue({
    id: "sj-willow-glen-bakehouse",
    name: "Willow Glen Bakehouse",
    neighborhood: "Willow Glen",
    driveMinutes: 11,
    category: "dessert",
    priceTier: "$$",
    tags: ["bakery", "artisan", "intimate", "low-noise", "linger", "neighborhood"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.84,
    underexposureScore: 0.78,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Neighborhood pastry shop known for buttery seasonal bakes.",
    narrativeFlavor: "An easy warmup or wind-down that supports emotionally soft pacing.",
    isHiddenGem: true,
    local: [0.9, 0.91, 0.82],
    roles: [0.82, 0.4, 0.53, 0.96]
  }),
  makeVenue({
    id: "sj-willow-court-wine-bar",
    name: "Willow Court Wine Bar",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$$",
    tags: ["wine-bar", "wine", "intimate", "conversation", "slow-dining", "linger", "date night"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "culinary", "culture"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.88,
    underexposureScore: 0.79,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Quiet pours and small plates with neighborhood patio energy.",
    narrativeFlavor: "A slower dinner-wine anchor with strong conversation gravity.",
    isHiddenGem: true,
    local: [0.91, 0.93, 0.82],
    roles: [0.68, 0.97, 0.66, 0.93]
  }),
  makeVenue({
    id: "sj-lincoln-avenue-pasta-room",
    name: "Lincoln Avenue Pasta Room",
    neighborhood: "Willow Glen",
    driveMinutes: 13,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["italian", "intimate", "conversation", "slow-dining", "quiet"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.83,
    underexposureScore: 0.69,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Quieter dinner room with handmade pasta and slower service pacing.",
    narrativeFlavor: "A slower dinner anchor that keeps Willow Glen soft and settled.",
    isHiddenGem: false,
    local: [0.83, 0.87, 0.75],
    roles: [0.5, 0.94, 0.42, 0.74]
  }),
  makeVenue({
    id: "sj-bramhall-park-promenade",
    name: "Bramhall Park Promenade",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "park",
    priceTier: "$",
    tags: ["park", "reset", "walkable", "open air", "stroll", "linger"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "cozy", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.76,
    underexposureScore: 0.74,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Shaded neighborhood park loop with calm evening foot traffic.",
    narrativeFlavor: "A reset anchor that strengthens warmup and cooldown sequence quality.",
    isHiddenGem: false,
    local: [0.86, 0.91, 0.84],
    roles: [0.93, 0.44, 0.68, 0.98]
  }),
  makeVenue({
    id: "sj-willow-glen-village-stroll",
    name: "Willow Glen Village Stroll",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "event",
    priceTier: "$$",
    tags: ["main-street", "walkable", "stroll", "open air", "reset", "community", "sequence"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "cozy", "outdoors"],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.9,
    underexposureScore: 0.84,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Evening-friendly main-street micro events and local storefront popups.",
    narrativeFlavor: "A stroll anchor that links coffee, reset, and slower dinner in one district rhythm.",
    isHiddenGem: true,
    local: [0.86, 0.92, 0.72],
    roles: [0.82, 0.78, 0.95, 0.92]
  }),
  makeVenue({
    id: "sj-jtown-santo-market-counter",
    name: "Santo Market Counter",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "restaurant",
    priceTier: "$$",
    tags: ["japanese", "authentic", "local", "cultural"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 2,
    socialDensity: 3,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.88,
    underexposureScore: 0.73,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Japanese comfort plates with a long-running neighborhood following.",
    narrativeFlavor: "An authentic food-forward anchor with clear cultural specificity.",
    isHiddenGem: true,
    local: [0.9, 0.92, 0.79],
    roles: [0.66, 0.83, 0.55, 0.66]
  }),
  makeVenue({
    id: "sj-jtown-manju-house",
    name: "Jtown Manju House",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "dessert",
    priceTier: "$$",
    tags: ["wagashi", "confectionary", "dessert", "cultural-anchor", "unique", "historic", "local-only", "signature"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 1,
    uniquenessScore: 0.93,
    distinctivenessScore: 0.96,
    underexposureScore: 0.87,
    shareabilityScore: 0.94,
    isChain: false,
    shortDescription: "Traditional Japanese sweets with seasonal handmade rotation.",
    narrativeFlavor: "A heritage confectionary anchor that reads uniquely Japantown.",
    isHiddenGem: true,
    local: [0.94, 0.95, 0.8],
    roles: [0.84, 0.66, 0.79, 0.95]
  }),
  makeVenue({
    id: "sj-jtown-matcha-kissaten",
    name: "Jtown Matcha Kissaten",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "cafe",
    priceTier: "$$",
    tags: ["matcha", "tea", "cultural-anchor", "historic", "slow-cafe"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.86,
    underexposureScore: 0.8,
    shareabilityScore: 0.75,
    isChain: false,
    shortDescription: "Tea-focused cafe with quiet seating and measured pacing.",
    narrativeFlavor: "A calm cultural warmup that deepens Japantown identity.",
    isHiddenGem: true,
    local: [0.87, 0.91, 0.74],
    roles: [0.91, 0.39, 0.6, 0.95]
  }),
  makeVenue({
    id: "sj-jtown-ramen-ya",
    name: "Jtown Ramen Ya",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "restaurant",
    priceTier: "$$",
    tags: ["ramen", "authentic", "local", "cultural", "small-dining", "neighborhood", "noodle-house"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "lively", "culture"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.88,
    underexposureScore: 0.72,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Neighborhood ramen room with line-friendly evening energy.",
    narrativeFlavor: "An authentic dining anchor with medium-noise neighborhood buzz.",
    isHiddenGem: false,
    local: [0.9, 0.92, 0.85],
    roles: [0.68, 0.95, 0.62, 0.7]
  }),
  makeVenue({
    id: "sj-jtown-sake-corner",
    name: "Jtown Sake Corner",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "bar",
    priceTier: "$$$",
    tags: ["sake", "small-plates", "authentic", "local", "cultural", "conversation"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culture", "cozy", "culinary"],
    energyLevel: 2,
    socialDensity: 3,
    uniquenessScore: 0.85,
    distinctivenessScore: 0.84,
    underexposureScore: 0.71,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Small sake list and shareable plates in a low-light room.",
    narrativeFlavor: "A culturally specific small-room peak with conversation-forward pacing.",
    isHiddenGem: true,
    local: [0.83, 0.88, 0.72],
    roles: [0.5, 0.81, 0.65, 0.8]
  }),
  makeVenue({
    id: "sj-jtown-okayama-mural-walk",
    name: "Okayama Mural Walk",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "activity",
    priceTier: "$",
    tags: ["murals", "historic", "curated", "immersive", "discovery", "movement", "cultural-flow", "local-only", "walkable"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "outdoors", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.94,
    distinctivenessScore: 0.96,
    underexposureScore: 0.89,
    shareabilityScore: 0.94,
    isChain: false,
    shortDescription: "Guided-lite mural loop highlighting neighborhood history markers.",
    narrativeFlavor: "A discovery-led movement anchor that layers history into the route.",
    isHiddenGem: true,
    local: [0.88, 0.93, 0.66],
    roles: [0.82, 0.78, 0.98, 0.84]
  }),
  makeVenue({
    id: "sj-jtown-jamsj-gallery",
    name: "Japanese American Gallery SJ",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "museum",
    priceTier: "$$",
    tags: ["heritage", "historic", "cultural-anchor", "unique", "exhibits"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "creative", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.92,
    underexposureScore: 0.81,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Compact gallery documenting Japanese American local history.",
    narrativeFlavor: "A layered cultural support venue with strong neighborhood specificity.",
    isHiddenGem: true,
    local: [0.86, 0.92, 0.69],
    roles: [0.74, 0.67, 0.8, 0.89]
  }),
  makeVenue({
    id: "sj-jtown-jacques-plaza",
    name: "Jacques Plaza Courtyard",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "park",
    priceTier: "$",
    tags: ["courtyard", "discovery", "movement", "cultural-flow", "walkable"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.72,
    distinctivenessScore: 0.71,
    underexposureScore: 0.62,
    shareabilityScore: 0.69,
    isChain: false,
    shortDescription: "Small public courtyard with easy pauses between food stops.",
    narrativeFlavor: "A movement-friendly connector that improves Japantown sequence flow.",
    isHiddenGem: false,
    local: [0.79, 0.86, 0.77],
    roles: [0.79, 0.34, 0.56, 0.96]
  }),
  makeVenue({
    id: "sj-jtown-culture-night-market",
    name: "Jtown Culture Night Market",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "event",
    priceTier: "$$",
    tags: ["night-market", "night market", "event", "cultural-energy", "market", "vendor", "curated", "discovery", "movement", "cultural-flow"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "lively", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.92,
    distinctivenessScore: 0.96,
    underexposureScore: 0.91,
    shareabilityScore: 0.91,
    isChain: false,
    shortDescription: "Periodic market nights with Japanese food stalls and maker booths.",
    narrativeFlavor: "A layered event anchor that delivers distinctive cultural energy.",
    isHiddenGem: true,
    local: [0.87, 0.94, 0.68],
    roles: [0.72, 0.9, 0.98, 0.76]
  })
];
var denverVenues = [
  makeVenue({
    id: "de-union-station-coffee-hall",
    name: "Union Station Coffee Hall",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 8,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "historic", "warmup", "walkable"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.82,
    underexposureScore: 0.61,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Historic station coffee ritual with easy walking access.",
    narrativeFlavor: "A polished start anchor with classic LoDo character.",
    isHiddenGem: false,
    local: [0.83, 0.81, 0.77],
    roles: [0.94, 0.45, 0.52, 0.82]
  }),
  makeVenue({
    id: "de-mercantile-dining",
    name: "Mercantile Dining Hall",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["chef-led", "lodo", "seasonal", "conversation"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 3,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.83,
    underexposureScore: 0.59,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Refined dining with local sourcing and steady pacing.",
    narrativeFlavor: "A strong food anchor that keeps Downtown/LoDo intentional.",
    isHiddenGem: false,
    local: [0.82, 0.79, 0.71],
    roles: [0.55, 0.91, 0.47, 0.46]
  }),
  makeVenue({
    id: "de-cooper-lounge",
    name: "Cooper Lounge Loft",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "historic", "conversation", "slow-dining"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "culture", "creative"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.8,
    underexposureScore: 0.56,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Rail-station cocktail room with a slower social pulse.",
    narrativeFlavor: "An elevated highlight without generic nightlife noise.",
    isHiddenGem: false,
    local: [0.78, 0.75, 0.72],
    roles: [0.48, 0.84, 0.52, 0.72]
  }),
  makeVenue({
    id: "de-larimer-square-stroll",
    name: "Larimer Square Stroll",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 8,
    category: "activity",
    priceTier: "$",
    tags: ["walkable", "historic", "lights", "movement"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "outdoors", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.81,
    underexposureScore: 0.58,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Historic block walk with easy transitions between stops.",
    narrativeFlavor: "A sequence connector that keeps Downtown cohesive.",
    isHiddenGem: false,
    local: [0.79, 0.84, 0.76],
    roles: [0.8, 0.62, 0.92, 0.83]
  }),
  makeVenue({
    id: "de-dairy-block-alley",
    name: "Dairy Block Alley Market",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 8,
    category: "event",
    priceTier: "$$",
    tags: ["market", "courtyard", "event", "walkable"],
    useCases: ["socialite", "curator"],
    vibeTags: ["lively", "culture", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.79,
    underexposureScore: 0.63,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Micro-market corridor with rotating food and makers.",
    narrativeFlavor: "A compact event node with layered downtown options.",
    isHiddenGem: true,
    local: [0.8, 0.83, 0.7],
    roles: [0.62, 0.88, 0.9, 0.58]
  }),
  makeVenue({
    id: "de-milk-market-hall",
    name: "Milk Market Hall",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "group-friendly", "social", "variety"],
    useCases: ["socialite", "curator"],
    vibeTags: ["lively", "culinary", "creative"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.76,
    underexposureScore: 0.44,
    shareabilityScore: 0.81,
    isChain: false,
    shortDescription: "Food hall anchor with broad group-friendly optionality.",
    narrativeFlavor: "A reliable lively hinge for mixed groups in LoDo.",
    isHiddenGem: false,
    local: [0.76, 0.73, 0.74],
    roles: [0.46, 0.9, 0.71, 0.42]
  }),
  makeVenue({
    id: "de-commons-park-riverwalk",
    name: "Commons Park Riverwalk",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 10,
    category: "park",
    priceTier: "$",
    tags: ["riverwalk", "reset", "open-air", "walkable"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.72,
    underexposureScore: 0.62,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Riverfront walk with soft pacing near LoDo.",
    narrativeFlavor: "A clean cooldown/reset option that keeps downtown flexible.",
    isHiddenGem: false,
    local: [0.78, 0.81, 0.79],
    roles: [0.86, 0.38, 0.58, 0.95]
  }),
  makeVenue({
    id: "de-lodo-jazz-room",
    name: "LoDo Jazz Room",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "live_music",
    priceTier: "$$",
    tags: ["jazz", "listening", "small-stage", "night"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "cozy", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.86,
    underexposureScore: 0.74,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Intimate listening room with late-evening cultural pull.",
    narrativeFlavor: "A cultured highlight that avoids generic loudness.",
    isHiddenGem: true,
    local: [0.82, 0.86, 0.68],
    roles: [0.44, 0.87, 0.93, 0.62]
  }),
  makeVenue({
    id: "de-source-market-hall",
    name: "The Source Market Hall",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "event",
    priceTier: "$$",
    tags: ["market", "discovery", "cultural-flow", "local-only"],
    useCases: ["socialite", "curator"],
    vibeTags: ["creative", "culture", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.91,
    underexposureScore: 0.77,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Curated market hall with strong local-maker identity.",
    narrativeFlavor: "A discovery-first RiNo anchor with layered options.",
    isHiddenGem: true,
    local: [0.88, 0.9, 0.72],
    roles: [0.72, 0.9, 0.95, 0.66]
  }),
  makeVenue({
    id: "de-rino-central-market",
    name: "RiNo Central Market",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "discovery", "walkable", "social"],
    useCases: ["socialite", "curator"],
    vibeTags: ["culinary", "creative", "lively"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.8,
    underexposureScore: 0.58,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "RiNo food hall with casual hopping between micro-vendors.",
    narrativeFlavor: "A flexible lively anchor for friend-led flows.",
    isHiddenGem: false,
    local: [0.8, 0.78, 0.74],
    roles: [0.58, 0.9, 0.81, 0.53]
  }),
  makeVenue({
    id: "de-improper-city",
    name: "Improper City Yard",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$",
    tags: ["patio", "social", "event", "outdoor"],
    useCases: ["socialite"],
    vibeTags: ["lively", "outdoors", "creative"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.79,
    underexposureScore: 0.52,
    shareabilityScore: 0.87,
    isChain: false,
    shortDescription: "Large patio social anchor with rotating events.",
    narrativeFlavor: "A momentum-heavy RiNo peak for lively crews.",
    isHiddenGem: false,
    local: [0.79, 0.78, 0.75],
    roles: [0.34, 0.94, 0.78, 0.36]
  }),
  makeVenue({
    id: "de-death-co-rino",
    name: "Death & Co RiNo",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "intimate", "conversation", "signature"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "creative", "culinary"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.68,
    shareabilityScore: 0.89,
    isChain: false,
    shortDescription: "Focused cocktail room with craft-forward identity.",
    narrativeFlavor: "A signature peak that keeps RiNo distinct.",
    isHiddenGem: false,
    local: [0.84, 0.83, 0.71],
    roles: [0.46, 0.92, 0.66, 0.72]
  }),
  makeVenue({
    id: "de-rino-art-alley",
    name: "RiNo Art Alley Walk",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "activity",
    priceTier: "$",
    tags: ["murals", "discovery", "movement", "cultural-flow"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "culture", "outdoors"],
    energyLevel: 2,
    uniquenessScore: 0.94,
    distinctivenessScore: 0.95,
    underexposureScore: 0.9,
    shareabilityScore: 0.95,
    isChain: false,
    shortDescription: "Mural-lined route with strong discovery and photo moments.",
    narrativeFlavor: "A high-distinctiveness movement anchor for RiNo.",
    isHiddenGem: true,
    local: [0.9, 0.94, 0.7],
    roles: [0.84, 0.72, 0.98, 0.82]
  }),
  makeVenue({
    id: "de-ratio-beerworks",
    name: "Ratio Beerworks",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$",
    tags: ["local", "beer", "social", "event-friendly"],
    useCases: ["socialite"],
    vibeTags: ["lively", "creative", "culture"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.77,
    underexposureScore: 0.57,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Local beer anchor with energetic neighborhood flow.",
    narrativeFlavor: "A practical lively support venue in the RiNo pocket.",
    isHiddenGem: false,
    local: [0.77, 0.8, 0.8],
    roles: [0.31, 0.88, 0.71, 0.38]
  }),
  makeVenue({
    id: "de-huckleberry-rino",
    name: "Huckleberry Roasters RiNo",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "warmup", "local", "low-noise"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "creative", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.81,
    underexposureScore: 0.67,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Coffee-forward warmup stop with calmer pacing.",
    narrativeFlavor: "A soft entry point before RiNo discovery momentum.",
    isHiddenGem: true,
    local: [0.82, 0.84, 0.76],
    roles: [0.92, 0.43, 0.55, 0.85]
  }),
  makeVenue({
    id: "de-rino-craft-gelato",
    name: "RiNo Craft Gelato",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "dessert",
    priceTier: "$$",
    tags: ["dessert", "local", "shareable", "cooldown"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.82,
    underexposureScore: 0.71,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Small-batch dessert stop that softens the end of the arc.",
    narrativeFlavor: "A sweet cooldown for layered RiNo sequences.",
    isHiddenGem: true,
    local: [0.8, 0.83, 0.77],
    roles: [0.66, 0.58, 0.62, 0.94]
  }),
  makeVenue({
    id: "de-aviano-cherry-creek",
    name: "Aviano Coffee Cherry Creek",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 13,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "intimate", "linger", "neighborhood"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.79,
    underexposureScore: 0.6,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Neighborhood coffee anchor with slower pacing.",
    narrativeFlavor: "A soft starter for Cherry Creek cozy flows.",
    isHiddenGem: false,
    local: [0.8, 0.81, 0.79],
    roles: [0.93, 0.39, 0.46, 0.84]
  }),
  makeVenue({
    id: "de-local-jones",
    name: "Local Jones Dining",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["neighborhood", "conversation", "slow-dining", "chef-led"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.78,
    underexposureScore: 0.52,
    shareabilityScore: 0.81,
    isChain: false,
    shortDescription: "Polished neighborhood dining with conversation-friendly pacing.",
    narrativeFlavor: "A reliable dinner anchor for Cherry Creek evening arcs.",
    isHiddenGem: false,
    local: [0.79, 0.76, 0.75],
    roles: [0.58, 0.88, 0.43, 0.5]
  }),
  makeVenue({
    id: "de-cherry-creek-trail-loop",
    name: "Cherry Creek Trail Loop",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "park",
    priceTier: "$",
    tags: ["trail", "walkable", "reset", "open-air"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.77,
    distinctivenessScore: 0.75,
    underexposureScore: 0.64,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Scenic trail segment that supports low-friction transitions.",
    narrativeFlavor: "A clean reset lane inside Cherry Creek plans.",
    isHiddenGem: false,
    local: [0.82, 0.86, 0.8],
    roles: [0.86, 0.34, 0.54, 0.95]
  }),
  makeVenue({
    id: "de-cherry-creek-art-walk",
    name: "Cherry Creek North Art Walk",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 13,
    category: "activity",
    priceTier: "$",
    tags: ["gallery", "walkable", "curated", "discovery"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "creative", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.85,
    underexposureScore: 0.75,
    shareabilityScore: 0.83,
    isChain: false,
    shortDescription: "Compact gallery loop with approachable cultural depth.",
    narrativeFlavor: "A cultured connector that keeps Cherry Creek intentional.",
    isHiddenGem: true,
    local: [0.81, 0.86, 0.73],
    roles: [0.8, 0.69, 0.88, 0.83]
  }),
  makeVenue({
    id: "de-forget-me-not-wine",
    name: "Forget Me Not Wine Room",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "bar",
    priceTier: "$$$",
    tags: ["wine", "intimate", "conversation", "slow"],
    useCases: ["romantic"],
    vibeTags: ["cozy", "culinary", "culture"],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.82,
    underexposureScore: 0.69,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Low-noise wine room suited for slower evening pacing.",
    narrativeFlavor: "A romantic anchor that preserves Cherry Creek softness.",
    isHiddenGem: true,
    local: [0.79, 0.83, 0.74],
    roles: [0.46, 0.78, 0.55, 0.88]
  }),
  makeVenue({
    id: "de-matsuhisa-cherry-creek",
    name: "Matsuhisa Cherry Creek",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 15,
    category: "restaurant",
    priceTier: "$$$$",
    tags: ["japanese", "chef-led", "signature", "special-occasion"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 3,
    uniquenessScore: 0.85,
    distinctivenessScore: 0.84,
    underexposureScore: 0.5,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "High-polish Japanese dining with strong occasion value.",
    narrativeFlavor: "A premium anchor that still fits Cherry Creek pacing.",
    isHiddenGem: false,
    local: [0.77, 0.75, 0.71],
    roles: [0.52, 0.9, 0.45, 0.44]
  }),
  makeVenue({
    id: "de-noisette-confectionery",
    name: "Noisette Confectionery",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 13,
    category: "dessert",
    priceTier: "$$",
    tags: ["pastry", "confectionary", "shareable", "calm"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.87,
    underexposureScore: 0.78,
    shareabilityScore: 0.92,
    isChain: false,
    shortDescription: "Fine pastry stop with strong cooldown usefulness.",
    narrativeFlavor: "A soft ending move for Cherry Creek cozy/cultured arcs.",
    isHiddenGem: true,
    local: [0.83, 0.87, 0.76],
    roles: [0.79, 0.58, 0.62, 0.97]
  }),
  makeVenue({
    id: "de-cherry-creek-fresh-market",
    name: "Cherry Creek Fresh Market Plaza",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "event",
    priceTier: "$$",
    tags: ["market", "local", "walkable", "discovery"],
    useCases: ["socialite", "curator"],
    vibeTags: ["culture", "outdoors", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.8,
    underexposureScore: 0.72,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Neighborhood market node with local food and makers.",
    narrativeFlavor: "A discovery layer that broadens Cherry Creek options.",
    isHiddenGem: true,
    local: [0.82, 0.86, 0.72],
    roles: [0.68, 0.82, 0.9, 0.62]
  }),
  makeVenue({
    id: "de-little-man-ice-cream",
    name: "Little Man Ice Cream",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "dessert",
    priceTier: "$$",
    tags: ["dessert", "local-icon", "shareable", "line-energy"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["playful", "cozy", "culinary"],
    energyLevel: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.65,
    shareabilityScore: 0.95,
    isChain: false,
    shortDescription: "Neighborhood icon dessert stop with social-friendly momentum.",
    narrativeFlavor: "A signature LoHi moment with high shareability.",
    isHiddenGem: false,
    local: [0.86, 0.9, 0.8],
    roles: [0.66, 0.83, 0.69, 0.94]
  }),
  makeVenue({
    id: "de-linger-lohi",
    name: "Linger LoHi",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["rooftop", "social", "signature", "dinner"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.83,
    underexposureScore: 0.55,
    shareabilityScore: 0.89,
    isChain: false,
    shortDescription: "Popular LoHi dinner anchor with skyline-forward feel.",
    narrativeFlavor: "A high-confidence highlight for Highlands outings.",
    isHiddenGem: false,
    local: [0.8, 0.79, 0.76],
    roles: [0.41, 0.93, 0.54, 0.45]
  }),
  makeVenue({
    id: "de-williams-graham",
    name: "Williams & Graham",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "intimate", "conversation", "speakeasy"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "creative", "culinary"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.9,
    underexposureScore: 0.7,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Small cocktail room with higher intimacy than typical nightlife.",
    narrativeFlavor: "A signature LoHi anchor that preserves conversation quality.",
    isHiddenGem: false,
    local: [0.84, 0.86, 0.73],
    roles: [0.43, 0.9, 0.63, 0.79]
  }),
  makeVenue({
    id: "de-lohi-bridge-stroll",
    name: "LoHi Bridge Stroll",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "activity",
    priceTier: "$",
    tags: ["walkable", "bridge-view", "movement", "reset"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.8,
    underexposureScore: 0.68,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Short scenic stroll linking LoHi anchors.",
    narrativeFlavor: "A low-friction movement lane for Highlands sequences.",
    isHiddenGem: true,
    local: [0.83, 0.88, 0.78],
    roles: [0.84, 0.61, 0.95, 0.87]
  }),
  makeVenue({
    id: "de-avanti-lohi",
    name: "Avanti LoHi Collective",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "rooftop", "social", "event"],
    useCases: ["socialite"],
    vibeTags: ["lively", "culinary", "creative"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.79,
    underexposureScore: 0.5,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Rooftop food hall with event-style neighborhood energy.",
    narrativeFlavor: "A broad, lively support anchor inside LoHi.",
    isHiddenGem: false,
    local: [0.79, 0.77, 0.74],
    roles: [0.45, 0.92, 0.83, 0.4]
  }),
  makeVenue({
    id: "de-highlands-square-cafe",
    name: "Highlands Square Cafe",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 13,
    category: "cafe",
    priceTier: "$$",
    tags: ["neighborhood", "coffee", "low-noise", "linger"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "relaxed", "culture"],
    energyLevel: 2,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.76,
    underexposureScore: 0.65,
    shareabilityScore: 0.71,
    isChain: false,
    shortDescription: "Calmer neighborhood cafe suited to warmup and reset roles.",
    narrativeFlavor: "A soft support venue that improves LoHi arc shape.",
    isHiddenGem: true,
    local: [0.8, 0.84, 0.8],
    roles: [0.9, 0.38, 0.49, 0.9]
  }),
  makeVenue({
    id: "de-confluence-overlook-park",
    name: "Confluence Overlook Park",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "park",
    priceTier: "$",
    tags: ["open-air", "reset", "stroll", "river"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.76,
    distinctivenessScore: 0.73,
    underexposureScore: 0.66,
    shareabilityScore: 0.78,
    isChain: false,
    shortDescription: "Riverside park reset with easy transitions into LoHi dining.",
    narrativeFlavor: "A cooldown-friendly anchor for softer Highlands flows.",
    isHiddenGem: false,
    local: [0.81, 0.87, 0.82],
    roles: [0.85, 0.33, 0.57, 0.97]
  }),
  makeVenue({
    id: "de-lohi-acoustic-room",
    name: "LoHi Acoustic Room",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "live_music",
    priceTier: "$$",
    tags: ["acoustic", "small-stage", "listening", "intimate"],
    useCases: ["romantic", "curator", "socialite"],
    vibeTags: ["culture", "cozy", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.85,
    underexposureScore: 0.77,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Small-room performances with strong conversation compatibility.",
    narrativeFlavor: "A cultured support highlight that keeps LoHi specific.",
    isHiddenGem: true,
    local: [0.82, 0.86, 0.69],
    roles: [0.47, 0.78, 0.9, 0.7]
  })
];
var curatedVenues = [...sanJoseVenues, ...denverVenues];

// src/domain/retrieval/retrieveVenues.ts
function sanitize(value) {
  return value.trim().toLowerCase();
}
function sanitizeToken(value) {
  return value.trim().toLowerCase().replace(/[^\w\s]+/g, " ").replace(/\s+/g, " ").trim();
}
function sanitizeCity(value) {
  const normalized = sanitize(value).replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).trim();
}
function hasCuratedCityCoverage(venues, cityQuery) {
  if (!cityQuery) {
    return false;
  }
  const count = venues.filter((venue) => sanitizeCity(venue.city) === cityQuery).length;
  return count >= 10;
}
function ensureVenueHasHappenings(venue) {
  if (venue.source.happenings) {
    return venue;
  }
  return {
    ...venue,
    source: {
      ...venue.source,
      happenings: deriveVenueHappeningsSignals(venue)
    }
  };
}
function buildExcludedDiagnostics(venues) {
  return venues.map((venue) => ({
    venueId: venue.id,
    venueName: venue.name,
    sourceOrigin: venue.source.sourceOrigin,
    provider: venue.source.provider,
    qualityGateStatus: venue.source.qualityGateStatus,
    sourceConfidence: Number((venue.source.sourceConfidence * 100).toFixed(1)),
    completenessScore: Number((venue.source.completenessScore * 100).toFixed(1)),
    normalizedCategory: venue.category,
    reasons: venue.source.suppressionReasons
  }));
}
function countBySource(venues) {
  return venues.reduce(
    (acc, venue) => {
      acc[venue.source.sourceOrigin] += 1;
      return acc;
    },
    { curated: 0, live: 0 }
  );
}
function buildSourcePool(requestedSourceMode, curatedVenues2, liveVenues) {
  if (requestedSourceMode === "curated") {
    return curatedVenues2;
  }
  if (requestedSourceMode === "live") {
    return liveVenues;
  }
  return [...curatedVenues2, ...liveVenues];
}
function resolveRequiredInventoryVenues(availableVenues, seedVenues, dedupeLosses) {
  if (!seedVenues || seedVenues.length === 0) {
    return [];
  }
  const venueById = new Map(availableVenues.map((venue) => [venue.id, venue]));
  return seedVenues.map((seedVenue) => {
    const exactMatch = venueById.get(seedVenue.id);
    if (exactMatch) {
      return exactMatch;
    }
    const dedupeResolvedVenueId = dedupeLosses.find(
      (loss) => loss.removedVenueId === seedVenue.id
    )?.keptVenueId;
    if (dedupeResolvedVenueId) {
      const dedupeResolvedVenue = venueById.get(dedupeResolvedVenueId);
      if (dedupeResolvedVenue) {
        return dedupeResolvedVenue;
      }
    }
    return availableVenues.find((venue) => {
      if (seedVenue.source.providerRecordId && venue.source.providerRecordId === seedVenue.source.providerRecordId) {
        return true;
      }
      return venue.category === seedVenue.category && sanitize(venue.name) === sanitize(seedVenue.name) && sanitize(venue.city) === sanitize(seedVenue.city) && sanitize(venue.neighborhood) === sanitize(seedVenue.neighborhood);
    });
  }).filter((venue) => Boolean(venue)).filter(
    (venue, index, collection) => collection.findIndex((candidate) => candidate.id === venue.id) === index
  );
}
function mergeRequiredVenues(primaryVenues, requiredVenues) {
  if (requiredVenues.length === 0) {
    return primaryVenues;
  }
  const merged = [...requiredVenues];
  const seenIds = new Set(requiredVenues.map((venue) => venue.id));
  for (const venue of primaryVenues) {
    if (seenIds.has(venue.id)) {
      continue;
    }
    merged.push(venue);
    seenIds.add(venue.id);
  }
  return merged;
}
function isFoodDrinkCategory(category) {
  return category === "restaurant" || category === "bar" || category === "cafe" || category === "dessert";
}
function collectCategoryLikeTokens(venue) {
  const normalized = `${venue.subcategory} ${venue.tags.join(" ")} ${venue.source.sourceTypes.join(" ")}`.toLowerCase();
  return new Set(
    normalized.split(/[\s,./()_-]+/).map((token) => token.trim()).filter(Boolean)
  );
}
function isCulturalOpportunity(venue) {
  const tokens = collectCategoryLikeTokens(venue);
  return venue.category === "museum" || tokens.has("gallery") || tokens.has("theatre") || tokens.has("theater") || tokens.has("opera") || tokens.has("historic") || tokens.has("cultural");
}
function isCommunityOpportunity(venue) {
  const tokens = collectCategoryLikeTokens(venue);
  return venue.category === "event" || tokens.has("market") || tokens.has("night") || tokens.has("community") || tokens.has("festival") || tokens.has("vendor");
}
function isAtmosphericOpportunity(venue) {
  const tokens = collectCategoryLikeTokens(venue);
  return venue.category === "park" || tokens.has("garden") || tokens.has("trail") || tokens.has("scenic") || tokens.has("walk");
}
function isPerformanceOpportunity(venue) {
  return venue.category === "live_music" || venue.settings.musicCapable || venue.settings.performanceCapable;
}
function isStrictPerformanceClass(venue) {
  return venue.category === "live_music";
}
function isStrictCulturalClass(venue) {
  const tokens = collectCategoryLikeTokens(venue);
  return venue.category === "museum" || tokens.has("gallery") || tokens.has("theatre") || tokens.has("theater") || tokens.has("opera");
}
function isStrictCommunityClass(venue) {
  const tokens = collectCategoryLikeTokens(venue);
  return venue.category === "event" || tokens.has("market") || tokens.has("night-market") || tokens.has("nightmarket") || tokens.has("festival");
}
function isStrictAtmosphericClass(venue) {
  const tokens = collectCategoryLikeTokens(venue);
  return venue.category === "park" || tokens.has("garden") || tokens.has("trail") || tokens.has("scenic");
}
function isMajorVenueOpportunity(venue) {
  const signals = deriveVenueHappeningsSignals(venue);
  return signals.majorVenueStrength >= 0.52 || signals.culturalAnchorPotential >= 0.64;
}
function hasHappeningsBreadth(venue) {
  return isCulturalOpportunity(venue) || isCommunityOpportunity(venue) || isAtmosphericOpportunity(venue) || isPerformanceOpportunity(venue) || isMajorVenueOpportunity(venue);
}
function scoreHappeningsRecovery(venue, lensCompatibility) {
  const signals = deriveVenueHappeningsSignals(venue);
  const breadthBoost = hasHappeningsBreadth(venue) ? 0.1 : 0;
  return lensCompatibility * 0.45 + signals.culturalAnchorPotential * 0.15 + signals.eventPotential * 0.12 + signals.performancePotential * 0.1 + signals.hotspotStrength * 0.08 + signals.currentRelevance * 0.06 + signals.majorVenueStrength * 0.04 + breadthBoost;
}
function ensureHappeningsPreservation(shapedCandidates, filteredByLens, compatibilityThreshold) {
  if (shapedCandidates.length === 0 || filteredByLens.length === 0) {
    return filteredByLens;
  }
  const existingIds = new Set(filteredByLens.map((candidate) => candidate.venue.id));
  const currentlyBroad = filteredByLens.filter((candidate) => hasHappeningsBreadth(candidate.venue));
  const targetBroadCount = Math.min(
    8,
    Math.max(4, Math.ceil(filteredByLens.length * 0.24))
  );
  const minCompatibility = Math.max(0.18, compatibilityThreshold - 0.22);
  const supplemental = shapedCandidates.filter((candidate) => !existingIds.has(candidate.venue.id)).filter((candidate) => candidate.lensCompatibility >= minCompatibility).filter((candidate) => hasHappeningsBreadth(candidate.venue)).map((candidate) => ({
    ...candidate,
    recoveryScore: scoreHappeningsRecovery(candidate.venue, candidate.lensCompatibility)
  })).filter((candidate) => candidate.recoveryScore >= 0.5).sort(
    (left, right) => right.recoveryScore - left.recoveryScore || right.lensCompatibility - left.lensCompatibility || left.venue.name.localeCompare(right.venue.name)
  );
  const selectedSupplemental = [];
  const requiredSegments = [
    (venue) => isStrictPerformanceClass(venue),
    (venue) => isStrictCulturalClass(venue),
    (venue) => isStrictCommunityClass(venue),
    (venue) => isStrictAtmosphericClass(venue)
  ];
  for (const segmentCheck of requiredSegments) {
    const segmentExists = currentlyBroad.some((candidate) => segmentCheck(candidate.venue)) || selectedSupplemental.some((candidate) => segmentCheck(candidate.venue));
    if (segmentExists) {
      continue;
    }
    const strictSegmentCandidate = shapedCandidates.filter((candidate) => !existingIds.has(candidate.venue.id)).filter(
      (candidate) => !selectedSupplemental.some((selected) => selected.venue.id === candidate.venue.id)
    ).filter((candidate) => candidate.lensCompatibility >= Math.max(0.12, minCompatibility - 0.1)).filter((candidate) => segmentCheck(candidate.venue)).map((candidate) => ({
      ...candidate,
      recoveryScore: scoreHappeningsRecovery(candidate.venue, candidate.lensCompatibility)
    })).sort(
      (left, right) => right.recoveryScore - left.recoveryScore || right.lensCompatibility - left.lensCompatibility || left.venue.name.localeCompare(right.venue.name)
    )[0];
    const nextSegmentCandidate = strictSegmentCandidate ?? supplemental.find(
      (candidate) => !selectedSupplemental.some((selected) => selected.venue.id === candidate.venue.id) && segmentCheck(candidate.venue)
    );
    if (nextSegmentCandidate) {
      selectedSupplemental.push(nextSegmentCandidate);
    }
  }
  for (const candidate of supplemental) {
    if (selectedSupplemental.some((selected) => selected.venue.id === candidate.venue.id)) {
      continue;
    }
    const projectedBroadCount = currentlyBroad.length + selectedSupplemental.filter((selected) => hasHappeningsBreadth(selected.venue)).length;
    if (projectedBroadCount >= targetBroadCount) {
      break;
    }
    if (selectedSupplemental.length >= 6) {
      break;
    }
    selectedSupplemental.push(candidate);
  }
  if (selectedSupplemental.length === 0) {
    return filteredByLens;
  }
  const merged = [...filteredByLens, ...selectedSupplemental];
  merged.sort(
    (left, right) => right.lensCompatibility - left.lensCompatibility || left.venue.name.localeCompare(right.venue.name)
  );
  const nonFoodBroad = merged.filter(
    (candidate) => hasHappeningsBreadth(candidate.venue) && !isFoodDrinkCategory(candidate.venue.category)
  );
  const baselineNonFoodBroad = filteredByLens.filter(
    (candidate) => hasHappeningsBreadth(candidate.venue) && !isFoodDrinkCategory(candidate.venue.category)
  );
  if (nonFoodBroad.length <= baselineNonFoodBroad.length) {
    return filteredByLens;
  }
  return merged;
}
function matchesAuthorityName(venueName, targetName) {
  const normalizedVenueName = sanitizeToken(venueName);
  const normalizedTargetName = sanitizeToken(targetName);
  if (!normalizedVenueName || !normalizedTargetName) {
    return false;
  }
  return normalizedVenueName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedVenueName);
}
function collectSanJoseAuthorityTargets(intent) {
  const cityQuery = sanitizeCity(intent.city);
  if (cityQuery !== "san jose") {
    return [];
  }
  const contract = getHospitalityScenarioContract({
    city: intent.city,
    persona: intent.persona ?? null,
    vibe: intent.primaryAnchor
  });
  const defaultTargets = [
    "La Foret",
    "La For\xEAt",
    "Hakone Gardens",
    "Hedley Club Lounge",
    "Japanese Friendship Garden",
    "Friendship Garden",
    "Willow Glen",
    "Hammer Theatre",
    "Opera San Jose",
    "San Pedro Square Market",
    "SAP Center"
  ];
  if (!contract) {
    return defaultTargets;
  }
  const seededTargets = [
    ...contract.anchorRules.defaultPrimaryAnchors ?? [],
    ...contract.anchorRules.stronglyPreferredVenues ?? [],
    ...contract.hiddenGemRules.preferredHiddenGemVenues ?? []
  ];
  return [.../* @__PURE__ */ new Set([...defaultTargets, ...seededTargets])];
}
function ensureAuthorityPreservation(shapedCandidates, filteredByLens, intent, compatibilityThreshold) {
  if (shapedCandidates.length === 0 || filteredByLens.length === 0) {
    return filteredByLens;
  }
  const authorityTargets = collectSanJoseAuthorityTargets(intent);
  if (authorityTargets.length === 0) {
    return filteredByLens;
  }
  const existingIds = new Set(filteredByLens.map((candidate) => candidate.venue.id));
  const minCompatibility = Math.max(0.16, compatibilityThreshold - 0.26);
  const targetPriority = new Map(
    authorityTargets.map((target, index) => [sanitizeToken(target), authorityTargets.length - index])
  );
  const supplemental = shapedCandidates.filter((candidate) => !existingIds.has(candidate.venue.id)).filter((candidate) => candidate.lensCompatibility >= minCompatibility).filter(
    (candidate) => authorityTargets.some((target) => matchesAuthorityName(candidate.venue.name, target))
  ).map((candidate) => {
    const matchedPriority = authorityTargets.reduce((best, target) => {
      if (!matchesAuthorityName(candidate.venue.name, target)) {
        return best;
      }
      return Math.max(best, targetPriority.get(sanitizeToken(target)) ?? 0);
    }, 0);
    return {
      candidate,
      matchedPriority
    };
  }).sort(
    (left, right) => right.matchedPriority - left.matchedPriority || right.candidate.lensCompatibility - left.candidate.lensCompatibility || left.candidate.venue.name.localeCompare(right.candidate.venue.name)
  ).slice(0, 8).map((entry) => entry.candidate);
  if (supplemental.length === 0) {
    return filteredByLens;
  }
  const merged = [...filteredByLens, ...supplemental];
  merged.sort(
    (left, right) => right.lensCompatibility - left.lensCompatibility || left.venue.name.localeCompare(right.venue.name)
  );
  return merged;
}
async function retrieveVenues(intent, lens, options = {}) {
  const curatedVenues2 = (options.seedVenues ? [...options.seedVenues, ...curatedVenues] : curatedVenues).map(ensureVenueHasHappenings);
  const cityQuery = sanitizeCity(intent.city);
  const requestedSourceMode = options.requestedSourceMode ?? "curated";
  const sanJoseHybridAutopilot = cityQuery === "san jose" && requestedSourceMode === "curated" && !options.sourceModeOverrideApplied;
  const retrievalSourceMode = sanJoseHybridAutopilot ? "hybrid" : requestedSourceMode;
  const curatedCoverageForCity = hasCuratedCityCoverage(curatedVenues2, cityQuery);
  const normalizedNeighborhood = intent.neighborhood ? sanitize(intent.neighborhood) : void 0;
  const maxDriveMinutes = intent.distanceMode === "nearby" ? BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES : 28;
  const liveFetch = retrievalSourceMode === "curated" ? {
    venues: [],
    diagnostics: {
      attempted: false,
      provider: "google-places",
      queryLocationLabel: intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city,
      queryCentersCount: 0,
      queryCentersUsed: [],
      queryRadiusM: 0,
      requestedKinds: ["restaurant", "bar", "cafe"],
      queryCount: 0,
      liveQueryTemplatesUsed: [],
      liveQueryLabelsUsed: [],
      liveCandidatesByQuery: [],
      liveRoleIntentQueryNotes: [],
      fetchedCount: 0,
      rawFetchedCount: 0,
      mappedCount: 0,
      mappedDroppedCount: 0,
      mappedDropReasons: {},
      normalizedCount: 0,
      dedupedByPlaceIdCount: 0,
      normalizationDroppedCount: 0,
      normalizationDropReasons: {},
      acceptedCount: 0,
      acceptanceDroppedCount: 0,
      acceptanceDropReasons: {},
      approvedCount: 0,
      demotedCount: 0,
      suppressedCount: 0,
      partialFailure: false,
      success: false,
      failureReason: void 0,
      errors: []
    }
  } : await fetchLivePlaces(intent, options.starterPack);
  const hybridPortable = retrievalSourceMode !== "curated" && cityQuery.length > 0 && !curatedCoverageForCity ? await fetchHybridPortableVenues(intent.city) : void 0;
  const effectiveLiveVenues = [
    ...liveFetch.venues,
    ...hybridPortable?.venues ?? []
  ].filter(
    (venue, index, collection) => collection.findIndex((candidate) => candidate.id === venue.id) === index
  ).map(ensureVenueHasHappenings);
  const mergedRequested = mergeVenueSources(curatedVenues2, effectiveLiveVenues, retrievalSourceMode);
  const liveTrustBreakdown = buildLiveTrustBreakdown(effectiveLiveVenues, mergedRequested.dedupeLosses);
  const liveHoursDemotedCount = effectiveLiveVenues.filter((venue) => venue.source.hoursDemotionApplied).length;
  const liveHoursSuppressedCount = effectiveLiveVenues.filter((venue) => venue.source.hoursSuppressionApplied).length;
  const effectiveLiveApprovedCount = effectiveLiveVenues.filter(
    (venue) => venue.source.qualityGateStatus === "approved"
  ).length;
  const effectiveLiveDemotedCount = effectiveLiveVenues.filter(
    (venue) => venue.source.qualityGateStatus === "demoted"
  ).length;
  const effectiveLiveSuppressedCount = effectiveLiveVenues.filter(
    (venue) => venue.source.qualityGateStatus === "suppressed"
  ).length;
  const hasEffectiveLiveCoverage = liveFetch.diagnostics.success || effectiveLiveVenues.length > 0;
  const allowCuratedFallbackForCity = curatedCoverageForCity || cityQuery.length === 0 || cityQuery === "san jose";
  const shouldFallbackToCurated = retrievalSourceMode !== "curated" && allowCuratedFallbackForCity && (!hasEffectiveLiveCoverage || mergedRequested.countsBySource.live === 0 || retrievalSourceMode === "live" && mergedRequested.venues.length < 10);
  const sourcePool = shouldFallbackToCurated ? curatedVenues2 : buildSourcePool(retrievalSourceMode, curatedVenues2, effectiveLiveVenues);
  const mergedPool = mergeVenueSources(
    curatedVenues2,
    effectiveLiveVenues,
    shouldFallbackToCurated ? "curated" : retrievalSourceMode
  );
  const requiredInventoryVenues = resolveRequiredInventoryVenues(
    mergedPool.venues,
    options.seedVenues,
    mergedRequested.dedupeLosses
  );
  const activeVenues = mergedPool.venues.filter((venue) => venue.isActive);
  const qualityApproved = activeVenues.filter((venue) => venue.source.qualityGateStatus === "approved");
  const qualityDemoted = activeVenues.filter((venue) => venue.source.qualityGateStatus === "demoted");
  const qualitySuppressed = activeVenues.filter((venue) => venue.source.qualityGateStatus === "suppressed");
  const qualityEligibleVenues = activeVenues.filter(
    (venue) => venue.source.qualityGateStatus !== "suppressed"
  );
  const excludedByQualityGate = buildExcludedDiagnostics(qualitySuppressed);
  const cityMatches = qualityEligibleVenues.filter(
    (venue) => sanitizeCity(venue.city) === cityQuery && venue.driveMinutes <= maxDriveMinutes
  );
  const allowDefaultSanJoseFallback = allowCuratedFallbackForCity && (cityQuery.length === 0 || cityQuery === "san jose");
  const fallbackMatches = cityMatches.length > 0 ? cityMatches : allowDefaultSanJoseFallback && (shouldFallbackToCurated || retrievalSourceMode === "curated") ? qualityEligibleVenues.filter(
    (venue) => sanitizeCity(venue.city) === "san jose" && venue.driveMinutes <= maxDriveMinutes
  ) : [];
  const shapedCandidates = fallbackMatches.map((venue) => applyLensToVenue(venue, intent, lens)).sort((left, right) => right.lensCompatibility - left.lensCompatibility);
  const compatibilityThreshold = lens.discoveryBias === "high" ? 0.36 : lens.tone === "refined" ? 0.44 : 0.41;
  let fallbackRelaxationApplied = "none";
  let filteredByLens = shapedCandidates.filter(
    (candidate) => candidate.lensCompatibility >= compatibilityThreshold
  );
  const lensStrictCount = filteredByLens.length;
  const lensSoftCount = shapedCandidates.filter(
    (candidate) => candidate.lensCompatibility >= 0.3
  ).length;
  if (filteredByLens.length < 10) {
    filteredByLens = shapedCandidates.filter((candidate) => candidate.lensCompatibility >= 0.3);
    fallbackRelaxationApplied = "lens-soft";
  }
  if (filteredByLens.length < 8) {
    filteredByLens = shapedCandidates;
    fallbackRelaxationApplied = "lens-off";
  }
  const authorityPreservedCandidates = ensureAuthorityPreservation(
    shapedCandidates,
    filteredByLens,
    intent,
    compatibilityThreshold
  );
  const happeningsPreservedCandidates = ensureHappeningsPreservation(
    shapedCandidates,
    authorityPreservedCandidates,
    compatibilityThreshold
  );
  const lensShapedVenues = happeningsPreservedCandidates.map((candidate) => candidate.venue);
  const localFirstLensShapedVenues = intent.distanceMode === "nearby" ? [
    ...lensShapedVenues.filter(
      (venue) => isWithinStrictNearbyWindow(venue.driveMinutes, intent.distanceMode)
    ),
    ...lensShapedVenues.filter(
      (venue) => isOutsideStrictNearbyButWithinBoundedStretch(
        venue.driveMinutes,
        intent.distanceMode
      )
    ).slice(0, 6)
  ] : lensShapedVenues;
  const buildResult = (venues, neighborhoodPreferred) => {
    const finalCountsBySource = countBySource(venues);
    return {
      venues,
      totalVenueCount: mergedPool.venues.length,
      lensCompatibleCount: happeningsPreservedCandidates.length,
      excludedByQualityGate,
      fallbackRelaxationApplied,
      sourceMode: {
        requestedMode: requestedSourceMode,
        effectiveMode: shouldFallbackToCurated ? "curated" : retrievalSourceMode,
        debugOverrideApplied: Boolean(options.sourceModeOverrideApplied),
        fallbackToCurated: shouldFallbackToCurated,
        liveFetchAttempted: liveFetch.diagnostics.attempted,
        liveFetchSucceeded: hasEffectiveLiveCoverage,
        provider: liveFetch.diagnostics.provider,
        failureReason: shouldFallbackToCurated && liveFetch.diagnostics.failureReason ? liveFetch.diagnostics.failureReason : shouldFallbackToCurated && retrievalSourceMode === "live" && mergedRequested.venues.length < 10 ? "Live-only inventory was too thin for safe plan generation, so curated fallback was used." : liveFetch.diagnostics.failureReason,
        queryLocationLabel: liveFetch.diagnostics.queryLocationLabel,
        queryCentersCount: liveFetch.diagnostics.queryCentersCount,
        queryCentersUsed: liveFetch.diagnostics.queryCentersUsed,
        queryRadiusM: liveFetch.diagnostics.queryRadiusM,
        queryCount: liveFetch.diagnostics.queryCount,
        liveQueryTemplatesUsed: liveFetch.diagnostics.liveQueryTemplatesUsed,
        liveQueryLabelsUsed: liveFetch.diagnostics.liveQueryLabelsUsed,
        liveCandidatesByQuery: liveFetch.diagnostics.liveCandidatesByQuery,
        liveRoleIntentQueryNotes: liveFetch.diagnostics.liveRoleIntentQueryNotes,
        fetchedCount: liveFetch.diagnostics.fetchedCount,
        rawFetchedCount: liveFetch.diagnostics.rawFetchedCount,
        mappedCount: liveFetch.diagnostics.mappedCount + (hybridPortable?.diagnostics.selectedCount ?? 0),
        mappedDroppedCount: liveFetch.diagnostics.mappedDroppedCount,
        mappedDropReasons: liveFetch.diagnostics.mappedDropReasons,
        normalizedCount: effectiveLiveVenues.length,
        dedupedByPlaceIdCount: liveFetch.diagnostics.dedupedByPlaceIdCount,
        normalizationDroppedCount: liveFetch.diagnostics.normalizationDroppedCount,
        normalizationDropReasons: liveFetch.diagnostics.normalizationDropReasons,
        acceptedCount: liveFetch.diagnostics.acceptedCount,
        acceptanceDroppedCount: liveFetch.diagnostics.acceptanceDroppedCount,
        acceptanceDropReasons: liveFetch.diagnostics.acceptanceDropReasons,
        approvedCount: effectiveLiveApprovedCount,
        demotedCount: effectiveLiveDemotedCount,
        suppressedCount: effectiveLiveSuppressedCount,
        liveHoursDemotedCount,
        liveHoursSuppressedCount,
        partialFailure: liveFetch.diagnostics.partialFailure,
        errors: liveFetch.diagnostics.errors,
        countsBySource: finalCountsBySource,
        dedupedCount: mergedRequested.dedupedCount,
        dedupedLiveCount: mergedRequested.dedupedLiveCount,
        liveDedupedAgainstCuratedCount: mergedRequested.liveDedupedAgainstCuratedCount,
        liveNoveltyCollapsedCount: mergedRequested.liveNoveltyCollapsedCount,
        dedupeLosses: mergedRequested.dedupeLosses,
        liveTrustBreakdown,
        hybridAdapterUsed: Boolean(hybridPortable),
        hybridAdapterMode: hybridPortable?.diagnostics.mode,
        hybridAdapterNotes: hybridPortable?.diagnostics.notes,
        hybridAdapterCount: hybridPortable?.diagnostics.selectedCount
      },
      stageCounts: {
        totalSeed: mergedPool.venues.length,
        active: activeVenues.length,
        qualityApproved: qualityApproved.length,
        qualityDemoted: qualityDemoted.length,
        qualitySuppressed: qualitySuppressed.length,
        curatedSeed: curatedVenues2.length,
        liveFetched: liveFetch.diagnostics.fetchedCount,
        liveMapped: liveFetch.diagnostics.mappedCount + (hybridPortable?.diagnostics.selectedCount ?? 0),
        liveNormalized: effectiveLiveVenues.length,
        liveApproved: effectiveLiveApprovedCount,
        liveDemoted: effectiveLiveDemotedCount,
        liveSuppressed: effectiveLiveSuppressedCount,
        liveHoursDemoted: liveHoursDemotedCount,
        liveHoursSuppressed: liveHoursSuppressedCount,
        cityMatch: cityMatches.length,
        geographyMatch: fallbackMatches.length,
        lensStrict: lensStrictCount,
        lensSoft: lensSoftCount,
        finalRetrieved: venues.length,
        neighborhoodPreferred,
        dedupedMerged: mergedRequested.dedupedCount,
        dedupedLive: mergedRequested.dedupedLiveCount,
        finalCurated: finalCountsBySource.curated,
        finalLive: finalCountsBySource.live
      }
    };
  };
  if (!normalizedNeighborhood) {
    return buildResult(
      mergeRequiredVenues(localFirstLensShapedVenues, requiredInventoryVenues),
      0
    );
  }
  const neighborhoodMatches = localFirstLensShapedVenues.filter(
    (venue) => sanitize(venue.neighborhood) === normalizedNeighborhood
  );
  const nearbyMatches = localFirstLensShapedVenues.filter(
    (venue) => sanitize(venue.neighborhood) !== normalizedNeighborhood
  );
  if (intent.distanceMode === "nearby" && neighborhoodMatches.length > 0) {
    return buildResult(
      mergeRequiredVenues([...neighborhoodMatches, ...nearbyMatches], requiredInventoryVenues),
      neighborhoodMatches.length
    );
  }
  return buildResult(
    mergeRequiredVenues(localFirstLensShapedVenues, requiredInventoryVenues),
    neighborhoodMatches.length
  );
}

// src/domain/retrieval/scoreAnchorFit.ts
function clamp0110(value) {
  return Math.max(0, Math.min(1, value));
}
function scoreAnchorCategoryPressure(venue, anchor) {
  const profile = getVibeProfile(anchor);
  const categoryFit = profile.preferredCategories.includes(venue.category) ? 1 : 0.32;
  const categoryPenalty = profile.discouragedCategories.includes(venue.category) ? 0.28 : 0;
  return clamp0110(categoryFit - categoryPenalty);
}
function scoreAnchorFit(venue, intent) {
  const anchors = [intent.primaryAnchor, ...intent.secondaryAnchors ?? []];
  const scores = anchors.map((anchor, index) => {
    const directAffinity = scoreVibeTagAffinity(venue, anchor);
    const categoryPressure = scoreAnchorCategoryPressure(venue, anchor);
    const exactVibeMatch = venueMatchesVibeTag(venue, anchor) ? 1 : 0;
    const anchorStrength = index === 0 ? 1 : 0.58;
    return clamp0110(
      (directAffinity * 0.62 + categoryPressure * 0.24 + exactVibeMatch * 0.14) * anchorStrength
    );
  });
  const weightedSum = scores.reduce(
    (sum, score, index) => sum + score * (index === 0 ? 0.82 : 0.18),
    0
  );
  const totalWeight = scores.length > 1 ? 1 : 0.82;
  return clamp0110(weightedSum / totalWeight);
}

// src/domain/retrieval/scoreBudgetFit.ts
function toPriceLevel(priceTier) {
  if (priceTier === "$") {
    return 1;
  }
  if (priceTier === "$$") {
    return 2;
  }
  if (priceTier === "$$$") {
    return 3;
  }
  return 4;
}
function targetBudgetLevel(budget) {
  if (!budget) {
    return null;
  }
  if (budget === "value") {
    return 1.5;
  }
  if (budget === "balanced") {
    return 2.5;
  }
  return 3.5;
}
function clamp0111(value) {
  return Math.max(0, Math.min(1, value));
}
function scoreBudgetFit(venue, budget) {
  const target = targetBudgetLevel(budget);
  if (target === null) {
    return 0.8;
  }
  const level = toPriceLevel(venue.priceTier);
  const distance = Math.abs(level - target);
  return clamp0111(1 - distance / 3);
}

// src/domain/retrieval/scoreCrewFit.ts
function clamp0112(value) {
  return Math.max(0, Math.min(1, value));
}
function scoreCrewFit(venue, crewPolicy) {
  if (crewPolicy.blockedCategories.includes(venue.category)) {
    return 0;
  }
  const preferredScore = crewPolicy.preferredCategories.includes(venue.category) ? 1 : 0.55;
  const discouragedPenalty = crewPolicy.discouragedCategories.includes(venue.category) ? 0.28 : 0;
  const useCaseScore = venue.useCases.includes(crewPolicy.crew) ? 1 : 0.6;
  const energyDistance = Math.abs(venue.energyLevel - crewPolicy.targetEnergy);
  const energyScore = clamp0112(1 - energyDistance / 4);
  const vibeMatchScore = venue.vibeTags.some((tag) => crewPolicy.preferredVibes?.includes(tag)) ? 1 : 0.58;
  return clamp0112(
    preferredScore * 0.35 + useCaseScore * 0.3 + energyScore * 0.2 + vibeMatchScore * 0.15 - discouragedPenalty
  );
}

// src/domain/retrieval/scoreHiddenGemFit.ts
function clamp0113(value) {
  return Math.max(0, Math.min(1, value));
}
function scoreHiddenGemFit(venue, fitScore, intent) {
  const weighted = fitScore * 0.4 + venue.distinctivenessScore * 0.25 + venue.underexposureScore * 0.2 + venue.shareabilityScore * 0.15;
  const chainPenalty = venue.isChain ? 0.08 : 0;
  const localSignalAverage = (venue.localSignals.localFavoriteScore + venue.localSignals.neighborhoodPrideScore) / 2;
  const localBonus = localSignalAverage * 0.06;
  const hiddenGemLift = venue.isHiddenGem ? 0.05 : 0;
  const intentLift = intent.prefersHiddenGems ? 0.04 : 0;
  return clamp0113(weighted - chainPenalty + localBonus + hiddenGemLift + intentLift);
}

// src/domain/retrieval/scoreProximityFit.ts
function clamp0114(value) {
  return Math.max(0, Math.min(1, value));
}
function scoreProximityFit(venue, intent) {
  const neighborhoodQuery = intent.neighborhood?.trim().toLowerCase();
  const sameNeighborhood = neighborhoodQuery ? venue.neighborhood.toLowerCase() === neighborhoodQuery : false;
  const nearbyCap = 14;
  const shortDriveCap = 30;
  const cap = intent.distanceMode === "nearby" ? nearbyCap : shortDriveCap;
  const drivePenalty = clamp0114(venue.driveMinutes / cap);
  const driveScore = clamp0114(1 - drivePenalty);
  const neighborhoodBonus = sameNeighborhood ? 1 : 0;
  const neighborhoodPenalty = neighborhoodQuery && !sameNeighborhood ? 0.18 : 0;
  if (intent.distanceMode === "nearby") {
    const strictDriveScore = clamp0114(1 - venue.driveMinutes / nearbyCap);
    return clamp0114(
      strictDriveScore * 0.62 + neighborhoodBonus * 0.38 - neighborhoodPenalty
    );
  }
  return clamp0114(driveScore * 0.8 + neighborhoodBonus * 0.2 - neighborhoodPenalty * 0.5);
}

// src/domain/retrieval/scoreContextSpecificity.ts
function clamp0115(value) {
  return Math.max(0, Math.min(1, value));
}
function tagOverlapScore2(venueTags, preferredTags) {
  if (preferredTags.length === 0) {
    return 0;
  }
  const normalizedVenueTags = new Set(venueTags.map((tag) => tag.toLowerCase()));
  const matches = preferredTags.filter((tag) => normalizedVenueTags.has(tag.toLowerCase())).length;
  return matches / preferredTags.length;
}
function scoreContextSpecificity({
  venue,
  intent,
  crewPolicy,
  lens,
  fitBreakdown,
  stopShapeFit
}) {
  const personaSignal = clamp0115(
    fitBreakdown.crewFit * 0.66 + (venue.useCases.includes(crewPolicy.crew) ? 0.24 : 0) + (crewPolicy.preferredCategories.includes(venue.category) ? 0.1 : 0)
  );
  const vibeSignal = clamp0115(
    fitBreakdown.anchorFit * 0.72 + (venueMatchesVibeTag(venue, intent.primaryAnchor) ? 0.2 : 0) + (intent.secondaryAnchors?.some((anchor) => venueMatchesVibeTag(venue, anchor)) ? 0.08 : 0)
  );
  const lensSignal = clamp0115(
    (lens.preferredCategories.includes(venue.category) ? 0.52 : 0.18) + tagOverlapScore2(venue.tags, lens.preferredTags) * 0.24 + (lens.discouragedCategories.includes(venue.category) ? -0.22 : 0) + (tagOverlapScore2(venue.tags, lens.discouragedTags) > 0 ? -0.14 : 0)
  );
  const start = clamp0115(
    personaSignal * 0.26 + vibeSignal * 0.22 + lensSignal * 0.18 + stopShapeFit.start * 0.2 + venue.roleAffinity.warmup * 0.14
  );
  const peak = clamp0115(
    personaSignal * 0.3 + vibeSignal * 0.3 + lensSignal * 0.16 + stopShapeFit.highlight * 0.16 + venue.roleAffinity.peak * 0.08
  );
  const wildcard = clamp0115(
    personaSignal * 0.2 + vibeSignal * 0.26 + lensSignal * 0.16 + stopShapeFit.surprise * 0.16 + venue.roleAffinity.wildcard * 0.1 + venue.distinctivenessScore * 0.12
  );
  const cooldown = clamp0115(
    personaSignal * 0.26 + vibeSignal * 0.18 + lensSignal * 0.2 + stopShapeFit.windDown * 0.24 + venue.roleAffinity.cooldown * 0.12
  );
  return {
    overall: clamp0115((start + peak + wildcard + cooldown) / 4),
    personaSignal,
    vibeSignal,
    lensSignal,
    byRole: {
      warmup: start,
      peak,
      wildcard,
      cooldown
    }
  };
}

// src/domain/retrieval/scoreDominancePenalty.ts
function clamp0116(value) {
  return Math.max(0, Math.min(1, value));
}
function roleAffinityUniversality(venue) {
  const values = [
    venue.roleAffinity.warmup,
    venue.roleAffinity.peak,
    venue.roleAffinity.wildcard,
    venue.roleAffinity.cooldown
  ];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const spreadPenalty = clamp0116(1 - (max - min));
  return clamp0116(mean * 0.58 + spreadPenalty * 0.42);
}
function genericCategoryWeight(category) {
  if (category === "restaurant" || category === "cafe") {
    return 1;
  }
  if (category === "dessert" || category === "activity") {
    return 0.55;
  }
  return 0.22;
}
function scoreDominancePenalty({
  venue,
  contextSpecificityByRole
}) {
  const universalityScore = roleAffinityUniversality(venue);
  const genericWeight = genericCategoryWeight(venue.category);
  const warmupPenalty = clamp0116(
    universalityScore * (1 - contextSpecificityByRole.warmup) * 0.06 + genericWeight * 0.01
  );
  const peakPenalty = clamp0116(
    universalityScore * (1 - contextSpecificityByRole.peak) * 0.2 + genericWeight * 0.07
  );
  const wildcardPenalty = clamp0116(
    universalityScore * (1 - contextSpecificityByRole.wildcard) * 0.12 + genericWeight * 0.03
  );
  const cooldownPenalty = clamp0116(
    universalityScore * (1 - contextSpecificityByRole.cooldown) * 0.08 + genericWeight * 0.02
  );
  return {
    universalityScore,
    flaggedUniversal: universalityScore >= 0.72 && (contextSpecificityByRole.peak < 0.68 || contextSpecificityByRole.wildcard < 0.66),
    byRole: {
      warmup: warmupPenalty,
      peak: peakPenalty,
      wildcard: wildcardPenalty,
      cooldown: cooldownPenalty
    }
  };
}

// src/domain/retrieval/computeRoleAwareHoursPressure.ts
var emptyPressure = {
  boost: 0,
  penalty: 0,
  adjusted: false,
  notes: []
};
function computeRoleAwareHoursPressure(venue, role) {
  if (venue.source.sourceOrigin !== "live") {
    return emptyPressure;
  }
  const notes = [];
  const supportRole = role === "warmup" || role === "cooldown";
  const strictRole = role === "peak";
  const liveFairness = computeLiveQualityFairness(venue);
  const stronglyOpen = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= (strictRole ? 0.74 : supportRole ? 0.58 : 0.62);
  const moderatelyOpen = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= (strictRole ? 0.62 : supportRole ? 0.44 : 0.5);
  const uncertain = venue.source.hoursPressureLevel === "unknown" || !venue.source.hoursKnown && venue.source.timeConfidence < (supportRole ? 0.58 : 0.62);
  const likelyClosed = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= (strictRole ? 0.68 : supportRole ? 0.82 : 0.74);
  let boost = 0;
  let penalty = 0;
  if (stronglyOpen) {
    boost = strictRole ? 0.055 : supportRole ? 0.05 : 0.028;
    notes.push("strong time support for this role");
  } else if (moderatelyOpen) {
    boost = supportRole ? liveFairness.supportRecoveryEligible ? 0.036 : 0.03 : strictRole ? 0.012 : 0.018;
    if (supportRole) {
      notes.push("moderate time support was accepted for support role");
    }
  }
  if (likelyClosed) {
    penalty = strictRole ? 0.18 : supportRole ? liveFairness.supportRecoveryEligible ? 0.038 : 0.05 : 0.1;
    notes.push(strictRole ? "highlight needs stronger hours confidence" : "time confidence remained soft for this role");
  } else if (uncertain) {
    penalty = strictRole ? 0.06 : supportRole ? liveFairness.supportRecoveryEligible ? 6e-3 : 0.012 : 0.028;
    notes.push(
      strictRole ? "highlight keeps a cautious penalty for time uncertainty" : liveFairness.supportRecoveryEligible ? "support role kept a strong live venue in play despite hours ambiguity" : "support role softened an otherwise generic hours penalty"
    );
  }
  return {
    boost,
    penalty,
    adjusted: boost > 0 || penalty > 0,
    notes
  };
}

// src/domain/retrieval/scoreUniquenessFit.ts
function scoreUniquenessFit(venue, intent) {
  const baseline = venue.uniquenessScore * 0.6 + venue.distinctivenessScore * 0.4;
  const adventurousLift = intent.primaryAnchor === "adventurous-urban" || intent.secondaryAnchors?.includes("adventurous-urban") ? 0.06 : 0;
  const chainPenalty = venue.isChain ? 0.08 : 0;
  return Math.max(0, Math.min(1, baseline + adventurousLift - chainPenalty));
}

// src/domain/contracts/evaluateRoleContract.ts
function clamp0117(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizedTags(venue) {
  return new Set(venue.tags.map((tag) => tag.toLowerCase()));
}
function overlapScore(venue, tags) {
  if (tags.length === 0) {
    return 0;
  }
  const tagsSet = normalizedTags(venue);
  let matches = 0;
  for (const tag of tags) {
    if (tagsSet.has(tag.toLowerCase())) {
      matches += 1;
    }
  }
  return matches / tags.length;
}
function evaluateRoleContract(venue, rule) {
  if (rule.strength === "none") {
    return {
      contractLabel: rule.label,
      strength: rule.strength,
      score: 1,
      satisfied: true,
      matchedSignals: [],
      violations: []
    };
  }
  const matches = [];
  const violations = [];
  const requiredCategoryMet = rule.requiredCategories.length === 0 || rule.requiredCategories.includes(venue.category);
  if (rule.requiredCategories.length > 0) {
    if (requiredCategoryMet) {
      matches.push("required category matched");
    } else {
      violations.push("required category missing");
    }
  }
  const requiredTagScore = overlapScore(venue, rule.requiredTags);
  const requiredTagMet = rule.requiredTags.length === 0 || requiredTagScore > 0;
  if (rule.requiredTags.length > 0) {
    if (requiredTagMet) {
      matches.push("required tag matched");
    } else {
      violations.push("required tag missing");
    }
  }
  const preferredCategoryScore = rule.preferredCategories.length === 0 ? 0.7 : rule.preferredCategories.includes(venue.category) ? 1 : 0.25;
  if (rule.preferredCategories.includes(venue.category)) {
    matches.push("preferred category matched");
  }
  const preferredTagScore = overlapScore(venue, rule.preferredTags);
  if (preferredTagScore > 0) {
    matches.push("preferred tag matched");
  }
  const discouragedCategoryPenalty = rule.discouragedCategories.includes(venue.category) ? 0.28 : 0;
  if (discouragedCategoryPenalty > 0) {
    violations.push("discouraged category");
  }
  const discouragedTagPenalty = overlapScore(venue, rule.discouragedTags) * 0.22;
  if (discouragedTagPenalty > 0) {
    violations.push("discouraged tag");
  }
  const maxEnergyPenalty = typeof rule.maxEnergyLevel === "number" && venue.energyLevel > rule.maxEnergyLevel ? clamp0117((venue.energyLevel - rule.maxEnergyLevel) / 4) : 0;
  if (maxEnergyPenalty > 0) {
    violations.push("energy too high");
  }
  const score = clamp0117(
    preferredCategoryScore * 0.42 + preferredTagScore * 0.24 + requiredTagScore * 0.14 + (requiredCategoryMet ? 0.2 : 0) - discouragedCategoryPenalty - discouragedTagPenalty - maxEnergyPenalty
  );
  const hardFail = !requiredCategoryMet || !requiredTagMet;
  const satisfied = rule.strength === "hard" ? !hardFail && score >= 0.62 : rule.strength === "strong" ? !hardFail && score >= 0.55 : score >= 0.45;
  return {
    contractLabel: rule.label,
    strength: rule.strength,
    score,
    satisfied,
    matchedSignals: matches,
    violations
  };
}

// src/domain/contracts/getHighlightValidityRules.ts
function getHighlightValidityRules(intent, starterPack) {
  switch (starterPack?.id) {
    case "cozy-jazz-night":
    case "live-music-loop":
      return {
        literalRequirementType: "music-performance",
        literalRequirementLabel: "Highlight requires a music or performance-capable venue.",
        literalRequirementStrength: "hard",
        dateCentered: false,
        musicPack: true,
        outdoorPack: false
      };
    case "cozy-date-night":
      return {
        literalRequirementType: "date-evening",
        literalRequirementLabel: "Highlight should read as an adult, intimate date-night anchor.",
        literalRequirementStrength: "strong",
        dateCentered: true,
        musicPack: false,
        outdoorPack: false
      };
    case "dessert-conversation":
      return {
        literalRequirementType: "conversation-dessert",
        literalRequirementLabel: "Highlight should center dessert, coffee, wine, or low-energy conversation.",
        literalRequirementStrength: "strong",
        dateCentered: true,
        musicPack: false,
        outdoorPack: false
      };
    case "wine-slow-evening":
      return {
        literalRequirementType: "wine-evening",
        literalRequirementLabel: "Highlight should feel wine-led, intimate, and built for lingering.",
        literalRequirementStrength: "strong",
        dateCentered: true,
        musicPack: false,
        outdoorPack: false
      };
    case "sunset-stroll":
      return {
        literalRequirementType: "outdoor-anchor",
        literalRequirementLabel: "Highlight should anchor the outing outdoors with scenic or open-air character.",
        literalRequirementStrength: "strong",
        dateCentered: true,
        musicPack: false,
        outdoorPack: true
      };
    case "coffee-books":
      return {
        literalRequirementType: "thoughtful-date",
        literalRequirementLabel: "Highlight should feel thoughtful, quiet, and date-appropriate.",
        literalRequirementStrength: "strong",
        dateCentered: true,
        musicPack: false,
        outdoorPack: false
      };
    case "park-and-ice-cream":
      return {
        literalRequirementType: "outdoor-anchor",
        literalRequirementLabel: "Highlight should stay family-friendly and open-air.",
        literalRequirementStrength: "strong",
        dateCentered: false,
        musicPack: false,
        outdoorPack: true
      };
    default:
      return {
        literalRequirementType: intent.primaryAnchor === "adventurous-outdoor" ? "outdoor-anchor" : void 0,
        literalRequirementLabel: intent.primaryAnchor === "adventurous-outdoor" ? "Highlight should read as an outdoor anchor for this outing." : void 0,
        literalRequirementStrength: intent.primaryAnchor === "adventurous-outdoor" ? "strong" : void 0,
        dateCentered: intent.crew === "romantic",
        musicPack: false,
        outdoorPack: intent.primaryAnchor === "adventurous-outdoor"
      };
  }
}

// src/domain/contracts/evaluateHighlightValidity.ts
function normalizeTag4(value) {
  return value.toLowerCase();
}
function normalizedTags2(venue) {
  return new Set(venue.tags.map(normalizeTag4));
}
function hasAnyTag3(tags, candidates) {
  return candidates.some((candidate) => tags.has(normalizeTag4(candidate)));
}
function hasCategory(venue, categories) {
  return categories.includes(venue.category);
}
function isMusicCapableVenue(venue, tags) {
  return venue.settings.musicCapable || venue.settings.performanceCapable || venue.category === "live_music" || venue.category === "event" || hasAnyTag3(tags, ["live", "jazz", "listening", "performance", "local-artists", "small-stage"]);
}
function isOutdoorAnchorVenue(venue, tags) {
  return venue.settings.setting === "outdoor" || venue.settings.setting === "hybrid" || venue.category === "park" || hasAnyTag3(tags, [
    "nature",
    "trail",
    "viewpoint",
    "scenic",
    "walkable",
    "fresh-air",
    "open-air",
    "stargazing",
    "stroll",
    "garden"
  ]);
}
function isFamilyCodedVenue(venue, tags) {
  return venue.settings.familyFriendly || hasAnyTag3(tags, ["family-friendly", "accessible"]) || venue.category === "museum" && hasAnyTag3(tags, ["hands-on", "learning", "interactive"]) || venue.category === "activity" && hasAnyTag3(tags, ["games", "arcade", "outdoor-play", "animals"]);
}
function isKidFocusedVenue(tags) {
  return hasAnyTag3(tags, [
    "family-friendly",
    "hands-on",
    "learning",
    "outdoor-play",
    "animals",
    "arcade",
    "games"
  ]);
}
function isAdultSocialVenue(venue, tags) {
  return venue.settings.adultSocial || venue.category === "bar" || venue.category === "live_music" || hasAnyTag3(tags, ["cocktails", "wine", "late-night", "stylish", "date-night"]);
}
function isDateToneVenue(venue, tags) {
  return venue.settings.dateFriendly || hasCategory(venue, ["restaurant", "bar", "dessert", "cafe", "live_music"]) || hasAnyTag3(tags, [
    "intimate",
    "cozy",
    "conversation",
    "romantic",
    "quiet",
    "craft",
    "wine",
    "chef-led",
    "tea-room"
  ]);
}
function isQuietLingeringVenue(venue, tags) {
  return venue.energyLevel <= 2 || hasAnyTag3(tags, ["quiet", "conversation", "calm", "cozy", "soft-landing", "tea-room", "wine"]);
}
function isThoughtfulVenue(venue, tags) {
  return venue.category === "museum" || hasAnyTag3(tags, ["thoughtful", "quiet", "curated", "historic", "heritage", "artisan"]);
}
function isIndoorCulturalFamilyVenue(venue, tags) {
  return hasCategory(venue, ["museum", "activity"]) && !isOutdoorAnchorVenue(venue, tags);
}
function computeCandidateTier(venue, intent, starterPack, tags) {
  if (venue.settings.highlightCapabilityTier === "connective-only") {
    return "connective-only";
  }
  if (venue.settings.highlightCapabilityTier === "highlight-capable") {
    return "highlight-capable";
  }
  if (hasCategory(venue, ["restaurant", "bar", "live_music", "event"])) {
    return "highlight-capable";
  }
  if (venue.category === "museum") {
    return intent.primaryAnchor === "cultured" || starterPack?.id === "coffee-books" || starterPack?.id === "museum-afternoon" || intent.crew === "curator" ? "highlight-capable" : "support-only";
  }
  if (venue.category === "activity") {
    return intent.primaryAnchor === "playful" || intent.crew === "curator" || intent.primaryAnchor === "adventurous-outdoor" ? "highlight-capable" : "support-only";
  }
  if (venue.category === "park") {
    return isOutdoorAnchorVenue(venue, tags) ? "highlight-capable" : "support-only";
  }
  if (venue.category === "dessert") {
    return starterPack?.id === "dessert-conversation" || starterPack?.id === "cozy-date-night" || starterPack?.id === "sunset-stroll" || intent.crew === "romantic" && isQuietLingeringVenue(venue, tags) ? "highlight-capable" : "support-only";
  }
  if (venue.category === "cafe") {
    return starterPack?.id === "coffee-books" || starterPack?.id === "dessert-conversation" || intent.primaryAnchor === "chill" && isThoughtfulVenue(venue, tags) ? "highlight-capable" : "support-only";
  }
  return venue.settings.highlightCapabilityTier;
}
function literalRequirementSatisfied(requirementType, venue, tags) {
  switch (requirementType) {
    case "music-performance":
      return isMusicCapableVenue(venue, tags);
    case "date-evening":
      return !isKidFocusedVenue(tags) && (isAdultSocialVenue(venue, tags) || venue.category === "restaurant" || venue.category === "dessert" || venue.category === "museum" && isThoughtfulVenue(venue, tags));
    case "conversation-dessert":
      return hasCategory(venue, ["dessert", "cafe", "bar"]) && isQuietLingeringVenue(venue, tags) && venue.energyLevel <= 3;
    case "wine-evening":
      return hasCategory(venue, ["restaurant", "bar"]) && (hasAnyTag3(tags, ["wine", "craft", "intimate", "conversation", "chef-led", "elevated"]) || venue.priceTier === "$$$" || venue.priceTier === "$$$$");
    case "outdoor-anchor":
      return isOutdoorAnchorVenue(venue, tags);
    case "thoughtful-date":
      return hasCategory(venue, ["cafe", "museum", "dessert"]) && (isThoughtfulVenue(venue, tags) || isQuietLingeringVenue(venue, tags));
    default:
      return true;
  }
}
function evaluateHighlightValidity({
  venue,
  intent,
  starterPack
}) {
  const rules = getHighlightValidityRules(intent, starterPack);
  const tags = normalizedTags2(venue);
  const candidateTier = computeCandidateTier(venue, intent, starterPack, tags);
  const packLiteralRequirementSatisfied = literalRequirementSatisfied(
    rules.literalRequirementType,
    venue,
    tags
  );
  const matchedSignals = [];
  const violations = [];
  const personaVetoes = [];
  const contextVetoes = [];
  const musicCapable = isMusicCapableVenue(venue, tags);
  const outdoorAnchor = isOutdoorAnchorVenue(venue, tags);
  const familyCoded = isFamilyCodedVenue(venue, tags);
  const kidFocused = isKidFocusedVenue(tags);
  const adultSocial = isAdultSocialVenue(venue, tags);
  const dateTone = isDateToneVenue(venue, tags);
  const quietLingering = isQuietLingeringVenue(venue, tags);
  const thoughtful = isThoughtfulVenue(venue, tags);
  const strongLiveTimeSupport = venue.source.sourceOrigin === "live" && venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.72;
  const strongLiveHighlightSupport = venue.source.sourceOrigin === "live" && venue.source.qualityGateStatus === "approved" && venue.source.sourceConfidence >= 0.72 && venue.source.qualityScore >= 0.72 && venue.settings.highlightCapabilityTier === "highlight-capable";
  if (strongLiveTimeSupport) {
    matchedSignals.push("hours signal supports current planning window");
  }
  if (strongLiveHighlightSupport) {
    matchedSignals.push("live record is strong enough to compete as a centerpiece");
  }
  if (venue.source.sourceOrigin === "live" && !venue.source.hoursKnown) {
    violations.push("live venue has unknown hours for the current planning window");
  }
  if (venue.source.sourceOrigin === "live" && !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.78) {
    contextVetoes.push("Live highlight vetoed: venue appears closed for the current planning window.");
  }
  if (venue.source.sourceOrigin === "live" && (venue.source.businessStatus === "temporarily-closed" || venue.source.businessStatus === "closed-permanently")) {
    contextVetoes.push(`Live highlight vetoed: venue is ${venue.source.businessStatus}.`);
  }
  if (candidateTier === "highlight-capable") {
    matchedSignals.push("highlight-capable venue shape");
  } else if (candidateTier === "support-only") {
    matchedSignals.push("support-shaped venue");
  } else {
    violations.push("connective-only venue shape");
  }
  if (musicCapable) {
    matchedSignals.push("music/performance-capable");
  }
  if (outdoorAnchor) {
    matchedSignals.push("outdoor anchor signal");
  }
  if (quietLingering) {
    matchedSignals.push("quiet lingering signal");
  }
  if (thoughtful) {
    matchedSignals.push("thoughtful cultural signal");
  }
  if (adultSocial || dateTone) {
    matchedSignals.push("adult date-appropriate tone");
  }
  if (intent.crew === "romantic") {
    if (familyCoded || kidFocused) {
      personaVetoes.push("Romantic highlight vetoed: child or family-coded centerpiece.");
    }
    if (venue.category === "museum" && hasAnyTag3(tags, ["hands-on", "learning", "interactive"]) && starterPack?.id !== "coffee-books") {
      personaVetoes.push("Romantic highlight vetoed: generic daytime educational centerpiece.");
    }
  }
  if (intent.crew === "curator") {
    if (adultSocial || hasAnyTag3(tags, ["romantic", "date-night"])) {
      personaVetoes.push("Family highlight vetoed: adult-social or date-coded centerpiece.");
    }
  }
  if (intent.primaryAnchor === "adventurous-outdoor") {
    if (!outdoorAnchor && isIndoorCulturalFamilyVenue(venue, tags)) {
      contextVetoes.push("Adventure Outdoor vetoed: highlight is indoor-only and not an outdoor anchor.");
    }
  }
  if (rules.musicPack && !musicCapable) {
    violations.push("pack literal requirement missing: music/performance capability");
  }
  if (rules.outdoorPack && !outdoorAnchor) {
    violations.push("pack literal requirement missing: outdoor anchor");
  }
  if (rules.dateCentered && (familyCoded || kidFocused)) {
    contextVetoes.push("Date-centered highlight vetoed: family or kid-coded venue.");
  }
  if (starterPack?.id === "dessert-conversation") {
    if (hasCategory(venue, ["activity", "live_music", "event"]) || venue.energyLevel >= 4) {
      contextVetoes.push("Dessert & Conversation vetoed: highlight is too noisy or activity-heavy.");
    }
  }
  if (starterPack?.id === "cozy-date-night") {
    if (hasCategory(venue, ["activity"]) || hasCategory(venue, ["live_music", "event"]) && !quietLingering) {
      contextVetoes.push("Cozy Date Night vetoed: highlight is too performance-led or activity-heavy.");
    }
  }
  if (starterPack?.id === "sunset-stroll" && !outdoorAnchor && venue.category === "museum") {
    contextVetoes.push("Sunset Stroll vetoed: indoor cultural highlight displaced the outdoor anchor.");
  }
  if (rules.literalRequirementLabel && packLiteralRequirementSatisfied) {
    matchedSignals.push("pack literal requirement satisfied");
  }
  const vetoReason = personaVetoes[0] ?? contextVetoes[0];
  if (vetoReason) {
    return {
      validForIntent: false,
      validityLevel: "invalid",
      fallbackEligible: false,
      candidateTier,
      packLiteralRequirementLabel: rules.literalRequirementLabel,
      packLiteralRequirementSatisfied,
      vetoReason,
      matchedSignals: [...new Set(matchedSignals)],
      violations: [.../* @__PURE__ */ new Set([...violations, ...personaVetoes, ...contextVetoes])],
      personaVetoes,
      contextVetoes
    };
  }
  if (!packLiteralRequirementSatisfied) {
    if (rules.literalRequirementStrength === "hard") {
      return {
        validForIntent: false,
        validityLevel: "invalid",
        fallbackEligible: false,
        candidateTier,
        packLiteralRequirementLabel: rules.literalRequirementLabel,
        packLiteralRequirementSatisfied,
        vetoReason: rules.literalRequirementLabel,
        matchedSignals: [...new Set(matchedSignals)],
        violations: [...new Set(violations)],
        personaVetoes,
        contextVetoes
      };
    }
    if (candidateTier === "connective-only") {
      return {
        validForIntent: false,
        validityLevel: "invalid",
        fallbackEligible: false,
        candidateTier,
        packLiteralRequirementLabel: rules.literalRequirementLabel,
        packLiteralRequirementSatisfied,
        vetoReason: "Highlight candidate was too connective to carry the requested outing.",
        matchedSignals: [...new Set(matchedSignals)],
        violations: [...new Set(violations)],
        personaVetoes,
        contextVetoes
      };
    }
    return {
      validForIntent: false,
      validityLevel: "fallback",
      fallbackEligible: true,
      candidateTier,
      packLiteralRequirementLabel: rules.literalRequirementLabel,
      packLiteralRequirementSatisfied,
      matchedSignals: [...new Set(matchedSignals)],
      violations: [...new Set(violations)],
      personaVetoes,
      contextVetoes
    };
  }
  if (candidateTier === "connective-only") {
    return {
      validForIntent: false,
      validityLevel: "invalid",
      fallbackEligible: false,
      candidateTier,
      packLiteralRequirementLabel: rules.literalRequirementLabel,
      packLiteralRequirementSatisfied,
      vetoReason: "Highlight candidate was too connective to serve as the center of the outing.",
      matchedSignals: [...new Set(matchedSignals)],
      violations: [...new Set(violations)],
      personaVetoes,
      contextVetoes
    };
  }
  if (candidateTier === "support-only") {
    return {
      validForIntent: false,
      validityLevel: "fallback",
      fallbackEligible: true,
      candidateTier,
      packLiteralRequirementLabel: rules.literalRequirementLabel,
      packLiteralRequirementSatisfied,
      matchedSignals: [...new Set(matchedSignals)],
      violations: [...new Set(violations)],
      personaVetoes,
      contextVetoes
    };
  }
  return {
    validForIntent: true,
    validityLevel: "valid",
    fallbackEligible: false,
    candidateTier,
    packLiteralRequirementLabel: rules.literalRequirementLabel,
    packLiteralRequirementSatisfied,
    matchedSignals: [...new Set(matchedSignals)],
    violations: [...new Set(violations)],
    personaVetoes,
    contextVetoes
  };
}

// src/domain/contracts/romanticPersonaContract.ts
function isRomanticPersonaContractActive(lens) {
  return lens.resolvedContract?.persona === "romantic";
}
function requiresRomanticPersonaMoment(lens) {
  return Boolean(
    isRomanticPersonaContractActive(lens) && lens.resolvedContract?.highlight.requiresMomentPresence
  );
}

// src/domain/interpretation/taste/mapVenueToTasteInput.ts
function clamp0118(value) {
  return Math.max(0, Math.min(1, value));
}
function deriveTasteHoursStatus(venue) {
  if (venue.source.businessStatus === "closed-permanently" || venue.source.businessStatus === "temporarily-closed") {
    return "closed";
  }
  if (venue.source.hoursPressureLevel === "strong-open") {
    return "open";
  }
  if (venue.source.hoursPressureLevel === "likely-open") {
    return "likely_open";
  }
  if (venue.source.hoursPressureLevel === "likely-closed") {
    return "likely_closed";
  }
  if (venue.source.hoursPressureLevel === "closed") {
    return "closed";
  }
  return venue.source.hoursKnown ? "uncertain" : "unknown";
}
function deriveSeedCalibratedTasteProfile(venue) {
  if (venue.source.normalizedFromRawType !== "seed") {
    return void 0;
  }
  const energy = clamp0118(venue.energyLevel / 5);
  const socialDensity = clamp0118(venue.socialDensity / 5);
  const lingerFactorByDuration = {
    XS: 0.28,
    S: 0.42,
    M: 0.58,
    L: 0.74,
    XL: 0.88
  }[venue.durationProfile.durationClass];
  const intimacy = clamp0118(
    0.56 + (venue.settings.dateFriendly ? 0.12 : 0) + (venue.category === "cafe" || venue.category === "dessert" || venue.category === "park" ? 0.08 : 0) - socialDensity * 0.3 - energy * 0.18
  );
  const destinationFactor = clamp0118(
    venue.signature.signatureScore * 0.62 + venue.distinctivenessScore * 0.18 + (venue.highlightCapable ? 0.08 : 0)
  );
  const experientialFactor = clamp0118(
    venue.distinctivenessScore * 0.34 + venue.uniquenessScore * 0.22 + venue.shareabilityScore * 0.14 + (venue.settings.eventCapable || venue.settings.musicCapable || venue.settings.performanceCapable ? 0.1 : 0) + (venue.highlightCapable ? 0.08 : 0)
  );
  const conversationFriendliness = clamp0118(
    0.62 + (venue.settings.dateFriendly ? 0.1 : 0) + (venue.category === "cafe" || venue.category === "dessert" || venue.category === "park" ? 0.08 : 0) - energy * 0.22 - socialDensity * 0.12 - (venue.settings.musicCapable ? 0.06 : 0)
  );
  return {
    energy,
    socialDensity,
    intimacy,
    lingerFactor: lingerFactorByDuration,
    destinationFactor,
    experientialFactor,
    conversationFriendliness
  };
}
function mapVenueToTasteInput(venue) {
  const descriptiveSummary = [venue.shortDescription, venue.narrativeFlavor].filter(Boolean).join(" ").trim();
  const happenings = venue.source.happenings ?? deriveVenueHappeningsSignals(venue);
  return {
    id: venue.id,
    name: venue.name,
    category: venue.category,
    subcategory: venue.subcategory,
    tags: [.../* @__PURE__ */ new Set([...venue.tags, ...venue.vibeTags])],
    placeTypes: venue.source.sourceTypes.length > 0 ? venue.source.sourceTypes : void 0,
    setting: venue.settings.setting,
    eventCapable: venue.settings.eventCapable,
    musicCapable: venue.settings.musicCapable,
    performanceCapable: venue.settings.performanceCapable,
    highlightCapable: venue.highlightCapable,
    priceLevel: venue.priceTier,
    neighborhood: venue.neighborhood,
    liveSource: venue.source.sourceOrigin === "live",
    sourceConfidence: venue.source.sourceConfidence,
    qualityScore: venue.source.qualityScore,
    signatureStrength: venue.signature.signatureScore,
    hoursStatus: deriveTasteHoursStatus(venue),
    hoursConfidence: venue.source.timeConfidence,
    editorialSummary: descriptiveSummary || void 0,
    seedCalibratedProfile: deriveSeedCalibratedTasteProfile(venue),
    happenings,
    hotspotStrength: happenings.hotspotStrength,
    eventPotential: happenings.eventPotential,
    performancePotential: happenings.performancePotential,
    liveNightlifePotential: happenings.liveNightlifePotential,
    culturalAnchorPotential: happenings.culturalAnchorPotential,
    lateNightPotential: happenings.lateNightPotential,
    currentRelevance: happenings.currentRelevance,
    hiddenGemStrength: happenings.hiddenGemStrength,
    majorVenueStrength: happenings.majorVenueStrength
  };
}

// src/domain/interpretation/taste/interpretVenueTaste.ts
var CATEGORY_BASELINES = {
  activity: {
    energy: 0.74,
    socialDensity: 0.62,
    intimacy: 0.34,
    lingerFactor: 0.68,
    destinationFactor: 0.76,
    experientialFactor: 0.86,
    conversationFriendliness: 0.42
  },
  bar: {
    energy: 0.72,
    socialDensity: 0.74,
    intimacy: 0.34,
    lingerFactor: 0.58,
    destinationFactor: 0.6,
    experientialFactor: 0.64,
    conversationFriendliness: 0.42
  },
  cafe: {
    energy: 0.34,
    socialDensity: 0.4,
    intimacy: 0.62,
    lingerFactor: 0.52,
    destinationFactor: 0.34,
    experientialFactor: 0.34,
    conversationFriendliness: 0.8
  },
  dessert: {
    energy: 0.42,
    socialDensity: 0.46,
    intimacy: 0.54,
    lingerFactor: 0.42,
    destinationFactor: 0.38,
    experientialFactor: 0.42,
    conversationFriendliness: 0.68
  },
  event: {
    energy: 0.84,
    socialDensity: 0.82,
    intimacy: 0.22,
    lingerFactor: 0.74,
    destinationFactor: 0.84,
    experientialFactor: 0.9,
    conversationFriendliness: 0.24
  },
  live_music: {
    energy: 0.8,
    socialDensity: 0.72,
    intimacy: 0.28,
    lingerFactor: 0.66,
    destinationFactor: 0.76,
    experientialFactor: 0.86,
    conversationFriendliness: 0.24
  },
  museum: {
    energy: 0.4,
    socialDensity: 0.34,
    intimacy: 0.58,
    lingerFactor: 0.62,
    destinationFactor: 0.68,
    experientialFactor: 0.78,
    conversationFriendliness: 0.64
  },
  park: {
    energy: 0.28,
    socialDensity: 0.22,
    intimacy: 0.76,
    lingerFactor: 0.66,
    destinationFactor: 0.68,
    experientialFactor: 0.72,
    conversationFriendliness: 0.84
  },
  restaurant: {
    energy: 0.56,
    socialDensity: 0.58,
    intimacy: 0.46,
    lingerFactor: 0.66,
    destinationFactor: 0.54,
    experientialFactor: 0.52,
    conversationFriendliness: 0.62
  }
};
var HIGH_ENERGY_TERMS = [
  "after dark",
  "buzzing",
  "cocktails",
  "crowded",
  "dance",
  "dj",
  "late night",
  "lively",
  "nightlife",
  "party",
  "rooftop",
  "karaoke"
];
var CALM_TERMS = [
  "bookish",
  "calm",
  "cozy",
  "garden",
  "intimate",
  "low-key",
  "patio",
  "quiet",
  "relaxed",
  "romantic"
];
var OUTDOOR_TERMS = [
  "beer garden",
  "courtyard",
  "fresh air",
  "garden",
  "greenhouse",
  "open air",
  "outdoor",
  "outdoor seating",
  "park",
  "patio",
  "plaza",
  "rooftop",
  "trail",
  "walkable"
];
var SCENIC_TERMS = [
  "botanical",
  "lookout",
  "promenade",
  "scenic",
  "stargazing",
  "sunset",
  "view",
  "viewpoint",
  "waterfront"
];
var INTERACTIVE_TERMS = [
  "arcade",
  "class",
  "exhibit",
  "games",
  "hands-on",
  "immersive",
  "interactive",
  "karaoke",
  "mini golf",
  "puzzle",
  "studio",
  "workshop"
];
var SOCIAL_ACTIVITY_TERMS = [
  "board games",
  "community",
  "friendly competition",
  "group activity",
  "live",
  "playful",
  "social activity",
  "team"
];
var PASSIVE_HOSPITALITY_TERMS = [
  "bar seating",
  "cafe",
  "cocktail lounge",
  "dining room",
  "seated",
  "table service",
  "tea house",
  "tea room",
  "wine bar"
];
var DESTINATION_TERMS = [
  "chef",
  "degustation",
  "destination",
  "hidden gem",
  "iconic",
  "michelin",
  "omakase",
  "reservation",
  "speakeasy",
  "tasting menu",
  "view"
];
var MOMENT_ANCHOR_IDENTITY_TERMS = [
  "atelier",
  "chef",
  "curated",
  "destination",
  "event",
  "experiential",
  "hidden",
  "historic",
  "iconic",
  "immersive",
  "listening",
  "omakase",
  "reservation",
  "secret",
  "signature",
  "speakeasy",
  "tasting"
];
var DRINKS_TERMS = [
  "brewery",
  "cafe",
  "cocktail",
  "cocktails",
  "coffee",
  "espresso",
  "tea",
  "wine"
];
var SWEET_TERMS = [
  "bakery",
  "dessert",
  "gelato",
  "ice cream",
  "pastry",
  "sweet"
];
var CULTURE_TERMS = [
  "art",
  "cultural",
  "exhibit",
  "gallery",
  "heritage",
  "historic",
  "history",
  "jazz",
  "japanese",
  "listening",
  "museum",
  "performance",
  "theater"
];
var AMBIENT_TERMS = [
  "ambient",
  "atmosphere",
  "candlelit",
  "cocktail lounge",
  "experiential",
  "greenhouse",
  "intimate",
  "jazz",
  "listening",
  "lounge",
  "speakeasy",
  "vibe"
];
var TEMPORAL_ENERGY_TERMS = [
  "after dark",
  "evening",
  "jazz",
  "late night",
  "lineup",
  "listening",
  "live music",
  "night",
  "nightlife",
  "performance",
  "show"
];
var RECURRING_EVENT_TERMS = [
  "every friday",
  "monthly",
  "nightly",
  "recurring",
  "rotating",
  "series",
  "weekly"
];
var SOCIAL_ENERGY_TERMS = [
  "buzzy",
  "busy",
  "crowded",
  "packed",
  "popular",
  "scene",
  "social",
  "vibrant"
];
var GROUP_SIGNAL_TERMS = [
  "board games",
  "communal",
  "friends",
  "group",
  "shared",
  "social activity",
  "team"
];
var AMBIENT_UNIQUENESS_TERMS = [
  "atmosphere",
  "atelier",
  "candlelit",
  "curated",
  "design",
  "design-forward",
  "glow",
  "greenhouse",
  "interior",
  "lighting",
  "listening room",
  "moody",
  "mood",
  "neon",
  "supper club",
  "vibe-rich"
];
var CULTURAL_DEPTH_TERMS = [
  "art",
  "artist",
  "atelier",
  "exhibit",
  "gallery",
  "immersive",
  "installation",
  "listening",
  "live music",
  "performance",
  "showcase",
  "theater"
];
var LIVE_PERFORMANCE_ACTIVATION_TERMS = [
  "concert",
  "jazz",
  "lineup",
  "listening room",
  "live music",
  "performance",
  "resident",
  "set",
  "show",
  "stage"
];
var SOCIAL_RITUAL_ACTIVATION_TERMS = [
  "community night",
  "game night",
  "karaoke",
  "locals night",
  "open mic",
  "series",
  "social ritual",
  "trivia",
  "weekly"
];
var TASTING_ACTIVATION_TERMS = [
  "chef-led",
  "degustation",
  "flight",
  "omakase",
  "pairing",
  "prix fixe",
  "seasonal menu",
  "special menu",
  "tasting",
  "wine pairing"
];
var CULTURAL_ACTIVATION_TERMS = [
  "artist",
  "curated",
  "exhibit",
  "gallery",
  "installation",
  "opening",
  "performance",
  "screening",
  "showcase",
  "studio"
];
var SEASONAL_MARKET_ACTIVATION_TERMS = [
  "fair",
  "festival",
  "holiday",
  "market",
  "night market",
  "popup",
  "seasonal",
  "vendor"
];
var AMBIENT_ACTIVATION_TERMS = [
  "after dark",
  "ambient",
  "candlelit",
  "courtyard",
  "listening room",
  "low-light",
  "moonlight",
  "speakeasy",
  "twilight"
];
var PROGRAMMED_ACTIVATION_TERMS = [
  "lineup",
  "program",
  "programming",
  "resident",
  "rotating",
  "special"
];
var DAY_WINDOW_TERMS = [
  "afternoon",
  "breakfast",
  "brunch",
  "coffee",
  "daytime",
  "lunch",
  "morning"
];
var EVENING_WINDOW_TERMS = [
  "date night",
  "date-night",
  "dinner",
  "evening",
  "happy hour",
  "sunset",
  "tonight",
  "twilight"
];
var LATE_WINDOW_TERMS = [
  "after dark",
  "after-dark",
  "late night",
  "late-night",
  "midnight",
  "nightcap"
];
var STANDARD_ROMANTIC_THRESHOLD = 0.5;
var COZY_SCENIC_ROMANTIC_THRESHOLD = 0.42;
function normalizeInterpretationTimeWindow(value) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : void 0;
}
function parseTemporalWindow(value) {
  const normalized = normalizeInterpretationTimeWindow(value);
  if (!normalized) {
    return void 0;
  }
  if (DAY_WINDOW_TERMS.some((term) => normalized.includes(term))) {
    return "day";
  }
  if (LATE_WINDOW_TERMS.some((term) => normalized.includes(term))) {
    return "late";
  }
  if (EVENING_WINDOW_TERMS.some((term) => normalized.includes(term))) {
    return "evening";
  }
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    return void 0;
  }
  let hour = Number(match[1]);
  const meridiem = match[3];
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  if (hour < 17) {
    return "day";
  }
  if (hour < 22) {
    return "evening";
  }
  return "late";
}
function createZeroRoleAdjustments() {
  return {
    start: 0,
    highlight: 0,
    windDown: 0,
    surprise: 0
  };
}
var INTIMACY_TERMS = [
  "cozy",
  "date night",
  "hidden",
  "intimate",
  "low-key",
  "quiet",
  "romantic",
  "snug",
  "tea house",
  "wine bar"
];
var SHARED_ACTIVITY_TERMS = [
  "art walk",
  "board games",
  "class",
  "exhibit",
  "games",
  "garden walk",
  "interactive",
  "mini golf",
  "puzzle",
  "stroll",
  "walk",
  "workshop"
];
var LINGER_TERMS = [
  "brunch",
  "coffee",
  "courses",
  "dessert",
  "patio",
  "tasting",
  "tea",
  "wine"
];
var SOCIAL_TERMS = [
  "bar seating",
  "communal",
  "crowded",
  "group",
  "party",
  "scene",
  "social"
];
var CONVERSATION_POSITIVE_TERMS = [
  "bookish",
  "cozy",
  "date night",
  "neighborhood",
  "patio",
  "quiet",
  "wine"
];
var CONVERSATION_NEGATIVE_TERMS = [
  "club",
  "crowded",
  "dance",
  "dj",
  "late night",
  "loud",
  "nightlife"
];
var SURPRISE_TERMS = [
  "chef counter",
  "hidden",
  "omakase",
  "reservation",
  "rotating",
  "seasonal",
  "speakeasy",
  "tasting"
];
var NIGHTLIFE_SIGNATURE_TERMS = [
  "bar",
  "cocktails",
  "dj",
  "jazz",
  "late night",
  "listening",
  "nightlife",
  "rooftop",
  "speakeasy"
];
var DINING_SIGNATURE_TERMS = [
  "chef",
  "chef counter",
  "chef led",
  "degustation",
  "omakase",
  "seasonal",
  "small plate",
  "small plates",
  "tapas",
  "tasting menu",
  "wine pairing"
];
var LOCAL_CHARACTER_TERMS = [
  "artisan",
  "community",
  "courtyard",
  "heritage",
  "historic",
  "local",
  "neighborhood",
  "seasonal",
  "underexposed"
];
var GENERIC_PREMIUM_TERMS = [
  "elevated",
  "modern",
  "new american",
  "polished",
  "refined",
  "stylish",
  "upscale"
];
var QUICK_STOP_TERMS = [
  "counter",
  "grab",
  "grab-and-go",
  "kiosk",
  "quick",
  "takeout",
  "to-go",
  "walk-up"
];
var LANDING_TERMS = [
  "bakery",
  "calm",
  "dessert",
  "low-key",
  "nightcap",
  "pastry",
  "quiet",
  "tea",
  "wind down",
  "wine"
];
var CENTERPIECE_TERMS = [
  "chef",
  "destination",
  "event",
  "experiential",
  "immersive",
  "must-visit",
  "notable",
  "reservation",
  "signature",
  "tasting"
];
var START_FRICTION_TERMS = [
  "chef counter",
  "degustation",
  "lineup",
  "omakase",
  "reservation",
  "set menu",
  "tasting menu"
];
function interpretVenueTaste(venue, context) {
  const inferred = inferRuleProfile(venue, context);
  const sourceMode = resolveSourceMode(venue.seedCalibratedProfile, inferred.profile);
  const baseProfile = mergeProfile(venue.seedCalibratedProfile, inferred.profile);
  const tonePressure = applyContextTonePressure(baseProfile, venue, context);
  const profile = tonePressure.profile;
  const experienceStrengths = inferred.experienceStrengths;
  const experienceArchetypes = deriveExperienceArchetypes(
    venue,
    profile,
    experienceStrengths
  );
  const hyperlocalActivation = deriveHyperlocalActivation(
    venue,
    profile,
    experienceArchetypes,
    context
  );
  const momentEnrichment = deriveMomentEnrichment(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    hyperlocalActivation
  );
  const romanticSignals = deriveRomanticSignals(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    momentEnrichment
  );
  const romanticScore = deriveRomanticScore(romanticSignals);
  const romanticFlavor = deriveRomanticFlavor(romanticSignals, romanticScore);
  const momentPotential = deriveMomentPotential(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    momentEnrichment,
    hyperlocalActivation
  );
  const momentIdentity = deriveMomentIdentity(
    venue,
    profile,
    momentPotential,
    experienceArchetypes
  );
  const isRomanticMomentCandidate = deriveRomanticMomentCandidate(
    venue,
    romanticSignals,
    romanticScore,
    momentIdentity,
    experienceArchetypes,
    momentEnrichment
  );
  const noveltyWeight = deriveNoveltyWeight(
    venue,
    profile,
    momentPotential,
    momentEnrichment,
    hyperlocalActivation
  );
  const calibration = deriveTasteCalibration(venue, profile, noveltyWeight);
  const durationEstimate = deriveDurationEstimate(venue, profile);
  const baseRoleSuitability = deriveRoleSuitability(
    venue,
    profile,
    durationEstimate,
    noveltyWeight,
    calibration,
    experienceStrengths,
    momentPotential,
    experienceArchetypes,
    momentEnrichment,
    hyperlocalActivation,
    context
  );
  const anchorStrength = deriveAnchorStrength(
    venue,
    profile,
    baseRoleSuitability.highlight,
    calibration,
    experienceStrengths,
    momentPotential
  );
  const highlightTier = deriveHighlightTier(
    venue,
    baseRoleSuitability.highlight,
    profile,
    anchorStrength,
    experienceStrengths,
    durationEstimate,
    context
  );
  const momentIntensity = deriveMomentIntensity(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    momentPotential,
    momentIdentity,
    romanticSignals,
    noveltyWeight,
    calibration,
    anchorStrength,
    highlightTier,
    momentEnrichment,
    hyperlocalActivation
  );
  const momentTier = deriveMomentTier(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    momentPotential,
    momentIdentity,
    momentIntensity,
    momentEnrichment,
    hyperlocalActivation
  );
  const baseExperienceFamily = deriveExperienceFamily(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    romanticSignals,
    momentIntensity,
    calibration,
    momentEnrichment,
    hyperlocalActivation
  );
  const familyExpansion = deriveExpandedExperienceFamily(
    venue,
    profile,
    momentPotential,
    momentIntensity,
    momentEnrichment,
    hyperlocalActivation,
    baseExperienceFamily
  );
  const experienceFamily = familyExpansion.family;
  const momentElevation = deriveActivationMomentElevation(
    profile,
    momentPotential,
    momentIntensity,
    hyperlocalActivation,
    experienceFamily,
    familyExpansion.expanded
  );
  const roleSuitability = applyExpandedFamilyRoleAdjustment(
    baseRoleSuitability,
    experienceFamily,
    baseExperienceFamily,
    hyperlocalActivation
  );
  const venuePersonality = deriveVenuePersonality(
    venue,
    profile,
    roleSuitability,
    highlightTier,
    durationEstimate,
    momentIntensity,
    context
  );
  const debugSignals = finalizeSupportingSignals(
    [...inferred.supportingSignals, ...tonePressure.signals],
    sourceMode,
    momentIntensity,
    experienceFamily,
    momentEnrichment,
    hyperlocalActivation,
    momentElevation.eligible
  );
  return {
    ...profile,
    outdoorStrength: experienceStrengths.outdoor,
    interactiveStrength: experienceStrengths.interactive,
    roleSuitability,
    highlightTier,
    durationEstimate,
    venuePersonality,
    experienceArchetypes: experienceArchetypes.archetypes,
    primaryExperienceArchetype: experienceArchetypes.primary,
    baseExperienceFamily,
    experienceFamily,
    experienceFamilyExpanded: familyExpansion.expanded,
    experienceFamilyExpansionReason: familyExpansion.reason,
    momentElevationPotential: momentElevation.potential,
    isElevatedMomentCandidate: momentElevation.eligible,
    momentElevationReason: momentElevation.reason,
    momentPotential,
    momentIdentity,
    momentIntensity,
    momentTier,
    momentEnrichment,
    hyperlocalActivation,
    romanticSignals,
    romanticScore,
    romanticFlavor,
    isRomanticMomentCandidate,
    noveltyWeight,
    categorySpecificity: calibration.categorySpecificity,
    personalityStrength: calibration.personalityStrength,
    anchorStrength,
    debug: {
      sourceMode,
      supportingSignals: debugSignals,
      confidence: deriveDebugConfidence(venue, sourceMode),
      seedCalibratedApplied: Boolean(venue.seedCalibratedProfile),
      interpretationStrategy: sourceMode
    }
  };
}
function inferRuleProfile(venue, context) {
  const profile = { ...CATEGORY_BASELINES[venue.category] };
  const supportingSignals = [`baseline:${venue.category}`];
  const keywords = buildKeywordCorpus(venue);
  const energyBump = keywordScore(keywords, HIGH_ENERGY_TERMS);
  const calmBump = keywordScore(keywords, CALM_TERMS);
  const destinationBump = keywordScore(keywords, DESTINATION_TERMS);
  const lingerBump = keywordScore(keywords, LINGER_TERMS);
  const socialBump = keywordScore(keywords, SOCIAL_TERMS);
  const conversationBump = keywordScore(keywords, CONVERSATION_POSITIVE_TERMS);
  const conversationPenalty = keywordScore(keywords, CONVERSATION_NEGATIVE_TERMS);
  const surpriseBump = keywordScore(keywords, SURPRISE_TERMS);
  const outdoorBump = keywordScore(keywords, OUTDOOR_TERMS);
  const scenicBump = keywordScore(keywords, SCENIC_TERMS);
  const interactiveBump = keywordScore(keywords, INTERACTIVE_TERMS);
  const socialActivityBump = keywordScore(keywords, SOCIAL_ACTIVITY_TERMS);
  const passiveHospitalityBump = keywordScore(keywords, PASSIVE_HOSPITALITY_TERMS);
  const experienceStrengths = deriveExperienceStrengths(venue, {
    outdoorBump,
    scenicBump,
    interactiveBump,
    socialActivityBump,
    passiveHospitalityBump
  });
  profile.energy = clamp0119(profile.energy + energyBump * 0.18 - calmBump * 0.12);
  profile.socialDensity = clamp0119(
    profile.socialDensity + socialBump * 0.16 + energyBump * 0.08 + socialActivityBump * 0.08 - calmBump * 0.06
  );
  profile.intimacy = clamp0119(
    profile.intimacy + calmBump * 0.18 + scenicBump * 0.08 - socialBump * 0.08 - energyBump * 0.06 - interactiveBump * 0.04
  );
  profile.lingerFactor = clamp0119(
    profile.lingerFactor + lingerBump * 0.16 + outdoorBump * 0.06
  );
  profile.destinationFactor = clamp0119(
    profile.destinationFactor + destinationBump * 0.2 + surpriseBump * 0.08 + scenicBump * 0.2 + experienceStrengths.outdoor * 0.14 + experienceStrengths.interactive * 0.1 - experienceStrengths.passiveHospitality * 0.05
  );
  profile.experientialFactor = clamp0119(
    profile.experientialFactor + destinationBump * 0.14 + surpriseBump * 0.18 + interactiveBump * 0.2 + socialActivityBump * 0.12 + experienceStrengths.outdoor * 0.12 + experienceStrengths.interactive * 0.18 - experienceStrengths.passiveHospitality * 0.08
  );
  profile.conversationFriendliness = clamp0119(
    profile.conversationFriendliness + conversationBump * 0.16 + calmBump * 0.08 - conversationPenalty * 0.18 + experienceStrengths.outdoor * 0.08 - experienceStrengths.interactive * 0.04
  );
  profile.energy = clamp0119(
    profile.energy + experienceStrengths.interactive * 0.08 - experienceStrengths.outdoor * 0.02 - experienceStrengths.passiveHospitality * 0.03
  );
  if (venue.priceLevel === "$$$" || venue.priceLevel === "$$$$") {
    profile.destinationFactor = clamp0119(profile.destinationFactor + 0.08);
    profile.experientialFactor = clamp0119(profile.experientialFactor + 0.06);
    pushSupportingSignal(supportingSignals, "metadata:premium-price");
  }
  const hasHighRatingCue = (venue.rating ?? 0) >= 4.5;
  const hasHighReviewCue = (venue.reviewCount ?? 0) >= 250;
  if (hasHighRatingCue) {
    profile.destinationFactor = clamp0119(profile.destinationFactor + 0.04);
    profile.experientialFactor = clamp0119(profile.experientialFactor + 0.04);
  }
  if (hasHighReviewCue) {
    profile.socialDensity = clamp0119(profile.socialDensity + 0.06);
    profile.destinationFactor = clamp0119(profile.destinationFactor + 0.04);
  }
  if (hasHighRatingCue || hasHighReviewCue) {
    pushSupportingSignal(supportingSignals, "metadata:strong-social-proof");
  }
  if (energyBump >= 0.33) {
    pushSupportingSignal(supportingSignals, "keyword:high-energy");
  }
  if (calmBump >= 0.33) {
    pushSupportingSignal(supportingSignals, "keyword:calm");
  }
  if (destinationBump >= 0.33 || surpriseBump >= 0.33) {
    pushSupportingSignal(supportingSignals, "keyword:destination");
  }
  if (lingerBump >= 0.33) {
    pushSupportingSignal(supportingSignals, "keyword:linger");
  }
  if (experienceStrengths.outdoor >= 0.58) {
    pushSupportingSignal(supportingSignals, "signal:outdoor-strong");
  } else if (experienceStrengths.outdoor >= 0.38) {
    pushSupportingSignal(supportingSignals, "signal:outdoor-light");
  }
  if (experienceStrengths.interactive >= 0.58) {
    pushSupportingSignal(supportingSignals, "signal:interactive-strong");
  } else if (experienceStrengths.interactive >= 0.38) {
    pushSupportingSignal(supportingSignals, "signal:interactive-light");
  }
  if (conversationBump >= 0.33) {
    pushSupportingSignal(supportingSignals, "keyword:conversation-friendly");
  }
  if (conversationPenalty >= 0.33) {
    pushSupportingSignal(supportingSignals, "keyword:loud");
  }
  const experienceArchetypes = deriveExperienceArchetypes(
    venue,
    profile,
    experienceStrengths
  );
  const hyperlocalActivation = deriveHyperlocalActivation(
    venue,
    profile,
    experienceArchetypes,
    context
  );
  const momentEnrichment = deriveMomentEnrichment(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    hyperlocalActivation
  );
  const momentPotential = deriveMomentPotential(
    venue,
    profile,
    experienceStrengths,
    experienceArchetypes,
    momentEnrichment,
    hyperlocalActivation
  );
  if (momentPotential.score >= 0.68) {
    pushSupportingSignal(supportingSignals, "signal:moment-strong");
  } else if (momentPotential.score >= 0.48) {
    pushSupportingSignal(supportingSignals, "signal:moment-light");
  }
  if (hyperlocalActivation.primaryActivationType) {
    pushSupportingSignal(
      supportingSignals,
      `signal:activation-${hyperlocalActivation.primaryActivationType.replace(/_/g, "-")}`
    );
  }
  return {
    profile: clampProfile(profile),
    supportingSignals,
    experienceStrengths
  };
}
function mergeProfile(seed, inferred) {
  if (!seed) {
    return inferred;
  }
  const seedWeight = 0.7;
  const inferredWeight = 0.3;
  return clampProfile({
    energy: seed.energy * seedWeight + inferred.energy * inferredWeight,
    socialDensity: seed.socialDensity * seedWeight + inferred.socialDensity * inferredWeight,
    intimacy: seed.intimacy * seedWeight + inferred.intimacy * inferredWeight,
    lingerFactor: seed.lingerFactor * seedWeight + inferred.lingerFactor * inferredWeight,
    destinationFactor: seed.destinationFactor * seedWeight + inferred.destinationFactor * inferredWeight,
    experientialFactor: seed.experientialFactor * seedWeight + inferred.experientialFactor * inferredWeight,
    conversationFriendliness: seed.conversationFriendliness * seedWeight + inferred.conversationFriendliness * inferredWeight
  });
}
function applyContextTonePressure(profile, venue, context) {
  const persona = context?.persona ?? void 0;
  const vibe = context?.vibe ?? void 0;
  if (!vibe) {
    return { profile, signals: [] };
  }
  const keywords = buildKeywordCorpus(venue);
  const livelyLike = vibe === "lively" || vibe === "playful";
  const cozyLike = vibe === "cozy" || vibe === "chill";
  const energeticCue = clamp0119(
    keywordScore(keywords, HIGH_ENERGY_TERMS) * 0.56 + keywordScore(keywords, TEMPORAL_ENERGY_TERMS) * 0.22 + (venue.category === "bar" || venue.category === "live_music" ? 0.14 : 0)
  );
  const calmCue = clamp0119(
    keywordScore(keywords, CALM_TERMS) * 0.56 + keywordScore(keywords, LANDING_TERMS) * 0.18 + (venue.category === "dessert" || venue.category === "cafe" ? 0.12 : 0)
  );
  const containedSocialCue = clamp0119(
    profile.socialDensity * 0.34 + profile.energy * 0.2 + profile.intimacy * 0.24 + profile.conversationFriendliness * 0.16 + keywordScore(keywords, AMBIENT_TERMS) * 0.06
  );
  const broadSocialCue = clamp0119(
    profile.socialDensity * 0.42 + profile.energy * 0.3 + keywordScore(keywords, SOCIAL_TERMS) * 0.2 + energeticCue * 0.18 - profile.intimacy * 0.12
  );
  const nextProfile = { ...profile };
  const signals = [];
  if (livelyLike) {
    const livelyLift = 0.08 + energeticCue * 0.08 + (venue.category === "bar" || venue.category === "live_music" ? 0.04 : 0);
    nextProfile.energy = clamp0119(nextProfile.energy + livelyLift);
    nextProfile.socialDensity = clamp0119(nextProfile.socialDensity + 0.07 + broadSocialCue * 0.07);
    nextProfile.experientialFactor = clamp0119(nextProfile.experientialFactor + 0.06);
    nextProfile.destinationFactor = clamp0119(
      nextProfile.destinationFactor + 0.03 + energeticCue * 0.03
    );
    if (persona === "romantic") {
      nextProfile.intimacy = clamp0119(nextProfile.intimacy - 0.01 + containedSocialCue * 0.05);
      nextProfile.conversationFriendliness = clamp0119(
        nextProfile.conversationFriendliness - 0.02 + containedSocialCue * 0.04
      );
      signals.push("tone:vibe-lively-romantic-contained-lift");
    } else if (persona === "friends") {
      nextProfile.intimacy = clamp0119(nextProfile.intimacy - 0.06);
      nextProfile.conversationFriendliness = clamp0119(nextProfile.conversationFriendliness - 0.03);
      signals.push("tone:vibe-lively-friends-broad-social-lift");
    } else {
      nextProfile.intimacy = clamp0119(nextProfile.intimacy - 0.03);
      nextProfile.conversationFriendliness = clamp0119(nextProfile.conversationFriendliness - 0.02);
      signals.push("tone:vibe-lively-general-lift");
    }
  } else if (cozyLike) {
    const cozySoftening = 0.09 + calmCue * 0.06;
    nextProfile.energy = clamp0119(nextProfile.energy - cozySoftening);
    nextProfile.socialDensity = clamp0119(nextProfile.socialDensity - 0.08 - broadSocialCue * 0.04);
    nextProfile.intimacy = clamp0119(nextProfile.intimacy + 0.08 + calmCue * 0.06);
    nextProfile.conversationFriendliness = clamp0119(
      nextProfile.conversationFriendliness + 0.07 + calmCue * 0.04
    );
    nextProfile.lingerFactor = clamp0119(nextProfile.lingerFactor + 0.05);
    nextProfile.destinationFactor = clamp0119(nextProfile.destinationFactor - 0.02 + calmCue * 0.02);
    signals.push("tone:vibe-cozy-softening");
  } else if (vibe === "cultured") {
    nextProfile.destinationFactor = clamp0119(nextProfile.destinationFactor + 0.05);
    nextProfile.experientialFactor = clamp0119(nextProfile.experientialFactor + 0.05);
    nextProfile.conversationFriendliness = clamp0119(nextProfile.conversationFriendliness + 0.03);
    nextProfile.energy = clamp0119(nextProfile.energy + 0.01);
    signals.push("tone:vibe-cultured-curation-lift");
  } else if (vibe === "adventurous-outdoor" || vibe === "adventurous-urban") {
    nextProfile.energy = clamp0119(nextProfile.energy + 0.06);
    nextProfile.socialDensity = clamp0119(nextProfile.socialDensity + 0.03);
    nextProfile.experientialFactor = clamp0119(nextProfile.experientialFactor + 0.07);
    nextProfile.destinationFactor = clamp0119(nextProfile.destinationFactor + 0.03);
    nextProfile.lingerFactor = clamp0119(nextProfile.lingerFactor + 0.02);
    signals.push("tone:vibe-adventurous-lift");
  }
  return {
    profile: clampProfile(nextProfile),
    signals
  };
}
function deriveRoleSuitability(venue, profile, durationEstimate, noveltyWeight, calibration, experienceStrengths, momentPotential, experienceArchetypes, momentEnrichment, hyperlocalActivation, context) {
  const keywords = buildKeywordCorpus(venue);
  const quickStopSignal = clamp0119(
    keywordScore(keywords, QUICK_STOP_TERMS) * 0.72 + (durationEstimate === "quick" ? 0.22 : 0)
  );
  const landingSignal = clamp0119(
    keywordScore(keywords, LANDING_TERMS) * 0.58 + keywordScore(keywords, CALM_TERMS) * 0.3 + (venue.category === "dessert" || venue.category === "cafe" ? 0.12 : 0) + (durationEstimate === "extended" || durationEstimate === "moderate" ? 0.08 : 0)
  );
  const centerpieceSignal = clamp0119(
    keywordScore(keywords, CENTERPIECE_TERMS) * 0.42 + profile.destinationFactor * 0.24 + profile.experientialFactor * 0.22 + venue.signatureStrength * 0.12 + (venue.highlightCapable ? 0.12 : 0)
  );
  const startFrictionSignal = clamp0119(
    keywordScore(keywords, START_FRICTION_TERMS) * 0.56 + keywordScore(keywords, DESTINATION_TERMS) * 0.18 + (durationEstimate === "event" ? 0.12 : 0)
  );
  const nightlifePressure = clamp0119(
    calibration.nightlifeStrength * 0.56 + profile.energy * 0.3 + profile.socialDensity * 0.14
  );
  const hoursConfidence = venue.hoursConfidence ?? 0.5;
  const temporalAdjustments = hyperlocalActivation.temporalCompatibility.roleAdjustments;
  const startHoursSupport = venue.hoursStatus === "open" || venue.hoursStatus === "likely_open" ? 0.06 : venue.hoursStatus === "closed" || venue.hoursStatus === "likely_closed" ? -0.1 : 0;
  const quickDurationPenalty = durationEstimate === "quick" ? 0.14 : durationEstimate === "event" ? 0.1 : durationEstimate === "moderate" ? 0.04 : 0;
  const startDurationPenalty = durationEstimate === "event" ? 0.18 : durationEstimate === "extended" ? 0.06 : 0;
  const windDownDurationPenalty = durationEstimate === "event" ? 0.2 : durationEstimate === "quick" ? 0.04 : 0;
  let start = clamp0119(
    profile.conversationFriendliness * 0.28 + profile.socialDensity * 0.14 + profile.intimacy * 0.08 + (1 - profile.energy) * 0.1 + profile.lingerFactor * 0.1 + (1 - profile.destinationFactor) * 0.08 + (1 - profile.experientialFactor) * 0.06 + calibration.categorySpecificity * 0.06 + calibration.personalityStrength * 0.04 + experienceStrengths.outdoor * 0.06 + experienceStrengths.interactive * 0.03 + hoursConfidence * 0.12 + startHoursSupport + (1 - calibration.nightlifeStrength) * 0.04 - calibration.signatureDiningStrength * 0.03 - startFrictionSignal * 0.16 - centerpieceSignal * 0.2 - startDurationPenalty + quickStopSignal * 0.08 + temporalAdjustments.start + (venue.category === "cafe" ? 0.06 : 0)
  );
  const categoryIdentityBoost = experienceStrengths.interactive >= 0.7 || experienceStrengths.outdoor >= 0.76 ? 0.11 : venue.category === "activity" || venue.category === "museum" || venue.category === "park" || venue.category === "event" ? 0.08 : venue.category === "restaurant" || venue.category === "bar" || venue.category === "live_music" ? 0.05 : 0.02;
  const distinctiveArchetypeBoost = experienceArchetypes.archetypes.some(
    (archetype) => archetype === "outdoor" || archetype === "activity" || archetype === "culture" || archetype === "scenic"
  ) ? 0.09 : experienceArchetypes.archetypes.includes("social") ? 0.05 : 0.02;
  const quickStopSuppression = quickStopSignal >= 0.55 && !(venue.signatureStrength >= 0.8 && profile.destinationFactor >= 0.74) ? 0.16 : quickDurationPenalty;
  let highlight = clamp0119(
    profile.destinationFactor * 0.22 + profile.experientialFactor * 0.22 + profile.energy * 0.1 + experienceStrengths.interactive * 0.12 + experienceStrengths.outdoor * 0.1 + momentPotential.score * 0.14 + momentEnrichment.highlightSurfaceBoost * 0.12 + hyperlocalActivation.interpretationImpact.highlightSuitability * 0.24 + venue.signatureStrength * 0.15 + venue.qualityScore * 0.08 + noveltyWeight * 0.08 + calibration.categorySpecificity * 0.12 + calibration.personalityStrength * 0.12 + Math.max(calibration.nightlifeStrength, calibration.signatureDiningStrength) * 0.1 + calibration.eveningFit * 0.06 + centerpieceSignal * 0.18 + temporalAdjustments.highlight + categoryIdentityBoost + distinctiveArchetypeBoost - quickStopSuppression - landingSignal * 0.12 - calibration.genericPremiumPenalty * 0.12 + (venue.highlightCapable === false ? 0.12 : 0) + (venue.category === "restaurant" || venue.category === "bar" ? 0.01 : 0)
  );
  let windDown = clamp0119(
    profile.intimacy * 0.26 + profile.conversationFriendliness * 0.24 + profile.lingerFactor * 0.2 + experienceStrengths.outdoor * 0.05 + (1 - profile.energy) * 0.14 + (1 - profile.socialDensity) * 0.08 + landingSignal * 0.18 + calibration.categorySpecificity * 0.04 + hoursConfidence * 0.08 + (1 - calibration.nightlifeStrength) * 0.04 - calibration.signatureDiningStrength * 0.02 + (durationEstimate === "moderate" || durationEstimate === "extended" ? 0.04 : 0) - windDownDurationPenalty - centerpieceSignal * 0.2 - nightlifePressure * 0.12 + temporalAdjustments.windDown + (venue.category === "dessert" || venue.category === "cafe" || venue.category === "park" ? 0.08 : venue.category === "bar" ? 0.02 : 0)
  );
  if (highlight >= 0.72) {
    const dominance = clamp0119((highlight - 0.72) * 1.18 + centerpieceSignal * 0.28);
    start = clamp0119(start - 0.14 * dominance);
    windDown = clamp0119(windDown - 0.2 * dominance);
  }
  if (start >= 0.66 && centerpieceSignal >= 0.58) {
    start = clamp0119(start - 0.12);
  }
  if (windDown >= 0.62 && (profile.energy >= 0.66 || nightlifePressure >= 0.62 || centerpieceSignal >= 0.66)) {
    windDown = clamp0119(windDown - 0.16);
  }
  if (landingSignal >= 0.58) {
    highlight = clamp0119(highlight - 0.08 * landingSignal);
  }
  const vibe = context?.vibe ?? void 0;
  const persona = context?.persona ?? void 0;
  const livelyLike = vibe === "lively" || vibe === "playful";
  const cozyLike = vibe === "cozy" || vibe === "chill";
  const livelyPulseSignal = clamp0119(
    profile.energy * 0.36 + profile.socialDensity * 0.26 + nightlifePressure * 0.2 + momentPotential.score * 0.08 + venue.signatureStrength * 0.1
  );
  const containedPulseSignal = clamp0119(
    livelyPulseSignal * 0.54 + profile.intimacy * 0.2 + profile.conversationFriendliness * 0.16 + (1 - quickStopSignal) * 0.1
  );
  const softCenterSignal = clamp0119(
    (1 - profile.energy) * 0.44 + (1 - profile.socialDensity) * 0.26 + landingSignal * 0.16 + profile.intimacy * 0.14
  );
  const broadChaosSignal = clamp0119(
    profile.energy * 0.42 + profile.socialDensity * 0.32 + nightlifePressure * 0.2 - profile.intimacy * 0.16 - profile.conversationFriendliness * 0.1
  );
  if (livelyLike) {
    highlight = clamp0119(
      highlight + livelyPulseSignal * 0.1 + containedPulseSignal * 0.06 - softCenterSignal * 0.1
    );
    start = clamp0119(start - livelyPulseSignal * 0.08);
    windDown = clamp0119(windDown - livelyPulseSignal * 0.06);
    if (persona === "romantic") {
      highlight = clamp0119(highlight + containedPulseSignal * 0.08 - broadChaosSignal * 0.1);
      if (softCenterSignal >= 0.62 && centerpieceSignal < 0.62) {
        highlight = clamp0119(highlight - 0.1);
      }
    } else if (persona === "friends") {
      highlight = clamp0119(highlight + livelyPulseSignal * 0.08);
      start = clamp0119(start + profile.socialDensity * 0.04);
    } else if (persona === "family") {
      highlight = clamp0119(highlight - broadChaosSignal * 0.08);
      windDown = clamp0119(windDown + profile.conversationFriendliness * 0.05);
    }
  } else if (cozyLike) {
    highlight = clamp0119(
      highlight - livelyPulseSignal * 0.14 + profile.intimacy * 0.08 + landingSignal * 0.06
    );
    start = clamp0119(start + profile.conversationFriendliness * 0.06 + profile.intimacy * 0.04);
    windDown = clamp0119(windDown + landingSignal * 0.08 + profile.conversationFriendliness * 0.06);
  }
  const surprise = clamp0119(
    noveltyWeight * 0.28 + profile.experientialFactor * 0.2 + profile.destinationFactor * 0.18 + momentPotential.score * 0.1 + Math.max(
      momentEnrichment.temporalEnergy,
      momentEnrichment.culturalDepth
    ) * 0.08 + hyperlocalActivation.interpretationImpact.novelty * 0.16 + experienceStrengths.interactive * 0.14 + experienceStrengths.outdoor * 0.06 + profile.energy * 0.08 + venue.signatureStrength * 0.12 + calibration.personalityStrength * 0.08 + temporalAdjustments.surprise + calibration.categorySpecificity * 0.04 + (venue.category === "event" || venue.category === "activity" ? 0.08 : 0)
  );
  return {
    start,
    highlight,
    windDown,
    surprise
  };
}
function deriveHighlightTier(venue, highlightSuitability, profile, anchorStrength, experienceStrengths, durationEstimate, context) {
  const quickDurationPenalty = durationEstimate === "quick" ? 0.12 : 0;
  const vibe = context?.vibe ?? void 0;
  const persona = context?.persona ?? void 0;
  const livelyLike = vibe === "lively" || vibe === "playful";
  const cozyLike = vibe === "cozy" || vibe === "chill";
  const pulseBand = clamp0119(
    profile.energy * 0.46 + profile.socialDensity * 0.28 + profile.experientialFactor * 0.14 + (durationEstimate === "event" ? 0.12 : 0)
  );
  const socialContainment = clamp0119(
    profile.intimacy * 0.34 + profile.conversationFriendliness * 0.28 + profile.socialDensity * 0.24 + profile.energy * 0.14
  );
  const broadNightlifeSignal = clamp0119(
    profile.energy * 0.44 + profile.socialDensity * 0.36 - profile.intimacy * 0.12 - profile.conversationFriendliness * 0.08
  );
  const categoryCenterpieceLift = venue.category === "event" || venue.category === "live_music" ? 0.08 : venue.category === "activity" || venue.category === "museum" ? 0.06 : venue.category === "restaurant" || venue.category === "bar" ? 0.04 : 0.02;
  const highlightStrength = highlightSuitability * 0.42 + profile.destinationFactor * 0.16 + profile.experientialFactor * 0.16 + Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.1 + venue.signatureStrength * 0.12 + venue.qualityScore * 0.08 + anchorStrength * 0.16 + categoryCenterpieceLift - quickDurationPenalty;
  const vibeAdjustedStrength = clamp0119(
    highlightStrength + (livelyLike ? pulseBand * 0.08 : 0) - (cozyLike ? pulseBand * 0.06 : 0) + (cozyLike ? socialContainment * 0.04 : 0)
  );
  const exceptionalQuickCenterpiece = durationEstimate === "quick" && venue.signatureStrength >= 0.82 && profile.destinationFactor >= 0.76 && profile.experientialFactor >= 0.74 && highlightSuitability >= 0.8 && anchorStrength >= 0.74;
  const livelyToneQualified = !livelyLike || pulseBand >= 0.56 && (persona !== "romantic" || socialContainment >= 0.52) && (persona === "friends" || broadNightlifeSignal <= 0.82);
  const cozyToneQualified = !cozyLike || profile.intimacy >= 0.56 && profile.conversationFriendliness >= 0.52 && pulseBand <= 0.72;
  if (vibeAdjustedStrength >= 0.84 && highlightSuitability >= 0.74 && profile.destinationFactor >= 0.64 && profile.experientialFactor >= 0.62 && venue.signatureStrength >= 0.62 && venue.qualityScore >= 0.58 && venue.highlightCapable !== false && livelyToneQualified && cozyToneQualified && (durationEstimate !== "quick" || exceptionalQuickCenterpiece)) {
    return 1;
  }
  if (vibeAdjustedStrength >= 0.64 && highlightSuitability >= 0.58 && (persona !== "romantic" || !livelyLike || pulseBand >= 0.5) && (profile.destinationFactor >= 0.5 || profile.experientialFactor >= 0.54)) {
    return 2;
  }
  return 3;
}
function deriveMomentIntensity(venue, profile, experienceStrengths, experienceArchetypes, momentPotential, momentIdentity, romanticSignals, noveltyWeight, calibration, anchorStrength, highlightTier, momentEnrichment, hyperlocalActivation) {
  const primaryArchetype = experienceArchetypes.primary;
  const signatureQuality = clamp0119(
    anchorStrength * 0.42 + venue.signatureStrength * 0.34 + venue.qualityScore * 0.24
  );
  const distinctiveIdentity = clamp0119(
    calibration.categorySpecificity * 0.48 + calibration.personalityStrength * 0.32 + noveltyWeight * 0.2
  );
  const experientialRichness = clamp0119(
    profile.experientialFactor * 0.34 + profile.destinationFactor * 0.22 + Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.28 + momentPotential.score * 0.16 + Math.max(
      momentEnrichment.ambientUniqueness,
      momentEnrichment.culturalDepth
    ) * 0.12
  );
  const scenicStrength = clamp0119(
    romanticSignals.scenic * 0.58 + experienceStrengths.outdoor * 0.28 + (primaryArchetype === "scenic" ? 0.14 : primaryArchetype === "outdoor" ? 0.08 : 0)
  );
  const activityRichness = clamp0119(
    romanticSignals.sharedActivity * 0.52 + experienceStrengths.interactive * 0.34 + (primaryArchetype === "activity" ? 0.14 : primaryArchetype === "culture" ? 0.08 : 0)
  );
  const ambientPull = clamp0119(
    Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) * 0.68 + profile.intimacy * 0.14 + (primaryArchetype === "culture" || primaryArchetype === "social" ? 0.1 : 0)
  );
  const temporalLift = clamp0119(
    momentEnrichment.temporalEnergy * 0.56 + momentEnrichment.socialEnergy * 0.14 + profile.destinationFactor * 0.1 + profile.experientialFactor * 0.08 + (venue.category === "live_music" || venue.category === "event" ? 0.1 : 0)
  );
  const culturalImmersion = clamp0119(
    momentEnrichment.culturalDepth * 0.62 + momentEnrichment.ambientUniqueness * 0.12 + profile.destinationFactor * 0.08 + (primaryArchetype === "culture" ? 0.12 : 0)
  );
  const vibeRichness = clamp0119(
    momentEnrichment.ambientUniqueness * 0.62 + profile.intimacy * 0.1 + venue.signatureStrength * 0.08 + (venue.setting === "indoor" || venue.setting === "hybrid" ? 0.08 : 0)
  );
  const hyperlocalLift = clamp0119(
    hyperlocalActivation.intensityContribution * 0.72 + hyperlocalActivation.interpretationImpact.momentIntensity * 0.34 + (hyperlocalActivation.materiallyChangesHighlightPotential ? 0.08 : 0) + (hyperlocalActivation.temporalLabel === "active" ? 0.06 : 0)
  );
  const highlightTierLift = highlightTier === 1 ? 0.14 : highlightTier === 2 ? 0.07 : 0;
  const momentIdentityLift = momentIdentity.type === "anchor" ? 0.12 : momentIdentity.type === "explore" ? 0.09 : momentIdentity.type === "transition" ? 0.02 : 0;
  const momentStrengthLift = momentIdentity.strength === "strong" ? 0.12 : momentIdentity.strength === "medium" ? 0.06 : 0;
  const passiveHospitalityPenalty = experienceStrengths.passiveHospitality * 0.08;
  const score = clamp0119(
    momentPotential.score * 0.22 + signatureQuality * 0.16 + distinctiveIdentity * 0.12 + experientialRichness * 0.12 + Math.max(
      scenicStrength,
      activityRichness,
      ambientPull,
      temporalLift,
      culturalImmersion,
      vibeRichness,
      hyperlocalLift
    ) * 0.16 + profile.destinationFactor * 0.08 + venue.qualityScore * 0.06 + highlightTierLift * 0.45 + momentIdentityLift * 0.42 + momentStrengthLift * 0.42 - passiveHospitalityPenalty
  );
  const tier = score >= 0.935 && signatureQuality >= 0.72 && momentPotential.score >= 0.68 && highlightTier === 1 ? "signature" : score >= 0.72 && (momentPotential.score >= 0.6 || momentIdentity.strength === "strong") ? "exceptional" : score >= 0.56 ? "strong" : "standard";
  const driverScores = [
    { label: "scenic pull", value: scenicStrength },
    { label: "shared activity", value: activityRichness },
    { label: "ambient romance", value: ambientPull },
    { label: "temporal lift", value: temporalLift },
    { label: "cultural depth", value: culturalImmersion },
    { label: "ambient uniqueness", value: vibeRichness },
    { label: "hyperlocal activation", value: hyperlocalLift },
    { label: "signature quality", value: signatureQuality },
    { label: "distinctive identity", value: distinctiveIdentity },
    { label: "experiential richness", value: experientialRichness }
  ].filter((driver) => driver.value >= 0.46).sort((left, right) => right.value - left.value).slice(0, 3);
  return {
    score,
    tier,
    drivers: driverScores.length > 0 ? driverScores.map((driver) => driver.label) : ["baseline moment read"]
  };
}
function deriveMomentTier(venue, profile, experienceStrengths, experienceArchetypes, momentPotential, momentIdentity, momentIntensity, momentEnrichment, hyperlocalActivation) {
  const keywords = buildKeywordCorpus(venue);
  const primaryArchetype = experienceArchetypes.primary;
  const destinationKeyword = keywordScore(keywords, DESTINATION_TERMS);
  const identityKeyword = keywordScore(keywords, MOMENT_ANCHOR_IDENTITY_TERMS);
  const identitySignal = clamp0119(
    destinationKeyword * 0.44 + identityKeyword * 0.34 + venue.signatureStrength * 0.12 + venue.qualityScore * 0.1
  );
  const destinationRead = clamp0119(
    profile.destinationFactor * 0.28 + momentPotential.score * 0.2 + momentIntensity.score * 0.1 + venue.signatureStrength * 0.14 + venue.qualityScore * 0.1 + identitySignal * 0.18 + (momentIdentity.type === "anchor" ? 0.14 : momentIdentity.type === "explore" ? 0.08 : momentIdentity.type === "linger" ? 0.04 : 0)
  );
  const experientialRichness = clamp0119(
    profile.experientialFactor * 0.3 + momentIntensity.score * 0.2 + momentPotential.score * 0.16 + Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.12 + Math.max(
      momentEnrichment.ambientUniqueness,
      momentEnrichment.culturalDepth
    ) * 0.12 + hyperlocalActivation.intensityContribution * 0.1
  );
  const memorability = clamp0119(
    venue.signatureStrength * 0.38 + venue.qualityScore * 0.2 + momentIntensity.score * 0.2 + Math.max(
      momentEnrichment.ambientUniqueness,
      momentEnrichment.culturalDepth
    ) * 0.14 + hyperlocalActivation.interpretationImpact.novelty * 0.08
  );
  const anchorScore = clamp0119(
    destinationRead * 0.34 + experientialRichness * 0.28 + memorability * 0.22 + identitySignal * 0.16 + (momentIdentity.strength === "strong" ? 0.08 : 0)
  );
  const hospitalityOrCulturalPrimary = primaryArchetype === "dining" || primaryArchetype === "drinks" || primaryArchetype === "sweet" || primaryArchetype === "culture" || primaryArchetype === "social";
  const builderScore = clamp0119(
    destinationRead * 0.24 + experientialRichness * 0.28 + memorability * 0.2 + profile.lingerFactor * 0.1 + profile.intimacy * 0.08 + (hospitalityOrCulturalPrimary ? 0.08 : 0)
  );
  const destinationLikeCharacteristics = destinationKeyword >= 0.34 || identityKeyword >= 0.34 || venue.eventCapable || venue.performanceCapable || venue.musicCapable;
  const anchorTierQualified = (momentIdentity.type === "anchor" || momentIdentity.type === "explore") && momentIdentity.strength === "strong" && (momentIntensity.tier === "exceptional" || momentIntensity.tier === "signature") && anchorScore >= 0.66 && destinationLikeCharacteristics;
  if (anchorTierQualified) {
    return "anchor";
  }
  const builderTierQualified = builderScore >= 0.54 && momentPotential.score >= 0.46 && momentIntensity.score >= 0.54 && (momentIdentity.type === "anchor" || momentIdentity.type === "explore" || momentIdentity.type === "linger" || hospitalityOrCulturalPrimary);
  if (builderTierQualified) {
    return "builder";
  }
  return "support";
}
function deriveDurationEstimate(venue, profile) {
  if (venue.category === "event" || venue.category === "live_music") {
    return "event";
  }
  const keywords = buildKeywordCorpus(venue);
  const quickCue = keywordScore(keywords, QUICK_STOP_TERMS);
  const landingCue = keywordScore(keywords, LANDING_TERMS);
  const durationScore = profile.lingerFactor * 0.44 + profile.experientialFactor * 0.18 + profile.destinationFactor * 0.12 + (venue.category === "restaurant" ? 0.08 : 0) + (venue.category === "activity" || venue.category === "museum" ? 0.06 : 0) + (venue.category === "cafe" || venue.category === "dessert" ? -0.1 : 0) + landingCue * 0.12 - quickCue * 0.24;
  if (durationScore >= 0.76) {
    return "extended";
  }
  if (durationScore >= 0.5) {
    return "moderate";
  }
  return "quick";
}
function deriveVenuePersonality(venue, profile, roleSuitability, highlightTier, durationEstimate, momentIntensity, context) {
  const tags = [];
  const keywords = buildKeywordCorpus(venue);
  const hasKeyword = (terms, threshold = 0.28) => keywordScore(keywords, terms) >= threshold;
  const quickCue = keywordScore(keywords, QUICK_STOP_TERMS);
  const landingCue = keywordScore(keywords, LANDING_TERMS);
  const destinationCue = keywordScore(keywords, DESTINATION_TERMS);
  const centerpieceCue = keywordScore(keywords, CENTERPIECE_TERMS);
  const socialCue = keywordScore(keywords, SOCIAL_TERMS);
  const intimacyCue = keywordScore(keywords, INTIMACY_TERMS);
  const vibe = context?.vibe ?? void 0;
  const persona = context?.persona ?? void 0;
  const livelyLike = vibe === "lively" || vibe === "playful";
  const cozyLike = vibe === "cozy" || vibe === "chill";
  const socialThreshold = livelyLike ? 0.62 : cozyLike ? 0.72 : 0.68;
  const intimacyThreshold = livelyLike ? 0.66 : cozyLike ? 0.58 : 0.64;
  const intimate = profile.intimacy >= intimacyThreshold && profile.conversationFriendliness >= 0.6 && profile.socialDensity <= (livelyLike ? 0.7 : 0.68) || profile.intimacy >= 0.7 && profile.socialDensity <= 0.74 || hasKeyword(["intimate", "cozy", "candle", "romantic", "conversation"], 0.26) && socialCue <= (livelyLike ? 0.38 : 0.34);
  if (intimate) {
    tags.push("intimate");
  }
  const social = profile.socialDensity >= socialThreshold || profile.energy >= (livelyLike ? 0.64 : 0.7) && profile.socialDensity >= (livelyLike ? 0.54 : 0.58) || hasKeyword(["social", "cocktail", "lively", "buzzing", "group", "nightlife"], 0.3);
  if (social) {
    tags.push("social");
  }
  const destination = profile.destinationFactor >= 0.64 && profile.experientialFactor >= 0.56 && venue.signatureStrength >= 0.56 && quickCue <= 0.5 || highlightTier === 1 || momentIntensity.tier === "signature" && venue.signatureStrength >= 0.56 && quickCue <= 0.52 || hasKeyword(["destination", "signature", "chef", "notable", "must-visit"], 0.28) && roleSuitability.highlight >= 0.6 && quickCue <= 0.54;
  if (destination) {
    tags.push("destination");
  }
  const lingering = (profile.lingerFactor >= 0.62 || landingCue >= 0.4) && (durationEstimate === "moderate" || durationEstimate === "extended") || durationEstimate === "extended" && profile.conversationFriendliness >= 0.5 || hasKeyword(["lingering", "dessert", "wine", "tea", "patio", "courtyard"], 0.3) && quickCue < 0.58;
  if (lingering) {
    tags.push("lingering");
  }
  const quickStop = durationEstimate === "quick" && (quickCue >= 0.28 || roleSuitability.highlight <= 0.54) || quickCue >= 0.42 && destinationCue <= 0.36 && centerpieceCue <= 0.42 || hasKeyword(["quick", "grab", "counter", "walk-up", "to-go"], 0.34);
  if (quickStop) {
    tags.push("quick_stop");
  }
  const experiential = profile.experientialFactor >= 0.64 && (momentIntensity.score >= 0.64 || profile.destinationFactor >= 0.56) && quickCue <= 0.58 || momentIntensity.tier === "signature" || hasKeyword(["immersive", "tasting", "live", "performance", "curated", "interactive"], 0.3);
  if (experiential) {
    tags.push("experiential");
  }
  if (livelyLike && roleSuitability.highlight >= 0.64 && profile.energy >= 0.56) {
    if (!tags.includes("social")) {
      tags.push("social");
    }
    if (persona === "romantic" && profile.intimacy >= 0.54 && profile.conversationFriendliness >= 0.52 && !tags.includes("intimate")) {
      tags.push("intimate");
    }
  }
  if (cozyLike && roleSuitability.highlight >= 0.58) {
    if (!tags.includes("intimate") && profile.intimacy >= 0.56) {
      tags.push("intimate");
    }
    if (tags.includes("social") && !tags.includes("destination") && profile.socialDensity <= 0.7) {
      tags.splice(tags.indexOf("social"), 1);
    }
  }
  if (tags.includes("social") && tags.includes("intimate")) {
    const socialAdvantage = profile.socialDensity + socialCue - (profile.intimacy + intimacyCue);
    if (socialAdvantage >= 0.18) {
      tags.splice(tags.indexOf("intimate"), 1);
    } else if (socialAdvantage <= -0.2) {
      tags.splice(tags.indexOf("social"), 1);
    }
  }
  if (tags.includes("quick_stop") && tags.includes("destination")) {
    const strongDestinationOverride = highlightTier === 1 || venue.signatureStrength >= 0.76 && profile.destinationFactor >= 0.74 && roleSuitability.highlight >= 0.78;
    if (!strongDestinationOverride) {
      tags.splice(tags.indexOf("destination"), 1);
    }
  }
  if (tags.includes("quick_stop") && tags.includes("lingering") && landingCue < 0.44) {
    tags.splice(tags.indexOf("lingering"), 1);
  }
  return {
    tags: [...new Set(tags)]
  };
}
function deriveNoveltyWeight(venue, profile, momentPotential, momentEnrichment, hyperlocalActivation) {
  return clamp0119(
    venue.signatureStrength * 0.42 + profile.destinationFactor * 0.18 + profile.experientialFactor * 0.16 + momentPotential.score * 0.08 + Math.max(
      momentEnrichment.ambientUniqueness,
      momentEnrichment.culturalDepth
    ) * 0.08 + hyperlocalActivation.intensityContribution * 0.06 + hyperlocalActivation.interpretationImpact.novelty * 0.18 + venue.qualityScore * 0.08 + venue.sourceConfidence * 0.08 + (venue.liveSource ? 0.05 : 0) + (venue.tags.length > 3 || (venue.placeTypes?.length ?? 0) > 2 ? 0.03 : 0)
  );
}
function deriveTasteCalibration(venue, profile, noveltyWeight) {
  const keywords = buildKeywordCorpus(venue);
  const nightlifeStrength = keywordScore(keywords, NIGHTLIFE_SIGNATURE_TERMS);
  const signatureDiningStrength = keywordScore(keywords, DINING_SIGNATURE_TERMS);
  const localCharacterStrength = keywordScore(keywords, LOCAL_CHARACTER_TERMS);
  const genericPremiumStrength = keywordScore(keywords, GENERIC_PREMIUM_TERMS);
  const subcategorySpecificity = venue.subcategory && !isGenericSubcategory(venue.subcategory, venue.category) ? 1 : 0;
  const tagRichness = clamp0119(venue.tags.length / 5);
  const placeTypeRichness = clamp0119((venue.placeTypes?.length ?? 0) / 4);
  const categorySpecificity = clamp0119(
    subcategorySpecificity * 0.34 + tagRichness * 0.24 + placeTypeRichness * 0.12 + localCharacterStrength * 0.14 + signatureDiningStrength * 0.1 + nightlifeStrength * 0.06
  );
  const personalityStrength = clamp0119(
    categorySpecificity * 0.34 + venue.signatureStrength * 0.24 + noveltyWeight * 0.16 + localCharacterStrength * 0.14 + Math.max(signatureDiningStrength, nightlifeStrength) * 0.12 - Math.max(0, genericPremiumStrength - categorySpecificity) * 0.12
  );
  const hoursSupport = venue.hoursStatus === "open" || venue.hoursStatus === "likely_open" ? 0.16 : venue.hoursStatus === "closed" || venue.hoursStatus === "likely_closed" ? -0.2 : 0;
  const eveningCategoryBase = venue.category === "restaurant" || venue.category === "bar" || venue.category === "live_music" || venue.category === "event" ? 0.56 : venue.category === "activity" || venue.category === "museum" ? 0.44 : venue.category === "dessert" ? 0.38 : 0.24;
  const eveningFit = clamp0119(
    eveningCategoryBase + profile.energy * 0.12 + profile.lingerFactor * 0.12 + (venue.hoursConfidence ?? 0.5) * 0.08 + hoursSupport
  );
  const genericPremiumPenalty = clamp0119(
    genericPremiumStrength * 0.56 + (venue.priceLevel === "$$$" || venue.priceLevel === "$$$$" ? 0.12 : 0) - categorySpecificity * 0.24 - personalityStrength * 0.2 - localCharacterStrength * 0.12 - venue.signatureStrength * 0.12
  );
  return {
    categorySpecificity,
    personalityStrength,
    nightlifeStrength,
    signatureDiningStrength,
    eveningFit,
    genericPremiumPenalty
  };
}
function deriveAnchorStrength(venue, profile, highlightSuitability, calibration, experienceStrengths, momentPotential) {
  return clamp0119(
    highlightSuitability * 0.24 + profile.destinationFactor * 0.2 + profile.experientialFactor * 0.16 + momentPotential.score * 0.08 + Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.1 + venue.signatureStrength * 0.14 + calibration.categorySpecificity * 0.12 + calibration.personalityStrength * 0.1 + calibration.eveningFit * 0.06 + venue.qualityScore * 0.04 + venue.sourceConfidence * 0.04 - calibration.genericPremiumPenalty * 0.08
  );
}
function deriveExperienceStrengths(venue, keywordSignals) {
  const scenicPlaceType = hasAnyFragment(venue.placeTypes, [
    "garden",
    "lookout",
    "park",
    "pier",
    "plaza",
    "promenade",
    "trail",
    "view",
    "waterfront"
  ]);
  const interactivePlaceType = hasAnyFragment(venue.placeTypes, [
    "amusement",
    "arcade",
    "bowling",
    "escape",
    "gallery",
    "museum",
    "studio",
    "theater",
    "workshop"
  ]);
  const outdoor = (venue.category === "park" ? 0.74 : 0) + (venue.setting === "outdoor" ? 0.56 : venue.setting === "hybrid" ? 0.34 : 0.04) + keywordSignals.outdoorBump * 0.22 + keywordSignals.scenicBump * 0.28 + (scenicPlaceType ? 0.16 : 0) + (venue.highlightCapable ? 0.04 : 0) - keywordSignals.passiveHospitalityBump * 0.08;
  const interactive = (venue.category === "activity" ? 0.74 : venue.category === "event" || venue.category === "live_music" ? 0.48 : venue.category === "museum" ? 0.28 : 0.04) + keywordSignals.interactiveBump * 0.34 + keywordSignals.socialActivityBump * 0.2 + (interactivePlaceType ? 0.16 : 0) + (venue.eventCapable ? 0.08 : 0) + (venue.performanceCapable || venue.musicCapable ? 0.06 : 0) - keywordSignals.passiveHospitalityBump * 0.1;
  const passiveHospitality = (venue.category === "restaurant" || venue.category === "bar" || venue.category === "cafe" || venue.category === "dessert" ? 0.42 : 0.1) + keywordSignals.passiveHospitalityBump * 0.24 + (venue.setting === "indoor" ? 0.08 : 0) - outdoor * 0.1 - interactive * 0.12;
  return {
    outdoor: clamp0119(outdoor),
    interactive: clamp0119(interactive),
    passiveHospitality: clamp0119(passiveHospitality)
  };
}
function deriveExperienceArchetypes(venue, profile, experienceStrengths) {
  const keywords = buildKeywordCorpus(venue);
  const scores = {
    dining: (venue.category === "restaurant" ? 0.82 : 0) + keywordScore(keywords, DINING_SIGNATURE_TERMS) * 0.18 + profile.lingerFactor * 0.04,
    drinks: (venue.category === "bar" ? 0.84 : venue.category === "cafe" ? 0.58 : 0) + keywordScore(keywords, DRINKS_TERMS) * 0.22 + keywordScore(keywords, NIGHTLIFE_SIGNATURE_TERMS) * 0.1,
    sweet: (venue.category === "dessert" ? 0.88 : 0) + keywordScore(keywords, SWEET_TERMS) * 0.26 + (venue.category === "cafe" ? 0.08 : 0),
    outdoor: experienceStrengths.outdoor * 0.88 + (venue.category === "park" ? 0.18 : 0),
    activity: experienceStrengths.interactive * 0.82 + keywordScore(keywords, INTERACTIVE_TERMS) * 0.18 + keywordScore(keywords, SOCIAL_ACTIVITY_TERMS) * 0.12 + (venue.category === "activity" ? 0.16 : venue.category === "event" ? 0.08 : 0),
    culture: (venue.category === "museum" ? 0.82 : venue.category === "live_music" ? 0.72 : venue.category === "event" ? 0.42 : 0) + keywordScore(keywords, CULTURE_TERMS) * 0.26 + keywordScore(keywords, LOCAL_CHARACTER_TERMS) * 0.08,
    scenic: keywordScore(keywords, SCENIC_TERMS) * 0.62 + experienceStrengths.outdoor * 0.34 + (hasAnyFragment(venue.placeTypes, [
      "garden",
      "lookout",
      "promenade",
      "view",
      "waterfront"
    ]) ? 0.12 : 0),
    social: profile.socialDensity * 0.42 + keywordScore(keywords, SOCIAL_TERMS) * 0.26 + keywordScore(keywords, SOCIAL_ACTIVITY_TERMS) * 0.22 + experienceStrengths.interactive * 0.12 + (venue.eventCapable || venue.musicCapable || venue.performanceCapable ? 0.1 : 0)
  };
  const priority = [
    "scenic",
    "activity",
    "outdoor",
    "culture",
    "social",
    "dining",
    "drinks",
    "sweet"
  ];
  const archetypes = priority.filter((archetype) => scores[archetype] >= 0.42).sort(
    (left, right) => scores[right] - scores[left] || priority.indexOf(left) - priority.indexOf(right)
  ).slice(0, 3);
  if (archetypes.length === 0) {
    archetypes.push(
      venue.category === "restaurant" ? "dining" : venue.category === "bar" || venue.category === "cafe" ? "drinks" : venue.category === "dessert" ? "sweet" : venue.category === "park" ? "outdoor" : venue.category === "activity" ? "activity" : venue.category === "museum" || venue.category === "live_music" ? "culture" : "social"
    );
  }
  return {
    primary: archetypes[0],
    archetypes
  };
}
function deriveMomentPotential(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment, hyperlocalActivation) {
  const archetypes = new Set(experienceArchetypes.archetypes);
  const score = clamp0119(
    (archetypes.has("scenic") ? 0.28 : 0) + (archetypes.has("outdoor") ? 0.18 : 0) + (archetypes.has("activity") ? 0.24 : 0) + (archetypes.has("culture") ? 0.22 : 0) + (archetypes.has("social") ? 0.18 : 0) + profile.destinationFactor * 0.14 + profile.experientialFactor * 0.16 + venue.signatureStrength * 0.1 + venue.qualityScore * 0.06 + momentEnrichment.temporalEnergy * 0.08 + momentEnrichment.socialEnergy * 0.04 + momentEnrichment.ambientUniqueness * 0.08 + momentEnrichment.culturalDepth * 0.1 + hyperlocalActivation.intensityContribution * 0.08 + hyperlocalActivation.interpretationImpact.momentPotential * 0.18 + experienceStrengths.interactive * 0.24 + experienceStrengths.outdoor * 0.1 + (venue.eventCapable || venue.performanceCapable || venue.musicCapable ? 0.06 : 0) - experienceStrengths.passiveHospitality * 0.08
  );
  return {
    score,
    source: score >= 0.3 ? "inferred" : "none"
  };
}
function deriveExperienceFamily(venue, profile, experienceStrengths, experienceArchetypes, romanticSignals, momentIntensity, calibration, momentEnrichment, hyperlocalActivation) {
  const keywords = buildKeywordCorpus(venue);
  const archetypes = new Set(experienceArchetypes.archetypes);
  const familyRefinements = new Set(hyperlocalActivation.interpretationImpact.familyRefinements);
  const ambientKeyword = keywordScore(keywords, AMBIENT_TERMS);
  const interactiveKeyword = keywordScore(keywords, INTERACTIVE_TERMS);
  const cultureKeyword = keywordScore(keywords, CULTURE_TERMS);
  const culturalCue = keywords.includes("japanese") || keywords.includes("heritage") || keywords.includes("historic");
  const ambientCue = keywords.includes("greenhouse") || keywords.includes("reflective") || keywords.includes("atmosphere");
  const richnessSignal = clamp0119(
    profile.experientialFactor * 0.42 + calibration.categorySpecificity * 0.28 + calibration.personalityStrength * 0.3
  );
  const scenicSignal = clamp0119(
    romanticSignals.scenic * 0.42 + experienceStrengths.outdoor * 0.26 + (archetypes.has("scenic") ? 0.18 : 0) + (archetypes.has("outdoor") ? 0.1 : 0) + momentIntensity.score * 0.08
  );
  const quietSignal = clamp0119(
    profile.conversationFriendliness * 0.34 + profile.intimacy * 0.22 + (1 - profile.energy) * 0.18 + (1 - profile.socialDensity) * 0.14 + romanticSignals.intimacy * 0.12
  );
  const activitySignal = clamp0119(
    experienceStrengths.interactive * 0.42 + romanticSignals.sharedActivity * 0.18 + (archetypes.has("activity") ? 0.18 : 0) + (archetypes.has("social") ? 0.08 : 0) + (familyRefinements.has("quiet_activity") ? hyperlocalActivation.interpretationImpact.momentPotential * 0.18 : 0) + profile.experientialFactor * 0.1
  );
  const cultureSignal = clamp0119(
    (archetypes.has("culture") ? 0.34 : 0) + cultureKeyword * 0.24 + romanticSignals.ambientExperience * 0.12 + profile.destinationFactor * 0.12 + richnessSignal * 0.18 + (familyRefinements.has("cultural") ? hyperlocalActivation.interpretationImpact.momentIntensity * 0.2 : 0) + (venue.category === "museum" || venue.category === "live_music" || venue.category === "event" ? 0.12 : 0)
  );
  const ambientSignal = clamp0119(
    Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) * 0.34 + profile.intimacy * 0.12 + profile.destinationFactor * 0.1 + momentIntensity.score * 0.08 + momentEnrichment.ambientUniqueness * 0.18 + momentEnrichment.temporalEnergy * 0.06 + (familyRefinements.has("ambient_indoor") ? hyperlocalActivation.interpretationImpact.momentIntensity * 0.2 : 0) + richnessSignal * 0.18 + (venue.setting === "indoor" ? 0.12 : 0) + (venue.category === "bar" || venue.category === "live_music" || venue.category === "cafe" ? 0.08 : 0) + ambientKeyword * 0.18
  );
  const immersiveCultureSignal = clamp0119(
    cultureSignal * 0.44 + momentEnrichment.culturalDepth * 0.28 + momentEnrichment.ambientUniqueness * 0.12 + (familyRefinements.has("immersive_cultural") ? hyperlocalActivation.interpretationImpact.momentIntensity * 0.18 : 0) + richnessSignal * 0.12 + (venue.category === "museum" || venue.category === "live_music" || venue.category === "event" ? 0.08 : 0)
  );
  const diningSignal = clamp0119(
    (archetypes.has("dining") ? 0.28 : 0) + (archetypes.has("sweet") ? 0.08 : 0) + profile.lingerFactor * 0.14 + romanticSignals.intimacy * 0.16 + romanticSignals.ambiance * 0.1 + richnessSignal * 0.16 + (familyRefinements.has("intimate_dining") ? hyperlocalActivation.interpretationImpact.highlightSuitability * 0.22 : 0) + (venue.category === "restaurant" ? 0.14 : venue.category === "dessert" ? 0.08 : 0) + experienceStrengths.passiveHospitality * 0.1
  );
  const familyScores = [
    {
      family: "outdoor_scenic",
      score: clamp0119(scenicSignal * 0.66 + quietSignal * 0.12 + richnessSignal * 0.12)
    },
    {
      family: "quiet_activity",
      score: clamp0119(activitySignal * 0.5 + quietSignal * 0.22 + richnessSignal * 0.16)
    },
    {
      family: "cultural",
      score: clamp0119(cultureSignal * 0.62 + ambientSignal * 0.12 + richnessSignal * 0.16)
    },
    {
      family: "immersive_cultural",
      score: clamp0119(
        immersiveCultureSignal * 0.64 + ambientSignal * 0.1 + richnessSignal * 0.12
      )
    },
    {
      family: "ambient_indoor",
      score: clamp0119(ambientSignal * 0.58 + quietSignal * 0.14 + richnessSignal * 0.14)
    },
    {
      family: "intimate_dining",
      score: clamp0119(diningSignal * 0.62 + quietSignal * 0.14 + richnessSignal * 0.12)
    }
  ];
  const priority = [
    "outdoor_scenic",
    "quiet_activity",
    "immersive_cultural",
    "cultural",
    "ambient_indoor",
    "intimate_dining"
  ];
  const best = [...familyScores].sort((left, right) => {
    return right.score - left.score || priority.indexOf(left.family) - priority.indexOf(right.family);
  })[0];
  if (culturalCue && scenicSignal >= 0.54 && quietSignal >= 0.56) {
    return "cultural";
  }
  if (ambientCue && scenicSignal >= 0.54 && quietSignal >= 0.58) {
    return "ambient_indoor";
  }
  if (familyRefinements.has("immersive_cultural") && immersiveCultureSignal >= 0.46 && momentIntensity.score >= 0.66) {
    return "immersive_cultural";
  }
  if (familyRefinements.has("ambient_indoor") && ambientSignal >= 0.42 && momentIntensity.score >= 0.62 && venue.setting !== "outdoor") {
    return "ambient_indoor";
  }
  if (familyRefinements.has("intimate_dining") && diningSignal >= 0.48 && momentIntensity.score >= 0.6) {
    return "intimate_dining";
  }
  const quietActivityBridge = activitySignal >= 0.4 && quietSignal >= 0.58 && scenicSignal - activitySignal <= 0.2 && (interactiveKeyword >= 0.33 || archetypes.has("activity"));
  if (quietActivityBridge) {
    return "quiet_activity";
  }
  const enrichedAmbientBridge = ambientSignal >= 0.42 && momentEnrichment.ambientUniqueness >= 0.5 && momentIntensity.score >= 0.72 && calibration.personalityStrength >= 0.52 && (venue.category === "bar" || venue.category === "restaurant" || venue.category === "live_music" || venue.category === "museum");
  if (enrichedAmbientBridge) {
    return "ambient_indoor";
  }
  const enrichedCultureBridge = immersiveCultureSignal >= 0.48 && momentEnrichment.culturalDepth >= 0.46 && momentIntensity.score >= 0.72 && calibration.personalityStrength >= 0.5 && (venue.category === "museum" || venue.category === "live_music" || venue.category === "event" || cultureKeyword >= 0.33);
  if (enrichedCultureBridge) {
    return "immersive_cultural";
  }
  const culturalBridge = cultureSignal >= 0.34 && scenicSignal - cultureSignal <= 0.3 && (cultureKeyword >= 0.33 || culturalCue || romanticSignals.ambientExperience >= 0.34);
  if (culturalBridge) {
    if (immersiveCultureSignal >= 0.54 && momentEnrichment.culturalDepth >= 0.48) {
      return "immersive_cultural";
    }
    return "cultural";
  }
  const ambientBridge = ambientSignal >= 0.34 && quietSignal >= 0.58 && scenicSignal - ambientSignal <= 0.24 && (ambientKeyword >= 0.33 || ambientCue);
  if (ambientBridge) {
    return "ambient_indoor";
  }
  if (best && best.score >= 0.42) {
    return best.family;
  }
  if (archetypes.has("scenic") || archetypes.has("outdoor")) {
    return "outdoor_scenic";
  }
  if (archetypes.has("activity")) {
    return "quiet_activity";
  }
  if (archetypes.has("culture")) {
    return immersiveCultureSignal >= 0.54 ? "immersive_cultural" : "cultural";
  }
  if (archetypes.has("dining") || archetypes.has("sweet")) {
    return "intimate_dining";
  }
  return "ambient_indoor";
}
function deriveExpandedExperienceFamily(venue, profile, momentPotential, momentIntensity, momentEnrichment, hyperlocalActivation, baseFamily) {
  const activationType = hyperlocalActivation.primaryActivationType;
  if (!activationType || !hyperlocalActivation.materiallyChangesInterpretation || hyperlocalActivation.intensityContribution < 0.34 || momentIntensity.score < 0.72 || momentPotential.score < 0.58) {
    return { family: baseFamily, expanded: false };
  }
  const activationStrength = clamp0119(
    hyperlocalActivation.intensityContribution * 0.52 + hyperlocalActivation.interpretationImpact.highlightSuitability * 0.22 + hyperlocalActivation.interpretationImpact.momentIntensity * 0.18 + (hyperlocalActivation.temporalCompatibility.materiallyChangesViability ? 0.08 : 0)
  );
  if (activationStrength < 0.36) {
    return { family: baseFamily, expanded: false };
  }
  const expandedFamily = activationType === "tasting_activation" ? "tasting_experience" : activationType === "live_performance" ? "live_experience" : activationType === "cultural_activation" ? "immersive_experience" : activationType === "ambient_activation" ? "atmospheric_experience" : void 0;
  if (!expandedFamily) {
    return { family: baseFamily, expanded: false };
  }
  const distinctFromBase = expandedFamily === "tasting_experience" && baseFamily !== "intimate_dining" || expandedFamily === "live_experience" && baseFamily !== "immersive_cultural" && baseFamily !== "cultural" || expandedFamily === "immersive_experience" && baseFamily !== "immersive_cultural" && baseFamily !== "cultural" || expandedFamily === "atmospheric_experience" && baseFamily !== "ambient_indoor";
  if (!distinctFromBase) {
    return { family: baseFamily, expanded: false };
  }
  const plausible = expandedFamily === "tasting_experience" && momentEnrichment.ambientUniqueness >= 0.46 && profile.intimacy >= 0.42 && hyperlocalActivation.contractCompatibilityHints.includes("curated_highlight") || expandedFamily === "live_experience" && momentEnrichment.temporalEnergy >= 0.48 && momentEnrichment.culturalDepth >= 0.4 && !hyperlocalActivation.activationTypes.includes("social_ritual") || expandedFamily === "immersive_experience" && momentEnrichment.culturalDepth >= 0.52 && hyperlocalActivation.contractCompatibilityHints.includes("culture_highlight") || expandedFamily === "atmospheric_experience" && momentEnrichment.ambientUniqueness >= 0.54 && profile.socialDensity <= 0.66 && hyperlocalActivation.contractCompatibilityHints.includes("romantic_ambient");
  if (!plausible) {
    return { family: baseFamily, expanded: false };
  }
  const reason = expandedFamily === "tasting_experience" ? "strong tasting activation reshaped dining into a tasting experience" : expandedFamily === "live_experience" ? "strong live activation reshaped culture into a live experience" : expandedFamily === "immersive_experience" ? "strong cultural activation reshaped the venue into an immersive experience" : "strong ambient activation reshaped the venue into an atmospheric experience";
  return {
    family: expandedFamily,
    expanded: true,
    reason
  };
}
function applyExpandedFamilyRoleAdjustment(roleSuitability, experienceFamily, baseExperienceFamily, hyperlocalActivation) {
  if (experienceFamily === baseExperienceFamily) {
    return roleSuitability;
  }
  const adjusted = { ...roleSuitability };
  const activationScale = clamp0119(
    hyperlocalActivation.intensityContribution * 0.44 + hyperlocalActivation.interpretationImpact.highlightSuitability * 0.26 + (hyperlocalActivation.temporalCompatibility.materiallyChangesViability ? 0.12 : 0)
  );
  if (experienceFamily === "tasting_experience") {
    adjusted.highlight = clamp0119(adjusted.highlight + 0.026 * activationScale);
    adjusted.windDown = clamp0119(adjusted.windDown + 0.018 * activationScale);
  } else if (experienceFamily === "live_experience") {
    adjusted.highlight = clamp0119(adjusted.highlight + 0.028 * activationScale);
    adjusted.surprise = clamp0119(adjusted.surprise + 0.02 * activationScale);
  } else if (experienceFamily === "immersive_experience") {
    adjusted.highlight = clamp0119(adjusted.highlight + 0.024 * activationScale);
    adjusted.surprise = clamp0119(adjusted.surprise + 0.022 * activationScale);
  } else if (experienceFamily === "atmospheric_experience") {
    adjusted.highlight = clamp0119(adjusted.highlight + 0.022 * activationScale);
    adjusted.windDown = clamp0119(adjusted.windDown + 0.02 * activationScale);
  }
  return adjusted;
}
function deriveActivationMomentElevation(profile, momentPotential, momentIntensity, hyperlocalActivation, experienceFamily, familyExpanded) {
  const activationType = hyperlocalActivation.primaryActivationType;
  if (!activationType) {
    return {
      potential: 0,
      eligible: false,
      reason: "no hyperlocal activation"
    };
  }
  const hints = new Set(hyperlocalActivation.contractCompatibilityHints);
  const strongActivationEffect = hyperlocalActivation.interpretationImpact.highlightSuitability >= 0.05 || hyperlocalActivation.interpretationImpact.momentIntensity >= 0.05 || hyperlocalActivation.interpretationImpact.momentPotential >= 0.05;
  const contractPlausible = hints.has("romantic_ambient") || hints.has("culture_highlight") || hints.has("curated_highlight") || hints.has("cozy_anchor");
  const socialChaosBlocked = activationType === "social_ritual" && profile.socialDensity >= 0.82 && profile.intimacy < 0.5;
  const elevatedFamily = experienceFamily === "tasting_experience" || experienceFamily === "live_experience" || experienceFamily === "immersive_experience" || experienceFamily === "atmospheric_experience";
  const potential = clamp0119(
    hyperlocalActivation.intensityContribution * 0.34 + hyperlocalActivation.interpretationImpact.highlightSuitability * 0.2 + hyperlocalActivation.interpretationImpact.momentIntensity * 0.16 + hyperlocalActivation.interpretationImpact.momentPotential * 0.12 + momentIntensity.score * 0.14 + momentPotential.score * 0.08 + (familyExpanded && elevatedFamily ? 0.1 : 0) + (hyperlocalActivation.temporalCompatibility.materiallyChangesViability ? 0.05 : 0) - (socialChaosBlocked ? 0.14 : 0)
  );
  if (!hyperlocalActivation.materiallyChangesInterpretation) {
    return {
      potential,
      eligible: false,
      reason: "activation does not materially change interpretation"
    };
  }
  if (!hyperlocalActivation.materiallyChangesHighlightPotential) {
    return {
      potential,
      eligible: false,
      reason: "activation does not materially change highlight potential"
    };
  }
  if (!strongActivationEffect || hyperlocalActivation.intensityContribution < 0.34) {
    return {
      potential,
      eligible: false,
      reason: "activation impact too weak"
    };
  }
  if (momentIntensity.score < 0.76 || momentPotential.score < 0.58) {
    return {
      potential,
      eligible: false,
      reason: "base moment not strong enough"
    };
  }
  if (!contractPlausible || socialChaosBlocked) {
    return {
      potential,
      eligible: false,
      reason: socialChaosBlocked ? "social activation too chaotic for elevation" : "contract compatibility not plausible"
    };
  }
  if (potential < 0.46) {
    return {
      potential,
      eligible: false,
      reason: "elevation potential below threshold"
    };
  }
  return {
    potential,
    eligible: true,
    reason: activationType.replace(/_/g, " ") + " reads as a true moment candidate"
  };
}
function deriveMomentIdentity(venue, profile, momentPotential, experienceArchetypes) {
  const archetype = experienceArchetypes.primary;
  const archetypes = new Set(experienceArchetypes.archetypes);
  const strongThreshold = archetype === "scenic" || archetype === "activity" || archetype === "culture" || archetype === "outdoor" ? 0.62 : archetype === "social" ? 0.66 : 0.72;
  const mediumThreshold = archetype === "dining" || archetype === "drinks" || archetype === "sweet" ? 0.42 : 0.38;
  const strength = momentPotential.score >= strongThreshold ? "strong" : momentPotential.score >= mediumThreshold ? "medium" : "light";
  if (strength === "strong" && (archetypes.has("activity") || archetypes.has("culture") || archetypes.has("social") || (archetype === "dining" || archetype === "drinks" || archetype === "sweet") && (profile.destinationFactor >= 0.72 || profile.experientialFactor >= 0.74))) {
    return { type: "anchor", strength };
  }
  if (archetype === "scenic" || archetype === "outdoor") {
    if (archetype === "scenic") {
      if (strength === "strong") {
        return { type: "anchor", strength };
      }
      if (profile.energy <= 0.34 && (profile.intimacy >= 0.64 || profile.lingerFactor >= 0.62) && momentPotential.score < 0.58) {
        return { type: "close", strength };
      }
      if (profile.energy <= 0.42 && strength === "light") {
        return { type: "arrival", strength };
      }
      return { type: "explore", strength };
    }
    if (strength === "strong" && profile.destinationFactor >= 0.82 && profile.experientialFactor >= 0.72) {
      return { type: "anchor", strength };
    }
    if (profile.energy <= 0.34 && (profile.intimacy >= 0.64 || profile.lingerFactor >= 0.62) && profile.destinationFactor < 0.68) {
      return {
        type: "close",
        strength: strength === "strong" ? "medium" : strength
      };
    }
    if (profile.energy <= 0.42 && strength === "light") {
      return { type: "arrival", strength };
    }
    return { type: "explore", strength };
  }
  if (archetype === "activity" || archetype === "culture") {
    return { type: strength === "strong" ? "anchor" : "explore", strength };
  }
  if (archetype === "social") {
    return {
      type: strength === "strong" ? "anchor" : profile.socialDensity >= 0.62 ? "transition" : "explore",
      strength
    };
  }
  if (archetype === "sweet") {
    return {
      type: profile.energy <= 0.44 || profile.intimacy >= 0.58 ? "close" : "linger",
      strength
    };
  }
  if (archetype === "dining") {
    return {
      type: strength === "strong" ? "anchor" : profile.lingerFactor >= 0.6 || profile.intimacy >= 0.52 ? "linger" : "transition",
      strength
    };
  }
  if (archetype === "drinks") {
    if (venue.category === "cafe") {
      return {
        type: profile.energy <= 0.36 ? "arrival" : profile.lingerFactor >= 0.52 ? "linger" : "transition",
        strength
      };
    }
    return {
      type: profile.energy <= 0.46 ? "linger" : "transition",
      strength
    };
  }
  if (profile.energy <= 0.38) {
    return { type: "close", strength };
  }
  if (profile.lingerFactor >= 0.6) {
    return { type: "linger", strength };
  }
  return { type: "transition", strength };
}
function deriveRomanticSignals(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment) {
  const keywords = buildKeywordCorpus(venue);
  const archetypes = new Set(experienceArchetypes.archetypes);
  const intimacyKeyword = keywordScore(keywords, INTIMACY_TERMS);
  const ambianceKeyword = keywordScore(keywords, AMBIENT_TERMS);
  const scenicKeyword = keywordScore(keywords, SCENIC_TERMS);
  const sharedKeyword = keywordScore(keywords, SHARED_ACTIVITY_TERMS);
  const scenicPlaceType = hasAnyFragment(venue.placeTypes, [
    "garden",
    "lookout",
    "park",
    "promenade",
    "trail",
    "view",
    "viewpoint",
    "waterfront"
  ]);
  const walkingPlaceType = hasAnyFragment(venue.placeTypes, [
    "garden",
    "park",
    "promenade",
    "trail",
    "walk",
    "waterfront"
  ]);
  const interactivePlaceType = hasAnyFragment(venue.placeTypes, [
    "arcade",
    "gallery",
    "museum",
    "studio",
    "workshop"
  ]);
  const intimateCategoryBoost = venue.category === "cafe" ? 0.16 : venue.category === "dessert" ? 0.12 : venue.category === "bar" ? 0.08 : 0;
  const ambianceCategoryBoost = venue.category === "bar" ? 0.18 : venue.category === "live_music" ? 0.16 : venue.category === "cafe" ? 0.08 : venue.category === "restaurant" ? 0.06 : 0;
  const intimacy = clamp0119(
    profile.intimacy * 0.44 + profile.conversationFriendliness * 0.16 + intimacyKeyword * 0.24 + ambianceKeyword * 0.08 + momentEnrichment.ambientUniqueness * 0.04 + intimateCategoryBoost + (archetypes.has("scenic") ? 0.05 : 0) - profile.socialDensity * 0.1 - profile.energy * 0.08
  );
  const ambiance = clamp0119(
    ambianceKeyword * 0.34 + profile.destinationFactor * 0.14 + profile.experientialFactor * 0.12 + venue.signatureStrength * 0.1 + venue.qualityScore * 0.06 + momentEnrichment.ambientUniqueness * 0.14 + momentEnrichment.culturalDepth * 0.06 + ambianceCategoryBoost + (venue.musicCapable || venue.performanceCapable ? 0.1 : 0) + (archetypes.has("social") ? 0.04 : 0)
  );
  const scenic = clamp0119(
    experienceStrengths.outdoor * 0.34 + scenicKeyword * 0.3 + (archetypes.has("scenic") ? 0.22 : 0) + (archetypes.has("outdoor") ? 0.12 : 0) + (venue.category === "park" ? 0.18 : 0) + (scenicPlaceType ? 0.14 : 0)
  );
  const sharedActivity = clamp0119(
    experienceStrengths.interactive * 0.34 + sharedKeyword * 0.28 + (archetypes.has("activity") ? 0.18 : 0) + (archetypes.has("culture") ? 0.08 : 0) + (interactivePlaceType ? 0.12 : 0) + (walkingPlaceType ? 0.1 : 0) + (venue.category === "activity" ? 0.14 : venue.category === "museum" ? 0.08 : 0)
  );
  const ambientExperience = clamp0119(
    ambianceKeyword * 0.2 + keywordScore(keywords, CULTURE_TERMS) * 0.12 + momentEnrichment.ambientUniqueness * 0.16 + momentEnrichment.culturalDepth * 0.16 + momentEnrichment.temporalEnergy * 0.04 + (venue.category === "live_music" ? 0.28 : venue.category === "event" ? 0.12 : 0) + (venue.musicCapable ? 0.18 : 0) + (venue.performanceCapable ? 0.12 : 0) + (archetypes.has("culture") ? 0.08 : 0) + (archetypes.has("social") ? 0.04 : 0) + profile.experientialFactor * 0.08
  );
  return {
    intimacy,
    ambiance,
    scenic,
    sharedActivity,
    ambientExperience
  };
}
function deriveRomanticScore(romanticSignals) {
  return clamp0119(
    romanticSignals.intimacy * 0.25 + romanticSignals.ambiance * 0.2 + romanticSignals.scenic * 0.2 + romanticSignals.sharedActivity * 0.2 + romanticSignals.ambientExperience * 0.15
  );
}
function deriveHyperlocalActivation(venue, profile, experienceArchetypes, context) {
  const keywords = buildKeywordCorpus(venue);
  const archetypes = new Set(experienceArchetypes.archetypes);
  const livePerformance = clamp0119(
    keywordScore(keywords, LIVE_PERFORMANCE_ACTIVATION_TERMS) * 0.54 + (venue.category === "live_music" ? 0.24 : 0) + (venue.musicCapable ? 0.12 : 0) + (venue.performanceCapable ? 0.1 : 0) + (venue.liveSource ? 0.06 : 0)
  );
  const socialRitual = clamp0119(
    keywordScore(keywords, SOCIAL_RITUAL_ACTIVATION_TERMS) * 0.5 + keywordScore(keywords, RECURRING_EVENT_TERMS) * 0.18 + (venue.category === "bar" || venue.category === "activity" ? 0.08 : 0) + (venue.eventCapable ? 0.08 : 0)
  );
  const tastingActivation = clamp0119(
    keywordScore(keywords, TASTING_ACTIVATION_TERMS) * 0.58 + (venue.category === "restaurant" || venue.category === "bar" ? 0.08 : 0) + venue.signatureStrength * 0.08
  );
  const culturalActivation = clamp0119(
    keywordScore(keywords, CULTURAL_ACTIVATION_TERMS) * 0.54 + keywordScore(keywords, CULTURE_TERMS) * 0.14 + (venue.category === "museum" ? 0.18 : venue.category === "event" ? 0.1 : 0) + (venue.performanceCapable ? 0.08 : 0) + (archetypes.has("culture") ? 0.08 : 0)
  );
  const seasonalMarket = clamp0119(
    keywordScore(keywords, SEASONAL_MARKET_ACTIVATION_TERMS) * 0.6 + (venue.category === "event" ? 0.16 : 0) + (venue.eventCapable ? 0.08 : 0)
  );
  const ambientActivation = clamp0119(
    keywordScore(keywords, AMBIENT_ACTIVATION_TERMS) * 0.5 + keywordScore(keywords, AMBIENT_TERMS) * 0.12 + (venue.setting === "indoor" || venue.setting === "hybrid" ? 0.08 : 0) + (venue.category === "bar" || venue.category === "live_music" ? 0.08 : 0) + venue.signatureStrength * 0.06
  );
  const activationScoresBase = [
    {
      type: "live_performance",
      score: livePerformance,
      signal: "live performance"
    },
    {
      type: "social_ritual",
      score: socialRitual,
      signal: "social ritual"
    },
    {
      type: "tasting_activation",
      score: tastingActivation,
      signal: "tasting activation"
    },
    {
      type: "cultural_activation",
      score: culturalActivation,
      signal: "cultural activation"
    },
    {
      type: "seasonal_market",
      score: seasonalMarket,
      signal: "seasonal market"
    },
    {
      type: "ambient_activation",
      score: ambientActivation,
      signal: "ambient activation"
    }
  ];
  const activationScores = activationScoresBase.sort((left, right) => right.score - left.score);
  const strongest = activationScores[0];
  const activationTypes = strongest ? activationScores.filter(
    (entry) => entry.score >= 0.42 || strongest.score >= 0.48 && strongest.score - entry.score <= 0.08 && entry.score >= 0.34
  ).map((entry) => entry.type) : [];
  const primaryActivationType = activationTypes[0];
  const temporalRelevance = clamp0119(
    (strongest?.score ?? 0) * 0.34 + keywordScore(keywords, PROGRAMMED_ACTIVATION_TERMS) * 0.18 + keywordScore(keywords, RECURRING_EVENT_TERMS) * 0.16 + keywordScore(keywords, SEASONAL_MARKET_ACTIVATION_TERMS) * 0.12 + (venue.liveSource ? 0.08 : 0) + (venue.hoursStatus === "open" || venue.hoursStatus === "likely_open" ? 0.04 : 0)
  );
  const temporalLabel = temporalRelevance >= 0.68 ? "active" : temporalRelevance >= 0.36 ? "timely" : "background";
  const recurrenceShape = seasonalMarket >= 0.46 ? "seasonal" : socialRitual >= 0.44 || keywordScore(keywords, RECURRING_EVENT_TERMS) >= 0.34 ? "recurring" : livePerformance >= 0.46 || tastingActivation >= 0.46 || culturalActivation >= 0.46 || keywordScore(keywords, PROGRAMMED_ACTIVATION_TERMS) >= 0.34 ? "programmed" : ambientActivation >= 0.46 ? "ambient" : void 0;
  const recurrenceBoost = recurrenceShape === "programmed" ? 0.08 : recurrenceShape === "recurring" ? 0.07 : recurrenceShape === "seasonal" ? 0.08 : recurrenceShape === "ambient" ? 0.05 : 0;
  const intensityContribution = activationTypes.length === 0 ? 0 : clamp0119(
    (strongest?.score ?? 0) * 0.4 + temporalRelevance * 0.22 + recurrenceBoost + profile.destinationFactor * 0.08 + profile.experientialFactor * 0.08 + (venue.qualityScore >= 0.78 ? 0.04 : 0)
  );
  let highlightSuitabilityImpact = 0;
  let momentPotentialImpact = 0;
  let noveltyImpact = 0;
  let momentIntensityImpact = 0;
  const familyRefinements = [];
  const addFamilyRefinement = (value) => {
    if (!familyRefinements.includes(value)) {
      familyRefinements.push(value);
    }
  };
  for (const activationType of activationTypes) {
    if (activationType === "live_performance") {
      highlightSuitabilityImpact += intensityContribution * 0.09;
      momentPotentialImpact += intensityContribution * 0.08;
      noveltyImpact += intensityContribution * 0.05;
      momentIntensityImpact += intensityContribution * 0.1;
      addFamilyRefinement("immersive_cultural");
      addFamilyRefinement("ambient_indoor");
    }
    if (activationType === "tasting_activation") {
      highlightSuitabilityImpact += intensityContribution * 0.08;
      momentPotentialImpact += intensityContribution * 0.06;
      noveltyImpact += intensityContribution * 0.06;
      momentIntensityImpact += intensityContribution * 0.08;
      addFamilyRefinement("intimate_dining");
      addFamilyRefinement("ambient_indoor");
    }
    if (activationType === "cultural_activation") {
      highlightSuitabilityImpact += intensityContribution * 0.08;
      momentPotentialImpact += intensityContribution * 0.08;
      noveltyImpact += intensityContribution * 0.07;
      momentIntensityImpact += intensityContribution * 0.09;
      addFamilyRefinement("immersive_cultural");
      addFamilyRefinement("cultural");
    }
    if (activationType === "social_ritual") {
      highlightSuitabilityImpact += intensityContribution * 0.04;
      momentPotentialImpact += intensityContribution * 0.05;
      noveltyImpact += intensityContribution * 0.05;
      momentIntensityImpact += intensityContribution * 0.04;
      addFamilyRefinement("quiet_activity");
    }
    if (activationType === "ambient_activation") {
      highlightSuitabilityImpact += intensityContribution * 0.08;
      momentPotentialImpact += intensityContribution * 0.05;
      noveltyImpact += intensityContribution * 0.04;
      momentIntensityImpact += intensityContribution * 0.08;
      addFamilyRefinement("ambient_indoor");
    }
    if (activationType === "seasonal_market") {
      highlightSuitabilityImpact += intensityContribution * 0.06;
      momentPotentialImpact += intensityContribution * 0.08;
      noveltyImpact += intensityContribution * 0.08;
      momentIntensityImpact += intensityContribution * 0.05;
      addFamilyRefinement("quiet_activity");
      addFamilyRefinement("cultural");
    }
  }
  const contractCompatibilityHints = [];
  if (activationTypes.includes("live_performance") || activationTypes.includes("ambient_activation") || activationTypes.includes("cultural_activation")) {
    contractCompatibilityHints.push("romantic_ambient");
  }
  if (activationTypes.includes("cultural_activation") || activationTypes.includes("live_performance")) {
    contractCompatibilityHints.push("culture_highlight");
  }
  if (activationTypes.includes("tasting_activation")) {
    contractCompatibilityHints.push("curated_highlight");
  }
  if (activationTypes.includes("social_ritual") || activationTypes.includes("seasonal_market")) {
    contractCompatibilityHints.push("social_highlight");
  }
  if (activationTypes.includes("ambient_activation") || activationTypes.includes("tasting_activation") && profile.energy <= 0.58) {
    contractCompatibilityHints.push("cozy_anchor");
  }
  const signals = activationScores.filter((entry) => activationTypes.includes(entry.type)).map((entry) => entry.signal);
  if (recurrenceShape) {
    signals.push(`${recurrenceShape} cadence`);
  }
  if (temporalLabel !== "background" && activationTypes.length > 0) {
    signals.push(`${temporalLabel} relevance`);
  }
  const temporalCompatibility = deriveHyperlocalTemporalCompatibility(
    venue,
    keywords,
    activationTypes,
    temporalRelevance,
    temporalLabel,
    intensityContribution,
    context
  );
  return {
    activationTypes,
    primaryActivationType,
    temporalRelevance,
    temporalLabel,
    recurrenceShape,
    intensityContribution,
    contractCompatibilityHints,
    interpretationImpact: {
      highlightSuitability: clamp0119(highlightSuitabilityImpact),
      momentPotential: clamp0119(momentPotentialImpact),
      novelty: clamp0119(noveltyImpact),
      momentIntensity: clamp0119(momentIntensityImpact),
      familyRefinements
    },
    temporalCompatibility,
    signals: [...new Set(signals)],
    materiallyChangesHighlightPotential: activationTypes.length > 0 && intensityContribution >= 0.26,
    materiallyChangesInterpretation: activationTypes.length > 0 && (highlightSuitabilityImpact >= 0.04 || momentIntensityImpact >= 0.04 || familyRefinements.length > 0)
  };
}
function deriveHyperlocalTemporalCompatibility(venue, keywords, activationTypes, temporalRelevance, temporalLabel, intensityContribution, context) {
  const contextWindow = parseTemporalWindow(context?.timeWindow);
  const dayCueScore = clamp0119(
    keywordScore(keywords, DAY_WINDOW_TERMS) * 0.56 + keywordScore(keywords, SEASONAL_MARKET_ACTIVATION_TERMS) * 0.22 + (activationTypes.includes("seasonal_market") ? 0.26 : 0) + (venue.category === "cafe" ? 0.08 : 0)
  );
  const eveningCueScore = clamp0119(
    keywordScore(keywords, EVENING_WINDOW_TERMS) * 0.44 + keywordScore(keywords, TEMPORAL_ENERGY_TERMS) * 0.18 + (activationTypes.includes("live_performance") ? 0.22 : 0) + (activationTypes.includes("tasting_activation") ? 0.16 : 0) + (activationTypes.includes("cultural_activation") ? 0.12 : 0) + (activationTypes.includes("ambient_activation") ? 0.1 : 0)
  );
  const lateCueScore = clamp0119(
    keywordScore(keywords, LATE_WINDOW_TERMS) * 0.52 + keywordScore(keywords, HIGH_ENERGY_TERMS) * 0.12 + (activationTypes.includes("live_performance") ? 0.12 : 0) + (activationTypes.includes("social_ritual") ? 0.08 : 0) + (venue.category === "bar" || venue.category === "live_music" ? 0.08 : 0)
  );
  let activationWindow;
  if (lateCueScore >= 0.3 && lateCueScore > eveningCueScore + 0.04) {
    activationWindow = "late";
  } else if (dayCueScore >= 0.32 && dayCueScore > eveningCueScore + 0.05) {
    activationWindow = "day";
  } else if (eveningCueScore >= 0.24) {
    activationWindow = "evening";
  } else if (activationTypes.includes("ambient_activation")) {
    activationWindow = "flexible";
  } else if (activationTypes.includes("seasonal_market")) {
    activationWindow = "day";
  } else if (activationTypes.includes("live_performance") || activationTypes.includes("tasting_activation") || activationTypes.includes("cultural_activation") || activationTypes.includes("social_ritual")) {
    activationWindow = temporalRelevance >= 0.34 ? "evening" : void 0;
  }
  const timePresenceState = contextWindow ? "explicit" : activationTypes.length > 0 && (Boolean(activationWindow) || temporalLabel !== "background" || temporalRelevance >= 0.28) ? "implicit" : "none";
  const roleAdjustments = createZeroRoleAdjustments();
  const signals = [];
  const activationScale = clamp0119(
    intensityContribution * 0.54 + temporalRelevance * 0.28 + (temporalLabel === "active" ? 0.18 : temporalLabel === "timely" ? 0.1 : 0)
  );
  for (const activationType of activationTypes) {
    if (activationType === "live_performance") {
      roleAdjustments.highlight += 0.055 * activationScale;
      roleAdjustments.surprise += 0.035 * activationScale;
      roleAdjustments.windDown += 0.015 * activationScale;
      signals.push("performance favors highlight");
      continue;
    }
    if (activationType === "tasting_activation") {
      roleAdjustments.highlight += 0.048 * activationScale;
      roleAdjustments.surprise += 0.022 * activationScale;
      roleAdjustments.windDown += 0.018 * activationScale;
      signals.push("tasting favors highlight");
      continue;
    }
    if (activationType === "cultural_activation") {
      roleAdjustments.highlight += 0.042 * activationScale;
      roleAdjustments.surprise += 0.028 * activationScale;
      roleAdjustments.start += 0.012 * activationScale;
      signals.push("cultural activation favors highlight");
      continue;
    }
    if (activationType === "social_ritual") {
      roleAdjustments.surprise += 0.03 * activationScale;
      roleAdjustments.highlight += 0.02 * activationScale;
      signals.push("social ritual favors surprise");
      continue;
    }
    if (activationType === "ambient_activation") {
      roleAdjustments.highlight += 0.03 * activationScale;
      roleAdjustments.windDown += 0.032 * activationScale;
      roleAdjustments.surprise += 0.01 * activationScale;
      signals.push("ambient activation favors wind down");
      continue;
    }
    if (activationType === "seasonal_market") {
      roleAdjustments.start += 0.04 * activationScale;
      roleAdjustments.surprise += 0.028 * activationScale;
      roleAdjustments.highlight += 0.018 * activationScale;
      signals.push("seasonal market favors start");
    }
  }
  if (contextWindow && activationWindow && activationWindow !== "flexible") {
    if (contextWindow === activationWindow) {
      roleAdjustments.highlight += 0.018;
      roleAdjustments.surprise += 8e-3;
      signals.push(`${contextWindow} context aligns`);
    } else if (contextWindow === "day" && activationWindow === "evening") {
      roleAdjustments.highlight -= 0.024;
      roleAdjustments.windDown -= 0.01;
      signals.push("day context softens evening fit");
    } else if (contextWindow === "day" && activationWindow === "late") {
      roleAdjustments.highlight -= 0.03;
      roleAdjustments.windDown -= 0.016;
      signals.push("day context softens late fit");
    } else if (contextWindow === "evening" && activationWindow === "day") {
      roleAdjustments.start -= 0.01;
      roleAdjustments.highlight -= 0.018;
      signals.push("evening context softens day fit");
    } else if (contextWindow === "late" && activationWindow === "day") {
      roleAdjustments.highlight -= 0.026;
      roleAdjustments.start -= 0.014;
      signals.push("late context softens day fit");
    } else if (contextWindow === "late" && activationWindow === "evening") {
      roleAdjustments.highlight -= 8e-3;
      roleAdjustments.windDown += 6e-3;
      signals.push("late context leans wind down");
    }
  } else if (activationWindow === "flexible") {
    roleAdjustments.highlight += 8e-3;
    roleAdjustments.windDown += 8e-3;
    signals.push("flexible activation window");
  } else if (activationWindow) {
    signals.push(`implicit ${activationWindow} fit`);
  }
  const materiallyChangesViability = activationTypes.length > 0 && Object.values(roleAdjustments).some((value) => Math.abs(value) >= 0.02);
  return {
    timePresenceState,
    contextWindow,
    activationWindow,
    roleAdjustments,
    materiallyChangesViability,
    signals: [...new Set(signals)]
  };
}
function deriveMomentEnrichment(venue, profile, experienceStrengths, experienceArchetypes, hyperlocalActivation) {
  const keywords = buildKeywordCorpus(venue);
  const archetypes = new Set(experienceArchetypes.archetypes);
  const temporalKeyword = clamp0119(
    keywordScore(keywords, TEMPORAL_ENERGY_TERMS) * 0.72 + keywordScore(keywords, RECURRING_EVENT_TERMS) * 0.28
  );
  const socialKeyword = clamp0119(
    keywordScore(keywords, SOCIAL_ENERGY_TERMS) * 0.7 + keywordScore(keywords, GROUP_SIGNAL_TERMS) * 0.3
  );
  const ambientKeyword = keywordScore(keywords, AMBIENT_UNIQUENESS_TERMS);
  const culturalKeyword = keywordScore(keywords, CULTURAL_DEPTH_TERMS);
  const hyperlocalTemporalLift = hyperlocalActivation.temporalRelevance * 0.12;
  const hyperlocalAmbientLift = hyperlocalActivation.activationTypes.includes("ambient_activation") || hyperlocalActivation.activationTypes.includes("live_performance") ? hyperlocalActivation.intensityContribution * 0.12 : 0;
  const hyperlocalCulturalLift = hyperlocalActivation.activationTypes.includes("cultural_activation") || hyperlocalActivation.activationTypes.includes("live_performance") || hyperlocalActivation.activationTypes.includes("seasonal_market") ? hyperlocalActivation.intensityContribution * 0.12 : 0;
  const temporalEnergy = clamp0119(
    temporalKeyword * 0.46 + (venue.category === "live_music" || venue.category === "event" ? 0.24 : 0) + (venue.musicCapable || venue.performanceCapable ? 0.12 : 0) + (venue.liveSource ? 0.06 : 0) + profile.energy * 0.08 + hyperlocalTemporalLift + (venue.hoursStatus === "open" || venue.hoursStatus === "likely_open" ? 0.04 : 0)
  );
  const socialEnergy = clamp0119(
    socialKeyword * 0.42 + profile.socialDensity * 0.18 + normalizeCount(venue.reviewCount, 240) * 0.14 + (venue.category === "bar" || venue.category === "activity" ? 0.08 : 0) + (venue.category === "live_music" || venue.category === "event" ? 0.12 : 0) + (venue.eventCapable ? 0.08 : 0)
  );
  const ambientUniqueness = clamp0119(
    ambientKeyword * 0.42 + profile.intimacy * 0.08 + venue.signatureStrength * 0.14 + venue.qualityScore * 0.08 + hyperlocalAmbientLift + (venue.setting === "indoor" || venue.setting === "hybrid" ? 0.08 : 0) + (venue.editorialSummary ? 0.06 : 0) + ((venue.userReviewSnippets?.length ?? 0) > 0 ? 0.04 : 0)
  );
  const culturalDepth = clamp0119(
    culturalKeyword * 0.42 + (archetypes.has("culture") ? 0.18 : 0) + (venue.category === "museum" || venue.category === "live_music" || venue.category === "event" ? 0.12 : 0) + (venue.musicCapable || venue.performanceCapable ? 0.08 : 0) + (venue.eventCapable ? 0.06 : 0) + venue.qualityScore * 0.08 + hyperlocalCulturalLift + profile.experientialFactor * 0.06
  );
  const highlightSurfaceBoost = clamp0119(
    temporalEnergy * 0.18 + socialEnergy * 0.08 + ambientUniqueness * 0.18 + culturalDepth * 0.2 + hyperlocalActivation.intensityContribution * 0.14 + profile.experientialFactor * 0.1 + venue.signatureStrength * 0.1 + venue.qualityScore * 0.08 - experienceStrengths.passiveHospitality * 0.08
  );
  const signals = [];
  if (temporalEnergy >= 0.42) {
    signals.push("temporal energy");
  }
  if (socialEnergy >= 0.42) {
    signals.push("social energy");
  }
  if (ambientUniqueness >= 0.42) {
    signals.push("ambient uniqueness");
  }
  if (culturalDepth >= 0.42) {
    signals.push("cultural depth");
  }
  if (hyperlocalActivation.materiallyChangesHighlightPotential) {
    signals.push("hyperlocal activation");
  }
  return {
    temporalEnergy,
    socialEnergy,
    ambientUniqueness,
    culturalDepth,
    highlightSurfaceBoost,
    signals
  };
}
function deriveRomanticFlavor(romanticSignals, romanticScore) {
  const rankedSignals = [
    { key: "intimate", value: romanticSignals.intimacy },
    { key: "scenic", value: romanticSignals.scenic },
    { key: "playful", value: romanticSignals.sharedActivity },
    {
      key: "ambient",
      value: Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience)
    }
  ].sort((left, right) => right.value - left.value);
  const strongest = rankedSignals[0];
  const runnerUp = rankedSignals[1];
  if (!strongest || romanticScore < 0.28 || strongest.value < 0.34) {
    return "none";
  }
  if (runnerUp && strongest.value - runnerUp.value <= 0.06 && runnerUp.value >= 0.5) {
    return "mixed";
  }
  return strongest.key;
}
function deriveRomanticMomentCandidate(venue, romanticSignals, romanticScore, momentIdentity, experienceArchetypes, momentEnrichment) {
  const primaryArchetype = experienceArchetypes.primary;
  const hospitalityPrimary = primaryArchetype === "dining" || primaryArchetype === "drinks" || primaryArchetype === "sweet";
  const atmosphericDiningSignal = hospitalityPrimary && romanticSignals.intimacy >= 0.6 && Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) >= 0.56 && (momentEnrichment.ambientUniqueness >= 0.52 || momentEnrichment.culturalDepth >= 0.46);
  const viewBackedDiningSignal = hospitalityPrimary && romanticSignals.scenic >= 0.48 && romanticSignals.intimacy >= 0.56 && romanticSignals.ambientExperience >= 0.52;
  const strongRomanticDimension = romanticSignals.sharedActivity >= 0.48 || romanticSignals.scenic >= 0.48 || romanticSignals.ambientExperience >= 0.46 || romanticSignals.intimacy >= 0.68 || romanticSignals.ambiance >= 0.62 || atmosphericDiningSignal || viewBackedDiningSignal;
  const cozyScenicSupport = romanticSignals.sharedActivity >= 0.56 || romanticSignals.scenic >= 0.56 || romanticSignals.ambientExperience >= 0.52;
  const destinationCenterpieceSignal = momentIdentity.type === "anchor" || momentIdentity.strength === "strong" || venue.signatureStrength >= 0.7 || momentEnrichment.culturalDepth >= 0.56;
  const lingerCenterpieceSignal = momentIdentity.type === "linger" || momentIdentity.type === "close" || romanticSignals.intimacy >= 0.62 && romanticSignals.ambientExperience >= 0.52;
  const hiddenGemCenterpieceSignal = venue.signatureStrength >= 0.68 && venue.qualityScore >= 0.68;
  const diningCenterpieceSignal = hospitalityPrimary && (destinationCenterpieceSignal || lingerCenterpieceSignal || hiddenGemCenterpieceSignal);
  const genericHospitalityOnlyFallback = hospitalityPrimary && romanticSignals.sharedActivity < 0.56 && romanticSignals.scenic < 0.56 && romanticSignals.ambientExperience < 0.52 && romanticSignals.ambiance < 0.62 && romanticSignals.intimacy < 0.72 && momentEnrichment.ambientUniqueness < 0.52 && momentEnrichment.culturalDepth < 0.48 && venue.signatureStrength < 0.66;
  const hospitalityDateWorthy = !hospitalityPrimary || atmosphericDiningSignal || viewBackedDiningSignal || romanticSignals.intimacy >= 0.66 || romanticSignals.ambiance >= 0.64 || momentEnrichment.ambientUniqueness >= 0.54;
  const standardPath = romanticScore >= STANDARD_ROMANTIC_THRESHOLD && strongRomanticDimension && hospitalityDateWorthy && (!hospitalityPrimary || diningCenterpieceSignal) && !genericHospitalityOnlyFallback;
  const scenicSharedCozyPath = romanticScore >= COZY_SCENIC_ROMANTIC_THRESHOLD && cozyScenicSupport && momentIdentity.strength !== "light" && !genericHospitalityOnlyFallback;
  const enrichedAmbientPath = romanticScore >= COZY_SCENIC_ROMANTIC_THRESHOLD && momentIdentity.strength !== "light" && !genericHospitalityOnlyFallback && venue.signatureStrength >= 0.68 && Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) >= 0.46 && (momentEnrichment.ambientUniqueness >= 0.5 || momentEnrichment.culturalDepth >= 0.5);
  return standardPath || scenicSharedCozyPath || enrichedAmbientPath;
}
function deriveDebugConfidence(venue, sourceMode) {
  const modeBase = sourceMode === "seed_calibrated" ? 0.82 : sourceMode === "hybrid" ? 0.76 : 0.58;
  const reviewSignal = normalizeCount(venue.reviewCount, 200);
  const metadataRichness = (venue.editorialSummary ? 0.08 : 0) + ((venue.userReviewSnippets?.length ?? 0) > 0 ? 0.06 : 0) + (venue.subcategory ? 0.03 : 0) + (venue.neighborhood ? 0.03 : 0);
  return clamp0119(
    modeBase * 0.5 + venue.sourceConfidence * 0.18 + venue.qualityScore * 0.16 + (venue.hoursConfidence ?? 0.5) * 0.08 + reviewSignal * 0.05 + metadataRichness
  );
}
function resolveSourceMode(seed, inferred) {
  if (seed && hasMeaningfulDelta(seed, inferred)) {
    return "hybrid";
  }
  if (seed) {
    return "seed_calibrated";
  }
  return "rule_inferred";
}
function hasMeaningfulDelta(seed, inferred) {
  return Math.abs(seed.energy - inferred.energy) >= 0.05 || Math.abs(seed.socialDensity - inferred.socialDensity) >= 0.05 || Math.abs(seed.intimacy - inferred.intimacy) >= 0.05 || Math.abs(seed.lingerFactor - inferred.lingerFactor) >= 0.05 || Math.abs(seed.destinationFactor - inferred.destinationFactor) >= 0.05 || Math.abs(seed.experientialFactor - inferred.experientialFactor) >= 0.05 || Math.abs(
    seed.conversationFriendliness - inferred.conversationFriendliness
  ) >= 0.05;
}
function isGenericSubcategory(subcategory, category) {
  const normalized = subcategory.trim().toLowerCase();
  return normalized.length <= 3 || normalized === category || normalized === category.replace("_", " ") || normalized === "food" || normalized === "drink" || normalized === "place";
}
function buildKeywordCorpus(venue) {
  const textBlocks = [
    venue.name,
    venue.subcategory,
    venue.editorialSummary,
    venue.tags.join(" "),
    venue.placeTypes?.join(" "),
    venue.userReviewSnippets?.join(" ")
  ];
  return textBlocks.filter((value) => Boolean(value)).join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
function hasAnyFragment(values, fragments) {
  if (!values || values.length === 0) {
    return false;
  }
  return fragments.some(
    (fragment) => values.some((value) => value.toLowerCase().includes(fragment))
  );
}
function keywordScore(keywords, terms) {
  const corpus = ` ${keywords.join(" ")} `;
  let hits = 0;
  for (const term of terms) {
    if (corpus.includes(` ${term.toLowerCase()} `)) {
      hits += 1;
    }
  }
  return Math.min(1, hits / 3);
}
function normalizeCount(value, ceiling) {
  if (!value || value <= 0) {
    return 0;
  }
  return clamp0119(value / ceiling);
}
function clampProfile(profile) {
  return {
    energy: clamp0119(profile.energy),
    socialDensity: clamp0119(profile.socialDensity),
    intimacy: clamp0119(profile.intimacy),
    lingerFactor: clamp0119(profile.lingerFactor),
    destinationFactor: clamp0119(profile.destinationFactor),
    experientialFactor: clamp0119(profile.experientialFactor),
    conversationFriendliness: clamp0119(profile.conversationFriendliness)
  };
}
function finalizeSupportingSignals(supportingSignals, sourceMode, momentIntensity, experienceFamily, momentEnrichment, hyperlocalActivation, elevatedMomentCandidate) {
  const finalized = [...supportingSignals];
  if (sourceMode === "seed_calibrated") {
    finalized.splice(1, 0, "source:seed-profile");
  }
  if (sourceMode === "hybrid") {
    finalized.splice(1, 0, "source:hybrid-merge");
  }
  if (momentIntensity) {
    finalized.push(`signal:moment-${momentIntensity.tier}`);
  }
  if (experienceFamily) {
    finalized.push(`signal:family-${experienceFamily}`);
  }
  if (momentEnrichment) {
    for (const signal of momentEnrichment.signals) {
      finalized.push(`signal:${signal.replace(/\s+/g, "-")}`);
    }
  }
  if (hyperlocalActivation?.primaryActivationType) {
    finalized.push(
      `signal:activation-${hyperlocalActivation.primaryActivationType.replace(/_/g, "-")}`
    );
  }
  if (elevatedMomentCandidate) {
    finalized.push("signal:activation-moment-elevated");
  }
  return [...new Set(finalized)].slice(0, 8);
}
function pushSupportingSignal(supportingSignals, signal) {
  if (!supportingSignals.includes(signal)) {
    supportingSignals.push(signal);
  }
}
function clamp0119(value) {
  return Math.max(0, Math.min(1, value));
}

// src/domain/taste/getHighlightVibeWeight.ts
function getHighlightVibeWeight(intent, starterPack) {
  let weight = 0.28;
  if (intent.crew === "romantic") {
    weight += 0.05;
  }
  if (intent.primaryAnchor === "cozy" || intent.primaryAnchor === "cultured" || intent.primaryAnchor === "adventurous-outdoor" || intent.primaryAnchor === "adventurous-urban") {
    weight += 0.07;
  }
  if (intent.primaryAnchor === "lively" || intent.primaryAnchor === "playful") {
    weight += 0.05;
  }
  if (intent.primaryAnchor === "chill") {
    weight += 0.04;
  }
  if (starterPack?.roleContracts?.highlight || starterPack?.lensPreset?.preferredStopShapes?.highlight) {
    weight += 0.05;
  }
  return weight;
}

// src/domain/taste/computeVibeAuthority.ts
function clamp0120(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeTag5(tag) {
  return tag.trim().toLowerCase();
}
function tagOverlapScore3(venueTags, targetTags) {
  if (targetTags.length === 0) {
    return 0;
  }
  const normalizedVenueTags = new Set(venueTags.map(normalizeTag5));
  const matches = targetTags.filter((tag) => normalizedVenueTags.has(normalizeTag5(tag))).length;
  return matches / targetTags.length;
}
function scoreRoleProfileFit(venue, role, vibe) {
  const shape = getRoleShapeForVibe(vibe, role);
  const categoryFit = shape.preferredCategories.includes(venue.category) ? 1 : 0.38;
  const categoryPenalty = shape.discouragedCategories.includes(venue.category) ? 0.28 : 0;
  const tagFit = tagOverlapScore3(venue.tags, shape.preferredTags);
  const discouragedTags = tagOverlapScore3(venue.tags, shape.discouragedTags);
  const energyBand = venue.energyLevel <= 2 ? "low" : venue.energyLevel <= 3 ? "medium" : "high";
  const energyFit = shape.energyPreference.includes(energyBand) ? 1 : 0.42;
  const generalVibeFit = scoreVibeTagAffinity(venue, vibe);
  return clamp0120(
    categoryFit * 0.3 + tagFit * 0.18 + energyFit * 0.18 + generalVibeFit * 0.34 - categoryPenalty - discouragedTags * 0.18
  );
}
function scorePackHighlightPressure(venue, starterPack) {
  if (!starterPack) {
    return 0;
  }
  const preferredCategories = starterPack.lensPreset?.preferredStopShapes?.highlight?.preferredCategories ?? [];
  const preferredTags = starterPack.lensPreset?.preferredStopShapes?.highlight?.preferredTags ?? [];
  const contract = starterPack.roleContracts?.highlight;
  const contractCategoryMatch = contract?.requiredCategories?.includes(venue.category) || contract?.preferredCategories?.includes(venue.category) ? 1 : 0;
  const presetCategoryMatch = preferredCategories.includes(venue.category) ? 1 : 0;
  const tagFit = tagOverlapScore3(venue.tags, [
    ...preferredTags,
    ...contract?.requiredTags ?? [],
    ...contract?.preferredTags ?? []
  ]);
  return clamp0120(
    contractCategoryMatch * 0.46 + presetCategoryMatch * 0.3 + tagFit * 0.24
  );
}
function getHighlightPressureSource(vibeScore, packPressure) {
  if (vibeScore >= 0.66 && packPressure >= 0.56) {
    return "both";
  }
  if (vibeScore >= 0.66) {
    return "vibe";
  }
  if (packPressure >= 0.56) {
    return "pack";
  }
  return "neutral";
}
function isMusicForwardVenue(venue) {
  const normalizedTags3 = new Set(venue.tags.map(normalizeTag5));
  return venue.category === "live_music" || venue.category === "event" || normalizedTags3.has("listening") || normalizedTags3.has("live") || normalizedTags3.has("jazz") || normalizedTags3.has("performance") || normalizedTags3.has("local-artists");
}
function computeAdventureRead(venue) {
  const normalizedTags3 = new Set(venue.tags.map(normalizeTag5));
  const notes = [];
  const outdoorTagMatches = [
    "trail",
    "viewpoint",
    "nature",
    "scenic",
    "fresh-air",
    "garden",
    "stargazing",
    "walkable",
    "open-air"
  ].filter((tag) => normalizedTags3.has(tag)).length;
  const urbanTagMatches = [
    "district",
    "street-food",
    "community",
    "local",
    "underexposed",
    "market",
    "food-hall",
    "live-popups",
    "neighborhood",
    "street-art"
  ].filter((tag) => normalizedTags3.has(tag)).length;
  const outdoor = (venue.category === "park" ? 0.46 : venue.category === "activity" ? 0.18 : 0) + outdoorTagMatches * 0.12 + (normalizedTags3.has("outdoor-seating") ? 0.08 : 0);
  const urban = (venue.category === "bar" || venue.category === "restaurant" || venue.category === "event" || venue.category === "live_music" ? 0.32 : venue.category === "cafe" || venue.category === "dessert" ? 0.16 : 0) + urbanTagMatches * 0.1;
  if (outdoorTagMatches > 0 || venue.category === "park") {
    notes.push("outdoor signal from category/tags");
  }
  if (urbanTagMatches > 0 || ["bar", "restaurant", "event", "live_music"].includes(venue.category)) {
    notes.push("urban signal from category/tags");
  }
  if (outdoor === 0 && urban === 0) {
    return {
      read: "not-applicable",
      outdoor: 0,
      urban: 0,
      notes
    };
  }
  if (outdoor >= urban + 0.16) {
    return {
      read: "outdoor",
      outdoor: clamp0120(outdoor),
      urban: clamp0120(urban),
      notes
    };
  }
  if (urban >= outdoor + 0.16) {
    return {
      read: "urban",
      outdoor: clamp0120(outdoor),
      urban: clamp0120(urban),
      notes
    };
  }
  return {
    read: "balanced",
    outdoor: clamp0120(outdoor),
    urban: clamp0120(urban),
    notes
  };
}
function getMusicSupportSource(venue, intent, packPressure) {
  if (!isMusicForwardVenue(venue)) {
    return "not-applicable";
  }
  const profile = getVibeProfile(intent.primaryAnchor);
  const vibeSupportsMusic = profile.highlight.preferredCategories.includes("live_music") || profile.highlight.preferredCategories.includes("event") || profile.highlight.preferredTags.some(
    (tag) => ["live", "listening", "performance"].includes(normalizeTag5(tag))
  );
  if (vibeSupportsMusic && packPressure >= 0.56) {
    return "both";
  }
  if (vibeSupportsMusic) {
    return "vibe";
  }
  if (packPressure >= 0.56) {
    return "pack";
  }
  return "neither";
}
function computeVibeAuthority(venue, intent, lens, starterPack) {
  const primary = scoreVibeTagAffinity(venue, intent.primaryAnchor);
  const secondaryValues = (intent.secondaryAnchors ?? []).map(
    (anchor) => scoreVibeTagAffinity(venue, anchor)
  );
  const secondary = secondaryValues.length > 0 ? secondaryValues.reduce((sum, value) => sum + value, 0) / secondaryValues.length : 0;
  const adventureRead = computeAdventureRead(venue);
  const adventureSplitLift = intent.primaryAnchor === "adventurous-outdoor" ? clamp0120(adventureRead.outdoor) * 0.22 - clamp0120(adventureRead.urban) * 0.18 : intent.primaryAnchor === "adventurous-urban" ? clamp0120(adventureRead.urban) * 0.22 - clamp0120(adventureRead.outdoor) * 0.18 : 0;
  const byRole = {
    start: clamp0120(
      scoreRoleProfileFit(venue, "start", intent.primaryAnchor) * 0.78 + secondary * 0.12 + adventureSplitLift * 0.65 + (lens.preferredStopShapes.start.preferredCategories.includes(venue.category) ? 0.1 : 0)
    ),
    highlight: clamp0120(
      scoreRoleProfileFit(venue, "highlight", intent.primaryAnchor) * (1 + getHighlightVibeWeight(intent, starterPack)) + secondary * 0.18 + adventureSplitLift
    ),
    surprise: clamp0120(
      scoreRoleProfileFit(venue, "surprise", intent.primaryAnchor) * 0.74 + secondary * 0.18 + adventureSplitLift * 0.5 + (lens.discoveryBias === "high" ? venue.underexposureScore * 0.08 : 0)
    ),
    windDown: clamp0120(
      scoreRoleProfileFit(venue, "windDown", intent.primaryAnchor) * 0.84 + secondary * 0.14 + adventureSplitLift * 0.56
    )
  };
  const overall = clamp0120(
    primary * 0.66 + secondary * 0.18 + byRole.highlight * 0.1 + byRole.windDown * 0.06 + adventureSplitLift * 0.12
  );
  const packHighlightPressure = scorePackHighlightPressure(venue, starterPack);
  return {
    primary,
    secondary,
    overall,
    packPressure: {
      highlight: packHighlightPressure
    },
    byRole,
    pressureSource: {
      highlight: getHighlightPressureSource(byRole.highlight, packHighlightPressure)
    },
    musicSupportSource: getMusicSupportSource(venue, intent, packHighlightPressure),
    adventureRead: adventureRead.read,
    adventureReadScores: {
      outdoor: adventureRead.outdoor,
      urban: adventureRead.urban
    },
    adventureNotes: adventureRead.notes
  };
}

// src/domain/candidates/candidateIdentity.ts
function getScoredVenueBaseVenueId(candidate) {
  return candidate.candidateIdentity.baseVenueId;
}

// src/domain/taste/experienceSignals.ts
var HOSPITALITY_ARCHETYPES = /* @__PURE__ */ new Set([
  "dining",
  "drinks",
  "sweet"
]);
function clamp0121(value) {
  return Math.max(0, Math.min(1, value));
}
function getMomentIntensityTierBoost(value) {
  const tier = typeof value === "string" ? value : value.tier;
  if (tier === "signature") {
    return 0.16;
  }
  if (tier === "exceptional") {
    return 0.1;
  }
  if (tier === "strong") {
    return 0.05;
  }
  return 0;
}
function getHighlightArchetypeLift(signals, tasteModeId) {
  const primary = signals.primaryExperienceArchetype;
  const includes = (value) => signals.experienceArchetypes.includes(value);
  let lift = primary === "scenic" ? 0.13 : primary === "outdoor" ? 0.11 : primary === "activity" ? 0.12 : primary === "culture" ? 0.1 : primary === "social" ? 0.07 : primary === "drinks" ? 0.045 : primary === "sweet" ? 0.03 : 0.02;
  if (includes("scenic") && includes("outdoor")) {
    lift += 0.03;
  }
  if (includes("activity") && includes("social")) {
    lift += 0.02;
  }
  if (signals.momentPotential.score >= 0.72) {
    lift += 0.03;
  } else if (signals.momentPotential.score >= 0.52) {
    lift += 0.015;
  }
  if (tasteModeId === "scenic-outdoor" && (includes("scenic") || includes("outdoor"))) {
    lift += 0.04;
  }
  if (tasteModeId === "activity-led" && (includes("activity") || includes("social"))) {
    lift += 0.04;
  }
  if (tasteModeId === "highlight-centered" && includes("culture")) {
    lift += 0.02;
  }
  return clamp0121(lift);
}
function getGenericHospitalityFallbackPenalty(params) {
  if (params.protectedCandidate) {
    return 0;
  }
  const categoryWeight = params.venueCategory === "cafe" ? 1 : params.venueCategory === "dessert" ? 0.94 : params.venueCategory === "restaurant" ? 0.76 : params.venueCategory === "bar" ? 0.6 : 0;
  if (categoryWeight === 0) {
    return 0;
  }
  const archetypePenalty = HOSPITALITY_ARCHETYPES.has(
    params.signals.primaryExperienceArchetype
  ) ? 1 : 0.7;
  const lowMomentRead = (1 - params.signals.momentIntensity.score) * 0.32 + (1 - params.signals.momentPotential.score) * 0.24;
  const lowRichness = (1 - params.signals.experientialFactor) * 0.24 + (1 - params.uniquenessScore) * 0.12 + (1 - params.distinctivenessScore) * 0.1;
  const genericRead = (1 - params.signals.categorySpecificity) * 0.18 + (1 - params.signals.personalityStrength) * 0.14 + params.signatureGenericScore * 0.12;
  const modePressure = params.tasteModeId === "scenic-outdoor" || params.tasteModeId === "activity-led" ? 0.03 : params.tasteModeId === "cozy-flow" && params.venueCategory !== "cafe" ? -8e-3 : 0;
  return clamp0121(
    (lowMomentRead + lowRichness + genericRead) * categoryWeight * archetypePenalty * 0.18 + modePressure
  );
}
function isGenericHospitalityFallbackCandidate(candidate) {
  const archetype = candidate.taste.signals.primaryExperienceArchetype;
  const genericCategory = candidate.venue.category === "cafe" || candidate.venue.category === "dessert" || candidate.venue.category === "restaurant" || candidate.venue.category === "bar";
  const passiveArchetype = HOSPITALITY_ARCHETYPES.has(archetype);
  const weakMomentRead = candidate.taste.signals.momentIntensity.score < 0.78 && candidate.taste.signals.momentPotential.score < 0.72 && candidate.momentIdentity.strength !== "strong";
  const lowSignalRead = candidate.taste.fallbackPenalty.signalScore >= 0.1;
  const contractCritical = candidate.roleContract.peak.satisfied && (candidate.roleContract.peak.strength === "strong" || candidate.roleContract.peak.strength === "hard");
  return genericCategory && passiveArchetype && weakMomentRead && lowSignalRead && !contractCritical;
}
function computeHighlightAlternativeStrength(candidate) {
  return candidate.roleScores.peak * 0.34 + candidate.taste.signals.momentIntensity.score * 0.22 + candidate.taste.signals.momentPotential.score * 0.16 + candidate.taste.signals.experientialFactor * 0.14 + candidate.venue.distinctivenessScore * 0.08 + candidate.venue.uniquenessScore * 0.06 + candidate.stopShapeFit.highlight * 0.08 + (isGenericHospitalityFallbackCandidate(candidate) ? -0.06 : 0.04);
}
function assessGenericHospitalityFallbackPenalty(candidate, candidates) {
  const signalScore = candidate.taste.fallbackPenalty.signalScore;
  if (!isGenericHospitalityFallbackCandidate(candidate) || signalScore <= 0) {
    return {
      appliedPenalty: 0,
      strongerAlternativePresent: false,
      reason: "candidate not eligible for fallback suppression"
    };
  }
  const strongestAlternative = [...candidates].filter((alternative) => {
    if (getScoredVenueBaseVenueId(alternative) === getScoredVenueBaseVenueId(candidate)) {
      return false;
    }
    if (alternative.highlightValidity.validityLevel === "invalid") {
      return false;
    }
    if (alternative.roleScores.peak < 0.56 || alternative.stopShapeFit.highlight < 0.32) {
      return false;
    }
    return !isGenericHospitalityFallbackCandidate(alternative);
  }).sort((left, right) => {
    return computeHighlightAlternativeStrength(right) - computeHighlightAlternativeStrength(left) || right.roleScores.peak - left.roleScores.peak || right.fitScore - left.fitScore;
  })[0];
  if (!strongestAlternative) {
    return {
      appliedPenalty: 0,
      strongerAlternativePresent: false,
      reason: "no stronger non-fallback highlight available"
    };
  }
  const strengthGap = computeHighlightAlternativeStrength(strongestAlternative) - computeHighlightAlternativeStrength(candidate);
  if (strengthGap <= 0.045) {
    return {
      appliedPenalty: 0,
      strongerAlternativePresent: false,
      strongerAlternativeName: strongestAlternative.venue.name,
      reason: "fallback remains competitive in this pool"
    };
  }
  return {
    appliedPenalty: clamp0121(
      signalScore * (0.52 + Math.min(0.42, strengthGap * 0.9) + (strongestAlternative.taste.signals.momentIntensity.score >= 0.72 ? 0.1 : 0))
    ),
    strongerAlternativePresent: true,
    strongerAlternativeName: strongestAlternative.venue.name,
    reason: `stronger highlight available: ${strongestAlternative.venue.name}`
  };
}

// src/data/moments.ts
var curatedMoments = [
  {
    id: "sofa-jazz-alley-set",
    title: "SoFA alley jazz set",
    parentPlaceId: "sj-theatre-district-jazz-cellar",
    momentType: "live_performance",
    timeWindow: "evening",
    energy: 0.72,
    romanticPotential: 0.84,
    uniquenessScore: 0.78,
    sourceType: "curated",
    district: "SoFA District"
  },
  {
    id: "riverwalk-indie-showcase",
    title: "Riverwalk indie showcase",
    parentPlaceId: "sj-downtown-listening-room",
    momentType: "live_performance",
    timeWindow: "late",
    energy: 0.82,
    romanticPotential: 0.55,
    uniquenessScore: 0.81,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "san-pedro-brass-pop-in",
    title: "San Pedro brass pop-in",
    parentPlaceId: "sj-san-pedro-beer-garden",
    momentType: "live_performance",
    timeWindow: "evening",
    energy: 0.86,
    romanticPotential: 0.42,
    uniquenessScore: 0.73,
    sourceType: "curated",
    district: "San Pedro"
  },
  {
    id: "rooftop-golden-hour-toast",
    title: "Rooftop golden-hour toast",
    parentPlaceId: "sj-santana-rooftop-lounge",
    momentType: "social_ritual",
    timeWindow: "evening",
    energy: 0.64,
    romanticPotential: 0.88,
    uniquenessScore: 0.76,
    sourceType: "curated",
    district: "Santana Row"
  },
  {
    id: "japantown-open-table-hour",
    title: "Japantown open table hour",
    parentPlaceId: "sj-japantown-makers-market",
    momentType: "social_ritual",
    timeWindow: "day",
    energy: 0.58,
    romanticPotential: 0.44,
    uniquenessScore: 0.79,
    sourceType: "curated",
    district: "Japantown"
  },
  {
    id: "guildhouse-team-challenge-window",
    title: "Guildhouse team challenge window",
    parentPlaceId: "sj-guildhouse",
    momentType: "social_ritual",
    timeWindow: "evening",
    energy: 0.83,
    romanticPotential: 0.36,
    uniquenessScore: 0.7,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "boardgame-drop-in-session",
    title: "Boardgame drop-in session",
    parentPlaceId: "sj-riverwalk-boardgame-cafe",
    momentType: "social_ritual",
    timeWindow: "evening",
    energy: 0.67,
    romanticPotential: 0.5,
    uniquenessScore: 0.72,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "story-road-scoop-walk",
    title: "Story Road scoop walk",
    parentPlaceId: "sj-story-road-ice-cream-social",
    momentType: "social_ritual",
    timeWindow: "late",
    energy: 0.61,
    romanticPotential: 0.52,
    uniquenessScore: 0.68,
    sourceType: "inferred",
    district: "East San Jose"
  },
  {
    id: "adega-regional-flight-window",
    title: "Adega regional flight window",
    parentPlaceId: "sj-adega-wine-atelier",
    momentType: "tasting",
    timeWindow: "evening",
    energy: 0.46,
    romanticPotential: 0.9,
    uniquenessScore: 0.86,
    sourceType: "curated",
    district: "Little Portugal"
  },
  {
    id: "orchard-gelato-flight",
    title: "Orchard gelato flight",
    parentPlaceId: "sj-orchard-artisan-gelato",
    momentType: "tasting",
    timeWindow: "evening",
    energy: 0.42,
    romanticPotential: 0.72,
    uniquenessScore: 0.74,
    sourceType: "curated",
    district: "Santana Row"
  },
  {
    id: "heritage-tea-pairing",
    title: "Heritage tea pairing",
    parentPlaceId: "sj-heritage-tea-house",
    momentType: "tasting",
    timeWindow: "day",
    energy: 0.34,
    romanticPotential: 0.78,
    uniquenessScore: 0.77,
    sourceType: "curated",
    district: "Japantown"
  },
  {
    id: "chef-counter-sketchbook-drop",
    title: "Chef counter sketchbook drop",
    parentPlaceId: "sj-sketchbook-supper-club",
    momentType: "tasting",
    timeWindow: "late",
    energy: 0.63,
    romanticPotential: 0.71,
    uniquenessScore: 0.84,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "pastry-bench-pairing",
    title: "Pastry bench pairing",
    parentPlaceId: "sj-peters-bakery",
    momentType: "tasting",
    timeWindow: "day",
    energy: 0.32,
    romanticPotential: 0.41,
    uniquenessScore: 0.66,
    sourceType: "inferred",
    district: "Willow Glen"
  },
  {
    id: "sofa-gallery-microcrawl",
    title: "SoFA gallery microcrawl",
    parentPlaceId: "sj-sofa-indie-gallery-crawl",
    momentType: "cultural_activation",
    timeWindow: "evening",
    energy: 0.59,
    romanticPotential: 0.67,
    uniquenessScore: 0.82,
    sourceType: "curated",
    district: "SoFA District"
  },
  {
    id: "tech-after-dark-demo-sprint",
    title: "Tech after-dark demo sprint",
    parentPlaceId: "sj-tech-interactive",
    momentType: "cultural_activation",
    timeWindow: "evening",
    energy: 0.69,
    romanticPotential: 0.38,
    uniquenessScore: 0.76,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "rosicrucian-twilight-walk",
    title: "Rosicrucian twilight walk",
    parentPlaceId: "sj-rosicrucian",
    momentType: "cultural_activation",
    timeWindow: "evening",
    energy: 0.37,
    romanticPotential: 0.8,
    uniquenessScore: 0.8,
    sourceType: "curated",
    district: "Rose Garden"
  },
  {
    id: "camera-obscura-blue-hour-loop",
    title: "Camera obscura blue-hour loop",
    parentPlaceId: "sj-camera-obscura-photo-walk",
    momentType: "cultural_activation",
    timeWindow: "day",
    energy: 0.5,
    romanticPotential: 0.69,
    uniquenessScore: 0.81,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "downtown-street-market-run",
    title: "Downtown street market run",
    parentPlaceId: "sj-sofa-street-market",
    momentType: "seasonal_activation",
    timeWindow: "evening",
    energy: 0.74,
    romanticPotential: 0.52,
    uniquenessScore: 0.75,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "farmers-lane-small-batch-window",
    title: "Farmers lane small-batch window",
    parentPlaceId: "sj-farmers-lane-food-hall",
    momentType: "seasonal_activation",
    timeWindow: "day",
    energy: 0.57,
    romanticPotential: 0.47,
    uniquenessScore: 0.71,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "willow-glen-tea-ceremony-window",
    title: "Willow Glen tea ceremony window",
    parentPlaceId: "sj-willow-glen-tea-atelier",
    momentType: "seasonal_activation",
    timeWindow: "evening",
    energy: 0.4,
    romanticPotential: 0.83,
    uniquenessScore: 0.79,
    sourceType: "curated",
    district: "Willow Glen"
  },
  {
    id: "little-portugal-pastry-night",
    title: "Little Portugal pastry night",
    parentPlaceId: "sj-little-portugal-pastry-bar",
    momentType: "seasonal_activation",
    timeWindow: "late",
    energy: 0.56,
    romanticPotential: 0.63,
    uniquenessScore: 0.72,
    sourceType: "inferred",
    district: "Little Portugal"
  },
  {
    id: "rose-garden-sunset-promenade",
    title: "Rose Garden sunset promenade",
    parentPlaceId: "sj-municipal-rose-garden-promenade",
    momentType: "scenic_moment",
    timeWindow: "evening",
    energy: 0.29,
    romanticPotential: 0.9,
    uniquenessScore: 0.73,
    sourceType: "curated",
    district: "Rose Garden"
  },
  {
    id: "alum-rock-overlook-pause",
    title: "Alum Rock overlook pause",
    parentPlaceId: "sj-alum-rock-loop",
    momentType: "scenic_moment",
    timeWindow: "day",
    energy: 0.48,
    romanticPotential: 0.64,
    uniquenessScore: 0.76,
    sourceType: "curated",
    district: "East Foothills"
  },
  {
    id: "friendship-garden-lantern-stroll",
    title: "Friendship Garden lantern stroll",
    parentPlaceId: "sj-japanese-friendship-garden",
    momentType: "scenic_moment",
    timeWindow: "evening",
    energy: 0.33,
    romanticPotential: 0.88,
    uniquenessScore: 0.78,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "downtown-open-streets-dusk",
    title: "Downtown open streets dusk",
    momentType: "seasonal_activation",
    timeWindow: "evening",
    energy: 0.71,
    romanticPotential: 0.49,
    uniquenessScore: 0.74,
    sourceType: "curated",
    district: "Downtown"
  },
  {
    id: "sofa-projection-wall-shorts",
    title: "SoFA projection wall shorts",
    momentType: "cultural_activation",
    timeWindow: "late",
    energy: 0.65,
    romanticPotential: 0.57,
    uniquenessScore: 0.83,
    sourceType: "curated",
    district: "SoFA District"
  }
];

// src/domain/moments/deriveMomentVenues.ts
var MOMENT_TYPE_BASE_CATEGORY = {
  live_performance: "live_music",
  social_ritual: "activity",
  tasting: "restaurant",
  cultural_activation: "museum",
  seasonal_activation: "event",
  scenic_moment: "park"
};
var MOMENT_TYPE_ROLE_AFFINITY = {
  live_performance: { warmup: 0.34, peak: 0.92, wildcard: 0.86, cooldown: 0.28 },
  social_ritual: { warmup: 0.7, peak: 0.66, wildcard: 0.79, cooldown: 0.46 },
  tasting: { warmup: 0.62, peak: 0.88, wildcard: 0.54, cooldown: 0.7 },
  cultural_activation: { warmup: 0.58, peak: 0.83, wildcard: 0.74, cooldown: 0.44 },
  seasonal_activation: { warmup: 0.54, peak: 0.86, wildcard: 0.81, cooldown: 0.36 },
  scenic_moment: { warmup: 0.74, peak: 0.78, wildcard: 0.4, cooldown: 0.9 }
};
function clamp0122(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeForMatch(value) {
  return (value ?? "").trim().toLowerCase();
}
function getIntentTimeWindow(intent) {
  const value = normalizeForMatch(intent.timeWindow);
  if (!value) {
    return void 0;
  }
  if (value.includes("late") || value.includes("night") || value.includes("after") || value.includes("midnight")) {
    return "late";
  }
  if (value.includes("day") || value.includes("morning") || value.includes("afternoon") || value.includes("brunch")) {
    return "day";
  }
  if (value.includes("evening") || value.includes("dinner") || value.includes("sunset") || value.includes("tonight")) {
    return "evening";
  }
  return void 0;
}
function computeTimeWindowFit(momentWindow, intentWindow) {
  if (!intentWindow) {
    return momentWindow === "flexible" ? 0.8 : 0.62;
  }
  if (momentWindow === "flexible") {
    return 0.9;
  }
  if (momentWindow === intentWindow) {
    return 1;
  }
  if (momentWindow === "evening" && intentWindow === "late" || momentWindow === "late" && intentWindow === "evening") {
    return 0.72;
  }
  return 0.45;
}
function getDistrictDriveFallback(district, venues) {
  const fallback = {
    neighborhood: district?.trim() || "Downtown",
    driveMinutes: 12,
    category: "event"
  };
  if (!district) {
    return fallback;
  }
  const districtKey = normalizeForMatch(district);
  const matches = venues.filter(
    (venue) => normalizeForMatch(venue.neighborhood) === districtKey || normalizeForMatch(venue.neighborhood).includes(districtKey) || districtKey.includes(normalizeForMatch(venue.neighborhood))
  );
  if (matches.length === 0) {
    return fallback;
  }
  const driveMinutes = Math.round(
    matches.reduce((sum, venue) => sum + venue.driveMinutes, 0) / matches.length
  );
  return {
    neighborhood: matches[0].neighborhood,
    driveMinutes,
    category: matches[0].category
  };
}
function toMomentVenue(moment, venuePool) {
  const parent = moment.parentPlaceId ? venuePool.find((venue) => venue.id === moment.parentPlaceId) : void 0;
  const districtFallback = getDistrictDriveFallback(moment.district, venuePool);
  const baseCategory = parent?.category ?? MOMENT_TYPE_BASE_CATEGORY[moment.momentType] ?? districtFallback.category;
  const baseRoleAffinity = MOMENT_TYPE_ROLE_AFFINITY[moment.momentType];
  const energyLevel = Math.max(1, Math.min(5, Math.round(moment.energy * 5)));
  const socialDensity = clamp0122(
    moment.momentType === "social_ritual" || moment.momentType === "seasonal_activation" ? 0.58 + moment.energy * 0.36 : 0.34 + moment.energy * 0.32
  );
  const roleAffinity = {
    warmup: clamp0122(
      baseRoleAffinity.warmup + (moment.timeWindow === "day" ? 0.08 : 0) + (moment.timeWindow === "late" ? -0.06 : 0)
    ),
    peak: clamp0122(
      baseRoleAffinity.peak + moment.uniquenessScore * 0.08 + moment.romanticPotential * 0.05
    ),
    wildcard: clamp0122(
      baseRoleAffinity.wildcard + (moment.momentType === "seasonal_activation" ? 0.05 : 0) + (moment.uniquenessScore - 0.6) * 0.06
    ),
    cooldown: clamp0122(
      baseRoleAffinity.cooldown + moment.romanticPotential * 0.08 + (moment.timeWindow === "late" ? 0.05 : 0)
    )
  };
  return normalizeVenue({
    rawType: "place",
    id: `moment-${moment.id}`,
    name: moment.title,
    city: parent?.city ?? "San Jose",
    neighborhood: parent?.neighborhood ?? districtFallback.neighborhood,
    driveMinutes: parent?.driveMinutes ?? districtFallback.driveMinutes,
    priceTier: parent?.priceTier ?? "$$",
    tags: [
      "moment-node",
      moment.momentType,
      `window-${moment.timeWindow}`,
      ...parent?.tags.slice(0, 2) ?? []
    ],
    shortDescription: `${moment.title} gives the route a why-now pulse in ${moment.timeWindow} hours.`,
    narrativeFlavor: `Curated ${moment.momentType.replace(/_/g, " ")} moment with high-now relevance.`,
    imageUrl: parent?.imageUrl,
    isActive: true,
    categoryHint: baseCategory,
    subcategoryHint: moment.momentType,
    sourceTypes: ["moment", moment.momentType, moment.sourceType],
    normalizedFromRawType: "seed",
    sourceOrigin: "curated",
    sourceConfidence: moment.sourceType === "curated" ? 0.95 : 0.82,
    useCases: parent?.useCases,
    vibeTags: parent?.vibeTags,
    energyLevel,
    socialDensity,
    uniquenessScore: moment.uniquenessScore,
    distinctivenessScore: clamp0122(moment.uniquenessScore + 0.06),
    underexposureScore: clamp0122(moment.uniquenessScore + (moment.sourceType === "curated" ? 0.04 : -0.04)),
    shareabilityScore: clamp0122(0.52 + moment.uniquenessScore * 0.38),
    isHiddenGem: moment.uniquenessScore >= 0.75,
    isChain: false,
    roleAffinity,
    localSignals: parent?.localSignals,
    familyFriendly: parent?.settings.familyFriendly,
    adultSocial: parent?.settings.adultSocial,
    dateFriendly: moment.romanticPotential >= 0.6 || parent?.settings.dateFriendly,
    eventCapable: true,
    performanceCapable: moment.momentType === "live_performance" || moment.momentType === "cultural_activation",
    musicCapable: moment.momentType === "live_performance" || parent?.settings.musicCapable
  });
}
function selectMomentsForIntent(params) {
  const intentWindow = getIntentTimeWindow(params.intent);
  const venueById = new Map(params.venuePool.map((venue) => [venue.id, venue]));
  const neighborhoodKey = normalizeForMatch(params.intent.neighborhood);
  const distanceCap = params.intent.distanceMode === "nearby" ? 12 : 16;
  const perTypeCap = params.intent.distanceMode === "nearby" ? 3 : 4;
  const ranked = curatedMoments.map((moment) => {
    const parent = moment.parentPlaceId ? venueById.get(moment.parentPlaceId) : void 0;
    const neighborhoodMatch = neighborhoodKey.length > 0 && (normalizeForMatch(moment.district) === neighborhoodKey || normalizeForMatch(parent?.neighborhood) === neighborhoodKey);
    const driveMinutes = parent?.driveMinutes ?? getDistrictDriveFallback(moment.district, params.venuePool).driveMinutes;
    const timeWindowFit = computeTimeWindowFit(moment.timeWindow, intentWindow);
    const distanceFit = params.intent.distanceMode === "nearby" ? driveMinutes <= distanceCap ? 1 : driveMinutes <= 18 ? 0.72 : 0.4 : driveMinutes <= 22 ? 0.9 : 0.62;
    const score = timeWindowFit * 0.34 + distanceFit * 0.24 + moment.uniquenessScore * 0.22 + moment.energy * 0.08 + (neighborhoodMatch ? 0.18 : 0) + (params.intent.persona === "romantic" ? moment.romanticPotential * 0.14 : 0) + (moment.sourceType === "curated" ? 0.04 : 0);
    return {
      moment,
      score
    };
  }).sort((left, right) => right.score - left.score);
  const selected = [];
  const countsByType = /* @__PURE__ */ new Map();
  const maxCount = params.intent.distanceMode === "nearby" ? 10 : 14;
  for (const item of ranked) {
    if (selected.length >= maxCount) {
      break;
    }
    const currentTypeCount = countsByType.get(item.moment.momentType) ?? 0;
    if (currentTypeCount >= perTypeCap) {
      continue;
    }
    selected.push(item.moment);
    countsByType.set(item.moment.momentType, currentTypeCount + 1);
  }
  return selected;
}
function deriveMomentVenueRecords(params) {
  if (normalizeForMatch(params.intent.city) !== "san jose") {
    return [];
  }
  return selectMomentsForIntent(params).map((moment) => {
    const venue = toMomentVenue(moment, params.venuePool);
    return venue ? {
      moment,
      venue
    } : void 0;
  }).filter((record) => Boolean(record));
}

// src/domain/retrieval/scoreVenueFit.ts
function clamp0123(value) {
  return Math.max(0, Math.min(1, value));
}
function getScoreWeights(intent, lens) {
  const weights = {
    anchor: 0.22,
    crew: 0.21,
    vibe: 0.18,
    proximity: 0.16,
    budget: 0.11,
    uniqueness: 0.08,
    hiddenGem: 0.04,
    lens: 0.1
  };
  const refinements = new Set(intent.refinementModes ?? []);
  const refinementLeverageMultiplier = refinements.size > 0 ? 1.35 : 1;
  if (refinements.has("more-unique")) {
    weights.uniqueness += 0.08 * refinementLeverageMultiplier;
    weights.hiddenGem += 0.04 * refinementLeverageMultiplier;
  }
  if (refinements.has("closer-by")) {
    weights.proximity += 0.1 * refinementLeverageMultiplier;
  }
  if (refinements.has("more-exciting")) {
    weights.hiddenGem += 0.08 * refinementLeverageMultiplier;
    weights.uniqueness += 0.05 * refinementLeverageMultiplier;
    weights.lens += 0.04 * refinementLeverageMultiplier;
    weights.vibe += 0.06 * refinementLeverageMultiplier;
  }
  if (refinements.has("little-fancier")) {
    weights.crew += 0.04 * refinementLeverageMultiplier;
    weights.budget += 0.06 * refinementLeverageMultiplier;
  }
  if (refinements.has("more-relaxed")) {
    weights.proximity += 0.05 * refinementLeverageMultiplier;
    weights.anchor += 0.04 * refinementLeverageMultiplier;
    weights.vibe += 0.05 * refinementLeverageMultiplier;
  }
  if (intent.mode === "surprise") {
    weights.hiddenGem += 0.12;
    weights.uniqueness += 0.08;
    weights.lens += 0.03;
    weights.anchor -= 0.03;
  }
  if (intent.mode === "curate") {
    weights.anchor += 0.05;
    weights.crew += 0.04;
    weights.vibe += 0.07;
    weights.lens += 0.12;
    weights.hiddenGem += lens.discoveryBias === "high" ? 0.06 : 0.02;
  }
  if (lens.discoveryBias === "high") {
    weights.hiddenGem += 0.05;
    weights.uniqueness += 0.04;
  }
  return weights;
}
function normalizeWeightedScore(scores, weights) {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (totalWeight === 0) {
    return 0;
  }
  return (scores.anchor * weights.anchor + scores.crew * weights.crew + scores.vibe * weights.vibe + scores.proximity * weights.proximity + scores.budget * weights.budget + scores.uniqueness * weights.uniqueness + scores.hiddenGem * weights.hiddenGem + scores.lens * weights.lens) / totalWeight;
}
function hasAnyTag4(venue, tags) {
  const normalized = new Set(venue.tags.map((tag) => tag.toLowerCase()));
  return tags.some((tag) => normalized.has(tag.toLowerCase()));
}
function textIncludesAny2(value, terms) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}
function computeRomanticCenterpieceConvictionScore(venue, signals) {
  const atmosphericDepth = Math.max(
    signals.romanticSignals.ambiance,
    signals.romanticSignals.ambientExperience,
    signals.momentEnrichment.ambientUniqueness
  );
  const destinationFeel = Math.max(
    signals.destinationFactor,
    signals.anchorStrength,
    signals.momentPotential.score
  );
  const lingerGravity = Math.max(
    signals.lingerFactor,
    (signals.lingerFactor + signals.conversationFriendliness) / 2
  );
  const memorability = Math.max(
    venue.uniquenessScore,
    venue.distinctivenessScore,
    signals.momentIntensity.score
  );
  const hiddenGemPull = Math.max(venue.underexposureScore, venue.localSignals.localFavoriteScore);
  const chefLedSignal = venue.category === "restaurant" && (hasAnyTag4(venue, ["chef-led", "tasting-menu", "wine-pairing", "reservation", "omakase"]) || textIncludesAny2(venue.subcategory, ["tasting", "omakase", "atelier", "degustation"]));
  const viewBackedDiningSignal = (signals.primaryExperienceArchetype === "dining" || signals.primaryExperienceArchetype === "drinks" || signals.primaryExperienceArchetype === "sweet") && signals.romanticSignals.scenic >= 0.52 && signals.romanticSignals.intimacy >= 0.56 && atmosphericDepth >= 0.56;
  return clamp0123(
    destinationFeel * 0.28 + atmosphericDepth * 0.22 + lingerGravity * 0.14 + memorability * 0.18 + hiddenGemPull * 0.1 + (chefLedSignal ? 0.08 : 0) + (viewBackedDiningSignal ? 0.08 : 0)
  );
}
function defaultRoleContractRule(role) {
  return {
    label: `Default ${role} contract`,
    role,
    strength: "none",
    requiredCategories: [],
    preferredCategories: [],
    discouragedCategories: [],
    requiredTags: [],
    preferredTags: [],
    discouragedTags: []
  };
}
function contractStrengthWeight(value) {
  if (value === "none") {
    return 0;
  }
  if (value === "soft") {
    return 0.55;
  }
  if (value === "strong") {
    return 1;
  }
  return 1.22;
}
function roleContractInfluence(role, evaluation) {
  const strengthWeight = contractStrengthWeight(evaluation.strength);
  if (strengthWeight === 0) {
    return { bonus: 0, penalty: 0 };
  }
  const bonusWeight = role === "peak" ? 0.26 : role === "cooldown" ? 0.2 : role === "warmup" ? 0.16 : 0.1;
  const penaltyWeight = role === "peak" ? 0.34 : role === "cooldown" ? 0.28 : role === "warmup" ? 0.22 : 0.16;
  const bonus = evaluation.score * bonusWeight * strengthWeight;
  const penalty = evaluation.satisfied ? 0 : (1 - evaluation.score) * penaltyWeight * strengthWeight;
  return {
    bonus,
    penalty
  };
}
function roundToThousandths(value) {
  return Number(value.toFixed(3));
}
function moderateBandScore(value, target, spread) {
  return clamp0123(1 - Math.abs(value - target) / spread);
}
function getMomentRolePreference(momentIdentity, role) {
  const typeWeight = role === "start" ? momentIdentity.type === "arrival" ? 1 : momentIdentity.type === "explore" ? 0.82 : momentIdentity.type === "transition" ? 0.72 : momentIdentity.type === "linger" ? 0.5 : momentIdentity.type === "close" ? 0.36 : 0.3 : role === "highlight" ? momentIdentity.type === "anchor" ? 1 : momentIdentity.type === "explore" ? 0.86 : momentIdentity.type === "transition" ? 0.56 : momentIdentity.type === "linger" ? 0.44 : momentIdentity.type === "arrival" ? 0.38 : 0.34 : role === "windDown" ? momentIdentity.type === "close" ? 1 : momentIdentity.type === "linger" ? 0.9 : momentIdentity.type === "transition" ? 0.64 : momentIdentity.type === "arrival" ? 0.4 : momentIdentity.type === "explore" ? 0.34 : 0.28 : momentIdentity.type === "explore" ? 0.92 : momentIdentity.type === "transition" ? 0.8 : momentIdentity.type === "anchor" ? 0.62 : momentIdentity.type === "linger" ? 0.54 : momentIdentity.type === "arrival" ? 0.5 : 0.38;
  const strengthAdjustment = role === "start" ? momentIdentity.strength === "light" ? 0.12 : momentIdentity.strength === "medium" ? 0.08 : momentIdentity.type === "arrival" || momentIdentity.type === "explore" ? 0 : -0.06 : role === "highlight" ? momentIdentity.strength === "strong" ? 0.18 : momentIdentity.strength === "medium" ? 0.06 : -0.12 : role === "windDown" ? momentIdentity.strength === "light" ? 0.12 : momentIdentity.strength === "medium" ? 0.08 : -0.08 : momentIdentity.strength === "strong" ? 0.04 : momentIdentity.strength === "medium" ? 0.04 : 0;
  return clamp0123(typeWeight + strengthAdjustment);
}
function deriveTasteRolePoolInfluence(tasteSignals) {
  const moderateStartEnergy = moderateBandScore(tasteSignals.energy, 0.44, 0.38);
  const moderateStartSocial = moderateBandScore(
    tasteSignals.socialDensity,
    0.5,
    0.36
  );
  const calmWindDownEnergy = 1 - tasteSignals.energy;
  const warmupRoleSuitabilityContribution = tasteSignals.roleSuitability.start * 0.024;
  const peakRoleSuitabilityContribution = tasteSignals.roleSuitability.highlight * 0.03;
  const wildcardRoleSuitabilityContribution = tasteSignals.roleSuitability.surprise * 0.024;
  const cooldownRoleSuitabilityContribution = tasteSignals.roleSuitability.windDown * 0.016;
  const warmupMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "start"
  ) * 0.018;
  const peakMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "highlight"
  ) * 0.024;
  const wildcardMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "surprise"
  ) * 0.018;
  const cooldownMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "windDown"
  ) * 0.02;
  const intensityTierBoost = getMomentIntensityTierBoost(tasteSignals.momentIntensity);
  const intensityScore = tasteSignals.momentIntensity.score;
  return {
    warmup: {
      tasteBonus: roundToThousandths(
        tasteSignals.conversationFriendliness * 0.03 + moderateStartEnergy * 0.018 + moderateStartSocial * 0.016 + tasteSignals.categorySpecificity * 8e-3 + intensityScore * 6e-3 + warmupMomentContribution + warmupRoleSuitabilityContribution
      ),
      roleSuitabilityContribution: roundToThousandths(
        warmupRoleSuitabilityContribution
      ),
      momentContribution: roundToThousandths(warmupMomentContribution),
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0
    },
    peak: {
      tasteBonus: roundToThousandths(
        tasteSignals.destinationFactor * 0.022 + tasteSignals.experientialFactor * 0.022 + tasteSignals.energy * 0.012 + tasteSignals.momentPotential.score * 0.014 + intensityScore * 0.02 + tasteSignals.anchorStrength * 0.038 + tasteSignals.personalityStrength * 0.016 + tasteSignals.categorySpecificity * 0.012 + peakMomentContribution + peakRoleSuitabilityContribution
      ),
      roleSuitabilityContribution: roundToThousandths(
        peakRoleSuitabilityContribution
      ),
      momentContribution: roundToThousandths(peakMomentContribution),
      highlightPlausibilityBonus: roundToThousandths(
        (tasteSignals.highlightTier === 1 ? 0.022 : tasteSignals.highlightTier === 2 ? 8e-3 : 0) + intensityTierBoost * 0.42 + Math.max(0, intensityScore - 0.62) * 0.08 + Math.max(0, tasteSignals.anchorStrength - 0.72) * 0.04
      ),
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0
    },
    wildcard: {
      tasteBonus: roundToThousandths(
        tasteSignals.experientialFactor * 0.028 + tasteSignals.noveltyWeight * 0.028 + tasteSignals.momentPotential.score * 0.014 + intensityScore * 0.012 + wildcardMomentContribution + wildcardRoleSuitabilityContribution
      ),
      roleSuitabilityContribution: roundToThousandths(
        wildcardRoleSuitabilityContribution
      ),
      momentContribution: roundToThousandths(wildcardMomentContribution),
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0
    },
    cooldown: {
      tasteBonus: roundToThousandths(
        tasteSignals.intimacy * 0.024 + tasteSignals.conversationFriendliness * 0.024 + tasteSignals.lingerFactor * 0.02 + calmWindDownEnergy * 0.014 + intensityScore * 6e-3 + Math.max(0, tasteSignals.categorySpecificity - tasteSignals.anchorStrength) * 8e-3 + cooldownMomentContribution + cooldownRoleSuitabilityContribution
      ),
      roleSuitabilityContribution: roundToThousandths(
        cooldownRoleSuitabilityContribution
      ),
      momentContribution: roundToThousandths(cooldownMomentContribution),
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0
    }
  };
}
function formatActivationTraceLabel(candidate, activationType) {
  return `${candidate.venue.name} | ${activationType.replace(/_/g, " ")}`;
}
function computeHyperlocalVariantLift(candidate) {
  const activation = candidate.taste.signals.hyperlocalActivation;
  const impact = activation.interpretationImpact;
  return clamp0123(
    activation.intensityContribution * 0.42 + impact.highlightSuitability * 0.34 + impact.momentIntensity * 0.26 + impact.momentPotential * 0.22 + impact.novelty * 0.12
  );
}
function isHyperlocalVariantContractPlausible(candidate, lens) {
  const activation = candidate.taste.signals.hyperlocalActivation;
  const hints = new Set(activation.contractCompatibilityHints);
  const signals = candidate.taste.signals;
  if (activation.primaryActivationType === "social_ritual" && signals.socialDensity >= 0.84 && signals.intimacy < 0.5) {
    return false;
  }
  if (activation.primaryActivationType === "live_performance" && signals.energy >= 0.86 && signals.intimacy < 0.46 && !hints.has("romantic_ambient")) {
    return false;
  }
  if (!requiresRomanticPersonaMoment(lens)) {
    return true;
  }
  return hints.has("romantic_ambient") || hints.has("cozy_anchor") || signals.isRomanticMomentCandidate || activation.primaryActivationType === "tasting_activation" && (hints.has("cozy_anchor") || hints.has("curated_highlight")) && signals.intimacy >= 0.42 && signals.energy <= 0.62;
}
function shouldInjectHyperlocalVariant(candidate, lens) {
  const activation = candidate.taste.signals.hyperlocalActivation;
  const impact = activation.interpretationImpact;
  const variantLift = computeHyperlocalVariantLift(candidate);
  const strongImpact = impact.highlightSuitability >= 0.04 || impact.momentIntensity >= 0.04 || impact.momentPotential >= 0.04;
  const highlightReady = candidate.roleScores.peak >= 0.54 && candidate.stopShapeFit.highlight >= 0.24 && candidate.highlightValidity.validityLevel !== "invalid";
  const lowSignalGeneric = candidate.taste.fallbackPenalty.signalScore >= 0.18 && candidate.taste.signals.experientialFactor < 0.64 && candidate.taste.signals.momentIntensity.score < 0.72;
  if (!activation.primaryActivationType) {
    return false;
  }
  if (!activation.materiallyChangesHighlightPotential || !activation.materiallyChangesInterpretation) {
    return false;
  }
  if (activation.intensityContribution < 0.32 || variantLift < 0.18) {
    return false;
  }
  if (!strongImpact || !highlightReady || lowSignalGeneric) {
    return false;
  }
  return isHyperlocalVariantContractPlausible(candidate, lens);
}
function createHyperlocalActivationVariant(candidate, lens) {
  const activation = candidate.taste.signals.hyperlocalActivation;
  const activationType = activation.primaryActivationType;
  if (!activationType || !shouldInjectHyperlocalVariant(candidate, lens)) {
    return void 0;
  }
  const variantLift = computeHyperlocalVariantLift(candidate);
  const highlightLift = Math.min(
    0.11,
    0.028 + activation.interpretationImpact.highlightSuitability * 0.16 + activation.interpretationImpact.momentIntensity * 0.12 + activation.intensityContribution * 0.08
  );
  const fitLift = Math.min(
    0.055,
    0.012 + activation.interpretationImpact.highlightSuitability * 0.06 + activation.interpretationImpact.momentPotential * 0.04
  );
  const warmupLift = activationType === "seasonal_market" || activationType === "social_ritual" ? Math.min(0.05, 0.014 + activation.interpretationImpact.momentPotential * 0.08) : activationType === "ambient_activation" || activationType === "tasting_activation" ? Math.min(0.035, activation.interpretationImpact.highlightSuitability * 0.05) : 0;
  const wildcardLift = activationType === "live_performance" || activationType === "seasonal_market" || activationType === "cultural_activation" ? Math.min(0.07, 0.018 + activation.interpretationImpact.novelty * 0.1) : 0;
  const cooldownLift = activationType === "ambient_activation" || activationType === "tasting_activation" ? Math.min(0.04, 0.01 + activation.interpretationImpact.highlightSuitability * 0.05) : 0;
  const fallbackRelief = Math.min(
    0.08,
    activation.intensityContribution * 0.12 + activation.interpretationImpact.highlightSuitability * 0.14
  );
  const meaningfulDifference = highlightLift >= 0.05 || fitLift >= 0.03 || wildcardLift >= 0.04;
  if (!meaningfulDifference) {
    return void 0;
  }
  const ambianceBoost = activationType === "ambient_activation" ? 0.12 : activationType === "tasting_activation" ? 0.1 : activationType === "live_performance" ? 0.08 : activationType === "cultural_activation" ? 0.05 : 0.02;
  const intimacyBoost = activationType === "tasting_activation" ? 0.09 : activationType === "ambient_activation" ? 0.05 : activationType === "live_performance" ? 0.04 : 0.02;
  const ambientExperienceBoost = activationType === "ambient_activation" || activationType === "live_performance" ? 0.08 : activationType === "tasting_activation" || activationType === "cultural_activation" ? 0.06 : 0.03;
  const ambientUniquenessBoost = activationType === "ambient_activation" || activationType === "tasting_activation" ? 0.12 : activationType === "live_performance" ? 0.08 : 0.04;
  const culturalDepthBoost = activationType === "cultural_activation" ? 0.1 : activationType === "live_performance" ? 0.05 : 0.02;
  const momentPotentialBoost = Math.min(
    0.08,
    activation.interpretationImpact.momentPotential * 0.34 + activation.intensityContribution * 0.04
  );
  const momentIntensityBoost = Math.min(
    0.06,
    activation.interpretationImpact.momentIntensity * 0.24 + activation.intensityContribution * 0.03
  );
  const variantMomentPotential = clamp0123(
    candidate.taste.signals.momentPotential.score + momentPotentialBoost
  );
  const variantMomentIntensity = clamp0123(
    candidate.taste.signals.momentIntensity.score + momentIntensityBoost
  );
  const variantMomentIntensityTier = variantMomentIntensity >= 0.9 ? "signature" : variantMomentIntensity >= 0.8 ? "exceptional" : variantMomentIntensity >= 0.64 ? "strong" : "standard";
  const variantRomanticSignals = {
    ...candidate.taste.signals.romanticSignals,
    intimacy: clamp0123(candidate.taste.signals.romanticSignals.intimacy + intimacyBoost),
    ambiance: clamp0123(candidate.taste.signals.romanticSignals.ambiance + ambianceBoost),
    ambientExperience: clamp0123(
      candidate.taste.signals.romanticSignals.ambientExperience + ambientExperienceBoost
    )
  };
  const variantMomentEnrichment = {
    ...candidate.taste.signals.momentEnrichment,
    ambientUniqueness: clamp0123(
      candidate.taste.signals.momentEnrichment.ambientUniqueness + ambientUniquenessBoost
    ),
    culturalDepth: clamp0123(
      candidate.taste.signals.momentEnrichment.culturalDepth + culturalDepthBoost
    ),
    signals: [
      .../* @__PURE__ */ new Set([
        ...candidate.taste.signals.momentEnrichment.signals,
        "activation-shaped variant"
      ])
    ]
  };
  const variantRomanticScore = clamp0123(
    candidate.taste.signals.romanticScore + ambianceBoost * 0.42 + intimacyBoost * 0.32 + ambientExperienceBoost * 0.26
  );
  const variantMomentElevationPotential = clamp0123(
    candidate.taste.signals.momentElevationPotential + activation.interpretationImpact.highlightSuitability * 0.14 + activation.interpretationImpact.momentIntensity * 0.12 + activation.interpretationImpact.momentPotential * 0.1 + activation.intensityContribution * 0.08
  );
  const variantElevatedMomentCandidate = candidate.taste.signals.isElevatedMomentCandidate || activation.materiallyChangesInterpretation && activation.materiallyChangesHighlightPotential && variantMomentElevationPotential >= 0.5 && variantMomentIntensity >= 0.78 && variantMomentPotential >= 0.58;
  const variantSignals = {
    ...candidate.taste.signals,
    momentPotential: {
      ...candidate.taste.signals.momentPotential,
      score: variantMomentPotential
    },
    momentIntensity: {
      ...candidate.taste.signals.momentIntensity,
      score: variantMomentIntensity,
      tier: variantMomentIntensityTier,
      drivers: [
        .../* @__PURE__ */ new Set([
          ...candidate.taste.signals.momentIntensity.drivers,
          "hyperlocal activation"
        ])
      ]
    },
    momentEnrichment: variantMomentEnrichment,
    romanticSignals: variantRomanticSignals,
    romanticScore: variantRomanticScore,
    momentElevationPotential: variantMomentElevationPotential,
    isElevatedMomentCandidate: variantElevatedMomentCandidate,
    momentElevationReason: variantElevatedMomentCandidate ? "activation variant elevated into true moment contention" : candidate.taste.signals.momentElevationReason,
    isRomanticMomentCandidate: candidate.taste.signals.isRomanticMomentCandidate || variantRomanticSignals.ambiance >= 0.58 && variantMomentIntensity >= 0.68 && candidate.taste.signals.energy <= 0.68 && candidate.taste.signals.socialDensity <= 0.78
  };
  return {
    ...candidate,
    candidateIdentity: {
      candidateId: `${candidate.venue.id}::activation::${activationType}`,
      baseVenueId: candidate.venue.id,
      kind: "hyperlocal_activation",
      activationType,
      traceLabel: formatActivationTraceLabel(candidate, activationType)
    },
    fitScore: clamp0123(candidate.fitScore + fitLift),
    hiddenGemScore: clamp0123(
      candidate.hiddenGemScore + activation.interpretationImpact.novelty * 0.04
    ),
    lensCompatibility: clamp0123(
      candidate.lensCompatibility + activation.interpretationImpact.highlightSuitability * 0.04
    ),
    stopShapeFit: {
      ...candidate.stopShapeFit,
      highlight: clamp0123(candidate.stopShapeFit.highlight + highlightLift * 0.9),
      surprise: clamp0123(candidate.stopShapeFit.surprise + wildcardLift * 0.7),
      start: clamp0123(candidate.stopShapeFit.start + warmupLift * 0.4),
      windDown: clamp0123(candidate.stopShapeFit.windDown + cooldownLift * 0.5)
    },
    roleScores: {
      warmup: clamp0123(candidate.roleScores.warmup + warmupLift),
      peak: clamp0123(candidate.roleScores.peak + highlightLift),
      wildcard: clamp0123(candidate.roleScores.wildcard + wildcardLift),
      cooldown: clamp0123(candidate.roleScores.cooldown + cooldownLift)
    },
    taste: {
      ...candidate.taste,
      signals: variantSignals,
      fallbackPenalty: {
        ...candidate.taste.fallbackPenalty,
        signalScore: clamp0123(candidate.taste.fallbackPenalty.signalScore - fallbackRelief),
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        strongerAlternativeName: void 0,
        reason: `activation variant ready | lift ${roundToThousandths(variantLift)}`
      }
    }
  };
}
function scoreVenueFit(venue, intent, crewPolicy, lens, roleContracts, starterPack) {
  const anchorFit = scoreAnchorFit(venue, intent);
  const crewFit = scoreCrewFit(venue, crewPolicy);
  const proximityFit = scoreProximityFit(venue, intent);
  const budgetFit = scoreBudgetFit(venue, intent.budget);
  const uniquenessFit = scoreUniquenessFit(venue, intent);
  const lensCompatibility = scoreLensCompatibility(venue, intent, lens);
  const provisionalFit = anchorFit * 0.25 + crewFit * 0.23 + proximityFit * 0.2 + budgetFit * 0.11 + uniquenessFit * 0.1 + lensCompatibility * 0.11;
  const hiddenGemFit = scoreHiddenGemFit(venue, provisionalFit, intent);
  const weights = getScoreWeights(intent, lens);
  const stopShapeFit = {
    start: scoreLensStopShapeCompatibility(venue, lens, "start"),
    highlight: scoreLensStopShapeCompatibility(venue, lens, "highlight"),
    surprise: scoreLensStopShapeCompatibility(venue, lens, "surprise"),
    windDown: scoreLensStopShapeCompatibility(venue, lens, "windDown")
  };
  const contextSpecificity = scoreContextSpecificity({
    venue,
    intent,
    crewPolicy,
    lens,
    fitBreakdown: {
      anchorFit,
      crewFit
    },
    stopShapeFit
  });
  const dominanceControl = scoreDominancePenalty({
    venue,
    contextSpecificityByRole: contextSpecificity.byRole
  });
  const roleContract = {
    warmup: evaluateRoleContract(
      venue,
      roleContracts?.byRole.start ?? defaultRoleContractRule("start")
    ),
    peak: evaluateRoleContract(
      venue,
      roleContracts?.byRole.highlight ?? defaultRoleContractRule("highlight")
    ),
    wildcard: evaluateRoleContract(
      venue,
      roleContracts?.byRole.surprise ?? defaultRoleContractRule("surprise")
    ),
    cooldown: evaluateRoleContract(
      venue,
      roleContracts?.byRole.windDown ?? defaultRoleContractRule("windDown")
    )
  };
  const warmupContractInfluence = roleContractInfluence("warmup", roleContract.warmup);
  const peakContractInfluence = roleContractInfluence("peak", roleContract.peak);
  const wildcardContractInfluence = roleContractInfluence("wildcard", roleContract.wildcard);
  const cooldownContractInfluence = roleContractInfluence("cooldown", roleContract.cooldown);
  const vibeAuthority = computeVibeAuthority(venue, intent, lens, starterPack);
  const highlightValidity = evaluateHighlightValidity({
    venue,
    intent,
    starterPack
  });
  const tasteSignals = interpretVenueTaste(mapVenueToTasteInput(venue), {
    timeWindow: intent.timeWindow,
    persona: intent.persona ?? void 0,
    vibe: intent.primaryAnchor ?? void 0
  });
  const startMomentRoleFit = getMomentRolePreference(tasteSignals.momentIdentity, "start");
  const highlightMomentRoleFit = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "highlight"
  );
  const surpriseMomentRoleFit = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "surprise"
  );
  const windDownMomentRoleFit = getMomentRolePreference(
    tasteSignals.momentIdentity,
    "windDown"
  );
  const tasteRolePoolInfluence = deriveTasteRolePoolInfluence(tasteSignals);
  const protectedByUserConstraint = intent.anchor?.venueId === venue.id || Boolean(intent.discoveryPreferences?.some((preference) => preference.venueId === venue.id));
  const genericHospitalityFallbackSignal = getGenericHospitalityFallbackPenalty({
    venueCategory: venue.category,
    signatureGenericScore: venue.signature.genericScore,
    uniquenessScore: venue.uniquenessScore,
    distinctivenessScore: venue.distinctivenessScore,
    protectedCandidate: protectedByUserConstraint,
    signals: tasteSignals,
    tasteModeId: lens.tasteMode?.id
  });
  const tasteModeAlignment = getTasteModeAlignment(venue, lens.tasteMode, {
    protectedCandidate: protectedByUserConstraint
  });
  const tasteModeWeight = lens.tasteMode?.alignmentWeight ?? 0;
  const strongAlignmentFitBonus = tasteModeAlignment.tier === "primary" ? tasteModeWeight * 0.42 : tasteModeAlignment.tier === "supporting" ? tasteModeWeight * 0.16 : 0;
  const tasteModeFitBonus = tasteModeAlignment.overall * tasteModeWeight + strongAlignmentFitBonus;
  const tasteModeFitPenalty = tasteModeAlignment.penalty;
  const primaryAlignmentMultiplier = tasteModeAlignment.tier === "primary" ? 1.42 : tasteModeAlignment.tier === "supporting" ? 1.12 : 1;
  const modeAlignmentRoleInfluence = {
    warmup: roundToThousandths(
      tasteModeAlignment.byRole.start * 1.22 * primaryAlignmentMultiplier + tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.2 + (tasteModeAlignment.tier === "primary" ? 0.062 : tasteModeAlignment.tier === "supporting" ? 0.026 : 0)
    ),
    peak: roundToThousandths(
      tasteModeAlignment.byRole.highlight * 1.42 * primaryAlignmentMultiplier + tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.28 + (tasteModeAlignment.tier === "primary" ? 0.11 : tasteModeAlignment.tier === "supporting" ? 0.045 : 0)
    ),
    wildcard: roundToThousandths(
      tasteModeAlignment.byRole.surprise * 1.14 * primaryAlignmentMultiplier + tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.13
    ),
    cooldown: roundToThousandths(
      tasteModeAlignment.byRole.windDown * 1.14 * primaryAlignmentMultiplier + tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.12
    )
  };
  const modeAlignmentRolePenalty = {
    warmup: roundToThousandths(tasteModeFitPenalty * 0.36),
    peak: roundToThousandths(tasteModeFitPenalty * 0.4),
    wildcard: roundToThousandths(tasteModeFitPenalty * 0.28),
    cooldown: roundToThousandths(tasteModeFitPenalty * 0.32)
  };
  const startLightModeAlignmentBoost = lens.tasteMode && (tasteModeAlignment.byRole.start >= 0.42 || tasteModeAlignment.overall >= 0.44 && tasteModeAlignment.tier === "supporting") ? tasteModeWeight * (tasteModeAlignment.tier === "primary" ? 0.06 : tasteModeAlignment.tier === "supporting" ? 0.038 : 0.024) : 0;
  const windDownSoftModeAlignmentBoost = lens.tasteMode && (tasteModeAlignment.byRole.windDown >= 0.4 || tasteModeAlignment.overall >= 0.42 && tasteModeAlignment.tier === "supporting") ? tasteModeWeight * (tasteModeAlignment.tier === "primary" ? 0.05 : tasteModeAlignment.tier === "supporting" ? 0.034 : 0.022) : 0;
  tasteRolePoolInfluence.warmup.modeAlignmentContribution = modeAlignmentRoleInfluence.warmup;
  tasteRolePoolInfluence.peak.modeAlignmentContribution = modeAlignmentRoleInfluence.peak;
  tasteRolePoolInfluence.wildcard.modeAlignmentContribution = modeAlignmentRoleInfluence.wildcard;
  tasteRolePoolInfluence.cooldown.modeAlignmentContribution = modeAlignmentRoleInfluence.cooldown;
  tasteRolePoolInfluence.warmup.modeAlignmentPenalty = modeAlignmentRolePenalty.warmup;
  tasteRolePoolInfluence.peak.modeAlignmentPenalty = modeAlignmentRolePenalty.peak;
  tasteRolePoolInfluence.wildcard.modeAlignmentPenalty = modeAlignmentRolePenalty.wildcard;
  tasteRolePoolInfluence.cooldown.modeAlignmentPenalty = modeAlignmentRolePenalty.cooldown;
  const discoveryPreference = intent.discoveryPreferences?.find(
    (preference) => preference.venueId === venue.id
  );
  const discoveryFitBonus = discoveryPreference ? discoveryPreference.role === "highlight" ? 0.09 : 0.07 : 0;
  const universalityFitPenalty = dominanceControl.universalityScore * (1 - contextSpecificity.overall) * 0.08;
  const isLiveSource = venue.source.sourceOrigin === "live";
  const strongLiveWindow = isLiveSource && venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.72 && venue.source.qualityGateStatus === "approved";
  const softLiveWindow = isLiveSource && venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.52;
  const weakLiveWindow = isLiveSource && !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.65;
  const liveNoveltyLift = isLiveSource && venue.source.qualityGateStatus === "approved" && venue.source.qualityScore >= 0.72 && venue.signature.signatureScore >= 0.6 ? 0.035 : 0;
  const hybridLiveLift = computeHybridLiveLift(venue);
  const liveFairness = computeLiveQualityFairness(venue);
  const warmupHoursPressure = computeRoleAwareHoursPressure(venue, "warmup");
  const peakHoursPressure = computeRoleAwareHoursPressure(venue, "peak");
  const wildcardHoursPressure = computeRoleAwareHoursPressure(venue, "wildcard");
  const cooldownHoursPressure = computeRoleAwareHoursPressure(venue, "cooldown");
  const fitScore = clamp0123(
    normalizeWeightedScore(
      {
        anchor: anchorFit,
        crew: crewFit,
        vibe: vibeAuthority.overall,
        proximity: proximityFit,
        budget: budgetFit,
        uniqueness: uniquenessFit,
        hiddenGem: hiddenGemFit,
        lens: lensCompatibility
      },
      weights
    ) + discoveryFitBonus + (venue.source.sourceOrigin === "curated" ? 3e-3 : 0) + (strongLiveWindow ? 0.06 : softLiveWindow ? 0.025 : 0) + hybridLiveLift.fitLift + liveNoveltyLift + tasteModeFitBonus + liveFairness.fitBonus + venue.source.qualityScore * 0.05 + venue.source.sourceConfidence * 0.03 + venue.signature.signatureScore * 0.04 + contextSpecificity.overall * 0.08 - (venue.source.sourceOrigin === "live" && venue.source.sourceConfidence < 0.62 && !liveFairness.supportRecoveryEligible ? 0.01 : 0) - (weakLiveWindow ? 0.06 : 0) - (isLiveSource && !venue.source.hoursKnown ? liveFairness.supportRecoveryEligible ? 4e-3 : venue.source.qualityGateStatus === "approved" ? 0.01 : 0.018 : 0) - tasteModeFitPenalty - universalityFitPenalty - venue.signature.genericScore * 0.06 - (venue.source.qualityGateStatus === "demoted" ? 0.05 : 0)
  );
  const hiddenGemScore = clamp0123(
    hiddenGemFit * (1 + crewPolicy.hiddenGemBias) + (intent.prefersHiddenGems ? 0.03 : 0)
  );
  const energyFactor = venue.energyLevel / 5;
  const refinements = new Set(intent.refinementModes ?? []);
  const peakEnergyLift = refinements.has("more-exciting") ? 0.14 : 0;
  const relaxedPenalty = refinements.has("more-relaxed") ? 0.1 : 0;
  const wildcardLift = refinements.has("more-exciting") ? 0.12 : 0;
  const closerByPenalty = refinements.has("closer-by") ? venue.driveMinutes / 30 * 0.14 : 0;
  const uniqueLift = refinements.has("more-unique") ? venue.distinctivenessScore * 0.08 : 0;
  const fancyLift = refinements.has("little-fancier") && venue.priceTier !== "$" ? 0.06 : refinements.has("little-fancier") ? -0.04 : 0;
  const discoveryLift = lens.discoveryBias === "high" ? 0.08 : lens.discoveryBias === "medium" ? 0.04 : 0;
  const isNightlifeCoded = venue.category === "bar" || venue.category === "live_music" || hasAnyTag4(venue, ["late-night", "party"]);
  const isRomanticTone = venue.category === "dessert" || venue.category === "cafe" || venue.category === "live_music" || venue.category === "park" || hasAnyTag4(venue, ["cozy", "intimate", "design-forward", "listening", "calm"]);
  const isFamilyFriendly = (venue.category === "park" || venue.category === "museum" || venue.category === "cafe" || venue.category === "dessert" || venue.category === "activity" || venue.category === "event") && !isNightlifeCoded;
  const genericCategory = venue.category === "restaurant" || venue.category === "cafe";
  const genericHighlightCategory = venue.category === "restaurant" || venue.category === "cafe" || venue.category === "dessert";
  const formalDiningVenue = venue.category === "restaurant" && (hasAnyTag4(venue, [
    "chef-led",
    "reservation",
    "tasting-menu",
    "wine-pairing",
    "omakase"
  ]) || textIncludesAny2(venue.subcategory, ["omakase", "degustation", "tasting", "atelier"]));
  const adultNightlifeVenue = venue.category === "bar" && (hasAnyTag4(venue, ["cocktails", "dj", "late-night", "rooftop", "speakeasy"]) || tasteSignals.energy >= 0.68);
  const formalDiningPressure = clamp0123(
    (formalDiningVenue ? 0.72 : 0) + (venue.priceTier === "$$$$" ? 0.22 : venue.priceTier === "$$$" ? 0.1 : 0) + (tasteSignals.anchorStrength >= 0.8 ? 0.08 : 0) - (venue.settings.familyFriendly ? 0.4 : 0)
  );
  const adultNightlifePressure = clamp0123(
    (adultNightlifeVenue ? 0.8 : 0) + (isNightlifeCoded ? 0.12 : 0) - (venue.settings.familyFriendly ? 0.42 : 0)
  );
  const casualExplorationContext = intent.primaryAnchor === "adventurous-urban" || intent.primaryAnchor === "adventurous-outdoor" || intent.primaryAnchor === "playful" || intent.primaryAnchor === "chill";
  const contextualAdultPressure = Math.max(formalDiningPressure, adultNightlifePressure);
  const startIntentionalityBonus = clamp0123(
    tasteSignals.roleSuitability.start * 0.55 + tasteSignals.conversationFriendliness * 0.25 + (1 - tasteSignals.energy) * 0.2
  ) * 0.05;
  const windDownIntentionalityBonus = clamp0123(
    tasteSignals.roleSuitability.windDown * 0.5 + tasteSignals.intimacy * 0.25 + (1 - tasteSignals.energy) * 0.25
  ) * 0.05;
  const softClosingStartMoment = (tasteSignals.momentIdentity.type === "close" || tasteSignals.momentIdentity.type === "linger") && tasteSignals.momentIdentity.strength !== "strong";
  const arrivalExploreStartMoment = tasteSignals.momentIdentity.type === "arrival" || tasteSignals.momentIdentity.type === "explore";
  const interactiveLightStart = tasteSignals.primaryExperienceArchetype === "activity" && venue.energyLevel <= 3 && tasteSignals.momentIdentity.strength !== "strong";
  const socialEntryStart = tasteSignals.primaryExperienceArchetype === "social" && (tasteSignals.momentIdentity.type === "arrival" || tasteSignals.momentIdentity.type === "explore" || tasteSignals.momentIdentity.type === "transition");
  const casualActivityStart = (venue.category === "activity" || tasteSignals.primaryExperienceArchetype === "activity") && venue.energyLevel <= 3;
  const startEnergyEntryLift = (arrivalExploreStartMoment ? 0.05 : 0) + (interactiveLightStart ? 0.04 : 0) + (socialEntryStart ? 0.03 : 0) + (casualActivityStart ? 0.025 : 0);
  const softClosingStartPenalty = softClosingStartMoment ? 0.055 : 0;
  const windDownCloseLingerBoost = tasteSignals.momentIdentity.type === "close" ? 0.06 : tasteSignals.momentIdentity.type === "linger" ? 0.045 : 0;
  const windDownSecondPeakPenalty = (tasteSignals.momentIdentity.type === "anchor" || tasteSignals.momentIdentity.type === "explore") && tasteSignals.momentIdentity.strength === "strong" ? 0.11 : (tasteSignals.momentIdentity.type === "anchor" || tasteSignals.momentIdentity.type === "explore") && tasteSignals.momentIdentity.strength === "medium" ? 0.04 : 0;
  const startAnchorPenalty = Math.max(0, tasteSignals.anchorStrength - 0.76) * 0.14;
  const windDownAnchorPenalty = Math.max(0, tasteSignals.anchorStrength - 0.72) * 0.14;
  const highlightAnchorStrengthLift = tasteSignals.anchorStrength * 0.21;
  const highlightPersonalityLift = tasteSignals.personalityStrength * 0.12;
  const highlightSpecificityLift = tasteSignals.categorySpecificity * 0.1;
  const momentIntensityLift = tasteSignals.momentIntensity.score * 0.18 + getMomentIntensityTierBoost(tasteSignals.momentIntensity) * 0.9;
  const passiveHighlightArchetype = tasteSignals.primaryExperienceArchetype === "dining" || tasteSignals.primaryExperienceArchetype === "drinks" || tasteSignals.primaryExperienceArchetype === "sweet";
  const modeSpecificPassiveHighlightPenalty = (lens.tasteMode?.id === "activity-led" || lens.tasteMode?.id === "scenic-outdoor") && passiveHighlightArchetype && tasteSignals.momentPotential.score < 0.55 ? 0.1 : lens.tasteMode?.id === "highlight-centered" && passiveHighlightArchetype && tasteSignals.momentPotential.score < 0.48 ? 0.05 : 0;
  const highlightMomentLift = tasteSignals.momentPotential.score * 0.22;
  const strongHighlightMomentLift = tasteSignals.momentIdentity.strength === "strong" && (tasteSignals.momentIdentity.type === "anchor" || tasteSignals.momentIdentity.type === "explore") ? 0.16 : 0;
  const highlightArchetypeLift = getHighlightArchetypeLift(
    tasteSignals,
    lens.tasteMode?.id
  ) * 1.1;
  const supportRoleCollisionPenalty = Math.max(0, tasteSignals.roleSuitability.start - tasteSignals.roleSuitability.highlight) * 0.1 + Math.max(0, tasteSignals.roleSuitability.windDown - tasteSignals.roleSuitability.highlight) * 0.1;
  const genericHighlightPenalty = (genericHighlightCategory ? 0.12 : 0.05) * Math.max(0, 0.72 - tasteSignals.anchorStrength) + modeSpecificPassiveHighlightPenalty + (highlightMomentRoleFit < 0.54 ? 0.09 : 0) + (passiveHighlightArchetype && tasteSignals.momentIdentity.strength !== "strong" ? 0.04 : 0) + (genericHighlightCategory && tasteSignals.momentPotential.score < 0.46 ? 0.035 : 0);
  const cozyRomanticHighlightMode = crewPolicy.crew === "romantic" && intent.primaryAnchor === "cozy";
  const romanticCenterpieceConviction = computeRomanticCenterpieceConvictionScore(
    venue,
    tasteSignals
  );
  const romanticAmbientRichness = Math.max(
    tasteSignals.romanticSignals.ambiance,
    tasteSignals.romanticSignals.ambientExperience,
    tasteSignals.momentEnrichment.ambientUniqueness
  );
  const hospitalityHighlightArchetype = tasteSignals.primaryExperienceArchetype === "dining" || tasteSignals.primaryExperienceArchetype === "drinks" || tasteSignals.primaryExperienceArchetype === "sweet";
  const intimateDiningHighlightSignal = hospitalityHighlightArchetype && tasteSignals.romanticSignals.intimacy >= 0.6 && romanticAmbientRichness >= 0.58 && tasteSignals.experientialFactor >= 0.62;
  const viewBackedDiningHighlightSignal = hospitalityHighlightArchetype && tasteSignals.romanticSignals.scenic >= 0.5 && tasteSignals.romanticSignals.intimacy >= 0.56 && romanticAmbientRichness >= 0.54;
  const lowChaosHighIntimacySignal = tasteSignals.energy <= 0.68 && tasteSignals.socialDensity <= 0.72 && tasteSignals.romanticSignals.intimacy >= 0.64 && romanticAmbientRichness >= 0.52;
  const romanticAtmosphericHighlightBoost = cozyRomanticHighlightMode && (intimateDiningHighlightSignal || viewBackedDiningHighlightSignal || lowChaosHighIntimacySignal) ? Math.min(
    0.22,
    0.06 + Math.max(0, romanticAmbientRichness - 0.52) * 0.12 + Math.max(0, tasteSignals.romanticSignals.intimacy - 0.58) * 0.1 + Math.max(0, tasteSignals.experientialFactor - 0.6) * 0.08
  ) : 0;
  const scenicPrimaryHighlightCandidate = tasteSignals.primaryExperienceArchetype === "outdoor" || tasteSignals.primaryExperienceArchetype === "scenic" || tasteSignals.experienceFamily === "outdoor_scenic";
  const scenicDepthLowForCozyRomantic = scenicPrimaryHighlightCandidate && romanticAmbientRichness < 0.56 && tasteSignals.romanticSignals.intimacy < 0.62 && tasteSignals.momentEnrichment.culturalDepth < 0.46 && tasteSignals.experientialFactor < 0.66;
  const cozyRomanticScenicModeration = cozyRomanticHighlightMode && scenicPrimaryHighlightCandidate ? 0.04 + (scenicDepthLowForCozyRomantic ? 0.12 + Math.max(0, 0.56 - romanticAmbientRichness) * 0.08 + Math.max(0, 0.62 - tasteSignals.romanticSignals.intimacy) * 0.06 : 0) : 0;
  const genericDiningWithoutDateSignal = cozyRomanticHighlightMode && hospitalityHighlightArchetype && !intimateDiningHighlightSignal && !viewBackedDiningHighlightSignal && romanticAmbientRichness < 0.56 && tasteSignals.romanticSignals.intimacy < 0.64 && tasteSignals.momentEnrichment.culturalDepth < 0.48 && tasteSignals.anchorStrength < 0.7 && venue.signature.genericScore >= 0.4;
  const romanticGenericDiningSuppression = genericDiningWithoutDateSignal ? 0.18 : 0;
  const romanticCenterpieceHighlightBoost = cozyRomanticHighlightMode && romanticCenterpieceConviction >= 0.64 && (intimateDiningHighlightSignal || viewBackedDiningHighlightSignal || tasteSignals.anchorStrength >= 0.68) ? 0.06 + Math.max(0, romanticCenterpieceConviction - 0.64) * 0.22 + Math.max(0, tasteSignals.momentIntensity.score - 0.72) * 0.08 : 0;
  const romanticLowConvictionPenalty = cozyRomanticHighlightMode && romanticCenterpieceConviction < 0.62 && hospitalityHighlightArchetype && !viewBackedDiningHighlightSignal ? 0.08 + Math.max(0, 0.62 - romanticCenterpieceConviction) * 0.2 : 0;
  const discoveryWarmupBoost = discoveryPreference?.role === "start" ? 0.24 : discoveryPreference?.role === "highlight" ? -0.08 : discoveryPreference?.role === "windDown" ? -0.05 : 0;
  const discoveryPeakBoost = discoveryPreference?.role === "highlight" ? 0.34 : discoveryPreference?.role === "start" || discoveryPreference?.role === "windDown" ? -0.08 : 0;
  const discoveryCooldownBoost = discoveryPreference?.role === "windDown" ? 0.24 : discoveryPreference?.role === "highlight" ? -0.08 : discoveryPreference?.role === "start" ? -0.05 : 0;
  const romanticGenericPenalty = crewPolicy.crew === "romantic" && genericCategory && !isRomanticTone ? 0.09 : 0;
  const familyNightlifePenalty = crewPolicy.crew === "curator" && isNightlifeCoded ? 0.17 : 0;
  const isDateCoded = hasAnyTag4(venue, ["intimate", "date-night", "romantic", "chef-led"]) || venue.category === "dessert";
  const romanticPlayfulStartPenalty = crewPolicy.crew === "romantic" && venue.category === "activity" && !refinements.has("more-exciting") ? 0.13 : 0;
  const romanticHighlightGuardrailPenalty = crewPolicy.crew === "romantic" && genericCategory && !isRomanticTone ? 0.16 : 0;
  const familyHighlightNightlifePenalty = crewPolicy.crew === "curator" && (isNightlifeCoded || venue.category === "bar") ? 0.22 : 0;
  const familyHighlightDatePenalty = crewPolicy.crew === "curator" && isDateCoded ? 0.11 : 0;
  const familyGenericPenalty = crewPolicy.crew === "curator" && genericCategory && !isFamilyFriendly ? 0.12 : 0;
  const familyFormalDiningPenalty = crewPolicy.crew === "curator" ? formalDiningPressure * 0.16 : 0;
  const familyFormalHighlightPenalty = crewPolicy.crew === "curator" ? formalDiningPressure * 0.3 : 0;
  const familyAdultNightlifePenalty = crewPolicy.crew === "curator" ? adultNightlifePressure * 0.18 : 0;
  const familyAdultNightlifeHighlightPenalty = crewPolicy.crew === "curator" ? adultNightlifePressure * 0.34 : 0;
  const familyFormalWildcardPenalty = crewPolicy.crew === "curator" ? formalDiningPressure * 0.24 : 0;
  const familyAdultNightlifeWildcardPenalty = crewPolicy.crew === "curator" ? adultNightlifePressure * 0.28 : 0;
  const casualExplorationFormalPenalty = casualExplorationContext ? formalDiningPressure * 0.14 : 0;
  const casualExplorationHighlightPenalty = casualExplorationContext ? formalDiningPressure * 0.22 : 0;
  const casualExplorationAdultNightlifePenalty = casualExplorationContext ? adultNightlifePressure * 0.16 : 0;
  const casualExplorationWildcardPenalty = casualExplorationContext ? formalDiningPressure * 0.18 + adultNightlifePressure * 0.18 : 0;
  const supportAdultAnchorPenalty = Math.max(0, tasteSignals.anchorStrength - 0.72) * contextualAdultPressure * 0.22;
  const wildcardAdultAnchorPenalty = Math.max(0, tasteSignals.anchorStrength - 0.66) * contextualAdultPressure * 0.28;
  const familyContextBoost = crewPolicy.crew === "curator" && isFamilyFriendly ? 0.08 : 0;
  const romanticContextBoost = crewPolicy.crew === "romantic" && isRomanticTone ? 0.08 : 0;
  const romanticMomentModifierActive = requiresRomanticPersonaMoment(lens);
  const romanticMomentCandidate = romanticMomentModifierActive && tasteSignals.isRomanticMomentCandidate;
  const romanticMomentStartLift = romanticMomentCandidate && (tasteSignals.momentIdentity.type === "arrival" || tasteSignals.momentIdentity.type === "explore" || tasteSignals.momentIdentity.type === "transition") ? 0.05 : romanticMomentCandidate ? 0.02 : 0;
  const romanticMomentHighlightLift = romanticMomentCandidate ? 0.12 + (tasteSignals.momentIdentity.type === "anchor" || tasteSignals.momentIdentity.type === "explore" ? 0.05 : 0) + (tasteSignals.momentIdentity.strength === "strong" ? 0.03 : 0) + tasteSignals.momentIntensity.score * 0.04 + getMomentIntensityTierBoost(tasteSignals.momentIntensity) * 0.2 : 0;
  const romanticMomentWildcardLift = romanticMomentCandidate ? 0.06 : 0;
  const romanticFallbackHighlightPenalty = romanticMomentModifierActive && !tasteSignals.isRomanticMomentCandidate && passiveHighlightArchetype && tasteSignals.momentIdentity.strength !== "strong" ? 0.05 : 0;
  const friendsMovementBoost = crewPolicy.crew === "socialite" && (isNightlifeCoded || venue.category === "activity") ? 0.05 : 0;
  const universalHighlightPenalty = dominanceControl.flaggedUniversal && contextSpecificity.byRole.peak < 0.7 ? 0.04 : 0;
  const cozyConversationBoost = intent.primaryAnchor === "cozy" && (venue.category === "restaurant" || venue.category === "dessert" || venue.category === "cafe" || hasAnyTag4(venue, ["intimate", "cozy", "craft", "wine"])) ? 0.12 : 0;
  const cozyMusicPenalty = intent.primaryAnchor === "cozy" && crewPolicy.crew === "romantic" && (venue.category === "live_music" || venue.category === "event") ? vibeAuthority.musicSupportSource === "pack" || vibeAuthority.musicSupportSource === "both" ? 0.04 : 0.2 : 0;
  const adventurousOutdoorBoost = intent.primaryAnchor === "adventurous-outdoor" && (venue.category === "park" || hasAnyTag4(venue, ["nature", "walkable", "scenic", "viewpoint"])) ? 0.1 : 0;
  const adventurousUrbanBoost = intent.primaryAnchor === "adventurous-urban" && (hasAnyTag4(venue, ["underexposed", "street-food", "community", "local"]) || venue.category === "bar" || venue.category === "event") ? 0.1 : 0;
  const outdoorAdventureLift = intent.primaryAnchor === "adventurous-outdoor" && vibeAuthority.adventureRead === "outdoor" ? 0.12 : 0;
  const outdoorAdventurePenalty = intent.primaryAnchor === "adventurous-outdoor" && vibeAuthority.adventureRead === "urban" ? 0.18 : intent.primaryAnchor === "adventurous-outdoor" && vibeAuthority.adventureRead === "balanced" ? 0.06 : 0;
  const urbanAdventureLift = intent.primaryAnchor === "adventurous-urban" && vibeAuthority.adventureRead === "urban" ? 0.12 : 0;
  const urbanAdventurePenalty = intent.primaryAnchor === "adventurous-urban" && vibeAuthority.adventureRead === "outdoor" ? 0.18 : intent.primaryAnchor === "adventurous-urban" && vibeAuthority.adventureRead === "balanced" ? 0.06 : 0;
  const highlightVibeMismatchPenalty = Math.max(0, 0.6 - vibeAuthority.byRole.highlight) * 0.24;
  const highlightValidityLift = highlightValidity.validityLevel === "valid" ? 0.16 : highlightValidity.validityLevel === "fallback" ? -0.05 : -0.42;
  const highlightTierAdjustment = highlightValidity.candidateTier === "highlight-capable" ? 0.04 : highlightValidity.candidateTier === "support-only" ? -0.03 : -0.14;
  const qualityDemotionPenalty = venue.source.qualityGateStatus === "demoted" ? liveFairness.supportRecoveryEligible && venue.settings.highlightCapabilityTier !== "highlight-capable" ? 0.035 : 0.06 : 0;
  const livePeakTimeLift = strongLiveWindow ? 0.08 : softLiveWindow ? 0.03 : 0;
  const livePeakTimePenalty = weakLiveWindow ? 0.12 : isLiveSource && !venue.source.hoursKnown && venue.category !== "restaurant" ? liveFairness.supportRecoveryEligible ? 0.012 : 0.03 : 0;
  const packLiteralPenalty = highlightValidity.packLiteralRequirementLabel && !highlightValidity.packLiteralRequirementSatisfied ? highlightValidity.validityLevel === "invalid" ? 0.24 : 0.08 : 0;
  const warmup = clamp0123(
    fitScore * 0.41 + venue.roleAffinity.warmup * 0.24 + stopShapeFit.start * 0.24 + vibeAuthority.byRole.start * 0.2 + contextSpecificity.byRole.warmup * 0.13 + lensCompatibility * 0.14 + (1 - energyFactor) * 0.05 - dominanceControl.byRole.warmup * 0.7 - warmupContractInfluence.penalty + discoveryWarmupBoost + relaxedPenalty * 0.4 - closerByPenalty * 0.4 + warmupContractInfluence.bonus + modeAlignmentRoleInfluence.warmup - modeAlignmentRolePenalty.warmup + startLightModeAlignmentBoost + startMomentRoleFit * 0.08 + romanticMomentStartLift + startEnergyEntryLift + startIntentionalityBonus + romanticContextBoost * 0.4 + familyContextBoost * 0.35 + cozyConversationBoost * 0.45 + adventurousOutdoorBoost * 0.3 + outdoorAdventureLift * 0.2 - outdoorAdventurePenalty * 0.18 + adventurousUrbanBoost * 0.3 + urbanAdventureLift * 0.16 - urbanAdventurePenalty * 0.12 + hybridLiveLift.roleLiftByRole.warmup + warmupHoursPressure.boost - warmupHoursPressure.penalty + fancyLift * 0.4 - (strongLiveWindow ? 0.02 : 0) - romanticGenericPenalty * 0.4 - romanticPlayfulStartPenalty - familyFormalDiningPenalty - familyAdultNightlifePenalty - casualExplorationFormalPenalty - casualExplorationAdultNightlifePenalty - supportAdultAnchorPenalty - softClosingStartPenalty - startAnchorPenalty - (energyFactor > 0.8 ? 0.06 : 0)
  );
  const peak = clamp0123(
    fitScore * 0.42 + venue.roleAffinity.peak * 0.27 + stopShapeFit.highlight * 0.2 + vibeAuthority.byRole.highlight * 0.34 + vibeAuthority.packPressure.highlight * 0.06 + contextSpecificity.byRole.peak * 0.26 + contextSpecificity.personaSignal * 0.12 + contextSpecificity.vibeSignal * 0.12 + lensCompatibility * 0.11 + energyFactor * 0.06 + discoveryPeakBoost + highlightAnchorStrengthLift + highlightPersonalityLift + highlightSpecificityLift + momentIntensityLift + highlightMomentLift + highlightMomentRoleFit * 0.22 + strongHighlightMomentLift + romanticMomentHighlightLift + highlightArchetypeLift + peakEnergyLift - dominanceControl.byRole.peak - peakContractInfluence.penalty - universalHighlightPenalty - closerByPenalty * 0.2 + peakContractInfluence.bonus + modeAlignmentRoleInfluence.peak - modeAlignmentRolePenalty.peak + familyContextBoost + romanticContextBoost * 0.8 + cozyConversationBoost + adventurousOutdoorBoost * 0.25 + outdoorAdventureLift - outdoorAdventurePenalty + adventurousUrbanBoost * 0.35 + urbanAdventureLift - urbanAdventurePenalty + friendsMovementBoost * 0.4 + fancyLift * 0.3 + uniqueLift * 0.5 - packLiteralPenalty - qualityDemotionPenalty - livePeakTimePenalty - familyNightlifePenalty - familyHighlightNightlifePenalty - familyAdultNightlifeHighlightPenalty - familyHighlightDatePenalty - familyFormalHighlightPenalty - casualExplorationHighlightPenalty - familyGenericPenalty - romanticGenericPenalty - romanticFallbackHighlightPenalty - romanticHighlightGuardrailPenalty - genericHighlightPenalty - romanticGenericDiningSuppression - romanticLowConvictionPenalty - cozyRomanticScenicModeration - supportRoleCollisionPenalty - cozyMusicPenalty + romanticAtmosphericHighlightBoost + romanticCenterpieceHighlightBoost + livePeakTimeLift + hybridLiveLift.roleLiftByRole.peak + peakHoursPressure.boost - peakHoursPressure.penalty + highlightTierAdjustment + highlightValidityLift - highlightVibeMismatchPenalty - relaxedPenalty * 0.3
  );
  const wildcard = clamp0123(
    fitScore * 0.3 + venue.roleAffinity.wildcard * 0.23 + hiddenGemScore * 0.2 + venue.distinctivenessScore * 0.12 + stopShapeFit.surprise * 0.12 + vibeAuthority.byRole.surprise * 0.17 + contextSpecificity.byRole.wildcard * 0.18 + contextSpecificity.vibeSignal * 0.1 + lensCompatibility * 0.1 + crewPolicy.wildcardBias * 0.08 + wildcardLift + discoveryLift - (1 - surpriseMomentRoleFit) * 0.06 - dominanceControl.byRole.wildcard * 0.9 - wildcardContractInfluence.penalty + wildcardContractInfluence.bonus + modeAlignmentRoleInfluence.wildcard - modeAlignmentRolePenalty.wildcard - familyNightlifePenalty * 0.65 - familyFormalWildcardPenalty - familyAdultNightlifeWildcardPenalty - casualExplorationWildcardPenalty - wildcardAdultAnchorPenalty + romanticMomentWildcardLift + friendsMovementBoost + adventurousUrbanBoost * 0.42 + urbanAdventureLift * 0.42 - urbanAdventurePenalty * 0.28 + adventurousOutdoorBoost * 0.24 + outdoorAdventureLift * 0.24 - outdoorAdventurePenalty * 0.24 + closerByPenalty * 0.2 + hybridLiveLift.roleLiftByRole.wildcard + wildcardHoursPressure.boost - wildcardHoursPressure.penalty + fancyLift * 0.2 + uniqueLift - (strongLiveWindow ? 0.03 : 0) - relaxedPenalty * 0.2
  );
  const cooldown = clamp0123(
    fitScore * 0.33 + venue.roleAffinity.cooldown * 0.19 + stopShapeFit.windDown * 0.28 + vibeAuthority.byRole.windDown * 0.22 + contextSpecificity.byRole.cooldown * 0.18 + contextSpecificity.personaSignal * 0.1 + lensCompatibility * 0.13 + (1 - energyFactor) * 0.09 + proximityFit * 0.08 + discoveryCooldownBoost + windDownMomentRoleFit * 0.11 + windDownSoftModeAlignmentBoost + windDownCloseLingerBoost + windDownIntentionalityBonus + romanticContextBoost * 0.5 + familyContextBoost * 0.42 - dominanceControl.byRole.cooldown * 0.8 - cooldownContractInfluence.penalty + cooldownContractInfluence.bonus + modeAlignmentRoleInfluence.cooldown - modeAlignmentRolePenalty.cooldown - fancyLift + cozyConversationBoost * 0.4 + outdoorAdventureLift * 0.24 - outdoorAdventurePenalty * 0.22 + urbanAdventureLift * 0.22 - urbanAdventurePenalty * 0.18 + (refinements.has("more-relaxed") ? 0.06 : 0) + hybridLiveLift.roleLiftByRole.cooldown + cooldownHoursPressure.boost - cooldownHoursPressure.penalty + (softLiveWindow ? 0.03 : 0) - (crewPolicy.windDownPreferredCategories.includes(venue.category) ? 0.08 : 0) - closerByPenalty * 0.5 - (crewPolicy.windDownAvoidCategories.includes(venue.category) ? 0.12 : 0) - familyFormalDiningPenalty - familyAdultNightlifePenalty - casualExplorationFormalPenalty - casualExplorationAdultNightlifePenalty - supportAdultAnchorPenalty - windDownSecondPeakPenalty - windDownAnchorPenalty - (venue.energyLevel >= 4 ? 0.16 : 0)
  );
  return {
    venue,
    candidateIdentity: {
      candidateId: venue.id,
      baseVenueId: venue.id,
      kind: "base",
      traceLabel: venue.name
    },
    momentIdentity: tasteSignals.momentIdentity,
    fitBreakdown: {
      anchorFit,
      crewFit,
      proximityFit,
      budgetFit,
      uniquenessFit,
      hiddenGemFit
    },
    fitScore,
    hiddenGemScore,
    lensCompatibility,
    contextSpecificity,
    dominanceControl,
    roleContract,
    stopShapeFit,
    vibeAuthority,
    highlightValidity,
    roleScores: {
      warmup,
      peak,
      wildcard,
      cooldown
    },
    taste: {
      signals: tasteSignals,
      modeAlignment: {
        score: tasteModeAlignment.overall,
        penalty: tasteModeAlignment.penalty,
        lane: tasteModeAlignment.lane,
        tier: tasteModeAlignment.tier,
        supportiveTagScore: tasteModeAlignment.supportiveTagScore,
        lanePriorityScore: tasteModeAlignment.lanePriorityScore
      },
      fallbackPenalty: {
        signalScore: genericHospitalityFallbackSignal,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: genericHospitalityFallbackSignal > 0 ? "awaiting pool comparison" : "not generic fallback"
      },
      rolePoolInfluence: tasteRolePoolInfluence
    }
  };
}
function scoreVenueCollection(venues, intent, crewPolicy, lens, roleContracts, starterPack) {
  const baseCandidates = venues.map(
    (venue) => scoreVenueFit(venue, intent, crewPolicy, lens, roleContracts, starterPack)
  );
  const momentCandidates = deriveMomentVenueRecords({
    intent,
    venuePool: venues
  }).map(({ moment, venue }) => {
    const candidate = scoreVenueFit(venue, intent, crewPolicy, lens, roleContracts, starterPack);
    const parentVenueName = moment.parentPlaceId ? venues.find((item) => item.id === moment.parentPlaceId)?.name : void 0;
    return {
      ...candidate,
      candidateIdentity: {
        candidateId: `moment::${moment.id}`,
        baseVenueId: `moment::${moment.id}`,
        kind: "moment",
        momentId: moment.id,
        momentType: moment.momentType,
        momentSourceType: moment.sourceType,
        parentPlaceId: moment.parentPlaceId,
        traceLabel: parentVenueName ? `${moment.title} | ${parentVenueName}` : moment.title
      }
    };
  });
  const injectedVariants = baseCandidates.flatMap((candidate) => {
    const variant = createHyperlocalActivationVariant(candidate, lens);
    return variant ? [variant] : [];
  });
  const scored = [...baseCandidates, ...momentCandidates, ...injectedVariants];
  const adjusted = scored.map((candidate) => {
    const fallbackAssessment = assessGenericHospitalityFallbackPenalty(candidate, scored);
    if (fallbackAssessment.appliedPenalty <= 0) {
      return {
        ...candidate,
        taste: {
          ...candidate.taste,
          fallbackPenalty: {
            ...candidate.taste.fallbackPenalty,
            strongerAlternativePresent: fallbackAssessment.strongerAlternativePresent,
            strongerAlternativeName: fallbackAssessment.strongerAlternativeName,
            reason: fallbackAssessment.reason
          }
        }
      };
    }
    const appliedPenalty = fallbackAssessment.appliedPenalty;
    return {
      ...candidate,
      fitScore: clamp0123(candidate.fitScore - appliedPenalty * 0.16),
      roleScores: {
        ...candidate.roleScores,
        peak: clamp0123(candidate.roleScores.peak - appliedPenalty)
      },
      taste: {
        ...candidate.taste,
        fallbackPenalty: {
          ...candidate.taste.fallbackPenalty,
          appliedPenalty,
          applied: true,
          strongerAlternativePresent: fallbackAssessment.strongerAlternativePresent,
          strongerAlternativeName: fallbackAssessment.strongerAlternativeName,
          reason: fallbackAssessment.reason
        }
      }
    };
  });
  return adjusted.sort((left, right) => right.fitScore - left.fitScore);
}

// src/domain/interpretation/discovery/stopTypeCandidateBoard.ts
var STOP_TYPES_BY_SCENARIO_FAMILY = {
  romantic_cozy: [
    "neighborhood_walk",
    "casual_daytime_food",
    "atmospheric_experience",
    "intimate_dinner",
    "nightcap"
  ],
  romantic_lively: [
    "aperitivo",
    "energetic_dinner",
    "performance_anchor",
    "cocktail_bar",
    "late_night_food"
  ],
  romantic_cultured: [
    "cultural_institution",
    "atmospheric_detour",
    "thoughtful_wine_or_lunch",
    "performance_or_fine_dining",
    "atmospheric_nightcap"
  ]
};
function clamp0124(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeToken3(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeCity4(value) {
  const normalized = normalizeToken3(value).replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).trim();
}
function parsePersona(value) {
  const normalized = normalizeToken3(value);
  if (normalized.includes("romantic")) {
    return "romantic";
  }
  if (normalized.includes("friend")) {
    return "friends";
  }
  if (normalized.includes("family")) {
    return "family";
  }
  return null;
}
function parseVibe(value) {
  const normalized = normalizeToken3(value);
  const supported = [
    "cozy",
    "lively",
    "cultured",
    "chill",
    "playful",
    "adventurous-outdoor",
    "adventurous-urban"
  ];
  return supported.find((vibe) => normalized === vibe || normalized.includes(vibe)) ?? null;
}
function resolveScenarioFamily(input) {
  const city = normalizeCity4(input.city);
  const persona = parsePersona(input.persona);
  const vibe = parseVibe(input.vibe);
  if (city !== "san jose" || persona !== "romantic" || !vibe) {
    return null;
  }
  if (vibe === "cozy" || vibe === "chill") {
    return "romantic_cozy";
  }
  if (vibe === "lively") {
    return "romantic_lively";
  }
  if (vibe === "cultured") {
    return "romantic_cultured";
  }
  return null;
}
function getScenarioRequiredStopTypes(scenarioFamily) {
  return [...STOP_TYPES_BY_SCENARIO_FAMILY[scenarioFamily]];
}
function uniqueLowerTokens(venue) {
  const seed = [
    venue.name,
    venue.subcategory,
    venue.shortDescription,
    venue.narrativeFlavor,
    venue.category,
    venue.neighborhood,
    ...venue.tags,
    ...venue.vibeTags,
    ...venue.source.sourceTypes
  ].filter(Boolean).join(" ");
  return new Set(
    normalizeToken3(seed).split(" ").map((token) => token.trim()).filter(Boolean)
  );
}
function hasAnyToken2(tokens, values) {
  return values.some((value) => tokens.has(normalizeToken3(value)));
}
function hasAnyPhrase(value, phrases) {
  const normalized = normalizeToken3(value);
  return phrases.some((phrase) => normalized.includes(normalizeToken3(phrase)));
}
function toSourceType(scoredVenue) {
  if (scoredVenue.candidateIdentity.kind === "moment") {
    if (scoredVenue.candidateIdentity.momentSourceType === "event") {
      return "event";
    }
    if (scoredVenue.candidateIdentity.momentSourceType === "hybrid") {
      return "hybrid";
    }
  }
  return scoredVenue.venue.source.sourceOrigin === "live" ? "hybrid" : "venue";
}
function getVenueSignals(scoredVenue) {
  const happenings = scoredVenue.venue.source.happenings;
  const roleStart = clamp0124(scoredVenue.roleScores.warmup);
  const roleHighlight = clamp0124(scoredVenue.roleScores.peak);
  const roleWindDown = clamp0124(scoredVenue.roleScores.cooldown);
  const authorityScore = clamp0124(
    scoredVenue.fitScore * 0.34 + scoredVenue.taste.signals.anchorStrength * 0.2 + scoredVenue.vibeAuthority.overall * 0.16 + roleHighlight * 0.14 + scoredVenue.venue.source.qualityScore * 0.16
  );
  return {
    authorityScore,
    hiddenGemScore: clamp0124(
      scoredVenue.hiddenGemScore * 0.55 + scoredVenue.venue.underexposureScore * 0.2 + (happenings?.hiddenGemStrength ?? 0) * 0.25
    ),
    currentRelevance: clamp0124(happenings?.currentRelevance ?? 0),
    eventPotential: clamp0124(happenings?.eventPotential ?? 0),
    performancePotential: clamp0124(happenings?.performancePotential ?? 0),
    liveNightlifePotential: clamp0124(happenings?.liveNightlifePotential ?? 0),
    culturalAnchorPotential: clamp0124(happenings?.culturalAnchorPotential ?? 0),
    lateNightPotential: clamp0124(happenings?.lateNightPotential ?? 0),
    majorVenueStrength: clamp0124(happenings?.majorVenueStrength ?? 0),
    roleFit: {
      start: roleStart,
      highlight: roleHighlight,
      windDown: roleWindDown
    }
  };
}
function getFamilyAlignment(scenarioFamily, venueSignals, scoredVenue) {
  if (scenarioFamily === "romantic_cozy") {
    return clamp0124(
      venueSignals.hiddenGemScore * 0.28 + scoredVenue.taste.signals.romanticSignals.intimacy * 0.2 + scoredVenue.taste.signals.romanticSignals.ambiance * 0.18 + venueSignals.roleFit.windDown * 0.16 + venueSignals.currentRelevance * 0.08 + venueSignals.authorityScore * 0.1
    );
  }
  if (scenarioFamily === "romantic_lively") {
    return clamp0124(
      venueSignals.liveNightlifePotential * 0.28 + venueSignals.eventPotential * 0.18 + venueSignals.performancePotential * 0.16 + venueSignals.lateNightPotential * 0.14 + venueSignals.roleFit.highlight * 0.14 + venueSignals.currentRelevance * 0.1
    );
  }
  return clamp0124(
    venueSignals.culturalAnchorPotential * 0.32 + venueSignals.performancePotential * 0.14 + scoredVenue.taste.signals.momentEnrichment.culturalDepth * 0.14 + venueSignals.hiddenGemScore * 0.1 + venueSignals.roleFit.highlight * 0.16 + venueSignals.currentRelevance * 0.14
  );
}
function getStopTypeFit(scoredVenue, stopType, scenarioFamily) {
  const venue = scoredVenue.venue;
  const tokens = uniqueLowerTokens(venue);
  const signals = getVenueSignals(scoredVenue);
  const isRestaurantLike = venue.category === "restaurant" || venue.category === "cafe" || venue.category === "dessert";
  const isPerformanceLike = venue.category === "live_music" || venue.settings.performanceCapable || venue.settings.musicCapable || signals.performancePotential >= 0.58;
  const scenicLike = hasAnyToken2(tokens, ["garden", "walk", "stroll", "scenic", "promenade", "park"]);
  const reasons = [];
  let fit = 0;
  switch (stopType) {
    case "neighborhood_walk": {
      fit = clamp0124(
        (venue.category === "park" ? 0.34 : 0) + (venue.category === "event" ? 0.12 : 0) + (scenicLike ? 0.28 : 0) + (hasAnyToken2(tokens, ["market", "walkable", "neighborhood"]) ? 0.14 : 0) + signals.roleFit.start * 0.06 + signals.roleFit.windDown * 0.06
      );
      if (scenicLike) reasons.push("scenic or stroll-forward");
      if (hasAnyToken2(tokens, ["market", "walkable"])) reasons.push("walkable neighborhood flow");
      break;
    }
    case "casual_daytime_food": {
      fit = clamp0124(
        (venue.category === "cafe" ? 0.4 : 0) + (venue.category === "dessert" ? 0.24 : 0) + (isRestaurantLike ? 0.12 : 0) + (hasAnyToken2(tokens, ["coffee", "tea", "bakery", "lunch", "brunch"]) ? 0.2 : 0) + (venue.energyLevel <= 3 ? 0.08 : 0)
      );
      if (hasAnyToken2(tokens, ["coffee", "tea", "bakery"])) reasons.push("low-friction daytime food signal");
      if (venue.energyLevel <= 3) reasons.push("calmer daytime pacing");
      break;
    }
    case "atmospheric_experience": {
      fit = clamp0124(
        (scenicLike ? 0.26 : 0) + (venue.category === "park" ? 0.26 : 0) + (venue.category === "museum" ? 0.16 : 0) + signals.hiddenGemScore * 0.14 + signals.culturalAnchorPotential * 0.1 + (hasAnyToken2(tokens, ["atmospheric", "discovery", "reflective", "garden"]) ? 0.08 : 0)
      );
      if (venue.category === "park" || scenicLike) reasons.push("atmospheric place character");
      if (signals.hiddenGemScore >= 0.58) reasons.push("hidden-gem discovery signal");
      break;
    }
    case "intimate_dinner": {
      fit = clamp0124(
        (venue.category === "restaurant" ? 0.34 : 0) + (venue.category === "bar" ? 0.1 : 0) + signals.roleFit.highlight * 0.2 + (hasAnyToken2(tokens, ["intimate", "romantic", "conversation", "wine", "chef led", "tasting"]) ? 0.24 : 0) + scoredVenue.taste.signals.romanticSignals.intimacy * 0.12
      );
      if (venue.category === "restaurant") reasons.push("dinner-capable anchor");
      if (hasAnyToken2(tokens, ["intimate", "romantic", "conversation"])) reasons.push("intimate dinner tone");
      break;
    }
    case "nightcap": {
      fit = clamp0124(
        (venue.category === "bar" ? 0.36 : 0) + (venue.category === "live_music" ? 0.14 : 0) + signals.roleFit.windDown * 0.2 + (hasAnyToken2(tokens, ["nightcap", "jazz", "cocktail", "wine", "lounge", "quiet"]) ? 0.2 : 0) + signals.lateNightPotential * 0.1
      );
      if (venue.category === "bar") reasons.push("nightcap-ready bar profile");
      if (hasAnyToken2(tokens, ["jazz", "wine", "lounge"])) reasons.push("soft landing atmosphere");
      break;
    }
    case "aperitivo": {
      fit = clamp0124(
        (venue.category === "bar" ? 0.28 : 0) + (venue.category === "restaurant" ? 0.1 : 0) + signals.roleFit.start * 0.2 + (hasAnyToken2(tokens, ["happy", "hour", "aperitivo", "small", "plates", "cocktail"]) ? 0.26 : 0) + signals.currentRelevance * 0.16
      );
      if (hasAnyToken2(tokens, ["happy", "hour", "aperitivo"])) reasons.push("early-evening energy setter");
      if (signals.roleFit.start >= 0.6) reasons.push("strong opener fit");
      break;
    }
    case "energetic_dinner": {
      fit = clamp0124(
        (venue.category === "restaurant" ? 0.26 : 0) + (venue.category === "event" ? 0.08 : 0) + signals.roleFit.highlight * 0.2 + (venue.energyLevel >= 3 ? 0.12 : 0) + (hasAnyToken2(tokens, ["social", "lively", "buzz", "energetic", "chef"]) ? 0.18 : 0) + signals.liveNightlifePotential * 0.16
      );
      if (venue.category === "restaurant") reasons.push("highlight dinner structure");
      if (signals.liveNightlifePotential >= 0.55) reasons.push("lively handoff potential");
      break;
    }
    case "performance_anchor": {
      fit = clamp0124(
        (isPerformanceLike ? 0.36 : 0) + (venue.category === "event" ? 0.14 : 0) + signals.performancePotential * 0.2 + signals.majorVenueStrength * 0.16 + signals.roleFit.highlight * 0.14
      );
      if (isPerformanceLike) reasons.push("performance-capable anchor");
      if (signals.majorVenueStrength >= 0.55) reasons.push("major timed gravity");
      break;
    }
    case "cocktail_bar": {
      fit = clamp0124(
        (venue.category === "bar" ? 0.36 : 0) + signals.liveNightlifePotential * 0.22 + signals.roleFit.windDown * 0.16 + (hasAnyToken2(tokens, ["cocktail", "bar", "lounge", "night"]) ? 0.2 : 0) + signals.currentRelevance * 0.06
      );
      if (venue.category === "bar") reasons.push("cocktail-forward nightlife lane");
      if (signals.liveNightlifePotential >= 0.56) reasons.push("nightlife continuity signal");
      break;
    }
    case "late_night_food": {
      fit = clamp0124(
        (isRestaurantLike ? 0.24 : 0) + signals.lateNightPotential * 0.28 + signals.currentRelevance * 0.16 + (hasAnyToken2(tokens, ["late", "night", "post", "food", "ramen", "dessert"]) ? 0.2 : 0) + signals.roleFit.windDown * 0.12
      );
      if (signals.lateNightPotential >= 0.56) reasons.push("late-night food potential");
      if (isRestaurantLike) reasons.push("post-show food compatibility");
      break;
    }
    case "cultural_institution": {
      fit = clamp0124(
        (venue.category === "museum" ? 0.38 : 0) + (venue.category === "activity" ? 0.12 : 0) + signals.culturalAnchorPotential * 0.24 + (hasAnyToken2(tokens, ["museum", "gallery", "historic", "heritage", "cultural"]) ? 0.18 : 0) + signals.roleFit.highlight * 0.08
      );
      if (venue.category === "museum") reasons.push("institutional cultural anchor");
      if (signals.culturalAnchorPotential >= 0.56) reasons.push("high cultural authority");
      break;
    }
    case "atmospheric_detour": {
      fit = clamp0124(
        (scenicLike ? 0.3 : 0) + (venue.category === "park" ? 0.2 : 0) + signals.hiddenGemScore * 0.2 + signals.roleFit.start * 0.08 + signals.roleFit.windDown * 0.08 + (hasAnyToken2(tokens, ["reflective", "detour", "stroll", "discovery"]) ? 0.14 : 0)
      );
      if (scenicLike) reasons.push("short atmospheric detour potential");
      if (signals.hiddenGemScore >= 0.58) reasons.push("detour-worthy hidden gem");
      break;
    }
    case "thoughtful_wine_or_lunch": {
      fit = clamp0124(
        (venue.category === "bar" ? 0.18 : 0) + (isRestaurantLike ? 0.18 : 0) + (hasAnyToken2(tokens, ["wine", "lunch", "conversation", "thoughtful", "quiet"]) ? 0.28 : 0) + signals.roleFit.start * 0.12 + signals.roleFit.windDown * 0.12 + signals.authorityScore * 0.12
      );
      if (hasAnyToken2(tokens, ["wine", "lunch"])) reasons.push("wine/lunch conversational fit");
      if (signals.roleFit.start >= 0.58 || signals.roleFit.windDown >= 0.58) reasons.push("supports thoughtful pacing");
      break;
    }
    case "performance_or_fine_dining": {
      const fineDiningSignal = venue.category === "restaurant" && (venue.priceTier === "$$$" || venue.priceTier === "$$$$") && (hasAnyToken2(tokens, ["tasting", "chef", "fine", "romantic", "signature"]) || hasAnyPhrase(venue.subcategory, ["fine dining", "tasting"]));
      fit = clamp0124(
        (isPerformanceLike ? 0.28 : 0) + (fineDiningSignal ? 0.26 : 0) + signals.roleFit.highlight * 0.18 + signals.authorityScore * 0.14 + signals.majorVenueStrength * 0.14
      );
      if (isPerformanceLike) reasons.push("performance-led highlight option");
      if (fineDiningSignal) reasons.push("fine-dining gravity option");
      break;
    }
    case "atmospheric_nightcap": {
      fit = clamp0124(
        (venue.category === "bar" ? 0.24 : 0) + (venue.category === "park" ? 0.14 : 0) + signals.roleFit.windDown * 0.22 + signals.hiddenGemScore * 0.14 + (hasAnyToken2(tokens, ["atmospheric", "nightcap", "reflective", "wine", "jazz", "lounge", "quiet"]) ? 0.2 : 0) + signals.lateNightPotential * 0.06
      );
      if (signals.roleFit.windDown >= 0.58) reasons.push("reflective close compatibility");
      if (hasAnyToken2(tokens, ["wine", "jazz", "quiet", "lounge"])) reasons.push("atmospheric landing tone");
      break;
    }
    default:
      fit = 0;
  }
  const familyAlignment = getFamilyAlignment(scenarioFamily, signals, scoredVenue);
  const scenarioAdjustedFit = clamp0124(fit * 0.72 + familyAlignment * 0.28);
  if (scenarioAdjustedFit >= 0.56 && reasons.length === 0) {
    reasons.push("strong scenario-aware stop-type fit");
  }
  return { fit: scenarioAdjustedFit, reasons: reasons.slice(0, 3) };
}
function buildQualityFilterPass(params) {
  const { stopTypeFit, authorityScore, hiddenGemScore, currentRelevance, scenarioRelevance } = params;
  return stopTypeFit >= 0.62 || authorityScore >= 0.68 || hiddenGemScore >= 0.68 || currentRelevance >= 0.68 || scenarioRelevance >= 0.66;
}
function dedupeByVenue(scoredVenues) {
  const bestByVenueId = /* @__PURE__ */ new Map();
  for (const scoredVenue of scoredVenues) {
    const existing = bestByVenueId.get(scoredVenue.venue.id);
    if (!existing || scoredVenue.fitScore > existing.fitScore) {
      bestByVenueId.set(scoredVenue.venue.id, scoredVenue);
    }
  }
  return [...bestByVenueId.values()];
}
function emptyCandidatesByStopType(requiredStopTypes) {
  return requiredStopTypes.reduce(
    (acc, stopType) => {
      acc[stopType] = [];
      return acc;
    },
    {}
  );
}
function getCandidateRankScore(params) {
  const { stopTypeFit, scenarioRelevance, signals } = params;
  return stopTypeFit * 0.42 + scenarioRelevance * 0.2 + signals.authorityScore * 0.18 + signals.hiddenGemScore * 0.08 + signals.currentRelevance * 0.06 + signals.roleFit.highlight * 0.06;
}
function toCandidateReasons(params) {
  const { baseReasons, scenarioRelevance, signals } = params;
  const reasons = [...baseReasons];
  if (signals.authorityScore >= 0.66) {
    reasons.push("authority-backed venue for this stop type");
  }
  if (signals.hiddenGemScore >= 0.64) {
    reasons.push("hidden-gem strength");
  }
  if (signals.currentRelevance >= 0.62) {
    reasons.push("strong current relevance");
  }
  if (signals.performancePotential >= 0.6) {
    reasons.push("performance-capable signal");
  }
  if (signals.culturalAnchorPotential >= 0.6) {
    reasons.push("cultural-anchor signal");
  }
  if (signals.liveNightlifePotential >= 0.6) {
    reasons.push("nightlife continuity signal");
  }
  if (scenarioRelevance >= 0.68) {
    reasons.push("high scenario relevance");
  }
  return [...new Set(reasons)].slice(0, 3);
}
function asRecordByStopType(board) {
  const next = {};
  Object.keys(board).forEach((stopType) => {
    next[stopType] = board[stopType].slice().sort((left, right) => {
      if (right.__rankScore !== left.__rankScore) {
        return right.__rankScore - left.__rankScore;
      }
      if (right.authorityScore !== left.authorityScore) {
        return right.authorityScore - left.authorityScore;
      }
      if (right.currentRelevance !== left.currentRelevance) {
        return right.currentRelevance - left.currentRelevance;
      }
      return left.name.localeCompare(right.name);
    }).slice(0, 5).map(({ __rankScore, ...candidate }) => candidate);
  });
  return next;
}
function buildStopTypeCandidateBoard(input) {
  const scenarioFamily = resolveScenarioFamily({
    city: input.city,
    persona: input.persona,
    vibe: input.vibe
  });
  if (!scenarioFamily) {
    return null;
  }
  const requiredStopTypes = getScenarioRequiredStopTypes(scenarioFamily);
  const scored = dedupeByVenue(input.scoredVenues);
  const candidatesByStopType = emptyCandidatesByStopType(requiredStopTypes);
  const rankedBoard = emptyCandidatesByStopType(requiredStopTypes);
  for (const scoredVenue of scored) {
    const signals = getVenueSignals(scoredVenue);
    for (const stopType of requiredStopTypes) {
      const fitResult = getStopTypeFit(scoredVenue, stopType, scenarioFamily);
      const scenarioRelevance = clamp0124(
        fitResult.fit * 0.62 + getFamilyAlignment(scenarioFamily, signals, scoredVenue) * 0.38
      );
      const passQuality = buildQualityFilterPass({
        stopTypeFit: fitResult.fit,
        authorityScore: signals.authorityScore,
        hiddenGemScore: signals.hiddenGemScore,
        currentRelevance: signals.currentRelevance,
        scenarioRelevance
      });
      if (!passQuality) {
        continue;
      }
      const candidate = {
        venueId: scoredVenue.venue.id,
        name: scoredVenue.venue.name,
        district: scoredVenue.venue.neighborhood,
        stopType,
        sourceType: toSourceType(scoredVenue),
        authorityScore: signals.authorityScore,
        hiddenGemScore: signals.hiddenGemScore,
        currentRelevance: signals.currentRelevance,
        eventPotential: signals.eventPotential,
        performancePotential: signals.performancePotential,
        liveNightlifePotential: signals.liveNightlifePotential,
        culturalAnchorPotential: signals.culturalAnchorPotential,
        lateNightPotential: signals.lateNightPotential,
        majorVenueStrength: signals.majorVenueStrength,
        roleFit: {
          start: signals.roleFit.start,
          highlight: signals.roleFit.highlight,
          windDown: signals.roleFit.windDown
        },
        reasons: toCandidateReasons({
          baseReasons: fitResult.reasons,
          scenarioRelevance,
          signals
        }),
        __rankScore: getCandidateRankScore({
          stopTypeFit: fitResult.fit,
          scenarioRelevance,
          signals
        })
      };
      rankedBoard[stopType].push(candidate);
    }
  }
  const orderedBoard = asRecordByStopType(rankedBoard);
  requiredStopTypes.forEach((stopType) => {
    candidatesByStopType[stopType] = orderedBoard[stopType];
  });
  return {
    city: input.city,
    persona: input.persona,
    vibe: input.vibe,
    scenarioFamily,
    requiredStopTypes,
    candidatesByStopType
  };
}
async function buildStopTypeCandidateBoardFromIntent(input) {
  const persona = parsePersona(input.persona);
  const vibe = parseVibe(input.vibe);
  if (!persona || !vibe) {
    return null;
  }
  const scenarioFamily = resolveScenarioFamily({
    city: input.city,
    persona,
    vibe
  });
  if (!scenarioFamily) {
    return null;
  }
  const intent = normalizeIntent({
    persona,
    primaryVibe: vibe,
    city: input.city,
    distanceMode: input.distanceMode ?? "nearby",
    budget: input.budget ?? "balanced",
    mode: "build"
  });
  const lens = buildExperienceLens({ intent });
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: input.sourceMode ?? "curated"
  });
  const scoredVenues = scoreVenueCollection(
    retrieval.venues,
    intent,
    getCrewPolicy(intent.crew),
    lens,
    getRoleContract({ intent })
  );
  return buildStopTypeCandidateBoard({
    city: input.city,
    persona,
    vibe,
    scoredVenues
  });
}

// tmp/stop_type_candidate_probe.ts
var scenarios = [
  { city: "San Jose", persona: "romantic", vibe: "cozy" },
  { city: "San Jose", persona: "romantic", vibe: "lively" },
  { city: "San Jose", persona: "romantic", vibe: "cultured" }
];
function fmt(value) {
  if (typeof value !== "number") {
    return "n/a";
  }
  return value.toFixed(2);
}
function printStopType(stopType, rows) {
  console.log(`  - ${stopType}: ${rows.length}`);
  rows.forEach((candidate, index) => {
    const reason = candidate.reasons[0] ?? "fit signal present";
    console.log(
      `    ${index + 1}. ${candidate.name} (${candidate.district ?? "n/a"}) | authority ${fmt(candidate.authorityScore)} | hiddenGem ${fmt(candidate.hiddenGemScore)} | current ${fmt(candidate.currentRelevance)} | ${reason}`
    );
  });
}
for (const scenario of scenarios) {
  const board = await buildStopTypeCandidateBoardFromIntent({
    city: scenario.city,
    persona: scenario.persona,
    vibe: scenario.vibe
  });
  console.log(`
=== STOP-TYPE PROBE ${scenario.city} / ${scenario.persona} / ${scenario.vibe} ===`);
  if (!board) {
    console.log("unsupported scenario");
    continue;
  }
  console.log(`scenarioFamily: ${board.scenarioFamily}`);
  console.log(`requiredStopTypes: ${board.requiredStopTypes.join(", ")}`);
  board.requiredStopTypes.forEach((stopType) => {
    printStopType(
      stopType,
      board.candidatesByStopType[stopType].map((candidate) => ({
        name: candidate.name,
        district: candidate.district,
        authorityScore: candidate.authorityScore,
        hiddenGemScore: candidate.hiddenGemScore,
        currentRelevance: candidate.currentRelevance,
        reasons: candidate.reasons
      }))
    );
  });
}
