window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

var STRATEGIES=['BALANCED','VOID','TENSION','ORBIT','EDGE','MONUMENT','DIAGONAL'];

// Recursive Divisions aesthetic calibration. The genuine golden-section
// cuts, golden-angle relationships, and φ nesting remain mathematical code.
// Preserve historical branch ordering, RNG calls, and floating-point order.
var RECT_DIVISION_TUNING=Object.freeze({
  layout:Object.freeze({
    marginMinPx:42,                  // Root-frame margin before φ quantisation.
    marginMaxPx:96,
    minimumCells:7,                 // Minimum number of partition territories.
    maximumCells:56,                // Safety cap on subdivisions.
    baseCells:5,                    // Cells before controls add complexity.
    recursionCellGain:2,
    complexityCellsDivisor:9,
    elementCellsDivisor:16,
    minimumSideLowComplexityPx:70,  // Prevent splits on narrow territories.
    minimumSideHighComplexityPx:34
  }),
  selection:Object.freeze({
    crosscutPoolLimit:4,           // Choose among four largest active regions.
    framedDepthBonus:.08,         // Extra preference for deeper FRAMED cells.
    scoreJitterMin:.92,           // Seeded variability among similar territories.
    scoreJitterMax:1.08,
    framedContinueChance:.42      // Chance to favour one nested FRAMED child.
  }),
  split:Object.freeze({
    aspectPhiTolerance:.92,       // Artist-tuned tolerance around φ-shaped cells.
    minimumCutFraction:.28,       // Guard against overly narrow partitions.
    maximumCutFraction:.72,
    minimumDepthLimit:4,          // Stop at depth floor or Recursion + offset.
    recursionDepthOffset:2
  }),
  voids:Object.freeze({
    leafFractionAtFullNegativeSpace:.24, // Share of leaf territories held empty.
    initialCandidateWindow:3      // Maximum start index into largest cells.
  }),
  ink:Object.freeze({
    maximumCurveBias:8,           // Keep partition strokes nearly straight.
    maximumWobble:18              // Limit hand-drawn variation in this engine.
  }),
  marks:Object.freeze({
    insetFractionMin:.025,        // Inset leaf rectangles from their territories.
    insetFractionMax:.12,
    minimumVisibleSidePx:8,       // Keep the remaining rectangle drawable.
    rotationJitter:.045,          // Small independent leaf rotation amplitude.
    lineChanceBase:.24,           // Diagonal line frequency, before Complexity.
    lineComplexityDivisor:150,
    ellipseChanceScale:.46,       // Shape Amount adjusts secondary detail odds.
    ellipseRadiusMin:.16,
    ellipseRadiusMax:.34,
    arcChanceScale:.3,
    arcRadiusMin:.18,
    arcRadiusMax:.4,
    polygonChanceScale:.22,
    polygonRadiusMin:.12,
    polygonRadiusMax:.27,
    nestingChanceScale:.62,
    nestedGoldenTurnScale:.08     // Fraction of exact A.GOLD for nested strokes.
  })
});

// Radiant Systems: artist-calibrated spatial/mark parameters, not φ identities.
// True golden-angle turns, inverse-φ hierarchy and φ-relative geometry stay
// in drawBurst(); seeded RNG order and calculation order must remain unchanged.
var BURST_TUNING=Object.freeze({
  hubs:Object.freeze({
    distributedSourceCount:4,         // Candidate golden-cell hub positions.
    singleMonumentCentreMix:.34,      // MONUMENT centre attraction.
    singleCentreMix:.16,              // Other strategies keep the hub central.
    singleTerritoryScale:.72,         // Size of one-hub territory.
    twinTerritoryScale:.48,           // Equal spans for opposing hubs.
    triadTerritoryScale:.38,          // Smaller span for three hubs.
    triadLeadWeight:1.15,             // More rays from first triad hub.
    triadOtherWeight:.92,
    cropAlongStart:.28,               // Starting fraction along an edge.
    cropAlongSteps:45,                // Hash-based discrete position spread.
    cropOverflowFraction:.07,         // Hub just outside top/left boundary.
    cropRightBeyondFraction:1.07,     // Beyond opposite edges; separate values.
    cropBottomBeyondFraction:1.07,
    cropTerritoryScale:.96,
    voidTerritoryScale:.58,
    satelliteMainTerritoryScale:.56,
    satelliteMainWeight:1.7,
    satelliteOtherTerritoryScale:.3,
    satelliteOtherWeight:.48
  }),
  tiers:Object.freeze({
    mediumCountFloor:3,              // Minimum medium-tier threshold per hub.
    mediumCountFraction:.24,
    satelliteMediumFloor:5,          // Main satellite hub medium tier.
    satelliteMediumFraction:.34
  }),
  radius:Object.freeze({
    indexOffset:.7,                  // First ray begins outside hub centre.
    defaultExponent:.66,             // Historical fallback radial exponent.
    singleExponent:.62,
    twinExponent:.7,
    twinScale:.88,
    triadExponent:.76,
    triadScale:.78,
    croppedExponent:.56,
    croppedScale:1.12,
    voidExponent:.68,
    voidScale:.94,
    satelliteMainExponent:.62,
    satelliteOtherExponent:.8,
    satelliteMainScale:.95,
    satelliteOtherScale:.66,
    phiQuantisationBase:28           // Original size-grid base; NOT Fibonacci.
  }),
  angle:Object.freeze({
    satelliteTurnScale:.58,          // Tuned fraction of exact golden turn.
    croppedWaveAmplitude:.08         // Sinusoidal cropped-ray perturbation.
  }),
  avoidance:Object.freeze({
    voidRetryLimit:5,               // Try alternate golden-angle detours.
    voidDetourTurnScale:.72,         // Calibrated part of true A.GOLD.
    canvasInsetPx:24                // Clamp final ray endpoints to page.
  }),
  ink:Object.freeze({
    lineChanceSparse:.95,
    lineChanceDense:.7,
    triadLineChanceScale:.88,
    satelliteLineChanceScale:.74,
    voidLineChanceScale:.9,
    shapeChanceSparse:.92,
    shapeChanceDense:.63,
    heroShapeChanceBoost:1.24
  }),
  details:Object.freeze({
    satelliteCrosslinkIntervalFloor:3,
    satelliteCrosslinkIntervalFraction:.16,
    satelliteCrosslinkChance:.32,
    voidArcChanceScale:.14,
    voidArcRadiusFloorPx:10,
    voidArcSourceTerritoryPx:120,
    voidArcRadiusScale:.58,
    triadRingRadiusFloorPx:14
  })
});

// Golden Trajectories (V6/V7): calibrated visual grammar, not φ identities.
// `A.INV`, `A.GOLD`, `A.PHI`, logarithmic interpolation and Bézier
// mathematics remain in the algorithm. Preserve operation and RNG order.
var TRAJECTORY_TUNING=Object.freeze({
  selection:Object.freeze({
    classicHashThreshold:12        // Out of 100 hashed slots.
  }),
  layout:Object.freeze({
    minimumElements:8,             // Minimum trajectory samples.
    baseSizeFloorPx:55,            // Supporting mark territory floor.
    baseSizeDivisor:2,
    baseSizeCrowdGain:.22,
    logMinimumRadius:.002          // Positive log-path start floor.
  }),
  classic:Object.freeze({
    startRadius:.012,endRadius:.43,turns:2.35
  }),
  sweep:Object.freeze({
    cropOutsideFraction:.55,sweepOutsideFraction:.22,
    startRadius:.08,cropEndRadius:1.05,sweepEndRadius:.72,
    cropTurns:1.15,sweepTurns:1.35
  }),
  fan:Object.freeze({
    minimumArms:3,additionalArmOptions:3,
    endReach:.7,bendNormalOffset:.12
  }),
  sCurve:Object.freeze({
    borderOvershootPx:80,controlOutsideFraction:.08,controlBeyondFraction:1.08
  }),
  echo:Object.freeze({
    minimumEchoes:2,additionalEchoOptions:4,
    parallelOffset:.055,borderOvershootPx:70,
    startMajorFraction:.72,controlMinorFraction:.12,
    firstControlFraction:.3,controlMajorFraction:.88,
    secondControlFraction:.7,endFraction:.28
  }),
  intersect:Object.freeze({
    pathCount:2,borderOvershootPx:60,
    firstStartY:.22,firstControlAX:.34,firstControlAY:.08,
    firstControlBX:.62,firstControlBY:.92,firstEndY:.76,
    secondStartX:.18,secondControlAX:.92,secondControlAY:.3,
    secondControlBX:.08,secondControlBY:.7,secondEndX:.82
  }),
  cascade:Object.freeze({
    minimumSegments:3,additionalSegmentOptions:3,
    minimumSegmentPoints:3,lengthFraction:.62,
    phiDecayExponent:.7,phaseScale:.18,turnScale:.42,
    crossAxisLengthScale:.7,controlAAlong:.35,controlACross:.12,
    controlBAlong:.72,controlBCross:.1
  }),
  orbit:Object.freeze({
    pathCount:2,angularSweepScale:1.35,
    radiusXStart:.18,radiusXStep:.035,
    radiusYStart:.28,radiusYStep:.04,
    guideRadius:.2
  }),
  scatter:Object.freeze({
    startRadius:.02,endRadius:.58,turns:1.8,
    sourceCountMultiplier:2,chanceBase:.48,influenceChanceGain:.38
  }),
  safety:Object.freeze({
    visibilityMarginPx:20,visibleRequiredMax:4,visibleRequiredMin:2,
    visibleFraction:.12,fallbackBorderOvershootPx:20,
    fallbackControlNear:.08,fallbackControlFar:.92,
    lowInfluenceAnchorMix:.22
  }),
  ink:Object.freeze({
    drawOutsideMarginPx:45,scatterGapChance:.48,
    lineChanceSparse:.88,lineChanceDense:.58,
    shapeChanceSparse:.9,shapeChanceDense:.68,
    canvasInsetPx:24
  }),
  tiers:Object.freeze({
    mediumPeriodFloor:2,mediumPeriodScale:.18
  })
});

// Historical V1-V3 Spiral family calibrations: preserve the exact
// inverse-φ default exponent, golden-angle cadence and φ focal landmarks.
var SPIRAL_LEGACY_TUNING=Object.freeze({
  angle:Object.freeze({
    minimumGoldenTurnScale:.72,brokenWobble:.18,looseWobble:.1
  }),
  radius:Object.freeze({
    shellExponent:.52,shellScale:.88,looseExponent:.76,looseScale:1.04,
    brokenExponent:.62,brokenScale:.96,doubleExponent:.66,doubleScale:.7,
    offsetVoidExponent:.6,offsetVoidScale:.9,indexOffset:.6
  }),
  geometry:Object.freeze({
    offcentreMix:.72,
    doubleHorizontalReach:.29,otherHorizontalReach:.455,
    looseVerticalReach:.47,doubleVerticalReach:.31,otherVerticalReach:.435,
    shellEaseExponent:1.4,shellOffsetScale:.035,
    scatterActivationCrowd:.28,scatterMixScale:.12,canvasInsetPx:24
  }),
  tiers:Object.freeze({
    mediumCountFloor:5,mediumFraction:.24,
    territoryFloorPx:70,territoryDivisor:2,territoryCrowdScale:.28
  }),
  ink:Object.freeze({
    brokenCycleBase:4,brokenCycleOptions:4,
    lineChanceSparse:.82,lineChanceDense:.5,
    looseLineFactor:.68,doubleLineFactor:.78,
    markChanceSparse:.88,markChanceDense:.7,
    brokenMarkChance:.82,voidMarkChance:.9,
    shellArcChanceScale:.13,shellArcMinimumRadiusPx:10,
    shellArcSourceTerritoryPx:120,shellArcRadiusScale:.62
  })
});

// Historical V4-V5 spiral grammar: true logarithmic radius growth by φ
// per quarter-turn. Tuned turns, canvas reach, offsets, line cadence and
// stroke frequency are not mathematical φ constants.
var SPIRAL_LOG_TUNING=Object.freeze({
  geometry:Object.freeze({
    offcentreMix:.72,shellOffsetScale:.018,canvasInsetPx:24
  }),
  radius:Object.freeze({
    doubleTurns:1.75,looseTurns:2.05,otherTurns:2.35,
    doubleReach:.31,looseReach:.46,otherReach:.43,indexOffset:.6
  }),
  angle:Object.freeze({
    brokenWobble:.12,looseWobble:.07
  }),
  tiers:Object.freeze({
    mediumCountFloor:5,mediumFraction:.24,
    territoryFloorPx:70,territoryDivisor:2,territoryCrowdScale:.28
  }),
  ink:Object.freeze({
    brokenCycleBase:4,brokenCycleOptions:4,
    lineChanceSparse:.82,lineChanceDense:.5,
    looseLineFactor:.68,doubleLineFactor:.78,
    markChanceSparse:.88,markChanceDense:.7,
    brokenMarkChance:.82,voidMarkChance:.9
  })
});

// Orbital Studies' remaining winner-selection calibration, V1–V7.
// These are visual-mass preferences, score penalties and computational
// candidate budgets, NOT numerical consequences of the golden ratio.
// Previously extracted LAYOUT_TUNING / RELATIONSHIP_TUNING / placement
// parameters remain independent; preserve comparison strictness, score
// arithmetic, candidate seed suffixes and first-winning tie behaviour.
var ORBITAL_SELECTION_TUNING=Object.freeze({
  candidates:Object.freeze({
    highCountThreshold:110,            // Above 110 elements test fewer layouts.
    highCountBudget:4,                 // Original >110 candidate count.
    standardBudget:6                   // Original <=110 candidate count.
  }),
  mass:Object.freeze({
    heroWeight:1.35,                   // More influential visual centroid.
    smallWeight:.72,                   // Medium stays the neutral multiplier 1.
    thicknessBaseline:.55,            // Baseline weight from mark thickness.
    thicknessDivisor:34,              // Response to stroke thickness slider.
    opacityBaseline:.45,              // Baseline weight from opacity.
    opacityDivisor:150                // Response to opacity slider.
  }),
  score:Object.freeze({
    diagonalToleranceHeightFraction:.55, // Diagonal falloff as canvas-height fraction.
    collisionPenaltyLowOverlap:18,       // Collision penalty when overlap not allowed.
    collisionPenaltyHighOverlap:5,       // Lower penalty as overlap rises.
    voidPenaltyLowNegativeSpace:8,      // Reserved-void penalty at low demand.
    voidPenaltyHighNegativeSpace:26     // Higher priority when blank areas matter.
  })
});

// Legacy artistic/scoring calibration, NOT mathematical φ constants.
// Every value below is copied verbatim from the original V1–V7 renderer.
// Keep these independent from A.PHI/A.INV/A.GOLD in phi.js: their values
// document aesthetic judgement, not a derived mathematical identity.
// Changing any number is a visual redesign and requires a new renderer version.
var LAYOUT_TUNING=Object.freeze({
  strategy:Object.freeze({
    voidPenaltyWeight:24,           // Discourage placing marks in protected voids.
    voidRegionReward:18,            // Reward making explicit negative-space regions.
    tensionSeparationWeight:55,     // Prefer distant hero forms for TENSION.
    orbitMatchDistancePx:420,       // Distance over which ORBIT alignment decays.
    orbitMatchWeight:1.5,           // Reward a match to the intended orbit.
    edgeOuterBandLow:.12,           // EDGE-specific outer 12%: narrower than global edge scoring.
    edgeOuterBandHigh:.88,          // EDGE-specific outer strip, opposite side.
    edgeBonusWeight:45,            // Reward the proportion of marks in EDGE outer strip.
    monumentHeroBonusCap:55,        // Cap the MONUMENT hero-size reward.
    monumentHeroScaleWeight:14,     // Weight the hero-to-average size ratio.
    diagonalAlignmentWeight:40,     // Reward line-up with the selected diagonal.
    balancedCentreBonus:24,        // Reward a central mass in BALANCED.
    balancedDistanceDivisorPx:18   // Falloff of central-mass reward in canvas pixels.
  }),
  layout:Object.freeze({
    edgeOccupancyBandLow:.15,       // Global edge-occupancy measure: outer 15%.
    edgeOccupancyBandHigh:.85,      // Global edge-occupancy measure, opposite side.
    coverageWeight:86,             // Weight spread across both canvas axes.
    edgePreferredForEdge:.36,      // Global occupancy target for EDGE compositions.
    edgePreferredBase:.18,         // Base occupancy target for other compositions.
    edgePreferredCrowdGain:.16,    // Extra edge occupancy sought as density grows.
    edgeBaselineScore:28,          // Score given at exact occupancy target.
    edgeDeviationPenalty:65,       // Penalty per unit distance from target occupancy.
    phiCentroidWeight:78,          // Extra φ-focal attraction (affected by φ Pull).
    heroSeparationWeight:34,       // Reward distance among multiple heroes.
    singleHeroHierarchyBonus:12    // Baseline hierarchy reward if only one hero.
  })
});

// Element hierarchy and size calibration. These are legacy artistic
// choices, not golden-ratio identities. Changing them changes the drawings.
// Preserve the exact arithmetic and random-number call sequence of V1–V7.
var HIERARCHY_TUNING=Object.freeze({
  tiers:Object.freeze({
    threeHeroesAtCount:70,          // At this many marks, create three heroes.
    twoHeroesAtCount:24,            // Below this, use one hero; above, two.
    monumentHeroCount:1,            // MONUMENT keeps a single dominant hero.
    standardLargeHeroCount:3,      // Higher-count ordinary composition.
    standardMediumHeroCount:2,     // Middle-count ordinary composition.
    minimumMediumTarget:2,         // Desired medium marks before fitting to total.
    monumentMediumFraction:.16,    // MONUMENT reserves a smaller medium share.
    standardMediumFraction:.21     // Share of supporting medium marks otherwise.
  }),
  scale:Object.freeze({
    monumentHeroMultiplier:2.35,   // Emphasise the MONUMENT focal mark.
    standardHeroMultiplier:1.72,   // Emphasise heroes in other strategies.
    monumentSmallMultiplier:.48,   // Suppress MONUMENT supporting marks.
    standardSmallMultiplier:.56,   // Scale supporting marks otherwise.
    elementCountReference:48       // Reference count for inverse-sqrt scaling.
  }),
  size:Object.freeze({
    densityMinFactor:.76,          // Scale at minimum Density.
    densityMaxFactor:1.18,         // Scale at maximum Density.
    sampledMinPx:32,               // Smallest source size before scale and φ pull.
    sampledMaxPx:215,              // Largest source size before scale and φ pull.
    phiBaseMinimumPx:7,           // Floor for the quantisation base.
    phiBaseScalePx:22,            // Tuned size quantum, not a Fibonacci identity.
    monumentHeroMinPx:110,        // MONUMENT hero minimum, before count scaling.
    standardHeroMinPx:72,         // Hero minimum otherwise.
    territoryMinPx:20,            // Lower bound for territory size cap.
    territoryFitMin:.78,          // Cap multiplier with little allowed overlap.
    territoryFitMax:1.22,         // Cap multiplier with generous overlap.
    finalMinPx:8,                 // Final element-size floor.
    monumentMaxPx:470,           // Final size ceiling in MONUMENT.
    standardMaxPx:410            // Final size ceiling otherwise.
  })
});

// Calibrated bounds and penalties used by the V1–V7 placement planner.
// These are artistic / geometric safety settings, not consequences of φ.
// Keep all values, arithmetic order, RNG calls, and legacy render results.
// A numerical redesign requires a new renderer version.
var PLACEMENT_TUNING=Object.freeze({
  voids:Object.freeze({
    enableThreshold:.08,             // Below this, reserve no protected voids.
    sourceCellCount:10,               // Sample territories from ten golden cells.
    sourceCellMarginPx:54,           // Insets used to construct those cells.
    secondVoidThreshold:.7,          // High negative-space setting creates two voids.
    voidStrategySecondThreshold:.42, // VOID strategy creates two earlier.
    firstCellMaxIndex:4,             // Limit which sorted cell begins the selection.
    cellStride:3,                   // Separate selected void cells in the sorted list.
    cellPoolLimit:8,                // Avoid stepping beyond the original selection pool.
    scaleMin:.46,                   // Reserved region scaling at zero empty-space pull.
    scaleMax:.88,                   // Scaling with maximum empty-space pull.
    strategyScaleBoost:1.08,        // Make VOID-strategy exclusions slightly larger.
    widthFloorPx:110,              // Prevent too-narrow protected regions.
    heightFloorPx:90,              // Prevent too-short protected regions.
    maxCanvasFraction:.43,         // Maximum width/height of an exclusion.
    edgeInsetPx:34,                // Keep protected void boundaries inside the canvas.
    markRadiusFraction:.38,        // Approximate mark footprint used for intersection.
    paddingMinPx:4,                // Clearance around a void at low negative space.
    paddingMaxPx:34               // Clearance around a void at high negative space.
  }),
  collision:Object.freeze({
    heroDistanceBoost:1.12,        // Increase pair spacing where a hero is involved.
    distanceWhenOverlapHigh:.12,   // Desired centre spacing with maximum overlap.
    distanceWhenOverlapLow:.72,    // Centre spacing with minimum permitted overlap.
    voidPenaltyMin:4,              // Weight of a void collision at low negative space.
    voidPenaltyMax:14             // Weight of a void collision at high negative space.
  }),
  search:Object.freeze({
    heroPlacementTries:30,         // Candidate placements considered for each hero.
    otherPlacementTries:22,        // Candidate placements for supporting marks.
    shrinkLimit:.28,              // Maximum reduction when testing later candidates.
    shrinkPerAttempt:.012,        // Progressive shrink rate for retries.
    elementEdgeInsetPx:28,        // Keep planned element centres away from the edge.
    acceptablePenalty:.012        // Early-exit threshold for a good enough placement.
  })
});

// Legacy field-family relationships and scoring. These are artist-calibrated
// preferences, NOT φ-derived identities. Legacy and V3 parameters remain
// separate even where their numeric values happen to agree: combining them
// could silently tie together independently versioned rendering behaviours.
// Keep every number, expression order and seeded RNG call unchanged.
var RELATIONSHIP_TUNING=Object.freeze({
  legacy:Object.freeze({
    mediumDistanceSnap:.2,          // Pull medium elements toward quantised hero distances.
    smallDistanceSnap:.12,          // Keep smaller elements comparatively free.
    orbitDistanceSnapBoost:1.35,    // Strengthen radial family structure in ORBIT.
    monumentDistanceSnapScale:.75, // Weaken snapping near a MONUMENT hero.
    edgeDistanceSnapScale:.7,      // Avoid over-constraining the EDGE strategy.
    mediumSnapChance:.72,          // Probability a medium element gets moved.
    smallSnapChance:.48,           // Probability a small element gets moved.
    mediumAngleAlignment:.46,      // Orientation attraction for medium marks.
    smallAngleAlignment:.26,       // Orientation attraction for smaller marks.
    orbitDiagonalAngleBoost:.14,   // Extra alignment for ORBIT/DIAGONAL.
    smallAlternateColourChance:.72,// Chance of retaining family's colour on small marks.
    mediumRelationStrength:.78,    // Metadata strength for medium-family members.
    smallRelationStrength:.48,     // Metadata strength for smaller family members.
    mediumScoreWeight:1.45,       // Contribution of medium marks to relationship fit.
    smallScoreWeight:.7,          // Contribution of smaller marks to relationship fit.
    distanceFitWeight:1.8,        // Preference for φ-quantised hero distances.
    angleFitWeight:.9,            // Preference for hero-aligned rotations.
    relationshipScoreWeight:34,   // Total contribution to candidate layout score.
    baselinePhiPull:.45          // Existing base strength of the relationship score.
  }),
  v3:Object.freeze({
    mediumDistanceSnap:.30,         // Stronger V3 medium-distance attraction.
    smallDistanceSnap:.18,          // Stronger V3 small-distance attraction.
    orbitDistanceSnapBoost:1.35,    // V3 orbit-specific attraction.
    monumentDistanceSnapScale:.78, // V3 monument-specific attraction.
    edgeDistanceSnapScale:.72,     // V3 edge-specific attraction.
    mediumSnapChance:.84,          // V3 probability of snapping medium marks.
    smallSnapChance:.62,           // V3 probability of snapping small marks.
    mediumAngleAlignment:.46,      // V3 medium rotation alignment.
    smallAngleAlignment:.26,       // V3 small rotation alignment.
    orbitDiagonalAngleBoost:.14,   // V3 extra attraction for ORBIT/DIAGONAL.
    mediumRelationStrength:.84,    // V3 metadata for medium-family members.
    smallRelationStrength:.56,     // V3 metadata for smaller family members.
    mediumScoreWeight:1.45,       // V3 emphasis on medium mark relationships.
    smallScoreWeight:.7,          // V3 emphasis on smaller mark relationships.
    distanceFitWeight:1.95,       // V3 reward for φ-quantised distances.
    angleFitWeight:1.05,          // V3 reward for compatible orientations.
    relationshipScoreWeight:36,   // V3 final influence on layout selection.
    baselinePhiPull:.45          // V3 relationship score baseline at low φ pull.
  })
});

// Per-strategy placement and V4 spiral geometry calibration. These values
// encode deliberate visual judgement; only A.PHI/A.INV/A.GOLD and their
// formulae are mathematically derived. Similar values in other subsystems
// are intentionally independent. Do not change old renderer output or RNG.
var STRATEGY_GEOMETRY_TUNING=Object.freeze({
  strategy:Object.freeze({
    tensionHeroPull:.72,          // Guide distant heroes toward opposing φ targets.
    orbitPull:.48,                // Attraction of marks to the intended orbit.
    edgeTargetInsetPx:38,        // EDGE strategy's preferred distance from the border.
    edgePull:.38,                // Attraction toward that border.
    monumentHeroPull:.68,        // Place MONUMENT hero closer to its φ focal target.
    monumentSatelliteX:.62,     // Horizontal centre of MONUMENT supporting marks.
    monumentSatelliteY:.58,     // Vertical centre of MONUMENT supporting marks.
    monumentSatellitePull:.12,  // Keep those supporting marks loosely positioned.
    diagonalPull:.42            // Align marks with diagonal flow.
  }),
  spiralV4:Object.freeze({
    indexOffset:.65,             // Avoid starting the spiral at exact zero progress.
    attemptIndexShift:.17,       // Different point placement on retry.
    normalizedProgressFloor:.02,// Keep progress strictly above zero.
    turns:2.35,                  // Number of turns in the logarithmic spiral.
    maxRadiusFraction:.43,      // Maximum canvas-relative spiral radius.
    attemptGoldenPhase:.035     // Phase nudge in units of the golden angle.
  }),
  candidate:Object.freeze({
    retryCellStride:5,           // Change the selected spatial cell with each retry.
    legacyRetryIndexShift:.28,  // Pre-V4 placement adjustment for retries.
    legacyRetryGoldenPhase:.23,// Pre-V4 phase adjustment (golden-angle units).
    spiralInfluenceLimit:.78,   // Limit the spiral control's share of the position.
    territoryMixMin:.16,       // Cell-mixing at low crowding.
    territoryMixMax:.9,        // Cell-mixing at high crowding.
    heroTerritoryMix:.62,      // Give dominant marks more freedom from cells.
    smallTerritoryMix:1.08,   // Bind small marks slightly more to their cells.
    maximumFreeJitterPx:36    // Additional unquantised position drift at weak φ pull.
  })
});

