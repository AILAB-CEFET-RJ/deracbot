// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers
import * as functions from "firebase-functions";
import { Request } from "firebase-functions/lib/common/providers/https";
import { Response } from "firebase-functions/lib/v1";

// The Firebase Admin SDK to access Firestore
import * as admin from "firebase-admin";
admin.initializeApp();

// Fulfillment
import { WebhookClient } from 'dialogflow-fulfillment';
import { DocumentData, DocumentReference, QuerySnapshot, Firestore, WriteBatch, QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore";


// Enumeration
type StatusIsencao =
    | "DEFERIDA"
    | "INDEFERIDA"
    | "ABERTA";

type LogLevel =
    | "INFO"
    | "DEBUG"
    | "WARNING";


// Types
interface AgentContext {
    name: string;
    lifespan: number;
    parameters: { [key: string]: string };
}

interface AlunoDto {
    MATRICULA: string,
    ID_CURSO: string,
    NOME_COMPLETO: string,
    DATA_CADASTRO: Timestamp,
    DATA_ATUALIZACAO: Timestamp
}

interface CursoDto {
    ID_CURSO: string,
    NOME: string
}

interface DisciplinaDto {
    ID_DISCIPLINA: string,
    ID_CURSO: string,
    CARGA_HORARIA: number,
    NOME: string
}

interface RequisicaoDto {
    MATRICULA: string,
    DATA_CADASTRO: Timestamp,
    ESTRUTURA_CURRICULAR: string,
    ID_DISCIPLINAS: Array<string>,
    SITUACAO: StatusIsencao
}


// Long type name aliases
type FirestoreCountQuerySnapshot = FirebaseFirestore.AggregateQuerySnapshot<{ count: FirebaseFirestore.AggregateField<number> }>;
type IntentHandlerFunction = (agent: WebhookClient) => void | Promise<void>;


// Auxliar function

/**
 * Loga um texto no console assincronamente para não causar timeout (5 segundos para o DialogFlow).
 * @param text texto para ser logado
 * @param logLevel um dos valores no enum LogLevel para filtrar o tipo de log
 */
function logDefered(text: String, logLevel: LogLevel = "INFO"): void {
    const LOGGING_LEVELS: Array<LogLevel> = ["INFO", "DEBUG", "WARNING"];
    if (LOGGING_LEVELS.includes(logLevel)) {
        const date: string = (new Date()).toLocaleDateString("pt-BR").slice(0, 5); // Format: dd/MM
        const time: string = (new Date()).toLocaleTimeString("pt-BR"); // Format: hh:mm:ss
        setTimeout(() => {
            console.log(`${logLevel} | ${date} ${time}: ${text}`);
        }, 1000);
    }
}

/**
 * Deve ser chamada em todas as tratativas de exceção.
 * @param agent referência para o WebhookClient no qual a resposta será gravada
 * @param reason exceção ou texto descritivo do erro
 */
function onCatch(agent: WebhookClient, reason: any): void {
    const resposta: string = `EXCEPTION! ${reason}`;
    logDefered(resposta, "WARNING");
    agent.add(resposta);
}

/**
 * Função que deve ser chamada quando uma réplica puder extrapolar o limite de caracteres permitidos pela plataforma no front (Facebook Messenger).
 * @param agent referência para o WebhookClient no qual a resposta será gravada
 * @param resposta texto atual a ser a ser retornado
 * @param line texto a ser adicionado na resposta atual
 * @returns novo texto para substituir a resposta a ser retornada
 */
function addOrAccumulateReplyText(agent: WebhookClient, resposta: string, line: string): string {
    // Número máximo de caracteres permitido por réplica
    const MAX_CHARS: number = 1000;

    if (resposta.length + line.length > MAX_CHARS) {
        logDefered(resposta, "DEBUG");
        agent.add(resposta);
        return line;
    } else {
        return resposta + line;
    }
}


// Main code
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request: Request, response: Response<any>): void => {
    const _agent: WebhookClient = new WebhookClient({ request: request, response: response });

    // https://github.com/dialogflow/dialogflow-fulfillment-nodejs/issues/187#issuecomment-508493169
    function getContext(name: string): AgentContext | undefined {
        const contexts: Array<any> = request.body.queryResult.outputContexts;
        for (let i = 0; i != contexts.length; ++i) {
            if (String(contexts[i].name).toLowerCase().includes(name.toLowerCase())) {
                return contexts[i];
            }
        }
        return undefined;
    }

    // Reference: https://googleapis.dev/nodejs/firestore/latest/Firestore.html
    const firestore: Firestore = admin.firestore();
    // logDefered("Chamou. Body: " + request.rawBody.toString("utf-8"));

    async function IniciarChat(agent: WebhookClient): Promise<void> {
        logDefered("Running IniciarChat");
        // Reference: https://groups.google.com/g/dialogflow-cx-edition-users/c/jajSEPqhYZE?pli=1
        // Workaround to avoid timeouts that also works as health check

        // Reference: https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html#select-examples
        try {
            await firestore.collection("CURSO").count().get();

            const resposta: string = "Olá! Voce quer pedir isenção de uma materia ou conferir o status de um pedido já aberto?";
            logDefered(resposta, "DEBUG");
            agent.add(resposta);

        } catch (e) {
            onCatch(agent, e);
        }
    }

    async function GetStatusIsencao(agent: WebhookClient): Promise<void> {
        logDefered("Running GetStatusIsencao");

        try { // Auxiliar variables
            const matricula: string | undefined = agent.parameters.matricula?.toUpperCase();
            if (!matricula) {
                const resposta: string = "Digite sua matrícula para conferir o status do pedido de isenção:";
                logDefered(resposta, "DEBUG");
                agent.add(resposta);
                return;
            }

            const res: QuerySnapshot<DocumentData> = await firestore.collection("REQUISICAO")
                .where("MATRICULA", "!=", "MATRICULA_MOCK")
                .where("MATRICULA", "==", matricula)
                .orderBy("DATA_CADASTRO", "desc")
                .select("SITUACAO")
                .limit(2)
                .get();

            let resposta = "";
            if (res.size == 0) {
                resposta = `Nenhum pedido de isenção encontrado para ${matricula}.`;
            } else {
                const ultimo = res.size == 1 ? "do" : "do último";
                resposta = `O status ${ultimo} pedido de isenção de ${matricula} é: ${res.docs[0].get("SITUACAO")}.`;
            }

            logDefered(resposta, "DEBUG");
            agent.add(resposta);

        } catch (e) {
            onCatch(agent, e);
        }
    }

    async function NovaIsencao(agent: WebhookClient): Promise<void> {
        logDefered("Running NovaIsencao");

        // Auxiliar variables
        const matricula: string | undefined = agent.parameters.matricula?.toUpperCase();
        const id_curso: string | undefined = agent.parameters.id_curso?.toUpperCase();

        // Conferir se a matrícula foi inserida
        logDefered(`matricula: '${matricula}'`);
        if (!matricula) {
            const resposta: string = "Digite sua matrícula para abrir um novo pedido de isenção.";
            logDefered(resposta, "DEBUG");
            agent.add(resposta);
            return;
        }

        // Conferir se a matrícula inserida tem alguma requisicao aberta
        try {
            const res: QuerySnapshot<DocumentData> = await firestore.collection("REQUISICAO")
                .where("MATRICULA", "!=", "MATRICULA_MOCK")
                .where("MATRICULA", "==", matricula)
                .where("SITUACAO", "==", "ABERTA")
                .orderBy("DATA_CADASTRO", "asc")
                .select("DATA_CADASTRO")
                .limit(1)
                .get();

            // A matrícula inserida tem uma requisicao aberta
            let resposta = "";
            if (res.size != 0) {
                const dataRequisicao: Timestamp = res.docs[0].get("DATA_CADASTRO");
                resposta = `A matrícula ${matricula} possui uma solicitação ABERTA realizada na data `;
                resposta += `${dataRequisicao.toDate().toLocaleDateString("pt-BR")} `; // Format: dd/MM/yyyy
                resposta += `${dataRequisicao.toDate().toLocaleTimeString("pt-BR")}.`; // Format: hh:mm:ss

                logDefered(resposta, "DEBUG");
                agent.add(resposta);
                return;
            }

            // Função para listar todos os cursos disponíveis
            let listCourses = async (): Promise<void> => {
                const res: QuerySnapshot<DocumentData> = await firestore.collection("CURSO")
                    .where("ID_CURSO", "!=", "CURSO_MOCK")
                    .orderBy("ID_CURSO", "asc")
                    .select("ID_CURSO", "NOME")
                    .get();


                let resposta = "";
                if (res.size == 0) {
                    resposta = "Nenhum curso cadastrado. Contate o DERAC.";
                } else {
                    resposta = "Digite a sigla do seu curso:\n";
                    for (let i = 0; i != res.size; ++i) {
                        const line: string = `\n${res.docs[i].get("ID_CURSO")} - ${res.docs[i].get("NOME")}`;
                        resposta = addOrAccumulateReplyText(agent, resposta, line);
                    }
                }

                if (resposta) {
                    logDefered(resposta, "DEBUG");
                    agent.add(resposta);
                }
            }

            // Não preencheu curso ainda: dá opções de cursos
            logDefered(`id_curso: '${id_curso}'`);
            if (!id_curso) {
                return listCourses();
            }

            // Preencheu curso corretamente?
            const res2: FirestoreCountQuerySnapshot = await firestore.collection("CURSO")
                .where("ID_CURSO", "!=", "CURSO_MOCK")
                .where("ID_CURSO", "==", id_curso)
                .count()
                .get();

            // Não preencheu curso corretamente
            if (res2.data().count == 0) {
                return listCourses();
            }

            // Mostra lista de disciplinas
            const res3: QuerySnapshot<DocumentData> = await firestore.collection("DISCIPLINA")
                .where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK")
                .where("ID_CURSO", "==", id_curso)
                .orderBy("ID_DISCIPLINA", "asc")
                .select("NOME")
                .get();

            if (res3.size == 0) {
                resposta = `Nenhuma disciplina cadastrada para o curso ${id_curso}. Contate o DERAC.`;
            } else {
                resposta = "Digite o número de uma ou mais disciplinas para isentar:\n";
                for (let i = 0; i != res3.size; ++i) {
                    const line: string = `\n${i} - ${res3.docs[i].get("NOME")}`;
                    resposta = addOrAccumulateReplyText(agent, resposta, line);
                }
            }

            if (resposta) {
                logDefered(resposta, "DEBUG");
                agent.add(resposta);
            }

        } catch (e) {
            onCatch(agent, e);
        }
    }

    async function ReceberMateria(agent: WebhookClient): Promise<void> {
        logDefered("Running ReceberMateria");
        const NENHUMA_DISCIPLINA: string = "Você não escolheu nenhum número válido de disciplina.\n\nDigite o número de uma ou mais disciplinas para isentar.";

        // Auxiliar variables
        // @ts-ignore
        const number: Array<Number> | undefined = agent.parameters.number;
        if (!number || number.length === 0) {
            logDefered(NENHUMA_DISCIPLINA, "DEBUG");
            agent.add(NENHUMA_DISCIPLINA);
            return;
        }

        try {
            let id_curso: string | undefined = getContext("NovaIsencao")?.parameters.id_curso;
            if (!id_curso) {
                throw "Parâmetro ID_CURSO não encontrado. Contate o DERAC.";
            } else {
                id_curso = id_curso.toUpperCase();
            }

            // Mostra lista de disciplinas escolhidas pela pessoa
            const res: QuerySnapshot<DocumentData> = await firestore.collection("DISCIPLINA")
                .where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK")
                .where("ID_CURSO", "==", id_curso)
                .orderBy("ID_DISCIPLINA", "asc")
                .select("ID_DISCIPLINA", "NOME")
                .get();

            let resposta: string = "Você escolheu a(s) seguinte(s) disciplina(s):\n";
            let count: number = 0;
            for (let i = 0; i != res.size; ++i) {
                if (number.includes(i)) {
                    const line: string = `\n${res.docs[i].get("ID_DISCIPLINA")} - ${res.docs[i].get("NOME")}`;
                    resposta = addOrAccumulateReplyText(agent, resposta, line);
                    ++count;
                }
            }

            // Retorna mensagem de erro caso nenhum índice de disciplina seja válido
            if (count == 0) {
                logDefered(NENHUMA_DISCIPLINA, "DEBUG");
                agent.add(NENHUMA_DISCIPLINA);
                return;
            }

            const respostaFinal: string = "\n\nDigite o número de uma ou mais disciplinas para isentar. Ou envie o arquivo Plano de Ensino da instituição em que cursou as disciplinas para finalizar.";
            resposta = addOrAccumulateReplyText(agent, resposta, respostaFinal);
            if (resposta) {
                logDefered(resposta, "DEBUG");
                agent.add(resposta);
            }

        } catch (e) {
            onCatch(agent, e);
        }
    }

    async function ReceiveFile(agent: WebhookClient): Promise<void> {
        logDefered("Running ReceiveFile");

        try { // Auxiliar variable
            const downloadUrl: string | undefined = request.body.originalDetectIntentRequest?.payload?.data?.message?.attachments[0]?.payload?.url;
            if (!downloadUrl) {
                throw "Parâmetro \"downloadUrl\" não encontrado. Contate o DERAC.";
            }

            let matricula: string | undefined = getContext("NovaIsencao")?.parameters?.matricula;
            if (!matricula) {
                throw "Parâmetro \"matricula\" não encontrado. Contate o DERAC.";
            } else {
                matricula = matricula.toUpperCase();
            }

            let id_curso: string | undefined = getContext("NovaIsencao")?.parameters?.id_curso;
            if (!id_curso) {
                throw "Parâmetro \"id_curso\" não encontrado. Contate o DERAC.";
            } else {
                id_curso = id_curso.toUpperCase();
            }

            // @ts-ignore
            const number: Array<Number> | undefined = getContext("ReceberMateria")?.parameters?.number;
            const disciplinas: Array<string> = [];
            if (!number || number.length === 0) {
                throw "Parâmetro \"number\" não encontrado. Contate o DERAC.";
            } else {
                // Lista todos as disciplinas disponíveis
                const res: QuerySnapshot<DocumentData> = await firestore.collection("DISCIPLINA")
                    .where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK")
                    .where("ID_CURSO", "==", id_curso)
                    .orderBy("ID_DISCIPLINA", "asc")
                    .select("ID_DISCIPLINA")
                    .get();

                for (let i = 0; i != res.size; ++i) {
                    if (number.includes(i)) {
                        disciplinas.push(res.docs[i].get("ID_DISCIPLINA"));
                    }
                }
            }

            // TODO - pedir nome e outros dados pessoais/identificadores?

            // Fill AlunoDto
            const alunoDto: AlunoDto = {
                MATRICULA: matricula,
                ID_CURSO: id_curso,
                NOME_COMPLETO: "",
                DATA_CADASTRO: Timestamp.now(),
                DATA_ATUALIZACAO: Timestamp.now()
            }

            // Verifica se o aluno já está cadastrado
            const res2: QuerySnapshot<DocumentData> = await firestore.collection("ALUNO")
                .where("MATRICULA", "!=", "MATRICULA_MOCK")
                .where("MATRICULA", "==", matricula)
                .select("DATA_CADASTRO")
                .get();

            if (res2.size == 0) {
                // Store "AlunoDto" asynchronously
                firestore.collection("ALUNO").add(alunoDto);

                // } else if (id_curso != res2.docs[0].get("ID_CURSO")) {
            } else {
                alunoDto.DATA_CADASTRO = res2.docs[0].get("DATA_CADASTRO");

                // Update "AlunoDto" asynchronously
                // @ts-ignore
                firestore.batch().update(res2.docs[0].ref, alunoDto).commit();
            }

            // Fill RequisicaoDto
            const requisicaoDto: RequisicaoDto = {
                MATRICULA: matricula,
                DATA_CADASTRO: Timestamp.now(),
                ESTRUTURA_CURRICULAR: downloadUrl,
                ID_DISCIPLINAS: disciplinas,
                SITUACAO: "ABERTA"
            }

            // Store "RequisicaoDto" synchronously
            const res: DocumentReference<DocumentData> = await firestore.collection("REQUISICAO").add(requisicaoDto);

            // Finaliza o fluxo
            const resposta: string = `Pedido de isenção registrado! Identificador da requisição: ${res.id}.`;
            logDefered(resposta, "DEBUG");
            agent.add(resposta);

        } catch (e) {
            onCatch(agent, e);
        }
    }

    async function PopularBD(agent: WebhookClient): Promise<void> {
        logDefered("Running PopularBD");

        const CURSO: Array<CursoDto> = [{ "ID_CURSO": "BCC", "NOME": "Bacharelado em Ciência da Computação" }];
        const DISCIPLINA: Array<DisciplinaDto> = [{ "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7501", "NOME": "Álgebra Linear I" }, { "CARGA_HORARIA": 90, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7301", "NOME": "Cálculo a uma Variável" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1101", "NOME": "Introdução à Administração" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1102", "NOME": "Arquitetura de Computadores" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1103", "NOME": "Projeto de Algoritmos Computacionais" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1104", "NOME": "Lógica Matemática" }, { "CARGA_HORARIA": 54, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7502", "NOME": "Álgebra Linear II" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7302", "NOME": "Cálculo a Várias Variáveis" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1205", "NOME": "Sistemas Operacionais" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1206", "NOME": "Arquiteturas Avançadas de Computadores" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1207", "NOME": "Estruturas de Dados" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1208", "NOME": "Matemática Discreta" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1209", "NOME": "Ciências Ambientais" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7303", "NOME": "Equações Diferenciais Ordinárias" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1309", "NOME": "Sistemas Digitais" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1310", "NOME": "Fundamentos de Redes de Computadores" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1311", "NOME": "Programação Orientada a Objetos" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1312", "NOME": "Engenharia de Requisitos" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1313", "NOME": "Empreendedorismo" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1314", "NOME": "Humanidades e Ciências Sociais" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1416", "NOME": "Análise e Projeto de Sistemas" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1417", "NOME": "Projeto de Banco de Dados" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1418", "NOME": "Organização de Estruturas de Arquivos" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1415", "NOME": "Programação de Software para Web" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1414", "NOME": "Gerência de Projetos de Tecnologia da Informação" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1518", "NOME": "Estatística e Probabilidade" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1519", "NOME": "Arquitetura de Programação" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1520", "NOME": "Arquitetura e Padrões de Software" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1521", "NOME": "Engenharia de Software" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1522", "NOME": "Administração de Banco de Dados" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1523", "NOME": "Metodologia Científica" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1624", "NOME": "Teoria da Computação" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1625", "NOME": "Inferência Estatística" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1626", "NOME": "Inteligência Computacional" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1627", "NOME": "Algoritmos em Grafos" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1628", "NOME": "Interação Humano-Computador" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1629", "NOME": "Prática em Pesquisa Aplicada" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1730", "NOME": "Compiladores" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1731", "NOME": "Computação Gráfica" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1732", "NOME": "Sistemas Concorrentes e Distribuídos" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1733", "NOME": "Projeto e Construção de Sistemas" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1734", "NOME": "Inteligência Artificial" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1735", "NOME": "Concepção e Elaboração de Projeto Final" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1836", "NOME": "Legislação em Informática" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1837", "NOME": "Informática e Sociedade" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1839", "NOME": "Elaboração e Construção de Projeto Final" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1910", "NOME": "Programação de Jogos" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1911", "NOME": "Aplicações para Dispositivos Móveis" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEDA7201", "NOME": "Expressão Oral e Escrita" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEDA7101", "NOME": "Economia" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1912", "NOME": "Gestão de Tecnologia da Informação" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1913", "NOME": "Inteligência de Negócios" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7743", "NOME": "Responsabilidade Social" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7763", "NOME": "Instituições do Direito" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7741", "NOME": "Gestão Estratégica" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7756", "NOME": "Economia Brasileira" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7731", "NOME": "Simulações Empresariais" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7708", "NOME": "Microeconomia" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1914", "NOME": "Tópicos Especiais em Inteligência Computacional" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1915", "NOME": "Programação em Lógica" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1916", "NOME": "Simulações Computacionais" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1917", "NOME": "Tópicos Especiais em Programação I" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1918", "NOME": "Tópicos Especiais em Programação II" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1919", "NOME": "Tópicos Especiais em Programação III" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1920", "NOME": "Tópicos Especiais em Programação IV" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7761", "NOME": "Inovações Tecnológicas" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1921", "NOME": "Aplicações na Internet para TV Digital Interativa" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GADM7765", "NOME": "Práticas em Responsabilidade Socioambiental" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1924", "NOME": "LIBRAS – Língua Brasileira de Sinais" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1924", "NOME": "LIBRAS – Língua Brasileira de Sinais" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1925", "NOME": "Programação de Clientes Web" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1926", "NOME": "Gerência de Dados Semiestruturados" }, { "CARGA_HORARIA": 54, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7304", "NOME": "Equações Diferenciais Parciais e Séries (EDPS)" }, { "CARGA_HORARIA": 54, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7306", "NOME": "Variáveis Complexas" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GEXT7503", "NOME": "Cálculo Vetorial" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1922", "NOME": "Segurança da Informação" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1927", "NOME": "Desenvolvimento de Aplicações Ricas para Internet" }, { "CARGA_HORARIA": 72, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GCC1928", "NOME": "Programação de Servidores WEB" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GLEA1079", "NOME": "Direito Empresarial" }, { "CARGA_HORARIA": 36, "ID_CURSO": "BCC", "ID_DISCIPLINA": "GLEA1081", "NOME": "Inglês Básico" }];

        const fsBatch: WriteBatch = firestore.batch();
        let countResult: FirestoreCountQuerySnapshot;
        let hasSchedule: boolean = false;

        try {
            countResult = await firestore.collection("ALUNO").where("MATRICULA", "==", "MATRICULA_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'ALUNO' collection (MOCK).");
                hasSchedule = true;

                // Mocked placeholder
                const mockedAluno: AlunoDto = {
                    MATRICULA: "MATRICULA_MOCK",
                    ID_CURSO: "CURSO_MOCK",
                    NOME_COMPLETO: "MOCK",
                    DATA_CADASTRO: Timestamp.now(),
                    DATA_ATUALIZACAO: Timestamp.now()
                }

                fsBatch.create(firestore.collection("ALUNO").doc(), mockedAluno);
            }

            countResult = await firestore.collection("ALUNO").where("MATRICULA", "!=", "MATRICULA_MOCK").count().get();
            if (countResult.data().count != 0) {
                logDefered("Scheduling restore of 'ALUNO' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("ALUNO")
                    .where("MATRICULA", "!=", "MATRICULA_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });
            }

            countResult = await firestore.collection("CURSO").where("ID_CURSO", "==", "CURSO_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'CURSO' collection (MOCK).");
                hasSchedule = true;

                // Mocked placeholder
                const mockedCurso: CursoDto = {
                    ID_CURSO: "CURSO_MOCK",
                    NOME: "MOCK"
                }

                fsBatch.create(firestore.collection("CURSO").doc(), mockedCurso);
            }

            countResult = await firestore.collection("CURSO").where("ID_CURSO", "!=", "CURSO_MOCK").count().get();
            if (countResult.data().count != CURSO.length) {
                logDefered("Scheduling restore of 'CURSO' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("CURSO")
                    .where("ID_CURSO", "!=", "CURSO_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });

                for (let i = 0; i != CURSO.length; ++i) {
                    fsBatch.create(firestore.collection("CURSO").doc(), CURSO[i]);
                }
            }

            countResult = await firestore.collection("DISCIPLINA").where("ID_DISCIPLINA", "==", "DISCIPLINA_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'DISCIPLINA' collection (MOCK).");
                hasSchedule = true;

                // Mocked placeholder
                const mockedDisciplina: DisciplinaDto = {
                    ID_DISCIPLINA: "DISCIPLINA_MOCK",
                    ID_CURSO: "CURSO_MOCK",
                    CARGA_HORARIA: 0,
                    NOME: "MOCK"
                }

                fsBatch.create(firestore.collection("DISCIPLINA").doc(), mockedDisciplina);
            }

            countResult = await firestore.collection("DISCIPLINA").where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK").count().get();
            if (countResult.data().count != DISCIPLINA.length) {
                logDefered("Scheduling restore of 'DISCIPLINA' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("DISCIPLINA")
                    .where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });

                for (let i = 0; i != DISCIPLINA.length; ++i) {
                    fsBatch.create(firestore.collection("DISCIPLINA").doc(), DISCIPLINA[i]);
                }
            }

            countResult = await firestore.collection("REQUISICAO").where("MATRICULA", "==", "MATRICULA_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'REQUISICAO' collection (MOCK).");
                hasSchedule = true;

                // Mocked placeholder
                const mockedRequisicao: RequisicaoDto = {
                    MATRICULA: "MATRICULA_MOCK",
                    DATA_CADASTRO: Timestamp.now(),
                    ESTRUTURA_CURRICULAR: "",
                    ID_DISCIPLINAS: [],
                    SITUACAO: "ABERTA"
                }

                fsBatch.create(firestore.collection("REQUISICAO").doc(), mockedRequisicao);
            }

            countResult = await firestore.collection("REQUISICAO").where("MATRICULA", "!=", "MATRICULA_MOCK").count().get();
            if (countResult.data().count != 0) {
                logDefered("Scheduling restore of 'REQUISICAO' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("REQUISICAO")
                    .where("MATRICULA", "!=", "MATRICULA_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });
            }

            // Commits the batch, if required
            if (hasSchedule) {
                logDefered("Commiting scheduled writes...");
                await fsBatch.commit();
                logDefered("Done!");
            }

            // Send success message
            const resposta: string = "Sucesso! Base de dados restaurada.";
            logDefered(resposta, "DEBUG");
            agent.add(resposta);

        } catch (e) {
            onCatch(agent, e);
        }
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map<string, IntentHandlerFunction>();
    intentMap.set("IniciarChat", IniciarChat);
    intentMap.set("GetStatusIsencao", GetStatusIsencao);
    intentMap.set("NovaIsencao", NovaIsencao);
    intentMap.set("ReceberMateria", ReceberMateria);
    intentMap.set("ReceiveFile", ReceiveFile);
    intentMap.set("PopularBD", PopularBD);
    _agent.handleRequest(intentMap).catch((reason: any): void => onCatch(_agent, reason));
});
