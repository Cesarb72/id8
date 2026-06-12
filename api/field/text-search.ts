import {
  buildFieldProxyBlockedResponse,
  parseFieldProxyJsonBody,
  validateFieldProxyMethod,
  validateFieldTextSearchRequestBody,
  type FieldRequestValidationFailureReason,
} from './_lib/fieldRequestValidation'

interface FieldProxyRequest {
  method?: string
  body?: unknown
}

interface FieldProxyResponse {
  status: (statusCode: number) => FieldProxyResponse
  json: (payload: unknown) => void
  setHeader?: (name: string, value: string) => void
}

function sendBlockedResponse(
  response: FieldProxyResponse,
  statusCode: number,
  reason: FieldRequestValidationFailureReason,
): void {
  response.status(statusCode).json(
    buildFieldProxyBlockedResponse({
      reason,
    }),
  )
}

export default async function handler(
  request: FieldProxyRequest,
  response: FieldProxyResponse,
): Promise<void> {
  response.setHeader?.('Cache-Control', 'no-store')

  const methodFailure = validateFieldProxyMethod(request.method)
  if (methodFailure && !methodFailure.ok) {
    sendBlockedResponse(response, methodFailure.statusCode, methodFailure.reason)
    return
  }

  const parsedBody = parseFieldProxyJsonBody(request.body)
  if (!parsedBody.ok) {
    sendBlockedResponse(response, parsedBody.statusCode, parsedBody.reason)
    return
  }

  const validation = validateFieldTextSearchRequestBody(parsedBody.body)
  if (!validation.ok) {
    sendBlockedResponse(response, validation.statusCode, validation.reason)
    return
  }

  response.status(503).json(
    buildFieldProxyBlockedResponse({
      request: validation.request,
      reason: 'field_proxy_not_activated',
    }),
  )
}