// Constructed Forms artistic calibration, not mathematical φ constants.
// The six variant layouts retain their separate visual personalities;
// shared shape/style/size numbers are frozen to preserve V1–V7 art.
// Fibonacci bases 34 and 55 and exact A.PHI/A.GOLD remain in formulas.
var CONSTRUCTED_TUNING=Object.freeze({
  density:Object.freeze({
    minimumItems:7,                // Spare design at low element counts.
    maximumItems:34,               // Cap geometric collage complexity.
    baseItems:7,                   // Initial shapes before controls.
    elementsGain:.15,              // Additional shapes per Elements setting.
    complexityGain:.075            // Additional shapes per Complexity setting.
  }),
  style:Object.freeze({
    maximumCurveBias:12,           // Keep shapes crisp and constructed.
    maximumWobble:16,              // Limit hand jitter on geometry.
    maximumOverdraw:4,             // Restrict repeated marks.
    ghostThicknessFraction:.58,    // Lighter auxiliary geometric guides.
    ghostOpacityFloor:18,         // Prevent guide lines disappearing.
    ghostOpacityFraction:.58,      // Fade construction guides relative to marks.
    ghostOverdrawFraction:.65      // Keep guides cleaner than finished forms.
  }),
  size:Object.freeze({
    heroMinimumPx:170,             // Keep focal geometry visually dominant.
    smallMaximumPx:150,            // Supporting shapes stay subordinate.
    minimumPx:24,                  // Universal shape size floor.
    cropMaximumPx:470,             // Allow CROP shapes off canvas.
    normalMaximumPx:390           // Tighter bounds in other variants.
  }),
  mark:Object.freeze({
    randomRatioMinimum:1.12,       // Lower aspect ratio before φ pull.
    randomRatioMaximum:1.92,       // Upper aspect ratio before φ pull.
    lineHalfSizeFraction:.72,      // Half-length of a constructed line.
    heroAccentBaseChance:.48,      // Chance of nesting within a hero.
    heroAccentNestingDivisor:250, // Nesting control's addition to chance.
    innerArcRadiusFraction:.52,    // Inner accent arc relative to φ size.
    innerRectangleGoldenOffset:.18 // Orientation of rectangular accent.
  }),
  finish:Object.freeze({
    uncroppedInsetPx:18,           // Protect canvas border except in CROP.
    guideBaseChance:.28,          // Chance to draw construction guide lines.
    guideComplexityDivisor:260    // Extra guide frequency from Complexity.
  })
});

// Automatic Marks / Scribble calibration is deliberately expressive.
// These original choices control gestures, anchors and ghost ink; they
// are not exact golden-ratio identities. Preserve all V1–V7 draws, seeds,
// RNG consumption and the five distinct Scribble compositions.
var SCRIBBLE_TUNING=Object.freeze({
  composition:Object.freeze({
    minimumSegments:12,             // Minimum gestural line count.
    sparseSegmentMultiplier:1.8,    // Lengthen gestures in less crowded drawings.
    crowdedSegmentMultiplier:1.16,  // Keep dense canvases from filling entirely.
    anchorMinimum:2,                // Minimum focal gesture centres.
    anchorMaximum:7,                // Maximum focal gesture centres.
    anchorBase:2,                   // Base centre count before complexity and crowd.
    complexityPerAnchor:28,         // Complexity increment that adds an anchor.
    crowdedAnchorGain:1.5,         // Additional centres when more crowded.
    duetAnchorCount:2,             // DUET keeps exactly two call-and-response gestures.
    knotMaximumAnchors:3,          // KNOT stays concentrated.
    clusterMinimumAnchors:4,       // CLUSTERS favours multiple territories.
    nonVoidNegativeSpaceTrigger:24 // Extra protected voids for non-VOID variants.
  }),
  portrait:Object.freeze({
    rhythmStart:.17,               // Leading part of portrait vertical anchor rhythm.
    rhythmSpan:.66,                // Vertical span of portrait anchors.
    duetHorizontalPull:.82,       // Keep DUET near opposing φ columns.
    otherHorizontalPull:.67,      // Gentler x alignment for other variants.
    verticalPull:.85,             // Keep anchors in the portrait rhythm.
    fallbackStart:.12,            // Alternative y when protected void blocks anchor.
    fallbackSpan:.74              // Range of alternative y positions.
  }),
  ink:Object.freeze({
    minimumWobble:44,             // Preserve loose felt-tip character.
    minimumCurveBias:58,          // Avoid machine-straight drawn gestures.
    minimumOverdraw:2,            // Rework the main marks at least twice.
    ghostThicknessScale:.58,     // Ghost connection strokes stay narrower.
    ghostOpacityFloor:15,        // Minimum visibility for ghost strokes.
    ghostOpacityScale:.52,       // Ghost ink stays fainter than the marks.
    ghostOverdrawScale:.55       // More restrained layering for ghost strokes.
  }),
  anchors:Object.freeze({
    canvasInsetPx:30,             // Keep anchor centres away from the edge.
    minimumRadiusPx:68,          // Gesture territories cannot collapse.
    radiusDensityMin:.36,       // Territory radius at low Density.
    radiusDensityMax:.58,       // Territory radius at high Density.
    portraitRadiusWidthCap:.35, // Keep long-format gestures within the narrow axis.
    portraitKnotRadiusScale:1.12,// KNOT remains a tighter focal arrangement.
    portraitOtherRadiusScale:1.38 // Other gestures can breathe vertically.
  })
});

// Original Automatic Marks gesture-walk calibration. These numbers tune
// expressive stroke motion, spacing, restarts and secondary details;
// none are mathematical φ identities. Keep the precise calculations,
// branch order and seeded random draws for all archived renderer versions.
var SCRIBBLE_STROKE_TUNING=Object.freeze({
  motion:Object.freeze({
    knotStartingRadius:.12,       // Begin KNOT strokes near their focal point.
    otherStartingRadius:.2,       // Begin other gestures a little farther out.
    minimumRunLength:3,           // Lowest number of strokes in an ink run.
    firstRunLong:8,               // Initial run length at low complexity.
    firstRunShort:4,              // Initial run length at high complexity.
    ribbonFlowMix:.72,           // Bias RIBBON strokes toward anchor flow.
    clusterFlowMix:.28,          // Leave CLUSTERS locally less constrained.
    otherFlowMix:.46,            // Remaining variants balance both directions.
    goldenTurnLow:.11,           // Golden-angle turning at low complexity.
    goldenTurnHigh:.31,          // Turning at high complexity.
    wobbleTurnLow:.18,           // Sinusoidal direction variation at low wobble.
    wobbleTurnHigh:.48,          // Sinusoidal direction variation at high wobble.
    randomTurnRange:.16,         // Symmetric free-angle jitter per mark.
    knotTurnAmplitude:.58,       // KNOT's additional curl.
    minimumStrokePx:13,          // Random raw segment length (not the Fibonacci grid).
    maximumStrokePx:78,          // Longest raw random segment length.
    crowdedStrokeScale:.76,      // Reduce long strokes as mark density increases.
    densityLengthLow:.9,         // Density multiplier minimum.
    densityLengthHigh:1.15,      // Density multiplier maximum.
    returnPullBase:.34,          // Pull runaway strokes toward their anchor.
    returnPullGain:.42           // Stronger pull farther outside the territory.
  }),
  avoidance:Object.freeze({
    portraitRetryLimit:9,        // More paths around protected voids in portrait.
    landscapeRetryLimit:5,       // Fewer retries in landscape.
    canvasStrokeInsetPx:24       // Constrain drawn stroke endpoints to the page.
  }),
  breaks:Object.freeze({
    spontaneousBreakChance:.035, // Baseline probability of ending a stroke run.
    negativeSpaceBreakDivisor:650,// Increase pauses as blank-space demand rises.
    resetRadiusLow:.08,          // Start a new gesture near its anchor.
    resetRadiusHigh:.42,         // Allow a wider fresh starting position.
    laterRunLong:9,              // New-run length at low complexity.
    laterRunShort:4,             // New-run length at high complexity.
    laterRunJitterLow:-1,        // Random adjustment to a new run length.
    laterRunJitterHigh:2         // Upper adjustment bound (exclusive RNG semantics).
  }),
  embellishment:Object.freeze({
    arcProbabilityScale:.075,    // Occasional ghost ink arc near a stroke end.
    arcMinimumRadiusPx:9,       // Smallest arc before φ quantisation.
    ribbonLinkChance:.58,       // Optional ghost connection between RIBBON anchors.
    haloProbabilityScale:.12,   // Chance of a concentric anchor halo.
    haloMinimumRadiusPx:10      // Minimum halo size.
  })
});

// Growth Systems legacy branching and organic movement calibration.
// These are artist-selected growth limits and gesture preferences, not
// mathematically derived φ values. Keep the branch queue, floating-point
// arithmetic, seeded RNG consumption and original version dispatch intact.
// V7 landscape deliberately reuses the portrait grammar in rotated space.
var ORGANIC_TUNING=Object.freeze({
  style:Object.freeze({
    minimumCurveBias:76,             // Preserve hand-drawn curved branches.
    minimumWobble:42                 // Keep the organic ink slightly irregular.
  }),
  roots:Object.freeze({
    elementsPerAdditionalRoot:58,    // Add independent growth centres as density rises.
    portraitStartHeight:.78,         // First portrait root starts low on the page.
    portraitHeightStep:.17,          // Separate subsequent roots vertically.
    portraitHorizontalPull:.76,      // Attract roots to opposing golden columns.
    portraitVerticalPull:.88,        // Stronger attraction to the lower growth region.
    portraitAngleJitter:.28,         // Small initial angular deviation in portrait.
    landscapeAngleJitter:.55,        // Wider initial direction spread in old landscape.
    portraitLengthMin:.19,           // Trunk length as fraction of tall canvas.
    portraitLengthMax:.28,
    landscapeLengthMinPx:150,        // Old landscape initial branch lengths.
    landscapeLengthMaxPx:300
  }),
  limits:Object.freeze({
    minimumSegments:12,             // Minimum budget for drawn branch segments.
    minimumDepth:3,                 // Floor for recursive branching depth.
    maximumDepth:8,                 // Cap recursion to protect legibility.
    baseDepth:2,                    // Initial depth contribution before Recursion.
    recursionDepthGain:.7,         // Depth response to Recursion control.
    childLengthScaleMin:.9,        // Variation around inverse-φ child length.
    childLengthScaleMax:1.08,
    minimumChildLengthPx:12        // Stop growing imperceptibly short branches.
  }),
  avoidance:Object.freeze({
    portraitRetryLimit:16,          // Search alternate angles to protect blank regions.
    retryAngleBase:.20,            // Golden-angle detour on first retry pair.
    retryAngleGrowth:.12,          // Increase detour on later retry pairs.
    endpointCanvasInsetPx:24,       // Check final clamped segment against voids.
    landscapeVoidTurnScale:.55     // Original landscape's simpler void detour.
  }),
  branches:Object.freeze({
    portraitGuaranteedSplitDepth:2, // First two portrait generations split.
    portraitSplitChance:.52,        // Else chance of two child branches.
    landscapeSplitChance:.35,
    portraitComplexityDivisor:230,  // Complexity contribution to splitting.
    landscapeComplexityDivisor:180,
    portraitTurnMin:.18,           // Angular spread from golden angle.
    portraitTurnMax:.38,
    landscapeTurnMin:.26,
    landscapeTurnMax:.52,
    directionJitter:.12,           // Per-child free angular perturbation.
    portraitUpwardPull:.19         // Bias branches toward the page's upper end.
  }),
  details:Object.freeze({
    budChanceDivisor:180,           // Frequency of occasional branch-end ellipses.
    budMinimumRadiusPx:5           // Minimum bud size before φ-based scaling.
  })
});

// Growth Systems' remaining portrait root fallback priorities and terminal
// bud presentation. All values and their scan order are historical artistic
// calibration, not exact φ identities. Keep y-outer/x-inner fallback search,
// the original branch queue and all RNG choices unchanged.
var ORGANIC_DETAIL_TUNING=Object.freeze({
  fallback:Object.freeze({
    nearLeftX:.22,             // First alternative portrait root column.
    nearRightX:.78,            // Second alternative column.
    centreX:.50,               // Then try the middle of the canvas.
    farLeftX:.12,              // Wider left fallback when voids are large.
    farRightX:.88,             // Wider right fallback.
    firstY:.79,                // First alternative portrait root row.
    secondY:.68,               // Next fallback row, slightly higher.
    thirdY:.88,                // Lower fallback row.
    fourthY:.56                // Final, higher fallback row.
  }),
  bud:Object.freeze({
    radiusDivisor:2,           // Halve the phi-reduced terminal radius.
    paletteForwardOffset:1    // Colour bud with the next palette position.
  })
});

// Connected Fields topology calibration. These original artist-chosen
// network preferences are not derived from φ. Preserve score arithmetic,
// candidate sort stability, edge addition order and all renderer RNG calls.
// Actual φ quantisation remains A.qphi(...,34,...) in networkPhiFit().
var NETWORK_TOPOLOGY_TUNING=Object.freeze({
  search:Object.freeze({
    minimumNeighbours:4,         // Lower bound of the candidate neighbourhood.
    maximumNeighbours:9,         // Upper bound as complexity rises.
    baseNeighbours:4,            // Base connectivity before Complexity.
    complexityPerNeighbour:18,   // Add neighbours with higher Complexity.
    maximumAllowedCrossings:2,   // Crossing tolerance at full Overlap.
    targetLowMultiplier:1.04,    // Sparse network edge target per node.
    targetHighMultiplier:1.68,   // Dense network edge target per node.
    crowdedTargetScale:.8,       // Limit total connections when crowded.
    heroNeighbourLimit:5,       // Candidate neighbours for each hero.
    heroAttachmentLimit:2,      // Supporting links attached to each hero.
    orphanNeighbourLimit:8      // Extra lookup to avoid disconnected nodes.
  }),
  degree:Object.freeze({
    complexityPerExtraDegree:34, // Complexity units granting one extra link.
    heroBaseDegree:4,            // Heroes can become prominent hubs.
    mediumBaseDegree:3,          // Medium shapes have fewer connections.
    mediumExtraDegreeLimit:2,   // Cap extra medium connections.
    smallBaseDegree:2,           // Small nodes stay less connected.
    smallExtraDegreeLimit:1     // Cap extra small connections.
  }),
  score:Object.freeze({
    heroEndpointBonus:1.35,     // Encourage links involving a hero.
    mediumEndpointBonus:.55,    // Encourage links involving a medium node.
    heroPairBonus:1.4,          // Extra reward between two focal nodes.
    canvasLengthScale:.58,     // Falloff of preference for short edges.
    phiFitWeight:2.25,         // Contribution of φ-quantised edge length.
    proximityWeight:1.4,       // Nearest-neighbour rank preference.
    shortEdgeWeight:.85        // Preference for short local edges.
  })
});

// Connected Fields ink and node presentation calibration. The values are
// existing artistic choices, separate from topology and exact φ mathematics.
// Preserve source draw order, RNG calls, palette indexing and V1–V7 output.
var NETWORK_RENDER_TUNING=Object.freeze({
  primary:Object.freeze({
    thicknessSparse:1.12,         // Make focal links slightly more substantial.
    thicknessCrowded:.94,        // Ease line weight on crowded networks.
    opacityCeiling:100,          // Upper opacity bound for structural links.
    opacityScale:1.04,           // Slight prominence for primary links.
    wobbleFloor:8,               // Keep primary lines relatively disciplined.
    wobbleScale:.82              // Preserve some hand movement.
  }),
  secondary:Object.freeze({
    thicknessSparse:.74,         // Subordinate additional links.
    thicknessCrowded:.58,        // Lighter links as crowding grows.
    opacityFloor:18,             // Keep background links faint but visible.
    opacitySparse:.74,           // Ghost ink in sparse networks.
    opacityCrowded:.56,          // Reduce opacity in dense networks.
    wobbleFloor:6,               // Secondary links need less stroke movement.
    wobbleScale:.72
  }),
  nodes:Object.freeze({
    visibleSparse:.84,           // More filled forms where space is available.
    visibleCrowded:.56,          // Fewer node marks when the graph crowds.
    heroChanceFloor:.88,         // Focal nodes remain prominent.
    mediumChanceFloor:.48,       // Medium hierarchy gets intermediate weight.
    smallChanceScale:.7          // Supporting nodes stay visually quiet.
  }),
  rings:Object.freeze({
    heroBaseChance:.46,          // Optional decoration on focal nodes.
    complexityDivisor:250,       // More rings with higher Complexity.
    minimumRadiusPx:12,         // Minimum before φ-shaped concentric mark.
    paletteForwardOffset:2      // Select a companion pen colour for rings.
  })
});

// Old landscape states must retain exactly the same RNG keys as V1–V6.
function randomSettings(s){
  if(s.orientation==='portrait'||!Object.prototype.hasOwnProperty.call(s,'orientation'))return s;
  var original=Object.assign({},s);
  delete original.orientation;
  return original;
}

function crowdFactor(s){
  return A.clamp((s.elements-36)/104,0,1);
}

function overlapAllowance(s){
  return A.clamp(s.overlap/100,0,1);
}

function chooseStrategy(s){
  return STRATEGIES[A.hash(s.seed+'|'+s.mode+'|composition-strategy')%STRATEGIES.length];
}

function enabledShapes(s){
  var a=[];
  if(s.lines)a.push('line');
  if(s.circles)a.push('circle');
  if(s.rectangles)a.push('rect');
  if(s.polygons)a.push('poly');
  if(s.arcs)a.push('arc');
  return a.length?a:['line'];
}

function hierarchyPlan(total,strategy){
  total=Math.max(1,total|0);
  var hero;

  if(strategy==='MONUMENT')hero=HIERARCHY_TUNING.tiers.monumentHeroCount;
  else hero=total>=HIERARCHY_TUNING.tiers.threeHeroesAtCount?HIERARCHY_TUNING.tiers.standardLargeHeroCount:(total>=HIERARCHY_TUNING.tiers.twoHeroesAtCount?HIERARCHY_TUNING.tiers.standardMediumHeroCount:1);

  var medium=Math.max(HIERARCHY_TUNING.tiers.minimumMediumTarget,Math.round(total*(strategy==='MONUMENT'?HIERARCHY_TUNING.tiers.monumentMediumFraction:HIERARCHY_TUNING.tiers.standardMediumFraction)));
  if(hero+medium>total)medium=Math.max(0,total-hero);

  var tiers=[],i;
  for(i=0;i<hero;i++)tiers.push('hero');
  for(i=0;i<medium;i++)tiers.push('medium');
  while(tiers.length<total)tiers.push('small');
  return tiers;
}

function tierScale(tier,strategy){
  if(tier==='hero')return strategy==='MONUMENT'?HIERARCHY_TUNING.scale.monumentHeroMultiplier:HIERARCHY_TUNING.scale.standardHeroMultiplier;
  if(tier==='medium')return 1;
  return strategy==='MONUMENT'?HIERARCHY_TUNING.scale.monumentSmallMultiplier:HIERARCHY_TUNING.scale.standardSmallMultiplier;
}

function baseElementScale(s){
  return 1/Math.sqrt(Math.max(1,s.elements/HIERARCHY_TUNING.scale.elementCountReference));
}

function makeBaseSize(s,tier,r,territory,strategy){
  var scale=baseElementScale(s);
  var density=A.lerp(HIERARCHY_TUNING.size.densityMinFactor,HIERARCHY_TUNING.size.densityMaxFactor,s.density/100);
  var raw=r.range(HIERARCHY_TUNING.size.sampledMinPx,HIERARCHY_TUNING.size.sampledMaxPx)*density*scale*tierScale(tier,strategy);
  var base=Math.max(HIERARCHY_TUNING.size.phiBaseMinimumPx,HIERARCHY_TUNING.size.phiBaseScalePx*scale);
  var size=A.qphi(raw,base,s.phiStrength/100);

  if(tier==='hero')size=Math.max(size,(strategy==='MONUMENT'?HIERARCHY_TUNING.size.monumentHeroMinPx:HIERARCHY_TUNING.size.standardHeroMinPx)*scale);
  if(territory)size=Math.min(size,Math.max(HIERARCHY_TUNING.size.territoryMinPx,territory*A.lerp(HIERARCHY_TUNING.size.territoryFitMin,HIERARCHY_TUNING.size.territoryFitMax,overlapAllowance(s))));

  return A.clamp(size,HIERARCHY_TUNING.size.finalMinPx,strategy==='MONUMENT'?HIERARCHY_TUNING.size.monumentMaxPx:HIERARCHY_TUNING.size.standardMaxPx);
}

function makeReservedVoids(s,strategy,r){
  var strength=A.clamp(s.negativeSpace/100,0,1);
  if(strength<PLACEMENT_TUNING.voids.enableThreshold)return[];

  var cells=A.goldenCells(PLACEMENT_TUNING.voids.sourceCellCount,PLACEMENT_TUNING.voids.sourceCellMarginPx).slice();
  cells.sort(function(a,b){return b.w*b.h-a.w*a.h});

  var count=strength>PLACEMENT_TUNING.voids.secondVoidThreshold?2:1;
  if(strategy==='VOID'&&strength>PLACEMENT_TUNING.voids.voidStrategySecondThreshold)count=2;

  var start=r.int(1,Math.min(PLACEMENT_TUNING.voids.firstCellMaxIndex,cells.length-1));
  var out=[];

  for(var i=0;i<count;i++){
    var c=cells[(start+i*PLACEMENT_TUNING.voids.cellStride)%Math.min(PLACEMENT_TUNING.voids.cellPoolLimit,cells.length)];
    var scale=A.lerp(PLACEMENT_TUNING.voids.scaleMin,PLACEMENT_TUNING.voids.scaleMax,strength)*(strategy==='VOID'?PLACEMENT_TUNING.voids.strategyScaleBoost:1);
    var w=A.clamp(c.w*scale,PLACEMENT_TUNING.voids.widthFloorPx,A.W*PLACEMENT_TUNING.voids.maxCanvasFraction);
    var h=A.clamp(c.h*scale,PLACEMENT_TUNING.voids.heightFloorPx,A.H*PLACEMENT_TUNING.voids.maxCanvasFraction);

    out.push({
      x:A.clamp(c.x+c.w/2-w/2,PLACEMENT_TUNING.voids.edgeInsetPx,A.W-w-PLACEMENT_TUNING.voids.edgeInsetPx),
      y:A.clamp(c.y+c.h/2-h/2,PLACEMENT_TUNING.voids.edgeInsetPx,A.H-h-PLACEMENT_TUNING.voids.edgeInsetPx),
      w:w,h:h
    });
  }

  return out;
}

function pointInVoid(x,y,voids){
  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    if(x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h)return true;
  }
  return false;
}

// Exact segment/rectangle intersection for protected negative space.
// Checking only the endpoints (or a few samples) misses thin crossings.
function segmentCrossesVoid(x1,y1,x2,y2,voids){
  var dx=x2-x1,dy=y2-y1;
  for(var i=0;i<voids.length;i++){
    var v=voids[i],left=v.x,right=v.x+v.w,top=v.y,bottom=v.y+v.h;
    var p=[-dx,dx,-dy,dy];
    var q=[x1-left,right-x1,y1-top,bottom-y1];
    var enter=0,leave=1,miss=false;
    for(var side=0;side<4;side++){
      if(p[side]===0){
        if(q[side]<0){miss=true;break;}
      }else{
        var t=q[side]/p[side];
        if(p[side]<0)enter=Math.max(enter,t);
        else leave=Math.min(leave,t);
        if(enter>leave){miss=true;break;}
      }
    }
    if(!miss)return true;
  }
  return false;
}

function objectVoidPenalty(obj,voids,s){
  if(!voids.length)return 0;

  var radius=obj.size*PLACEMENT_TUNING.voids.markRadiusFraction;
  var pad=A.lerp(PLACEMENT_TUNING.voids.paddingMinPx,PLACEMENT_TUNING.voids.paddingMaxPx,s.negativeSpace/100);
  var total=0;

  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    var cx=A.clamp(obj.x,v.x,v.x+v.w);
    var cy=A.clamp(obj.y,v.y,v.y+v.h);
    var dx=obj.x-cx,dy=obj.y-cy;
    var dist=Math.sqrt(dx*dx+dy*dy);
    var desired=radius+pad;
    if(dist<desired)total+=(desired-dist)/Math.max(1,desired);
  }

  return total;
}

function minDistanceFor(a,b,s){
  var strict=1-overlapAllowance(s);
  var radii=(a.size+b.size)*.5;
  var tierBoost=(a.tier==='hero'||b.tier==='hero')?PLACEMENT_TUNING.collision.heroDistanceBoost:1;
  return radii*A.lerp(PLACEMENT_TUNING.collision.distanceWhenOverlapHigh,PLACEMENT_TUNING.collision.distanceWhenOverlapLow,strict)*tierBoost;
}

function pairPenalty(a,b,s){
  var dx=a.x-b.x,dy=a.y-b.y;
  var dist=Math.sqrt(dx*dx+dy*dy);
  var desired=minDistanceFor(a,b,s);
  if(dist>=desired)return 0;
  return (desired-dist)/Math.max(1,desired);
}

function placementPenalty(obj,placed,s,voids){
  var p=objectVoidPenalty(obj,voids,s)*A.lerp(PLACEMENT_TUNING.collision.voidPenaltyMin,PLACEMENT_TUNING.collision.voidPenaltyMax,s.negativeSpace/100);
  for(var i=0;i<placed.length;i++)p+=pairPenalty(obj,placed[i],s);
  return p;
}

function phiTargets(){
  return[
    {x:A.W*A.INV,y:A.H*A.INV},
    {x:A.W*(1-A.INV),y:A.H*A.INV},
    {x:A.W*A.INV,y:A.H*(1-A.INV)},
    {x:A.W*(1-A.INV),y:A.H*(1-A.INV)}
  ];
}

