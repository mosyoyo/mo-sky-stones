const { generateICS } = require('../ics-generator');
const { createIcsResponse, handleIcsRequest } = require('./_ics-response');

export async function onRequestGet(context) {
  const ics = generateICS('red', 60, '光遇·红石(最后一场)');
  return createIcsResponse(context.request, ics, 'sky-red.ics');
}

export async function onRequest(context) {
  return handleIcsRequest(context, onRequestGet);
}
