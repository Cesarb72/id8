import { runGeneratePlan } from '../src/domain/runGeneratePlan'

const result = await runGeneratePlan({
  city:'San Jose',
  persona:'friends',
  primaryVibe:'lively',
  distanceMode:'nearby',
  selectedDirectionContext:{
    directionId:'d',
    pocketId:'p',
    label:'L',
    archetype:'a',
    identity:'exploratory',
    cluster:'lively',
    greatStopSignal:{
      source:'scenario_great_stop',available:true,passesNight:false,totalStopCount:5,failedStopCount:2,severeFailureCount:2,
      failedCriteriaCounts:{real:0,role_right:0,intent_right:0,place_right:2,moment_right:0},
      severeCriteriaCounts:{real:0,place_right:2,moment_right:0},
      riskTier:'severe',suppressionRecommended:true,degradedConfidencePenalty:0.12,reasonCodes:['x'],notes:['n']
    }
  }
})
console.log(result.trace.boundaryDiagnostics.refinementNudgeTrace.greatStopQualityContext)