function applyStrategyPosition(pos,i,total,tier,strategy,s){
  var targets=phiTargets();
  var t,edge,diagY;

  if(strategy==='TENSION'&&tier==='hero'){
    t=targets[i%2===0?0:3];
    pos.x=A.lerp(pos.x,t.x,STRATEGY_GEOMETRY_TUNING.strategy.tensionHeroPull);
    pos.y=A.lerp(pos.y,t.y,STRATEGY_GEOMETRY_TUNING.strategy.tensionHeroPull);
  }else if(strategy==='ORBIT'){
    var orbit=A.rendererVersion>=4
      ?trueGoldenSpiralPointV4(i,total,A.GOLD*.5,0)
      :A.goldenCanvasPoint(i,total,s,A.GOLD*.5);
    pos.x=A.lerp(pos.x,orbit.x,STRATEGY_GEOMETRY_TUNING.strategy.orbitPull);
    pos.y=A.lerp(pos.y,orbit.y,STRATEGY_GEOMETRY_TUNING.strategy.orbitPull);
  }else if(strategy==='EDGE'&&tier!=='hero'){
    edge=i%4;
    if(edge===0)pos.x=A.lerp(pos.x,STRATEGY_GEOMETRY_TUNING.strategy.edgeTargetInsetPx,STRATEGY_GEOMETRY_TUNING.strategy.edgePull);
    if(edge===1)pos.x=A.lerp(pos.x,A.W-STRATEGY_GEOMETRY_TUNING.strategy.edgeTargetInsetPx,STRATEGY_GEOMETRY_TUNING.strategy.edgePull);
    if(edge===2)pos.y=A.lerp(pos.y,STRATEGY_GEOMETRY_TUNING.strategy.edgeTargetInsetPx,STRATEGY_GEOMETRY_TUNING.strategy.edgePull);
    if(edge===3)pos.y=A.lerp(pos.y,A.H-STRATEGY_GEOMETRY_TUNING.strategy.edgeTargetInsetPx,STRATEGY_GEOMETRY_TUNING.strategy.edgePull);
  }else if(strategy==='MONUMENT'){
    if(tier==='hero'){
      t=targets[0];
      pos.x=A.lerp(pos.x,t.x,STRATEGY_GEOMETRY_TUNING.strategy.monumentHeroPull);
      pos.y=A.lerp(pos.y,t.y,STRATEGY_GEOMETRY_TUNING.strategy.monumentHeroPull);
    }else{
      pos.x=A.lerp(pos.x,A.W*STRATEGY_GEOMETRY_TUNING.strategy.monumentSatelliteX,STRATEGY_GEOMETRY_TUNING.strategy.monumentSatellitePull);
      pos.y=A.lerp(pos.y,A.H*STRATEGY_GEOMETRY_TUNING.strategy.monumentSatelliteY,STRATEGY_GEOMETRY_TUNING.strategy.monumentSatellitePull);
    }
  }else if(strategy==='DIAGONAL'){
    var reverse=(A.hash(s.seed+'|diag')%2)===1;
    diagY=(pos.x/A.W)*A.H;
    if(reverse)diagY=A.H-diagY;
    pos.y=A.lerp(pos.y,diagY,STRATEGY_GEOMETRY_TUNING.strategy.diagonalPull);
  }

  return pos;
}

function trueGoldenSpiralPointV4(i,total,phase,attempt){
  total=Math.max(1,total);
  attempt=attempt||0;
  var u=(i+STRATEGY_GEOMETRY_TUNING.spiralV4.indexOffset+attempt*STRATEGY_GEOMETRY_TUNING.spiralV4.attemptIndexShift)/total;
  u=A.clamp(u,STRATEGY_GEOMETRY_TUNING.spiralV4.normalizedProgressFloor,1);
  var turns=STRATEGY_GEOMETRY_TUNING.spiralV4.turns;
  var theta=u*turns*A.TAU;
  var b=2*Math.log(A.PHI)/Math.PI;
  var maxR=STRATEGY_GEOMETRY_TUNING.spiralV4.maxRadiusFraction;
  var minR=maxR/Math.exp(b*turns*A.TAU);
  var radial=minR*Math.exp(b*theta);
  var angle=phase+theta+attempt*A.GOLD*STRATEGY_GEOMETRY_TUNING.spiralV4.attemptGoldenPhase;
  return{x:A.W*.5+Math.cos(angle)*A.W*radial,y:A.H*.5+Math.sin(angle)*A.H*radial,a:angle,rad:radial};
}

function candidatePosition(i,total,s,r,tier,distributed,phase,attempt,strategy){
  var d=distributed[(i+attempt*STRATEGY_GEOMETRY_TUNING.candidate.retryCellStride)%distributed.length];
  var spiral=A.rendererVersion>=4
    ?trueGoldenSpiralPointV4(i,total,phase,attempt)
    :A.goldenCanvasPoint(i+attempt*STRATEGY_GEOMETRY_TUNING.candidate.legacyRetryIndexShift,total,s,phase+attempt*A.GOLD*STRATEGY_GEOMETRY_TUNING.candidate.legacyRetryGoldenPhase);
  var phi=A.phiPoint(s,r);
  var spiralMix=A.clamp(s.spiralInfluence/100,0,1);
  var x=A.lerp(phi.x,spiral.x,spiralMix*STRATEGY_GEOMETRY_TUNING.candidate.spiralInfluenceLimit);
  var y=A.lerp(phi.y,spiral.y,spiralMix*STRATEGY_GEOMETRY_TUNING.candidate.spiralInfluenceLimit);

  var crowd=crowdFactor(s);
  var distributionMix=A.lerp(STRATEGY_GEOMETRY_TUNING.candidate.territoryMixMin,STRATEGY_GEOMETRY_TUNING.candidate.territoryMixMax,crowd);
  if(tier==='hero')distributionMix*=STRATEGY_GEOMETRY_TUNING.candidate.heroTerritoryMix;
  if(tier==='small')distributionMix=Math.min(1,distributionMix*STRATEGY_GEOMETRY_TUNING.candidate.smallTerritoryMix);

  var pos={
    x:A.lerp(x,d.x,distributionMix),
    y:A.lerp(y,d.y,distributionMix),
    territory:d.territory
  };

  pos=applyStrategyPosition(pos,i,total,tier,strategy,s);

  var freedom=(1-s.phiStrength/100)*STRATEGY_GEOMETRY_TUNING.candidate.maximumFreeJitterPx;
  pos.x+=r.range(-freedom,freedom);
  pos.y+=r.range(-freedom,freedom);

  return pos;
}

function makeLayoutPlan(s,seedSuffix,strategy,voids){
  var r=A.makeR(s.seed+'|'+JSON.stringify(randomSettings(s))+'|layout|'+seedSuffix+'|'+strategy);
  var tiers=hierarchyPlan(s.elements,strategy);
  var distributed=A.distributedPhiPoints(s.elements,s,r);
  var phase=r.range(0,A.TAU);
  var placed=[];

  for(var i=0;i<tiers.length;i++){
    var tier=tiers[i];
    var best=null,bestPenalty=Infinity;
    var tries=tier==='hero'?PLACEMENT_TUNING.search.heroPlacementTries:PLACEMENT_TUNING.search.otherPlacementTries;

    for(var t=0;t<tries;t++){
      var pos=candidatePosition(i,tiers.length,s,r,tier,distributed,phase,t,strategy);
      var shrink=1-Math.min(PLACEMENT_TUNING.search.shrinkLimit,t*PLACEMENT_TUNING.search.shrinkPerAttempt)*(1-overlapAllowance(s));
      var obj={
        tier:tier,
        x:A.clamp(pos.x,PLACEMENT_TUNING.search.elementEdgeInsetPx,A.W-PLACEMENT_TUNING.search.elementEdgeInsetPx),
        y:A.clamp(pos.y,PLACEMENT_TUNING.search.elementEdgeInsetPx,A.H-PLACEMENT_TUNING.search.elementEdgeInsetPx),
        size:makeBaseSize(s,tier,r,pos.territory,strategy)*shrink,
        rot:r.range(0,A.TAU)*(s.rotation/100),
        territory:pos.territory
      };

      var penalty=placementPenalty(obj,placed,s,voids);
      if(penalty<bestPenalty){
        bestPenalty=penalty;
        best=obj;
      }
      if(penalty<PLACEMENT_TUNING.search.acceptablePenalty)break;
    }

    if(best)placed.push(best);
  }

  return placed;
}

function nearestHeroIndex(layout,index){
  var item=layout[index],best=-1,bestDist=Infinity;
  for(var i=0;i<layout.length;i++){
    if(layout[i].tier!=='hero')continue;
    var dx=item.x-layout[i].x,dy=item.y-layout[i].y;
    var d=dx*dx+dy*dy;
    if(d<bestDist){bestDist=d;best=i}
  }
  return best;
}

function reinforceFieldRelationships(layout,s,strategy){
  if(!layout.length)return layout;

  var heroIndices=[];
  for(var h=0;h<layout.length;h++){
    layout[h]._fieldIndex=h;
    if(layout[h].tier==='hero')heroIndices.push(h);
  }
  if(!heroIndices.length)return layout;

  var relationR=A.makeR(s.seed+'|field-relationships|'+strategy);

  for(var i=0;i<layout.length;i++){
    var item=layout[i];

    if(item.tier==='hero'){
      item.family=heroIndices.indexOf(i);
      item.colourIndex=item.family;
      item.relationStrength=1;
      continue;
    }

    var heroIndex=nearestHeroIndex(layout,i);
    if(heroIndex<0)continue;

    var hero=layout[heroIndex];
    var family=heroIndices.indexOf(heroIndex);
    var dx=item.x-hero.x,dy=item.y-hero.y;
    var distance=Math.max(1,Math.sqrt(dx*dx+dy*dy));
    var radial=Math.atan2(dy,dx);
    var desired=A.qphi(distance,34,1);
    var snap=item.tier==='medium'?RELATIONSHIP_TUNING.legacy.mediumDistanceSnap:RELATIONSHIP_TUNING.legacy.smallDistanceSnap;

    if(strategy==='ORBIT')snap*=RELATIONSHIP_TUNING.legacy.orbitDistanceSnapBoost;
    if(strategy==='MONUMENT')snap*=RELATIONSHIP_TUNING.legacy.monumentDistanceSnapScale;
    if(strategy==='EDGE')snap*=RELATIONSHIP_TUNING.legacy.edgeDistanceSnapScale;

    if(relationR.chance(item.tier==='medium'?RELATIONSHIP_TUNING.legacy.mediumSnapChance:RELATIONSHIP_TUNING.legacy.smallSnapChance)){
      var adjusted=A.lerp(distance,desired,snap);
      item.x=A.clamp(hero.x+Math.cos(radial)*adjusted,28,A.W-28);
      item.y=A.clamp(hero.y+Math.sin(radial)*adjusted,28,A.H-28);
    }

    var targetRot=radial;
    if(strategy==='ORBIT')targetRot=radial+Math.PI/2;
    else if(strategy==='DIAGONAL')targetRot=(A.hash(s.seed+'|diag')%2)===1?-Math.PI/4:Math.PI/4;
    else if(strategy==='MONUMENT')targetRot=hero.rot;

    var align=item.tier==='medium'?RELATIONSHIP_TUNING.legacy.mediumAngleAlignment:RELATIONSHIP_TUNING.legacy.smallAngleAlignment;
    if(strategy==='ORBIT'||strategy==='DIAGONAL')align+=RELATIONSHIP_TUNING.legacy.orbitDiagonalAngleBoost;
    item.rot=A.lerp(item.rot,targetRot,align);

    item.family=Math.max(0,family);
    item.colourIndex=item.tier==='medium'
      ?item.family
      :(item.family+(relationR.chance(RELATIONSHIP_TUNING.legacy.smallAlternateColourChance)?0:1));
    item.relationStrength=item.tier==='medium'?RELATIONSHIP_TUNING.legacy.mediumRelationStrength:RELATIONSHIP_TUNING.legacy.smallRelationStrength;
  }

  return layout;
}

function fieldRelationshipScore(layout,s,strategy){
  var heroes=layout.filter(function(o){return o.tier==='hero'});
  if(!heroes.length)return 0;

  var score=0,count=0;
  for(var i=0;i<layout.length;i++){
    var item=layout[i];
    if(item.tier==='hero')continue;

    var nearest=null,best=Infinity;
    for(var h=0;h<heroes.length;h++){
      var dx=item.x-heroes[h].x,dy=item.y-heroes[h].y;
      var d=Math.sqrt(dx*dx+dy*dy);
      if(d<best){best=d;nearest=heroes[h]}
    }
    if(!nearest)continue;

    var quant=A.qphi(best,34,1);
    var distanceFit=1-A.clamp(Math.abs(best-quant)/Math.max(1,quant),0,1);
    var radial=Math.atan2(item.y-nearest.y,item.x-nearest.x);
    var targetRot=radial;
    if(strategy==='ORBIT')targetRot=radial+Math.PI/2;
    else if(strategy==='DIAGONAL')targetRot=(A.hash(s.seed+'|diag')%2)===1?-Math.PI/4:Math.PI/4;
    else if(strategy==='MONUMENT')targetRot=nearest.rot;
    var delta=Math.abs(Math.atan2(Math.sin(item.rot-targetRot),Math.cos(item.rot-targetRot)));
    var alignment=1-A.clamp(delta/Math.PI,0,1);
    var weight=item.tier==='medium'?RELATIONSHIP_TUNING.legacy.mediumScoreWeight:RELATIONSHIP_TUNING.legacy.smallScoreWeight;

    score+=(distanceFit*RELATIONSHIP_TUNING.legacy.distanceFitWeight+alignment*RELATIONSHIP_TUNING.legacy.angleFitWeight)*weight;
    count+=weight;
  }

  if(!count)return 0;
  return score/count*RELATIONSHIP_TUNING.legacy.relationshipScoreWeight*(RELATIONSHIP_TUNING.legacy.baselinePhiPull+s.phiStrength/180);
}

function visualWeight(obj,s){
  var tier=obj.tier==='hero'?ORBITAL_SELECTION_TUNING.mass.heroWeight:(obj.tier==='medium'?1:ORBITAL_SELECTION_TUNING.mass.smallWeight);
  return obj.size*obj.size*tier*(ORBITAL_SELECTION_TUNING.mass.thicknessBaseline+s.thickness/ORBITAL_SELECTION_TUNING.mass.thicknessDivisor)*(ORBITAL_SELECTION_TUNING.mass.opacityBaseline+s.opacity/ORBITAL_SELECTION_TUNING.mass.opacityDivisor);
}

function strategyScore(layout,s,strategy,voids){
  var score=0,i,dx,dy;
  var targets=phiTargets();
  var heroes=layout.filter(function(o){return o.tier==='hero'});

  if(strategy==='VOID'){
    for(i=0;i<layout.length;i++)score-=objectVoidPenalty(layout[i],voids,s)*LAYOUT_TUNING.strategy.voidPenaltyWeight;
    score+=voids.length*LAYOUT_TUNING.strategy.voidRegionReward;
  }else if(strategy==='TENSION'&&heroes.length>1){
    dx=heroes[0].x-heroes[1].x;
    dy=heroes[0].y-heroes[1].y;
    score+=Math.sqrt(dx*dx+dy*dy)/Math.hypot(A.W,A.H)*LAYOUT_TUNING.strategy.tensionSeparationWeight;
  }else if(strategy==='ORBIT'){
    var phase=A.GOLD*.5;
    for(i=0;i<layout.length;i++){
      var gp=A.rendererVersion>=4
        ?trueGoldenSpiralPointV4(i,layout.length,phase,0)
        :A.goldenCanvasPoint(i,layout.length,s,phase);
      dx=layout[i].x-gp.x;dy=layout[i].y-gp.y;
      score+=Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/LAYOUT_TUNING.strategy.orbitMatchDistancePx)*LAYOUT_TUNING.strategy.orbitMatchWeight;
    }
  }else if(strategy==='EDGE'){
    var edge=0;
    for(i=0;i<layout.length;i++){
      if(layout[i].x<A.W*LAYOUT_TUNING.strategy.edgeOuterBandLow||layout[i].x>A.W*LAYOUT_TUNING.strategy.edgeOuterBandHigh||layout[i].y<A.H*LAYOUT_TUNING.strategy.edgeOuterBandLow||layout[i].y>A.H*LAYOUT_TUNING.strategy.edgeOuterBandHigh)edge++;
    }
    score+=edge/layout.length*LAYOUT_TUNING.strategy.edgeBonusWeight;
  }else if(strategy==='MONUMENT'&&heroes.length){
    var avg=0;
    for(i=0;i<layout.length;i++)avg+=layout[i].size;
    avg/=layout.length;
    score+=Math.min(LAYOUT_TUNING.strategy.monumentHeroBonusCap,(heroes[0].size/Math.max(1,avg))*LAYOUT_TUNING.strategy.monumentHeroScaleWeight);
  }else if(strategy==='DIAGONAL'){
    var reverse=(A.hash(s.seed+'|diag')%2)===1;
    for(i=0;i<layout.length;i++){
      var expected=(layout[i].x/A.W)*A.H;
      if(reverse)expected=A.H-expected;
      score+=Math.max(0,1-Math.abs(layout[i].y-expected)/(A.H*ORBITAL_SELECTION_TUNING.score.diagonalToleranceHeightFraction));
    }
    score=score/layout.length*LAYOUT_TUNING.strategy.diagonalAlignmentWeight;
  }else{
    var cx=0,cy=0;
    for(i=0;i<layout.length;i++){cx+=layout[i].x;cy+=layout[i].y}
    cx/=layout.length;cy/=layout.length;
    dx=cx-A.W*.5;dy=cy-A.H*.5;
    score+=Math.max(0,LAYOUT_TUNING.strategy.balancedCentreBonus-Math.sqrt(dx*dx+dy*dy)/LAYOUT_TUNING.strategy.balancedDistanceDivisorPx);
  }

  return score;
}

function scoreLayout(layout,s,strategy,voids){
  if(!layout.length)return-1e9;

  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  var collision=0,totalWeight=0,wx=0,wy=0;
  var edgeHits=0,heroSpread=0,heroes=[];
  var voidPenalty=0;

  for(var i=0;i<layout.length;i++){
    var a=layout[i],half=a.size*.5;
    minX=Math.min(minX,a.x-half);
    minY=Math.min(minY,a.y-half);
    maxX=Math.max(maxX,a.x+half);
    maxY=Math.max(maxY,a.y+half);

    var w=visualWeight(a,s);
    totalWeight+=w;
    wx+=a.x*w;
    wy+=a.y*w;

    if(a.x<A.W*LAYOUT_TUNING.layout.edgeOccupancyBandLow||a.x>A.W*LAYOUT_TUNING.layout.edgeOccupancyBandHigh||a.y<A.H*LAYOUT_TUNING.layout.edgeOccupancyBandLow||a.y>A.H*LAYOUT_TUNING.layout.edgeOccupancyBandHigh)edgeHits++;
    if(a.tier==='hero')heroes.push(a);
    voidPenalty+=objectVoidPenalty(a,voids,s);

    for(var j=i+1;j<layout.length;j++)collision+=pairPenalty(a,layout[j],s);
  }

  for(var h=0;h<heroes.length;h++){
    for(var k=h+1;k<heroes.length;k++){
      var hdx=heroes[h].x-heroes[k].x,hdy=heroes[h].y-heroes[k].y;
      heroSpread+=Math.sqrt(hdx*hdx+hdy*hdy)/Math.hypot(A.W,A.H);
    }
  }

  var coverageX=A.clamp((maxX-minX)/A.W,0,1);
  var coverageY=A.clamp((maxY-minY)/A.H,0,1);
  var coverage=(coverageX+coverageY)*LAYOUT_TUNING.layout.coverageWeight;

  var edgeTarget=strategy==='EDGE'?LAYOUT_TUNING.layout.edgePreferredForEdge:(LAYOUT_TUNING.layout.edgePreferredBase+LAYOUT_TUNING.layout.edgePreferredCrowdGain*crowdFactor(s));
  var edgeRatio=edgeHits/layout.length;
  var edgeScore=LAYOUT_TUNING.layout.edgeBaselineScore-Math.abs(edgeRatio-edgeTarget)*LAYOUT_TUNING.layout.edgeDeviationPenalty;

  var cx=wx/Math.max(1,totalWeight),cy=wy/Math.max(1,totalWeight);
  var targets=phiTargets();
  var bestPhi=Infinity;

  for(var p=0;p<targets.length;p++){
    var dx=targets[p].x-cx,dy=targets[p].y-cy;
    bestPhi=Math.min(bestPhi,Math.sqrt(dx*dx+dy*dy));
  }

  var diag=Math.hypot(A.W,A.H);
  var phiScore=(1-bestPhi/diag)*LAYOUT_TUNING.layout.phiCentroidWeight*(s.phiStrength/100);
  var collisionPenalty=collision*A.lerp(ORBITAL_SELECTION_TUNING.score.collisionPenaltyLowOverlap,ORBITAL_SELECTION_TUNING.score.collisionPenaltyHighOverlap,overlapAllowance(s));
  var hierarchyScore=heroes.length>1?heroSpread*LAYOUT_TUNING.layout.heroSeparationWeight:LAYOUT_TUNING.layout.singleHeroHierarchyBonus;
  var reservedPenalty=voidPenalty*A.lerp(ORBITAL_SELECTION_TUNING.score.voidPenaltyLowNegativeSpace,ORBITAL_SELECTION_TUNING.score.voidPenaltyHighNegativeSpace,s.negativeSpace/100);

  return coverage+edgeScore+phiScore+hierarchyScore+strategyScore(layout,s,strategy,voids)-collisionPenalty-reservedPenalty;
}

function chooseBestLayout(s){
  var strategy=chooseStrategy(s);
  var voidR=A.makeR(s.seed+'|'+s.mode+'|voids|'+strategy);
  var voids=makeReservedVoids(s,strategy,voidR);
  var candidates=s.elements>ORBITAL_SELECTION_TUNING.candidates.highCountThreshold?ORBITAL_SELECTION_TUNING.candidates.highCountBudget:ORBITAL_SELECTION_TUNING.candidates.standardBudget;
  var best=null,bestScore=-Infinity;

  for(var i=0;i<candidates;i++){
    var layout=makeLayoutPlan(s,i,strategy,voids);
    layout=reinforceFieldRelationships(layout,s,strategy);
    var score=scoreLayout(layout,s,strategy,voids)+fieldRelationshipScore(layout,s,strategy);
    if(score>bestScore){
      bestScore=score;
      best=layout;
    }
  }

  return{layout:best||[],strategy:strategy,voids:voids,score:bestScore};
}

function drawPlannedElement(ctx,plan,i,s,r,pal,strategy){
  var sh=r.chance(s.shapeAmount/100)?r.pick(enabledShapes(s)):'line';
  var c={x:plan.x,y:plan.y};
  var size=plan.size;
  var rot=plan.rot;
  var colourIndex=Number.isInteger(plan.colourIndex)?plan.colourIndex:i;
  var col=pal[((colourIndex%pal.length)+pal.length)%pal.length];
  var ratio=A.lerp(r.range(.65,1.68),A.PHI,s.phiStrength/100);
  var tierFactor=s.mode==='field'?(plan.tier==='hero'?1.62:(plan.tier==='small'?.76:1)):1;
  var drawSettings=Object.assign({},s,{
    thickness:A.clamp(Math.round(s.thickness*tierFactor),1,28)
  });

  if(sh==='line'){
    var a={x:c.x-Math.cos(rot)*size/2,y:c.y-Math.sin(rot)*size/2};
    var b={x:c.x+Math.cos(rot)*size/2,y:c.y+Math.sin(rot)*size/2};
    A.drawLine(ctx,a,b,col,drawSettings,r);
  }else if(sh==='circle'){
    A.ellipse(ctx,c,size/2,size/(2*ratio),rot,col,drawSettings,r);
  }else if(sh==='rect'){
    A.rect(ctx,c,size,size/ratio,rot,col,drawSettings,r);
  }else if(sh==='poly'){
    A.poly(ctx,c,size/2,r.pick([3,5,8]),rot,col,drawSettings,r);
  }else{
    A.arc(ctx,c,size/2,rot,A.TAU*r.pick([A.INV,1-A.INV,.5,.75]),col,drawSettings,r);
  }

  var nest=(s.nesting/160)*A.lerp(1,.65,crowdFactor(s));
  if(plan.tier==='hero')nest*=1.24;
  if(plan.tier==='small')nest*=.66;

  if(r.chance(nest)){
    var nestedIndex=Number.isInteger(plan.colourIndex)?plan.colourIndex+1:i+1;
    var nc=pal[((nestedIndex%pal.length)+pal.length)%pal.length],n=size/A.PHI;
    if(sh==='rect'){
      A.rect(ctx,c,n,n/A.PHI,rot+A.GOLD,nc,drawSettings,r);
    }else if(sh==='circle'){
      A.ellipse(ctx,c,n/2,n/(2*A.PHI),rot+A.GOLD,nc,drawSettings,r);
    }else if(sh==='poly'){
      A.poly(ctx,c,n/2,5,rot+A.GOLD,nc,drawSettings,r);
    }
  }
}

function chooseBestLayoutLegacy(s){
  var strategy=chooseStrategy(s);
  var voidR=A.makeR(s.seed+'|'+s.mode+'|voids|'+strategy);
  var voids=makeReservedVoids(s,strategy,voidR);
  var candidates=s.elements>ORBITAL_SELECTION_TUNING.candidates.highCountThreshold?ORBITAL_SELECTION_TUNING.candidates.highCountBudget:ORBITAL_SELECTION_TUNING.candidates.standardBudget;
  var best=null,bestScore=-Infinity;

  for(var i=0;i<candidates;i++){
    var layout=makeLayoutPlan(s,i,strategy,voids);
    var score=scoreLayout(layout,s,strategy,voids);
    if(score>bestScore){
      bestScore=score;
      best=layout;
    }
  }

  return{layout:best||[],strategy:strategy,voids:voids,score:bestScore};
}

