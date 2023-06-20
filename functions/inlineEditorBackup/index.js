"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const dialogflow_fulfillment_1 = require("dialogflow-fulfillment");
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const _agent = new dialogflow_fulfillment_1.WebhookClient({ request: request, response: response });
    const firestore = admin.firestore();
    function IniciarChat(agent) {
        return firestore.collection('CURSO')
            .count()
            .get()
            .then((res) => {
            agent.add("Olá! Voce quer pedir isenção de uma materia ou conferir o status de um pedido já aberto?");
        });
    }
    function GetStatusIsencao(agent) {
        const matricula = agent.parameters.matricula;
        setTimeout(() => {
            console.log('Rodando GetStatusIsencao');
        }, 0);
        return firestore.collection('REQUISICAO')
            .where("MATRICULA", "==", matricula)
            .select("DATA_CADASTRO", "SITUACAO")
            .orderBy("DATA_CADASTRO", "desc")
            .limit(1)
            .select("SITUACAO")
            .get()
            .then((res) => {
            var resposta = "";
            if (res.size == 0) {
                resposta = `Nenhum pedido de isenção encontrado para ${matricula}.`;
            }
            else {
                const ultimo = res.size == 1 ? "do" : "do último";
                resposta = `O status ${ultimo} pedido de isenção de ${matricula} é: ${res.docs[0].get("SITUACAO")}.`;
            }
            agent.add("UHUL");
            agent.add(resposta);
            agent.add("WOW");
            setTimeout(() => {
                console.log(resposta);
            }, 0);
        });
    }
    let intentMap = new Map();
    intentMap.set("IniciarChat", IniciarChat);
    intentMap.set("GetStatusIsencao", GetStatusIsencao);
    _agent.handleRequest(intentMap);
});
//# sourceMappingURL=index.js.map