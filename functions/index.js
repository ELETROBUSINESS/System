const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

// Bibliotecas Fiscais (Pure JS)
const { create } = require('xmlbuilder2');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('xmldom');
const axios = require('axios');
const https = require('https');
const forge = require('node-forge');

// Inicialização do Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ==========================================================
// 1. VARIÁVEIS DE AMBIENTE
// ==========================================================
const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');
const certBase64 = defineString('FISCAL_CERT_BASE64');
const certPassword = defineString('FISCAL_CERT_PASSWORD');
const cscToken = defineString('FISCAL_CSC');
const cscIdToken = defineString('FISCAL_CSC_ID');

const WEBHOOK_URL = "https://us-central1-super-app25.cloudfunctions.net/processWebhook";

// ==========================================================
// 2. FUNÇÕES AUXILIARES FISCAIS
// ==========================================================

const getFiscalConfig = () => {
    // console.log("--> [DEBUG] Lendo configurações fiscais...");
    const b64 = certBase64.value();
    const pass = certPassword.value();

    if (!b64) throw new Error("FISCAL_CERT_BASE64 está vazia. Verifique o arquivo .env");
    if (!pass) throw new Error("FISCAL_CERT_PASSWORD está vazia. Verifique o arquivo .env");

    return {
        pfxBase64: b64,
        password: pass,
        csc: cscToken.value(),
        cscId: cscIdToken.value()
    };
};

const extractCertData = (pfxBase64, password) => {
    console.log("--> [DEBUG] Iniciando extração do PFX...");

    let pfxDer;
    try {
        pfxDer = forge.util.decode64(pfxBase64);
    } catch (e) {
        throw new Error(`Falha ao decodificar Base64: ${e.message}`);
    }

    let pfx;
    try {
        const pfxAsn1 = forge.asn1.fromDer(pfxDer);
        pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
    } catch (e) {
        throw new Error(`Senha incorreta ou PFX corrompido: ${e.message}`);
    }

    // Busca Chave Privada
    let keyBag = null;
    const bags1 = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const bags2 = pfx.getBags({ bagType: forge.pki.oids.keyBag });

    if (bags1 && bags1[forge.pki.oids.pkcs8ShroudedKeyBag] && bags1[forge.pki.oids.pkcs8ShroudedKeyBag].length > 0) {
        keyBag = bags1[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    } else if (bags2 && bags2[forge.pki.oids.keyBag] && bags2[forge.pki.oids.keyBag].length > 0) {
        keyBag = bags2[forge.pki.oids.keyBag][0];
    }

    if (!keyBag) {
        throw new Error("CRÍTICO: Chave privada não encontrada no PFX.");
    }

    // --- CORREÇÃO AQUI ---
    // Converte para PEM e substitui quebras de linha Windows (\r\n) por Linux (\n)
    const privateKeyRaw = forge.pki.privateKeyToPem(keyBag.key);
    const privateKey = privateKeyRaw.replace(/\r\n/g, '\n');

    console.log("--> [DEBUG] Chave Privada OK.");

    // Busca Certificado Público
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag][0];
    const certificate = forge.pki.certificateToPem(certBag.cert);

    const cleanCert = certificate
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\r\n/g, '')
        .replace(/\n/g, '')
        .trim();

    return { privateKey, certificate, cleanCert };
};