function drawPlannedElementLegacy(ctx,plan,i,s,r,pal,strategy){
  var sh=r.chance(s.shapeAmount/100)?r.pick(enabledShapes(s)):'line';
  var c={x:plan.x,y:plan.y};
  var size=plan.size;
  var rot=plan.rot;
  var col=pal[i%pal.length];
  var ratio=A.lerp(r.range(.65,1.68),A.PHI,s.phiStrength/100);

  if(sh==='line'){
    var a={x:c.x-Math.cos(rot)*size/2,y:c.y-Math.sin(rot)*size/2};
    var b={x:c.x+Math.cos(rot)*size/2,y:c.y+Math.sin(rot)*size/2};
    A.drawLine(ctx,a,b,col,s,r);
  }else if(sh==='circle'){
    A.ellipse(ctx,c,size/2,size/(2*ratio),rot,col,s,r);
  }else if(sh==='rect'){
    A.rect(ctx,c,size,size/ratio,rot,col,s,r);
  }else if(sh==='poly'){
    A.poly(ctx,c,size/2,r.pick([3,5,8]),rot,col,s,r);
  }else{
    A.arc(ctx,c,size/2,rot,A.TAU*r.pick([A.INV,1-A.INV,.5,.75]),col,s,r);
  }

  var nest=(s.nesting/160)*A.lerp(1,.65,crowdFactor(s));
  if(plan.tier==='hero')nest*=1.24;
  if(plan.tier==='small')nest*=.66;

  if(r.chance(nest)){
    var nc=pal[(i+1)%pal.length],n=size/A.PHI;
    if(sh==='rect'){
      A.rect(ctx,c,n,n/A.PHI,rot+A.GOLD,nc,s,r);
    }else if(sh==='circle'){
      A.ellipse(ctx,c,n/2,n/(2*A.PHI),rot+A.GOLD,nc,s,r);
    }else if(sh==='poly'){
      A.poly(ctx,c,n/2,5,rot+A.GOLD,nc,s,r);
    }
  }
}

function drawFieldLegacy(ctx,s,r,pal){
  var result=chooseBestLayoutLegacy(s);
  for(var i=0;i<result.layout.length;i++){
    drawPlannedElementLegacy(ctx,result.layout[i],i,s,r,pal,result.strategy);
  }
  result.guide={type:'layout',layout:result.layout};
  return result;
}

function drawField(ctx,s,r,pal){
  var result=chooseBestLayout(s);
  var tierRank={small:0,medium:1,hero:2};
  var ordered=result.layout.slice().sort(function(a,b){
    var tierDelta=tierRank[a.tier]-tierRank[b.tier];
    if(tierDelta)return tierDelta;
    return (a._fieldIndex||0)-(b._fieldIndex||0);
  });

  for(var i=0;i<ordered.length;i++){
    var plan=ordered[i];
    var localR=A.makeR(s.seed+'|field-draw|'+result.strategy+'|'+plan._fieldIndex);
    drawPlannedElement(ctx,plan,plan._fieldIndex,s,localR,pal,result.strategy);
  }

  result.guide={type:'layout',layout:result.layout};
  return result;
}


function fieldAngleDeltaV3(from,to,period){
  period=period||A.TAU;
  var half=period/2;
  var delta=(to-from+half)%period;
  if(delta<0)delta+=period;
  return delta-half;
}

function fieldLerpAngleV3(from,to,amount,period){
  return from+fieldAngleDeltaV3(from,to,period)*amount;
}

function fieldShapeV3(s,strategy,index){
  var shapeR=A.makeR(s.seed+'|field-shape-v3|'+strategy+'|'+index);
  return shapeR.chance(s.shapeAmount/100)?shapeR.pick(enabledShapes(s)):'line';
}

function fieldShapePeriodV3(shape){
  return(shape==='line'||shape==='rect')?Math.PI:A.TAU;
}

function reinforceFieldRelationshipsV3(layout,s,strategy){
  if(!layout.length)return layout;

  var heroIndices=[];
  for(var h=0;h<layout.length;h++){
    layout[h]._fieldIndex=h;
    layout[h].shapeV3=fieldShapeV3(s,strategy,h);
    if(layout[h].tier==='hero')heroIndices.push(h);
  }
  if(!heroIndices.length)return layout;

  var relationR=A.makeR(s.seed+'|field-relationships-v3|'+strategy);
  var familyCount=Math.max(1,heroIndices.length);
  var requestedColours=Math.max(1,Math.round(s.colourCount||familyCount));
  var extraColours=Math.max(0,requestedColours-familyCount);
  var accentChance=A.clamp((requestedColours-familyCount)/Math.max(4,requestedColours)*.72,.08,.58);

  for(var i=0;i<layout.length;i++){
    var item=layout[i];

    if(item.tier==='hero'){
      item.family=heroIndices.indexOf(i);
      item.colourIndex=item.family;
      item.relationStrength=1;
      item.parentHeroIndex=-1;
      continue;
    }

    var heroIndex=nearestHeroIndex(layout,i);
    if(heroIndex<0)continue;

    var hero=layout[heroIndex];
    var family=heroIndices.indexOf(heroIndex);
    var dx=item.x-hero.x,dy=item.y-hero.y;
    var distance=Math.max(1,Math.sqrt(dx*dx+dy*dy));
    var radial=Math.atan2(dy,dx);
    var desired=A.qphi(distance,34,1);
    var snap=item.tier==='medium'?RELATIONSHIP_TUNING.v3.mediumDistanceSnap:RELATIONSHIP_TUNING.v3.smallDistanceSnap;

    if(strategy==='ORBIT')snap*=RELATIONSHIP_TUNING.v3.orbitDistanceSnapBoost;
    if(strategy==='MONUMENT')snap*=RELATIONSHIP_TUNING.v3.monumentDistanceSnapScale;
    if(strategy==='EDGE')snap*=RELATIONSHIP_TUNING.v3.edgeDistanceSnapScale;

    if(relationR.chance(item.tier==='medium'?RELATIONSHIP_TUNING.v3.mediumSnapChance:RELATIONSHIP_TUNING.v3.smallSnapChance)){
      var adjusted=A.lerp(distance,desired,snap);
      item.x=A.clamp(hero.x+Math.cos(radial)*adjusted,28,A.W-28);
      item.y=A.clamp(hero.y+Math.sin(radial)*adjusted,28,A.H-28);
      dx=item.x-hero.x;
      dy=item.y-hero.y;
      distance=Math.max(1,Math.sqrt(dx*dx+dy*dy));
      radial=Math.atan2(dy,dx);
    }

    var targetRot=radial;
    if(strategy==='ORBIT')targetRot=radial+Math.PI/2;
    else if(strategy==='DIAGONAL')targetRot=(A.hash(s.seed+'|diag')%2)===1?-Math.PI/4:Math.PI/4;
    else if(strategy==='MONUMENT')targetRot=hero.rot;

    var align=item.tier==='medium'?RELATIONSHIP_TUNING.v3.mediumAngleAlignment:RELATIONSHIP_TUNING.v3.smallAngleAlignment;
    if(strategy==='ORBIT'||strategy==='DIAGONAL')align+=RELATIONSHIP_TUNING.v3.orbitDiagonalAngleBoost;
    item.rot=fieldLerpAngleV3(item.rot,targetRot,align,fieldShapePeriodV3(item.shapeV3));

    item.family=Math.max(0,family);
    item.parentHeroIndex=heroIndex;
    item.phiDistance=desired;
    item.relationStrength=item.tier==='medium'?RELATIONSHIP_TUNING.v3.mediumRelationStrength:RELATIONSHIP_TUNING.v3.smallRelationStrength;

    if(item.tier==='small'&&extraColours>0&&relationR.chance(accentChance)){
      item.colourIndex=familyCount+((i+family+A.hash(s.seed+'|field-accent-v3|'+i))%extraColours);
    }else{
      item.colourIndex=item.family;
    }
  }

  return layout;
}

function fieldRelationshipScoreV3(layout,s,strategy){
  var heroes=layout.filter(function(o){return o.tier==='hero'});
  if(!heroes.length)return 0;

  var score=0,count=0;
  for(var i=0;i<layout.length;i++){
    var item=layout[i];
    if(item.tier==='hero')continue;

    var nearest=null,best=Infinity;
    for(var h=0;h<heroes.length;h++){
      var dx=item.x-heroes[h].x,dy=item.y-heroes[h].y;
      var d=Math.sqrt(dx*dx+dy*dy);
      if(d<best){best=d;nearest=heroes[h]}
    }
    if(!nearest)continue;

    var quant=A.qphi(best,34,1);
    var distanceFit=1-A.clamp(Math.abs(best-quant)/Math.max(1,quant),0,1);
    var radial=Math.atan2(item.y-nearest.y,item.x-nearest.x);
    var targetRot=radial;
    if(strategy==='ORBIT')targetRot=radial+Math.PI/2;
    else if(strategy==='DIAGONAL')targetRot=(A.hash(s.seed+'|diag')%2)===1?-Math.PI/4:Math.PI/4;
    else if(strategy==='MONUMENT')targetRot=nearest.rot;

    var period=fieldShapePeriodV3(item.shapeV3);
    var delta=Math.abs(fieldAngleDeltaV3(item.rot,targetRot,period));
    var alignment=1-A.clamp(delta/(period/2),0,1);
    var weight=item.tier==='medium'?RELATIONSHIP_TUNING.v3.mediumScoreWeight:RELATIONSHIP_TUNING.v3.smallScoreWeight;

    score+=(distanceFit*RELATIONSHIP_TUNING.v3.distanceFitWeight+alignment*RELATIONSHIP_TUNING.v3.angleFitWeight)*weight;
    count+=weight;
  }

  if(!count)return 0;
  return score/count*RELATIONSHIP_TUNING.v3.relationshipScoreWeight*(RELATIONSHIP_TUNING.v3.baselinePhiPull+s.phiStrength/180);
}

function chooseBestLayoutV3(s){
  var strategy=chooseStrategy(s);
  var voidR=A.makeR(s.seed+'|'+s.mode+'|voids|'+strategy);
  var voids=makeReservedVoids(s,strategy,voidR);
  var candidates=s.elements>ORBITAL_SELECTION_TUNING.candidates.highCountThreshold?ORBITAL_SELECTION_TUNING.candidates.highCountBudget:ORBITAL_SELECTION_TUNING.candidates.standardBudget;
  var best=null,bestScore=-Infinity;

  for(var i=0;i<candidates;i++){
    var layout=makeLayoutPlan(s,i,strategy,voids);
    layout=reinforceFieldRelationshipsV3(layout,s,strategy);
    var score=scoreLayout(layout,s,strategy,voids)+fieldRelationshipScoreV3(layout,s,strategy);
    if(score>bestScore){
      bestScore=score;
      best=layout;
    }
  }

  return{layout:best||[],strategy:strategy,voids:voids,score:bestScore};
}

function drawPlannedElementV3(ctx,plan,i,s,r,pal,strategy){
  var sh=plan.shapeV3||fieldShapeV3(s,strategy,i);
  var c={x:plan.x,y:plan.y};
  var size=plan.size;
  var rot=plan.rot;
  var colourIndex=Number.isInteger(plan.colourIndex)?plan.colourIndex:i;
  var col=pal[((colourIndex%pal.length)+pal.length)%pal.length];
  var ratio=A.lerp(r.range(.65,1.68),A.PHI,s.phiStrength/100);
  var tierFactor=plan.tier==='hero'?1.62:(plan.tier==='small'?.76:1);
  var drawSettings=Object.assign({},s,{
    thickness:A.clamp(Math.round(s.thickness*tierFactor),1,28)
  });

  if(sh==='line'){
    var a={x:c.x-Math.cos(rot)*size/2,y:c.y-Math.sin(rot)*size/2};
    var b={x:c.x+Math.cos(rot)*size/2,y:c.y+Math.sin(rot)*size/2};
    A.drawLine(ctx,a,b,col,drawSettings,r);
  }else if(sh==='circle'){
    A.ellipse(ctx,c,size/2,size/(2*ratio),rot,col,drawSettings,r);
  }else if(sh==='rect'){
    A.rect(ctx,c,size,size/ratio,rot,col,drawSettings,r);
  }else if(sh==='poly'){
    A.poly(ctx,c,size/2,r.pick([3,5,8]),rot,col,drawSettings,r);
  }else{
    A.arc(ctx,c,size/2,rot,A.TAU*r.pick([A.INV,1-A.INV,.5,.75]),col,drawSettings,r);
  }

  var nest=(s.nesting/160)*A.lerp(1,.65,crowdFactor(s));
  if(plan.tier==='hero')nest*=1.24;
  if(plan.tier==='small')nest*=.66;

  if(r.chance(nest)){
    var nestedIndex=Number.isInteger(plan.colourIndex)?plan.colourIndex+1:i+1;
    var nc=pal[((nestedIndex%pal.length)+pal.length)%pal.length],n=size/A.PHI;
    if(sh==='rect'){
      A.rect(ctx,c,n,n/A.PHI,rot+A.GOLD,nc,drawSettings,r);
    }else if(sh==='circle'){
      A.ellipse(ctx,c,n/2,n/(2*A.PHI),rot+A.GOLD,nc,drawSettings,r);
    }else if(sh==='poly'){
      A.poly(ctx,c,n/2,5,rot+A.GOLD,nc,drawSettings,r);
    }
  }
}

function drawFieldV3(ctx,s,r,pal){
  var result=chooseBestLayoutV3(s);
  var tierRank={small:0,medium:1,hero:2};
  var ordered=result.layout.slice().sort(function(a,b){
    var tierDelta=tierRank[a.tier]-tierRank[b.tier];
    if(tierDelta)return tierDelta;
    return (a._fieldIndex||0)-(b._fieldIndex||0);
  });

  for(var i=0;i<ordered.length;i++){
    var plan=ordered[i];
    var localR=A.makeR(s.seed+'|field-draw-v3|'+result.strategy+'|'+plan._fieldIndex);
    drawPlannedElementV3(ctx,plan,plan._fieldIndex,s,localR,pal,result.strategy);
  }

  result.guide={type:'layout',layout:result.layout,relationships:true,rendererVersion:3};
  return result;
}

function drawSpiral(ctx,s,r,pal){
  var D=SPIRAL_LEGACY_TUNING;
  var variants=['SHELL','DOUBLE','BROKEN','OFFSET','VOID','LOOSE'];
  var variant=variants[A.hash(s.seed+'|spiral-variant')%variants.length];
  var direction=(A.hash(s.seed+'|spiral-direction')%2===0)?1:-1;
  var baseStrategy=chooseStrategy(s);
  var voids=variant==='VOID'
    ?makeReservedVoids(s,'VOID',A.makeR(s.seed+'|spiral-voids'))
    :[];
  var targets=phiTargets();
  var targetIndex=A.hash(s.seed+'|spiral-centre')%targets.length;
  var phase=r.range(0,A.TAU);
  var arms=variant==='DOUBLE'?2:1;
  var perArm=Math.ceil(s.elements/arms);
  var prev=new Array(arms).fill(null);
  var crowd=crowdFactor(s);
  var step=A.lerp(A.GOLD*D.angle.minimumGoldenTurnScale,A.GOLD,s.goldenAngle/100);
  var guidePoints=[];

  var centres=[];
  if(variant==='DOUBLE'){
    centres=[
      {x:A.W*(1-A.INV),y:A.H*A.INV},
      {x:A.W*A.INV,y:A.H*(1-A.INV)}
    ];
  }else if(variant==='OFFSET'||variant==='VOID'){
    centres=[{
      x:A.lerp(A.W*.5,targets[targetIndex].x,D.geometry.offcentreMix),
      y:A.lerp(A.H*.5,targets[targetIndex].y,D.geometry.offcentreMix)
    }];
  }else{
    centres=[{x:A.W*.5,y:A.H*.5}];
  }

  function spiralRadius(t){
    var exponent=A.INV;
    var scale=1;

    if(variant==='SHELL'){
      exponent=D.radius.shellExponent;
      scale=D.radius.shellScale;
    }else if(variant==='LOOSE'){
      exponent=D.radius.looseExponent;
      scale=D.radius.looseScale;
    }else if(variant==='BROKEN'){
      exponent=D.radius.brokenExponent;
      scale=D.radius.brokenScale;
    }else if(variant==='DOUBLE'){
      exponent=D.radius.doubleExponent;
      scale=D.radius.doubleScale;
    }else if(variant==='OFFSET'||variant==='VOID'){
      exponent=D.radius.offsetVoidExponent;
      scale=D.radius.offsetVoidScale;
    }

    return Math.pow(A.clamp(t,0,1),exponent)*scale;
  }

  function isHero(local){
    var a=Math.round((perArm-1)*A.INV);
    var b=Math.round((perArm-1)*(1-A.INV));
    return local===a||local===b;
  }

  for(var i=0;i<s.elements;i++){
    var arm=i%arms;
    var local=Math.floor(i/arms);
    var t=(local+D.radius.indexOffset)/Math.max(1,perArm);
    var centre=centres[arm%centres.length];
    var radial=spiralRadius(t);
    var armPhase=arm===0?0:Math.PI;
    var angle=phase+armPhase+direction*(local*step);

    if(variant==='BROKEN'){
      angle+=Math.sin(local*A.GOLD)*D.angle.brokenWobble;
    }else if(variant==='LOOSE'){
      angle+=Math.sin(local*A.INV)*D.angle.looseWobble;
    }

    var rx=A.W*(variant==='DOUBLE'?D.geometry.doubleHorizontalReach:D.geometry.otherHorizontalReach)*radial;
    var ry=A.H*(variant==='LOOSE'?D.geometry.looseVerticalReach:(variant==='DOUBLE'?D.geometry.doubleVerticalReach:D.geometry.otherVerticalReach))*radial;

    var p={
      x:centre.x+Math.cos(angle)*rx,
      y:centre.y+Math.sin(angle)*ry
    };

    if(variant==='SHELL'){
      p.x+=Math.cos(angle+A.GOLD)*Math.pow(t,D.geometry.shellEaseExponent)*A.W*D.geometry.shellOffsetScale;
      p.y+=Math.sin(angle+A.GOLD)*Math.pow(t,D.geometry.shellEaseExponent)*A.H*D.geometry.shellOffsetScale;
    }

    if(crowd>D.geometry.scatterActivationCrowd&&variant!=='DOUBLE'){
      var spread=A.goldenCanvasPoint(i,s.elements,s,phase);
      var mix=crowd*D.geometry.scatterMixScale;
      p.x=A.lerp(p.x,spread.x,mix);
      p.y=A.lerp(p.y,spread.y,mix);
    }

    p.x=A.clamp(p.x,D.geometry.canvasInsetPx,A.W-D.geometry.canvasInsetPx);
    p.y=A.clamp(p.y,D.geometry.canvasInsetPx,A.H-D.geometry.canvasInsetPx);

    if(pointInVoid(p.x,p.y,voids)){
      prev[arm]=null;
      continue;
    }

    guidePoints.push({x:p.x,y:p.y,arm:arm,local:local});

    var breakLine=false;
    if(variant==='BROKEN'){
      var cycle=D.ink.brokenCycleBase+(A.hash(s.seed+'|spiral-breaks')%D.ink.brokenCycleOptions);
      breakLine=(local%cycle===0)||(local%cycle===cycle-1);
    }

    var lineChance=A.lerp(D.ink.lineChanceSparse,D.ink.lineChanceDense,crowd);
    if(variant==='LOOSE')lineChance*=D.ink.looseLineFactor;
    if(variant==='DOUBLE')lineChance*=D.ink.doubleLineFactor;

    if(prev[arm]&&s.lines&&!breakLine&&r.chance(lineChance)){
      A.drawLine(ctx,prev[arm],p,pal[i%pal.length],s,r);
    }

    var tier=isHero(local)?'hero':(local<Math.max(D.tiers.mediumCountFloor,Math.round(perArm*D.tiers.mediumFraction))?'medium':'small');
    var drawChance=A.lerp(D.ink.markChanceSparse,D.ink.markChanceDense,crowd);

    if(variant==='BROKEN')drawChance=D.ink.brokenMarkChance;
    if(variant==='VOID')drawChance=D.ink.voidMarkChance;

    if(r.chance(drawChance)){
      var territory=Math.max(D.tiers.territoryFloorPx,Math.min(A.W,A.H)/(D.tiers.territoryDivisor+Math.sqrt(perArm)*D.tiers.territoryCrowdScale));
      var temp={
        tier:tier,
        x:p.x,y:p.y,
        size:makeBaseSize(s,tier,r,territory,baseStrategy),
        rot:angle+Math.PI/2,
        territory:territory
      };
      drawPlannedElement(ctx,temp,i,s,r,pal,baseStrategy);
    }

    if(s.arcs&&variant==='SHELL'&&r.chance((s.shapeAmount/100)*D.ink.shellArcChanceScale)){
      A.arc(
        ctx,p,
        Math.max(D.ink.shellArcMinimumRadiusPx,makeBaseSize(s,'small',r,D.ink.shellArcSourceTerritoryPx,baseStrategy)*D.ink.shellArcRadiusScale),
        angle,
        A.TAU*A.INV,
        pal[(i+2)%pal.length],
        s,r
      );
    }

    prev[arm]=p;
  }

  return{
    strategy:'SPIRAL-'+variant,
    voids:voids,
    guide:{
      type:'spiral',
      variant:variant,
      centres:centres,
      points:guidePoints,
      arms:arms,
      step:step,
      direction:direction
    }
  };
}

function drawSpiralV4(ctx,s,r,pal){
  var D=SPIRAL_LOG_TUNING;
  var variants=['SHELL','DOUBLE','BROKEN','OFFSET','VOID','LOOSE'];
  var variant=variants[A.hash(s.seed+'|spiral-variant')%variants.length];
  var direction=(A.hash(s.seed+'|spiral-direction')%2===0)?1:-1;
  var baseStrategy=chooseStrategy(s);
  var voids=variant==='VOID'?makeReservedVoids(s,'VOID',A.makeR(s.seed+'|spiral-voids')):[];
  var targets=phiTargets();
  var targetIndex=A.hash(s.seed+'|spiral-centre')%targets.length;
  var phase=r.range(0,A.TAU);
  var arms=variant==='DOUBLE'?2:1;
  var perArm=Math.ceil(s.elements/arms);
  var prev=new Array(arms).fill(null);
  var crowd=crowdFactor(s);
  var guidePoints=[];
  var centres=variant==='DOUBLE'
    ?[{x:A.W*(1-A.INV),y:A.H*A.INV},{x:A.W*A.INV,y:A.H*(1-A.INV)}]
    :(variant==='OFFSET'||variant==='VOID')
      ?[{x:A.lerp(A.W*.5,targets[targetIndex].x,D.geometry.offcentreMix),y:A.lerp(A.H*.5,targets[targetIndex].y,D.geometry.offcentreMix)}]
      :[{x:A.W*.5,y:A.H*.5}];

  // True golden logarithmic spiral: radius grows by φ every quarter-turn.
  var b=2*Math.log(A.PHI)/Math.PI;
  var turns=variant==='DOUBLE'?D.radius.doubleTurns:(variant==='LOOSE'?D.radius.looseTurns:D.radius.otherTurns);
  var thetaMax=turns*A.TAU;
  var maxRadius=variant==='DOUBLE'?D.radius.doubleReach:(variant==='LOOSE'?D.radius.looseReach:D.radius.otherReach);
  var minRadius=maxRadius/Math.exp(b*thetaMax);

  function isHero(local){
    var a=Math.round((perArm-1)*A.INV);
    var c=Math.round((perArm-1)*(1-A.INV));
    return local===a||local===c;
  }

  for(var i=0;i<s.elements;i++){
    var arm=i%arms,local=Math.floor(i/arms);
    var u=(local+D.radius.indexOffset)/Math.max(1,perArm);
    var centre=centres[arm%centres.length];
    var theta=u*thetaMax;
    var radial=minRadius*Math.exp(b*theta);
    var armPhase=arm===0?0:Math.PI;
    var angle=phase+armPhase+direction*theta;
    if(variant==='BROKEN')angle+=Math.sin(local*A.GOLD)*D.angle.brokenWobble;
    else if(variant==='LOOSE')angle+=Math.sin(local*A.INV)*D.angle.looseWobble;

    var p={x:centre.x+Math.cos(angle)*A.W*radial,y:centre.y+Math.sin(angle)*A.H*radial};
    if(variant==='SHELL'){
      p.x+=Math.cos(angle+A.GOLD)*u*A.W*D.geometry.shellOffsetScale;
      p.y+=Math.sin(angle+A.GOLD)*u*A.H*D.geometry.shellOffsetScale;
    }
    p.x=A.clamp(p.x,D.geometry.canvasInsetPx,A.W-D.geometry.canvasInsetPx); p.y=A.clamp(p.y,D.geometry.canvasInsetPx,A.H-D.geometry.canvasInsetPx);
    if(pointInVoid(p.x,p.y,voids)){prev[arm]=null;continue}
    guidePoints.push({x:p.x,y:p.y,arm:arm,local:local,theta:theta,radius:radial});

    var breakLine=variant==='BROKEN'&&((local%(D.ink.brokenCycleBase+(A.hash(s.seed+'|spiral-breaks')%D.ink.brokenCycleOptions)))===0);
    var lineChance=A.lerp(D.ink.lineChanceSparse,D.ink.lineChanceDense,crowd)*(variant==='LOOSE'?D.ink.looseLineFactor:(variant==='DOUBLE'?D.ink.doubleLineFactor:1));
    if(prev[arm]&&s.lines&&!breakLine&&r.chance(lineChance))A.drawLine(ctx,prev[arm],p,pal[i%pal.length],s,r);

    var tier=isHero(local)?'hero':(local<Math.max(D.tiers.mediumCountFloor,Math.round(perArm*D.tiers.mediumFraction))?'medium':'small');
    if(r.chance(variant==='BROKEN'?D.ink.brokenMarkChance:(variant==='VOID'?D.ink.voidMarkChance:A.lerp(D.ink.markChanceSparse,D.ink.markChanceDense,crowd)))){
      var territory=Math.max(D.tiers.territoryFloorPx,Math.min(A.W,A.H)/(D.tiers.territoryDivisor+Math.sqrt(perArm)*D.tiers.territoryCrowdScale));
      drawPlannedElementV3(ctx,{tier:tier,x:p.x,y:p.y,size:makeBaseSize(s,tier,r,territory,baseStrategy),rot:angle+Math.PI/2,territory:territory},i,s,r,pal,baseStrategy);
    }
    prev[arm]=p;
  }
  return{strategy:'SPIRAL-'+variant,voids:voids,guide:{type:'spiral',variant:variant,centres:centres,points:guidePoints,arms:arms,direction:direction,golden:true,growth:A.PHI,turns:turns}};
}

