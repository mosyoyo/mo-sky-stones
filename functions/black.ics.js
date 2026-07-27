const { generateICS } = require('../ics-generator');
const { createIcsResponse, handleIcsRequest } = require('./_ics-response');

export async function onRequestGet(context) {
  const ics = generateICS('black', 60, '光遇·黑石(最后一场)');
  return createIcsResponse(context.request, ics, 'sky-black.ics');
}

export async function onRequest(context) {
  return handleIcsRequest(context, onRequestGet);
}