const signNFCe = (xml, privateKey, cleanCert) => {
    console.log("--> [DEBUG] Entrou na função signNFCe");

    if (!privateKey) throw new Error("ERRO: privateKey vazia");

    // Garante normalização novamente por segurança
    const keyString = String(privateKey).trim();

    // Instancia passando a chave JÁ nas opções (Correção para xml-crypto v4+)
    const sig = new SignedXml({
        privateKey: keyString
    });

    // Configurações da Assinatura
    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    sig.addReference({
        xpath: "//*[local-name(.)='infNFe']",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });

    // Redundância: Define via setter também
    sig.signingKey = keyString;

    sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`
    };

    try {
        sig.computeSignature(xml);
        console.log("--> [DEBUG] Assinatura computada com SUCESSO!");
    } catch (e) {
        console.error("--> [ERRO XML-CRYPTO]:", e.message);
        throw e;
    }

    return sig.getSignedXml();
};

// ==========================================================
// 3. FUNÇÕES EXPORTADAS (ENDPOINT)
// ==========================================================

exports.emitirNfce = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });

            const fiscal = getFiscalConfig();
            const certData = extractCertData(fiscal.pfxBase64, fiscal.password);

            const randomNum = Math.floor(Math.random() * 99999999);
            const chaveAcesso = `1525124569232700010065001000${randomNum}1000000010`;
            const idNFe = `NFe${chaveAcesso}`;
            // Substitua a linha do dataEmissao por esta lógica:
            const now = new Date();
            const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
            const dataEmissao = brazilTime.toISOString().split('.')[0] + '-03:00';

            const xmlObj = {
                NFe: {
                    '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
                    infNFe: {
                        '@Id': idNFe,
                        '@versao': '4.00',
                        ide: {
                            cUF: '15',
                            cNF: String(randomNum),
                            natOp: 'VENDA AO CONSUMIDOR',
                            mod: '65',
                            serie: '1',
                            nNF: '1',
                            dhEmi: dataEmissao,
                            tpNF: '1',
                            idDest: '1',
                            cMunFG: '1503457',
                            tpImp: '4',
                            tpEmis: '1',
                            cDV: '0',
                            tpAmb: '2',
                            finNFe: '1',
                            indFinal: '1',
                            indPres: '1',
                            procEmi: '0',
                            verProc: '1.0.0'
                        },
                        emit: {
                            CNPJ: '45692327000100',
                            xNome: 'A N F DA SILVA LTDA',
                            enderEmit: {
                                xLgr: 'RUA JARBAS PASSARINHO',
                                nro: '100',
                                xBairro: 'CENTRO',
                                cMun: '1503457',
                                xMun: 'IPIXUNA DO PARA',
                                UF: 'PA',
                                CEP: '68637000',
                                cPais: '1058',
                                xPais: 'BRASIL'
                            },
                            IE: '158228057',
                            CRT: '1'
                        },
                        det: [{
                            '@nItem': '1',
                            prod: {
                                cProd: 'TESTE001',
                                cEAN: 'SEM GTIN',
                                xProd: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
                                NCM: '85444200',
                                CFOP: '5102',
                                uCom: 'UN',
                                qCom: '1.0000',
                                vUnCom: '10.00',
                                vProd: '10.00',
                                cEANTrib: 'SEM GTIN',
                                uTrib: 'UN',
                                qTrib: '1.0000',
                                vUnTrib: '10.00',
                                indTot: '1'
                            },
                            imposto: {
                                ICMS: { ICMSSN102: { orig: '0', CSOSN: '102' } },
                                PIS: { PISOutr: { CST: '99', vBC: '0.00', pPIS: '0.00', vPIS: '0.00' } },
                                COFINS: { COFINSOutr: { CST: '99', vBC: '0.00', pCOFINS: '0.00', vCOFINS: '0.00' } }
                            }
                        }],
                        total: {
                            ICMSTot: {
                                vBC: '0.00', vICMS: '0.00', vICMSDeson: '0.00', vFCP: '0.00', vBCST: '0.00',
                                vST: '0.00', vFCPST: '0.00', vFCPSTRet: '0.00', vProd: '10.00', vFrete: '0.00',
                                vSeg: '0.00', vDesc: '0.00', vII: '0.00', vIPI: '0.00', vIPIDevol: '0.00',
                                vPIS: '0.00', vCOFINS: '0.00', vOutro: '0.00', vNF: '10.00', vTotTrib: '0.00'
                            }
                        },
                        transp: { modFrete: '9' },
                        pag: {
                            detPag: [{ tPag: '01', vPag: '10.00' }]
                        }
                    }
                }
            };

            const xmlString = create(xmlObj).end({ headless: true });

            // Tenta assinar
            const signedXml = signNFCe(xmlString, certData.privateKey, certData.cleanCert);

            // CORREÇÃO: XML em linha única para evitar erro 588 (Caracteres de edição)
            const soapEnvelope = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>1</idLote><indSinc>1</indSinc>${signedXml}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;

            console.log("Enviando requisição para SEFAZ (SVRS)...");


            const agent = new https.Agent({
                pfx: Buffer.from(fiscal.pfxBase64, 'base64'),
                passphrase: fiscal.password,
                rejectUnauthorized: false // <--- ADICIONE ESTA LINHA
            });

            const sefazUrl = "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx";

            const response = await axios.post(sefazUrl, soapEnvelope, {
                httpsAgent: agent,
                headers: { "Content-Type": "application/soap+xml; charset=utf-8" }
            });

            return res.status(200).json({
                status: "comunicacao_sucesso",
                sefaz_response_status: response.status,
                sefaz_data: response.data
            });

        } catch (error) {
            console.error("Erro no Processo:", error);
            const errorData = error.response ? error.response.data : error.message;
            return res.status(500).send({
                error: "Falha na emissão",
                message: error.message,
                details: errorData,
                stack: error.stack
            });
        }
    });
});

// ==========================================================
// FUNÇÕES MERCADO PAGO (Restauradas)
// ==========================================================
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });
        try {
            const { items, userId, shippingCost, deliveryData, clientData } = req.body;
            if (!items || items.length === 0) return res.status(400).send({ error: "No items" });
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);
            const formattedItems = items.map(item => ({ id: item.id, title: item.name, quantity: parseInt(item.quantity), unit_price: Number(item.priceNew) }));
            if (Number(shippingCost) > 0) formattedItems.push({ id: "shipping", title: "Frete", quantity: 1, unit_price: Number(shippingCost) });
            const orderRef = await db.collection("orders").add({ userId: userId || 'guest', items, total: items.reduce((s, i) => s + (Number(i.priceNew) * Number(i.quantity)), 0) + (Number(shippingCost) || 0), createdAt: admin.firestore.FieldValue.serverTimestamp() });
            const response = await preferenceClient.create({ body: { items: formattedItems, back_urls: { success: "https://eletrobusiness.com.br/", failure: "https://eletrobusiness.com.br/", pending: "https://eletrobusiness.com.br/" }, auto_return: "approved", external_reference: orderRef.id, notification_url: WEBHOOK_URL } });
            return res.status(200).send({ preferenceId: response.id, orderId: orderRef.id });
        } catch (error) { return res.status(500).send({ error: error.message }); }
    });
});

exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const body = req.body;
            const paymentData = body.payment_data || body.formData;
            if (!paymentData) return res.status(400).send({ error: "Dados ausentes" });
            const client = new MercadoPagoConfig({ accessToken: mercadoPagoToken.value() });
            const payment = new Payment(client);
            const response = await payment.create({ body: { ...paymentData, notification_url: WEBHOOK_URL } });
            return res.status(200).send(response);
        } catch (error) { return res.status(400).send(error.response ? error.response.data : { message: error.message }); }
    });
});

exports.processWebhook = functions.https.onRequest(async (req, res) => {
    return res.status(200).send("OK");
});