function drawSpiralV6(ctx,s,r,pal){
  var D=TRAJECTORY_TUNING;
  // V5 treats phi as a trajectory grammar, not as a requirement to draw a complete coil.
  var families=['CLASSIC','SWEEP','FAN','S-CURVE','ECHO','INTERSECT','CASCADE','ORBIT','SCATTER','CROP'];
  var h=A.hash(s.seed+'|trajectory-v5')%100;
  var family=h<D.selection.classicHashThreshold?'CLASSIC':families[1+(A.hash(s.seed+'|trajectory-family-v5')%(families.length-1))];
  var direction=(A.hash(s.seed+'|trajectory-direction-v5')%2===0)?1:-1;
  var strategy=chooseStrategy(s), targets=phiTargets(), points=[], paths=[], centres=[];
  var count=Math.max(D.layout.minimumElements,s.elements|0), influence=A.clamp(s.spiralInfluence/100,0,1);
  var b=2*Math.log(A.PHI)/Math.PI, phase=r.range(0,A.TAU);
  var phiIndex=A.hash(s.seed+'|trajectory-anchor-v5')%targets.length;
  var anchor={x:targets[phiIndex].x,y:targets[phiIndex].y};
  var baseSize=Math.max(D.layout.baseSizeFloorPx,Math.min(A.W,A.H)/(D.layout.baseSizeDivisor+Math.sqrt(count)*D.layout.baseSizeCrowdGain));

  function addPath(path){if(path.length){paths.push(path);for(var j=0;j<path.length;j++)points.push(path[j]);}}
  function logPath(cx,cy,startR,endR,turns,startPhase,n,arm){
    var out=[], tmax=turns*A.TAU, minR=Math.max(D.layout.logMinimumRadius,startR);
    for(var j=0;j<n;j++){
      var u=n===1?0:j/(n-1), theta=u*tmax;
      var rr=minR*Math.exp(Math.log(Math.max(minR,endR)/minR)*u);
      var ang=startPhase+direction*theta;
      out.push({x:cx+Math.cos(ang)*A.W*rr,y:cy+Math.sin(ang)*A.H*rr,arm:arm||0,local:j,theta:theta,radius:rr});
    }
    return out;
  }
  function bezier(p0,p1,p2,p3,n,arm){
    var out=[];
    for(var j=0;j<n;j++){var t=n===1?0:j/(n-1),q=1-t;
      out.push({x:q*q*q*p0.x+3*q*q*t*p1.x+3*q*t*t*p2.x+t*t*t*p3.x,
        y:q*q*q*p0.y+3*q*q*t*p1.y+3*q*t*t*p2.y+t*t*t*p3.y,arm:arm||0,local:j,theta:t*A.TAU,radius:t});
    } return out;
  }

  if(family==='CLASSIC'){
    centres=[{x:A.W*.5,y:A.H*.5}];
    addPath(logPath(centres[0].x,centres[0].y,D.classic.startRadius,D.classic.endRadius,D.classic.turns,phase,count,0));
  }else if(family==='SWEEP'||family==='CROP'){
    var side=A.hash(s.seed+'|outside-v5')%4, margin=family==='CROP'?A.W*D.sweep.cropOutsideFraction:A.W*D.sweep.sweepOutsideFraction;
    var cx=side===0?-margin:side===1?A.W+margin:A.W*.5;
    var cy=side===2?-margin:side===3?A.H+margin:A.H*.5;
    centres=[{x:cx,y:cy}];
    addPath(logPath(cx,cy,D.sweep.startRadius,family==='CROP'?D.sweep.cropEndRadius:D.sweep.sweepEndRadius,family==='CROP'?D.sweep.cropTurns:D.sweep.sweepTurns,phase,count,0));
  }else if(family==='FAN'){
    centres=[anchor]; var arms=D.fan.minimumArms+(A.hash(s.seed+'|fan-arms-v5')%D.fan.additionalArmOptions), each=Math.ceil(count/arms);
    for(var a=0;a<arms;a++){
      var ang=phase+a*A.GOLD, end={x:anchor.x+Math.cos(ang)*A.W*D.fan.endReach,y:anchor.y+Math.sin(ang)*A.H*D.fan.endReach};
      var bend={x:A.lerp(anchor.x,end.x,A.INV)+Math.cos(ang+A.GOLD)*A.W*D.fan.bendNormalOffset,y:A.lerp(anchor.y,end.y,A.INV)+Math.sin(ang+A.GOLD)*A.H*D.fan.bendNormalOffset};
      addPath(bezier(anchor,bend,bend,end,each,a));
    }
  }else if(family==='S-CURVE'){
    centres=[anchor];
    var rev=(A.hash(s.seed+'|s-rev-v5')%2)===1;
    var p0={x:rev?A.W+D.sCurve.borderOvershootPx:-D.sCurve.borderOvershootPx,y:A.H*(1-A.INV)},p3={x:rev?-D.sCurve.borderOvershootPx:A.W+D.sCurve.borderOvershootPx,y:A.H*A.INV};
    if(s.orientation==='portrait'){
      addPath(bezier({x:A.W*(1-A.INV),y:rev?A.H+D.sCurve.borderOvershootPx:-D.sCurve.borderOvershootPx},
        {x:-A.W*D.sCurve.controlOutsideFraction,y:A.H*A.INV},{x:A.W*D.sCurve.controlBeyondFraction,y:A.H*(1-A.INV)},
        {x:A.W*A.INV,y:rev?-D.sCurve.borderOvershootPx:A.H+D.sCurve.borderOvershootPx},count,0));
    }else{
      addPath(bezier(p0,{x:A.W*A.INV,y:-A.H*D.sCurve.controlOutsideFraction},{x:A.W*(1-A.INV),y:A.H*D.sCurve.controlBeyondFraction},p3,count,0));
    }
  }else if(family==='ECHO'){
    centres=[anchor]; var echoes=D.echo.minimumEchoes+(A.hash(s.seed+'|echo-count-v5')%D.echo.additionalEchoOptions), eachE=Math.ceil(count/echoes);
    for(var e=0;e<echoes;e++){
      var off=(e-(echoes-1)/2)*A.W*D.echo.parallelOffset;
      if(s.orientation==='portrait'){
        addPath(bezier({x:A.W*D.echo.startMajorFraction+off,y:-D.echo.borderOvershootPx},{x:A.W*D.echo.controlMinorFraction+off,y:A.H*D.echo.firstControlFraction},
          {x:A.W*D.echo.controlMajorFraction+off,y:A.H*D.echo.secondControlFraction},{x:A.W*D.echo.endFraction+off,y:A.H+D.echo.borderOvershootPx},eachE,e));
      }else{
        addPath(bezier({x:-D.echo.borderOvershootPx,y:A.H*D.echo.startMajorFraction+off},{x:A.W*D.echo.firstControlFraction,y:A.H*D.echo.controlMinorFraction+off},{x:A.W*D.echo.secondControlFraction,y:A.H*D.echo.controlMajorFraction+off},{x:A.W+D.echo.borderOvershootPx,y:A.H*D.echo.endFraction+off},eachE,e));
      }
    }
  }else if(family==='INTERSECT'){
    centres=[targets[0],targets[3]]; var eachI=Math.ceil(count/D.intersect.pathCount);
    addPath(bezier({x:-D.intersect.borderOvershootPx,y:A.H*D.intersect.firstStartY},{x:A.W*D.intersect.firstControlAX,y:A.H*D.intersect.firstControlAY},{x:A.W*D.intersect.firstControlBX,y:A.H*D.intersect.firstControlBY},{x:A.W+D.intersect.borderOvershootPx,y:A.H*D.intersect.firstEndY},eachI,0));
    addPath(bezier({x:A.W*D.intersect.secondStartX,y:-D.intersect.borderOvershootPx},{x:A.W*D.intersect.secondControlAX,y:A.H*D.intersect.secondControlAY},{x:A.W*D.intersect.secondControlBX,y:A.H*D.intersect.secondControlBY},{x:A.W*D.intersect.secondEndX,y:A.H+D.intersect.borderOvershootPx},eachI,1));
  }else if(family==='CASCADE'){
    centres=[anchor]; var segs=D.cascade.minimumSegments+(A.hash(s.seed+'|cascade-v5')%D.cascade.additionalSegmentOptions), left=count;
    var cur=s.orientation==='portrait'?{x:A.W*.18,y:A.H*.12}:{x:A.W*.12,y:A.H*.18};
    for(var c=0;c<segs;c++){var n=Math.max(D.cascade.minimumSegmentPoints,Math.round(left/(segs-c))),len=(s.orientation==='portrait'?A.H:A.W)*D.cascade.lengthFraction/Math.pow(A.PHI,c*D.cascade.phiDecayExponent),ang=phase*D.cascade.phaseScale+c*A.GOLD*D.cascade.turnScale;
      var end=s.orientation==='portrait'
        ?{x:cur.x+Math.cos(ang)*len*D.cascade.crossAxisLengthScale,y:cur.y+Math.sin(ang)*len}
        :{x:cur.x+Math.cos(ang)*len,y:cur.y+Math.sin(ang)*len*D.cascade.crossAxisLengthScale};
      addPath(bezier(cur,{x:A.lerp(cur.x,end.x,D.cascade.controlAAlong),y:cur.y-len*D.cascade.controlACross},{x:A.lerp(cur.x,end.x,D.cascade.controlBAlong),y:end.y+len*D.cascade.controlBCross},end,n,c));
      cur=end;left-=n;
    }
  }else if(family==='ORBIT'){
    centres=[targets[0],targets[3]]; var orbits=D.orbit.pathCount, eachO=Math.ceil(count/orbits);
    for(var o=0;o<orbits;o++){var path=[];for(var k=0;k<eachO;k++){var u=k/Math.max(1,eachO-1),ang=phase+u*A.TAU*A.INV*D.orbit.angularSweepScale+o*Math.PI;
      path.push({x:centres[o].x+Math.cos(ang)*A.W*(D.orbit.radiusXStart+o*D.orbit.radiusXStep),y:centres[o].y+Math.sin(ang)*A.H*(D.orbit.radiusYStart-o*D.orbit.radiusYStep),arm:o,local:k,theta:ang,radius:D.orbit.guideRadius});}addPath(path);}
  }else if(family==='SCATTER'){
    centres=[anchor]; var raw=logPath(anchor.x,anchor.y,D.scatter.startRadius,D.scatter.endRadius,D.scatter.turns,phase,count*D.scatter.sourceCountMultiplier,0), sparse=[];
    for(var z=0;z<raw.length;z++){var keep=((z*A.GOLD)%A.TAU)<A.TAU*A.INV; if(keep&&r.chance(D.scatter.chanceBase+D.scatter.influenceChanceGain*influence))sparse.push(raw[z]);}
    addPath(sparse.slice(0,count));
  }

  // V6 safety: a trajectory family must actually cross the drawable canvas.
  // V5 CROP/SWEEP seeds could generate every point off-canvas, producing an empty export.
  var visibleCount=0;
  for(var vi=0;vi<points.length;vi++)if(points[vi].x>-D.safety.visibilityMarginPx&&points[vi].x<A.W+D.safety.visibilityMarginPx&&points[vi].y>-D.safety.visibilityMarginPx&&points[vi].y<A.H+D.safety.visibilityMarginPx)visibleCount++;
  if(visibleCount<Math.min(D.safety.visibleRequiredMax,Math.max(D.safety.visibleRequiredMin,Math.floor(count*D.safety.visibleFraction)))){
    points=[];paths=[];centres=[anchor];family='SAFE-SWEEP';
    if(s.orientation==='portrait'){
      addPath(bezier({x:A.W*(1-A.INV),y:-D.safety.fallbackBorderOvershootPx},{x:A.W*D.safety.fallbackControlNear,y:A.H*A.INV},
        {x:A.W*D.safety.fallbackControlFar,y:A.H*(1-A.INV)},{x:A.W*A.INV,y:A.H+D.safety.fallbackBorderOvershootPx},count,0));
    }else{
      addPath(bezier({x:-D.safety.fallbackBorderOvershootPx,y:A.H*(1-A.INV)},{x:A.W*A.INV,y:A.H*D.safety.fallbackControlNear},{x:A.W*(1-A.INV),y:A.H*D.safety.fallbackControlFar},{x:A.W+D.safety.fallbackBorderOvershootPx,y:A.H*A.INV},count,0));
    }
  }

  // Pull strict trajectories slightly toward phi anchors at low influence, preserving identity without forcing a coil.
  for(var pi=0;pi<points.length;pi++){
    var p=points[pi], tgt=targets[(pi+phiIndex)%targets.length], freedom=(1-influence)*D.safety.lowInfluenceAnchorMix;
    p.x=A.lerp(p.x,tgt.x,freedom); p.y=A.lerp(p.y,tgt.y,freedom);
  }

  var drawIndex=0, prev=null;
  for(var pa=0;pa<paths.length;pa++){
    prev=null;
    for(var q=0;q<paths[pa].length;q++){
      var p=paths[pa][q], inside=p.x>-D.ink.drawOutsideMarginPx&&p.x<A.W+D.ink.drawOutsideMarginPx&&p.y>-D.ink.drawOutsideMarginPx&&p.y<A.H+D.ink.drawOutsideMarginPx;
      var sparseGap=family==='SCATTER'&&r.chance(D.ink.scatterGapChance);
      if(inside&&prev&&s.lines&&!sparseGap&&r.chance(A.lerp(D.ink.lineChanceSparse,D.ink.lineChanceDense,crowdFactor(s))))A.drawLine(ctx,prev,p,pal[drawIndex%pal.length],s,r);
      if(inside&&!sparseGap){
        var local=q, tier=(q===Math.round((paths[pa].length-1)*A.INV))?'hero':(q%Math.max(D.tiers.mediumPeriodFloor,Math.round(paths[pa].length*A.INV*D.tiers.mediumPeriodScale))===0?'medium':'small');
        if(r.chance(A.lerp(D.ink.shapeChanceSparse,D.ink.shapeChanceDense,crowdFactor(s)))){
          drawPlannedElementV3(ctx,{tier:tier,x:A.clamp(p.x,D.ink.canvasInsetPx,A.W-D.ink.canvasInsetPx),y:A.clamp(p.y,D.ink.canvasInsetPx,A.H-D.ink.canvasInsetPx),size:makeBaseSize(s,tier,r,baseSize,strategy),rot:(p.theta||0)+Math.PI/2,territory:baseSize},drawIndex,s,r,pal,strategy);
        }
        drawIndex++;
      }
      prev=inside?p:null;
    }
  }
  return{strategy:'TRAJECTORY-'+family,voids:[],guide:{type:'spiral',variant:family,centres:centres,points:points,arms:paths.length,direction:direction,golden:true,growth:A.PHI,turns:null}};
}

function drawRects(ctx,s,r,pal){
  var D=RECT_DIVISION_TUNING;
  var variants=['MOSAIC','CASCADE','CROSSCUT','FRAMED'];
  var variant=variants[A.hash(s.seed+'|rect-variant')%variants.length];
  var margin=A.qphi(r.range(D.layout.marginMinPx,D.layout.marginMaxPx),34,s.phiStrength/100);
  var root={x:margin,y:margin,w:A.W-margin*2,h:A.H-margin*2,depth:0,branch:0};
  var target=Math.max(D.layout.minimumCells,Math.min(D.layout.maximumCells,
    Math.round(D.layout.baseCells+s.recursion*D.layout.recursionCellGain+s.complexity/D.layout.complexityCellsDivisor+s.elements/D.layout.elementCellsDivisor)
  ));
  var active=[root],leaves=[],splitCount=0;
  var minSide=A.lerp(D.layout.minimumSideLowComplexityPx,D.layout.minimumSideHighComplexityPx,s.complexity/100);

  function area(cell){return cell.w*cell.h}

  function chooseCellIndex(){
    if(variant==='CASCADE')return active.length-1;

    if(variant==='CROSSCUT'){
      var sorted=active.map(function(c,i){return{c:c,i:i}})
        .sort(function(a,b){return area(b.c)-area(a.c)});
      var pool=Math.max(1,Math.min(sorted.length,D.selection.crosscutPoolLimit));
      return sorted[r.int(0,pool-1)].i;
    }

    var best=0,bestScore=-1;
    for(var i=0;i<active.length;i++){
      var score=area(active[i]);
      if(variant==='FRAMED')score*=1+active[i].depth*D.selection.framedDepthBonus;
      score*=r.range(D.selection.scoreJitterMin,D.selection.scoreJitterMax);
      if(score>bestScore){bestScore=score;best=i}
    }
    return best;
  }

  function splitCell(cell){
    var aspect=cell.w/Math.max(1,cell.h);
    var vertical;

    if(aspect>A.PHI*D.split.aspectPhiTolerance)vertical=true;
    else if(aspect<1/(A.PHI*D.split.aspectPhiTolerance))vertical=false;
    else if(variant==='CROSSCUT')vertical=(splitCount%2===0);
    else vertical=r.chance(.5);

    var phiCut=r.chance(.5)?A.INV:(1-A.INV);
    var cut=A.lerp(.5,phiCut,s.phiStrength/100);
    cut=A.clamp(cut,D.split.minimumCutFraction,D.split.maximumCutFraction);

    var a,b;
    if(vertical){
      var w1=cell.w*cut;
      a={x:cell.x,y:cell.y,w:w1,h:cell.h,depth:cell.depth+1,branch:splitCount};
      b={x:cell.x+w1,y:cell.y,w:cell.w-w1,h:cell.h,depth:cell.depth+1,branch:splitCount};
    }else{
      var h1=cell.h*cut;
      a={x:cell.x,y:cell.y,w:cell.w,h:h1,depth:cell.depth+1,branch:splitCount};
      b={x:cell.x,y:cell.y+h1,w:cell.w,h:cell.h-h1,depth:cell.depth+1,branch:splitCount};
    }
    splitCount++;
    return[a,b];
  }

  while(active.length&&active.length+leaves.length<target){
    var index=chooseCellIndex();
    var cell=active.splice(index,1)[0];

    if(Math.min(cell.w,cell.h)<minSide||cell.depth>=Math.max(D.split.minimumDepthLimit,s.recursion+D.split.recursionDepthOffset)){
      leaves.push(cell);
      continue;
    }

    var children=splitCell(cell);

    if(variant==='CASCADE'){
      var recurse=r.chance(.5)?0:1;
      leaves.push(children[1-recurse]);
      active.push(children[recurse]);
    }else if(variant==='FRAMED'&&r.chance(D.selection.framedContinueChance)){
      var framed=r.chance(.5)?0:1;
      leaves.push(children[framed]);
      active.push(children[1-framed]);
    }else{
      active.push(children[0],children[1]);
    }
  }

  leaves=leaves.concat(active);
  leaves.sort(function(a,b){
    if(variant==='CASCADE')return a.depth-b.depth;
    return area(b)-area(a);
  });

  var voidCount=Math.round(leaves.length*(s.negativeSpace/100)*D.voids.leafFractionAtFullNegativeSpace);
  var voids=[];
  var voidMap={};

  if(voidCount>0){
    var candidates=leaves.map(function(c,i){return{c:c,i:i}})
      .sort(function(a,b){return area(b.c)-area(a.c)});

    var start=Math.min(candidates.length-1,r.int(0,Math.min(D.voids.initialCandidateWindow,candidates.length-1)));
    for(var v=0;v<voidCount&&start+v<candidates.length;v++){
      var chosen=candidates[start+v];
      voidMap[chosen.i]=true;
      voids.push({x:chosen.c.x,y:chosen.c.y,w:chosen.c.w,h:chosen.c.h});
    }
  }

  var rectStyle=Object.assign({},s,{
    curveBias:Math.min(D.ink.maximumCurveBias,s.curveBias),
    wobble:Math.min(D.ink.maximumWobble,s.wobble)
  });

  if(s.rectangles!==false){
    A.rect(ctx,{x:A.W/2,y:A.H/2},root.w,root.h,0,pal[0],rectStyle,r);
  }

  for(var i=0;i<leaves.length;i++){
    if(voidMap[i])continue;

    var leaf=leaves[i];
    var inset=Math.min(leaf.w,leaf.h)*r.range(D.marks.insetFractionMin,D.marks.insetFractionMax);
    var w=Math.max(D.marks.minimumVisibleSidePx,leaf.w-inset*2);
    var h=Math.max(D.marks.minimumVisibleSidePx,leaf.h-inset*2);
    var c={x:leaf.x+leaf.w/2,y:leaf.y+leaf.h/2};
    var rot=r.range(-D.marks.rotationJitter,D.marks.rotationJitter)*(s.rotation/100);
    var col=pal[i%pal.length];

    if(s.rectangles!==false){
      A.rect(ctx,c,w,h,rot,col,rectStyle,r);
    }

    if(s.lines&&r.chance(D.marks.lineChanceBase+s.complexity/D.marks.lineComplexityDivisor)){
      var diag=(i+leaf.depth)%2===0;
      var p1={x:c.x+(diag?-w:w)/2,y:c.y-h/2};
      var p2={x:c.x+(diag?w:-w)/2,y:c.y+h/2};
      A.drawLine(ctx,p1,p2,pal[(i+1)%pal.length],rectStyle,r);
    }

    if(s.circles&&r.chance((s.shapeAmount/100)*D.marks.ellipseChanceScale)){
      var rad=Math.min(w,h)*r.range(D.marks.ellipseRadiusMin,D.marks.ellipseRadiusMax);
      A.ellipse(ctx,c,rad,rad/A.PHI,rot+A.GOLD*(i+1),pal[(i+2)%pal.length],rectStyle,r);
    }

    if(s.arcs&&r.chance((s.shapeAmount/100)*D.marks.arcChanceScale)){
      var arcRad=Math.min(w,h)*r.range(D.marks.arcRadiusMin,D.marks.arcRadiusMax);
      A.arc(ctx,c,arcRad,A.GOLD*i,A.TAU*A.INV,pal[(i+3)%pal.length],rectStyle,r);
    }

    if(s.polygons&&r.chance((s.shapeAmount/100)*D.marks.polygonChanceScale)){
      var polyRad=Math.min(w,h)*r.range(D.marks.polygonRadiusMin,D.marks.polygonRadiusMax);
      A.poly(ctx,c,polyRad,r.pick([3,5,8]),A.GOLD*i,pal[(i+4)%pal.length],rectStyle,r);
    }

    if(r.chance((s.nesting/100)*D.marks.nestingChanceScale)){
      var nw=w/A.PHI,nh=h/A.PHI;
      A.rect(ctx,c,nw,nh,rot+A.GOLD*D.marks.nestedGoldenTurnScale,pal[(i+5)%pal.length],rectStyle,r);
    }
  }

  return{
    strategy:'RECT-'+variant,
    voids:voids,
    guide:{type:'rects',variant:variant,root:root,cells:leaves}
  };
}

