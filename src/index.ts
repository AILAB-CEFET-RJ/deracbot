// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

import { https, Request, Response } from 'firebase-functions';
import { WebhookClient } from 'dialogflow-fulfillment';
import { Card, Suggestion } from 'dialogflow-fulfillment';

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.dialogflowFirebaseFulfillment = https.onRequest((request: Request, response: Response) => {
  const _agent = new WebhookClient({ request: request, response: response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function GetStatusIsencao(agent: WebhookClient) {
    agent.add(`Webhook code: I didn't understand`);
    agent.add(`Webhook code: I'm sorry, can you try again?`);
  }

  function NovaIsencao(agent: WebhookClient) {
    agent.add(`Webhook code: Welcome to my agent!`);
  }

  // // Uncomment and edit to make your own intent handler
  // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function yourFunctionHandler(agent: WebhookClient) {
  //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
  //   agent.add(new Card({
  //       title: `Title: this is a card title`,
  //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
  //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
  //       buttonText: 'This is a button',
  //       buttonUrl: 'https://assistant.google.com/'
  //     })
  //   );
  //   agent.add(new Suggestion(`Quick Reply`));
  //   agent.add(new Suggestion(`Suggestion`));
  //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
  // }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set("GetStatusIsencao", GetStatusIsencao);
  intentMap.set("NovaIsencao", NovaIsencao);
  // intentMap.set('your intent name here', yourFunctionHandler);
  _agent.handleRequest(intentMap);
});
