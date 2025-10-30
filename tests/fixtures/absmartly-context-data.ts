import type { ContextData, ExperimentData } from '@absmartly/javascript-sdk/types/context'

interface CreateExperimentOptions {
  name: string
  variantIndex?: number
  variants: Array<{
    config?: Record<string, unknown> | null
  }>
  id?: number
  unitType?: string | null
  iteration?: number
  fullOnVariant?: number
  trafficSplit?: number[]
  trafficSeedHi?: number
  trafficSeedLo?: number
  audience?: string
  audienceStrict?: boolean
  split?: number[]
  seedHi?: number
  seedLo?: number
  variables?: Record<string, unknown>
  variant?: number
  overridden?: boolean
  assigned?: boolean
  exposed?: boolean
  eligible?: boolean
  fullOn?: boolean
  custom?: boolean
  audienceMismatch?: boolean
}

export function createTestExperiment(options: CreateExperimentOptions): ExperimentData {
  const {
    name,
    variants,
    id = 1,
    unitType = 'user_id',
    iteration = 1,
    fullOnVariant = 0,
    trafficSplit = [1, 0],
    trafficSeedHi = 0,
    trafficSeedLo = 0,
    audience = '',
    audienceStrict = false,
    split = variants.map(() => 1),
    seedHi = 0,
    seedLo = 0,
    variables = {},
    variant = 0,
    overridden = false,
    assigned = true,
    exposed = false,
    eligible = true,
    fullOn = false,
    custom = false,
    audienceMismatch = false,
  } = options

  return {
    id,
    name,
    unitType,
    iteration,
    seedHi,
    seedLo,
    split,
    trafficSeedHi,
    trafficSeedLo,
    trafficSplit,
    fullOnVariant,
    audience,
    audienceStrict,
    variants: variants.map(v => ({
      config: v.config ? JSON.stringify(v.config) : null,
    })),
    variables,
    variant,
    overridden,
    assigned,
    exposed,
    eligible,
    fullOn,
    custom,
    audienceMismatch,
    customFieldValues: null,
  }
}

export const basicExperimentData: ContextData = {
  experiments: [
    createTestExperiment({
      name: 'experiment1',
      id: 1,
      variants: [
        {
          config: { domChanges: [] },
        },
        {
          config: {
            domChanges: [
              {
                selector: '.test',
                type: 'text',
                value: 'Test Value',
                trigger_on_view: false,
              },
            ],
          },
        },
      ],
    }),
  ],
}

export const emptyContextData: ContextData = {
  experiments: [],
}

export default {
  basicExperimentData,
  emptyContextData,
  createTestExperiment,
}