function drawBurst(ctx,s,r,pal){
  var D=BURST_TUNING;
  var variants=['SINGLE','TWIN','TRIAD','CROPPED','VOID','SATELLITE'];
  var variant=variants[A.hash(s.seed+'|burst-variant')%variants.length];
  var baseStrategy=chooseStrategy(s);
  var crowd=crowdFactor(s);
  var voids=variant==='VOID'
    ?makeReservedVoids(s,'VOID',A.makeR(s.seed+'|burst-voids'))
    :[];
  var targets=phiTargets();
  var hubs=[];
  var distributed=A.distributedPhiPoints(D.hubs.distributedSourceCount,s,A.makeR(s.seed+'|burst-hubs'));

  function hub(x,y,territory,weight){
    return{x:x,y:y,territory:territory,weight:weight};
  }

  if(variant==='SINGLE'){
    var singleTarget=targets[A.hash(s.seed+'|burst-single-centre')%targets.length];
    var centreMix=baseStrategy==='MONUMENT'?D.hubs.singleMonumentCentreMix:D.hubs.singleCentreMix;
    hubs=[hub(
      A.lerp(A.W*.5,singleTarget.x,centreMix),
      A.lerp(A.H*.5,singleTarget.y,centreMix),
      Math.min(A.W,A.H)*D.hubs.singleTerritoryScale,
      1
    )];
  }else if(variant==='TWIN'){
    var diagonal=A.hash(s.seed+'|burst-twin-diagonal')%2;
    var pair=diagonal===0?[targets[0],targets[3]]:[targets[1],targets[2]];
    hubs=[
      hub(pair[0].x,pair[0].y,Math.min(A.W,A.H)*D.hubs.twinTerritoryScale,1),
      hub(pair[1].x,pair[1].y,Math.min(A.W,A.H)*D.hubs.twinTerritoryScale,1)
    ];
  }else if(variant==='TRIAD'){
    for(var ti=0;ti<3;ti++){
      hubs.push(hub(
        distributed[ti].x,
        distributed[ti].y,
        Math.min(A.W,A.H)*D.hubs.triadTerritoryScale,
        ti===0?D.hubs.triadLeadWeight:D.hubs.triadOtherWeight
      ));
    }
  }else if(variant==='CROPPED'){
    var edge=A.hash(s.seed+'|burst-crop-edge')%4;
    var along=D.hubs.cropAlongStart+(A.hash(s.seed+'|burst-crop-pos')%D.hubs.cropAlongSteps)/100;
    var cx=A.W*.5,cy=A.H*.5;
    if(edge===0){cx=-A.W*D.hubs.cropOverflowFraction;cy=A.H*along}
    if(edge===1){cx=A.W*D.hubs.cropRightBeyondFraction;cy=A.H*along}
    if(edge===2){cx=A.W*along;cy=-A.H*D.hubs.cropOverflowFraction}
    if(edge===3){cx=A.W*along;cy=A.H*D.hubs.cropBottomBeyondFraction}
    hubs=[hub(cx,cy,Math.min(A.W,A.H)*D.hubs.cropTerritoryScale,1)];
  }else if(variant==='VOID'){
    var vc=voids.length
      ?{x:voids[0].x+voids[0].w/2,y:voids[0].y+voids[0].h/2}
      :{x:A.W*.5,y:A.H*.5};
    var far=targets[0],farD=-1;
    for(var ft=0;ft<targets.length;ft++){
      var fdx=targets[ft].x-vc.x,fdy=targets[ft].y-vc.y;
      var fd=fdx*fdx+fdy*fdy;
      if(fd>farD){farD=fd;far=targets[ft]}
    }
    hubs=[hub(far.x,far.y,Math.min(A.W,A.H)*D.hubs.voidTerritoryScale,1)];
  }else{
    var mainTarget=targets[A.hash(s.seed+'|burst-main-target')%targets.length];
    hubs.push(hub(
      mainTarget.x,
      mainTarget.y,
      Math.min(A.W,A.H)*D.hubs.satelliteMainTerritoryScale,
      D.hubs.satelliteMainWeight
    ));
    for(var si=0;si<3;si++){
      var d=distributed[si];
      hubs.push(hub(
        d.x,
        d.y,
        Math.min(A.W,A.H)*D.hubs.satelliteOtherTerritoryScale,
        D.hubs.satelliteOtherWeight
      ));
    }
  }

  function allocateCounts(total,items){
    var n=items.length;
    var alloc=new Array(n).fill(1);
    var remaining=Math.max(0,total-n);
    if(remaining===0)return alloc;

    var totalWeight=0;
    for(var i=0;i<n;i++)totalWeight+=items[i].weight;

    var fractions=[],used=0;
    for(var j=0;j<n;j++){
      var raw=remaining*(items[j].weight/totalWeight);
      var add=Math.floor(raw);
      alloc[j]+=add;
      used+=add;
      fractions.push({i:j,f:raw-add});
    }

    fractions.sort(function(a,b){return b.f-a.f});
    var left=remaining-used;
    for(var k=0;k<left;k++)alloc[fractions[k%fractions.length].i]++;

    return alloc;
  }

  var allocations=allocateCounts(s.elements,hubs);
  var itemIndex=0;
  var guideRays=[];

  function burstTier(local,count,hubIndex){
    var heroA=Math.round((count-1)*A.INV);
    var heroB=Math.round((count-1)*(1-A.INV));

    if(local===0||local===heroA||local===heroB)return'hero';
    if(local<Math.max(D.tiers.mediumCountFloor,Math.round(count*D.tiers.mediumCountFraction)))return'medium';
    if(variant==='SATELLITE'&&hubIndex===0&&local<Math.max(D.tiers.satelliteMediumFloor,Math.round(count*D.tiers.satelliteMediumFraction)))return'medium';
    return'small';
  }

  function burstRadius(local,count,h,hubIndex){
    var t=(local+D.radius.indexOffset)/Math.max(1,count);
    var exponent=D.radius.defaultExponent;
    var scale=1;

    if(variant==='SINGLE'){exponent=D.radius.singleExponent;scale=1}
    else if(variant==='TWIN'){exponent=D.radius.twinExponent;scale=D.radius.twinScale}
    else if(variant==='TRIAD'){exponent=D.radius.triadExponent;scale=D.radius.triadScale}
    else if(variant==='CROPPED'){exponent=D.radius.croppedExponent;scale=D.radius.croppedScale}
    else if(variant==='VOID'){exponent=D.radius.voidExponent;scale=D.radius.voidScale}
    else if(variant==='SATELLITE'){
      exponent=hubIndex===0?D.radius.satelliteMainExponent:D.radius.satelliteOtherExponent;
      scale=hubIndex===0?D.radius.satelliteMainScale:D.radius.satelliteOtherScale;
    }

    var raw=Math.pow(t,exponent)*h.territory*scale;
    return A.qphi(raw,D.radius.phiQuantisationBase,s.phiStrength/100);
  }

  for(var hi=0;hi<hubs.length;hi++){
    var h=hubs[hi];
    var count=allocations[hi];
    var startPhase=r.range(0,A.TAU);
    var step=A.lerp(A.TAU/Math.max(1,count),A.GOLD,s.goldenAngle/100);

    for(var local=0;local<count;local++){
      var angle=startPhase+local*step;

      if(variant==='TWIN'&&hi===1)angle+=Math.PI/A.PHI;
      if(variant==='TRIAD')angle+=hi*(A.TAU/3);
      if(variant==='SATELLITE'&&hi>0)angle+=hi*A.GOLD*D.angle.satelliteTurnScale;
      if(variant==='CROPPED')angle+=Math.sin(local*A.INV)*D.angle.croppedWaveAmplitude;

      var len=burstRadius(local,count,h,hi);
      var px=h.x+Math.cos(angle)*len;
      var py=h.y+Math.sin(angle)*len;

      if(variant==='VOID'&&voids.length){
        var tries=0;
        while(pointInVoid(px,py,voids)&&tries<D.avoidance.voidRetryLimit){
          angle+=A.GOLD*D.avoidance.voidDetourTurnScale;
          px=h.x+Math.cos(angle)*len;
          py=h.y+Math.sin(angle)*len;
          tries++;
        }
        if(pointInVoid(px,py,voids)){
          itemIndex++;
          continue;
        }
      }

      var p={
        x:A.clamp(px,D.avoidance.canvasInsetPx,A.W-D.avoidance.canvasInsetPx),
        y:A.clamp(py,D.avoidance.canvasInsetPx,A.H-D.avoidance.canvasInsetPx)
      };
      guideRays.push({hub:hi,x:p.x,y:p.y});

      var lineChance=A.lerp(D.ink.lineChanceSparse,D.ink.lineChanceDense,crowd);
      if(variant==='TRIAD')lineChance*=D.ink.triadLineChanceScale;
      if(variant==='SATELLITE'&&hi>0)lineChance*=D.ink.satelliteLineChanceScale;
      if(variant==='VOID')lineChance*=D.ink.voidLineChanceScale;

      if(s.lines&&r.chance(lineChance)){
        A.drawLine(ctx,{x:h.x,y:h.y},p,pal[itemIndex%pal.length],s,r);
      }

      var tier=burstTier(local,count,hi);
      var shapeChance=(s.shapeAmount/100)*A.lerp(D.ink.shapeChanceSparse,D.ink.shapeChanceDense,crowd);
      if(tier==='hero')shapeChance=Math.min(1,shapeChance*D.ink.heroShapeChanceBoost);

      if(r.chance(shapeChance)){
        drawPlannedElement(ctx,{
          tier:tier,
          x:p.x,
          y:p.y,
          size:makeBaseSize(s,tier,r,h.territory,baseStrategy),
          rot:angle,
          territory:h.territory
        },itemIndex,s,r,pal,baseStrategy);
      }

      if(variant==='SATELLITE'&&hi===0&&local%Math.max(D.details.satelliteCrosslinkIntervalFloor,Math.round(count*D.details.satelliteCrosslinkIntervalFraction))===0){
        for(var sh=1;sh<hubs.length;sh++){
          if(s.lines&&r.chance(D.details.satelliteCrosslinkChance)){
            A.drawLine(ctx,p,hubs[sh],pal[(itemIndex+sh)%pal.length],s,r);
          }
        }
      }

      if(variant==='VOID'&&s.arcs&&r.chance((s.shapeAmount/100)*D.details.voidArcChanceScale)){
        A.arc(
          ctx,
          p,
          Math.max(D.details.voidArcRadiusFloorPx,makeBaseSize(s,'small',r,D.details.voidArcSourceTerritoryPx,baseStrategy)*D.details.voidArcRadiusScale),
          angle,
          A.TAU*A.INV,
          pal[(itemIndex+2)%pal.length],
          s,r
        );
      }

      if(variant==='TRIAD'&&s.circles&&local===0){
        var ring=Math.max(D.details.triadRingRadiusFloorPx,h.territory/A.PHI/A.PHI/A.PHI);
        A.ellipse(
          ctx,
          {x:h.x,y:h.y},
          ring,
          ring/A.PHI,
          startPhase,
          pal[(itemIndex+1)%pal.length],
          s,r
        );
      }

      itemIndex++;
    }
  }

  return{
    strategy:'BURST-'+variant,
    voids:voids,
    guide:{type:'burst',variant:variant,hubs:hubs,rays:guideRays}
  };
}
function nearestNeighbours(layout,index,count){
  var a=layout[index],nearest=[];
  for(var i=0;i<layout.length;i++){
    if(i===index)continue;
    var dx=a.x-layout[i].x,dy=a.y-layout[i].y;
    nearest.push({index:i,d:dx*dx+dy*dy});
  }
  nearest.sort(function(x,y){return x.d-y.d});
  return nearest.slice(0,count);
}

function segmentsCross(a,b,c,d){
  function side(p,q,r){
    return(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  }
  var abC=side(a,b,c),abD=side(a,b,d);
  var cdA=side(c,d,a),cdB=side(c,d,b);
  return((abC>0&&abD<0)||(abC<0&&abD>0))&&
        ((cdA>0&&cdB<0)||(cdA<0&&cdB>0));
}

function networkEdgeCrossings(edge,edges,layout){
  var a=layout[edge.a],b=layout[edge.b];
  var hits=0;
  for(var i=0;i<edges.length;i++){
    var e=edges[i];
    if(edge.a===e.a||edge.a===e.b||edge.b===e.a||edge.b===e.b)continue;
    if(segmentsCross(a,b,layout[e.a],layout[e.b]))hits++;
  }
  return hits;
}

function networkDegreeCap(node,s){
  var extra=Math.floor(s.complexity/NETWORK_TOPOLOGY_TUNING.degree.complexityPerExtraDegree);
  if(node.tier==='hero')return NETWORK_TOPOLOGY_TUNING.degree.heroBaseDegree+extra;
  if(node.tier==='medium')return NETWORK_TOPOLOGY_TUNING.degree.mediumBaseDegree+Math.min(NETWORK_TOPOLOGY_TUNING.degree.mediumExtraDegreeLimit,extra);
  return NETWORK_TOPOLOGY_TUNING.degree.smallBaseDegree+Math.min(NETWORK_TOPOLOGY_TUNING.degree.smallExtraDegreeLimit,extra);
}

function networkPhiFit(length,s){
  var quant=A.qphi(length,34,1);
  var error=Math.abs(length-quant)/Math.max(1,quant);
  return 1-A.clamp(error,0,1)*(s.phiStrength/100);
}

function buildNetworkEdges(layout,s){
  var crowd=crowdFactor(s);
  var searchCount=Math.max(NETWORK_TOPOLOGY_TUNING.search.minimumNeighbours,Math.min(NETWORK_TOPOLOGY_TUNING.search.maximumNeighbours,NETWORK_TOPOLOGY_TUNING.search.baseNeighbours+Math.floor(s.complexity/NETWORK_TOPOLOGY_TUNING.search.complexityPerNeighbour)));
  var candidateMap={};
  var candidates=[];
  var degrees=new Array(layout.length).fill(0);
  var chosen=[];
  var chosenKeys={};
  var allowedCrossings=Math.round(A.lerp(0,NETWORK_TOPOLOGY_TUNING.search.maximumAllowedCrossings,overlapAllowance(s)));
  var target=Math.max(
    layout.length-1,
    Math.round(layout.length*A.lerp(NETWORK_TOPOLOGY_TUNING.search.targetLowMultiplier,NETWORK_TOPOLOGY_TUNING.search.targetHighMultiplier,s.complexity/100)*A.lerp(1,NETWORK_TOPOLOGY_TUNING.search.crowdedTargetScale,crowd))
  );

  function edgeKey(a,b){
    return Math.min(a,b)+'-'+Math.max(a,b);
  }

  function candidateScore(a,b,rank){
    var na=layout[a],nb=layout[b];
    var dx=na.x-nb.x,dy=na.y-nb.y;
    var len=Math.sqrt(dx*dx+dy*dy);
    var diagonal=Math.hypot(A.W,A.H);
    var phiFit=networkPhiFit(len,s);
    var importance=0;
    if(na.tier==='hero'||nb.tier==='hero')importance+=NETWORK_TOPOLOGY_TUNING.score.heroEndpointBonus;
    if(na.tier==='medium'||nb.tier==='medium')importance+=NETWORK_TOPOLOGY_TUNING.score.mediumEndpointBonus;
    if(na.tier==='hero'&&nb.tier==='hero')importance+=NETWORK_TOPOLOGY_TUNING.score.heroPairBonus;
    var local=1-rank/Math.max(1,searchCount);
    var lengthBias=1-A.clamp(len/(diagonal*NETWORK_TOPOLOGY_TUNING.score.canvasLengthScale),0,1);
    return{
      a:a,b:b,len:len,
      score:phiFit*NETWORK_TOPOLOGY_TUNING.score.phiFitWeight+local*NETWORK_TOPOLOGY_TUNING.score.proximityWeight+lengthBias*NETWORK_TOPOLOGY_TUNING.score.shortEdgeWeight+importance
    };
  }

  function registerCandidate(a,b,rank){
    var key=edgeKey(a,b);
    var edge=candidateScore(a,b,rank);
    if(!candidateMap[key]||edge.score>candidateMap[key].score){
      candidateMap[key]=edge;
    }
  }

  for(var i=0;i<layout.length;i++){
    var nearest=nearestNeighbours(layout,i,searchCount);
    for(var n=0;n<nearest.length;n++)registerCandidate(i,nearest[n].index,n);
  }

  Object.keys(candidateMap).forEach(function(key){
    candidates.push(candidateMap[key]);
  });
  candidates.sort(function(a,b){return b.score-a.score});

  function addEdge(edge,primary,force){
    var key=edgeKey(edge.a,edge.b);
    if(chosenKeys[key])return false;

    var capA=networkDegreeCap(layout[edge.a],s);
    var capB=networkDegreeCap(layout[edge.b],s);
    if(!force&&(degrees[edge.a]>=capA||degrees[edge.b]>=capB))return false;

    var crossings=networkEdgeCrossings(edge,chosen,layout);
    if(!force&&crossings>allowedCrossings)return false;

    chosenKeys[key]=true;
    degrees[edge.a]++;
    degrees[edge.b]++;
    chosen.push({
      a:edge.a,b:edge.b,len:edge.len,
      primary:!!primary,
      crossings:crossings
    });
    return true;
  }

  var heroes=[];
  for(var h=0;h<layout.length;h++){
    if(layout[h].tier==='hero')heroes.push(h);
  }

  if(heroes.length>1){
    var connected=[heroes[0]];
    for(var hi=1;hi<heroes.length;hi++){
      var hero=heroes[hi],bestHero=null,bestDist=Infinity;
      for(var hc=0;hc<connected.length;hc++){
        var other=connected[hc];
        var hdx=layout[hero].x-layout[other].x;
        var hdy=layout[hero].y-layout[other].y;
        var hd=Math.sqrt(hdx*hdx+hdy*hdy);
        if(hd<bestDist){bestDist=hd;bestHero=other}
      }
      if(bestHero!==null){
        addEdge(candidateScore(hero,bestHero,0),true,true);
        connected.push(hero);
      }
    }
  }

  for(var m=0;m<heroes.length;m++){
    var heroIndex=heroes[m];
    var heroNear=nearestNeighbours(layout,heroIndex,Math.min(NETWORK_TOPOLOGY_TUNING.search.heroNeighbourLimit,layout.length-1));
    var attached=0;
    for(var hn=0;hn<heroNear.length&&attached<NETWORK_TOPOLOGY_TUNING.search.heroAttachmentLimit;hn++){
      var targetIndex=heroNear[hn].index;
      if(layout[targetIndex].tier==='hero')continue;
      if(addEdge(candidateScore(heroIndex,targetIndex,hn),true,false))attached++;
    }
  }

  for(var c=0;c<candidates.length&&chosen.length<target;c++){
    addEdge(candidates[c],false,false);
  }

  for(var orphan=0;orphan<layout.length;orphan++){
    if(degrees[orphan]>0)continue;
    var fallback=nearestNeighbours(layout,orphan,Math.min(NETWORK_TOPOLOGY_TUNING.search.orphanNeighbourLimit,layout.length-1));
    var best=null,bestCross=Infinity;
    for(var f=0;f<fallback.length;f++){
      var edge=candidateScore(orphan,fallback[f].index,f);
      var cross=networkEdgeCrossings(edge,chosen,layout);
      if(cross<bestCross){bestCross=cross;best=edge}
      if(cross===0)break;
    }
    if(best)addEdge(best,false,true);
  }

  return chosen;
}

function drawNetwork(ctx,s,r,pal){
  var result=chooseBestLayout(s);
  var layout=result.layout;
  var crowd=crowdFactor(s);
  var edges=buildNetworkEdges(layout,s);
  var primaryStyle=Object.assign({},s,{
    thickness:Math.max(1,s.thickness*A.lerp(NETWORK_RENDER_TUNING.primary.thicknessSparse,NETWORK_RENDER_TUNING.primary.thicknessCrowded,crowd)),
    opacity:Math.min(NETWORK_RENDER_TUNING.primary.opacityCeiling,s.opacity*NETWORK_RENDER_TUNING.primary.opacityScale),
    wobble:Math.max(NETWORK_RENDER_TUNING.primary.wobbleFloor,s.wobble*NETWORK_RENDER_TUNING.primary.wobbleScale)
  });
  var secondaryStyle=Object.assign({},s,{
    thickness:Math.max(1,s.thickness*A.lerp(NETWORK_RENDER_TUNING.secondary.thicknessSparse,NETWORK_RENDER_TUNING.secondary.thicknessCrowded,crowd)),
    opacity:Math.max(NETWORK_RENDER_TUNING.secondary.opacityFloor,s.opacity*A.lerp(NETWORK_RENDER_TUNING.secondary.opacitySparse,NETWORK_RENDER_TUNING.secondary.opacityCrowded,crowd)),
    wobble:Math.max(NETWORK_RENDER_TUNING.secondary.wobbleFloor,s.wobble*NETWORK_RENDER_TUNING.secondary.wobbleScale)
  });

  for(var e=0;e<edges.length;e++){
    var edge=edges[e];
    var style=edge.primary?primaryStyle:secondaryStyle;
    A.drawLine(
      ctx,
      layout[edge.a],
      layout[edge.b],
      pal[(edge.a+edge.b+e)%pal.length],
      style,
      r
    );
  }

  for(var i=0;i<layout.length;i++){
    var node=layout[i];
    var chance=(s.shapeAmount/100)*A.lerp(NETWORK_RENDER_TUNING.nodes.visibleSparse,NETWORK_RENDER_TUNING.nodes.visibleCrowded,crowd);
    if(node.tier==='hero')chance=Math.max(chance,NETWORK_RENDER_TUNING.nodes.heroChanceFloor);
    else if(node.tier==='medium')chance=Math.max(chance,NETWORK_RENDER_TUNING.nodes.mediumChanceFloor);
    else chance*=NETWORK_RENDER_TUNING.nodes.smallChanceScale;

    if(r.chance(A.clamp(chance,0,1))){
      drawPlannedElement(ctx,node,i,s,r,pal,result.strategy);
    }

    if(node.tier==='hero'&&s.circles&&r.chance(NETWORK_RENDER_TUNING.rings.heroBaseChance+s.complexity/NETWORK_RENDER_TUNING.rings.complexityDivisor)){
      var ring=Math.max(NETWORK_RENDER_TUNING.rings.minimumRadiusPx,node.size/A.PHI/A.PHI);
      A.ellipse(
        ctx,
        {x:node.x,y:node.y},
        ring,
        ring/A.PHI,
        node.rot+A.GOLD,
        pal[(i+NETWORK_RENDER_TUNING.rings.paletteForwardOffset)%pal.length],
        secondaryStyle,
        r
      );
    }
  }

  return{
    layout:layout,
    strategy:'NETWORK-'+result.strategy,
    voids:result.voids,
    score:result.score,
    guide:{type:'network',layout:layout,edges:edges}
  };
}

function allocateScribbleSegments(total,anchors){
  var weights=[],sum=0,i;
  for(i=0;i<anchors;i++){
    var w=i===0?1.55:Math.pow(A.INV,i*.62);
    weights.push(w);
    sum+=w;
  }

  var counts=new Array(anchors).fill(0),used=0,fractions=[];
  for(i=0;i<anchors;i++){
    var raw=total*(weights[i]/sum);
    counts[i]=Math.floor(raw);
    used+=counts[i];
    fractions.push({i:i,f:raw-counts[i]});
  }

  fractions.sort(function(a,b){return b.f-a.f});
  for(i=0;i<total-used;i++)counts[fractions[i%fractions.length].i]++;
  return counts;
}

function drawScribble(ctx,s,r,pal){
  var variants=['RIBBON','CLUSTERS','KNOT','VOID','DUET'];
  var variant=variants[A.hash(s.seed+'|scribble-variant')%variants.length];
  var strategy=chooseStrategy(s);
  var crowd=crowdFactor(s);
  var segments=Math.max(SCRIBBLE_TUNING.composition.minimumSegments,Math.round(s.elements*A.lerp(SCRIBBLE_TUNING.composition.sparseSegmentMultiplier,SCRIBBLE_TUNING.composition.crowdedSegmentMultiplier,crowd)));
  var anchorCount=Math.max(SCRIBBLE_TUNING.composition.anchorMinimum,Math.min(SCRIBBLE_TUNING.composition.anchorMaximum,SCRIBBLE_TUNING.composition.anchorBase+Math.floor(s.complexity/SCRIBBLE_TUNING.composition.complexityPerAnchor)+Math.round(crowd*SCRIBBLE_TUNING.composition.crowdedAnchorGain)));

  if(variant==='DUET')anchorCount=SCRIBBLE_TUNING.composition.duetAnchorCount;
  if(variant==='KNOT')anchorCount=Math.min(SCRIBBLE_TUNING.composition.knotMaximumAnchors,anchorCount);
  if(variant==='CLUSTERS')anchorCount=Math.max(SCRIBBLE_TUNING.composition.clusterMinimumAnchors,anchorCount);

  var anchorR=A.makeR(s.seed+'|scribble-anchors|'+variant);
  var anchors=A.distributedPhiPoints(anchorCount,s,anchorR);
  var voids=(variant==='VOID'||s.negativeSpace>SCRIBBLE_TUNING.composition.nonVoidNegativeSpaceTrigger)
    ?makeReservedVoids(s,variant==='VOID'?'VOID':strategy,A.makeR(s.seed+'|scribble-voids|'+variant))
    :[];
  var portrait=s.orientation==='portrait';
  if(portrait&&variant!=='KNOT'){
    // Give disconnected gestures a vertical rhythm without forcing
    // everything into a line or destroying the reserved blank regions.
    for(var aIndex=0;aIndex<anchors.length;aIndex++){
      var t=aIndex/Math.max(1,anchors.length-1);
      var desiredX=A.W*(aIndex%2?A.INV:1-A.INV);
      var desiredY=A.H*(SCRIBBLE_TUNING.portrait.rhythmStart+SCRIBBLE_TUNING.portrait.rhythmSpan*t);
      var a=anchors[aIndex];
      a.x=A.lerp(a.x,desiredX,variant==='DUET'?SCRIBBLE_TUNING.portrait.duetHorizontalPull:SCRIBBLE_TUNING.portrait.otherHorizontalPull);
      a.y=A.lerp(a.y,desiredY,SCRIBBLE_TUNING.portrait.verticalPull);
      if(pointInVoid(a.x,a.y,voids)){
        var otherSide=A.W-(a.x);
        if(!pointInVoid(otherSide,a.y,voids))a.x=otherSide;
        else if(!pointInVoid(a.x,A.H*(SCRIBBLE_TUNING.portrait.fallbackStart+SCRIBBLE_TUNING.portrait.fallbackSpan*t),voids))a.y=A.H*(SCRIBBLE_TUNING.portrait.fallbackStart+SCRIBBLE_TUNING.portrait.fallbackSpan*t);
      }
    }
  }
  var counts=allocateScribbleSegments(segments,anchorCount);
  var style=Object.assign({},s,{
    wobble:Math.max(SCRIBBLE_TUNING.ink.minimumWobble,s.wobble),
    curveBias:Math.max(SCRIBBLE_TUNING.ink.minimumCurveBias,s.curveBias),
    overdraw:Math.max(SCRIBBLE_TUNING.ink.minimumOverdraw,s.overdraw)
  });
  var ghostStyle=Object.assign({},style,{
    thickness:Math.max(1,s.thickness*SCRIBBLE_TUNING.ink.ghostThicknessScale),
    opacity:Math.max(SCRIBBLE_TUNING.ink.ghostOpacityFloor,s.opacity*SCRIBBLE_TUNING.ink.ghostOpacityScale),
    overdraw:Math.max(1,Math.round(s.overdraw*SCRIBBLE_TUNING.ink.ghostOverdrawScale))
  });
  var markIndex=0;

  function prepareAnchor(index){
    var a=anchors[index];
    var next=anchors[(index+1)%anchors.length];

    if(variant==='RIBBON'){
      var diagonal=(A.hash(s.seed+'|scribble-ribbon')%2===0);
      var t=index/Math.max(1,anchors.length-1);
      var x=portrait
        ?A.W*(diagonal?.34+.29*t:.66-.29*t)
        :A.W*(.16+.68*t);
      var y=portrait
        ?A.H*(.15+.7*t)
        :(diagonal?A.H*(.2+.6*t):A.H*(.8-.6*t));
      a.x=A.lerp(a.x,x,.62);
      a.y=A.lerp(a.y,y,.62);
    }else if(variant==='KNOT'){
      var target=phiTargets()[A.hash(s.seed+'|scribble-knot')%4];
      a.x=A.lerp(a.x,target.x,.48);
      a.y=A.lerp(a.y,target.y,.48);
    }

    a.x=A.clamp(a.x,SCRIBBLE_TUNING.anchors.canvasInsetPx,A.W-SCRIBBLE_TUNING.anchors.canvasInsetPx);
    a.y=A.clamp(a.y,SCRIBBLE_TUNING.anchors.canvasInsetPx,A.H-SCRIBBLE_TUNING.anchors.canvasInsetPx);
    a.flow=Math.atan2(next.y-a.y,next.x-a.x);
    a.radius=A.qphi(
      Math.max(SCRIBBLE_TUNING.anchors.minimumRadiusPx,a.territory*A.lerp(SCRIBBLE_TUNING.anchors.radiusDensityMin,SCRIBBLE_TUNING.anchors.radiusDensityMax,s.density/100)),
      34,
      s.phiStrength/100
    );
    if(portrait){
      // A slightly larger gesture territory balances the long canvas;
      // KNOT deliberately stays concentrated at one focal location.
      a.radius=Math.min(A.W*SCRIBBLE_TUNING.anchors.portraitRadiusWidthCap,a.radius*(variant==='KNOT'?SCRIBBLE_TUNING.anchors.portraitKnotRadiusScale:SCRIBBLE_TUNING.anchors.portraitOtherRadiusScale));
    }
    return a;
  }

  for(var ai=0;ai<anchors.length;ai++)prepareAnchor(ai);
  if(portrait){
    // RIBBON and KNOT can move anchors after the initial void check.
    // Reposition any such anchor just outside the protected territory.
    for(var ai=0;ai<anchors.length;ai++){
      var a=anchors[ai];
      if(!pointInVoid(a.x,a.y,voids))continue;
      var oldX=a.x,oldY=a.y,relocated=false;
      for(var distance=28;distance<=252&&!relocated;distance+=28){
        for(var step=0;step<12;step++){
          var theta=step*A.TAU/12;
          var x=A.clamp(oldX+Math.cos(theta)*distance,24,A.W-24);
          var y=A.clamp(oldY+Math.sin(theta)*distance,24,A.H-24);
          if(!pointInVoid(x,y,voids)){
            a.x=x;a.y=y;relocated=true;break;
          }
        }
      }
    }
  }
  if(portrait&&variant!=='KNOT'){
    // Work out the flow after moving all the anchors, otherwise the first
    // gestures point at the old, pre-reflow coordinates of later anchors.
    for(var flowIndex=0;flowIndex<anchors.length;flowIndex++){
      var a=anchors[flowIndex];
      var neighbour=anchors[Math.min(flowIndex+1,anchors.length-1)];
      if(flowIndex===anchors.length-1){
        var previous=anchors[flowIndex-1];
        a.flow=Math.atan2(a.y-previous.y,a.x-previous.x);
      }else{
        a.flow=Math.atan2(neighbour.y-a.y,neighbour.x-a.x);
      }
    }
  }

  for(var ai=0;ai<anchors.length;ai++){
    var anchor=anchors[ai];
    var count=counts[ai];
    if(count<=0)continue;

    var startAngle=anchor.flow+A.GOLD*(ai+1);
    var startRadius=anchor.radius*(variant==='KNOT'?SCRIBBLE_STROKE_TUNING.motion.knotStartingRadius:SCRIBBLE_STROKE_TUNING.motion.otherStartingRadius);
    var p={
      x:A.clamp(anchor.x+Math.cos(startAngle)*startRadius,SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx,A.W-SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx),
      y:A.clamp(anchor.y+Math.sin(startAngle)*startRadius,SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx,A.H-SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx)
    };
    if(portrait&&pointInVoid(p.x,p.y,voids)){p.x=anchor.x;p.y=anchor.y;}
    var runLength=Math.max(SCRIBBLE_STROKE_TUNING.motion.minimumRunLength,Math.round(A.lerp(SCRIBBLE_STROKE_TUNING.motion.firstRunLong,SCRIBBLE_STROKE_TUNING.motion.firstRunShort,s.complexity/100)));
    var runPos=0;

    for(var local=0;local<count;local++){
      var progress=(local+.5)/Math.max(1,count);
      var flowMix=variant==='RIBBON'?SCRIBBLE_STROKE_TUNING.motion.ribbonFlowMix:(variant==='CLUSTERS'?SCRIBBLE_STROKE_TUNING.motion.clusterFlowMix:SCRIBBLE_STROKE_TUNING.motion.otherFlowMix);
      var goldenTurn=((local%2===0)?1:-1)*A.GOLD*A.lerp(SCRIBBLE_STROKE_TUNING.motion.goldenTurnLow,SCRIBBLE_STROKE_TUNING.motion.goldenTurnHigh,s.complexity/100);
      var angle=A.lerp(startAngle,anchor.flow,flowMix)+goldenTurn;
      angle+=Math.sin((local+1)*A.INV+ai*A.GOLD)*A.lerp(SCRIBBLE_STROKE_TUNING.motion.wobbleTurnLow,SCRIBBLE_STROKE_TUNING.motion.wobbleTurnHigh,s.wobble/100);
      angle+=r.range(-SCRIBBLE_STROKE_TUNING.motion.randomTurnRange,SCRIBBLE_STROKE_TUNING.motion.randomTurnRange);

      if(variant==='KNOT')angle+=Math.sin(progress*A.TAU*2)*SCRIBBLE_STROKE_TUNING.motion.knotTurnAmplitude;
      if(variant==='DUET'&&ai===1)angle+=Math.PI/A.PHI;

      var len=A.qphi(
        r.range(SCRIBBLE_STROKE_TUNING.motion.minimumStrokePx,SCRIBBLE_STROKE_TUNING.motion.maximumStrokePx)*A.lerp(1,SCRIBBLE_STROKE_TUNING.motion.crowdedStrokeScale,crowd)*A.lerp(SCRIBBLE_STROKE_TUNING.motion.densityLengthLow,SCRIBBLE_STROKE_TUNING.motion.densityLengthHigh,s.density/100),
        13,
        s.phiStrength/100
      );

      var q={
        x:p.x+Math.cos(angle)*len,
        y:p.y+Math.sin(angle)*len
      };

      var dx=q.x-anchor.x,dy=q.y-anchor.y;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>anchor.radius){
        var pull=A.clamp((dist-anchor.radius)/Math.max(1,anchor.radius),0,1);
        q.x=A.lerp(q.x,anchor.x,SCRIBBLE_STROKE_TUNING.motion.returnPullBase+SCRIBBLE_STROKE_TUNING.motion.returnPullGain*pull);
        q.y=A.lerp(q.y,anchor.y,SCRIBBLE_STROKE_TUNING.motion.returnPullBase+SCRIBBLE_STROKE_TUNING.motion.returnPullGain*pull);
      }

      var attempts=0;
      while((pointInVoid(q.x,q.y,voids)||
        (portrait&&segmentCrossesVoid(p.x,p.y,q.x,q.y,voids)))&&attempts<(portrait?SCRIBBLE_STROKE_TUNING.avoidance.portraitRetryLimit:SCRIBBLE_STROKE_TUNING.avoidance.landscapeRetryLimit)){
        angle+=A.GOLD*(attempts%2===0?1:-1);
        q.x=p.x+Math.cos(angle)*len;
        q.y=p.y+Math.sin(angle)*len;
        attempts++;
      }

      if(pointInVoid(q.x,q.y,voids)||
        (portrait&&segmentCrossesVoid(p.x,p.y,q.x,q.y,voids))){
        runPos=runLength;
        continue;
      }

      q.x=A.clamp(q.x,SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx,A.W-SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx);
      q.y=A.clamp(q.y,SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx,A.H-SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx);

      A.drawLine(ctx,p,q,pal[markIndex%pal.length],style,r);

      if(s.arcs&&r.chance((s.shapeAmount/100)*SCRIBBLE_STROKE_TUNING.embellishment.arcProbabilityScale)){
        var loop=A.qphi(Math.max(SCRIBBLE_STROKE_TUNING.embellishment.arcMinimumRadiusPx,len/A.PHI),9,s.phiStrength/100);
        A.arc(
          ctx,q,
          loop,
          angle+A.GOLD,
          A.TAU*A.INV,
          pal[(markIndex+2)%pal.length],
          ghostStyle,
          r
        );
      }

      p=q;
      markIndex++;
      runPos++;

      var deliberateBreak=runPos>=runLength;
      var stochasticBreak=r.chance(SCRIBBLE_STROKE_TUNING.breaks.spontaneousBreakChance+s.negativeSpace/SCRIBBLE_STROKE_TUNING.breaks.negativeSpaceBreakDivisor);
      if(deliberateBreak||stochasticBreak){
        var resetAngle=startAngle+(local+1)*A.GOLD;
        var resetRadius=anchor.radius*r.range(SCRIBBLE_STROKE_TUNING.breaks.resetRadiusLow,SCRIBBLE_STROKE_TUNING.breaks.resetRadiusHigh);
        p={
          x:A.clamp(anchor.x+Math.cos(resetAngle)*resetRadius,SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx,A.W-SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx),
          y:A.clamp(anchor.y+Math.sin(resetAngle)*resetRadius,SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx,A.H-SCRIBBLE_STROKE_TUNING.avoidance.canvasStrokeInsetPx)
        };
        if(portrait&&pointInVoid(p.x,p.y,voids)){p.x=anchor.x;p.y=anchor.y;}
        runLength=Math.max(SCRIBBLE_STROKE_TUNING.motion.minimumRunLength,Math.round(A.lerp(SCRIBBLE_STROKE_TUNING.breaks.laterRunLong,SCRIBBLE_STROKE_TUNING.breaks.laterRunShort,s.complexity/100)+r.range(SCRIBBLE_STROKE_TUNING.breaks.laterRunJitterLow,SCRIBBLE_STROKE_TUNING.breaks.laterRunJitterHigh)));
        runPos=0;
      }
    }

    if(ai<anchors.length-1&&variant==='RIBBON'&&s.lines&&r.chance(SCRIBBLE_STROKE_TUNING.embellishment.ribbonLinkChance)){
      var next=anchors[ai+1];
      if(!pointInVoid(anchor.x,anchor.y,voids)&&!pointInVoid(next.x,next.y,voids)){
        A.drawLine(ctx,anchor,next,pal[(markIndex+ai)%pal.length],ghostStyle,r);
      }
    }

    if(s.circles&&r.chance((s.shapeAmount/100)*SCRIBBLE_STROKE_TUNING.embellishment.haloProbabilityScale)){
      var halo=Math.max(SCRIBBLE_STROKE_TUNING.embellishment.haloMinimumRadiusPx,anchor.radius/A.PHI/A.PHI/A.PHI);
      A.ellipse(
        ctx,
        {x:anchor.x,y:anchor.y},
        halo,
        halo/A.PHI,
        startAngle,
        pal[(markIndex+3)%pal.length],
        ghostStyle,
        r
      );
    }
  }

  return{
    strategy:'SCRIBBLE-'+variant,
    voids:voids,
    guide:{type:'scribble',variant:variant,anchors:anchors}
  };
}

function drawOrganic(ctx,s,r,pal){
  var strategy=chooseStrategy(s);
  var organic=Object.assign({},s,{
    curveBias:Math.max(ORGANIC_TUNING.style.minimumCurveBias,s.curveBias),
    wobble:Math.max(ORGANIC_TUNING.style.minimumWobble,s.wobble)
  });
  var voids=makeReservedVoids(s,strategy,A.makeR(s.seed+'|organic-voids'));
  var portrait=s.orientation==='portrait';
  var roots=1+Math.floor(s.elements/ORGANIC_TUNING.roots.elementsPerAdditionalRoot);
  var rootPts=A.distributedPhiPoints(roots,organic,r);
  if(portrait){
    // A portrait drawing grows from the lower golden regions, rather
    // than treating the 1000x1400 canvas as a taller random field.
    for(var rootIndex=0;rootIndex<rootPts.length;rootIndex++){
      var rp=rootPts[rootIndex];
      var side=A.hash(s.seed+'|organic-portrait-side|'+rootIndex)%2;
      var goalX=A.W*(side?A.INV:(1-A.INV));
      var goalY=A.H*(ORGANIC_TUNING.roots.portraitStartHeight-rootIndex*ORGANIC_TUNING.roots.portraitHeightStep);
      rp.x=A.lerp(rp.x,goalX,ORGANIC_TUNING.roots.portraitHorizontalPull);
      rp.y=A.lerp(rp.y,goalY,ORGANIC_TUNING.roots.portraitVerticalPull);
      // Protected voids are intentionally left open even at root level.
      if(pointInVoid(rp.x,rp.y,voids)){
        // A large VOID can cover the lower-right (or lower-left) golden
        // region entirely. Search nearby alternative φ columns and heights
        // rather than relocating the root inside a second reserved area.
        var targetXs=[rp.x,A.W*ORGANIC_DETAIL_TUNING.fallback.nearLeftX,A.W*ORGANIC_DETAIL_TUNING.fallback.nearRightX,A.W*ORGANIC_DETAIL_TUNING.fallback.centreX,A.W*ORGANIC_DETAIL_TUNING.fallback.farLeftX,A.W*ORGANIC_DETAIL_TUNING.fallback.farRightX];
        var targetYs=[rp.y,A.H*ORGANIC_DETAIL_TUNING.fallback.firstY,A.H*ORGANIC_DETAIL_TUNING.fallback.secondY,A.H*ORGANIC_DETAIL_TUNING.fallback.thirdY,A.H*ORGANIC_DETAIL_TUNING.fallback.fourthY];
        var rootClear=false;
        for(var yi=0;yi<targetYs.length&&!rootClear;yi++){
          for(var xi=0;xi<targetXs.length;xi++){
            if(!pointInVoid(targetXs[xi],targetYs[yi],voids)){
              rp.x=targetXs[xi];rp.y=targetYs[yi];
              rootClear=true;break;
            }
          }
        }
      }
    }
  }
  var queue=[];
  var maxSegments=Math.max(ORGANIC_TUNING.limits.minimumSegments,s.elements);
  var maxDepth=Math.max(ORGANIC_TUNING.limits.minimumDepth,Math.min(ORGANIC_TUNING.limits.maximumDepth,ORGANIC_TUNING.limits.baseDepth+Math.round(s.recursion*ORGANIC_TUNING.limits.recursionDepthGain)));
  var drawn=0;
  var guideSegments=[];

  for(var ri=0;ri<roots;ri++){
    var rp=rootPts[ri];
    var toward=portrait?-Math.PI/2:Math.atan2(A.H*.5-rp.y,A.W*.5-rp.x);
    queue.push({
      x:rp.x,y:rp.y,
      angle:toward+r.range(portrait?-ORGANIC_TUNING.roots.portraitAngleJitter:-ORGANIC_TUNING.roots.landscapeAngleJitter,portrait?ORGANIC_TUNING.roots.portraitAngleJitter:ORGANIC_TUNING.roots.landscapeAngleJitter),
      len:A.qphi(portrait?r.range(A.H*ORGANIC_TUNING.roots.portraitLengthMin,A.H*ORGANIC_TUNING.roots.portraitLengthMax):r.range(ORGANIC_TUNING.roots.landscapeLengthMinPx,ORGANIC_TUNING.roots.landscapeLengthMaxPx),34,s.phiStrength/100),
      depth:0,
      branch:ri
    });
  }

  while(queue.length&&drawn<maxSegments){
    var node=queue.shift();
    var angle=node.angle;
    var len=node.len;
    var ex=node.x+Math.cos(angle)*len;
    var ey=node.y+Math.sin(angle)*len;

    if(portrait){
      // Try different branch directions before drawing; never draw a
      // segment through intentionally protected negative space.
      var baseAngle=angle,free=false;
      for(var attempt=0;attempt<ORGANIC_TUNING.avoidance.portraitRetryLimit;attempt++){
        var turn=attempt===0?0:(attempt%2?1:-1)*
          A.GOLD*(ORGANIC_TUNING.avoidance.retryAngleBase+ORGANIC_TUNING.avoidance.retryAngleGrowth*Math.ceil(attempt/2));
        var candidate=baseAngle+turn;
        // Test the endpoint *after* clamping to the canvas. Clamping
        // changes the segment and can route it across a reserved void.
        var candidateX=A.clamp(node.x+Math.cos(candidate)*len,ORGANIC_TUNING.avoidance.endpointCanvasInsetPx,A.W-ORGANIC_TUNING.avoidance.endpointCanvasInsetPx);
        var candidateY=A.clamp(node.y+Math.sin(candidate)*len,ORGANIC_TUNING.avoidance.endpointCanvasInsetPx,A.H-ORGANIC_TUNING.avoidance.endpointCanvasInsetPx);
        if(!segmentCrossesVoid(node.x,node.y,candidateX,candidateY,voids)){
          angle=candidate;ex=candidateX;ey=candidateY;free=true;break;
        }
      }
      if(!free)continue;
    }else if(pointInVoid(ex,ey,voids)){
      angle+=A.GOLD*(r.chance(.5)?1:-1)*ORGANIC_TUNING.avoidance.landscapeVoidTurnScale;
      ex=node.x+Math.cos(angle)*len;
      ey=node.y+Math.sin(angle)*len;
    }

    ex=A.clamp(ex,ORGANIC_TUNING.avoidance.endpointCanvasInsetPx,A.W-ORGANIC_TUNING.avoidance.endpointCanvasInsetPx);
    ey=A.clamp(ey,ORGANIC_TUNING.avoidance.endpointCanvasInsetPx,A.H-ORGANIC_TUNING.avoidance.endpointCanvasInsetPx);

    A.drawLine(ctx,{x:node.x,y:node.y},{x:ex,y:ey},pal[drawn%pal.length],organic,r);
    guideSegments.push({x1:node.x,y1:node.y,x2:ex,y2:ey,depth:node.depth});
    drawn++;

    if(r.chance(organic.shapeAmount/ORGANIC_TUNING.details.budChanceDivisor)){
      var rad=Math.max(ORGANIC_TUNING.details.budMinimumRadiusPx,len/A.PHI/A.PHI/ORGANIC_DETAIL_TUNING.bud.radiusDivisor);
      A.ellipse(ctx,{x:ex,y:ey},rad,rad/A.PHI,angle,pal[(drawn+ORGANIC_DETAIL_TUNING.bud.paletteForwardOffset)%pal.length],organic,r);
    }

    if(node.depth>=maxDepth||drawn>=maxSegments)continue;

    var nextLen=len/A.PHI*r.range(ORGANIC_TUNING.limits.childLengthScaleMin,ORGANIC_TUNING.limits.childLengthScaleMax);
    if(nextLen<ORGANIC_TUNING.limits.minimumChildLengthPx)continue;

    var branches=portrait&&node.depth<ORGANIC_TUNING.branches.portraitGuaranteedSplitDepth?2:(r.chance((portrait?ORGANIC_TUNING.branches.portraitSplitChance:ORGANIC_TUNING.branches.landscapeSplitChance)+organic.complexity/(portrait?ORGANIC_TUNING.branches.portraitComplexityDivisor:ORGANIC_TUNING.branches.landscapeComplexityDivisor))?2:1);
    for(var b=0;b<branches;b++){
      var sign=branches===1?r.sign():(b===0?-1:1);
      var turn=A.GOLD*A.lerp(portrait?ORGANIC_TUNING.branches.portraitTurnMin:ORGANIC_TUNING.branches.landscapeTurnMin,portrait?ORGANIC_TUNING.branches.portraitTurnMax:ORGANIC_TUNING.branches.landscapeTurnMax,organic.complexity/100)*sign;
      var childAngle=angle+turn+r.range(-ORGANIC_TUNING.branches.directionJitter,ORGANIC_TUNING.branches.directionJitter);
      if(portrait)childAngle=A.lerp(childAngle,-Math.PI/2,ORGANIC_TUNING.branches.portraitUpwardPull);
      queue.push({
        x:ex,y:ey,
        angle:childAngle,
        len:nextLen,
        depth:node.depth+1,
        branch:node.branch
      });
    }
  }

  return{
    strategy:strategy,
    voids:voids,
    guide:{type:'organic',roots:rootPts,segments:guideSegments}
  };
}

// V7 grows along the long canvas axis. Landscape uses the established
// portrait growth grammar in a rotated coordinate space; V1–V6 stay untouched.
function drawOrganicV7(ctx,s,r,pal){
  if(s.orientation==='portrait')return drawOrganic(ctx,s,r,pal);
  var width=A.W,height=A.H,meta;
  var svgStart=A.svgRecorder?A.svgRecorder.paths.length:0;
  ctx.save();
  ctx.translate(width,0);
  ctx.rotate(Math.PI/2);
  A.W=height;A.H=width;
  try{
    meta=drawOrganic(ctx,Object.assign({},s,{orientation:'portrait'}),r,pal);
  }finally{
    A.W=width;A.H=height;
    ctx.restore();
  }
  if(A.svgRecorder){
    for(var pathIndex=svgStart;pathIndex<A.svgRecorder.paths.length;pathIndex++){
      A.svgRecorder.paths[pathIndex].transform='matrix(0 1 -1 0 '+width+' 0)';
    }
  }
  meta.voids=meta.voids.map(function(v){
    return{x:width-v.y-v.h,y:v.x,w:v.h,h:v.w};
  });
  meta.guide.roots=meta.guide.roots.map(function(p){
    return Object.assign({},p,{x:width-p.y,y:p.x});
  });
  meta.guide.segments=meta.guide.segments.map(function(p){
    return{x1:width-p.y1,y1:p.x1,x2:width-p.y2,y2:p.x2,depth:p.depth};
  });
  return meta;
}

function drawConstructedShape(ctx,item,index,s,r,pal,style){
  var shapes=enabledShapes(s);
  var nonLines=shapes.filter(function(sh){return sh!=='line'});
  var shape;

  if(item.shape){
    shape=item.shape;
  }else if(item.tier==='hero'&&nonLines.length){
    shape=nonLines[(A.hash(s.seed+'|constructed-hero|'+index))%nonLines.length];
  }else{
    shape=shapes[(A.hash(s.seed+'|constructed-shape|'+index))%shapes.length];
  }

  var c={x:item.x,y:item.y};
  var size=item.size;
  var rot=item.rot;
  var col=pal[index%pal.length];
  var ratio=A.lerp(r.range(CONSTRUCTED_TUNING.mark.randomRatioMinimum,CONSTRUCTED_TUNING.mark.randomRatioMaximum),A.PHI,s.phiStrength/100);

  if(shape==='line'){
    var half=size*CONSTRUCTED_TUNING.mark.lineHalfSizeFraction;
    A.drawLine(
      ctx,
      {x:c.x-Math.cos(rot)*half,y:c.y-Math.sin(rot)*half},
      {x:c.x+Math.cos(rot)*half,y:c.y+Math.sin(rot)*half},
      col,style,r
    );
  }else if(shape==='circle'){
    A.ellipse(ctx,c,size*.5,size/(2*ratio),rot,col,style,r);
  }else if(shape==='rect'){
    A.rect(ctx,c,size,size/ratio,rot,col,style,r);
  }else if(shape==='poly'){
    A.poly(ctx,c,size*.5,[3,5,8][index%3],rot,col,style,r);
  }else{
    A.arc(ctx,c,size*.5,rot,A.TAU*A.INV,col,style,r);
  }

  if(item.tier==='hero'&&r.chance(CONSTRUCTED_TUNING.mark.heroAccentBaseChance+s.nesting/CONSTRUCTED_TUNING.mark.heroAccentNestingDivisor)){
    var accent=pal[(index+2)%pal.length];
    var inner=size/A.PHI;
    if(shape==='circle'&&s.circles){
      A.ellipse(ctx,c,inner*.5,inner/(2*A.PHI),rot+A.GOLD,accent,style,r);
    }else if(shape==='rect'&&s.rectangles){
      A.rect(ctx,c,inner,inner/A.PHI,rot+A.GOLD*CONSTRUCTED_TUNING.mark.innerRectangleGoldenOffset,accent,style,r);
    }else if(s.arcs){
      A.arc(ctx,c,inner*CONSTRUCTED_TUNING.mark.innerArcRadiusFraction,rot+A.GOLD,A.TAU*(1-A.INV),accent,style,r);
    }
  }
}

function drawGeometric(ctx,s,r,pal){
  var variants=['BALANCE','STACK','AXIS','COLLISION','FLOAT','CROP'];
  var variant=variants[A.hash(s.seed+'|constructed-variant')%variants.length];
  var crowd=crowdFactor(s);
  var count=Math.max(CONSTRUCTED_TUNING.density.minimumItems,Math.min(CONSTRUCTED_TUNING.density.maximumItems,Math.round(
    CONSTRUCTED_TUNING.density.baseItems+s.elements*CONSTRUCTED_TUNING.density.elementsGain+s.complexity*CONSTRUCTED_TUNING.density.complexityGain
  )));
  var targets=phiTargets();
  var points=A.distributedPhiPoints(count,s,A.makeR(s.seed+'|constructed-points|'+variant));
  var items=[];
  var voids=[];
  var geometric=Object.assign({},s,{
    curveBias:Math.min(CONSTRUCTED_TUNING.style.maximumCurveBias,s.curveBias),
    wobble:Math.min(CONSTRUCTED_TUNING.style.maximumWobble,s.wobble),
    overdraw:Math.max(1,Math.min(s.overdraw,CONSTRUCTED_TUNING.style.maximumOverdraw))
  });
  var ghostStyle=Object.assign({},geometric,{
    thickness:Math.max(1,s.thickness*CONSTRUCTED_TUNING.style.ghostThicknessFraction),
    opacity:Math.max(CONSTRUCTED_TUNING.style.ghostOpacityFloor,s.opacity*CONSTRUCTED_TUNING.style.ghostOpacityFraction),
    overdraw:Math.max(1,Math.round(geometric.overdraw*CONSTRUCTED_TUNING.style.ghostOverdrawFraction))
  });
  var phase=r.range(0,A.TAU);
  var heroTarget=targets[A.hash(s.seed+'|constructed-focus')%targets.length];
  var reverse=(A.hash(s.seed+'|constructed-reverse')%2)===1;
  var horizontal=(A.hash(s.seed+'|constructed-axis')%2)===1;

  function qsize(raw,tier){
    var base=tier==='hero'?55:34;
    var size=A.qphi(raw,base,s.phiStrength/100);
    if(tier==='hero')size=Math.max(size,CONSTRUCTED_TUNING.size.heroMinimumPx);
    if(tier==='small')size=Math.min(size,CONSTRUCTED_TUNING.size.smallMaximumPx);
    return A.clamp(size,CONSTRUCTED_TUNING.size.minimumPx,variant==='CROP'?CONSTRUCTED_TUNING.size.cropMaximumPx:CONSTRUCTED_TUNING.size.normalMaximumPx);
  }

  function add(x,y,size,rot,tier,shape){
    items.push({
      x:x,y:y,
      size:qsize(size,tier),
      rot:rot,
      tier:tier,
      shape:shape||null
    });
  }

  if(variant==='BALANCE'){
    var pair=(A.hash(s.seed+'|constructed-balance-pair')%2===0)
      ?[targets[0],targets[3]]
      :[targets[1],targets[2]];

    add(pair[0].x,pair[0].y,r.range(235,360),phase,'hero');
    add(pair[1].x,pair[1].y,r.range(175,285),phase+A.GOLD,'hero');

    for(var bi=2;bi<count;bi++){
      var bp=points[bi];
      var side=bi%2;
      var focus=pair[side];
      var mix=r.range(.12,.42);
      add(
        A.lerp(bp.x,focus.x,mix),
        A.lerp(bp.y,focus.y,mix),
        r.range(58,155)*A.lerp(1,.78,crowd),
        phase+bi*A.GOLD,
        bi<7?'medium':'small'
      );
    }
  }else if(variant==='STACK'){
    var stackX=horizontal?A.W*.5:heroTarget.x;
    var stackY=horizontal?heroTarget.y:A.H*.5;
    var span=horizontal?A.W*.72:A.H*.72;

    for(var si=0;si<count;si++){
      var st=count===1?.5:si/(count-1);
      var offset=(st-.5)*span;
      var x=horizontal?A.W*.5+offset:stackX+Math.sin(si*A.GOLD)*A.W*.07;
      var y=horizontal?stackY+Math.sin(si*A.GOLD)*A.H*.075:A.H*.5+offset;
      var tier=(si===Math.round(count*A.INV)||si===Math.round(count*(1-A.INV)))?'hero':
        (si%4===0?'medium':'small');
      var scale=tier==='hero'?r.range(190,300):(tier==='medium'?r.range(95,170):r.range(42,100));
      add(x,y,scale,phase+(si%2===0?0:A.GOLD),tier);
    }
  }else if(variant==='AXIS'){
    var a1,a2;
    if(horizontal){
      a1={x:A.W*.08,y:reverse?A.H*.7:A.H*.3};
      a2={x:A.W*.92,y:reverse?A.H*.3:A.H*.7};
    }else{
      a1={x:reverse?A.W*.7:A.W*.3,y:A.H*.08};
      a2={x:reverse?A.W*.3:A.W*.7,y:A.H*.92};
    }
    var axisAngle=Math.atan2(a2.y-a1.y,a2.x-a1.x);
    var perp=axisAngle+Math.PI/2;

    if(s.lines){
      A.drawLine(ctx,a1,a2,pal[0],ghostStyle,r);
    }

    for(var ai=0;ai<count;ai++){
      var at=(ai+.5)/count;
      var baseX=A.lerp(a1.x,a2.x,at);
      var baseY=A.lerp(a1.y,a2.y,at);
      var side=(ai%2===0?1:-1);
      var distance=A.qphi(r.range(22,135),22,s.phiStrength/100)*side;
      var tier=(ai===Math.round((count-1)*A.INV))?'hero':
        (ai%5===0?'medium':'small');
      add(
        baseX+Math.cos(perp)*distance,
        baseY+Math.sin(perp)*distance,
        tier==='hero'?r.range(220,335):(tier==='medium'?r.range(100,175):r.range(48,115)),
        axisAngle+(ai%3-1)*A.GOLD*.36,
        tier
      );
    }
  }else if(variant==='COLLISION'){
    var centre={
      x:A.lerp(A.W*.5,heroTarget.x,.62),
      y:A.lerp(A.H*.5,heroTarget.y,.62)
    };
    var heroShapes=['circle','rect','poly'].filter(function(sh){
      return(sh==='circle'&&s.circles)||(sh==='rect'&&s.rectangles)||(sh==='poly'&&s.polygons);
    });
    if(!heroShapes.length)heroShapes=enabledShapes(s);

    for(var ci=0;ci<3;ci++){
      var cr=A.qphi(r.range(28,78),21,s.phiStrength/100);
      var ca=phase+ci*A.GOLD;
      add(
        centre.x+Math.cos(ca)*cr,
        centre.y+Math.sin(ca)*cr,
        r.range(230,390)*(ci===0?1:.8),
        phase+ci*A.GOLD*.7,
        'hero',
        heroShapes[ci%heroShapes.length]
      );
    }

    for(var cs=3;cs<count;cs++){
      var cp=points[cs];
      var orbit=A.qphi(r.range(135,420),34,s.phiStrength/100);
      var angle=phase+cs*A.GOLD;
      var ox=centre.x+Math.cos(angle)*orbit;
      var oy=centre.y+Math.sin(angle)*orbit*.72;
      add(
        A.lerp(cp.x,ox,.68),
        A.lerp(cp.y,oy,.68),
        cs%5===0?r.range(95,165):r.range(38,105),
        angle,
        cs%5===0?'medium':'small'
      );
    }
  }else if(variant==='FLOAT'){
    voids=makeReservedVoids(
      Object.assign({},s,{negativeSpace:Math.max(48,s.negativeSpace)}),
      'VOID',
      A.makeR(s.seed+'|constructed-float-voids')
    );
    var heroPlaced=false;

    for(var fi=0;fi<count;fi++){
      var fp=points[fi];
      if(pointInVoid(fp.x,fp.y,voids))continue;
      var tier=!heroPlaced?'hero':(fi%5===0?'medium':'small');
      heroPlaced=true;
      add(
        fp.x,fp.y,
        tier==='hero'?r.range(230,350):(tier==='medium'?r.range(95,165):r.range(34,92)),
        phase+fi*A.GOLD,
        tier
      );
    }
  }else{
    var edges=[
      {x:-A.W*.08,y:A.H*A.INV,rot:0},
      {x:A.W*1.08,y:A.H*(1-A.INV),rot:Math.PI},
      {x:A.W*A.INV,y:-A.H*.1,rot:Math.PI/2},
      {x:A.W*(1-A.INV),y:A.H*1.1,rot:-Math.PI/2}
    ];
    var start=A.hash(s.seed+'|constructed-crop-edge')%edges.length;

    for(var ei=0;ei<Math.min(3,count);ei++){
      var edge=edges[(start+ei)%edges.length];
      add(
        edge.x,edge.y,
        r.range(300,470),
        edge.rot+phase*.35+ei*A.GOLD*.28,
        'hero'
      );
    }

    for(var crp=items.length;crp<count;crp++){
      var pp=points[crp];
      add(
        pp.x,pp.y,
        crp%5===0?r.range(105,180):r.range(42,110),
        phase+crp*A.GOLD,
        crp%5===0?'medium':'small'
      );
    }
  }

  for(var i=0;i<items.length;i++){
    var item=items[i];

    if(variant!=='CROP'){
      item.x=A.clamp(item.x,CONSTRUCTED_TUNING.finish.uncroppedInsetPx,A.W-CONSTRUCTED_TUNING.finish.uncroppedInsetPx);
      item.y=A.clamp(item.y,CONSTRUCTED_TUNING.finish.uncroppedInsetPx,A.H-CONSTRUCTED_TUNING.finish.uncroppedInsetPx);
    }

    if(pointInVoid(item.x,item.y,voids))continue;
    drawConstructedShape(ctx,item,i,s,r,pal,geometric);

    if(s.lines&&variant!=='AXIS'&&item.tier!=='small'&&r.chance(CONSTRUCTED_TUNING.finish.guideBaseChance+s.complexity/CONSTRUCTED_TUNING.finish.guideComplexityDivisor)){
      var len=item.size/A.PHI;
      var angle=item.rot+A.GOLD;
      A.drawLine(
        ctx,
        {x:item.x-Math.cos(angle)*len*.5,y:item.y-Math.sin(angle)*len*.5},
        {x:item.x+Math.cos(angle)*len*.5,y:item.y+Math.sin(angle)*len*.5},
        pal[(i+3)%pal.length],
        ghostStyle,
        r
      );
    }
  }

  return{
    strategy:'CONSTRUCTED-'+variant,
    voids:voids,
    guide:{type:'constructed',variant:variant,items:items}
  };
}

A.geometryOverlay=function(ctx,s,meta){
  meta=meta||{};
  var guide=meta.guide||null;
  var targets=phiTargets();

  function line(a,b,color,width,dash,alpha){
    ctx.save();
    ctx.globalAlpha=alpha==null?1:alpha;
    ctx.strokeStyle=color;
    ctx.lineWidth=width||1;
    ctx.setLineDash(dash||[]);
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(b.x,b.y);
    ctx.stroke();
    ctx.restore();
  }

  function cross(p,color,size,width){
    size=size||12;
    line({x:p.x-size,y:p.y},{x:p.x+size,y:p.y},color,width||2,[],.95);
    line({x:p.x,y:p.y-size},{x:p.x,y:p.y+size},color,width||2,[],.95);
  }

  function ring(p,radius,color,width,dash,alpha){
    ctx.save();
    ctx.globalAlpha=alpha==null?1:alpha;
    ctx.strokeStyle=color;
    ctx.lineWidth=width||1;
    ctx.setLineDash(dash||[]);
    ctx.beginPath();
    ctx.arc(p.x,p.y,Math.max(2,radius),0,A.TAU);
    ctx.stroke();
    ctx.restore();
  }

  function label(text,x,y,color,bg){
    ctx.save();
    ctx.font='bold 13px Courier New, monospace';
    ctx.textBaseline='middle';
    var pad=5;
    var w=ctx.measureText(text).width+pad*2;
    ctx.fillStyle=bg||'rgba(17,17,15,.88)';
    ctx.fillRect(x,y-10,w,20);
    ctx.fillStyle=color||'#d9ff54';
    ctx.fillText(text,x+pad,y);
    ctx.restore();
  }

  function nearestTarget(p){
    var best=targets[0],bestD=Infinity;
    for(var i=0;i<targets.length;i++){
      var dx=p.x-targets[i].x,dy=p.y-targets[i].y;
      var d=dx*dx+dy*dy;
      if(d<bestD){bestD=d;best=targets[i]}
    }
    return best;
  }

  function drawLayout(layout,showConnections){
    if(!layout)return;
    for(var i=0;i<layout.length;i++){
      var o=layout[i];
      var color=o.tier==='hero'?'#ff6138':(o.tier==='medium'?'#2b59ff':'#11110f');
      var radius=Math.max(5,o.size*.5);
      ring(o,radius,color,o.tier==='hero'?3:1.4,o.tier==='small'?[5,7]:[],o.tier==='small'?.38:.75);
      cross(o,color,o.tier==='hero'?14:7,o.tier==='hero'?3:1.5);

      if(o.tier!=='small'){
        var target=nearestTarget(o);
        line(o,target,color,1,[7,7],.38);
      }

      if(o.tier==='hero'){
        label('HERO / φ-SCALE '+Math.round(o.size),o.x+14,o.y-16,'#11110f','#ff6138');
      }else if(o.tier==='medium'&&i<10){
        label('MED '+Math.round(o.size),o.x+9,o.y-11,'#fff','#2b59ff');
      }
    }
  }

  // X-ray wash: artwork remains visible, but the construction becomes dominant.
  ctx.save();
  ctx.fillStyle='rgba(245,240,230,.48)';
  ctx.fillRect(0,0,A.W,A.H);
  ctx.restore();

  // Overall golden-ratio scaffold.
  [A.INV,1-A.INV].forEach(function(v,index){
    line({x:A.W*v,y:0},{x:A.W*v,y:A.H},'#11110f',1,[9,8],.55);
    line({x:0,y:A.H*v},{x:A.W,y:A.H*v},'#11110f',1,[9,8],.55);
    label(index===0?'1/φ  0.618':'1−1/φ  0.382',A.W*v+6,24,'#11110f','rgba(217,255,84,.9)');
  });

  for(var t=0;t<targets.length;t++){
    cross(targets[t],'#ff6138',15,2.5);
    ring(targets[t],24,'#ff6138',1,[4,5],.75);
    label('φ'+(t+1),targets[t].x+17,targets[t].y-18,'#11110f','#ff6138');
  }

  // Composition-aware golden frame. Reveal φ should explain this artwork,
  // not paste a generic diagram over the centre of the canvas.
  function revealFocus(){
    var pts=[],heroes=[],i;
    function add(p,hero){
      if(!p||!isFinite(p.x)||!isFinite(p.y))return;
      pts.push(p);
      if(hero)heroes.push(p);
    }

    if(guide&&guide.type==='layout'){
      for(i=0;i<guide.layout.length;i++)add(guide.layout[i],guide.layout[i].tier==='hero');
    }else if(guide&&guide.type==='network'){
      for(i=0;i<guide.layout.length;i++)add(guide.layout[i],guide.layout[i].tier==='hero');
    }else if(guide&&guide.type==='constructed'){
      for(i=0;i<guide.items.length;i++)add(guide.items[i],guide.items[i].tier==='hero');
    }else if(guide&&guide.type==='spiral'){
      // The real spiral system already exposes its construction hubs.
      for(i=0;i<guide.centres.length;i++)add(guide.centres[i],true);
      for(i=0;i<guide.points.length;i++)add(guide.points[i],false);
    }else if(guide&&guide.type==='burst'){
      for(i=0;i<guide.hubs.length;i++)add(guide.hubs[i],true);
      for(i=0;i<guide.rays.length;i++)add(guide.rays[i],false);
    }else if(guide&&guide.type==='scribble'){
      for(i=0;i<guide.anchors.length;i++)add(guide.anchors[i],i===0);
    }else if(guide&&guide.type==='organic'){
      for(i=0;i<guide.roots.length;i++)add(guide.roots[i],true);
      for(i=0;i<guide.segments.length;i++){
        add({x:guide.segments[i].x1,y:guide.segments[i].y1},false);
        add({x:guide.segments[i].x2,y:guide.segments[i].y2},false);
      }
    }else if(guide&&guide.type==='rects'){
      // Recursive rectangles have a genuine root frame, so use it directly.
      var rr=guide.root;
      return{cx:rr.x+rr.w*.5,cy:rr.y+rr.h*.5,w:rr.w,h:rr.h,angle:0,anchor:{x:rr.x+rr.w*A.INV,y:rr.y+rr.h*A.INV}};
    }

    if(!pts.length)return{cx:A.W*.5,cy:A.H*.5,w:A.W*.72,h:A.H*.72,angle:0,anchor:{x:A.W*A.INV,y:A.H*A.INV}};

    var focus=heroes.length?heroes[0]:pts[0];
    if(heroes.length>1){
      // Use the largest hero where size exists; this makes the reveal follow
      // the composition's dominant visual mass.
      focus=heroes.slice().sort(function(a,b){return(b.size||0)-(a.size||0)})[0];
    }

    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(i=0;i<pts.length;i++){
      var rad=Math.max(0,(pts[i].size||0)*.5);
      minX=Math.min(minX,pts[i].x-rad); minY=Math.min(minY,pts[i].y-rad);
      maxX=Math.max(maxX,pts[i].x+rad); maxY=Math.max(maxY,pts[i].y+rad);
    }
    var spanW=A.clamp(maxX-minX,240,A.W*.92);
    var spanH=A.clamp(maxY-minY,180,A.H*.92);
    var long=Math.max(spanW,spanH);
    var frameW,frameH;
    if(spanW>=spanH){frameW=long;frameH=long/A.PHI}
    else{frameH=long;frameW=long/A.PHI}

    // Centre the golden frame so the dominant hero lies on a 0.618 intersection.
    var left=focus.x-frameW*A.INV;
    var top=focus.y-frameH*A.INV;
    left=A.clamp(left,18,A.W-frameW-18);
    top=A.clamp(top,18,A.H-frameH-18);

    return{
      cx:left+frameW*.5,cy:top+frameH*.5,w:frameW,h:frameH,
      angle:focus.rot||0,
      anchor:{x:left+frameW*A.INV,y:top+frameH*A.INV}
    };
  }

  var rf=revealFocus();
  var frameLeft=rf.cx-rf.w*.5,frameTop=rf.cy-rf.h*.5;
  ctx.save();
  ctx.strokeStyle='#b8860b';
  ctx.globalAlpha=.58;
  ctx.lineWidth=2.2;
  ctx.setLineDash([]);
  ctx.strokeRect(frameLeft,frameTop,rf.w,rf.h);
  ctx.globalAlpha=.32;
  ctx.setLineDash([7,7]);
  ctx.beginPath();
  ctx.moveTo(frameLeft+rf.w*A.INV,frameTop);ctx.lineTo(frameLeft+rf.w*A.INV,frameTop+rf.h);
  ctx.moveTo(frameLeft,frameTop+rf.h*A.INV);ctx.lineTo(frameLeft+rf.w,frameTop+rf.h*A.INV);
  ctx.stroke();
  ctx.restore();
  cross(rf.anchor,'#b8860b',13,2.5);
  label('COMPOSITION φ FRAME',frameLeft+8,frameTop+16,'#fff','#b8860b');

  // True golden spiral, now anchored to the artwork's dominant φ intersection.
  // r(θ + π/2) = φr(θ), therefore b = 2 ln(φ) / π.
  var spiralB=2*Math.log(A.PHI)/Math.PI;
  var spiralCx=rf.anchor.x,spiralCy=rf.anchor.y;
  var spiralTurns=2.0;
  var spiralEnd=spiralTurns*A.TAU;
  var spiralMax=Math.min(rf.w,rf.h)*.72;
  var spiralStart=spiralMax/Math.exp(spiralB*spiralEnd);
  var spiralPhase=(rf.angle||0)-Math.PI/2;

  ctx.save();
  ctx.strokeStyle='#b8860b';
  ctx.globalAlpha=.52;
  ctx.lineWidth=2.4;
  ctx.beginPath();
  for(var g=0;g<=240;g++){
    var theta=spiralEnd*g/240;
    var gr=spiralStart*Math.exp(spiralB*theta);
    var gx=spiralCx+Math.cos(spiralPhase+theta)*gr;
    var gy=spiralCy+Math.sin(spiralPhase+theta)*gr;
    if(g===0)ctx.moveTo(gx,gy);else ctx.lineTo(gx,gy);
  }
  ctx.stroke();

  for(var q=0;q<=Math.floor(spiralTurns*4);q++){
    var qt=q*Math.PI/2;
    var qr=spiralStart*Math.exp(spiralB*qt);
    var qx=spiralCx+Math.cos(spiralPhase+qt)*qr;
    var qy=spiralCy+Math.sin(spiralPhase+qt)*qr;
    ctx.globalAlpha=.22;
    ctx.setLineDash([4,7]);
    ctx.beginPath();
    ctx.moveTo(spiralCx,spiralCy);
    ctx.lineTo(qx,qy);
    ctx.stroke();
  }
  ctx.restore();
  label('GOLDEN SPIRAL · ANCHORED TO HERO',spiralCx+16,spiralCy-18,'#fff','#b8860b');

  // Reserved negative-space regions are part of the composition logic.
  var voids=meta.voids||[];
  for(var v=0;v<voids.length;v++){
    var box=voids[v];
    ctx.save();
    ctx.fillStyle='rgba(255,97,56,.12)';
    ctx.strokeStyle='#ff6138';
    ctx.lineWidth=3;
    ctx.setLineDash([12,8]);
    ctx.fillRect(box.x,box.y,box.w,box.h);
    ctx.strokeRect(box.x,box.y,box.w,box.h);
    ctx.restore();
    label('RESERVED VOID',box.x+8,box.y+16,'#11110f','#ff6138');
  }

  if(guide&&guide.type==='layout'){
    if(guide.relationships){
      for(var lr=0;lr<guide.layout.length;lr++){
        var linked=guide.layout[lr];
        if(linked.parentHeroIndex==null||linked.parentHeroIndex<0)continue;
        var parent=guide.layout[linked.parentHeroIndex];
        if(!parent)continue;
        line(parent,linked,linked.tier==='medium'?'#2b59ff':'#11110f',linked.tier==='medium'?2:1,[5,6],linked.tier==='medium'?.5:.22);
        if(linked.tier==='medium'&&linked.phiDistance){
          ring(parent,linked.phiDistance,'#b8860b',1,[3,7],.18);
        }
      }
      label('FIELD FAMILIES / φ-DISTANCE LINKS',32,A.H-32,'#11110f','#d9ff54');
    }
    drawLayout(guide.layout,true);
  }

  if(guide&&guide.type==='network'){
    for(var ne=0;ne<guide.edges.length;ne++){
      var edge=guide.edges[ne];
      var a=guide.layout[edge.a],b=guide.layout[edge.b];
      line(a,b,edge.primary?'#ff6138':'#2b59ff',edge.primary?3:1.4,edge.primary?[]:[5,7],edge.primary?.8:.45);
    }
    drawLayout(guide.layout,false);
    label('BACKBONE / LOW-CROSSING φ LINKS',32,A.H-32,'#fff','#2b59ff');
  }

  if(guide&&guide.type==='spiral'){
    for(var sc=0;sc<guide.centres.length;sc++){
      cross(guide.centres[sc],'#2b59ff',18,3);
      ring(guide.centres[sc],32,'#2b59ff',2,[5,5],.8);
      label('SPIRAL HUB '+(sc+1),guide.centres[sc].x+20,guide.centres[sc].y-20,'#fff','#2b59ff');
    }

    for(var arm=0;arm<guide.arms;arm++){
      var armPts=guide.points.filter(function(p){return p.arm===arm});
      for(var ap=1;ap<armPts.length;ap++){
        line(armPts[ap-1],armPts[ap],arm===0?'#ff6138':'#2b59ff',2,[6,5],.62);
      }
      for(var arp=0;arp<armPts.length;arp+=Math.max(1,Math.floor(armPts.length/7))){
        var cp=guide.centres[arm%guide.centres.length];
        line(cp,armPts[arp],'#b8860b',1,[3,8],.34);
      }
    }
    label('STEP ≈ '+(guide.step*180/Math.PI).toFixed(1)+'°',32,A.H-32,'#11110f','#d9ff54');
  }

  if(guide&&guide.type==='rects'){
    ctx.save();
    ctx.strokeStyle='#2b59ff';
    ctx.lineWidth=1.5;
    ctx.globalAlpha=.62;
    for(var rc=0;rc<guide.cells.length;rc++){
      var cell=guide.cells[rc];
      ctx.setLineDash(cell.depth%2?[5,5]:[]);
      ctx.strokeRect(cell.x,cell.y,cell.w,cell.h);
      if(rc<10){
        label('d'+cell.depth,cell.x+4,cell.y+12,'#fff','#2b59ff');
      }
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle='#ff6138';
    ctx.lineWidth=3;
    ctx.strokeRect(guide.root.x,guide.root.y,guide.root.w,guide.root.h);
    ctx.restore();
    label('RECURSIVE φ PARTITIONS / '+guide.variant,32,A.H-32,'#11110f','#d9ff54');
  }

  if(guide&&guide.type==='burst'){
    for(var bh=0;bh<guide.hubs.length;bh++){
      var hub=guide.hubs[bh];
      cross(hub,'#ff6138',18,3);
      ring(hub,Math.max(24,hub.territory*.12),'#ff6138',2,[6,5],.78);
      label('HUB '+(bh+1),hub.x+20,hub.y-20,'#11110f','#ff6138');
    }
    for(var br=0;br<guide.rays.length;br++){
      var ray=guide.rays[br];
      var from=guide.hubs[ray.hub];
      line(from,ray,'#2b59ff',1,[4,6],.34);
    }
    label('GOLDEN-ANGLE RADIATION / '+guide.variant,32,A.H-32,'#fff','#2b59ff');
  }

  if(guide&&guide.type==='scribble'){
    for(var sa=0;sa<guide.anchors.length;sa++){
      var anchor=guide.anchors[sa];
      ring(anchor,anchor.radius,'#2b59ff',2,[9,7],.64);
      cross(anchor,'#ff6138',12,2.5);
      var arrow={
        x:anchor.x+Math.cos(anchor.flow)*Math.min(90,anchor.radius*.65),
        y:anchor.y+Math.sin(anchor.flow)*Math.min(90,anchor.radius*.65)
      };
      line(anchor,arrow,'#ff6138',3,[],.72);
      label('TERRITORY '+(sa+1),anchor.x+14,anchor.y-16,'#fff','#2b59ff');
    }
    label('WEIGHTED φ TERRITORIES + FLOW / '+guide.variant,32,A.H-32,'#11110f','#d9ff54');
  }

  if(guide&&guide.type==='organic'){
    for(var or=0;or<guide.roots.length;or++){
      cross(guide.roots[or],'#ff6138',15,3);
      label('ROOT '+(or+1),guide.roots[or].x+17,guide.roots[or].y-16,'#11110f','#ff6138');
    }
    for(var os=0;os<guide.segments.length;os++){
      var seg=guide.segments[os];
      var alpha=Math.max(.18,.72-seg.depth*.08);
      line({x:seg.x1,y:seg.y1},{x:seg.x2,y:seg.y2},seg.depth<2?'#2b59ff':'#11110f',Math.max(1,3-seg.depth*.25),seg.depth>2?[4,5]:[],alpha);
    }
    label('φ-SCALED BRANCH DECAY',32,A.H-32,'#fff','#2b59ff');
  }

  if(guide&&guide.type==='constructed'){
    for(var ci=0;ci<guide.items.length;ci++){
      var item=guide.items[ci];
      var col=item.tier==='hero'?'#ff6138':(item.tier==='medium'?'#2b59ff':'#11110f');
      ring(item,Math.max(5,item.size*.5),col,item.tier==='hero'?3:1.3,item.tier==='small'?[4,6]:[],item.tier==='small'?.28:.68);
      cross(item,col,item.tier==='hero'?13:6,item.tier==='hero'?3:1.2);
      var axisLen=item.size*.62;
      line(
        {x:item.x-Math.cos(item.rot)*axisLen*.5,y:item.y-Math.sin(item.rot)*axisLen*.5},
        {x:item.x+Math.cos(item.rot)*axisLen*.5,y:item.y+Math.sin(item.rot)*axisLen*.5},
        col,1.4,[5,5],.52
      );
      if(item.tier==='hero'){
        label('HERO '+Math.round(item.size),item.x+15,item.y-16,'#11110f','#ff6138');
      }
    }
    label('INDEPENDENT FORMS / '+guide.variant,32,A.H-32,'#11110f','#d9ff54');
  }

  // Explain what the viewer is seeing.
  ctx.save();
  ctx.fillStyle='rgba(17,17,15,.92)';
  ctx.fillRect(A.W-390,24,360,88);
  ctx.fillStyle='#d9ff54';
  ctx.font='900 21px Arial, Helvetica, sans-serif';
  ctx.fillText('SYSTEM REVEAL',A.W-370,52);
  ctx.fillStyle='#fff';
  ctx.font='bold 12px Courier New, monospace';
  ctx.fillText((meta.strategy||s.mode).toUpperCase(),A.W-370,75);
  ctx.fillStyle='#ff6138';
  ctx.fillText('φ '+s.phiStrength+'%  /  SEED '+s.seed,A.W-370,96);
  ctx.restore();
};

A.render=function(target,s,scale,showGeometry){
  // Set logical dimensions for every render, including plugin/headless exports.
  // Absence of orientation preserves the original landscape format.
  A.W=s.orientation==='portrait'?1000:1400;
  A.H=s.orientation==='portrait'?1400:1000;
  scale=scale||1;
  target.width=A.W*scale;
  target.height=A.H*scale;

  var ctx=target.getContext('2d');
  if(scale!==1)ctx.scale(scale,scale);

  var r=A.makeR(s.seed+'|'+JSON.stringify(randomSettings(s)));
  A.paper(ctx,s,r);
  var pal=A.hues(s,r);
  var meta;

  if(s.mode==='field'){
    if(A.rendererVersion===1)meta=drawFieldLegacy(ctx,s,r,pal);
    else if(A.rendererVersion===2)meta=drawField(ctx,s,r,pal);
    else meta=drawFieldV3(ctx,s,r,pal);
  }else if(s.mode==='spiral'){
    meta=A.rendererVersion>=6?drawSpiralV6(ctx,s,r,pal):(A.rendererVersion>=4?drawSpiralV4(ctx,s,r,pal):drawSpiral(ctx,s,r,pal));
  }else if(s.mode==='rects'){
    meta=drawRects(ctx,s,r,pal);
  }else if(s.mode==='burst'){
    meta=drawBurst(ctx,s,r,pal);
  }else if(s.mode==='network'){
    meta=drawNetwork(ctx,s,r,pal);
  }else if(s.mode==='scribble'){
    meta=drawScribble(ctx,s,r,pal);
  }else if(s.mode==='organic'){
    meta=A.rendererVersion>=7?drawOrganicV7(ctx,s,r,pal):drawOrganic(ctx,s,r,pal);
  }else if(s.mode==='geometric'){
    meta=drawGeometric(ctx,s,r,pal);
  }else{
    meta=drawField(ctx,s,r,pal);
  }

  if(showGeometry)A.geometryOverlay(ctx,s,meta);

  A.lastRenderMeta={
    strategy:(meta&&meta.strategy)||chooseStrategy(s),
    voids:(meta&&meta.voids)||[],
    guide:(meta&&meta.guide)||null
  };
  return A.lastRenderMeta;
};

})(window.AlgoArt);